/**
 * Bo dieu khien phat / tap bai.
 *
 * Player khong dung state cua React: no giu state trong bien thuong va duoc goi `tick()`
 * tu vong requestAnimationFrame cua man hinh choi -> chay muot 60fps, khong re-render lien tuc.
 */

import type { Hand, PlayMode, Settings, Song, SongNote } from '../types'
import { Timeline } from './timeline'
import type { PianoSynth } from '../audio/piano'
import type { Metronome } from '../audio/metronome'

export interface RenderNote extends SongNote {
  idx: number
  /** be phai tu bam not nay */
  required: boolean
  /** thuoc cong thu may (-1 neu khong phai not be bam) */
  gate: number
}

export interface Gate {
  /** phach */
  t: number
  midis: number[]
  /** so thu tu not dau tien cua cong - dung de cuon */
  firstNote: number
}

export interface Stats {
  hit: number
  miss: number
  wrong: number
}

/** Do rong cua so cham diem o che do "theo nhip" (giay). */
const FOLLOW_WINDOW_SEC = 0.28
/** Cho phep bam som truoc cong bao nhieu phach (che do cho). */
const WAIT_LEAD_BEATS = 1.0
/** Lam tron thoi diem not de gom hop am (1/48 phach). */
const QUANT = 48

export interface PlayerEvents {
  onFinish?: () => void
  onFeedback?: (midi: number, kind: 'hit' | 'wrong') => void
  onGateCleared?: (gateIndex: number) => void
}

export class Player {
  song: Song | null = null
  timeline: Timeline | null = null
  notes: RenderNote[] = []
  gates: Gate[] = []

  settings: Settings
  events: PlayerEvents = {}

  playing = false
  waiting = false
  finished = false
  posBeat = 0
  gateIdx = 0
  stats: Stats = { hit: 0, miss: 0, wrong: 0 }

  /** phim nguoi choi dang giu */
  pressed = new Set<number>()
  /** not cua cong hien tai da bam dung (khong can giu) */
  satisfied = new Set<number>()
  /** hieu ung nhay mau: midi -> {kind, den luc nao (ms)} */
  flash = new Map<number, { kind: 'hit' | 'wrong'; until: number }>()

  private sounding = new Map<number, number>() // midi -> phach ket thuc
  /** con tro not ke tiep can phat tieng - tranh quet lai ca bai moi khung hinh */
  private scanIdx = 0
  private lastNow = 0
  private lastBeatTick = -1
  private countInLeft = 0
  private countInTick = -1

  constructor(
    private synth: PianoSynth,
    private metro: Metronome,
    settings: Settings,
  ) {
    this.settings = settings
  }

  // ---------------------------------------------------------------- nap bai

  load(song: Song | null) {
    this.stopAllSound()
    this.song = song
    if (!song) {
      this.timeline = null
      this.notes = []
      this.gates = []
      return
    }
    this.timeline = new Timeline(song)
    this.notes = song.notes
      .slice()
      .sort((a, b) => a.t - b.t || a.m - b.m)
      .map((n, idx) => ({ ...n, idx, required: false, gate: -1 }))
    this.rebuildGates()
    this.reset()
  }

  setSettings(next: Settings) {
    const prev = this.settings
    this.settings = next
    if (prev.hands !== next.hands || prev.mode !== next.mode) {
      this.rebuildGates()
      this.syncGateToPosition()
    }
  }

  /** Tay nao be phai tu bam. */
  private requiredHands(): Hand[] {
    if (this.settings.mode === 'listen') return []
    if (this.settings.hands === 'right') return ['R']
    if (this.settings.hands === 'left') return ['L']
    return ['L', 'R']
  }

  private rebuildGates() {
    const need = new Set(this.requiredHands())
    for (const n of this.notes) {
      n.required = need.has(n.h)
      n.gate = -1
    }
    const groups = new Map<number, RenderNote[]>()
    for (const n of this.notes) {
      if (!n.required) continue
      const key = Math.round(n.t * QUANT)
      const list = groups.get(key)
      if (list) list.push(n)
      else groups.set(key, [n])
    }
    const keys = Array.from(groups.keys()).sort((a, b) => a - b)
    this.gates = keys.map((k, i) => {
      const list = groups.get(k)!
      for (const n of list) n.gate = i
      return {
        t: k / QUANT,
        midis: Array.from(new Set(list.map((n) => n.m))).sort((a, b) => a - b),
        firstNote: list[0].idx,
      }
    })
  }

  // ------------------------------------------------------------ dieu khien

  private stopAllSound() {
    this.synth.allNotesOff()
    this.sounding.clear()
  }

  reset() {
    this.pause()
    this.seekBeat(this.loopStartBeat())
    this.stats = { hit: 0, miss: 0, wrong: 0 }
    this.finished = false
  }

  play() {
    if (!this.song || this.playing) return
    this.synth.ensure()
    if (this.finished) {
      this.reset()
    }
    this.playing = true
    this.waiting = false
    this.lastNow = performance.now()
    this.lastBeatTick = Math.floor(this.posBeat) - 1
    if (this.settings.countIn && this.timeline) {
      this.countInLeft = this.timeline.beatsPerMeasure
      this.countInTick = -1
    } else {
      this.countInLeft = 0
    }
  }

  pause() {
    this.playing = false
    this.waiting = false
    this.countInLeft = 0
    this.stopAllSound()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  seekBeat(beat: number) {
    if (!this.timeline) {
      this.posBeat = 0
      return
    }
    this.posBeat = Math.max(0, Math.min(this.timeline.totalBeats, beat))
    this.stopAllSound()
    this.satisfied.clear()
    this.waiting = false
    this.finished = false
    this.lastBeatTick = Math.floor(this.posBeat) - 1
    this.syncGateToPosition()
    // Not nam DUNG tai vi tri tua van con phai duoc phat khi chay tiep
    let i = 0
    while (i < this.notes.length && this.notes[i].t < this.posBeat - 1e-9) i++
    this.scanIdx = i
  }

  seekMeasure(measure1Based: number) {
    if (!this.timeline) return
    this.seekBeat(this.timeline.measureStart(measure1Based))
  }

  private syncGateToPosition() {
    let i = 0
    while (i < this.gates.length && this.gates[i].t < this.posBeat - 1e-6) i++
    this.gateIdx = i
    this.satisfied.clear()
  }

  private loopStartBeat(): number {
    const lp = this.settings.loop
    if (lp && this.timeline) return this.timeline.measureStart(lp[0])
    return 0
  }

  private loopEndBeat(): number {
    const lp = this.settings.loop
    if (lp && this.timeline) return this.timeline.measureEnd(lp[1])
    return this.timeline ? this.timeline.totalBeats : 0
  }

  // ---------------------------------------------------------------- vong lap

  tick(nowMs: number) {
    if (!this.playing || !this.timeline) {
      this.lastNow = nowMs
      return
    }
    const dtReal = Math.min(0.25, Math.max(0, (nowMs - this.lastNow) / 1000))
    this.lastNow = nowMs
    const dt = dtReal * this.settings.rate

    // Dem vao (count-in)
    if (this.countInLeft > 0) {
      const bpm = this.timeline.bpmAt(this.posBeat)
      const dBeats = (dt * bpm) / 60
      const tickNow = Math.ceil(this.countInLeft)
      if (tickNow !== this.countInTick) {
        this.countInTick = tickNow
        this.metro.click(Math.abs(this.countInLeft - this.timeline.beatsPerMeasure) < 1e-6)
      }
      this.countInLeft -= dBeats
      if (this.countInLeft <= 0) {
        this.countInLeft = 0
        this.lastNow = nowMs
      }
      return
    }

    const posSec = this.timeline.beatToSec(this.posBeat)
    let newBeat = this.timeline.secToBeat(posSec + dt)

    // Che do cho: dung lai ngay truoc cong ke tiep
    let clampedByGate = false
    if (this.settings.mode === 'wait' && this.gateIdx < this.gates.length) {
      const g = this.gates[this.gateIdx]
      if (newBeat >= g.t - 1e-9) {
        newBeat = g.t
        clampedByGate = true
      }
    }
    this.waiting = clampedByGate

    const loopEnd = this.loopEndBeat()
    let reachedEnd = false
    if (newBeat >= loopEnd - 1e-9) {
      newBeat = loopEnd
      reachedEnd = true
    }

    this.advanceTo(newBeat)

    // Cong co the da du not (be duoc phep bam som truoc khi den noi)
    if (this.waiting) this.tryClearGate()

    if (reachedEnd && !this.waiting) {
      if (this.settings.loop) {
        this.seekBeat(this.loopStartBeat())
        return
      }
      this.playing = false
      this.finished = true
      this.stopAllSound()
      this.events.onFinish?.()
    }
  }

  /** Cho chay tiep tu posBeat -> newBeat: phat tieng, go nhip, cham diem che do "theo nhip". */
  private advanceTo(newBeat: number) {
    if (!this.timeline) return
    const from = this.posBeat
    const to = Math.max(from, newBeat)

    if (to > from) {
      // Go nhip
      if (this.settings.metronome) {
        const startTick = Math.floor(from)
        const endTick = Math.floor(to)
        for (let b = Math.max(startTick, this.lastBeatTick + 1); b <= endTick; b++) {
          if (b < from - 1e-9) continue
          this.lastBeatTick = b
          const ms = this.timeline.measureStart(this.timeline.measureAt(b))
          this.metro.click(Math.abs(b - ms) < 1e-6)
        }
      } else {
        this.lastBeatTick = Math.floor(to)
      }

      // Phat tieng cac not app tu danh
      const autoPlayRequired = this.settings.mode === 'follow' && this.settings.guideSound
      while (this.scanIdx < this.notes.length && this.notes[this.scanIdx].t <= to + 1e-9) {
        const n = this.notes[this.scanIdx]
        this.scanIdx++
        if (n.required && !autoPlayRequired) continue
        this.synth.noteOn(n.m, n.h === 'L' ? 0.55 : 0.75)
        const end = n.t + n.d
        const prev = this.sounding.get(n.m)
        this.sounding.set(n.m, prev === undefined ? end : Math.max(prev, end))
      }

      // Tat tieng cac not da het truong do
      for (const [midi, end] of Array.from(this.sounding)) {
        if (end <= to + 1e-9) {
          if (!this.pressed.has(midi)) this.synth.noteOff(midi)
          this.sounding.delete(midi)
        }
      }
    }

    this.posBeat = to

    // Cham diem che do "theo nhip"
    if (this.settings.mode === 'follow') {
      const nowSec = this.timeline.beatToSec(this.posBeat)
      while (this.gateIdx < this.gates.length) {
        const g = this.gates[this.gateIdx]
        if (this.timeline.beatToSec(g.t) + FOLLOW_WINDOW_SEC > nowSec) break
        const ok = g.midis.every((m) => this.satisfied.has(m))
        if (ok) this.stats.hit++
        else this.stats.miss++
        this.gateIdx++
        this.satisfied.clear()
      }
    }
  }

  private tryClearGate(): boolean {
    if (this.gateIdx >= this.gates.length) return false
    const g = this.gates[this.gateIdx]
    if (!g.midis.every((m) => this.satisfied.has(m))) return false
    this.stats.hit++
    this.events.onGateCleared?.(this.gateIdx)
    this.gateIdx++
    this.satisfied.clear()
    this.waiting = false
    return true
  }

  // ------------------------------------------------------------------ nhap

  pressKey(midi: number, velocity = 0.8) {
    if (this.pressed.has(midi)) return
    this.pressed.add(midi)
    this.synth.ensure()
    this.synth.noteOn(midi, velocity)

    const mode: PlayMode = this.settings.mode
    if (mode === 'listen' || this.gateIdx >= this.gates.length) return

    const g = this.gates[this.gateIdx]
    if (mode === 'wait') {
      const inRange = this.waiting || this.posBeat >= g.t - WAIT_LEAD_BEATS
      if (!inRange) return
      if (g.midis.includes(midi)) {
        this.satisfied.add(midi)
        this.setFlash(midi, 'hit')
        this.events.onFeedback?.(midi, 'hit')
        if (this.waiting) this.tryClearGate()
      } else if (this.waiting) {
        this.stats.wrong++
        this.setFlash(midi, 'wrong')
        this.events.onFeedback?.(midi, 'wrong')
      }
      return
    }

    if (mode === 'follow' && this.timeline) {
      const nowSec = this.timeline.beatToSec(this.posBeat)
      const gSec = this.timeline.beatToSec(g.t)
      if (Math.abs(gSec - nowSec) <= FOLLOW_WINDOW_SEC && g.midis.includes(midi)) {
        this.satisfied.add(midi)
        this.setFlash(midi, 'hit')
        this.events.onFeedback?.(midi, 'hit')
      } else {
        this.stats.wrong++
        this.setFlash(midi, 'wrong')
        this.events.onFeedback?.(midi, 'wrong')
      }
    }
  }

  releaseKey(midi: number) {
    if (!this.pressed.delete(midi)) return
    if (!this.sounding.has(midi)) this.synth.noteOff(midi)
  }

  releaseAll() {
    for (const m of Array.from(this.pressed)) this.releaseKey(m)
  }

  private setFlash(midi: number, kind: 'hit' | 'wrong') {
    this.flash.set(midi, { kind, until: performance.now() + (kind === 'wrong' ? 500 : 260) })
  }

  // ------------------------------------------------------------- cho hien thi

  /** Cac not be dang can bam (de to sang phim). */
  hintMidis(): number[] {
    if (this.settings.mode === 'listen' || this.gateIdx >= this.gates.length) return []
    return this.gates[this.gateIdx].midis
  }

  progress(): number {
    if (!this.timeline || this.timeline.totalBeats <= 0) return 0
    return Math.max(0, Math.min(1, this.posBeat / this.timeline.totalBeats))
  }

  accuracy(): number | null {
    const total = this.stats.hit + this.stats.miss
    if (total === 0) return null
    return this.stats.hit / total
  }

  currentMeasure(): number {
    return this.timeline ? this.timeline.measureAt(this.posBeat) : 1
  }
}

/** Doi qua lai giua PHACH (quarter note) va GIAY, co ho tro doi tempo giua bai. */

import type { Song } from '../types'

interface TempoPoint {
  beat: number
  sec: number
  bpm: number
}

export class Timeline {
  readonly points: TempoPoint[]
  readonly beatsPerMeasure: number
  /** measures[i] = phach bat dau cua o nhip thu (i+1) */
  readonly measures: number[]
  readonly totalBeats: number

  constructor(song: Song) {
    const [num, den] = song.timeSignature ?? [4, 4]
    this.beatsPerMeasure = (num * 4) / den

    const raw = (song.tempos ?? []).filter((e) => e.bpm > 0).sort((a, b) => a.t - b.t)
    const pts: TempoPoint[] = []
    const firstBpm = raw.length && raw[0].t <= 0 ? raw[0].bpm : song.bpm || 100
    pts.push({ beat: 0, sec: 0, bpm: firstBpm })
    for (const e of raw) {
      if (e.t <= 0) continue
      const prev = pts[pts.length - 1]
      pts.push({ beat: e.t, sec: prev.sec + ((e.t - prev.beat) * 60) / prev.bpm, bpm: e.bpm })
    }
    this.points = pts

    const lastNote = song.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)

    if (song.measures && song.measures.length > 0) {
      this.measures = song.measures.slice().sort((a, b) => a - b)
    } else {
      const m: number[] = [0]
      let b = this.beatsPerMeasure
      while (b < lastNote - 1e-6) {
        m.push(b)
        b += this.beatsPerMeasure
      }
      m.push(Math.max(b, lastNote))
      this.measures = m
    }
    // Bao dam luon co vach nhip phu het bai
    while (this.measures[this.measures.length - 1] < lastNote) {
      this.measures.push(this.measures[this.measures.length - 1] + this.beatsPerMeasure)
    }

    this.totalBeats = Math.max(lastNote, this.measures[this.measures.length - 1])
  }

  /** `measures` chua ca vach nhip cuoi cung, nen so o nhip la length - 1. */
  get measureCount(): number {
    return Math.max(1, this.measures.length - 1)
  }

  beatToSec(beat: number): number {
    const pts = this.points
    let i = 0
    while (i + 1 < pts.length && pts[i + 1].beat <= beat) i++
    const p = pts[i]
    return p.sec + ((beat - p.beat) * 60) / p.bpm
  }

  secToBeat(sec: number): number {
    const pts = this.points
    let i = 0
    while (i + 1 < pts.length && pts[i + 1].sec <= sec) i++
    const p = pts[i]
    return p.beat + ((sec - p.sec) * p.bpm) / 60
  }

  bpmAt(beat: number): number {
    const pts = this.points
    let i = 0
    while (i + 1 < pts.length && pts[i + 1].beat <= beat) i++
    return pts[i].bpm
  }

  /** So thu tu o nhip (bat dau tu 1) chua phach nay. */
  measureAt(beat: number): number {
    const m = this.measures
    let lo = 0
    let hi = m.length - 1
    let ans = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (m[mid] <= beat + 1e-6) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return Math.min(ans + 1, this.measureCount)
  }

  /** Phach bat dau cua o nhip thu `index` (1-based). */
  measureStart(index: number): number {
    const i = Math.max(0, Math.min(this.measures.length - 1, index - 1))
    return this.measures[i]
  }

  /** Phach ket thuc cua o nhip thu `index` (1-based). */
  measureEnd(index: number): number {
    const i = Math.max(0, Math.min(this.measures.length - 1, index))
    return this.measures[i]
  }

  /** Danh sach cac phach chinh (dung ve luoi + go nhip). */
  beatGrid(fromBeat: number, toBeat: number): { beat: number; strong: boolean }[] {
    const out: { beat: number; strong: boolean }[] = []
    for (let mi = 0; mi < this.measures.length - 1; mi++) {
      const start = this.measures[mi]
      const end = this.measures[mi + 1]
      if (end < fromBeat - 1) continue
      for (let b = start; b < end - 1e-6; b += 1) {
        if (b > toBeat) return out
        if (b >= fromBeat - 1) out.push({ beat: b, strong: Math.abs(b - start) < 1e-6 })
      }
    }
    return out
  }
}

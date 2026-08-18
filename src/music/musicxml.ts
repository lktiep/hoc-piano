/**
 * Doc MusicXML (dinh dang MuseScore Studio xuat ra: Tep > Xuat > MusicXML).
 *
 * Ho tro: nhieu be / nhieu khuong, hop am, dau noi (tie), lay da (pickup), doi tempo,
 * doi so chi nhip, so ngon tay, dau nhac lai + khung 1 / khung 2.
 * Chua ho tro: D.C. / D.S. / Coda, dau luyen lay (grace note) -> bo qua.
 */

import type { Hand, Song, SongNote, TempoEvent } from '../types'
import { attrNum, child, childNum, childText, children, elements, findFirst, text, type XEl } from './xmlutil'

const STEP_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

interface RawNote {
  /** vi tri trong o nhip, don vi phach den */
  off: number
  dur: number
  midi: number
  staff: number
  voice: string
  finger?: number
  /** khoa dung de noi cac not bi buoc tie */
  tieKey: string
  tieStart: boolean
  tieStop: boolean
}

interface PMeasure {
  lengthBeats: number
  notes: RawNote[]
  tempos: { off: number; bpm: number }[]
  timeSig?: [number, number]
  repeatStart?: boolean
  repeatEnd?: boolean
  repeatTimes?: number
  endingStart?: number[]
  endingStop?: boolean
}

export interface MusicXmlOptions {
  /** Mo rong dau nhac lai thanh chuoi o nhip thuc te (mac dinh: co) */
  expandRepeats?: boolean
  id?: string
  title?: string
  source?: string
}

export interface ParseWarning {
  message: string
}

export interface ParseResult {
  song: Song
  warnings: ParseWarning[]
}

// ------------------------------------------------------------------ 1 be nhac

function parsePart(part: XEl, warnings: ParseWarning[]): PMeasure[] {
  const out: PMeasure[] = []
  let divisions = 1
  let curTimeSig: [number, number] | undefined

  for (const measure of children(part, 'measure')) {
    const pm: PMeasure = { lengthBeats: 0, notes: [], tempos: [] }
    let cursor = 0 // phach, tinh tu dau o nhip
    let maxCursor = 0
    let lastStart = 0

    for (const el of elements(measure)) {
      switch (el.nodeName) {
        case 'attributes': {
          const d = childNum(el, 'divisions', 0)
          if (d > 0) divisions = d
          const time = child(el, 'time')
          if (time) {
            const num = childNum(time, 'beats', 4)
            const den = childNum(time, 'beat-type', 4)
            curTimeSig = [num, den]
            pm.timeSig = curTimeSig
          }
          break
        }

        case 'direction': {
          const sound = child(el, 'sound')
          const tempoAttr = sound ? attrNum(sound, 'tempo', NaN) : NaN
          if (Number.isFinite(tempoAttr) && tempoAttr > 0) {
            pm.tempos.push({ off: cursor, bpm: tempoAttr })
            break
          }
          const metro = findFirst(el, 'metronome')
          if (metro) {
            const perMin = parseFloat(childText(metro, 'per-minute'))
            const unit = childText(metro, 'beat-unit')
            const dotted = children(metro, 'beat-unit-dot').length > 0
            if (Number.isFinite(perMin) && perMin > 0) {
              const unitBeats = beatUnitToQuarters(unit) * (dotted ? 1.5 : 1)
              pm.tempos.push({ off: cursor, bpm: perMin * unitBeats })
            }
          }
          break
        }

        case 'backup': {
          cursor -= childNum(el, 'duration', 0) / divisions
          if (cursor < 0) cursor = 0
          break
        }

        case 'forward': {
          cursor += childNum(el, 'duration', 0) / divisions
          maxCursor = Math.max(maxCursor, cursor)
          break
        }

        case 'barline': {
          const repeat = child(el, 'repeat')
          if (repeat) {
            const dir = repeat.getAttribute('direction')
            if (dir === 'forward') pm.repeatStart = true
            else if (dir === 'backward') {
              pm.repeatEnd = true
              pm.repeatTimes = Math.max(2, attrNum(repeat, 'times', 2))
            }
          }
          const ending = child(el, 'ending')
          if (ending) {
            const type = ending.getAttribute('type')
            const nums = (ending.getAttribute('number') ?? '')
              .split(/[,\s]+/)
              .map((s) => parseInt(s, 10))
              .filter((n) => Number.isFinite(n))
            if (type === 'start') pm.endingStart = nums.length ? nums : [1]
            else pm.endingStop = true
          }
          break
        }

        case 'note': {
          if (child(el, 'grace')) break // bo qua not luyen lay
          const durDivs = childNum(el, 'duration', 0)
          const dur = durDivs / divisions
          const isChord = !!child(el, 'chord')
          const start = isChord ? lastStart : cursor

          if (child(el, 'rest')) {
            if (!isChord) {
              cursor += dur
              maxCursor = Math.max(maxCursor, cursor)
            }
            break
          }

          const pitch = child(el, 'pitch')
          if (!pitch) {
            if (!isChord) {
              cursor += dur
              maxCursor = Math.max(maxCursor, cursor)
            }
            break
          }

          const step = childText(pitch, 'step').toUpperCase()
          const alter = childNum(pitch, 'alter', 0)
          const octave = childNum(pitch, 'octave', 4)
          const semitone = STEP_SEMITONE[step]
          if (semitone === undefined) {
            warnings.push({ message: `Khong hieu cao do "${step}"` })
            if (!isChord) {
              cursor += dur
              maxCursor = Math.max(maxCursor, cursor)
            }
            break
          }
          const midi = (octave + 1) * 12 + semitone + alter

          const staff = childNum(el, 'staff', 1)
          const voice = childText(el, 'voice') || '1'
          const fingerText = text(findFirst(el, 'fingering'))
          const finger = /^[1-5]$/.test(fingerText) ? parseInt(fingerText, 10) : undefined

          let tieStart = false
          let tieStop = false
          for (const t of children(el, 'tie')) {
            const ty = t.getAttribute('type')
            if (ty === 'start') tieStart = true
            if (ty === 'stop') tieStop = true
          }
          const notations = child(el, 'notations')
          if (notations) {
            for (const t of children(notations, 'tied')) {
              const ty = t.getAttribute('type')
              if (ty === 'start') tieStart = true
              if (ty === 'stop') tieStop = true
            }
          }

          pm.notes.push({
            off: start,
            dur,
            midi,
            staff,
            voice,
            finger,
            tieKey: `${voice}:${staff}:${midi}`,
            tieStart,
            tieStop,
          })

          if (!isChord) {
            lastStart = cursor
            cursor += dur
            maxCursor = Math.max(maxCursor, cursor)
          }
          break
        }

        default:
          break
      }
    }

    pm.lengthBeats = maxCursor > 0 ? maxCursor : curTimeSig ? (curTimeSig[0] * 4) / curTimeSig[1] : 4
    out.push(pm)
  }

  return out
}

function beatUnitToQuarters(unit: string): number {
  switch (unit) {
    case 'whole':
      return 4
    case 'half':
      return 2
    case 'quarter':
      return 1
    case 'eighth':
      return 0.5
    case '16th':
      return 0.25
    case '32nd':
      return 0.125
    default:
      return 1
  }
}

// ------------------------------------------------------- mo rong dau nhac lai

function playOrder(ms: PMeasure[]): number[] {
  const order: number[] = []
  const passes = new Map<number, number>()
  let repeatStart = 0
  let i = 0
  const guard = ms.length * 8 + 64

  for (let step = 0; step < guard && i < ms.length; step++) {
    const m = ms[i]
    if (m.repeatStart) repeatStart = i

    if (m.endingStart && m.endingStart.length) {
      const currentPass = (passes.get(repeatStart) ?? 0) + 1
      if (!m.endingStart.includes(currentPass)) {
        // Bo qua ca khung nay
        let j = i
        while (j < ms.length && !ms[j].endingStop) j++
        i = j + 1
        continue
      }
    }

    order.push(i)

    if (m.repeatEnd) {
      const times = m.repeatTimes ?? 2
      const taken = (passes.get(repeatStart) ?? 0) + 1
      passes.set(repeatStart, taken)
      if (taken < times) {
        i = repeatStart
        continue
      }
      repeatStart = i + 1
    }
    i++
  }

  return order.length ? order : ms.map((_, k) => k)
}

// --------------------------------------------------------------- ghep thanh bai

function assignHand(n: RawNote, staffCount: number, partIndex: number, partCount: number): Hand {
  if (staffCount >= 2) return n.staff >= 2 ? 'L' : 'R'
  if (partCount >= 2) return partIndex === 0 ? 'R' : 'L'
  return n.midi >= 60 ? 'R' : 'L'
}

export function buildSongFromParts(
  parts: { measures: PMeasure[]; staffCount: number }[],
  meta: { id: string; title: string; artist?: string; source?: string },
  opts: MusicXmlOptions,
  warnings: ParseWarning[],
): Song {
  const measureCount = Math.max(...parts.map((p) => p.measures.length), 0)
  if (measureCount === 0) throw new Error('Ban nhac khong co o nhip nao.')

  // Do dai o nhip lay theo be dai nhat
  const lengths: number[] = []
  for (let i = 0; i < measureCount; i++) {
    let len = 0
    for (const p of parts) {
      const m = p.measures[i]
      if (m) len = Math.max(len, m.lengthBeats)
    }
    lengths.push(len || 4)
  }

  const structural = parts[0].measures
  const order = opts.expandRepeats === false ? structural.map((_, k) => k) : playOrder(structural)

  const notes: SongNote[] = []
  const tempos: TempoEvent[] = []
  const measureStarts: number[] = []
  /** not dang mo do bi buoc tie: key -> chi so trong `notes` */
  const openTies = new Map<string, number>()

  let firstTimeSig: [number, number] | undefined
  let cursor = 0

  for (const mi of order) {
    measureStarts.push(cursor)
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi]
      const m = part.measures[mi]
      if (!m) continue
      if (m.timeSig && !firstTimeSig) firstTimeSig = m.timeSig
      for (const tp of m.tempos) tempos.push({ t: cursor + tp.off, bpm: tp.bpm })

      for (const rn of m.notes.slice().sort((a, b) => a.off - b.off)) {
        const key = `${pi}:${rn.tieKey}`
        const t = cursor + rn.off
        if (rn.tieStop && openTies.has(key)) {
          const idx = openTies.get(key)!
          notes[idx].d = Math.max(notes[idx].d, t + rn.dur - notes[idx].t)
          if (!rn.tieStart) openTies.delete(key)
          continue
        }
        const note: SongNote = {
          t: round6(t),
          d: round6(rn.dur),
          m: rn.midi,
          h: assignHand(rn, part.staffCount, pi, parts.length),
        }
        if (rn.finger) note.f = rn.finger
        notes.push(note)
        if (rn.tieStart) openTies.set(key, notes.length - 1)
        else openTies.delete(key)
      }
    }
    cursor += lengths[mi]
  }
  measureStarts.push(cursor)

  notes.sort((a, b) => a.t - b.t || a.m - b.m)
  for (const n of notes) n.d = round6(n.d)

  tempos.sort((a, b) => a.t - b.t)
  const dedupTempos: TempoEvent[] = []
  for (const tp of tempos) {
    const last = dedupTempos[dedupTempos.length - 1]
    if (last && Math.abs(last.t - tp.t) < 1e-6) {
      last.bpm = tp.bpm
      continue
    }
    if (last && Math.abs(last.bpm - tp.bpm) < 1e-6) continue
    dedupTempos.push({ t: round6(tp.t), bpm: Math.round(tp.bpm * 100) / 100 })
  }

  const baseBpm = dedupTempos.length && dedupTempos[0].t <= 1e-6 ? dedupTempos[0].bpm : (dedupTempos[0]?.bpm ?? 100)

  if (notes.length === 0) warnings.push({ message: 'Khong doc duoc not nhac nao trong tep.' })

  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    source: meta.source,
    bpm: Math.round(baseBpm * 100) / 100,
    timeSignature: firstTimeSig ?? [4, 4],
    tempos: dedupTempos.length > 1 ? dedupTempos : undefined,
    measures: measureStarts.map(round6),
    notes,
  }
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

/** Diem vao chinh: nhan mot Document MusicXML da parse san. */
export function parseMusicXml(doc: XEl, opts: MusicXmlOptions = {}): ParseResult {
  const warnings: ParseWarning[] = []
  const root = findFirst(doc, 'score-partwise')
  if (!root) {
    if (findFirst(doc, 'score-timewise')) {
      throw new Error('Tep dung dinh dang score-timewise. Hay xuat lai dang score-partwise tu MuseScore.')
    }
    throw new Error('Khong phai tep MusicXML hop le.')
  }

  const workTitle = text(findFirst(root, 'work-title'))
  const movementTitle = text(findFirst(root, 'movement-title'))
  let creator = ''
  const identification = findFirst(root, 'identification')
  if (identification) {
    for (const c of children(identification, 'creator')) {
      const type = c.getAttribute('type')
      if (type === 'composer' || type === 'arranger' || !creator) creator = text(c)
      if (type === 'composer') break
    }
  }

  const parsedParts: { measures: PMeasure[]; staffCount: number }[] = []
  for (const part of children(root, 'part')) {
    const measures = parsePart(part, warnings)
    let staffCount = 1
    for (const m of measures) {
      for (const n of m.notes) staffCount = Math.max(staffCount, n.staff)
    }
    const attrStaves = findFirst(part, 'staves')
    if (attrStaves) staffCount = Math.max(staffCount, parseInt(text(attrStaves), 10) || 1)
    parsedParts.push({ measures, staffCount })
  }

  if (parsedParts.length === 0) throw new Error('Tep khong co be nhac nao.')

  const title = opts.title || movementTitle || workTitle || 'Bai khong ten'
  const id = opts.id || slugify(title)

  const song = buildSongFromParts(parsedParts, { id, title, artist: creator || undefined, source: opts.source }, opts, warnings)
  return { song, warnings }
}

export function slugify(s: string): string {
  const out = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return out || 'bai-hat'
}

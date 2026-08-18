/** Doc tep MIDI chuan (.mid / .midi) - MuseScore xuat duoc bang Tep > Xuat > MIDI. */

import type { Hand, Song, SongNote, TempoEvent } from '../types'
import { slugify } from './musicxml'

interface MidiNote {
  tick: number
  durTicks: number
  midi: number
  velocity: number
}

interface MidiTrack {
  name: string
  notes: MidiNote[]
}

interface ParsedMidi {
  ppq: number
  name?: string
  tempos: { tick: number; bpm: number }[]
  timeSignatures: { tick: number; num: number; den: number }[]
  tracks: MidiTrack[]
}

class Reader {
  pos = 0
  constructor(private view: DataView) {}
  get length() {
    return this.view.byteLength
  }
  u8() {
    return this.view.getUint8(this.pos++)
  }
  u16() {
    const v = this.view.getUint16(this.pos)
    this.pos += 2
    return v
  }
  u32() {
    const v = this.view.getUint32(this.pos)
    this.pos += 4
    return v
  }
  str(n: number) {
    let s = ''
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.view.getUint8(this.pos + i))
    this.pos += n
    return s
  }
  bytes(n: number) {
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) out[i] = this.view.getUint8(this.pos + i)
    this.pos += n
    return out
  }
  /** so nguyen do dai bien thien */
  vlq() {
    let v = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      v = (v << 7) | (b & 0x7f)
      if ((b & 0x80) === 0) break
    }
    return v
  }
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim()
  } catch {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return s.trim()
  }
}

export function parseMidiFile(buffer: ArrayBuffer): ParsedMidi {
  const r = new Reader(new DataView(buffer))
  if (r.str(4) !== 'MThd') throw new Error('Khong phai tep MIDI (thieu MThd).')
  const headerLen = r.u32()
  r.u16() // format
  const ntrks = r.u16()
  const division = r.u16()
  r.pos = 8 + headerLen

  if (division & 0x8000) throw new Error('Tep MIDI dung ma thoi gian SMPTE - chua ho tro. Hay xuat lai dang MusicXML.')
  const ppq = division || 480

  const out: ParsedMidi = { ppq, tempos: [], timeSignatures: [], tracks: [] }

  for (let t = 0; t < ntrks && r.pos + 8 <= r.length; t++) {
    const id = r.str(4)
    const len = r.u32()
    const end = r.pos + len
    if (id !== 'MTrk') {
      r.pos = end
      continue
    }

    const track: MidiTrack = { name: '', notes: [] }
    const open = new Map<number, { tick: number; velocity: number }[]>()
    let tick = 0
    let status = 0

    while (r.pos < end) {
      tick += r.vlq()
      let b = r.u8()
      if (b < 0x80) {
        // running status
        r.pos--
        b = status
      } else if (b < 0xf0) {
        status = b
      }

      if (b === 0xff) {
        const type = r.u8()
        const len2 = r.vlq()
        const data = r.bytes(len2)
        if (type === 0x51 && len2 === 3) {
          const usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2]
          if (usPerQuarter > 0) out.tempos.push({ tick, bpm: 60000000 / usPerQuarter })
        } else if (type === 0x58 && len2 >= 2) {
          out.timeSignatures.push({ tick, num: data[0], den: Math.pow(2, data[1]) })
        } else if (type === 0x03) {
          const n = decodeText(data)
          if (!track.name) track.name = n
          if (!out.name && t === 0) out.name = n
        }
        continue
      }

      if (b === 0xf0 || b === 0xf7) {
        const len2 = r.vlq()
        r.pos += len2
        continue
      }

      const kind = b & 0xf0
      if (kind === 0x90 || kind === 0x80) {
        const midi = r.u8()
        const vel = r.u8()
        if (kind === 0x90 && vel > 0) {
          const list = open.get(midi)
          if (list) list.push({ tick, velocity: vel })
          else open.set(midi, [{ tick, velocity: vel }])
        } else {
          const list = open.get(midi)
          if (list && list.length) {
            const on = list.shift()!
            track.notes.push({ tick: on.tick, durTicks: Math.max(1, tick - on.tick), midi, velocity: on.velocity })
            if (list.length === 0) open.delete(midi)
          }
        }
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
        r.pos += 2
      } else if (kind === 0xc0 || kind === 0xd0) {
        r.pos += 1
      } else {
        // Khong nhan ra -> nhay den cuoi track cho an toan
        r.pos = end
      }
    }

    // Not con treo -> dong o cuoi track
    for (const [midi, list] of open) {
      for (const on of list) track.notes.push({ tick: on.tick, durTicks: ppq, midi, velocity: on.velocity })
    }

    track.notes.sort((a, b2) => a.tick - b2.tick || a.midi - b2.midi)
    r.pos = end
    if (track.notes.length) out.tracks.push(track)
  }

  out.tempos.sort((a, b) => a.tick - b.tick)
  out.timeSignatures.sort((a, b) => a.tick - b.tick)
  return out
}

function handOfTrackName(name: string): Hand | null {
  const n = name.toLowerCase()
  if (/\b(left|lh|bass|tay trai|trai)\b/.test(n)) return 'L'
  if (/\b(right|rh|treble|melody|tay phai|phai)\b/.test(n)) return 'R'
  return null
}

export interface MidiImportOptions {
  id?: string
  title?: string
  source?: string
  /** cao do phan chia 2 tay khi ban nhac chi co 1 be (mac dinh 60 = Do giua) */
  splitPoint?: number
}

export function midiToSong(parsed: ParsedMidi, opts: MidiImportOptions = {}): { song: Song; warnings: { message: string }[] } {
  const warnings: { message: string }[] = []
  const { ppq } = parsed
  const toBeats = (tick: number) => Math.round((tick / ppq) * 1e6) / 1e6

  const split = opts.splitPoint ?? 60
  const tracks = parsed.tracks

  // Xac dinh tay cho tung track
  const trackHands: (Hand | null)[] = tracks.map((t) => handOfTrackName(t.name))
  const namedHands = trackHands.filter(Boolean).length
  if (tracks.length === 2 && namedHands === 0) {
    const avg = tracks.map((t) => t.notes.reduce((s, n) => s + n.midi, 0) / Math.max(1, t.notes.length))
    trackHands[0] = avg[0] >= avg[1] ? 'R' : 'L'
    trackHands[1] = avg[0] >= avg[1] ? 'L' : 'R'
  }

  const notes: SongNote[] = []
  for (let i = 0; i < tracks.length; i++) {
    for (const n of tracks[i].notes) {
      const h: Hand = trackHands[i] ?? (n.midi >= split ? 'R' : 'L')
      notes.push({ t: toBeats(n.tick), d: Math.max(0.05, toBeats(n.durTicks)), m: n.midi, h })
    }
  }
  notes.sort((a, b) => a.t - b.t || a.m - b.m)
  if (notes.length === 0) warnings.push({ message: 'Tep MIDI khong co not nhac nao.' })

  const tempos: TempoEvent[] = parsed.tempos.map((t) => ({ t: toBeats(t.tick), bpm: Math.round(t.bpm * 100) / 100 }))
  const bpm = tempos.length ? tempos[0].bpm : 100

  const ts = parsed.timeSignatures[0]
  const timeSignature: [number, number] = ts ? [ts.num, ts.den] : [4, 4]
  if (parsed.timeSignatures.length > 1) warnings.push({ message: 'Bai co doi so chi nhip - app chi dung so chi nhip dau tien de ke vach nhip.' })

  // Vach nhip: tinh deu theo so chi nhip dau tien
  const beatsPerMeasure = (timeSignature[0] * 4) / timeSignature[1]
  const lastBeat = notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)
  const measures: number[] = [0]
  for (let b = beatsPerMeasure; b < lastBeat - 1e-6; b += beatsPerMeasure) measures.push(Math.round(b * 1e6) / 1e6)
  const lastBar = measures[measures.length - 1] + beatsPerMeasure
  measures.push(Math.round(Math.max(lastBar, lastBeat) * 1e6) / 1e6)

  const title = opts.title || parsed.name || 'Bai khong ten'
  return {
    song: {
      id: opts.id || slugify(title),
      title,
      source: opts.source,
      bpm,
      timeSignature,
      tempos: tempos.length > 1 ? tempos : undefined,
      measures,
      notes,
    },
    warnings,
  }
}

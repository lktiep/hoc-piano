/** Tien ich ve cao do / ten not. */

import type { LabelStyle } from '../types'

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
/** Do Re Mi kieu Viet Nam */
export const SOLFEGE = ['Đô', 'Đô#', 'Rê', 'Rê#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'] as const

const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]

export const MIN_MIDI = 21 // A0
export const MAX_MIDI = 108 // C8

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export function isBlackKey(midi: number): boolean {
  return IS_BLACK[pitchClass(midi)]
}

export function noteName(midi: number): string {
  return SHARP_NAMES[pitchClass(midi)] + octaveOf(midi)
}

/** Nhan hien thi tren phim dan. */
export function keyLabel(midi: number, style: LabelStyle): string {
  if (style === 'off') return ''
  if (style === 'solfege') return SOLFEGE[pitchClass(midi)]
  return SHARP_NAMES[pitchClass(midi)]
}

/** Ten not tieng Viet day du, vi du "Đô4". */
export function fullVietnameseName(midi: number): string {
  return `${SOLFEGE[pitchClass(midi)]}${octaveOf(midi)}`
}

/** Dem so phim trang co cao do NHO HON midi, tinh tu A0. */
export function whiteKeysBelow(midi: number): number {
  let n = 0
  for (let m = MIN_MIDI; m < midi; m++) if (!isBlackKey(m)) n++
  return n
}

/** Dem so phim trang trong khoang [from, to] (bao gom 2 dau). */
export function countWhiteKeys(from: number, to: number): number {
  let n = 0
  for (let m = from; m <= to; m++) if (!isBlackKey(m)) n++
  return n
}

/** Lui ve phim trang gan nhat <= midi */
export function snapDownToWhite(midi: number): number {
  let m = midi
  while (m > MIN_MIDI && isBlackKey(m)) m--
  return m
}

/** Tien len phim trang gan nhat >= midi */
export function snapUpToWhite(midi: number): number {
  let m = midi
  while (m < MAX_MIDI && isBlackKey(m)) m++
  return m
}

/**
 * Mo rong khoang cao do cho tron quang tam (Do -> Si) de ban phim nhin can doi.
 * Luon dam bao it nhat 1 quang tam.
 */
export function padToOctaves(lo: number, hi: number): [number, number] {
  let from = lo - pitchClass(lo)
  let to = hi + (11 - pitchClass(hi))
  if (to - from < 11) to = from + 11
  from = Math.max(MIN_MIDI, from)
  to = Math.min(MAX_MIDI, to)
  return [snapDownToWhite(from), snapUpToWhite(to)]
}

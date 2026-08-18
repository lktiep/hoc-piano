/**
 * Ban phim may tinh dong vai dan: 2 hang phim = 2 quang tam.
 * Hang duoi (z x c v b n m ,) = quang tam thap, hang tren (q w e r t y u i) = quang tam cao.
 */

/** offset nua cung so voi Do cua quang tam duoi */
const LOWER: Record<string, number> = {
  KeyZ: 0, // Do
  KeyS: 1,
  KeyX: 2, // Re
  KeyD: 3,
  KeyC: 4, // Mi
  KeyV: 5, // Fa
  KeyG: 6,
  KeyB: 7, // Sol
  KeyH: 8,
  KeyN: 9, // La
  KeyJ: 10,
  KeyM: 11, // Si
  Comma: 12,
}

const UPPER: Record<string, number> = {
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
}

const MAP: Record<string, number> = { ...LOWER, ...UPPER }

/**
 * @param code   e.code cua su kien ban phim
 * @param baseC  cao do MIDI cua not Do thap nhat tren ban phim may tinh
 */
export function codeToMidi(code: string, baseC: number): number | null {
  const off = MAP[code]
  if (off === undefined) return null
  return baseC + off
}

export function isMappedKey(code: string): boolean {
  return code in MAP
}

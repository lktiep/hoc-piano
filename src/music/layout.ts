/** Tinh hinh hoc ban phim - dung chung cho phim dan va man "not roi" de 2 ben khop nhau tuyet doi. */

import { isBlackKey } from './notes'

export interface KeyRect {
  midi: number
  black: boolean
  /** toa do x (px) tinh tu canh trai ban phim */
  x: number
  w: number
}

export interface KeyboardLayout {
  from: number
  to: number
  width: number
  whiteWidth: number
  blackWidth: number
  /** phim trang truoc, roi den phim den - dung thu tu nay de ve/xep chong */
  keys: KeyRect[]
  byMidi: Map<number, KeyRect>
}

export const BLACK_WIDTH_RATIO = 0.62
/** Chieu cao phim den so voi phim trang */
export const BLACK_HEIGHT_RATIO = 0.62

/**
 * @param from  cao do thap nhat (phai la phim trang)
 * @param to    cao do cao nhat (phai la phim trang)
 * @param width be ngang tong (px)
 */
export function buildLayout(from: number, to: number, width: number): KeyboardLayout {
  let whiteCount = 0
  for (let m = from; m <= to; m++) if (!isBlackKey(m)) whiteCount++
  if (whiteCount === 0) whiteCount = 1

  const whiteWidth = width / whiteCount
  const blackWidth = whiteWidth * BLACK_WIDTH_RATIO

  const white: KeyRect[] = []
  const black: KeyRect[] = []
  const byMidi = new Map<number, KeyRect>()

  let wi = 0
  for (let m = from; m <= to; m++) {
    if (isBlackKey(m)) {
      // Phim den nam giua ranh gioi cua 2 phim trang ke no
      const rect: KeyRect = { midi: m, black: true, x: wi * whiteWidth - blackWidth / 2, w: blackWidth }
      black.push(rect)
      byMidi.set(m, rect)
    } else {
      const rect: KeyRect = { midi: m, black: false, x: wi * whiteWidth, w: whiteWidth }
      white.push(rect)
      byMidi.set(m, rect)
      wi++
    }
  }

  return { from, to, width, whiteWidth, blackWidth, keys: [...white, ...black], byMidi }
}

/** Tim phim tai toa do x, y (y tinh tu dinh ban phim). Uu tien phim den vi no nam tren. */
export function keyAt(layout: KeyboardLayout, x: number, y: number, keyboardHeight: number): number | null {
  const blackH = keyboardHeight * BLACK_HEIGHT_RATIO
  if (y <= blackH) {
    for (const k of layout.keys) {
      if (k.black && x >= k.x && x < k.x + k.w) return k.midi
    }
  }
  for (const k of layout.keys) {
    if (!k.black && x >= k.x && x < k.x + k.w) return k.midi
  }
  return null
}

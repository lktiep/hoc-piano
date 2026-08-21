/**
 * Man hinh choi: not nhac roi xuong + ban phim dan, ve chung tren MOT canvas
 * de 2 phan khop nhau tuyet doi va chay muot 60fps.
 *
 * Mau va hinh khoi theo he Modernist cua ban thiet ke: goc vuong tuyet doi,
 * mot mau nhan duy nhat, tay trai ve mau trang. Rieng ban phim giu dung mau
 * that cua phim dan de be doi chieu voi cay dan o nha.
 *
 * O che do "ban nhac" (settings.view === 'sheet') khung nay chi con ban phim:
 * vong ve o day cung la thu goi player.tick(), nen no phai o lai ca hai che do.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Player } from '../engine/player'
import type { Settings } from '../types'
import { buildLayout, keyAt, BLACK_HEIGHT_RATIO, type KeyboardLayout } from '../music/layout'
import { isBlackKey, keyLabel, octaveOf, pitchClass } from '../music/notes'

const FONT = 'Archivo, ui-sans-serif, system-ui, sans-serif'

const C_BG = '#131211'
const C_WHITE = '#f6f4f3'
const C_WHITE_EDGE = 'rgba(11,10,9,0.5)'
const C_BLACK = '#0b0a09'
const C_BLACK_EDGE = '#000000'
/** Tay phai = mau nhan, tay trai = trang. Hai tay khong bao gio lan mau. */
const C_RIGHT = '#ec3013'
const C_RIGHT_LIGHT = '#ff5a3d'
const C_LEFT = '#b3aeab'
const C_LEFT_LIGHT = '#efedec'
const C_HINT = '#ec3013'
const C_PRESSED = '#ff7a5c'

export interface StageProps {
  player: Player
  settings: Settings
  range: [number, number]
  /** goi ~8 lan/giay de cap nhat thanh tien do, so o nhip... */
  onUiTick: () => void
}

export function Stage({ player, settings, range, onUiTick }: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const layoutRef = useRef<KeyboardLayout | null>(null)
  const kbTopRef = useRef(0)
  const kbHeightRef = useRef(0)
  const pointersRef = useRef(new Map<number, number>())
  const settingsRef = useRef(settings)
  const rangeRef = useRef(range)
  settingsRef.current = settings
  rangeRef.current = range

  const keysOnly = settings.view === 'sheet'

  // ------------------------------------------------------------- kich thuoc
  const resize = useCallback(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const rect = wrap.getBoundingClientRect()
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    const w = Math.max(320, Math.floor(rect.width))
    const h = Math.max(120, Math.floor(rect.height))
    sizeRef.current = { w, h, dpr }
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    // Che do ban nhac: ca khung la ban phim. Che do not roi: chua toi mot nua.
    const kbH = settingsRef.current.view === 'sheet' ? h : Math.round(Math.min(Math.max(h * 0.42, 160), 340))
    kbHeightRef.current = Math.min(h, kbH)
    kbTopRef.current = h - kbHeightRef.current
    layoutRef.current = buildLayout(rangeRef.current[0], rangeRef.current[1], w)
  }, [])

  useEffect(() => {
    resize()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    window.addEventListener('orientationchange', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
    }
  }, [resize])

  // Doi cach nhin thi chia lai khung ngay, khong doi ResizeObserver.
  useEffect(() => {
    resize()
  }, [resize, keysOnly])

  useEffect(() => {
    const { w } = sizeRef.current
    if (w > 0) layoutRef.current = buildLayout(range[0], range[1], w)
  }, [range])

  // ---------------------------------------------------------------- vong ve
  useEffect(() => {
    let raf = 0
    let lastUi = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      player.tick(now)
      draw(canvasRef.current, sizeRef.current, layoutRef.current, kbTopRef.current, kbHeightRef.current, player, settingsRef.current, now)
      if (now - lastUi > 120) {
        lastUi = now
        onUiTick()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [player, onUiTick])

  // ------------------------------------------------------------- cham/chuot
  const midiFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const layout = layoutRef.current
    const canvas = canvasRef.current
    if (!layout || !canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (y < kbTopRef.current) return null
    return keyAt(layout, x, y - kbTopRef.current, kbHeightRef.current)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const midi = midiFromEvent(e)
    if (midi == null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, midi)
    player.pressKey(midi, 0.85)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    const midi = midiFromEvent(e)
    const prev = pointersRef.current.get(e.pointerId)!
    if (midi == null || midi === prev) return
    player.releaseKey(prev)
    pointersRef.current.set(e.pointerId, midi)
    player.pressKey(midi, 0.85)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const midi = pointersRef.current.get(e.pointerId)
    if (midi == null) return
    pointersRef.current.delete(e.pointerId)
    player.releaseKey(midi)
  }

  return (
    <div className={`stage${keysOnly ? ' is-keys-only' : ''}`} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}

// ------------------------------------------------------------------- ve canvas

function draw(
  canvas: HTMLCanvasElement | null,
  size: { w: number; h: number; dpr: number },
  layout: KeyboardLayout | null,
  kbTop: number,
  kbHeight: number,
  player: Player,
  settings: Settings,
  now: number,
) {
  if (!canvas || !layout) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { w, h, dpr } = size

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // Khong con cho cho not roi (che do ban nhac): chi ve ban phim.
  if (kbTop > 4) {
    ctx.fillStyle = C_BG
    ctx.fillRect(0, 0, w, kbTop)

    const pos = player.posBeat
    const lookahead = Math.max(2, settings.lookaheadBeats)
    const pxPerBeat = kbTop / lookahead

    drawLanes(ctx, layout, kbTop)
    drawGrid(ctx, player, pos, lookahead, pxPerBeat, kbTop, w)
    drawNotes(ctx, player, settings, layout, pos, lookahead, pxPerBeat, kbTop)
    drawNowLine(ctx, w, kbTop, player)
  }

  drawKeyboard(ctx, layout, kbTop, kbHeight, player, settings, now)

  if (kbTop > 4) drawOverlay(ctx, w, kbTop, player)
}

/** Vien mo phan chia cac phim de mat de doi chieu not voi phim. */
function drawLanes(ctx: CanvasRenderingContext2D, layout: KeyboardLayout, kbTop: number) {
  ctx.save()
  ctx.lineWidth = 1
  for (const k of layout.keys) {
    if (k.black) continue
    ctx.strokeStyle = pitchClass(k.midi) === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(Math.round(k.x) + 0.5, 0)
    ctx.lineTo(Math.round(k.x) + 0.5, kbTop)
    ctx.stroke()
  }
  ctx.restore()
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  player: Player,
  pos: number,
  lookahead: number,
  pxPerBeat: number,
  kbTop: number,
  w: number,
) {
  const tl = player.timeline
  if (!tl) return
  ctx.save()
  ctx.font = `700 10px ${FONT}`
  ctx.textBaseline = 'bottom'
  for (const g of tl.beatGrid(pos - 1, pos + lookahead + 1)) {
    const y = kbTop - (g.beat - pos) * pxPerBeat
    if (y < -20 || y > kbTop) continue
    ctx.strokeStyle = g.strong ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(w, Math.round(y) + 0.5)
    ctx.stroke()
    if (g.strong) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)'
      ctx.fillText(String(tl.measureAt(g.beat)), 6, y - 4)
    }
  }
  ctx.restore()
}

function firstVisibleNote(player: Player, fromBeat: number): number {
  const notes = player.notes
  let lo = 0
  let hi = notes.length - 1
  let ans = notes.length
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (notes[mid].t >= fromBeat) {
      ans = mid
      hi = mid - 1
    } else lo = mid + 1
  }
  return ans
}

function drawNotes(
  ctx: CanvasRenderingContext2D,
  player: Player,
  settings: Settings,
  layout: KeyboardLayout,
  pos: number,
  lookahead: number,
  pxPerBeat: number,
  kbTop: number,
) {
  const notes = player.notes
  const start = firstVisibleNote(player, pos - 16)
  const maxBeat = pos + lookahead + 1
  const gateIdx = player.gateIdx

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, layout.width, kbTop)
  ctx.clip()

  for (let i = start; i < notes.length; i++) {
    const n = notes[i]
    if (n.t > maxBeat) break
    const rect = layout.byMidi.get(n.m)
    if (!rect) continue

    const bottom = kbTop - (n.t - pos) * pxPerBeat
    const height = Math.max(10, n.d * pxPerBeat - 3)
    const top = bottom - height
    if (bottom < -8 || top > kbTop) continue

    const isNext = n.gate >= 0 && n.gate === gateIdx
    const done = n.gate >= 0 && n.gate < gateIdx
    const black = isBlackKey(n.m)
    const pad = black ? 1.5 : 3
    const x = rect.x + pad
    const wNote = rect.w - pad * 2

    let base = n.h === 'R' ? C_RIGHT : C_LEFT
    let light = n.h === 'R' ? C_RIGHT_LIGHT : C_LEFT_LIGHT
    // Phan may tu danh: van thay duoc nhung mo han, de be khong bam nham.
    if (!n.required && settings.mode !== 'listen') {
      base = n.h === 'R' ? '#7a2415' : '#5c5956'
      light = n.h === 'R' ? '#9c3320' : '#787471'
    }
    if (done) ctx.globalAlpha = 0.3

    const grad = ctx.createLinearGradient(x, top, x, bottom)
    grad.addColorStop(0, light)
    grad.addColorStop(1, base)
    ctx.fillStyle = grad
    ctx.fillRect(x, top, wNote, height)

    // Not sap toi: vien trang day, nhay nhe khi bai dang dung cho be
    if (isNext) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = player.waiting ? 3 : 2
      ctx.globalAlpha = player.waiting ? 0.6 + 0.4 * Math.sin(performance.now() / 160) : 1
      ctx.strokeRect(x + 1, top + 1, wNote - 2, height - 2)
      ctx.globalAlpha = done ? 0.3 : 1
    }

    // So ngon tay — o vuong nho, dung phong chu cua ca trang
    if (settings.showFingers && n.f && height > 22 && wNote > 20) {
      const s = Math.min(20, wNote * 0.7)
      ctx.fillStyle = 'rgba(19,18,17,0.9)'
      ctx.fillRect(x + wNote / 2 - s / 2, bottom - s - 4, s, s)
      ctx.fillStyle = '#efedec'
      ctx.font = `700 ${Math.round(s * 0.62)}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(n.f), x + wNote / 2, bottom - s / 2 - 4)
    }

    // Ten not tren khoi not (khi du cho)
    if (settings.labels !== 'off' && height > 30 && wNote > 26) {
      ctx.fillStyle = n.h === 'R' ? 'rgba(255,255,255,0.92)' : 'rgba(19,18,17,0.86)'
      ctx.font = `700 ${Math.min(15, Math.round(wNote / 2.6))}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(keyLabel(n.m, settings.labels), x + wNote / 2, top + 5)
    }

    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()
}

function drawNowLine(ctx: CanvasRenderingContext2D, w: number, kbTop: number, player: Player) {
  ctx.save()
  ctx.strokeStyle = player.waiting ? C_HINT : 'rgba(255,255,255,0.8)'
  ctx.lineWidth = player.waiting ? 3 : 2
  ctx.beginPath()
  ctx.moveTo(0, kbTop - 1)
  ctx.lineTo(w, kbTop - 1)
  ctx.stroke()
  ctx.restore()
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  kbTop: number,
  kbHeight: number,
  player: Player,
  settings: Settings,
  now: number,
) {
  const hints = new Set(player.hintMidis())
  const blackH = kbHeight * BLACK_HEIGHT_RATIO

  // Xoa hieu ung nhay mau da het han
  for (const [midi, f] of player.flash) if (f.until < now) player.flash.delete(midi)

  ctx.save()
  ctx.translate(0, kbTop)

  // Nen ban phim
  ctx.fillStyle = C_BLACK
  ctx.fillRect(0, -4, layout.width, kbHeight + 4)

  const labelFontWhite = Math.max(11, Math.min(26, layout.whiteWidth * 0.46))
  const labelFontBlack = Math.max(9, Math.min(16, layout.blackWidth * 0.5))
  // Chu so quang tam nam duoi ten not, nen ten not phai lui len dung bang chieu cao cua no
  // — neu khong, phim to se bi cat mat chu so o mep duoi.
  const octaveFont = Math.max(9, labelFontWhite * 0.55)
  const showOctave = layout.whiteWidth > 26
  const nameBaseline = kbHeight - (showOctave ? octaveFont + 14 : 16)
  const octaveBaseline = kbHeight - 10

  for (const k of layout.keys) {
    if (k.black) continue
    const pressed = player.pressed.has(k.midi)
    const hint = hints.has(k.midi)
    const fl = player.flash.get(k.midi)

    let fill = C_WHITE
    if (fl?.kind === 'wrong') fill = '#e7b3a8'
    else if (fl?.kind === 'hit') fill = '#ffffff'
    else if (pressed) fill = C_PRESSED
    else if (hint) fill = '#ffd2c7'

    ctx.fillStyle = fill
    ctx.fillRect(k.x + 0.5, 0, k.w - 1, kbHeight - 2)
    ctx.strokeStyle = C_WHITE_EDGE
    ctx.lineWidth = 1
    ctx.strokeRect(k.x + 0.5, 0, k.w - 1, kbHeight - 2)

    if (hint || fl?.kind === 'wrong') {
      ctx.strokeStyle = C_HINT
      ctx.lineWidth = 3
      ctx.strokeRect(k.x + 2.5, 1.5, k.w - 5, kbHeight - 5)
    }

    const label = keyLabel(k.midi, settings.labels)
    if (label) {
      ctx.fillStyle = hint ? '#a3200c' : 'rgba(19,18,17,0.62)'
      ctx.font = `${hint ? 800 : 700} ${labelFontWhite}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, k.x + k.w / 2, nameBaseline)
      if (pitchClass(k.midi) === 0 && showOctave) {
        ctx.fillStyle = 'rgba(19,18,17,0.4)'
        ctx.font = `700 ${octaveFont}px ${FONT}`
        ctx.fillText(String(octaveOf(k.midi)), k.x + k.w / 2, octaveBaseline)
      }
    }
  }

  for (const k of layout.keys) {
    if (!k.black) continue
    const pressed = player.pressed.has(k.midi)
    const hint = hints.has(k.midi)
    const fl = player.flash.get(k.midi)

    let fill = C_BLACK
    if (fl?.kind === 'wrong') fill = '#5e1508'
    else if (fl?.kind === 'hit') fill = '#efedec'
    else if (pressed) fill = C_PRESSED
    else if (hint) fill = C_HINT

    ctx.fillStyle = fill
    ctx.fillRect(k.x, -2, k.w, blackH)
    ctx.strokeStyle = hint ? C_HINT : C_BLACK_EDGE
    ctx.lineWidth = hint ? 2 : 1
    ctx.strokeRect(k.x + 0.5, -2, k.w - 1, blackH)

    const label = keyLabel(k.midi, settings.labels)
    if (label && layout.blackWidth > 18) {
      const onLight = hint || fl?.kind === 'hit' || pressed
      ctx.fillStyle = onLight ? 'rgba(19,18,17,0.85)' : 'rgba(239,237,236,0.7)'
      ctx.font = `700 ${labelFontBlack}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, k.x + k.w / 2, blackH - 10)
    }
  }

  ctx.restore()
  ctx.textAlign = 'left'
}

function drawOverlay(ctx: CanvasRenderingContext2D, w: number, kbTop: number, player: Player) {
  if (!player.finished) return
  ctx.save()
  ctx.fillStyle = 'rgba(19,18,17,0.86)'
  ctx.fillRect(0, 0, w, kbTop)
  ctx.fillStyle = C_HINT
  ctx.font = `800 ${Math.min(38, Math.max(22, w / 26))}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('HẾT BÀI RỒI — GIỎI QUÁ!', w / 2, kbTop / 2)
  const acc = player.accuracy()
  if (acc != null) {
    ctx.fillStyle = '#efedec'
    ctx.font = `600 18px ${FONT}`
    ctx.fillText(`Đúng ${Math.round(acc * 100)}%`, w / 2, kbTop / 2 + 34)
  }
  ctx.restore()
  ctx.textAlign = 'left'
}

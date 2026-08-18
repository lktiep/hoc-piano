/**
 * Man hinh choi: not nhac roi xuong + ban phim dan, ve chung tren MOT canvas
 * de 2 phan khop nhau tuyet doi va chay muot 60fps.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Player } from '../engine/player'
import type { Settings } from '../types'
import { buildLayout, keyAt, BLACK_HEIGHT_RATIO, type KeyboardLayout } from '../music/layout'
import { isBlackKey, keyLabel, octaveOf, pitchClass } from '../music/notes'

const C_WHITE = '#f6f8fc'
const C_WHITE_EDGE = '#b9c4d6'
const C_BLACK = '#20283a'
const C_BLACK_EDGE = '#0b0f1a'
const C_RIGHT = '#f59e0b'
const C_RIGHT_LIGHT = '#fcd34d'
const C_LEFT = '#38bdf8'
const C_LEFT_LIGHT = '#93ddfd'
const C_HINT = '#22c55e'
const C_WRONG = '#ef4444'

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

  // ------------------------------------------------------------- kich thuoc
  const resize = useCallback(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const rect = wrap.getBoundingClientRect()
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    const w = Math.max(320, Math.floor(rect.width))
    const h = Math.max(260, Math.floor(rect.height))
    sizeRef.current = { w, h, dpr }
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const kbH = Math.round(Math.min(Math.max(h * 0.42, 160), 340))
    kbHeightRef.current = kbH
    kbTopRef.current = h - kbH
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
    <div className="stage" ref={wrapRef}>
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, rr)
  else {
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
  }
}

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

  const bg = ctx.createLinearGradient(0, 0, 0, kbTop)
  bg.addColorStop(0, '#0a0f1d')
  bg.addColorStop(1, '#151d33')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, kbTop)

  const pos = player.posBeat
  const lookahead = Math.max(2, settings.lookaheadBeats)
  const pxPerBeat = kbTop / lookahead

  drawLanes(ctx, layout, kbTop)
  drawGrid(ctx, player, pos, lookahead, pxPerBeat, kbTop, w)
  drawNotes(ctx, player, settings, layout, pos, lookahead, pxPerBeat, kbTop)
  drawNowLine(ctx, w, kbTop, player)
  drawKeyboard(ctx, layout, kbTop, kbHeight, player, settings, now)
  drawOverlay(ctx, w, kbTop, player)
}

/** Vien mo phan chia cac phim de mat de doi chieu not voi phim. */
function drawLanes(ctx: CanvasRenderingContext2D, layout: KeyboardLayout, kbTop: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = 1
  for (const k of layout.keys) {
    if (k.black) continue
    if (pitchClass(k.midi) === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
    }
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
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'bottom'
  for (const g of tl.beatGrid(pos - 1, pos + lookahead + 1)) {
    const y = kbTop - (g.beat - pos) * pxPerBeat
    if (y < -20 || y > kbTop) continue
    ctx.strokeStyle = g.strong ? 'rgba(148,180,255,0.30)' : 'rgba(148,180,255,0.10)'
    ctx.lineWidth = g.strong ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(w, Math.round(y) + 0.5)
    ctx.stroke()
    if (g.strong) {
      ctx.fillStyle = 'rgba(148,180,255,0.55)'
      ctx.fillText(String(tl.measureAt(g.beat)), 6, y - 3)
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
    if (!n.required && settings.mode !== 'listen') {
      base = n.h === 'R' ? '#8a6a2a' : '#2b6182'
      light = n.h === 'R' ? '#b08c3f' : '#3d7ea3'
    }
    if (done) ctx.globalAlpha = 0.35

    if (isNext && player.waiting) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 160)
      ctx.shadowColor = C_HINT
      ctx.shadowBlur = 14 + 10 * pulse
    }

    const grad = ctx.createLinearGradient(x, top, x, bottom)
    grad.addColorStop(0, light)
    grad.addColorStop(1, base)
    ctx.fillStyle = grad
    roundRect(ctx, x, top, wNote, height, Math.min(8, wNote / 2))
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.strokeStyle = isNext ? C_HINT : 'rgba(0,0,0,0.35)'
    ctx.lineWidth = isNext ? 2.5 : 1
    roundRect(ctx, x, top, wNote, height, Math.min(8, wNote / 2))
    ctx.stroke()

    // So ngon tay
    if (settings.showFingers && n.f && height > 22 && wNote > 20) {
      ctx.fillStyle = 'rgba(15,20,35,0.85)'
      const r = Math.min(11, wNote / 2.6)
      ctx.beginPath()
      ctx.arc(x + wNote / 2, bottom - r - 4, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${Math.round(r * 1.4)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(n.f), x + wNote / 2, bottom - r - 3)
    }

    // Ten not tren khoi not (khi du cho)
    if (settings.labels !== 'off' && height > 30 && wNote > 26) {
      ctx.fillStyle = 'rgba(20,26,42,0.9)'
      ctx.font = `700 ${Math.min(15, Math.round(wNote / 2.6))}px ui-sans-serif, system-ui, sans-serif`
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
  const glow = player.waiting ? C_HINT : 'rgba(255,255,255,0.75)'
  ctx.strokeStyle = glow
  ctx.lineWidth = player.waiting ? 3 : 2
  ctx.shadowColor = glow
  ctx.shadowBlur = player.waiting ? 16 : 8
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
  ctx.fillStyle = '#070b14'
  ctx.fillRect(0, -6, layout.width, kbHeight + 6)

  const labelFontWhite = Math.max(11, Math.min(26, layout.whiteWidth * 0.46))
  const labelFontBlack = Math.max(9, Math.min(16, layout.blackWidth * 0.5))

  for (const k of layout.keys) {
    if (k.black) continue
    const pressed = player.pressed.has(k.midi)
    const hint = hints.has(k.midi)
    const fl = player.flash.get(k.midi)

    let fill = C_WHITE
    if (fl?.kind === 'wrong') fill = '#ffb4b4'
    else if (fl?.kind === 'hit') fill = '#b6f5c8'
    else if (pressed) fill = '#a7e2ff'
    else if (hint) fill = '#d8ffe3'

    ctx.fillStyle = fill
    roundRect(ctx, k.x + 0.5, 0, k.w - 1, kbHeight - 2, 7)
    ctx.fill()
    ctx.strokeStyle = C_WHITE_EDGE
    ctx.lineWidth = 1
    ctx.stroke()

    if (hint) {
      ctx.strokeStyle = C_HINT
      ctx.lineWidth = 3
      roundRect(ctx, k.x + 2, 1, k.w - 4, kbHeight - 5, 7)
      ctx.stroke()
    }
    if (fl?.kind === 'wrong') {
      ctx.strokeStyle = C_WRONG
      ctx.lineWidth = 3
      roundRect(ctx, k.x + 2, 1, k.w - 4, kbHeight - 5, 7)
      ctx.stroke()
    }

    const label = keyLabel(k.midi, settings.labels)
    if (label) {
      ctx.fillStyle = hint ? '#12692f' : '#4a5568'
      ctx.font = `${hint ? 800 : 600} ${labelFontWhite}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, k.x + k.w / 2, kbHeight - 16)
      if (pitchClass(k.midi) === 0 && layout.whiteWidth > 26) {
        ctx.fillStyle = 'rgba(74,85,104,0.65)'
        ctx.font = `600 ${Math.max(9, labelFontWhite * 0.55)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillText(String(octaveOf(k.midi)), k.x + k.w / 2, kbHeight - 16 + labelFontWhite * 0.85)
      }
    }
  }

  for (const k of layout.keys) {
    if (!k.black) continue
    const pressed = player.pressed.has(k.midi)
    const hint = hints.has(k.midi)
    const fl = player.flash.get(k.midi)

    let fill = C_BLACK
    if (fl?.kind === 'wrong') fill = '#8f2020'
    else if (fl?.kind === 'hit') fill = '#166534'
    else if (pressed) fill = '#0b6c92'
    else if (hint) fill = '#14532d'

    ctx.fillStyle = fill
    roundRect(ctx, k.x, -2, k.w, blackH, 5)
    ctx.fill()
    ctx.strokeStyle = hint ? C_HINT : C_BLACK_EDGE
    ctx.lineWidth = hint ? 2.5 : 1
    ctx.stroke()

    const label = keyLabel(k.midi, settings.labels)
    if (label && layout.blackWidth > 18) {
      ctx.fillStyle = hint ? '#bbf7d0' : 'rgba(226,232,240,0.75)'
      ctx.font = `700 ${labelFontBlack}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, k.x + k.w / 2, blackH - 10)
    }
  }

  ctx.restore()
  ctx.textAlign = 'left'
}

function drawOverlay(ctx: CanvasRenderingContext2D, w: number, kbTop: number, player: Player) {
  if (!player.playing && !player.finished) return
  if (player.finished) {
    ctx.save()
    ctx.fillStyle = 'rgba(8,12,22,0.55)'
    ctx.fillRect(0, 0, w, kbTop)
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 34px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Hết bài rồi — giỏi quá!', w / 2, kbTop / 2)
    const acc = player.accuracy()
    if (acc != null) {
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '600 20px ui-sans-serif, system-ui, sans-serif'
      ctx.fillText(`Đúng ${Math.round(acc * 100)}%`, w / 2, kbTop / 2 + 40)
    }
    ctx.restore()
    ctx.textAlign = 'left'
  }
}

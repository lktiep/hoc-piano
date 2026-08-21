/**
 * Khuong nhac — theo khung "BẢN NHẠC" trong thiet ke "Piano Player.dc.html".
 *
 * Ve bang SVG chu khong phai canvas: chu it doi tuong, ma nhu the thi phong to
 * bao nhieu cung net va doc duoc bang trinh doc man hinh.
 *
 * Cach ve: tay phai len khoa Sol, tay trai xuong khoa Fa. Moi he 4 o nhip.
 * Vach dan (playhead) chay theo dung `posBeat` cua Player.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { Player } from '../engine/player'
import type { LabelStyle, SongNote } from '../types'
import { keyLabel, pitchClass } from '../music/notes'

/* Mau viet thang so o day chu khong dung bien CSS: thuoc tinh trinh bay cua
   SVG (fill=, stroke=) khong hieu var(). Cac gia tri nay dung bang site.css. */
const C_TEXT = '#efedec'
const C_ACCENT = '#ec3013'
const C_FINGER = '#ff7a5c'
const C_LINE = 'rgba(255,255,255,0.34)'
const FONT = 'Archivo, ui-sans-serif, system-ui, sans-serif'

/** Khoang cach 2 duong ke lien nhau. Ca khuong cao 4 lan so nay. */
const L = 11
/** Be ngang he thong trong he toa do SVG. */
const VW = 1180
const PAD_L = 84
const PAD_R = 18
const STAFF_GAP = 58
const SYSTEM_H = 4 * L + STAFF_GAP + 4 * L + 30
const MEASURES_PER_SYSTEM = 4

/** Chu cai cua tung bac trong quang tam (Do=0 ... Si=6) va co dau thang khong. */
const STEP_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const SHARP_PC = new Set([1, 3, 6, 8, 10])

/** Vi tri bac dien tonic: cang lon cang cao. C4 = 28. */
function diatonic(midi: number): number {
  const oct = Math.floor(midi / 12) - 1
  return oct * 7 + STEP_OF_PC[pitchClass(midi)]
}

/** Bac cua duong ke duoi cung: khoa Sol la Mi4, khoa Fa la Sol2. */
const BOTTOM = { treble: diatonic(64), bass: diatonic(43) }

interface Placed {
  note: SongNote
  clef: 'treble' | 'bass'
  /** so thu tu he thong */
  sys: number
  x: number
  /** y so voi dinh khuong tuong ung */
  y: number
  /** so duong ke phu, am la ke duoi khuong */
  ledger: number[]
  sharp: boolean
  hollow: boolean
  stemUp: boolean
}

interface SystemBox {
  /** o nhip dau (1-based) */
  from: number
  to: number
  /** phach bat dau / ket thuc */
  beatFrom: number
  beatTo: number
  /** moc x cua tung o nhip trong he */
  bars: { measure: number; x: number; w: number; beat: number; len: number }[]
}

interface Layout {
  systems: SystemBox[]
  placed: Placed[]
}

function buildLayout(player: Player): Layout | null {
  const tl = player.timeline
  if (!tl || !player.song) return null

  const count = tl.measureCount
  const systems: SystemBox[] = []
  for (let start = 1; start <= count; start += MEASURES_PER_SYSTEM) {
    const to = Math.min(count, start + MEASURES_PER_SYSTEM - 1)
    const n = to - start + 1
    const avail = VW - PAD_L - PAD_R
    const bars: SystemBox['bars'] = []
    for (let i = 0; i < n; i++) {
      const measure = start + i
      const beat = tl.measureStart(measure)
      bars.push({
        measure,
        x: PAD_L + (i * avail) / n,
        w: avail / n,
        beat,
        len: tl.measureEnd(measure) - beat,
      })
    }
    systems.push({
      from: start,
      to,
      beatFrom: tl.measureStart(start),
      beatTo: tl.measureEnd(to),
      bars,
    })
  }

  const placed: Placed[] = []
  for (const n of player.notes) {
    const sys = systems.findIndex((s) => n.t >= s.beatFrom - 1e-9 && n.t < s.beatTo - 1e-9)
    if (sys < 0) continue
    const bar = systems[sys].bars.find((b) => n.t >= b.beat - 1e-9 && n.t < b.beat + b.len - 1e-9)
    if (!bar) continue

    const clef: 'treble' | 'bass' = n.h === 'L' ? 'bass' : 'treble'
    const d = diatonic(n.m)
    const base = BOTTOM[clef]
    // Duong ke duoi cung nam o y = 4L (tinh tu dinh khuong), moi bac cao len L/2.
    const y = 4 * L - ((d - base) * L) / 2

    const ledger: number[] = []
    for (let k = base - 2; k >= d; k -= 2) ledger.push(4 * L - ((k - base) * L) / 2)
    for (let k = base + 10; k <= d; k += 2) ledger.push(4 * L - ((k - base) * L) / 2)

    placed.push({
      note: n,
      clef,
      sys,
      x: bar.x + 14 + ((n.t - bar.beat) / bar.len) * (bar.w - 24),
      y,
      ledger,
      sharp: SHARP_PC.has(pitchClass(n.m)),
      hollow: n.d >= 2,
      stemUp: y > 2 * L,
    })
  }

  return { systems, placed }
}

interface SheetProps {
  player: Player
  labels: LabelStyle
  showFingers: boolean
  /** doi moi khi vi tri thay doi — de React ve lai vach dan */
  posBeat: number
}

export function Sheet({ player, labels, showFingers, posBeat }: SheetProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => buildLayout(player), [player, player.song, player.notes])

  const curSys = useMemo(() => {
    if (!layout) return 0
    const i = layout.systems.findIndex((s) => posBeat < s.beatTo - 1e-9)
    return i < 0 ? layout.systems.length - 1 : i
  }, [layout, posBeat])

  // Cuon sao cho he dang choi luon nhin thay
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const el = box.querySelector<SVGSVGElement>(`[data-sys="${curSys}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const br = box.getBoundingClientRect()
    const top = r.top - br.top + box.scrollTop
    if (top < box.scrollTop || top + r.height > box.scrollTop + box.clientHeight) {
      box.scrollTo?.({ top: Math.max(0, top - 12), behavior: 'smooth' })
    }
  }, [curSys])

  if (!layout || layout.systems.length === 0) {
    return (
      <div className="sheet" ref={boxRef}>
        <div className="sheet-empty">Chưa có bản nhạc nào để hiện.</div>
      </div>
    )
  }

  const ts = player.song?.timeSignature ?? [4, 4]

  return (
    <div className="sheet" ref={boxRef}>
      {layout.systems.map((sysBox, si) => {
        const trebleTop = 16
        const bassTop = trebleTop + 4 * L + STAFF_GAP
        const notes = layout.placed.filter((p) => p.sys === si)
        const playing = si === curSys
        const bar = sysBox.bars.find((b) => posBeat >= b.beat - 1e-9 && posBeat < b.beat + b.len - 1e-9)
        const headX = bar ? bar.x + 14 + ((posBeat - bar.beat) / bar.len) * (bar.w - 24) : null

        return (
          <svg
            key={si}
            className="sheet-system"
            data-sys={si}
            viewBox={`0 0 ${VW} ${SYSTEM_H}`}
            role="img"
            aria-label={`Ô nhịp ${sysBox.from} đến ${sysBox.to}`}
          >
            {/* o nhip dang choi: to nen nhat cho de theo doi */}
            {playing && bar && (
              <rect x={bar.x} y={trebleTop - 8} width={bar.w} height={bassTop + 4 * L + 8 - trebleTop} fill="rgba(236,48,19,0.055)" />
            )}

            {(['treble', 'bass'] as const).map((clef) => {
              const top = clef === 'treble' ? trebleTop : bassTop
              return (
                <g key={clef}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={i}
                      x1={PAD_L - 46}
                      y1={top + i * L}
                      x2={VW - PAD_R}
                      y2={top + i * L}
                      stroke={C_LINE}
                      strokeWidth="1"
                    />
                  ))}
                  <text
                    x={PAD_L - 40}
                    y={clef === 'treble' ? top + 3.4 * L : top + 2.1 * L}
                    fontSize={clef === 'treble' ? L * 6.4 : L * 4.4}
                    fill={C_TEXT}
                  >
                    {clef === 'treble' ? '𝄞' : '𝄢'}
                  </text>
                  {si === 0 && (
                    <text
                      x={PAD_L - 6}
                      y={top + 2 * L + 1}
                      fontSize={L * 2.1}
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={C_TEXT}
                      fontFamily={FONT}
                    >
                      {ts[0]}/{ts[1]}
                    </text>
                  )}
                </g>
              )
            })}

            {/* vach nhip + so o nhip */}
            {sysBox.bars.map((b, i) => (
              <g key={b.measure}>
                <line
                  x1={b.x}
                  y1={trebleTop}
                  x2={b.x}
                  y2={bassTop + 4 * L}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                />
                <text x={b.x + 3} y={trebleTop - 7} fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.35)">
                  {b.measure}
                </text>
                {i === sysBox.bars.length - 1 && (
                  <line
                    x1={VW - PAD_R}
                    y1={trebleTop}
                    x2={VW - PAD_R}
                    y2={bassTop + 4 * L}
                    stroke={C_LINE}
                    strokeWidth="2"
                  />
                )}
              </g>
            ))}

            {/* not */}
            {notes.map((p, i) => {
              const top = p.clef === 'treble' ? trebleTop : bassTop
              const cy = top + p.y
              const done = p.note.t + p.note.d <= posBeat + 1e-9
              const active = posBeat >= p.note.t - 1e-9 && posBeat < p.note.t + p.note.d - 1e-9
              const color = p.note.h === 'R' ? C_ACCENT : 'rgba(255,255,255,0.78)'
              const rx = L * 0.66
              const ry = L * 0.47
              return (
                <g key={i} opacity={done && !active ? 0.4 : 1}>
                  {p.ledger.map((ly, k) => (
                    <line
                      key={k}
                      x1={p.x - rx - 5}
                      y1={top + ly}
                      x2={p.x + rx + 5}
                      y2={top + ly}
                      stroke={C_LINE}
                      strokeWidth="1"
                    />
                  ))}
                  {p.sharp && (
                    <text x={p.x - rx - 9} y={cy + 4} fontSize={L * 1.5} textAnchor="end" fill={color}>
                      ♯
                    </text>
                  )}
                  <line
                    x1={p.stemUp ? p.x + rx - 0.5 : p.x - rx + 0.5}
                    y1={cy}
                    x2={p.stemUp ? p.x + rx - 0.5 : p.x - rx + 0.5}
                    y2={cy + (p.stemUp ? -3.2 * L : 3.2 * L)}
                    stroke={color}
                    strokeWidth="1.6"
                  />
                  <ellipse
                    cx={p.x}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    transform={`rotate(-20 ${p.x} ${cy})`}
                    fill={p.hollow ? 'none' : color}
                    stroke={color}
                    strokeWidth={p.hollow ? 2 : 1}
                  />
                  {labels !== 'off' && (
                    <text
                      x={p.x}
                      y={cy + (p.stemUp ? 3.6 * L : -2.6 * L)}
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontFamily={FONT}
                    >
                      {keyLabel(p.note.m, labels)}
                    </text>
                  )}
                  {showFingers && p.note.f && (
                    <text
                      x={p.x}
                      y={cy + (p.stemUp ? -3.7 * L : 3.9 * L)}
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      fill={C_FINGER}
                      fontFamily={FONT}
                    >
                      {p.note.f}
                    </text>
                  )}
                </g>
              )
            })}

            {/* vach dang choi */}
            {playing && headX != null && (
              <g>
                <line
                  x1={headX}
                  y1={trebleTop - 10}
                  x2={headX}
                  y2={bassTop + 4 * L + 10}
                  stroke={C_ACCENT}
                  strokeWidth="2"
                />
                <rect x={headX - 5} y={trebleTop - 16} width="10" height="6" fill={C_ACCENT} />
              </g>
            )}
          </svg>
        )
      })}
    </div>
  )
}

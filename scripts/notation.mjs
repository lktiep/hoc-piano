/**
 * Ky phap gon de viet bai mau bang tay.
 *
 *   "C4 D4:0.5 [C3E3G3]:2 r:1 E4@3"
 *
 *   C4        -> not Do quang tam 4, truong do mac dinh 1 phach den
 *   D4:0.5    -> mot phan hai phach (not moc don)
 *   [C3E3G3]  -> hop am (cac not cung luc)
 *   r:2       -> lang 2 phach
 *   E4@3      -> bam bang ngon thu 3
 */

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name)
  if (!m) throw new Error(`Ten not khong hop le: "${name}"`)
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (parseInt(m[3], 10) + 1) * 12 + STEP[m[1]] + alter
}

function parseDuration(s) {
  if (s === undefined) return 1
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    return parseFloat(a) / parseFloat(b)
  }
  const v = parseFloat(s)
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Truong do khong hop le: "${s}"`)
  return v
}

const TOKEN = /^(\[[^\]]+\]|[A-G][#b]?-?\d+|r)(?::([\d./]+))?(?:@([1-5]))?$/

/**
 * @param {string} src   chuoi ky phap
 * @param {'L'|'R'} hand
 * @param {Record<number, number>} [fingerMap] cao do MIDI -> so ngon tay (dung khi khong ghi @)
 * @returns {{notes: object[], length: number}}
 */
export function parseSeq(src, hand, fingerMap) {
  const notes = []
  let t = 0
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok) continue
    const m = TOKEN.exec(tok)
    if (!m) throw new Error(`Khong doc duoc ky hieu "${tok}"`)
    const [, head, durStr, fingerStr] = m
    const d = parseDuration(durStr)
    if (head !== 'r') {
      const names = head.startsWith('[') ? head.slice(1, -1).match(/[A-G][#b]?-?\d+/g) : [head]
      for (const name of names) {
        const midi = noteToMidi(name)
        const note = { t: round(t), d: round(d), m: midi, h: hand }
        const finger = fingerStr ? parseInt(fingerStr, 10) : fingerMap?.[midi]
        if (finger) note.f = finger
        notes.push(note)
      }
    }
    t += d
  }
  return { notes, length: round(t) }
}

function round(v) {
  return Math.round(v * 1e6) / 1e6
}

/**
 * Dung mot bai hoan chinh.
 * @param {object} spec
 * @param {string} spec.id
 * @param {string} spec.title
 * @param {[number, number]} spec.timeSignature
 * @param {number} spec.bpm
 * @param {string} spec.rh   ky phap tay phai
 * @param {string} [spec.lh] ky phap tay trai
 * @param {number} [spec.pickup] so phach cua o nhip lay da
 */
export function makeSong(spec) {
  const rh = parseSeq(spec.rh, 'R', spec.fingersRight)
  const lh = spec.lh ? parseSeq(spec.lh, 'L', spec.fingersLeft) : { notes: [], length: 0 }

  if (spec.lh && Math.abs(rh.length - lh.length) > 1e-6) {
    throw new Error(`[${spec.id}] Hai tay khong bang nhau: phai ${rh.length} phach, trai ${lh.length} phach`)
  }

  const notes = [...rh.notes, ...lh.notes].sort((a, b) => a.t - b.t || a.m - b.m)
  const total = Math.max(rh.length, lh.length)

  const [num, den] = spec.timeSignature
  const perMeasure = (num * 4) / den
  const pickup = spec.pickup ?? 0
  const measures = [0]
  let b = pickup > 0 ? pickup : perMeasure
  while (b < total - 1e-6) {
    measures.push(round(b))
    b += perMeasure
  }
  measures.push(round(Math.max(b, total)))

  // Kiem tra: moi o nhip (tru o lay da) phai dung so phach
  for (let i = pickup > 0 ? 1 : 0; i < measures.length - 2; i++) {
    const len = measures[i + 1] - measures[i]
    if (Math.abs(len - perMeasure) > 1e-6) {
      throw new Error(`[${spec.id}] O nhip ${i + 1} dai ${len} phach, dang le ${perMeasure}`)
    }
  }

  return {
    id: spec.id,
    title: spec.title,
    artist: spec.artist,
    source: spec.source,
    bpm: spec.bpm,
    timeSignature: spec.timeSignature,
    measures,
    notes,
    level: spec.level,
    tags: spec.tags,
    note: spec.note,
  }
}

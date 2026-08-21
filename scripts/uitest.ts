#!/usr/bin/env tsx
/**
 * Chay ca giao dien trong DOM gia (jsdom) de bat loi luc CHAY:
 * mount App, ve canvas that su, bam nut, go phim, mo cac hop thoai.
 *
 *   npm run test:ui
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'

// ------------------------------------------------------------------ khung test

let passed = 0
const failures: string[] = []
let group = ''
function suite(name: string) {
  group = name
  console.log(`\n${name}`)
}
function ok(cond: boolean, what: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${what}`)
  } else {
    failures.push(`[${group}] ${what}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${what}${detail ? ` — ${detail}` : ''}`)
  }
}
function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  ok(a === b, what, a === b ? '' : `nhan ${a}, mong doi ${b}`)
}

// ------------------------------------------------------------------ DOM gia

const dom = new JSDOM('<!doctype html><html lang="vi"><head><base href="http://localhost:5173/"></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
})
const { window } = dom
const document = window.document

// Kich thuoc gia (jsdom khong tinh layout)
const VIEW_W = 1280
const VIEW_H = 800
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: VIEW_W, height: VIEW_H, top: 0, left: 0, right: VIEW_W, bottom: VIEW_H, toJSON() {} } as DOMRect
}
window.Element.prototype.setPointerCapture = function () {}
window.Element.prototype.releasePointerCapture = function () {}
window.Element.prototype.hasPointerCapture = function () {
  return false
}

// -------------------------------------------------------------- canvas gia

const drawCalls: string[] = []
function fakeContext(canvas: unknown) {
  const state: Record<string, unknown> = { canvas }
  const gradient = { addColorStop: () => {} }
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === 'symbol') return undefined
        const name = String(prop)
        if (name === 'canvas') return canvas
        if (name === 'measureText') return (s: string) => ({ width: String(s).length * 6 })
        if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient
        if (name in state) return state[name]
        return (...a: unknown[]) => {
          drawCalls.push(name)
          void a
        }
      },
      set(_t, prop, v) {
        if (typeof prop !== 'symbol') state[String(prop)] = v
        return true
      },
    },
  )
}
window.HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
  return kind === '2d' ? fakeContext(this) : null
} as unknown as HTMLCanvasElement['getContext']

// --------------------------------------------------------------- Web Audio gia

let oscCount = 0
function audioParam(v = 0) {
  const p = {
    value: v,
    setValueAtTime: () => p,
    linearRampToValueAtTime: () => p,
    exponentialRampToValueAtTime: () => p,
    setTargetAtTime: () => p,
    cancelScheduledValues: () => p,
    cancelAndHoldAtTime: () => p,
  }
  return p
}
class FakeAudioContext {
  currentTime = 0
  sampleRate = 48000
  state = 'running'
  destination = { connect: () => {}, disconnect: () => {} }
  createGain() {
    return { gain: audioParam(1), connect: () => {}, disconnect: () => {} }
  }
  createBiquadFilter() {
    return { type: 'lowpass', Q: audioParam(1), frequency: audioParam(1000), connect: () => {}, disconnect: () => {} }
  }
  createDynamicsCompressor() {
    return {
      threshold: audioParam(),
      knee: audioParam(),
      ratio: audioParam(),
      attack: audioParam(),
      release: audioParam(),
      connect: () => {},
      disconnect: () => {},
    }
  }
  createPeriodicWave() {
    return {}
  }
  createOscillator() {
    oscCount++
    return {
      type: 'sine',
      frequency: audioParam(440),
      onended: null,
      setPeriodicWave: () => {},
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    }
  }
  resume() {
    return Promise.resolve()
  }
}

// ------------------------------------------------------- dong ho + rAF thu cong

let clock = 0
let nextRaf = 1
let frames = new Map<number, (t: number) => void>()
function step(times = 1, dt = 16) {
  for (let i = 0; i < times; i++) {
    clock += dt
    const due = frames
    frames = new Map()
    for (const cb of due.values()) cb(clock)
  }
}

// --------------------------------------------------------------- fetch gia

const fetchLog: string[] = []
const fakeFetch = async (input: unknown) => {
  const url = String(typeof input === 'object' && input && 'url' in input ? (input as { url: string }).url : input)
  const path = new URL(url, 'http://localhost:5173/').pathname
  fetchLog.push(path)
  const body = readFileSync(join(process.cwd(), 'public', path), 'utf8')
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  }
}

// ------------------------------------------------------------ gan vao globals

const g = globalThis as unknown as Record<string, unknown>
for (const key of [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLCanvasElement',
  'HTMLInputElement',
  'SVGElement',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'DOMParser',
  'getComputedStyle',
  'requestIdleCallback',
]) {
  const v = (window as unknown as Record<string, unknown>)[key]
  if (v === undefined) continue
  try {
    g[key] = v
  } catch {
    Object.defineProperty(g, key, { value: v, configurable: true, writable: true })
  }
}
g.window = window
g.document = document
g.self = window
g.AudioContext = FakeAudioContext
;(window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext
g.performance = { now: () => clock }
g.requestAnimationFrame = (cb: (t: number) => void) => {
  const id = nextRaf++
  frames.set(id, cb)
  return id
}
g.cancelAnimationFrame = (id: number) => {
  frames.delete(id)
}
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.fetch = fakeFetch
g.IS_REACT_ACT_ENVIRONMENT = true

// Bat moi loi khong bat duoc
const errors: string[] = []
const realConsoleError = console.error.bind(console)
console.error = (...a: unknown[]) => {
  errors.push(a.map(String).join(' '))
  realConsoleError(...a)
}
window.addEventListener('error', (e) => errors.push(`window.onerror: ${(e as ErrorEvent).message}`))
process.on('unhandledRejection', (r) => errors.push(`unhandledRejection: ${String(r)}`))

// ------------------------------------------------------------------ tien ich

const { createElement } = await import('react')
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const App = (await import('../src/App')).default

const act = React.act as (cb: () => Promise<void> | void) => Promise<void>

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null
const $$ = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[]
const textOf = (sel: string) => $(sel)?.textContent?.trim() ?? ''

async function click(el: HTMLElement | null, what = '') {
  if (!el) throw new Error(`Khong tim thay phan tu de bam: ${what}`)
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window as unknown as Window }))
  })
}
async function byText(sel: string, text: string) {
  return $$(sel).find((e) => (e.textContent ?? '').includes(text)) ?? null
}
async function key(type: 'keydown' | 'keyup', code: string) {
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }))
  })
}
async function setRange(el: HTMLElement | null, value: number) {
  if (!el) throw new Error('khong thay thanh truot')
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  desc!.set!.call(el, String(value))
  await act(async () => {
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function pointer(el: HTMLElement, type: string, clientX: number, clientY: number, pointerId = 1) {
  const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, view: window as unknown as Window })
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' })
  await act(async () => {
    el.dispatchEvent(ev)
  })
}
async function frame(times = 1) {
  await act(async () => {
    step(times)
  })
}

// ---------------------------------------------------------------------- chay

const root = createRoot(document.getElementById('root')!)
await act(async () => {
  root.render(createElement(App))
})
// cho fetch danh sach bai + bai dau tien
for (let i = 0; i < 6; i++) await act(async () => await Promise.resolve())

suite('Trang chu')
eq(fetchLog, ['/songs/index.json', '/songs/ngoi-sao-lap-lanh.json'], 'nap danh sach bai va bai dau tien')
ok($('.home') != null, 'mo trang la ra trang chu')
ok($('.topbar') == null, 'chua vao phong luyen')
ok(textOf('.hm-brand').includes('PHÍM'), 'co dau hieu thuong hieu')
eq(textOf('.home h1'), 'Học piano bằng cách chơi thật.', 'dung tieu de lon cua ban thiet ke')
eq($$('.hm-stat').length, 4, 'co bon o so lieu')
ok(textOf('.hm-stats').includes('88'), 'so lieu "88 phim dan"')
ok($$('.hm-stat-num')[1].textContent!.includes('8'), 'dem dung 8 ban nhac co san', textOf('.hm-stats'))
eq($$('.hm-step').length, 3, 'co ba buoc "cach hoat dong"')
eq(
  $$('.hm-level-meta').map((e) => e.textContent!.split('·')[1].trim()),
  ['4 bài', '3 bài', '1 bài'],
  'lo trinh dem bai theo dung do kho',
)
eq($$('.hm-key-w').length, 16, 've hai ban phim minh hoa (hero + lo trinh)')
eq($$('.hm-key-w')[0].textContent, 'Đô', 'phim minh hoa co ten not tieng Viet')
ok($('.hm-cta-band') != null, 'co dai keu goi cuoi trang')
ok($('.hm-foot-note')!.textContent!.includes('2026'), 'co chan trang')

suite('Vao phong luyen')
await click(await byText('.hm-btn', 'VÀO PHÒNG LUYỆN'), 'nut vao phong luyen tren thanh dieu huong')
await frame(2)
ok($('.home') == null, 'roi trang chu')
ok($('.topbar') != null, 'vao duoc phong luyen')
eq(window.location.hash, '#/luyen-tap', 'dia chi doi theo trang')
suite('Khoi dong')
eq(textOf('.song-title'), 'Ngôi sao lấp lánh', 'hien ten bai')
eq(textOf('.song-sub'), 'Dân ca Pháp', 'hien tac gia')
ok($('canvas.stage-canvas') != null, 'co canvas man hinh choi')
ok(textOf('.progress-label').includes('1/12'), 'thanh tien do: o nhip 1/12', textOf('.progress-label'))
ok($('.banner') == null, 'khong con bang bao "dang tai"')
eq($$('.seg-btn.is-on').map((e) => e.textContent), ['Chờ bé bấm', 'Tay phải'], 'mac dinh: cho be bam + tay phai')

suite('Ve canvas')
await frame(3)
ok(drawCalls.length > 100, `ve duoc ${drawCalls.length} lenh canvas`)
ok(drawCalls.includes('fillRect'), 'co to nen')
ok(drawCalls.includes('fillText'), 'co viet ten not len phim')
ok(drawCalls.includes('stroke') && drawCalls.includes('fill'), 'co ve phim dan')
const canvas = $('canvas.stage-canvas') as HTMLCanvasElement
ok(canvas.width > 1000 && canvas.height > 600, `canvas dung kich thuoc ${canvas.width}x${canvas.height}`)

suite('Nut choi / dung')
await click($('.btn-play'), 'nut choi')
eq(textOf('.btn-play-text'), 'Dừng', 'bam Choi thi doi thanh Dung')
ok($('.btn-play')!.className.includes('is-playing'), 'nut co trang thai dang choi')
await frame(240) // qua doan dem vao 4 phach
ok(oscCount > 0, `da phat tieng (${oscCount} giong)`)

suite('Che do "Cho be bam"')
const before = oscCount
await key('keydown', 'KeyM') // Si4 - sai
await key('keyup', 'KeyM')
await frame(12) // cho vong ve cap nhat thanh diem (120ms/lan)
ok(textOf('.chip-bad').includes('Sai 1'), 'bam sai thi hien "Sai 1"', textOf('.score'))
await key('keydown', 'KeyZ') // Do4 - dung
await key('keyup', 'KeyZ')
await frame(30)
ok(oscCount > before, 'phim may tinh co ra tieng')
ok(!textOf('.chip-bad').includes('Sai 2'), 'bam dung khong bi tinh sai')

suite('Bam chuot len phim dan')
const oscBefore = oscCount
await pointer(canvas, 'pointerdown', 60, VIEW_H - 60)
await frame(2)
await pointer(canvas, 'pointerup', 60, VIEW_H - 60)
ok(oscCount > oscBefore, 'bam chuot vao phim thi ra tieng')
await frame(2)

suite('Phim Space bat/tat')
await key('keydown', 'Space')
await frame(2)
eq(textOf('.btn-play-text'), 'Chơi', 'Space dung lai')
await key('keydown', 'Space')
await frame(2)
eq(textOf('.btn-play-text'), 'Dừng', 'Space choi tiep')
await key('keydown', 'Space')
await frame(2)

suite('Tua bang thanh truot')
await setRange($('.progress input'), 7)
await frame(2)
ok(textOf('.progress-label').includes('7/12'), 'keo thanh truot toi o nhip 7', textOf('.progress-label'))
await click(await byText('.btn-round', '⟲'), 'nut ve dau bai')
await frame(2)
ok(textOf('.progress-label').includes('1/12'), 've dau bai', textOf('.progress-label'))

suite('Doi che do & tay')
await click(await byText('.seg-btn', 'Nghe mẫu'), 'che do nghe mau')
await frame(2)
eq($$('.seg-btn.is-on').map((e) => e.textContent)[0], 'Nghe mẫu', 'doi sang che do nghe mau')
await click(await byText('.seg-btn', 'Hai tay'), 'hai tay')
await frame(2)
await click(await byText('.seg-btn', 'Chờ bé bấm'), 've lai che do cho')
await frame(2)
eq($$('.seg-btn.is-on').map((e) => e.textContent), ['Chờ bé bấm', 'Hai tay'], 'giu dung lua chon')

suite('Bang cai dat')
await click(await byText('.btn', '⚙ Cài đặt'), 'nut cai dat')
ok($('.panel') != null, 'mo duoc bang cai dat')
await click(await byText('.seg-btn', 'C D E'), 'nhan phim chu cai')
await frame(2)
await click(await byText('.seg-btn', 'Đô Rê Mi'), 'nhan phim solfege')
await frame(2)
const wide = $$('.panel input[type=checkbox]')
ok(wide.length >= 4, `co ${wide.length} o tich trong cai dat`)
for (const box of wide) {
  await act(async () => box.click())
  await frame(2)
}
ok(true, 'bat tat moi o tich khong loi')
for (const box of wide) {
  await act(async () => box.click())
  await frame(2)
}
const look = $$('.panel input[type=range]')[0]
await setRange(look, 14)
await frame(2)
ok(true, 'keo duoc thanh "nhin truoc"')
await click(await byText('.btn', '⚙ Cài đặt'), 'dong cai dat')

suite('Doi bai')
await click($('.song-btn'), 'nut chon bai')
ok($('.modal') != null, 'mo duoc hop thoai chon bai')
const items = $$('.song-item')
ok(items.length >= 8, `danh sach co ${items.length} bai`)
await click(items[3], 'bai thu 4')
for (let i = 0; i < 6; i++) await act(async () => await Promise.resolve())
await frame(3)
ok($('.modal') == null, 'hop thoai dong sau khi chon')
ok(textOf('.song-title').length > 0 && textOf('.song-title') !== 'Ngôi sao lấp lánh', `da doi sang "${textOf('.song-title')}"`)
ok(window.localStorage.getItem('hoc-piano.lastSong.v1') != null, 'nho bai vua chon')

suite('Hop thoai huong dan & them bai')
await click(await byText('.btn', '?'), 'nut huong dan')
ok($('.modal') != null, 'mo duoc huong dan')
await key('keydown', 'Escape')
ok($('.modal') == null, 'Escape dong huong dan')
await click(await byText('.btn', '⚙ Cài đặt'), 'mo cai dat')
await click(await byText('.btn', 'Thêm bài'), 'nut them bai')
ok($('.modal') != null, 'mo duoc hop thoai them bai')
ok($('.dropzone') != null, 'co vung tha tep')
await key('keydown', 'Escape')
ok($('.modal') == null, 'Escape dong hop thoai them bai')

suite('Ve trang chu roi quay lai')
await click($('.home-btn'), 'dau hieu PHIM tren thanh tren')
await frame(2)
ok($('.home') != null, 've duoc trang chu')
ok($('.topbar') == null, 'phong luyen da dong')
eq(window.location.hash, '#/', 'dia chi ve trang chu')
await click(await byText('.hm-more', 'THỬ NGAY'), 'thu ngay gam Do truong')
for (let i = 0; i < 6; i++) await act(async () => await Promise.resolve())
await frame(3)
ok($('.topbar') != null, 'quay lai phong luyen')
eq(textOf('.song-title'), 'Gam Đô trưởng (luyện ngón)', 'mo dung bai o hop minh hoa')
ok(fetchLog.includes('/songs/thang-am-do-truong.json'), 'co nap tep bai do')

suite('Chay lien tuc khong loi')
await click($('.btn-play'), 'choi tiep')
await frame(600)
ok(true, `chay ${600} khung hinh lien tuc khong loi`)
await act(async () => {
  root.unmount()
})
ok(true, 'go component khong loi')

// ------------------------------------------------------------------- ket qua

console.log('')
if (errors.length) {
  console.log(`❌ Co ${errors.length} loi luc chay:`)
  for (const e of errors.slice(0, 10)) console.log(`   - ${e.slice(0, 300)}`)
}
if (failures.length || errors.length) {
  if (failures.length) {
    console.log(`\n❌ ${failures.length} phep thu that bai:`)
    for (const f of failures) console.log(`   - ${f}`)
  }
  process.exit(1)
}
console.log(`✅ Tat ca ${passed} phep thu giao dien deu dat (khong co loi luc chay)\n`)
process.exit(0)

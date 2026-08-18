#!/usr/bin/env tsx
/**
 * Tu kiem tra toan bo phan "loi" cua app ma khong can trinh duyet:
 * ban phim, dong ho nhip, bo choi (3 che do), doc MusicXML, doc MIDI, kho bai.
 *
 *   npm test
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'

import { buildLayout, keyAt } from '../src/music/layout'
import { countWhiteKeys, isBlackKey, keyLabel, padToOctaves } from '../src/music/notes'
import { Timeline } from '../src/engine/timeline'
import { Player } from '../src/engine/player'
import { parseMusicXml, slugify } from '../src/music/musicxml'
import { midiToSong, parseMidiFile } from '../src/music/midiFile'
import { validateSong } from '../src/music/importSong'
import type { PianoSynth } from '../src/audio/piano'
import type { Metronome } from '../src/audio/metronome'
import type { Settings, Song, SongIndexEntry } from '../src/types'
import type { XEl } from '../src/music/xmlutil'

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
function near(actual: number, expected: number, what: string, tol = 1e-6) {
  ok(Math.abs(actual - expected) <= tol, what, `nhan ${actual}, mong doi ${expected}`)
}

// ------------------------------------------------------- gia lap am thanh

class FakeSynth {
  ons: number[] = []
  offs: number[] = []
  active = new Set<number>()
  ensure() {
    return null
  }
  get currentTime() {
    return 0
  }
  setVolume() {}
  noteOn(midi: number) {
    this.ons.push(midi)
    this.active.add(midi)
  }
  noteOff(midi: number) {
    this.offs.push(midi)
    this.active.delete(midi)
  }
  allNotesOff() {
    this.active.clear()
  }
}
class FakeMetro {
  clicks: boolean[] = []
  click(accent: boolean) {
    this.clicks.push(accent)
  }
}

function makePlayer(song: Song, patch: Partial<Settings> = {}) {
  const synth = new FakeSynth()
  const metro = new FakeMetro()
  const settings: Settings = {
    mode: 'listen',
    rate: 1,
    hands: 'both',
    guideSound: true,
    metronome: false,
    countIn: false,
    labels: 'solfege',
    showFingers: true,
    lookaheadBeats: 8,
    loop: null,
    ...patch,
  }
  const p = new Player(synth as unknown as PianoSynth, metro as unknown as Metronome, settings)
  p.load(song)
  return { p, synth, metro, settings }
}

/** Chay bo choi bang dong ho gia; `onTick` mo phong be bam phim. */
function run(p: Player, onTick?: (p: Player) => void, maxFrames = 200000) {
  let t = 0
  p.play()
  p.tick(t)
  for (let i = 0; i < maxFrames && !p.finished; i++) {
    t += 16
    p.tick(t)
    onTick?.(p)
    if (!p.playing && !p.finished) break
  }
  return t
}

// ---------------------------------------------------------------- ban phim

suite('Ban phim (hinh hoc phim dan)')
{
  const layout = buildLayout(21, 108, 1200)
  eq(layout.keys.length, 88, '88 phim tu La0 den Do8')
  eq(countWhiteKeys(21, 108), 52, '52 phim trang')
  eq(layout.keys.filter((k) => !k.black).length, 52, 'layout dung so phim trang')

  const whites = layout.keys.filter((k) => !k.black)
  let monotone = true
  for (let i = 1; i < whites.length; i++) if (whites[i].x <= whites[i - 1].x) monotone = false
  ok(monotone, 'phim trang xep tang dan theo truc x')
  near(whites[0].x, 0, 'phim trang dau tien sat le trai')
  near(whites[whites.length - 1].x + whites[0].w, 1200, 'phim trang cuoi sat le phai', 1e-6)

  // Bam vao giua tung phim phai ra dung phim do
  const H = 200
  let hitAll = true
  const missed: number[] = []
  for (const k of layout.keys) {
    const y = k.black ? H * 0.3 : H * 0.85
    const got = keyAt(layout, k.x + k.w / 2, y, H)
    if (got !== k.midi) {
      hitAll = false
      missed.push(k.midi)
    }
  }
  ok(hitAll, 'bam giua moi phim tra ve dung not', missed.slice(0, 5).join(','))

  ok(keyAt(layout, -5, 100, H) === null, 'bam ngoai ban phim tra ve null')
  eq(isBlackKey(61), true, 'Do# la phim den')
  eq(isBlackKey(60), false, 'Do la phim trang')
  eq(keyLabel(60, 'solfege'), 'Đô', 'nhan phim solfege')
  eq(keyLabel(60, 'letters'), 'C', 'nhan phim chu cai')
  eq(padToOctaves(62, 71), [60, 71], 'mo rong pham vi ra tron quang tam (Do -> Si)')
}

// ----------------------------------------------------------------- kho bai

suite('Kho bai co san (public/songs)')
const songsDir = join(process.cwd(), 'public', 'songs')
const index: SongIndexEntry[] = JSON.parse(readFileSync(join(songsDir, 'index.json'), 'utf8'))
ok(index.length >= 8, `index.json co ${index.length} bai`)
const library: Song[] = []
for (const entry of index) {
  const raw = JSON.parse(readFileSync(join(songsDir, entry.file), 'utf8'))
  let song: Song | null = null
  try {
    song = validateSong(raw)
  } catch (e) {
    ok(false, `${entry.file} hop le`, (e as Error).message)
  }
  if (!song) continue
  library.push(song)
  const bad = song.notes.filter((n) => n.m < 21 || n.m > 108 || n.d <= 0 || n.t < 0)
  const sorted = song.notes.every((n, i) => i === 0 || n.t >= song!.notes[i - 1].t)
  const last = song.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)
  const end = song.measures ? song.measures[song.measures.length - 1] : last
  ok(bad.length === 0 && sorted && last <= end + 1e-6, `${entry.file} (${song.notes.length} not) hop le`, bad.length ? `${bad.length} not sai` : !sorted ? 'not chua sap xep' : `not vuot vach nhip cuoi (${last} > ${end})`)
}

// -------------------------------------------------------------- dong ho nhip

suite('Dong ho nhip (Timeline)')
{
  const song = library.find((s) => s.id === 'ngoi-sao-lap-lanh')!
  const tl = new Timeline(song)
  eq(tl.measureCount, 12, 'Ngoi sao lap lanh co 12 o nhip')
  near(tl.beatsPerMeasure, 4, 'nhip 4/4 = 4 phach')
  near(tl.totalBeats, 48, 'tong 48 phach')
  eq(tl.measureAt(0), 1, 'phach 0 thuoc o nhip 1')
  eq(tl.measureAt(3.99), 1, 'phach 3.99 van o nhip 1')
  eq(tl.measureAt(4), 2, 'phach 4 sang o nhip 2')
  eq(tl.measureAt(48), 12, 'phach cuoi khong vuot qua o nhip cuoi')
  near(tl.measureStart(1), 0, 'o nhip 1 bat dau tu 0')
  near(tl.measureStart(12), 44, 'o nhip 12 bat dau tu 44')
  near(tl.measureEnd(12), 48, 'o nhip 12 ket thuc o 48')
  // 96 bpm -> 1 phach = 0.625 s
  near(tl.beatToSec(4), (4 * 60) / 96, 'doi phach sang giay')
  near(tl.secToBeat(tl.beatToSec(17.3)), 17.3, 'doi giay ve phach khop nguoc lai', 1e-9)
  eq(tl.beatGrid(0, 48).length, 48, 'luoi co du 48 phach')
  eq(tl.beatGrid(0, 48).filter((g) => g.strong).length, 12, 'co 12 phach manh = 12 vach nhip')

  // Bai co ban do tempo
  const two: Song = {
    id: 't',
    title: 't',
    bpm: 60,
    timeSignature: [4, 4],
    tempos: [
      { t: 0, bpm: 60 },
      { t: 4, bpm: 120 },
    ],
    measures: [0, 4, 8],
    notes: [{ t: 0, d: 1, m: 60, h: 'R' }],
  }
  const tl2 = new Timeline(two)
  near(tl2.beatToSec(4), 4, '4 phach dau o 60bpm = 4s')
  near(tl2.beatToSec(8), 6, '4 phach sau o 120bpm = them 2s')
  near(tl2.secToBeat(6), 8, 'doi nguoc qua diem doi tempo')
  eq(tl2.bpmAt(5), 120, 'bpmAt sau diem doi')
}

// ------------------------------------------------------------- che do nghe

suite('Bo choi — che do "Nghe mau"')
{
  const song = library.find((s) => s.id === 'mary-co-con-cuu-nho')!
  const { p, synth } = makePlayer(song, { mode: 'listen' })
  eq(p.gates.length, 0, 'che do nghe khong co cong nao')
  eq(p.hintMidis(), [], 'khong to sang phim nao')
  run(p)
  ok(p.finished, 'chay het bai')
  near(p.posBeat, 32, 'dung dung o cuoi bai')
  eq(synth.ons.length, song.notes.length, `phat du ${song.notes.length} not`)
  ok(synth.active.size === 0, 'tat het tieng khi ket thuc')
  eq(p.currentMeasure(), 8, 'o nhip cuoi la 8')
  near(p.progress(), 1, 'tien do = 100%')
}

// -------------------------------------------------------------- che do cho

suite('Bo choi — che do "Cho be bam" (tay phai)')
{
  const song = library.find((s) => s.id === 'mary-co-con-cuu-nho')!
  const { p, synth } = makePlayer(song, { mode: 'wait', hands: 'right' })
  const rightNotes = song.notes.filter((n) => n.h === 'R')
  ok(p.gates.length > 0, `tao duoc ${p.gates.length} cong`)
  eq(
    p.gates.length,
    new Set(rightNotes.map((n) => Math.round(n.t * 48))).size,
    'so cong = so thoi diem tay phai phai bam',
  )
  eq(p.notes.filter((n) => n.required).length, rightNotes.length, 'chi tay phai la bat buoc')
  eq(p.hintMidis(), [song.notes.find((n) => n.h === 'R')!.m], 'to sang not dau tien')

  // Khong bam gi -> phai dung lai o cong dau
  let t = 0
  p.play()
  for (let i = 0; i < 400; i++) {
    p.tick(t)
    t += 16
  }
  ok(p.waiting, 'khong bam thi dung cho (waiting)')
  near(p.posBeat, p.gates[0].t, 'dung dung tai cong dau tien')
  ok(!p.finished, 'chua ket thuc bai')

  // Bam sai -> dem loi, khong di tiep
  const wrongKey = p.gates[0].midis[0] + 1
  p.pressKey(wrongKey)
  p.releaseKey(wrongKey)
  eq(p.stats.wrong, 1, 'bam sai bi dem la sai')
  ok(p.waiting, 'bam sai van phai cho')

  // Bam dung -> chay tiep den het bai
  p.pause()
  p.reset()
  run(p, (pl) => {
    if (pl.waiting) {
      for (const m of pl.gates[pl.gateIdx].midis) {
        pl.pressKey(m)
        pl.releaseKey(m)
      }
    }
  })
  ok(p.finished, 'bam dung het thi chay het bai')
  eq(p.stats.hit, p.gates.length, `an dung ca ${p.gates.length} cong`)
  eq(p.stats.wrong, 0, 'khong co not sai')
  eq(p.accuracy(), 1, 'do chinh xac 100%')
  const leftCount = song.notes.filter((n) => n.h === 'L').length
  eq(synth.ons.filter((_, i) => i >= 0).length >= leftCount, true, 'app tu danh tay trai')
}

suite('Bo choi — bam som truoc cong')
{
  const song = library.find((s) => s.id === 'thang-am-do-truong')!
  const { p } = makePlayer(song, { mode: 'wait', hands: 'right' })
  p.play()
  p.tick(0)
  // Bam ngay not dau tien khi con chua toi cong -> van duoc tinh
  const first = p.gates[0].midis[0]
  p.pressKey(first)
  eq(p.stats.hit, 1, 'bam som trong 1 phach van duoc tinh')
  eq(p.gateIdx, 1, 'cong dau da qua')
  p.releaseKey(first)
}

suite('Bo choi — che do "Theo nhip"')
{
  const song = library.find((s) => s.id === 'thang-am-do-truong')!
  const { p } = makePlayer(song, { mode: 'follow', hands: 'right' })
  const gates = p.gates.length
  run(p) // khong bam gi ca
  ok(p.finished, 'che do theo nhip khong dung cho')
  eq(p.stats.miss, gates, `bo lo ca ${gates} cong khi khong bam`)
  eq(p.accuracy(), 0, 'do chinh xac 0%')
}

suite('Bo choi — lap doan & tua')
{
  const song = library.find((s) => s.id === 'ngoi-sao-lap-lanh')!
  const { p } = makePlayer(song, { mode: 'listen', loop: [3, 4] })
  const tl = new Timeline(song)
  p.reset()
  near(p.posBeat, tl.measureStart(3), 'reset ve dau doan lap')
  let t = 0
  p.play()
  for (let i = 0; i < 2000; i++) {
    p.tick(t)
    t += 16
    if (p.posBeat > tl.measureEnd(4) + 1e-6) break
  }
  ok(!p.finished, 'lap doan thi khong bao ket thuc')
  ok(p.posBeat >= tl.measureStart(3) - 1e-6 && p.posBeat <= tl.measureEnd(4) + 1e-6, 'luon nam trong doan lap')

  const { p: p2 } = makePlayer(song, { mode: 'wait', hands: 'right' })
  p2.seekMeasure(5)
  near(p2.posBeat, 16, 'tua den o nhip 5 = phach 16')
  eq(p2.currentMeasure(), 5, 'dang o o nhip 5')
  ok(p2.gates[p2.gateIdx].t >= 16 - 1e-6, 'cong ke tiep nam sau vi tri tua')
  p2.seekBeat(0)
  eq(p2.gateIdx, 0, 'tua ve dau thi cong ve 0')
}

suite('Bo choi — go nhip & dem vao')
{
  const song = library.find((s) => s.id === 'mary-co-con-cuu-nho')!
  const { p, metro } = makePlayer(song, { mode: 'listen', metronome: true, countIn: true })
  run(p)
  const total = metro.clicks.length
  ok(total >= 4 + 32, `go nhip du (${total} tieng, gom 4 tieng dem vao)`)
  eq(metro.clicks[0], true, 'tieng dem vao dau tien la nhan')
  eq(metro.clicks.filter((a) => a).length, 8 + 1, 'moi o nhip co 1 tieng nhan')
}

suite('Bo choi — doi toc do')
{
  const song = library.find((s) => s.id === 'mary-co-con-cuu-nho')!
  const fast = makePlayer(song, { mode: 'listen', rate: 1 })
  const slow = makePlayer(song, { mode: 'listen', rate: 0.5 })
  const tFast = run(fast.p)
  const tSlow = run(slow.p)
  ok(tSlow > tFast * 1.8, `rate 0.5 cham gap doi (${tFast}ms -> ${tSlow}ms)`)
  eq(fast.synth.ons.length, slow.synth.ons.length, 'so not phat ra khong doi')
}

// --------------------------------------------------------------- MusicXML

suite('Doc MusicXML')
{
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Bài thử nghiệm</work-title></work>
  <identification><creator type="composer">Người soạn</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>
      </attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type><sound tempo="90"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff>
        <notations><technical><fingering>1</fingering></technical></notations></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>half</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><voice>5</voice><type>whole</type><staff>2</staff></note>
    </measure>
    <measure number="2">
      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>half</type><staff>1</staff></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>half</type><staff>1</staff></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>half</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><voice>1</voice><type>quarter</type><staff>1</staff>
        <notations><tied type="start"/></notations></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice><type>quarter</type><staff>1</staff>
        <notations><tied type="stop"/></notations></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>8</duration><voice>5</voice><type>whole</type><staff>2</staff></note>
    </measure>
    <measure number="3">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>whole</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><rest/><duration>4</duration><voice>5</voice><type>half</type><staff>2</staff></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>half</type><staff>2</staff></note>
      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>
    </measure>
  </part>
</score-partwise>`

  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as XEl
  const { song, warnings } = parseMusicXml(doc, { source: 'https://vi.du/ban-nhac' })
  eq(song.title, 'Bài thử nghiệm', 'lay dung ten bai')
  eq(song.artist, 'Người soạn', 'lay dung tac gia')
  eq(song.id, 'bai-thu-nghiem', 'sinh ma bai bo dau tieng Viet')
  eq(song.bpm, 90, 'lay dung tempo')
  eq(song.timeSignature, [4, 4], 'lay dung so chi nhip')
  eq(song.source, 'https://vi.du/ban-nhac', 'giu lai link goc')
  ok(warnings.length === 0, 'khong co canh bao', warnings.map((w) => w.message).join('; '))

  // Trai dau nhac lai: 1, 2, 3, 2, 3
  eq(song.measures, [0, 4, 8, 12, 16, 20], 'trai dau nhac lai thanh 5 o nhip')
  eq(song.notes.length, 18, 'du 18 not sau khi trai')

  const m1 = song.notes.filter((n) => n.t < 4)
  eq(
    m1.map((n) => [n.t, n.d, n.m, n.h]),
    [
      [0, 4, 48, 'L'],
      [0, 1, 60, 'R'],
      [1, 1, 64, 'R'],
      [2, 2, 67, 'R'],
    ],
    'o nhip 1 dung cao do / truong do / tay',
  )
  eq(m1.find((n) => n.m === 60)!.f, 1, 'giu so ngon tay')
  eq(m1.find((n) => n.m === 48)!.d, 4, 'not tron o be trai dai 4 phach')

  const chord = song.notes.filter((n) => Math.abs(n.t - 4) < 1e-9 && n.h === 'R')
  eq(chord.map((n) => n.m), [60, 64, 67], 'doc dung hop am 3 not chong nhau')
  eq(chord.every((n) => n.d === 2), true, 'hop am dai 2 phach')

  const tied = song.notes.find((n) => Math.abs(n.t - 6) < 1e-9 && n.m === 62)!
  eq(tied.d, 2, 'noi hai not luyen thanh mot not 2 phach')

  const bass2 = song.notes.filter((n) => n.h === 'L' && Math.abs(n.t - 4) < 1e-9)
  eq(bass2.map((n) => [n.m, n.d]), [[43, 4]], 'be trai o nhip 2 la Sol2 tron')

  const m3 = song.notes.filter((n) => n.t >= 8 && n.t < 12)
  eq(m3.map((n) => [n.t, n.m, n.h]), [[8, 60, 'R'], [10, 48, 'L']], 'dau lang o be trai duoc bo qua')

  // Doan lap thu hai phai giong het doan dau
  const pass1 = song.notes.filter((n) => n.t >= 4 && n.t < 12).map((n) => [n.t - 4, n.d, n.m, n.h])
  const pass2 = song.notes.filter((n) => n.t >= 12).map((n) => [n.t - 12, n.d, n.m, n.h])
  eq(pass2, pass1, 'lan lap thu hai giong het lan dau')

  // Khong trai dau nhac lai
  const flat = parseMusicXml(doc, { expandRepeats: false }).song
  eq(flat.measures, [0, 4, 8, 12], 'khong trai thi con 3 o nhip')
  eq(flat.notes.length, 11, 'khong trai thi con 11 not')

  ok(validateSong(JSON.parse(JSON.stringify(song))) !== null, 'bai doc ra qua duoc kiem tra hop le')

  eq(slugify('Ngôi sao lấp lánh'), 'ngoi-sao-lap-lanh', 'slugify bo dau tieng Viet')
  eq(slugify('Für Elise (đoạn mở đầu)'), 'fur-elise-doan-mo-dau', 'slugify xu ly chu Đ va dau ngoac')
  eq(slugify('!!!'), 'bai-hat', 'slugify co ten du phong')
}

// -------------------------------------------------------------------- MIDI

suite('Doc tep MIDI')
{
  const PPQ = 480
  const bytes: number[] = []
  const push = (...b: number[]) => bytes.push(...b)
  const str = (s: string) => {
    for (const c of s) bytes.push(c.charCodeAt(0))
  }
  const u32 = (v: number) => push((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255)
  const u16 = (v: number) => push((v >> 8) & 255, v & 255)
  const vlq = (v: number) => {
    const out = [v & 0x7f]
    let x = v >> 7
    while (x > 0) {
      out.unshift((x & 0x7f) | 0x80)
      x >>= 7
    }
    push(...out)
  }
  const metaText = (type: number, s: string) => {
    vlq(0)
    push(0xff, type)
    const data = Array.from(new TextEncoder().encode(s))
    vlq(data.length)
    push(...data)
  }
  const track = (events: () => void) => {
    str('MTrk')
    const at = bytes.length
    u32(0)
    const start = bytes.length
    events()
    const len = bytes.length - start
    bytes[at] = (len >> 24) & 255
    bytes[at + 1] = (len >> 16) & 255
    bytes[at + 2] = (len >> 8) & 255
    bytes[at + 3] = len & 255
  }

  str('MThd')
  u32(6)
  u16(1)
  u16(3)
  u16(PPQ)

  // Track 0: ten bai + tempo + so chi nhip
  track(() => {
    metaText(0x03, 'Bài MIDI thử')
    vlq(0)
    push(0xff, 0x51, 0x03)
    const us = Math.round(60000000 / 120)
    push((us >> 16) & 255, (us >> 8) & 255, us & 255)
    vlq(0)
    push(0xff, 0x58, 0x04, 3, 2, 24, 8) // 3/4
    vlq(0)
    push(0xff, 0x2f, 0x00)
  })
  // Track 1: tay phai — 3 not den, dung running status
  track(() => {
    metaText(0x03, 'Right Hand')
    vlq(0)
    push(0x90, 60, 100)
    vlq(PPQ)
    push(60, 0) // running status = note off
    vlq(0)
    push(64, 100)
    vlq(PPQ)
    push(64, 0)
    vlq(0)
    push(67, 100)
    vlq(PPQ)
    push(67, 0)
    vlq(0)
    push(0xff, 0x2f, 0x00)
  })
  // Track 2: tay trai — 1 not tron 3 phach
  track(() => {
    metaText(0x03, 'Left Hand')
    vlq(0)
    push(0x90, 48, 80)
    vlq(PPQ * 3)
    push(0x80, 48, 0)
    vlq(0)
    push(0xff, 0x2f, 0x00)
  })

  const buf = new Uint8Array(bytes)
  const parsed = parseMidiFile(buf.buffer.slice(0) as ArrayBuffer)
  eq(parsed.ppq, PPQ, 'doc dung do phan giai PPQ')
  eq(parsed.tracks.length, 2, 'bo qua track khong co not, giu 2 track co not')
  eq(parsed.tempos.length, 1, 'doc duoc tempo')
  near(parsed.tempos[0].bpm, 120, 'tempo 120')

  const { song, warnings } = midiToSong(parsed, { source: 'test' })
  eq(song.title, 'Bài MIDI thử', 'lay ten bai tu meta track')
  eq(song.bpm, 120, 'bpm 120')
  eq(song.timeSignature, [3, 4], 'so chi nhip 3/4')
  eq(warnings.length, 0, 'khong co canh bao')
  eq(song.notes.length, 4, 'du 4 not')
  eq(
    song.notes.map((n) => [n.t, n.d, n.m, n.h]),
    [
      [0, 3, 48, 'L'],
      [0, 1, 60, 'R'],
      [1, 1, 64, 'R'],
      [2, 1, 67, 'R'],
    ],
    'doc dung thoi diem / truong do / tay (theo ten track)',
  )
  eq(song.measures, [0, 3], 'chia 1 o nhip 3 phach')
  ok(validateSong(JSON.parse(JSON.stringify(song))) !== null, 'bai MIDI qua duoc kiem tra hop le')

  // Bai MIDI nay choi duoc
  const { p, synth } = makePlayer(song, { mode: 'listen' })
  run(p)
  ok(p.finished, 'choi het bai MIDI')
  eq(synth.ons.length, 4, 'phat du 4 not')
}

// ------------------------------------------------------------------- ket qua

console.log('')
if (failures.length) {
  console.log(`❌ ${failures.length} loi / ${passed + failures.length} phep thu\n`)
  for (const f of failures) console.log(`   - ${f}`)
  process.exit(1)
}
console.log(`✅ Tat ca ${passed} phep thu deu dat\n`)

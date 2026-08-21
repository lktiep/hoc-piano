#!/usr/bin/env node
/**
 * Sinh cac bai co san trong public/songs/ tu ky phap gon.
 * Chay lai bat cu luc nao:  npm run songs
 *
 * Tat ca bai o day deu la dan ca / nhac co dien thuoc pham vi cong cong.
 */

import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeSong } from './notation.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'songs')

// Vi tri 5 ngon tay co ban: tay phai Do-Sol, tay trai Do-Sol quang tam duoi
const RH_C_POSITION = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }
const LH_C_POSITION = { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1 }

const SPECS = [
  {
    id: 'ngoi-sao-lap-lanh',
    title: 'Ngôi sao lấp lánh',
    artist: 'Dân ca Pháp',
    level: 1,
    genre: 'DÂN CA',
    bpm: 96,
    timeSignature: [4, 4],
    note: 'Bài đầu tiên rất hợp để làm quen: tay phải chỉ đi trong 6 nốt liền nhau.',
    rh: `C4 C4 G4 G4  A4 A4 G4:2  F4 F4 E4 E4  D4 D4 C4:2
         G4 G4 F4 F4  E4 E4 D4:2  G4 G4 F4 F4  E4 E4 D4:2
         C4 C4 G4 G4  A4 A4 G4:2  F4 F4 E4 E4  D4 D4 C4:2`,
    lh: `C3:4  F3:2 C3:2  F3:2 C3:2  G2:2 C3:2
         C3:2 F3:2  C3:2 G2:2  C3:2 F3:2  C3:2 G2:2
         C3:4  F3:2 C3:2  F3:2 C3:2  C3:4`,
  },
  {
    id: 'mary-co-con-cuu-nho',
    title: 'Mary có con cừu nhỏ',
    artist: 'Đồng dao Anh',
    level: 1,
    genre: 'ĐỒNG DAO',
    bpm: 96,
    timeSignature: [4, 4],
    note: 'Tay phải đặt cố định 5 ngón Đô–Sol, không cần chuyển tay.',
    fingersRight: RH_C_POSITION,
    rh: `E4 D4 C4 D4  E4 E4 E4:2  D4 D4 D4:2  E4 G4 G4:2
         E4 D4 C4 D4  E4 E4 E4 E4  D4 D4 E4 D4  C4:4`,
    lh: `C3:4  C3:4  G2:4  C3:4  C3:4  C3:4  G2:4  C3:4`,
  },
  {
    id: 'kia-con-buom-vang',
    title: 'Kìa con bướm vàng',
    artist: 'Dân ca (Frère Jacques)',
    level: 1,
    genre: 'ĐỒNG DAO',
    bpm: 104,
    timeSignature: [4, 4],
    note: 'Mỗi câu hát lặp lại hai lần — bé dễ nhớ.',
    rh: `C4 D4 E4 C4  C4 D4 E4 C4  E4 F4 G4:2  E4 F4 G4:2
         G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4  G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4
         C4 G3 C4:2  C4 G3 C4:2`,
    lh: `C3:4  C3:4  C3:2 G2:2  C3:2 G2:2  C3:4  C3:4  C3:2 G2:2  C3:4`,
  },
  {
    id: 'khuc-hoan-ca',
    title: 'Khúc hoan ca (Ode to Joy)',
    artist: 'L. van Beethoven',
    level: 2,
    genre: 'CỔ ĐIỂN',
    bpm: 100,
    timeSignature: [4, 4],
    note: 'Chú ý ô nhịp 4 và 8: nốt đen chấm dôi rồi nốt móc đơn.',
    fingersRight: RH_C_POSITION,
    rh: `E4 E4 F4 G4  G4 F4 E4 D4  C4 C4 D4 E4  E4:1.5 D4:0.5 D4:2
         E4 E4 F4 G4  G4 F4 E4 D4  C4 C4 D4 E4  D4:1.5 C4:0.5 C4:2`,
    lh: `C3:4  C3:2 G2:2  C3:2 G2:2  G2:4
         C3:4  C3:2 G2:2  C3:2 G2:2  G2:2 C3:2`,
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells (điệp khúc)',
    artist: 'J. Pierpont',
    level: 2,
    genre: 'LỄ HỘI',
    bpm: 120,
    timeSignature: [4, 4],
    rh: `E4 E4 E4:2  E4 E4 E4:2  E4 G4 C4 D4  E4:4
         F4 F4 F4 F4  F4 E4 E4 E4:0.5 E4:0.5  E4 D4 D4 E4  D4:2 G4:2`,
    lh: `C3:4  C3:4  C3:4  C3:4  F3:4  C3:4  G2:4  G2:2 C3:2`,
  },
  {
    id: 'chuc-mung-sinh-nhat',
    title: 'Chúc mừng sinh nhật',
    artist: 'Dân ca',
    level: 2,
    genre: 'LỄ HỘI',
    bpm: 100,
    timeSignature: [3, 4],
    pickup: 1,
    note: 'Bài nhịp 3/4, bắt đầu bằng ô nhịp lấy đà (hai nốt móc đơn).',
    rh: `G4:0.5 G4:0.5
         A4 G4 C5  B4:2 G4:0.5 G4:0.5
         A4 G4 D5  C5:2 G4:0.5 G4:0.5
         G5 E5 C5  B4 A4 F5:0.5 F5:0.5
         E5 C5 D5  C5:3`,
    lh: `r:1
         C3:3  G2:3  G2:3  C3:3  C3:3  G2:3  C3:1.5 G2:1.5  C3:3`,
  },
  {
    id: 'fur-elise',
    title: 'Für Elise (đoạn mở đầu)',
    artist: 'L. van Beethoven',
    level: 4,
    genre: 'CỔ ĐIỂN',
    bpm: 60,
    timeSignature: [3, 8],
    pickup: 0.5,
    note: 'Nhịp 3/8. Tập thật chậm (40–60%) rồi mới tăng dần.',
    rh: `E5:0.25 D#5:0.25
         E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
         A4:0.5 r:0.25 C4:0.25 E4:0.25 A4:0.25
         B4:0.5 r:0.25 E4:0.25 G#4:0.25 B4:0.25
         C5:0.5 r:0.25 E4:0.25 E5:0.25 D#5:0.25
         E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
         A4:0.5 r:0.25 C4:0.25 E4:0.25 A4:0.25
         B4:0.5 r:0.25 E4:0.25 C5:0.25 B4:0.25
         A4:0.5 r:1`,
    lh: `r:0.5
         r:1.5
         A2:0.5 E3:0.5 A3:0.5
         E2:0.5 E3:0.5 G#3:0.5
         A2:0.5 E3:0.5 A3:0.5
         r:1.5
         A2:0.5 E3:0.5 A3:0.5
         E2:0.5 E3:0.5 G#3:0.5
         A2:0.5 r:1`,
  },
  {
    id: 'thang-am-do-truong',
    title: 'Gam Đô trưởng (luyện ngón)',
    artist: 'Bài luyện tập',
    level: 1,
    genre: 'LUYỆN NGÓN',
    bpm: 80,
    timeSignature: [4, 4],
    note: 'Đi lên rồi đi xuống. Tay phải 1-2-3-1-2-3-4-5, tay trái 5-4-3-2-1-3-2-1.',
    fingersRight: { 60: 1, 62: 2, 64: 3, 65: 1, 67: 2, 69: 3, 71: 4, 72: 5 },
    fingersLeft: { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1, 57: 3, 59: 2, 60: 1 },
    rh: `C4 D4 E4 F4  G4 A4 B4 C5  C5 B4 A4 G4  F4 E4 D4 C4`,
    lh: `C3 D3 E3 F3  G3 A3 B3 C4  C4 B3 A3 G3  F3 E3 D3 C3`,
  },
]

mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.json')) unlinkSync(join(OUT, f))
}

const index = []
for (const spec of SPECS) {
  const song = makeSong(spec)
  const file = `${song.id}.json`
  writeFileSync(join(OUT, file), JSON.stringify(song, null, 1) + '\n', 'utf8')
  // Do dai bai: cac bai o day khong doi tempo giua chung nen phach/bpm la chinh xac.
  const beats = song.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)
  const seconds = Math.round((beats / song.bpm) * 60)
  index.push({ id: song.id, title: song.title, artist: song.artist, level: song.level, genre: song.genre, seconds, file })
  console.log(`✓ ${file.padEnd(30)} ${String(song.notes.length).padStart(4)} nốt  ${beats} phách  ${song.measures.length - 1} ô nhịp`)
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')
console.log(`\nĐã ghi ${index.length} bài vào public/songs/`)

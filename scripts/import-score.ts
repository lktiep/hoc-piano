#!/usr/bin/env tsx
/**
 * Nap mot ban nhac (.musicxml / .mxl / .mid / .json) vao kho bai cua trang.
 *
 *   npm run import -- duong/dan/ban-nhac.mxl --title "Ten bai" --level 2 \
 *       --source "https://musescore.com/user/.../scores/..."
 *
 * Ket qua: public/songs/<id>.json  +  cap nhat public/songs/index.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { parseMusicXml, slugify } from '../src/music/musicxml'
import { extractMxl, validateSong } from '../src/music/importSong'
import { midiToSong, parseMidiFile } from '../src/music/midiFile'
import { Timeline } from '../src/engine/timeline'
import type { Song, SongIndexEntry } from '../src/types'
import type { XEl } from '../src/music/xmlutil'

interface Args {
  file?: string
  id?: string
  title?: string
  artist?: string
  source?: string
  level?: number
  genre?: string
  noRepeats?: boolean
  dry?: boolean
}

function parseArgs(argv: string[]): Args {
  const a: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]
    switch (v) {
      case '--id':
        a.id = argv[++i]
        break
      case '--title':
        a.title = argv[++i]
        break
      case '--artist':
        a.artist = argv[++i]
        break
      case '--source':
        a.source = argv[++i]
        break
      case '--level':
        a.level = parseInt(argv[++i], 10)
        break
      case '--genre':
        a.genre = argv[++i]
        break
      case '--no-repeats':
        a.noRepeats = true
        break
      case '--dry':
        a.dry = true
        break
      default:
        if (!v.startsWith('-') && !a.file) a.file = v
    }
  }
  return a
}

const args = parseArgs(process.argv.slice(2))
if (!args.file) {
  console.error(`Cach dung:
  npm run import -- <tep.musicxml|.mxl|.mid|.json> [tuy chon]

Tuy chon:
  --title "Ten bai"     dat lai ten bai
  --artist "Tac gia"
  --id ten-file         ma bai (mac dinh: sinh tu ten bai)
  --source <url>        link MuseScore goc, luu lai de tra cuu
  --level 1..5          do kho, hien trong danh sach chon bai
  --genre "CỔ ĐIỂN"     the loai, dung de loc trong thu vien
  --no-repeats          KHONG trai dau nhac lai
  --dry                 chi in ket qua, khong ghi tep`)
  process.exit(1)
}

if (!existsSync(args.file)) {
  console.error(`Khong tim thay tep: ${args.file}`)
  process.exit(1)
}

const ext = extname(args.file).toLowerCase()
const fallbackTitle = args.title || basename(args.file, ext)
const buf = readFileSync(args.file)

function parseXml(xml: string): XEl {
  return new DOMParser().parseFromString(xml, 'text/xml') as unknown as XEl
}

let song: Song
let warnings: { message: string }[] = []

if (ext === '.json') {
  song = validateSong(JSON.parse(buf.toString('utf8')))
} else if (ext === '.mid' || ext === '.midi') {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  const res = midiToSong(parseMidiFile(ab), { title: fallbackTitle, source: args.source })
  song = res.song
  warnings = res.warnings
} else {
  const xml = ext === '.mxl' ? extractMxl(new Uint8Array(buf)) : buf.toString('utf8')
  const res = parseMusicXml(parseXml(xml), {
    title: args.title,
    source: args.source,
    expandRepeats: !args.noRepeats,
  })
  song = res.song
  warnings = res.warnings
}

if (args.title) song.title = args.title
if (args.artist) song.artist = args.artist
if (args.source) song.source = args.source
if (args.level) song.level = args.level
if (args.genre) song.genre = args.genre
song.id = args.id || song.id || slugify(song.title)

const beats = song.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)
const measures = song.measures ? song.measures.length - 1 : 0
console.log(`\n${song.title}${song.artist ? ` — ${song.artist}` : ''}`)
console.log(`  ma bai      : ${song.id}`)
console.log(`  not         : ${song.notes.length} (phai ${song.notes.filter((n) => n.h === 'R').length}, trai ${song.notes.filter((n) => n.h === 'L').length})`)
console.log(`  nhip        : ${song.timeSignature[0]}/${song.timeSignature[1]}  ${song.bpm} bpm`)
console.log(`  do dai      : ${measures} o nhip (${beats} phach)`)
console.log(`  cao do      : ${Math.min(...song.notes.map((n) => n.m))} .. ${Math.max(...song.notes.map((n) => n.m))}`)
if (song.notes.some((n) => n.f)) console.log(`  so ngon tay : co`)
for (const w of warnings) console.log(`  ! ${w.message}`)

if (args.dry) {
  console.log('\n(--dry: khong ghi tep)')
  process.exit(0)
}

const dir = join(process.cwd(), 'public', 'songs')
const file = `${song.id}.json`
writeFileSync(join(dir, file), JSON.stringify(song, null, 1) + '\n', 'utf8')

const indexPath = join(dir, 'index.json')
const index: SongIndexEntry[] = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : []
const entry: SongIndexEntry = {
  id: song.id,
  title: song.title,
  artist: song.artist,
  level: song.level,
  genre: song.genre,
  seconds: Math.round(new Timeline(song).beatToSec(beats)),
  file,
}
const at = index.findIndex((e) => e.id === song.id)
if (at >= 0) index[at] = entry
else index.push(entry)
index.sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || a.title.localeCompare(b.title, 'vi'))
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8')

console.log(`\nDa ghi public/songs/${file} va cap nhat index.json`)

/** Nhan tep nguoi dung tha vao -> tra ve Song. Ho tro .musicxml .xml .mxl .mid .midi .json */

import { unzipSync, strFromU8 } from 'fflate'
import type { Song } from '../types'
import { parseMusicXml, slugify } from './musicxml'
import { midiToSong, parseMidiFile } from './midiFile'
import type { XEl } from './xmlutil'

export interface ImportResult {
  song: Song
  warnings: { message: string }[]
}

export interface ImportOptions {
  id?: string
  title?: string
  source?: string
  expandRepeats?: boolean
}

function parseXmlString(xml: string): XEl {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')
  if (err.length > 0) throw new Error('Tep XML bi loi dinh dang, khong doc duoc.')
  return doc as unknown as XEl
}

/** Rut tep MusicXML chinh ra khoi goi .mxl (that ra la mot tep zip). */
export function extractMxl(data: Uint8Array): string {
  const files = unzipSync(data)
  const container = files['META-INF/container.xml']
  if (container) {
    const xml = strFromU8(container)
    const m = xml.match(/full-path\s*=\s*"([^"]+)"/)
    if (m && files[m[1]]) return strFromU8(files[m[1]])
  }
  const name = Object.keys(files).find((n) => !n.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(n))
  if (!name) throw new Error('Goi .mxl khong chua tep MusicXML nao.')
  return strFromU8(files[name])
}

export function validateSong(raw: unknown): Song {
  const s = raw as Partial<Song>
  if (!s || typeof s !== 'object') throw new Error('Tep JSON khong hop le.')
  if (!Array.isArray(s.notes) || s.notes.length === 0) throw new Error('Tep JSON khong co danh sach not (notes).')
  for (const n of s.notes) {
    if (typeof n.t !== 'number' || typeof n.d !== 'number' || typeof n.m !== 'number') {
      throw new Error('Co not sai dinh dang: can co t (phach), d (truong do), m (cao do MIDI).')
    }
    if (n.h !== 'L' && n.h !== 'R') n.h = n.m >= 60 ? 'R' : 'L'
  }
  const title = typeof s.title === 'string' && s.title ? s.title : 'Bai khong ten'
  return {
    id: typeof s.id === 'string' && s.id ? s.id : slugify(title),
    title,
    artist: s.artist,
    source: s.source,
    bpm: typeof s.bpm === 'number' && s.bpm > 0 ? s.bpm : 100,
    timeSignature: Array.isArray(s.timeSignature) && s.timeSignature.length === 2 ? s.timeSignature : [4, 4],
    tempos: s.tempos,
    measures: s.measures,
    notes: s.notes,
    level: s.level,
    tags: s.tags,
    note: s.note,
  }
}

export async function importSongFile(file: File, opts: ImportOptions = {}): Promise<ImportResult> {
  const name = file.name
  const lower = name.toLowerCase()
  const baseTitle = opts.title || name.replace(/\.[^.]+$/, '')

  if (lower.endsWith('.json')) {
    const song = validateSong(JSON.parse(await file.text()))
    if (opts.source) song.source = opts.source
    return { song, warnings: [] }
  }

  if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
    const parsed = parseMidiFile(await file.arrayBuffer())
    return midiToSong(parsed, { id: opts.id, title: baseTitle, source: opts.source })
  }

  if (lower.endsWith('.mxl')) {
    const xml = extractMxl(new Uint8Array(await file.arrayBuffer()))
    return parseMusicXml(parseXmlString(xml), { ...opts, title: baseTitle })
  }

  if (lower.endsWith('.musicxml') || lower.endsWith('.xml')) {
    return parseMusicXml(parseXmlString(await file.text()), { ...opts, title: baseTitle })
  }

  // Khong ro duoi tep -> doan theo noi dung
  const buf = new Uint8Array(await file.arrayBuffer())
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const xml = extractMxl(buf)
    return parseMusicXml(parseXmlString(xml), { ...opts, title: baseTitle })
  }
  if (buf[0] === 0x4d && buf[1] === 0x54 && buf[2] === 0x68 && buf[3] === 0x64) {
    const parsed = parseMidiFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
    return midiToSong(parsed, { id: opts.id, title: baseTitle, source: opts.source })
  }
  throw new Error(`Chua ho tro tep "${name}". Hay dung .musicxml, .mxl, .mid hoac .json`)
}

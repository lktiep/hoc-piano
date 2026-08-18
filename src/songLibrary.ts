/** Nap danh sach bai hat co san + bai do phu huynh tu them (luu trong trinh duyet). */

import type { Song, SongIndexEntry } from './types'
import { validateSong } from './music/importSong'

const LOCAL_KEY = 'hoc-piano.songs.v1'

function assetUrl(path: string): string {
  return new URL(path, document.baseURI).href
}

export async function loadSongIndex(): Promise<SongIndexEntry[]> {
  const res = await fetch(assetUrl('songs/index.json'), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Khong doc duoc danh sach bai (HTTP ${res.status})`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('songs/index.json phai la mot mang')
  return data as SongIndexEntry[]
}

export async function loadSongFile(file: string): Promise<Song> {
  const res = await fetch(assetUrl(`songs/${file}`), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Khong doc duoc bai "${file}" (HTTP ${res.status})`)
  return validateSong(await res.json())
}

export function loadLocalSongs(): Song[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((s) => validateSong(s))
  } catch {
    return []
  }
}

export function saveLocalSong(song: Song): Song[] {
  const list = loadLocalSongs().filter((s) => s.id !== song.id)
  list.push(song)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  return list
}

export function deleteLocalSong(id: string): Song[] {
  const list = loadLocalSongs().filter((s) => s.id !== id)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  return list
}

export function downloadSongJson(song: Song) {
  const blob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${song.id}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

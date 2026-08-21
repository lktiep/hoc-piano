/**
 * Gop kho bai co san (public/songs/index.json) voi bai phu huynh tu them
 * (luu trong trinh duyet) thanh MOT danh sach de hai trang Thu vien va
 * Lo trinh cung dung.
 *
 * Khong bia them so lieu: do dai lay tu index.json, con bai tu them thi tinh
 * that tu so phach va tempo cua chinh bai do.
 */

import { Timeline } from './engine/timeline'
import type { Song, SongIndexEntry } from './types'

export interface CatalogItem {
  id: string
  title: string
  artist?: string
  genre?: string
  /** 1 = de nhat. Bai khong ghi thi coi la 1. */
  level: number
  /** do dai tinh bang giay, undefined neu khong biet */
  seconds?: number
  /** bai do phu huynh tu them, xoa duoc */
  local: boolean
  /** thu de mo bai: muc cua index, hoac ca bai neu la bai tu them */
  source: SongIndexEntry | Song
}

/** Ba muc cua lo trinh — dung y het trang chu. */
export type LevelGroup = 1 | 2 | 3

export function levelGroup(level: number): LevelGroup {
  if (level <= 1) return 1
  if (level <= 3) return 2
  return 3
}

export const LEVEL_NAMES: Record<LevelGroup, string> = {
  1: 'CƠ BẢN',
  2: 'TRUNG CẤP',
  3: 'NÂNG CAO',
}

export function songSeconds(song: Song): number {
  const beats = song.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0)
  return new Timeline(song).beatToSec(beats)
}

export function buildCatalog(index: SongIndexEntry[], localSongs: Song[]): CatalogItem[] {
  const items: CatalogItem[] = index.map((e) => ({
    id: e.id,
    title: e.title,
    artist: e.artist,
    genre: e.genre,
    level: e.level ?? 1,
    seconds: e.seconds,
    local: false,
    source: e,
  }))
  for (const s of localSongs) {
    // Bai tu them de len bai cung ma (phu huynh sua lai bai co san)
    const at = items.findIndex((i) => i.id === s.id)
    const item: CatalogItem = {
      id: s.id,
      title: s.title,
      artist: s.artist,
      genre: s.genre,
      level: s.level ?? 1,
      seconds: songSeconds(s),
      local: true,
      source: s,
    }
    if (at >= 0) items[at] = item
    else items.push(item)
  }
  return items
}

/** "2:14". Khong biet do dai thi tra ve "—". */
export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '—'
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Bo dau tieng Viet de go "bum" van ra "bướm". */
export function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

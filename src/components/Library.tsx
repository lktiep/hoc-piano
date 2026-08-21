/**
 * Thu vien — theo ban thiet ke "Thu Vien.dc.html".
 *
 * Bang o day la kho bai THAT: ten, tac gia, the loai va do dai deu doc tu
 * public/songs/index.json (va tu chinh bai neu la bai phu huynh tu them).
 * Bo loc the loai cung sinh tu du lieu, khong ghi cung san.
 */

import { useMemo, useState } from 'react'
import { SiteFoot, SiteNav } from './SiteNav'
import {
  buildCatalog,
  formatDuration,
  LEVEL_NAMES,
  levelGroup,
  stripAccents,
  type CatalogItem,
  type LevelGroup,
} from '../catalog'
import type { Route } from '../routes'
import type { Song, SongIndexEntry } from '../types'

const ALL = 'TẤT CẢ'
const LEVEL_FILTERS: { key: LevelGroup | null; label: string }[] = [
  { key: null, label: ALL },
  { key: 1, label: LEVEL_NAMES[1] },
  { key: 2, label: LEVEL_NAMES[2] },
  { key: 3, label: LEVEL_NAMES[3] },
]

interface LibraryProps {
  index: SongIndexEntry[]
  localSongs: Song[]
  /** ma cac bai be da choi tron ven */
  done: string[]
  go: (route: Route) => void
  onPick: (entry: SongIndexEntry | Song) => void
  onDeleteLocal: (id: string) => void
  onOpenImport: () => void
}

export function Library({ index, localSongs, done, go, onPick, onDeleteLocal, onOpenImport }: LibraryProps) {
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<LevelGroup | null>(null)
  const [genre, setGenre] = useState<string | null>(null)

  const all = useMemo(() => buildCatalog(index, localSongs), [index, localSongs])

  // The loai lay tu chinh kho bai, nen them bai moi la co ngay chip moi.
  const genres = useMemo(() => {
    const seen = new Set<string>()
    for (const it of all) if (it.genre) seen.add(it.genre)
    return [...seen].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [all])

  const rows = useMemo(() => {
    const needle = stripAccents(q.trim())
    return all.filter((it) => {
      if (level && levelGroup(it.level) !== level) return false
      if (genre && it.genre !== genre) return false
      if (!needle) return true
      return stripAccents(`${it.title} ${it.artist ?? ''}`).includes(needle)
    })
  }, [all, q, level, genre])

  const filtering = !!q.trim() || level !== null || genre !== null

  const open = (it: CatalogItem) => {
    onPick(it.source)
    go('player')
  }

  return (
    <div className="site library">
      <SiteNav current="library" go={go} onOpenImport={onOpenImport} />

      <div className="hm-head">
        <div>
          <span className="hm-kicker">THƯ VIỆN</span>
          <h1>Bản nhạc tương tác</h1>
        </div>
        <div className="hm-head-side">
          {all.length} BẢN NHẠC
          {done.length > 0 && ` · ĐÃ CHƠI XONG ${done.length}`}
        </div>
      </div>

      <div className="lb-filters">
        <input
          className="lb-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên bản nhạc hoặc tác giả…"
          aria-label="Tìm bản nhạc"
        />
        <div className="lb-seg" role="group" aria-label="Lọc theo trình độ">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.label}
              className={level === f.key ? 'is-on' : undefined}
              aria-pressed={level === f.key}
              onClick={() => setLevel(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="lb-chips" role="group" aria-label="Lọc theo thể loại">
          <button className={`lb-chip${genre === null ? ' is-on' : ''}`} onClick={() => setGenre(null)}>
            {ALL}
          </button>
          {genres.map((g) => (
            <button
              key={g}
              className={`lb-chip${genre === g ? ' is-on' : ''}`}
              aria-pressed={genre === g}
              onClick={() => setGenre(genre === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>
        {filtering && <span className="lb-filters-note">HIỆN {rows.length}</span>}
      </div>

      <div className="lb-table">
        <div className="lb-head">
          <span>#</span>
          <span>BẢN NHẠC</span>
          <span>TÁC GIẢ</span>
          <span>THỂ LOẠI</span>
          <span>TRÌNH ĐỘ</span>
          <span>DÀI</span>
          <span />
        </div>

        {rows.map((it, i) => {
          const g = levelGroup(it.level)
          return (
            <div
              key={it.id}
              className="lb-row"
              role="button"
              tabIndex={0}
              onClick={() => open(it)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  open(it)
                }
              }}
            >
              <span className="lb-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="lb-title">
                {done.includes(it.id) && (
                  <span className="lb-done" title="Bé đã chơi xong bài này">
                    ✓
                  </span>
                )}
                <span>{it.title}</span>
                {it.local && <span className="lb-mine">CỦA BÉ</span>}
              </span>
              <span className="lb-artist">{it.artist ?? '—'}</span>
              <span className="lb-genre">{it.genre ?? '—'}</span>
              <span className={`lb-tag lv${g}`}>{LEVEL_NAMES[g]}</span>
              <span className="lb-len">{formatDuration(it.seconds)}</span>
              <span className="lb-actions">
                <button className="lb-go" tabIndex={-1}>
                  LUYỆN →
                </button>
                {it.local && (
                  <button
                    className="lb-del"
                    title={`Xoá "${it.title}"`}
                    aria-label={`Xoá ${it.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Xoá "${it.title}" khỏi máy này?`)) onDeleteLocal(it.id)
                    }}
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
          )
        })}

        {rows.length === 0 && (
          <div className="lb-empty">
            <h3>Không tìm thấy bản nhạc nào.</h3>
            <p>
              {all.length === 0
                ? 'Kho bài đang trống — thêm một bản nhạc để bắt đầu.'
                : 'Thử từ khoá khác hoặc bỏ bớt bộ lọc.'}
            </p>
            {filtering ? (
              <button
                className="hm-btn-ghost"
                onClick={() => {
                  setQ('')
                  setLevel(null)
                  setGenre(null)
                }}
              >
                BỎ BỘ LỌC
              </button>
            ) : (
              <button className="hm-btn-ghost" onClick={onOpenImport}>
                THÊM BÀI CỦA BÉ
              </button>
            )}
          </div>
        )}
      </div>

      <SiteFoot go={go} />
    </div>
  )
}

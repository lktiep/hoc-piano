import { useMemo, useState } from 'react'
import type { Song, SongIndexEntry } from '../types'
import { Modal } from './Modal'
import { downloadSongJson } from '../songLibrary'
import { normalizeVi } from '../util/text'

export interface SongPickerProps {
  index: SongIndexEntry[]
  localSongs: Song[]
  currentId: string | null
  onPick: (s: SongIndexEntry | Song) => void
  onDeleteLocal: (id: string) => void
  onOpenImport: () => void
  onClose: () => void
}

const LEVEL_TEXT = ['', 'Rất dễ', 'Dễ', 'Vừa', 'Khó', 'Rất khó']

export function SongPicker({ index, localSongs, currentId, onPick, onDeleteLocal, onOpenImport, onClose }: SongPickerProps) {
  const [q, setQ] = useState('')

  const filter = useMemo(() => normalizeVi(q.trim()), [q])
  const matches = (title: string, artist?: string) => !filter || normalizeVi(`${title} ${artist ?? ''}`).includes(filter)

  const builtIn = index.filter((e) => matches(e.title, e.artist))
  const mine = localSongs.filter((s) => matches(s.title, s.artist))

  return (
    <Modal title="Chọn bài" onClose={onClose} wide>
      <input className="search" placeholder="Tìm bài…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />

      <h3 className="list-head">Bài có sẵn</h3>
      <ul className="song-list">
        {builtIn.map((e) => (
          <li key={e.id}>
            <button className={`song-item ${currentId === e.id ? 'is-on' : ''}`} onClick={() => onPick(e)}>
              <span className="song-item-title">{e.title}</span>
              <span className="song-item-meta">
                {e.artist ? `${e.artist} · ` : ''}
                {LEVEL_TEXT[e.level ?? 0] || ''}
              </span>
            </button>
          </li>
        ))}
        {builtIn.length === 0 && <li className="empty">Không tìm thấy bài nào.</li>}
      </ul>

      <h3 className="list-head">
        Bài mình thêm{' '}
        <button className="btn btn-sm" onClick={onOpenImport}>
          ＋ Thêm bài
        </button>
      </h3>
      <ul className="song-list">
        {mine.map((s) => (
          <li key={s.id} className="song-row">
            <button className={`song-item ${currentId === s.id ? 'is-on' : ''}`} onClick={() => onPick(s)}>
              <span className="song-item-title">{s.title}</span>
              <span className="song-item-meta">
                {s.artist ? `${s.artist} · ` : ''}
                {s.notes.length} nốt
              </span>
            </button>
            <button className="btn btn-sm" title="Tải file JSON để đưa vào kho bài" onClick={() => downloadSongJson(s)}>
              ⭳
            </button>
            <button
              className="btn btn-sm btn-danger"
              title="Xoá khỏi máy"
              onClick={() => {
                if (confirm(`Xoá bài "${s.title}"?`)) onDeleteLocal(s.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
        {mine.length === 0 && <li className="empty">Chưa có bài nào. Bấm “Thêm bài” để nạp từ MuseScore.</li>}
      </ul>
    </Modal>
  )
}

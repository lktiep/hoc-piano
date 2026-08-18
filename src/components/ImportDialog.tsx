import { useRef, useState } from 'react'
import { Modal } from './Modal'
import { importSongFile } from '../music/importSong'
import { downloadSongJson } from '../songLibrary'
import type { Song } from '../types'

export interface ImportDialogProps {
  onClose: () => void
  onImported: (song: Song) => void
}

export function ImportDialog({ onClose, onImported }: ImportDialogProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [preview, setPreview] = useState<Song | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [expandRepeats, setExpandRepeats] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setWarnings([])
    setPreview(null)
    try {
      const res = await importSongFile(file, { source: sourceUrl.trim() || undefined, expandRepeats })
      setPreview(res.song)
      setWarnings(res.warnings.map((w) => w.message))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const stats = preview
    ? {
        notes: preview.notes.length,
        right: preview.notes.filter((n) => n.h === 'R').length,
        left: preview.notes.filter((n) => n.h === 'L').length,
        beats: preview.notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0),
      }
    : null

  return (
    <Modal title="Thêm bài từ MuseScore" onClose={onClose} wide>
      <ol className="steps">
        <li>
          Mở bản nhạc trên MuseScore, tải về dạng <b>MusicXML</b> (.mxl / .musicxml) hoặc <b>MIDI</b> (.mid). Nếu bản nhạc không cho tải, mở
          nó bằng phần mềm <b>MuseScore Studio</b> rồi chọn <i>Tệp → Xuất → MusicXML</i>.
        </li>
        <li>Kéo thả tệp vào ô bên dưới (hoặc bấm để chọn tệp).</li>
        <li>
          Bấm <b>Thêm vào danh sách</b> — bài sẽ lưu trong trình duyệt này và chơi được ngay.
        </li>
      </ol>

      <label className="field">
        <span>Link MuseScore (không bắt buộc, chỉ để ghi nhớ nguồn)</span>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://musescore.com/..." />
      </label>

      <label className="checkline">
        <input type="checkbox" checked={expandRepeats} onChange={(e) => setExpandRepeats(e.target.checked)} /> Trải dấu nhắc lại thành đầy
        đủ ô nhịp
      </label>

      <div
        className={`dropzone ${dragOver ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) void handleFile(f)
        }}
        onClick={() => fileRef.current?.click()}
      >
        <b>Kéo thả tệp vào đây</b>
        <span>.mxl · .musicxml · .xml · .mid · .json</span>
        <input
          ref={fileRef}
          type="file"
          accept=".mxl,.musicxml,.xml,.mid,.midi,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {warnings.length > 0 && (
        <div className="banner banner-warn">
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {preview && stats && (
        <div className="preview">
          <label className="field">
            <span>Tên bài</span>
            <input value={preview.title} onChange={(e) => setPreview({ ...preview, title: e.target.value })} />
          </label>
          <div className="preview-stats">
            <span>
              <b>{stats.notes}</b> nốt
            </span>
            <span>
              tay phải <b>{stats.right}</b>
            </span>
            <span>
              tay trái <b>{stats.left}</b>
            </span>
            <span>
              nhịp <b>{preview.timeSignature[0]}/{preview.timeSignature[1]}</b>
            </span>
            <span>
              <b>{Math.round(preview.bpm)}</b> bpm
            </span>
            <span>
              <b>{Math.round(stats.beats / (((preview.timeSignature[0] * 4) / preview.timeSignature[1]) || 4))}</b> ô nhịp
            </span>
          </div>
          <div className="preview-actions">
            <button className="btn btn-primary" onClick={() => onImported(preview)}>
              Thêm vào danh sách và chơi
            </button>
            <button className="btn" onClick={() => downloadSongJson(preview)} title="Lưu file JSON để đưa vào thư mục public/songs">
              ⭳ Tải JSON
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

import { useRef, useState } from 'react'
import type { Player } from '../engine/player'
import type { HandChoice, LabelStyle, PlayMode, Settings, Song } from '../types'
import type { MidiStatus } from '../input/webmidi'

export interface ControlsProps {
  song: Song | null
  player: Player
  settings: Settings
  setSettings: (fn: (s: Settings) => Settings) => void
  totalMeasures: number
  midiStatus: MidiStatus
  onConnectMidi: () => void
  onOpenPicker: () => void
  onOpenImport: () => void
  onOpenHelp: () => void
  wideKeyboard: boolean
  setWideKeyboard: (v: boolean) => void
  onChanged: () => void
}

const MODES: { value: PlayMode; label: string; hint: string }[] = [
  { value: 'wait', label: 'Chờ bé bấm', hint: 'Nhạc dừng lại tới khi bé bấm đúng phím' },
  { value: 'listen', label: 'Nghe mẫu', hint: 'Máy đàn cho bé nghe trước' },
  { value: 'follow', label: 'Theo nhịp', hint: 'Nhạc chạy đều, chấm điểm bé bấm đúng hay sai' },
]

const HANDS: { value: HandChoice; label: string }[] = [
  { value: 'right', label: 'Tay phải' },
  { value: 'left', label: 'Tay trái' },
  { value: 'both', label: 'Hai tay' },
]

const LABELS: { value: LabelStyle; label: string }[] = [
  { value: 'solfege', label: 'Đô Rê Mi' },
  { value: 'letters', label: 'C D E' },
  { value: 'off', label: 'Ẩn' },
]

export function Controls(props: ControlsProps) {
  const { song, player, settings, setSettings, totalMeasures, midiStatus, onChanged } = props
  const [openPanel, setOpenPanel] = useState(false)
  const wasPlaying = useRef(false)

  const measure = player.currentMeasure()
  const acc = player.accuracy()
  const bpm = song ? Math.round(song.bpm * settings.rate) : 0

  const patch = (p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }))
    onChanged()
  }

  return (
    <header className="topbar">
      <div className="topbar-main">
        <button className="song-btn" onClick={props.onOpenPicker} title="Chọn bài khác">
          <span className="song-title">{song ? song.title : 'Chọn bài…'}</span>
          <span className="song-sub">{song?.artist ? song.artist : 'Bấm để đổi bài'}</span>
        </button>

        <div className="transport">
          <button
            className="btn btn-round"
            title="Về đầu bài"
            onClick={() => {
              player.reset()
              onChanged()
            }}
          >
            ⟲
          </button>
          <button
            className={`btn btn-play ${player.playing ? 'is-playing' : ''}`}
            onClick={() => {
              player.toggle()
              onChanged()
            }}
          >
            {player.playing ? '⏸' : '▶'}
            <span className="btn-play-text">{player.playing ? 'Dừng' : 'Chơi'}</span>
          </button>
        </div>

        <div className="progress">
          <input
            type="range"
            min={1}
            max={Math.max(1, totalMeasures)}
            step={1}
            value={Math.min(measure, Math.max(1, totalMeasures))}
            onPointerDown={() => {
              wasPlaying.current = player.playing
              player.pause()
            }}
            onPointerUp={() => {
              if (wasPlaying.current) player.play()
              onChanged()
            }}
            onChange={(e) => {
              player.seekMeasure(Number(e.target.value))
              onChanged()
            }}
            aria-label="Vị trí trong bài"
          />
          <div className="progress-label">
            Ô nhịp <b>{Math.min(measure, Math.max(1, totalMeasures))}</b>/{totalMeasures}
            {settings.loop && (
              <span className="chip chip-loop">
                lặp {settings.loop[0]}–{settings.loop[1]}
              </span>
            )}
          </div>
        </div>

        <div className="score">
          {acc != null && <span className={`chip ${acc >= 0.9 ? 'chip-good' : ''}`}>Đúng {Math.round(acc * 100)}%</span>}
          {player.stats.wrong > 0 && <span className="chip chip-bad">Sai {player.stats.wrong}</span>}
        </div>

        <div className="topbar-actions">
          <button className={`btn ${openPanel ? 'is-on' : ''}`} onClick={() => setOpenPanel((v) => !v)}>
            ⚙ Cài đặt
          </button>
          <button className="btn" onClick={props.onOpenHelp} title="Hướng dẫn">
            ?
          </button>
        </div>
      </div>

      <div className="quickbar">
        <div className="seg">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`seg-btn ${settings.mode === m.value ? 'is-on' : ''}`}
              title={m.hint}
              onClick={() => patch({ mode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="seg">
          {HANDS.map((hnd) => (
            <button
              key={hnd.value}
              className={`seg-btn ${settings.hands === hnd.value ? 'is-on' : ''}`}
              onClick={() => patch({ hands: hnd.value })}
            >
              {hnd.label}
            </button>
          ))}
        </div>

        <div className="tempo">
          <button className="btn btn-sm" onClick={() => patch({ rate: Math.max(0.25, Math.round((settings.rate - 0.05) * 100) / 100) })}>
            −
          </button>
          <div className="tempo-readout">
            <b>{Math.round(settings.rate * 100)}%</b>
            <span>{bpm > 0 ? `${bpm} bpm` : 'tốc độ'}</span>
          </div>
          <button className="btn btn-sm" onClick={() => patch({ rate: Math.min(1.5, Math.round((settings.rate + 0.05) * 100) / 100) })}>
            +
          </button>
        </div>

        <span className={`midi-chip ${midiStatus.connected ? 'is-on' : ''}`} title={midiStatus.error ?? midiStatus.devices.join(', ')}>
          {midiStatus.connected ? `🎹 ${midiStatus.devices[0] ?? 'Đàn đã nối'}` : '🎹 Chưa nối đàn'}
        </span>
        {!midiStatus.connected && (
          <button className="btn btn-sm" onClick={props.onConnectMidi}>
            Kết nối đàn
          </button>
        )}
      </div>

      {openPanel && (
        <div className="panel">
          <div className="panel-row">
            <label className="panel-label">Tên nốt trên phím</label>
            <div className="seg">
              {LABELS.map((l) => (
                <button key={l.value} className={`seg-btn ${settings.labels === l.value ? 'is-on' : ''}`} onClick={() => patch({ labels: l.value })}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-row">
            <label className="panel-label">Tốc độ nốt rơi</label>
            <input
              type="range"
              min={4}
              max={16}
              step={1}
              value={settings.lookaheadBeats}
              onChange={(e) => patch({ lookaheadBeats: Number(e.target.value) })}
            />
            <span className="panel-value">{settings.lookaheadBeats} phách</span>
          </div>

          <div className="panel-row panel-toggles">
            <label>
              <input type="checkbox" checked={settings.metronome} onChange={(e) => patch({ metronome: e.target.checked })} /> Gõ nhịp
            </label>
            <label>
              <input type="checkbox" checked={settings.countIn} onChange={(e) => patch({ countIn: e.target.checked })} /> Đếm vào 1 ô nhịp
            </label>
            <label>
              <input type="checkbox" checked={settings.showFingers} onChange={(e) => patch({ showFingers: e.target.checked })} /> Số ngón tay
            </label>
            <label>
              <input type="checkbox" checked={settings.guideSound} onChange={(e) => patch({ guideSound: e.target.checked })} /> Phát tiếng mẫu phần bé đánh
            </label>
            <label>
              <input type="checkbox" checked={props.wideKeyboard} onChange={(e) => props.setWideKeyboard(e.target.checked)} /> Bàn phím rộng (5 quãng tám)
            </label>
          </div>

          <div className="panel-row">
            <label className="panel-label">Lặp đoạn</label>
            {settings.loop ? (
              <>
                <span className="panel-value">
                  ô nhịp {settings.loop[0]} → {settings.loop[1]}
                </span>
                <button className="btn btn-sm" onClick={() => patch({ loop: null })}>
                  Tắt lặp
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const a = player.currentMeasure()
                    patch({ loop: [a, Math.min(totalMeasures, a + 3)] })
                  }}
                >
                  Lặp 4 ô từ đây
                </button>
                <button className="btn btn-sm" onClick={() => patch({ loop: [1, totalMeasures] })}>
                  Lặp cả bài
                </button>
              </>
            )}
          </div>

          <div className="panel-row">
            <button className="btn" onClick={props.onOpenImport}>
              ＋ Thêm bài từ MuseScore
            </button>
            {song?.source && (
              <a className="btn btn-link" href={song.source} target="_blank" rel="noreferrer">
                Xem bản gốc
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

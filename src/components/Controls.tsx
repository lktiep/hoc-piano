/**
 * Thanh dieu khien phong luyen — theo ban thiet ke "Piano Player.dc.html".
 *
 * Ba tang, tang nao ra viec do:
 *   1. thanh dieu huong chung (SiteNav) — doi trang, noi dan, cai dat, tro giup
 *   2. hang ten bai — bam vao la doi bai
 *   3. thanh cong cu — choi/dung, che do, tay, nhip do, dich giong, cach nhin
 * roi den thanh tien do theo o nhip.
 */

import { useRef, useState } from 'react'
import { SiteNav } from './SiteNav'
import type { Player } from '../engine/player'
import type { Route } from '../routes'
import type { HandChoice, LabelStyle, PlayMode, Settings, Song, StageView } from '../types'
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
  go: (route: Route) => void
  wideKeyboard: boolean
  setWideKeyboard: (v: boolean) => void
  onChanged: () => void
}

const MODES: { value: PlayMode; label: string; hint: string }[] = [
  { value: 'wait', label: 'CHỜ BÉ BẤM', hint: 'Nhạc dừng lại tới khi bé bấm đúng phím' },
  { value: 'listen', label: 'NGHE MẪU', hint: 'Máy đàn cho bé nghe trước' },
  { value: 'follow', label: 'THEO NHỊP', hint: 'Nhạc chạy đều, chấm điểm bé bấm đúng hay sai' },
]

const HANDS: { value: HandChoice; label: string }[] = [
  { value: 'right', label: 'TAY PHẢI' },
  { value: 'left', label: 'TAY TRÁI' },
  { value: 'both', label: 'HAI TAY' },
]

const VIEWS: { value: StageView; label: string; hint: string }[] = [
  { value: 'sheet', label: 'BẢN NHẠC', hint: 'Nhìn khuông nhạc như sách học đàn' },
  { value: 'fall', label: 'NỐT RƠI', hint: 'Nốt rơi thẳng xuống đúng cột phím' },
]

const LABELS: { value: LabelStyle; label: string }[] = [
  { value: 'solfege', label: 'ĐÔ RÊ MI' },
  { value: 'letters', label: 'C D E' },
  { value: 'off', label: 'ẨN' },
]

/** 92 giay -> "1:32". Dung cho ca thoi diem hien tai lan tong do dai. */
function clock(sec: number): string {
  const t = Math.max(0, Math.round(sec))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** Dich giong hien ra cho de hieu: "+2 nửa cung" hay "Giọng gốc". */
function transposeLabel(n: number): string {
  if (n === 0) return 'GỐC'
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`
}

export function Controls(props: ControlsProps) {
  const { song, player, settings, setSettings, totalMeasures, midiStatus, onChanged } = props
  const [openPanel, setOpenPanel] = useState(false)
  const wasPlaying = useRef(false)

  const measure = player.currentMeasure()
  const acc = player.accuracy()
  const bpm = song ? Math.round(song.bpm * settings.rate) : 0
  const tl = player.timeline
  const at = tl ? tl.beatToSec(player.posBeat) / Math.max(0.01, settings.rate) : 0
  const total = tl ? tl.beatToSec(tl.totalBeats) / Math.max(0.01, settings.rate) : 0

  const patch = (p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }))
    onChanged()
  }

  /** Vong qua ba kieu ten not bang mot nut duy nhat, cho thanh cong cu do chat. */
  const cycleLabels = () => {
    const i = LABELS.findIndex((l) => l.value === settings.labels)
    patch({ labels: LABELS[(i + 1) % LABELS.length].value })
  }

  const toggleLoop = () => {
    if (settings.loop) patch({ loop: null })
    else patch({ loop: [measure, Math.min(totalMeasures, measure + 3)] })
  }

  const toggleFullscreen = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element }
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <header className="topbar">
      <SiteNav
        current="player"
        go={props.go}
        right={
          <>
            <button
              className={`midi-chip ${midiStatus.connected ? 'is-on' : ''}`}
              title={midiStatus.error ?? midiStatus.devices.join(', ')}
              onClick={props.onConnectMidi}
            >
              {midiStatus.connected ? `🎹 ${midiStatus.devices[0] ?? 'ĐÀN ĐÃ NỐI'}` : '🎹 NỐI ĐÀN'}
            </button>
            <button className={`btn ${openPanel ? 'is-on' : ''}`} onClick={() => setOpenPanel((v) => !v)}>
              ⚙ CÀI ĐẶT
            </button>
            <button className="btn btn-icon" onClick={props.onOpenHelp} title="Hướng dẫn">
              ?
            </button>
          </>
        }
      />

      <div className="pl-info">
        <span className="hm-kicker">ĐANG TẬP</span>
        <button className="song-btn" onClick={props.onOpenPicker} title="Chọn bài khác">
          <span className="song-title">{song ? song.title : 'Chọn bài…'}</span>
          <span className="song-sub">{song?.artist ? song.artist : 'Bấm để đổi bài'}</span>
        </button>
        <div className="pl-tags">
          {song && (
            <span className="pl-tag">
              {song.timeSignature[0]}/{song.timeSignature[1]}
            </span>
          )}
          {bpm > 0 && <span className="pl-tag">{bpm} BPM</span>}
          {song?.genre && <span className="pl-tag">{song.genre}</span>}
          {acc != null && <span className={`chip ${acc >= 0.9 ? 'chip-good' : ''}`}>ĐÚNG {Math.round(acc * 100)}%</span>}
          {player.stats.wrong > 0 && <span className="chip chip-bad">SAI {player.stats.wrong}</span>}
        </div>
      </div>

      <div className="pl-bar">
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
          className={`btn-play ${player.playing ? 'is-playing' : ''}`}
          onClick={() => {
            player.toggle()
            onChanged()
          }}
        >
          {player.playing ? '⏸' : '▶'}
          <span className="btn-play-text">{player.playing ? 'Dừng' : 'Chơi'}</span>
        </button>

        <div className="pl-time">
          {clock(at)}
          <i>/</i>
          <span>{clock(total)}</span>
        </div>

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

        <div className="pl-step">
          <span className="pl-step-label">NHỊP</span>
          <button
            title="Chậm lại"
            onClick={() => patch({ rate: Math.max(0.25, Math.round((settings.rate - 0.05) * 100) / 100) })}
          >
            −
          </button>
          <b>{Math.round(settings.rate * 100)}%</b>
          <button
            title="Nhanh lên"
            onClick={() => patch({ rate: Math.min(1.5, Math.round((settings.rate + 0.05) * 100) / 100) })}
          >
            ＋
          </button>
        </div>

        <div className="pl-step">
          <span className="pl-step-label">DỊCH GIỌNG</span>
          <button title="Thấp xuống nửa cung" onClick={() => patch({ transpose: Math.max(-12, settings.transpose - 1) })}>
            −
          </button>
          <b>{transposeLabel(settings.transpose)}</b>
          <button title="Cao lên nửa cung" onClick={() => patch({ transpose: Math.min(12, settings.transpose + 1) })}>
            ＋
          </button>
        </div>

        <div className="seg">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              className={`seg-btn ${settings.view === v.value ? 'is-on' : ''}`}
              title={v.hint}
              onClick={() => patch({ view: v.value })}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="pl-bar-right">
          <span className="pl-hint">PHÍM CÁCH = PHÁT / DỪNG</span>
          <button
            className={`btn btn-icon ${settings.labels !== 'off' ? 'is-on' : ''}`}
            title={`Tên nốt: ${LABELS.find((l) => l.value === settings.labels)?.label}`}
            onClick={cycleLabels}
          >
            ABC
          </button>
          <button
            className={`btn btn-round ${settings.loop ? 'is-on' : ''}`}
            title={settings.loop ? 'Tắt lặp đoạn' : 'Lặp 4 ô nhịp từ đây'}
            onClick={toggleLoop}
          >
            ⟳
          </button>
          <button className="btn btn-round" title="Toàn màn hình" onClick={toggleFullscreen}>
            ⛶
          </button>
        </div>
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
          Ô NHỊP <b>{Math.min(measure, Math.max(1, totalMeasures))}</b>/{totalMeasures}
          {settings.loop && (
            <span className="chip chip-loop">
              LẶP {settings.loop[0]}–{settings.loop[1]}
            </span>
          )}
        </div>
      </div>

      {openPanel && (
        <div className="panel">
          <div className="panel-row">
            <label className="panel-label">TÊN NỐT TRÊN PHÍM</label>
            <div className="seg">
              {LABELS.map((l) => (
                <button
                  key={l.value}
                  className={`seg-btn ${settings.labels === l.value ? 'is-on' : ''}`}
                  onClick={() => patch({ labels: l.value })}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-row">
            <label className="panel-label">TỐC ĐỘ NỐT RƠI</label>
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
            <label className="panel-label">LẶP ĐOẠN</label>
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
            <label className="panel-label">DỊCH GIỌNG</label>
            <span className="panel-value">
              {settings.transpose === 0
                ? 'Đúng giọng gốc của bài'
                : `${settings.transpose > 0 ? 'Cao hơn' : 'Thấp hơn'} ${Math.abs(settings.transpose)} nửa cung`}
            </span>
            {settings.transpose !== 0 && (
              <button className="btn btn-sm" onClick={() => patch({ transpose: 0 })}>
                Về giọng gốc
              </button>
            )}
          </div>

          <div className="panel-row">
            <button className="btn" onClick={props.onOpenImport}>
              ＋ Thêm bài từ MuseScore
            </button>
            <button className="btn" onClick={() => props.go('library')}>
              Mở thư viện
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

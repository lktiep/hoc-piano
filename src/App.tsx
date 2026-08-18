import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PianoSynth } from './audio/piano'
import { Metronome } from './audio/metronome'
import { Player } from './engine/player'
import { Stage } from './components/Stage'
import { Controls } from './components/Controls'
import { SongPicker } from './components/SongPicker'
import { ImportDialog } from './components/ImportDialog'
import { HelpDialog } from './components/HelpDialog'
import { MidiInput, type MidiStatus } from './input/webmidi'
import { codeToMidi } from './input/keymap'
import { padToOctaves, pitchClass } from './music/notes'
import { deleteLocalSong, loadLocalSongs, loadSongFile, loadSongIndex, saveLocalSong } from './songLibrary'
import type { Settings, Song, SongIndexEntry } from './types'

const SETTINGS_KEY = 'hoc-piano.settings.v2'
const LAST_SONG_KEY = 'hoc-piano.lastSong.v1'

const DEFAULT_SETTINGS: Settings = {
  mode: 'wait',
  rate: 1,
  hands: 'right',
  guideSound: true,
  metronome: false,
  countIn: true,
  labels: 'solfege',
  showFingers: true,
  lookaheadBeats: 8,
  loop: null,
}

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>), loop: null }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Chon not Do lam moc cho ban phim may tinh: gan Do giua nhat va nam trong tam dan. */
function computerBaseC(from: number, to: number): number {
  let best = from + ((12 - pitchClass(from)) % 12)
  let bestDist = Infinity
  for (let c = 12; c <= 108; c += 12) {
    if (c < from || c + 12 > to + 1) continue
    const d = Math.abs(c - 60)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

export default function App() {
  const synthRef = useRef<PianoSynth | null>(null)
  if (!synthRef.current) synthRef.current = new PianoSynth()
  const metroRef = useRef<Metronome | null>(null)
  if (!metroRef.current) metroRef.current = new Metronome(synthRef.current)

  const [settings, setSettings] = useState<Settings>(readSettings)
  const playerRef = useRef<Player | null>(null)
  if (!playerRef.current) playerRef.current = new Player(synthRef.current, metroRef.current, settings)
  const player = playerRef.current

  const [index, setIndex] = useState<SongIndexEntry[]>([])
  const [localSongs, setLocalSongs] = useState<Song[]>(() => loadLocalSongs())
  const [song, setSong] = useState<Song | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [, forceTick] = useState(0)
  const [midiStatus, setMidiStatus] = useState<MidiStatus>({ supported: false, connected: false, devices: [] })
  const [showPicker, setShowPicker] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [wideKeyboard, setWideKeyboard] = useState(false)

  const midiRef = useRef<MidiInput | null>(null)

  // ------------------------------------------------------------- nap thu vien
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await loadSongIndex()
        if (!alive) return
        setIndex(list)
        const wanted = localStorage.getItem(LAST_SONG_KEY)
        const local = loadLocalSongs()
        const localHit = wanted ? local.find((s) => s.id === wanted) : undefined
        if (localHit) {
          setSong(localHit)
        } else {
          const entry = (wanted && list.find((e) => e.id === wanted)) || list[0]
          if (entry) setSong(await loadSongFile(entry.file))
        }
      } catch (e) {
        if (alive) setLoadError((e as Error).message)
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // --------------------------------------------------------------- dong bo
  useEffect(() => {
    player.load(song)
    forceTick((v) => v + 1)
    if (song) localStorage.setItem(LAST_SONG_KEY, song.id)
  }, [player, song])

  useEffect(() => {
    player.setSettings(settings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, loop: null }))
  }, [player, settings])

  // ------------------------------------------------------------------ MIDI
  useEffect(() => {
    const input = new MidiInput(
      (midi, on, vel) => {
        if (on) player.pressKey(midi, Math.max(0.25, vel))
        else player.releaseKey(midi)
      },
      (s) => setMidiStatus({ ...s }),
    )
    midiRef.current = input
    setMidiStatus({ ...input.status })
    void input.connect()
    return () => {
      midiRef.current = null
    }
  }, [player])

  // -------------------------------------------------------- ban phim may tinh
  const range = useMemo<[number, number]>(() => {
    if (wideKeyboard) return [36, 96]
    if (!song || song.notes.length === 0) return [48, 84]
    let lo = 127
    let hi = 0
    for (const n of song.notes) {
      if (n.m < lo) lo = n.m
      if (n.m > hi) hi = n.m
    }
    return padToOctaves(lo, hi)
  }, [song, wideKeyboard])

  const baseC = useMemo(() => computerBaseC(range[0], range[1]), [range])
  const baseCRef = useRef(baseC)
  baseCRef.current = baseC

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
    }
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        player.toggle()
        forceTick((v) => v + 1)
        return
      }
      if (e.code === 'Escape') {
        setShowPicker(false)
        setShowImport(false)
        setShowHelp(false)
        return
      }
      const midi = codeToMidi(e.code, baseCRef.current)
      if (midi != null) {
        e.preventDefault()
        player.pressKey(midi, 0.8)
      }
    }
    const up = (e: KeyboardEvent) => {
      const midi = codeToMidi(e.code, baseCRef.current)
      if (midi != null) player.releaseKey(midi)
    }
    const blur = () => player.releaseAll()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [player])

  // ------------------------------------------------------------------ actions
  const onUiTick = useCallback(() => forceTick((v) => v + 1), [])

  const pickSong = useCallback(
    async (entry: SongIndexEntry | Song) => {
      setShowPicker(false)
      setLoadError(null)
      try {
        if ('file' in entry) {
          setBusy(true)
          setSong(await loadSongFile(entry.file))
        } else {
          setSong(entry)
        }
        setSettings((s) => ({ ...s, loop: null }))
      } catch (e) {
        setLoadError((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const onImported = useCallback((imported: Song) => {
    setLocalSongs(saveLocalSong(imported))
    setSong(imported)
    setSettings((s) => ({ ...s, loop: null }))
    setShowImport(false)
  }, [])

  const onDeleteLocal = useCallback(
    (id: string) => {
      setLocalSongs(deleteLocalSong(id))
      if (song?.id === id) setSong(null)
    },
    [song],
  )

  const totalMeasures = player.timeline?.measureCount ?? 1

  return (
    <div className="app">
      <Controls
        song={song}
        player={player}
        settings={settings}
        setSettings={setSettings}
        totalMeasures={totalMeasures}
        midiStatus={midiStatus}
        onConnectMidi={() => void midiRef.current?.connect()}
        onOpenPicker={() => setShowPicker(true)}
        onOpenImport={() => setShowImport(true)}
        onOpenHelp={() => setShowHelp(true)}
        wideKeyboard={wideKeyboard}
        setWideKeyboard={setWideKeyboard}
        onChanged={onUiTick}
      />

      {loadError && (
        <div className="banner banner-error">
          {loadError} <button onClick={() => setLoadError(null)}>Đóng</button>
        </div>
      )}
      {busy && !song && <div className="banner">Đang tải bài…</div>}

      <Stage player={player} settings={settings} range={range} onUiTick={onUiTick} />

      {showPicker && (
        <SongPicker
          index={index}
          localSongs={localSongs}
          currentId={song?.id ?? null}
          onPick={pickSong}
          onDeleteLocal={onDeleteLocal}
          onClose={() => setShowPicker(false)}
          onOpenImport={() => {
            setShowPicker(false)
            setShowImport(true)
          }}
        />
      )}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={onImported} />}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} baseC={baseC} />}
    </div>
  )
}

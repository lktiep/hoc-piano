import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PianoSynth } from './audio/piano'
import { Metronome } from './audio/metronome'
import { Player } from './engine/player'
import { Stage } from './components/Stage'
import { Sheet } from './components/Sheet'
import { Controls } from './components/Controls'
import { Home } from './components/Home'
import { Library } from './components/Library'
import { Roadmap } from './components/Roadmap'
import { SongPicker } from './components/SongPicker'
import { ImportDialog } from './components/ImportDialog'
import { HelpDialog } from './components/HelpDialog'
import { MidiInput, type MidiStatus } from './input/webmidi'
import { codeToMidi } from './input/keymap'
import { padToOctaves, pitchClass } from './music/notes'
import { clearProgress, loadProgress, markDone, markOpened, type Progress } from './progress'
import { ROUTE_HASH, routeFromHash, type Route } from './routes'
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
  transpose: 0,
  view: 'fall',
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

/**
 * Dich giong: doi cao do TRUOC khi dua vao Player, nen moi thu phia sau
 * (not roi, khuong nhac, phim sang, tieng dan) tu dong khop nhau.
 * Chan lai neu dich ra ngoai 88 phim that cua cay dan.
 */
function transposeSong(song: Song | null, semitones: number): Song | null {
  if (!song || !semitones) return song
  let lo = 127
  let hi = 0
  for (const n of song.notes) {
    if (n.m < lo) lo = n.m
    if (n.m > hi) hi = n.m
  }
  const clamped = Math.max(21 - lo, Math.min(108 - hi, semitones))
  if (!clamped) return song
  return { ...song, notes: song.notes.map((n) => ({ ...n, m: n.m + clamped })) }
}

export default function App() {
  const synthRef = useRef<PianoSynth | null>(null)
  if (!synthRef.current) synthRef.current = new PianoSynth()
  const metroRef = useRef<Metronome | null>(null)
  if (!metroRef.current) metroRef.current = new Metronome(synthRef.current)

  const [route, setRoute] = useState<Route>(() => routeFromHash())
  const [settings, setSettings] = useState<Settings>(readSettings)
  const playerRef = useRef<Player | null>(null)
  if (!playerRef.current) playerRef.current = new Player(synthRef.current, metroRef.current, settings)
  const player = playerRef.current

  const [index, setIndex] = useState<SongIndexEntry[]>([])
  const [localSongs, setLocalSongs] = useState<Song[]>(() => loadLocalSongs())
  const [song, setSong] = useState<Song | null>(null)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
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
  // Bai that su dua vao may choi = bai goc da dich giong.
  const playSong = useMemo(() => transposeSong(song, settings.transpose), [song, settings.transpose])

  // Doi giong thi nap lai bai, nhung giu nguyen cho be dang tap do.
  const loadedIdRef = useRef<string | null>(null)
  useEffect(() => {
    const sameSong = loadedIdRef.current === (playSong?.id ?? null)
    const keepBeat = sameSong ? player.posBeat : 0
    const wasPlaying = sameSong && player.playing
    player.load(playSong)
    loadedIdRef.current = playSong?.id ?? null
    if (keepBeat > 0) player.seekBeat(keepBeat)
    if (wasPlaying) player.play()
    forceTick((v) => v + 1)
    if (playSong) localStorage.setItem(LAST_SONG_KEY, playSong.id)
  }, [player, playSong])

  useEffect(() => {
    player.setSettings(settings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, loop: null }))
  }, [player, settings])

  // ------------------------------------------------------------- tien do hoc
  // Chi ghi "da xong" khi be choi het bai that, khong doan gi them.
  const songIdRef = useRef<string | null>(null)
  songIdRef.current = song?.id ?? null
  useEffect(() => {
    player.events.onFinish = () => {
      const id = songIdRef.current
      if (id) setProgress(markDone(id))
    }
    return () => {
      player.events.onFinish = undefined
    }
  }, [player])

  useEffect(() => {
    if (song) setProgress(markOpened(song.id))
  }, [song])

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
    return () => {
      midiRef.current = null
    }
  }, [player])

  // Chi xin quyen MIDI khi be that su vao phong luyen, khong hoi ngay o trang chu.
  useEffect(() => {
    if (route === 'player') void midiRef.current?.connect()
  }, [route])

  // ------------------------------------------------------------- dinh tuyen
  // Nut Back cua trinh duyet: chi doi trang khi that su khac, khong ve lai thua.
  const routeRef = useRef(route)
  routeRef.current = route
  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash()
      if (next !== routeRef.current) setRoute(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Roi phong luyen thi tat tieng dan, khong de bai chay ngam.
  useEffect(() => {
    if (route !== 'player') {
      player.pause()
      player.releaseAll()
    }
  }, [player, route])

  const go = useCallback((next: Route) => {
    setRoute(next)
    const hash = ROUTE_HASH[next]
    if (window.location.hash !== hash) window.location.hash = hash
    document.documentElement.scrollTop = 0
  }, [])

  // -------------------------------------------------------- ban phim may tinh
  const range = useMemo<[number, number]>(() => {
    if (wideKeyboard) return [36, 96]
    if (!playSong || playSong.notes.length === 0) return [48, 84]
    let lo = 127
    let hi = 0
    for (const n of playSong.notes) {
      if (n.m < lo) lo = n.m
      if (n.m > hi) hi = n.m
    }
    return padToOctaves(lo, hi)
  }, [playSong, wideKeyboard])

  const baseC = useMemo(() => computerBaseC(range[0], range[1]), [range])
  const baseCRef = useRef(baseC)
  baseCRef.current = baseC

  useEffect(() => {
    if (route !== 'player') return
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
  }, [player, route])

  // ------------------------------------------------------------------ actions
  const onUiTick = useCallback(() => forceTick((v) => v + 1), [])

  const pickSong = useCallback(async (entry: SongIndexEntry | Song) => {
    setShowPicker(false)
    setLoadError(null)
    try {
      if ('file' in entry) {
        setBusy(true)
        setSong(await loadSongFile(entry.file))
      } else {
        setSong(entry)
      }
      setSettings((s) => ({ ...s, loop: null, transpose: 0 }))
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])

  const onImported = useCallback((imported: Song) => {
    setLocalSongs(saveLocalSong(imported))
    setSong(imported)
    setSettings((s) => ({ ...s, loop: null, transpose: 0 }))
    setShowImport(false)
  }, [])

  const onDeleteLocal = useCallback(
    (id: string) => {
      setLocalSongs(deleteLocalSong(id))
      if (song?.id === id) setSong(null)
    },
    [song],
  )

  /** Trang chu bam thang vao mot bai cu the (vi du "Thu ngay" o hop minh hoa). */
  const openSong = useCallback(
    (id: string) => {
      const entry = index.find((e) => e.id === id) ?? localSongs.find((s) => s.id === id)
      if (entry) void pickSong(entry)
      go('player')
    },
    [go, index, localSongs, pickSong],
  )

  const openImportFromPage = useCallback(() => {
    setShowImport(true)
    go('player')
  }, [go])

  const totalMeasures = player.timeline?.measureCount ?? 1

  if (route === 'home') {
    return (
      <Home
        index={index}
        localSongs={localSongs}
        go={go}
        onOpenImport={openImportFromPage}
        onOpenSong={openSong}
      />
    )
  }

  if (route === 'library') {
    return (
      <Library
        index={index}
        localSongs={localSongs}
        done={progress.done}
        go={go}
        onPick={pickSong}
        onDeleteLocal={onDeleteLocal}
        onOpenImport={openImportFromPage}
      />
    )
  }

  if (route === 'roadmap') {
    return (
      <Roadmap
        index={index}
        localSongs={localSongs}
        done={progress.done}
        currentId={progress.lastId}
        go={go}
        onPick={pickSong}
        onOpenImport={openImportFromPage}
        onResetProgress={() => setProgress(clearProgress())}
      />
    )
  }

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
        go={go}
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

      {/* Khuong nhac chi la mot cach nhin khac cua CUNG mot bai dang chay:
          Stage van o lai vi vong ve cua no la thu goi player.tick(). */}
      {settings.view === 'sheet' && (
        <Sheet player={player} labels={settings.labels} showFingers={settings.showFingers} posBeat={player.posBeat} />
      )}
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

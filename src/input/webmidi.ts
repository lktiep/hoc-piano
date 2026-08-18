/** Ket noi dan piano dien / keyboard MIDI qua Web MIDI API. */

export interface MidiStatus {
  supported: boolean
  connected: boolean
  devices: string[]
  error?: string
}

type NoteHandler = (midi: number, on: boolean, velocity: number) => void

interface MIDIMessage {
  data: Uint8Array | null
}
interface MIDIInputLike {
  name?: string | null
  manufacturer?: string | null
  onmidimessage: ((e: MIDIMessage) => void) | null
}
interface MIDIAccessLike {
  inputs: { values(): Iterable<MIDIInputLike> }
  onstatechange: (() => void) | null
}

function inputList(access: MIDIAccessLike): MIDIInputLike[] {
  const out: MIDIInputLike[] = []
  for (const input of access.inputs.values()) out.push(input)
  return out
}

export class MidiInput {
  private access: MIDIAccessLike | null = null
  status: MidiStatus = { supported: false, connected: false, devices: [] }

  constructor(
    private onNote: NoteHandler,
    private onStatus: (s: MidiStatus) => void,
  ) {
    this.status.supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  }

  async connect(): Promise<void> {
    if (!this.status.supported) {
      this.update({ error: 'Trinh duyet nay chua ho tro Web MIDI. Hay dung Chrome hoac Edge.' })
      return
    }
    try {
      const nav = navigator as unknown as { requestMIDIAccess(o?: { sysex: boolean }): Promise<MIDIAccessLike> }
      const access = await nav.requestMIDIAccess({ sysex: false })
      this.access = access
      access.onstatechange = () => this.bind()
      this.bind()
    } catch (e) {
      this.update({ connected: false, error: `Khong ket noi duoc MIDI: ${(e as Error).message}` })
    }
  }

  private bind() {
    if (!this.access) return
    const inputs = inputList(this.access)
    for (const input of inputs) {
      input.onmidimessage = (e: MIDIMessage) => this.handle(e)
    }
    this.update({
      connected: inputs.length > 0,
      devices: inputs.map((i) => i.name || i.manufacturer || 'Thiet bi MIDI'),
      error: inputs.length ? undefined : 'Chua thay dan nao. Cam cap USB roi bam "Ket noi dan" lai nhe.',
    })
  }

  private handle(e: MIDIMessage) {
    const d = e.data
    if (!d || d.length < 2) return
    const cmd = d[0] & 0xf0
    const midi = d[1]
    const vel = d.length > 2 ? d[2] : 0
    if (cmd === 0x90 && vel > 0) this.onNote(midi, true, vel / 127)
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) this.onNote(midi, false, 0)
  }

  private update(patch: Partial<MidiStatus>) {
    this.status = { ...this.status, ...patch }
    this.onStatus(this.status)
  }
}

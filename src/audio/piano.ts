/**
 * Tieng piano tong hop bang Web Audio (khong can tai file mau -> chay offline, khong phu thuoc CDN).
 * Mot giong = 1 oscillator dung PeriodicWave nhieu hoa am + loc thong thap co bao hinh + bao hinh am luong.
 */

const HARMONIC_GAINS = [0, 1, 0.42, 0.26, 0.13, 0.08, 0.05, 0.03, 0.02, 0.014, 0.01]

interface Voice {
  osc: OscillatorNode
  filter: BiquadFilterNode
  gain: GainNode
  stopAt: number
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export class PianoSynth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private wave: PeriodicWave | null = null
  private voices = new Map<number, Voice[]>()
  private volume = 0.9

  /** Tao AudioContext - phai goi tu trong su kien nguoi dung (click/keydown). */
  ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = this.volume
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.knee.value = 20
      comp.ratio.value = 6
      comp.attack.value = 0.004
      comp.release.value = 0.2
      master.connect(comp)
      comp.connect(ctx.destination)

      const real = new Float32Array(HARMONIC_GAINS.length)
      const imag = new Float32Array(HARMONIC_GAINS.length)
      for (let i = 0; i < HARMONIC_GAINS.length; i++) imag[i] = HARMONIC_GAINS[i]
      this.wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false })

      this.ctx = ctx
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  get currentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  noteOn(midi: number, velocity = 0.8, when?: number) {
    const ctx = this.ensure()
    const t = when ?? ctx.currentTime
    const freq = midiToFreq(midi)

    const osc = ctx.createOscillator()
    osc.setPeriodicWave(this.wave!)
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.7
    const openCutoff = Math.min(16000, Math.max(1800, freq * 12))
    const closedCutoff = Math.min(openCutoff, Math.max(500, freq * 3))
    filter.frequency.setValueAtTime(openCutoff, t)
    filter.frequency.exponentialRampToValueAtTime(closedCutoff, t + 0.55)

    const gain = ctx.createGain()
    // Not tram ngan hon ve am luong dinh, ngan dan lau hon - giong dan that hon
    const peak = Math.max(0.02, 0.34 * velocity * (1 - (midi - 21) / 260))
    // thoi gian tat: not cang tram cang keo dai
    const decayLen = Math.max(1.2, 9 - (midi - 21) * 0.075)

    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(peak, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.3), t + 0.35)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decayLen)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    const stopAt = t + decayLen + 0.05
    osc.stop(stopAt)

    const voice: Voice = { osc, filter, gain, stopAt }
    osc.onended = () => {
      const list = this.voices.get(midi)
      if (!list) return
      const i = list.indexOf(voice)
      if (i >= 0) list.splice(i, 1)
      if (list.length === 0) this.voices.delete(midi)
      try {
        gain.disconnect()
        filter.disconnect()
      } catch {
        /* da ngat roi */
      }
    }

    const list = this.voices.get(midi)
    if (list) list.push(voice)
    else this.voices.set(midi, [voice])
  }

  noteOff(midi: number, when?: number) {
    if (!this.ctx) return
    const t = when ?? this.ctx.currentTime
    const list = this.voices.get(midi)
    if (!list) return
    for (const v of list) {
      if (v.stopAt <= t) continue
      const g = v.gain.gain
      try {
        if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t)
        else {
          const cur = Math.max(0.0002, g.value)
          g.cancelScheduledValues(t)
          g.setValueAtTime(cur, t)
        }
        g.exponentialRampToValueAtTime(0.0001, t + 0.22)
        v.osc.stop(t + 0.25)
        v.stopAt = t + 0.25
      } catch {
        /* bo qua neu osc da dung */
      }
    }
  }

  allNotesOff() {
    for (const midi of Array.from(this.voices.keys())) this.noteOff(midi)
  }
}

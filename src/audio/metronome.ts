/** Tieng go nhip (metronome). */

import type { PianoSynth } from './piano'

export class Metronome {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  volume = 0.5

  constructor(private synth: PianoSynth) {}

  private ensure(): AudioContext {
    const ctx = this.synth.ensure()
    if (this.ctx !== ctx) {
      this.ctx = ctx
      this.out = ctx.createGain()
      this.out.gain.value = 1
      this.out.connect(ctx.destination)
    }
    return ctx
  }

  /** @param accent true = phach dau o nhip (tieng cao hon) */
  click(accent: boolean, when?: number) {
    const ctx = this.ensure()
    const t = when ?? ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = accent ? 1600 : 1050
    const g = ctx.createGain()
    const peak = this.volume * (accent ? 0.28 : 0.18)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(g)
    g.connect(this.out!)
    osc.start(t)
    osc.stop(t + 0.08)
    osc.onended = () => {
      try {
        g.disconnect()
      } catch {
        /* da ngat */
      }
    }
  }
}

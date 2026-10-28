import { MUSIC } from '../config';
import { sfx } from './Sfx';

/**
 * Procedural synthwave soundtrack (Web Audio only, no files).
 *
 * A 16-step sequencer schedules a few bars ahead of the audio clock:
 * - pad: detuned saw chords through a soft low-pass
 * - bass: pulsing eighth notes on the chord root
 * - arp: sixteenth-note chord tones through a dotted-eighth delay
 * - drums: kick and snare, plus hats at higher intensity
 *
 * Intensity (0–2) adds layers; boss mode swaps to a darker progression.
 */

type Mode = 'calm' | 'play' | 'boss';

/** Chords as MIDI note numbers (root first). A minor: Am – F – C – G. */
const PROGRESSIONS: Record<'normal' | 'boss', number[][]> = {
  normal: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  // Am – B♭ – F – E: the flat second gives the boss its menace.
  boss: [
    [57, 60, 64],
    [58, 62, 65],
    [53, 57, 60],
    [52, 56, 59],
  ],
};

const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3];

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private duckNode: GainNode | null = null;
  private delay: DelayNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private enabled = true;
  private intensity = 0;
  private targetIntensity = 0;
  private mode: Mode = 'calm';
  private targetMode: Mode = 'calm';
  private suspended = false;

  private get stepDur(): number {
    return 60 / MUSIC.bpm / 4;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
    else this.start();
  }

  /** Begin playback (call after a user gesture has unlocked audio). */
  start(): void {
    if (!this.enabled || this.timer) return;
    const ctx = sfx.context;
    const bus = sfx.musicBus;
    if (!ctx || !bus) return;
    if (this.ctx !== ctx) this.build(ctx, bus);
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.out!.gain.cancelScheduledValues(ctx.currentTime);
    this.out!.gain.setValueAtTime(0, ctx.currentTime);
    this.out!.gain.linearRampToValueAtTime(MUSIC.volume, ctx.currentTime + 1.5);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  /** Stop scheduling while the page is hidden (timers are throttled there anyway). */
  setSuspended(hidden: boolean): void {
    if (hidden === this.suspended) return;
    this.suspended = hidden;
    if (hidden) this.stop();
    else this.start();
  }

  /** 0 = calm (menus, between waves), 1 = combat, 2 = high pressure. */
  setIntensity(level: number): void {
    this.targetIntensity = Math.max(0, Math.min(2, Math.round(level)));
  }

  setBoss(on: boolean): void {
    this.targetMode = on ? 'boss' : this.targetIntensity > 0 ? 'play' : 'calm';
  }

  /** Briefly dip the music under a big moment. */
  duck(): void {
    if (!this.ctx || !this.duckNode) return;
    const t = this.ctx.currentTime;
    const g = this.duckNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - MUSIC.duckAmount, t + 0.03);
    g.linearRampToValueAtTime(1, t + MUSIC.duckTime);
  }

  private build(ctx: AudioContext, bus: AudioNode): void {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.duckNode = ctx.createGain();
    this.out.connect(this.duckNode).connect(bus);
    // Dotted-eighth echo for the arpeggio.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = this.stepDur * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(feedback).connect(this.delay);
    this.delay.connect(wet).connect(this.out);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // Never fall far behind (e.g. after the tab was throttled).
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 64;
      this.nextTime += this.stepDur;
    }
  }

  private playStep(step: number, t: number): void {
    const inBar = step % 16;
    if (inBar === 0) {
      // Layer and mode changes land on bar lines.
      this.intensity = this.targetIntensity;
      this.mode = this.targetMode === 'boss' ? 'boss' : this.intensity > 0 ? 'play' : 'calm';
    }
    const prog = PROGRESSIONS[this.mode === 'boss' ? 'boss' : 'normal'];
    const chord = prog[Math.floor(step / 16) % prog.length];
    const root = chord[0];
    const level = this.mode === 'boss' ? 2 : this.intensity;

    if (inBar === 0) this.pad(chord, t, this.stepDur * 16, level);

    // Bass: quarters when calm, pulsing eighths in combat.
    if (level === 0 ? inBar % 4 === 0 : inBar % 2 === 0) {
      const octave = inBar % 8 === 6 && level > 0 ? 12 : 0;
      this.bass(midiToHz(root - 24 + octave), t, level);
    }

    // Arpeggio: sparse when calm, full sixteenths in combat.
    if (level > 0 || inBar % 4 === 0) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12];
      const note = tones[ARP_PATTERN[inBar]] + 12;
      this.arp(midiToHz(note), t, level);
    }

    if (level >= 1) {
      if (inBar % 8 === 0 || (this.mode === 'boss' && inBar % 4 === 0)) this.kick(t);
      if (inBar % 8 === 4) this.snare(t);
    }
    if (level >= 2 && inBar % 2 === 0) this.hat(t, inBar % 4 === 2 ? 0.05 : 0.025);
  }

  private voice(type: OscillatorType, hz: number, t: number, dur: number, peak: number, attack: number, dest: AudioNode, detune = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0.0001, t + Math.max(attack, dur - 0.05), dur * 0.25);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.6);
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(this.out!);
    return f;
  }

  private pad(chord: number[], t: number, dur: number, level: number): void {
    const lp = this.filter('lowpass', level >= 2 ? 2200 : 1300);
    for (const n of chord) {
      for (const det of [-9, 9]) this.voice('sawtooth', midiToHz(n), t, dur, 0.022, 0.6, lp, det);
    }
  }

  private bass(hz: number, t: number, level: number): void {
    const lp = this.filter('lowpass', level >= 2 ? 900 : 600, 2);
    const dur = this.stepDur * 1.8;
    this.voice('sawtooth', hz, t, dur, 0.09, 0.01, lp);
    this.voice('square', hz / 2, t, dur, 0.05, 0.01, lp);
  }

  private arp(hz: number, t: number, level: number): void {
    const lp = this.filter('lowpass', level >= 2 ? 3800 : 2400);
    if (this.delay) lp.connect(this.delay);
    this.voice('square', hz, t, this.stepDur * 0.9, level === 0 ? 0.018 : 0.026, 0.005, lp);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.out!);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  private noise(t: number, dur: number, filterType: BiquadFilterType, freq: number, peak: number): void {
    const ctx = this.ctx!;
    const buf = sfx.noiseBuffer;
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(this.filter(filterType, freq));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number): void {
    this.noise(t, 0.22, 'bandpass', 1900, 0.16);
    this.voice('triangle', 190, t, 0.1, 0.06, 0.002, this.out!);
  }

  private hat(t: number, peak: number): void {
    this.noise(t, 0.05, 'highpass', 8000, peak);
  }
}

export const music = new Music();

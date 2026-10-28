/**
 * Tiny Web Audio synthesiser. Every sound is generated on the fly from
 * oscillators and a shared noise buffer, so the game ships no audio files.
 * The AudioContext is only created after a user gesture (`unlock`).
 */
export type SoundName =
  | 'shotFire'
  | 'shotWater'
  | 'shotLightning'
  | 'shotFrost'
  | 'shotWind'
  | 'shotToxin'
  | 'shotVoid'
  | 'gust'
  | 'freeze'
  | 'shatter'
  | 'overload'
  | 'ignition'
  | 'poison'
  | 'singularity'
  | 'collapse'
  | 'detonation'
  | 'shieldBlock'
  | 'shieldBreak'
  | 'discovery'
  | 'split'
  | 'actClear'
  | 'hit'
  | 'splash'
  | 'steam'
  | 'chain'
  | 'flashover'
  | 'kill'
  | 'leak'
  | 'upgrade'
  | 'select'
  | 'waveStart'
  | 'waveClear'
  | 'boss'
  | 'cascade'
  | 'victory'
  | 'defeat'
  | 'click';

/** Minimum seconds between two plays of the same sound (prevents harsh stacking). */
const THROTTLE: Partial<Record<SoundName, number>> = {
  shotFire: 0.045,
  shotWater: 0.045,
  shotLightning: 0.045,
  shotFrost: 0.045,
  shotWind: 0.045,
  shotToxin: 0.045,
  shotVoid: 0.045,
  gust: 0.08,
  freeze: 0.06,
  shatter: 0.06,
  overload: 0.07,
  ignition: 0.08,
  poison: 0.08,
  singularity: 0.1,
  collapse: 0.08,
  detonation: 0.07,
  shieldBlock: 0.06,
  shieldBreak: 0.08,
  split: 0.06,
  hit: 0.035,
  splash: 0.06,
  steam: 0.07,
  chain: 0.06,
  flashover: 0.07,
  kill: 0.03,
  cascade: 0.12,
};

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: AudioNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SoundName, number>();
  private _muted = false;
  private voices = 0;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Create/resume the audio context. Call from a user gesture handler. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.55;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 6;
        this.master.connect(comp).connect(this.ctx.destination);
        this.bus = comp;
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this._muted ? 0 : 1;
        this.musicGain.connect(comp);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** The running audio context (null until a user gesture unlocks audio). */
  get context(): AudioContext | null {
    return this.ctx && this.ctx.state !== 'closed' ? this.ctx : null;
  }

  /** Where the music should connect (respects mute). */
  get musicBus(): AudioNode | null {
    return this.bus ? this.musicGain : null;
  }

  /** Shared white-noise buffer for percussion. */
  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  play(name: SoundName, intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this._muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name] ?? 0;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    if (this.voices > 24) return;
    this.last.set(name, now);
    const i = Math.max(0.2, Math.min(intensity, 2));
    switch (name) {
      case 'shotFire':
        this.noiseHit(now, 0.07, 1800, 'bandpass', 0.11);
        this.tone(now, 'triangle', 320, 140, 0.07, 0.07);
        break;
      case 'shotWater':
        this.tone(now, 'sine', 720, 300, 0.08, 0.13);
        break;
      case 'shotLightning':
        this.tone(now, 'square', 1500, 700, 0.05, 0.045);
        break;
      case 'shotFrost':
        this.tone(now, 'sine', 1800, 2400, 0.06, 0.05);
        this.tone(now, 'triangle', 900, 1200, 0.05, 0.04);
        break;
      case 'shotWind':
        this.noiseHit(now, 0.08, 1200, 'bandpass', 0.12);
        break;
      case 'shotToxin':
        this.tone(now, 'square', 260, 180, 0.07, 0.04);
        this.tone(now + 0.02, 'sine', 520, 300, 0.05, 0.05);
        break;
      case 'shotVoid':
        this.tone(now, 'sine', 160, 90, 0.1, 0.12);
        this.tone(now, 'sawtooth', 320, 140, 0.08, 0.03);
        break;
      case 'gust':
        this.noiseHit(now, 0.3, 700, 'bandpass', 0.18);
        break;
      case 'freeze':
        [2200, 2900, 3700].forEach((f, k) => this.tone(now + k * 0.025, 'sine', f, f * 1.05, 0.12, 0.05));
        break;
      case 'shatter':
        this.noiseHit(now, 0.22, 5000, 'highpass', 0.22 * i);
        [3100, 4200, 2600].forEach((f, k) => this.tone(now + k * 0.02, 'triangle', f, f * 0.7, 0.09, 0.05));
        break;
      case 'overload':
        this.tone(now, 'sawtooth', 120, 60, 0.2, 0.18);
        this.noiseHit(now, 0.15, 3000, 'bandpass', 0.15);
        break;
      case 'ignition':
        this.noiseHit(now, 0.45, 500, 'lowpass', 0.32 * i);
        this.tone(now, 'sine', 90, 30, 0.4, 0.3);
        break;
      case 'poison':
        this.tone(now, 'sine', 300, 420, 0.1, 0.06);
        this.tone(now + 0.05, 'sine', 360, 520, 0.08, 0.05);
        break;
      case 'singularity':
        this.tone(now, 'sine', 60, 140, 0.5, 0.16);
        this.tone(now, 'triangle', 600, 200, 0.4, 0.04);
        break;
      case 'collapse':
        this.tone(now, 'sine', 220, 40, 0.35, 0.3);
        this.noiseHit(now, 0.25, 400, 'lowpass', 0.25);
        break;
      case 'detonation':
        this.noiseHit(now, 0.35, 900, 'lowpass', 0.3);
        this.tone(now, 'square', 140, 50, 0.25, 0.12);
        break;
      case 'shieldBlock':
        this.tone(now, 'triangle', 1400, 1300, 0.05, 0.05);
        break;
      case 'shieldBreak':
        this.noiseHit(now, 0.18, 6000, 'highpass', 0.18);
        this.tone(now, 'triangle', 1600, 500, 0.15, 0.08);
        break;
      case 'split':
        this.tone(now, 'square', 500, 900, 0.06, 0.05);
        break;
      case 'discovery':
        [659, 784, 988, 1319].forEach((f, k) => this.tone(now + k * 0.06, 'triangle', f, f, 0.22, 0.12));
        break;
      case 'actClear':
        [392, 494, 587, 784, 988].forEach((f, k) => this.tone(now + k * 0.09, 'triangle', f, f, 0.3, 0.13));
        break;
      case 'hit':
        this.tone(now, 'triangle', 240, 120, 0.05, 0.08);
        break;
      case 'splash':
        this.noiseHit(now, 0.18, 900, 'lowpass', 0.16);
        this.tone(now, 'sine', 420, 220, 0.12, 0.1);
        break;
      case 'steam':
        this.noiseHit(now, 0.38, 2600, 'highpass', 0.2 * i);
        this.tone(now, 'sine', 180, 90, 0.2, 0.12);
        break;
      case 'chain':
        for (let k = 0; k < 3; k++) this.tone(now + k * 0.03, 'sawtooth', 900 + Math.random() * 900, 300, 0.07, 0.06);
        this.noiseHit(now, 0.12, 4000, 'highpass', 0.1);
        break;
      case 'flashover':
        this.noiseHit(now, 0.35, 700, 'lowpass', 0.3 * i);
        this.tone(now, 'sine', 110, 38, 0.3, 0.3);
        break;
      case 'kill':
        this.tone(now, 'sine', 520, 980, 0.08, 0.1);
        break;
      case 'leak':
        this.tone(now, 'sawtooth', 140, 45, 0.45, 0.22);
        this.noiseHit(now, 0.3, 300, 'lowpass', 0.25);
        break;
      case 'upgrade':
        [523, 659, 784, 1047].forEach((f, k) => this.tone(now + k * 0.07, 'triangle', f, f, 0.16, 0.14));
        break;
      case 'select':
        this.tone(now, 'triangle', 660, 880, 0.06, 0.08);
        break;
      case 'click':
        this.tone(now, 'triangle', 500, 500, 0.04, 0.08);
        break;
      case 'waveStart':
        this.tone(now, 'triangle', 330, 330, 0.12, 0.1);
        this.tone(now + 0.12, 'triangle', 494, 494, 0.16, 0.1);
        break;
      case 'waveClear':
        [392, 523, 659].forEach((f, k) => this.tone(now + k * 0.09, 'sine', f, f * 1.01, 0.22, 0.14));
        break;
      case 'boss':
        this.tone(now, 'sawtooth', 70, 55, 1.0, 0.22);
        this.tone(now + 0.25, 'sawtooth', 82, 60, 0.9, 0.18);
        break;
      case 'cascade': {
        const f = 440 * Math.pow(2, Math.min(i * 6, 18) / 12);
        this.tone(now, 'triangle', f, f * 1.5, 0.14, 0.12);
        break;
      }
      case 'victory':
        [523, 659, 784, 1047, 1319].forEach((f, k) => this.tone(now + k * 0.11, 'triangle', f, f, 0.3, 0.14));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, k) => this.tone(now + k * 0.16, 'sine', f, f * 0.97, 0.32, 0.16));
        break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    this.track(osc);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, freq: number, type: BiquadFilterType, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    this.track(src);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }
}

export const sfx = new Sfx();

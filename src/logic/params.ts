import { WAVES } from '../config';
import { hashString } from './rng';

export interface LaunchParams {
  /** Wave to start at (1–8). */
  wave: number;
  /** Grant all elements and upgrades. */
  unlockAll: boolean;
  /** Fixed seed, or null to pick a random one per run. */
  seed: number | null;
  /** Start straight into the daily run. */
  daily: boolean;
  /** Simulation speed multiplier for automated tests (1–4). */
  speed: number;
}

/** Parse `?wave=N&unlock=all&seed=X&daily=1&speed=N`. Invalid values fall back to defaults. */
export function parseParams(search: string): LaunchParams {
  const q = new URLSearchParams(search);
  const waveRaw = Number.parseInt(q.get('wave') ?? '', 10);
  const wave = Number.isFinite(waveRaw) ? Math.min(Math.max(waveRaw, 1), WAVES.total) : 1;
  const seedRaw = q.get('seed');
  let seed: number | null = null;
  if (seedRaw !== null && seedRaw !== '') {
    seed = /^\d+$/.test(seedRaw) ? Number(seedRaw) >>> 0 : hashString(seedRaw);
  }
  const speedRaw = Number.parseFloat(q.get('speed') ?? '');
  const speed = Number.isFinite(speedRaw) ? Math.min(Math.max(speedRaw, 1), 4) : 1;
  return {
    wave,
    unlockAll: (q.get('unlock') ?? '').toLowerCase() === 'all',
    seed,
    daily: q.get('daily') === '1' || q.get('daily') === 'true',
    speed,
  };
}

/** YYYY-MM-DD in UTC. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Seed shared by everyone playing the daily run on the same UTC date. */
export function dailySeed(date: Date): number {
  return hashString(`cascade-daily-${utcDateKey(date)}`);
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

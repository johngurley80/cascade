import { STORAGE_KEYS } from '../config';

export interface Settings {
  muted: boolean;
  reducedEffects: boolean;
}

export interface BestRecord {
  bestWave: number;
  bestCascade: number;
  victories: number;
}

const DEFAULT_SETTINGS: Settings = { muted: false, reducedEffects: false };
const DEFAULT_BEST: BestRecord = { bestWave: 0, bestCascade: 0, victories: 0 };

function safeStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__cascade_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = safeStorage()?.getItem(key);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return { ...fallback };
  }
}

function write(key: string, value: unknown): void {
  try {
    safeStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game keeps working without persistence.
  }
}

export function loadSettings(): Settings {
  const s = read(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return { muted: !!s.muted, reducedEffects: !!s.reducedEffects };
}

export function saveSettings(settings: Settings): void {
  write(STORAGE_KEYS.settings, settings);
}

export function loadBest(): BestRecord {
  const b = read(STORAGE_KEYS.best, DEFAULT_BEST);
  return {
    bestWave: Number(b.bestWave) || 0,
    bestCascade: Number(b.bestCascade) || 0,
    victories: Number(b.victories) || 0,
  };
}

/** Merge a finished run into the best record and persist it. Returns the new record. */
export function recordRun(wave: number, cascade: number, victory: boolean): BestRecord {
  const best = loadBest();
  const next: BestRecord = {
    bestWave: Math.max(best.bestWave, wave),
    bestCascade: Math.max(best.bestCascade, cascade),
    victories: best.victories + (victory ? 1 : 0),
  };
  write(STORAGE_KEYS.best, next);
  return next;
}

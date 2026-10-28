import { STORAGE_KEYS } from '../config';
import type { LeaderboardEntry } from '../logic/records';
import type { ReactionId } from '../logic/types';
import type { RunSave } from '../logic/world';

export interface Settings {
  muted: boolean;
  reducedEffects: boolean;
  music: boolean;
}

export interface BestRecord {
  bestWave: number;
  bestCascade: number;
  victories: number;
  bestEndlessWave: number;
}

const DEFAULT_SETTINGS: Settings = { muted: false, reducedEffects: false, music: true };
const DEFAULT_BEST: BestRecord = { bestWave: 0, bestCascade: 0, victories: 0, bestEndlessWave: 0 };

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

function readJson(key: string): unknown {
  try {
    const raw = safeStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function read<T extends object>(key: string, fallback: T): T {
  const parsed = readJson(key);
  if (!parsed || typeof parsed !== 'object') return { ...fallback };
  return { ...fallback, ...(parsed as Partial<T>) };
}

function write(key: string, value: unknown): void {
  try {
    safeStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game keeps working without persistence.
  }
}

function remove(key: string): void {
  try {
    safeStorage()?.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function loadSettings(): Settings {
  const s = read(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return { muted: !!s.muted, reducedEffects: !!s.reducedEffects, music: s.music !== false };
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
    bestEndlessWave: Number(b.bestEndlessWave) || 0,
  };
}

/** Merge a finished run into the best record and persist it. Returns the new record. */
export function recordRun(wave: number, cascade: number, victory: boolean, endless: boolean): BestRecord {
  const best = loadBest();
  const next: BestRecord = {
    bestWave: Math.max(best.bestWave, wave),
    bestCascade: Math.max(best.bestCascade, cascade),
    victories: best.victories + (victory ? 1 : 0),
    bestEndlessWave: endless ? Math.max(best.bestEndlessWave, wave) : best.bestEndlessWave,
  };
  write(STORAGE_KEYS.best, next);
  return next;
}

export function loadCodex(): Set<ReactionId> {
  const raw = readJson(STORAGE_KEYS.codex);
  return new Set(Array.isArray(raw) ? (raw.filter((x) => typeof x === 'string') as ReactionId[]) : []);
}

export function saveCodex(known: Set<ReactionId>): void {
  write(STORAGE_KEYS.codex, [...known]);
}

export function loadLeaderboard(): LeaderboardEntry[] {
  const raw = readJson(STORAGE_KEYS.leaderboard);
  return Array.isArray(raw) ? (raw.filter((e) => e && typeof e.score === 'number') as LeaderboardEntry[]) : [];
}

export function saveLeaderboard(board: LeaderboardEntry[]): void {
  write(STORAGE_KEYS.leaderboard, board);
}

/** Extra run settings stored alongside the save so a resumed run keeps its mode. */
export interface SavedRun {
  save: RunSave;
  daily: string | null;
}

export function loadRun(): SavedRun | null {
  const raw = readJson(STORAGE_KEYS.save) as SavedRun | null;
  if (!raw || !raw.save || raw.save.version !== 1 || !Array.isArray(raw.save.elements)) return null;
  return raw;
}

export function saveRun(run: SavedRun): void {
  write(STORAGE_KEYS.save, run);
}

export function clearRun(): void {
  remove(STORAGE_KEYS.save);
}

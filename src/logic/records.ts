import { SCORE } from '../config';
import type { Element } from './types';

export type RunMode = 'normal' | 'daily' | 'endless';

export interface LeaderboardEntry {
  score: number;
  wave: number;
  cascade: number;
  mode: RunMode;
  victory: boolean;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  elements: Element[];
}

/** Insert a run into a leaderboard, keeping the best `size` by score. Returns the new list and the entry's rank (or -1). */
export function insertEntry(
  board: readonly LeaderboardEntry[],
  entry: LeaderboardEntry,
  size: number = SCORE.leaderboardSize,
): { board: LeaderboardEntry[]; rank: number } {
  const next = [...board, entry].sort((a, b) => b.score - a.score || b.wave - a.wave || b.cascade - a.cascade);
  const trimmed = next.slice(0, size);
  return { board: trimmed, rank: trimmed.indexOf(entry) };
}

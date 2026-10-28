import { describe, expect, it } from 'vitest';
import { dailySeed, parseParams, utcDateKey } from '../src/logic/params';
import { insertEntry, type LeaderboardEntry } from '../src/logic/records';
import { resultSummary } from '../src/logic/summary';
import { applyUpgrade, createLoadout } from '../src/logic/upgrades';

describe('URL parameters', () => {
  it('parses wave, unlock and seed', () => {
    expect(parseParams('?wave=4&unlock=all&seed=42')).toMatchObject({ wave: 4, unlockAll: true, seed: 42 });
  });

  it('clamps and ignores invalid values', () => {
    const p = parseParams('?wave=99&seed=&speed=50');
    expect(p.wave).toBe(15);
    expect(p.seed).toBeNull();
    expect(p.speed).toBe(4);
    expect(parseParams('').wave).toBe(1);
  });
});

describe('daily run', () => {
  it('uses the UTC date so everyone shares the same seed', () => {
    const a = new Date('2026-10-28T00:30:00Z');
    expect(utcDateKey(a)).toBe('2026-10-28');
    expect(dailySeed(a)).toBe(dailySeed(new Date('2026-10-28T23:59:00Z')));
    expect(dailySeed(a)).not.toBe(dailySeed(new Date('2026-10-29T00:00:00Z')));
  });
});

describe('results', () => {
  it('formats a one-line share string', () => {
    const loadout = createLoadout();
    for (const id of ['fire', 'water', 'lightning', 'ricochet', 'splitShot', 'flashover'] as const) applyUpgrade(loadout, id);
    expect(resultSummary({ victory: true, wave: 15, score: 12340, largestCascade: 17, loadout })).toBe(
      'Cascade — Wave 15 ✅ | Score 12,340 | Biggest cascade: 17 | 🔥💧⚡ ↔️✂️💥',
    );
  });

  it('keeps the leaderboard sorted and trimmed', () => {
    const entry = (score: number): LeaderboardEntry => ({ score, wave: 5, cascade: 3, mode: 'normal', victory: false, date: '2026-10-28', elements: [] });
    let board: LeaderboardEntry[] = [];
    for (const s of [50, 10, 90, 30]) board = insertEntry(board, entry(s), 3).board;
    expect(board.map((e) => e.score)).toEqual([90, 50, 30]);
    expect(insertEntry(board, entry(5), 3).rank).toBe(-1);
    expect(insertEntry(board, entry(70), 3).rank).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { dailySeed, parseParams, utcDateKey } from '../src/logic/params';
import { resultSummary } from '../src/logic/summary';
import { applyUpgrade, createLoadout } from '../src/logic/upgrades';

describe('URL parameters', () => {
  it('parses wave, unlock and seed', () => {
    expect(parseParams('?wave=4&unlock=all&seed=42')).toMatchObject({ wave: 4, unlockAll: true, seed: 42 });
  });

  it('clamps and ignores invalid values', () => {
    const p = parseParams('?wave=99&seed=&speed=50');
    expect(p.wave).toBe(8);
    expect(p.seed).toBeNull();
    expect(p.speed).toBe(4);
    expect(parseParams('').wave).toBe(1);
  });

  it('hashes non-numeric seeds deterministically', () => {
    expect(parseParams('?seed=hello').seed).toBe(parseParams('?seed=hello').seed);
  });
});

describe('daily run', () => {
  it('uses the UTC date so everyone shares the same seed', () => {
    const a = new Date('2026-10-28T00:30:00Z');
    const b = new Date('2026-10-28T23:59:00Z');
    expect(utcDateKey(a)).toBe('2026-10-28');
    expect(dailySeed(a)).toBe(dailySeed(b));
    expect(dailySeed(a)).not.toBe(dailySeed(new Date('2026-10-29T00:00:00Z')));
  });
});

describe('result summary', () => {
  it('formats a one-line share string', () => {
    const loadout = createLoadout();
    applyUpgrade(loadout, 'water');
    applyUpgrade(loadout, 'lightning');
    applyUpgrade(loadout, 'ricochet');
    applyUpgrade(loadout, 'splitShot');
    applyUpgrade(loadout, 'flashover');
    expect(resultSummary({ victory: true, wave: 8, largestCascade: 17, loadout })).toBe(
      'Cascade — Wave 8 ✅ | Biggest cascade: 17 | 🔥💧⚡ ↔️✂️💥',
    );
  });
});

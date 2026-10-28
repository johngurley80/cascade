import { describe, expect, it } from 'vitest';
import { Rng } from '../src/logic/rng';
import {
  MODIFIER_IDS,
  UPGRADE_DEFS,
  applyUpgrade,
  buildOffer,
  createLoadout,
  elementsToGrantAfterWave,
  isAvailable,
  unlockAll,
} from '../src/logic/upgrades';
import type { UpgradeId } from '../src/logic/types';

describe('upgrade offers', () => {
  it('after wave 1 the player picks Water or Lightning', () => {
    const offer = buildOffer(1, createLoadout(), new Rng(1));
    expect(offer.sort()).toEqual(['lightning', 'water']);
  });

  it('after wave 2 the untaken element is guaranteed among three choices', () => {
    for (const first of ['water', 'lightning'] as const) {
      for (let seed = 0; seed < 50; seed++) {
        const loadout = createLoadout();
        applyUpgrade(loadout, first);
        const offer = buildOffer(2, loadout, new Rng(seed));
        expect(offer).toHaveLength(3);
        expect(offer).toContain(first === 'water' ? 'lightning' : 'water');
        expect(offer).not.toContain(first);
      }
    }
  });

  it('grants the missing element automatically after wave 3', () => {
    const loadout = createLoadout();
    applyUpgrade(loadout, 'water');
    expect(elementsToGrantAfterWave(2, loadout)).toEqual([]);
    expect(elementsToGrantAfterWave(3, loadout)).toEqual(['lightning']);
  });

  it('never offers taken or maxed upgrades, and never repeats within an offer', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = new Rng(seed);
      const loadout = createLoadout();
      loadout.elements.add('water').add('lightning');
      for (let wave = 3; wave <= 12; wave++) {
        const offer = buildOffer(wave, loadout, rng);
        expect(new Set(offer).size).toBe(offer.length);
        for (const id of offer) expect(isAvailable(loadout, id)).toBe(true);
        if (offer.length === 0) break;
        applyUpgrade(loadout, offer[Math.floor(rng.next() * offer.length)]);
      }
      for (const id of MODIFIER_IDS) {
        expect(loadout.levels[id]).toBeLessThanOrEqual(UPGRADE_DEFS[id].maxLevel);
      }
    }
  });

  it('offers nothing once everything is maxed and refuses to over-apply', () => {
    const loadout = createLoadout();
    unlockAll(loadout);
    expect(buildOffer(5, loadout, new Rng(9))).toEqual([]);
    expect(() => applyUpgrade(loadout, 'rapidFire' as UpgradeId)).toThrow();
    expect(() => applyUpgrade(loadout, 'ricochet')).toThrow();
  });

  it('stops offering a levelled upgrade at its maximum level', () => {
    const loadout = createLoadout();
    loadout.elements.add('water').add('lightning');
    applyUpgrade(loadout, 'widerSplash');
    expect(isAvailable(loadout, 'widerSplash')).toBe(true);
    applyUpgrade(loadout, 'widerSplash');
    expect(isAvailable(loadout, 'widerSplash')).toBe(false);
    for (let seed = 0; seed < 100; seed++) expect(buildOffer(4, loadout, new Rng(seed))).not.toContain('widerSplash');
  });
});

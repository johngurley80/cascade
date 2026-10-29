import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/config';
import { partnersOf } from '../src/logic/codex';
import { Rng } from '../src/logic/rng';
import { ALL_ELEMENTS, type UpgradeId } from '../src/logic/types';
import {
  MODIFIER_IDS,
  UPGRADE_DEFS,
  applyUpgrade,
  buildElementOffer,
  buildModifierOffer,
  buildOffer,
  createLoadout,
  isAvailable,
  offerKindAfterWave,
  unlockAll,
} from '../src/logic/upgrades';
import { World } from '../src/logic/world';

const ctx = { health: 3, maxHealth: 3 };

describe('elements', () => {
  it('the run starts with a choice of all seven elements', () => {
    const offer = buildOffer(0, createLoadout(), new Rng(1), ctx);
    expect([...offer].sort()).toEqual([...ALL_ELEMENTS].sort());
  });

  it('every element has at least one partner it reacts with', () => {
    for (const e of ALL_ELEMENTS) expect(partnersOf(e).length).toBeGreaterThan(0);
  });

  it('element picks come after waves 1, 4 and 8 and always include a partner', () => {
    for (const start of ALL_ELEMENTS) {
      for (let seed = 0; seed < 40; seed++) {
        const rng = new Rng(seed);
        const loadout = createLoadout();
        applyUpgrade(loadout, start);
        for (let wave = 1; wave <= 14; wave++) {
          const kind = offerKindAfterWave(wave, loadout);
          if (!PLAYER.elementPickAfterWaves.includes(wave)) {
            expect(kind).toBe('modifier');
            continue;
          }
          expect(kind).toBe('element');
          const offer = buildElementOffer(loadout, rng);
          expect(offer).toHaveLength(3);
          expect(offer.some((e) => loadout.elements.some((o) => partnersOf(o).includes(e)))).toBe(true);
          for (const e of offer) expect(loadout.elements).not.toContain(e);
          applyUpgrade(loadout, offer[Math.floor(rng.next() * 3)], ctx);
        }
        expect(loadout.elements).toHaveLength(PLAYER.elementSlots);
      }
    }
  });

  it('never allows more elements than slots', () => {
    const loadout = createLoadout();
    for (const e of ['fire', 'water', 'frost', 'wind', 'toxin'] as const) applyUpgrade(loadout, e, ctx);
    expect(isAvailable(loadout, 'void', ctx)).toBe(false);
    expect(() => applyUpgrade(loadout, 'void', ctx)).toThrow();
  });
});

describe('modifier offers', () => {
  it('never offer taken, maxed or prerequisite-less upgrades, and never repeat', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = new Rng(seed);
      const loadout = createLoadout();
      const els = [...ALL_ELEMENTS].sort(() => rng.next() - 0.5).slice(0, 4);
      for (const e of els) applyUpgrade(loadout, e, ctx);
      const health = { health: 2, maxHealth: 3 };
      for (let wave = 2; wave <= 40; wave++) {
        const offer = buildModifierOffer(loadout, rng, health);
        expect(new Set(offer).size).toBe(offer.length);
        for (const id of offer) {
          expect(isAvailable(loadout, id, health)).toBe(true);
          for (const req of UPGRADE_DEFS[id].requires ?? []) expect(loadout.elements).toContain(req);
        }
        if (offer.length === 0) break;
        applyUpgrade(loadout, offer[Math.floor(rng.next() * offer.length)], health);
      }
      for (const id of MODIFIER_IDS) expect(loadout.levels[id]).toBeLessThanOrEqual(UPGRADE_DEFS[id].maxLevel);
    }
  });

  it('combo upgrades only appear once both elements are owned', () => {
    const loadout = createLoadout();
    applyUpgrade(loadout, 'fire', ctx);
    for (let s = 0; s < 200; s++) expect(buildModifierOffer(loadout, new Rng(s), ctx)).not.toContain('superheatedSteam');
    applyUpgrade(loadout, 'water', ctx);
    const seen = new Set<UpgradeId>();
    for (let s = 0; s < 200; s++) for (const id of buildModifierOffer(loadout, new Rng(s), ctx)) seen.add(id);
    expect(seen.has('superheatedSteam')).toBe(true);
  });

  it('Repair is only offered when hurt', () => {
    const loadout = createLoadout();
    applyUpgrade(loadout, 'fire', ctx);
    expect(isAvailable(loadout, 'repair', { health: 3, maxHealth: 3 })).toBe(false);
    expect(isAvailable(loadout, 'repair', { health: 2, maxHealth: 3 })).toBe(true);
  });

  it('offers nothing once everything is maxed', () => {
    const loadout = createLoadout();
    unlockAll(loadout);
    expect(buildModifierOffer(loadout, new Rng(9), ctx)).toEqual([]);
    expect(() => applyUpgrade(loadout, 'ricochet', ctx)).toThrow();
  });

  it('reroll replaces a modifier offer once per run', () => {
    const world = new World({ autoFire: false, seed: 5 });
    world.chooseUpgrade(world.offer.indexOf('fire'));
    // Clear wave 1 quickly.
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 120) {
      world.step(1 / 60);
      for (const e of world.enemies.slice()) world.reactions.projectileHit({ element: 'fire', damage: 1e6, x: e.x, y: e.y }, e);
    }
    world.chooseUpgrade(0); // element pick after wave 1 — rerolls don't apply to element picks
    expect(world.reroll()).toBe(false);
    guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 120) {
      world.step(1 / 60);
      for (const e of world.enemies.slice()) world.reactions.projectileHit({ element: 'fire', damage: 1e6, x: e.x, y: e.y }, e);
    }
    expect(world.phase).toBe('upgrade');
    expect(world.reroll()).toBe(true);
    expect(world.offer.length).toBeGreaterThan(0);
    expect(world.reroll()).toBe(false);
  });
});

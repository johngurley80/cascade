import { describe, expect, it } from 'vitest';
import { PLAYER, WAVES } from '../src/config';
import { Rng } from '../src/logic/rng';
import { WaveRunner, actOf, bossForWave, buildWaveSchedule, isBossKind } from '../src/logic/waves';
import { World } from '../src/logic/world';

const DT = 1 / 60;

function killEverything(world: World): void {
  for (const e of world.enemies.slice()) {
    // Reaction damage, so shields don't block it.
    if (e.alive) world.reactions.damage(null, 0, e, 1e9, 'steam', e.x, e.y, false);
  }
}

function startRun(seed: number, opts: Partial<ConstructorParameters<typeof World>[0]> = {}): World {
  const world = new World({ autoFire: false, seed, ...opts });
  if (world.phase === 'start') world.chooseUpgrade(world.offer.indexOf('water'));
  return world;
}

describe('waves', () => {
  it('a wave is incomplete until every spawned enemy is resolved', () => {
    const runner = new WaveRunner(1, new Rng(4));
    let spawned = 0;
    for (let t = 0; t < 120; t += DT) spawned += runner.update(DT, 1000).length;
    runner.noteSpawned(spawned);
    expect(runner.allGroupsSpawned).toBe(true);
    expect(runner.complete).toBe(false);
    runner.noteResolved(spawned - 1);
    expect(runner.complete).toBe(false);
    runner.noteResolved(1);
    expect(runner.complete).toBe(true);
  });

  it('the run opens on the starting-element choice', () => {
    const world = new World({ autoFire: false, seed: 1 });
    expect(world.phase).toBe('start');
    expect(world.offer).toHaveLength(7);
    world.chooseUpgrade(world.offer.indexOf('frost'));
    expect(world.loadout.elements).toEqual(['frost']);
    expect(world.phase).toBe('playing');
  });

  it('completes when all enemies are defeated', () => {
    const world = startRun(11);
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 120) {
      world.step(DT);
      killEverything(world);
    }
    expect(world.phase).toBe('upgrade');
    expect(world.stats.wavesCleared).toBe(1);
    expect(world.stats.kills).toBe(world.runner.spawned);
    expect(world.offer).toHaveLength(3);
  });

  it('completes when enemies cross the line (with health to spare)', () => {
    const world = startRun(12);
    world.health = 1000;
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 200) world.step(DT);
    expect(world.phase).toBe('upgrade');
    expect(world.stats.leaks).toBe(world.runner.spawned);
  });

  it('has 15 waves in 3 acts, each ending with a different boss', () => {
    expect(WAVES.total).toBe(15);
    const bosses = [5, 10, 15].map((w) => {
      const groups = buildWaveSchedule(w, new Rng(1));
      return groups.flatMap((g) => g.spawns).find((s) => isBossKind(s.kind))?.kind;
    });
    expect(bosses).toEqual(['hive', 'aegis', 'monolith']);
    expect([1, 5, 6, 10, 11, 15].map(actOf)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('a full 15-wave run ends in victory and heals between acts', () => {
    const world = startRun(5);
    world.health = 1;
    let guard = 0;
    let healedAt: number[] = [];
    while ((world.phase === 'playing' || world.phase === 'upgrade') && guard++ < 60 * 60 * 30) {
      if (world.phase === 'upgrade') {
        world.chooseUpgrade(0);
        continue;
      }
      world.step(DT);
      killEverything(world);
      for (const ev of world.drainEvents()) if (ev.type === 'actClear' && ev.healed) healedAt.push(ev.act);
    }
    expect(world.phase).toBe('victory');
    expect(world.stats.wavesCleared).toBe(15);
    expect(healedAt).toContain(1);
    expect(world.loadout.elements.length).toBe(PLAYER.elementSlots);
    healedAt = [];
  });

  it('endless mode keeps going with generated waves and cycling bosses', () => {
    expect(bossForWave(20)).toBe('hive');
    expect(bossForWave(25)).toBe('aegis');
    const world = startRun(8, { endless: true, startWave: 16, unlockAll: true });
    let guard = 0;
    while (world.wave < 18 && guard++ < 60 * 60 * 10) {
      if (world.phase === 'upgrade') world.chooseUpgrade(0);
      world.step(DT);
      killEverything(world);
    }
    expect(world.wave).toBeGreaterThanOrEqual(18);
    expect(world.phase === 'playing' || world.phase === 'upgrade').toBe(true);
  });

  it('wave layouts are deterministic for a seed and stay in the arena', () => {
    for (let w = 1; w <= 20; w++) {
      const a = buildWaveSchedule(w, new Rng(77));
      expect(a).toEqual(buildWaveSchedule(w, new Rng(77)));
      for (const g of a) for (const s of g.spawns) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(720);
      }
    }
  });
});

describe('saving between waves', () => {
  it('round-trips a run through a save', () => {
    const world = startRun(21);
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 120) {
      world.step(DT);
      killEverything(world);
    }
    const save = world.toSave();
    expect(save).not.toBeNull();
    const json = JSON.parse(JSON.stringify(save));
    const resumed = World.fromSave(json);
    expect(resumed.phase).toBe('upgrade');
    expect(resumed.offer).toEqual(world.offer);
    expect(resumed.loadout.elements).toEqual(world.loadout.elements);
    expect(resumed.stats.score).toBe(world.stats.score);
    expect(resumed.largestCascade).toBe(world.largestCascade);
    resumed.chooseUpgrade(0);
    expect(resumed.wave).toBe(2);
    expect(resumed.phase).toBe('playing');
  });

  it('only saves while choosing an upgrade', () => {
    const world = startRun(22);
    expect(world.toSave()).toBeNull();
  });
});

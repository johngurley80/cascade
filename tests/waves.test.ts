import { describe, expect, it } from 'vitest';
import { WAVES } from '../src/config';
import { Rng } from '../src/logic/rng';
import { WaveRunner, buildWaveSchedule } from '../src/logic/waves';
import { World } from '../src/logic/world';

const DT = 1 / 60;

function killEverything(world: World): void {
  for (const e of world.enemies.slice()) {
    if (!e.alive) continue;
    world.reactions.projectileHit({ element: 'fire', damage: 1e6, x: e.x, y: e.y }, e);
  }
}

describe('wave completion', () => {
  it('a wave is incomplete until every spawned enemy is resolved', () => {
    const runner = new WaveRunner(1, new Rng(4));
    let spawned = 0;
    for (let t = 0; t < 120; t += DT) spawned += runner.update(DT, false).length;
    runner.noteSpawned(spawned);
    expect(runner.allGroupsSpawned).toBe(true);
    expect(runner.complete).toBe(false);
    runner.noteResolved(spawned - 1);
    expect(runner.complete).toBe(false);
    runner.noteResolved(1);
    expect(runner.complete).toBe(true);
  });

  it('completes when all enemies are defeated', () => {
    const world = new World({ seed: 11 });
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 120) {
      world.step(DT);
      killEverything(world);
    }
    expect(world.phase).toBe('upgrade');
    expect(world.stats.wavesCleared).toBe(1);
    expect(world.stats.kills).toBe(world.runner.spawned);
    expect(world.offer.sort()).toEqual(['lightning', 'water']);
  });

  it('completes when enemies cross the line (with health to spare)', () => {
    const world = new World({ seed: 12 });
    world.health = 1000;
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 200) world.step(DT);
    expect(world.phase).toBe('upgrade');
    expect(world.stats.leaks).toBe(world.runner.spawned);
    expect(world.stats.kills).toBe(0);
  });

  it('completes with a mix of defeats and crossings', () => {
    const world = new World({ seed: 13 });
    world.health = 1000;
    let guard = 0;
    let toggle = false;
    const handled = new Set<number>();
    while (world.phase === 'playing' && guard++ < 60 * 200) {
      world.step(DT);
      for (const e of world.enemies.slice()) {
        if (e.alive && !handled.has(e.id) && e.y > 600) {
          handled.add(e.id);
          toggle = !toggle;
          if (toggle) world.reactions.projectileHit({ element: 'fire', damage: 1e6, x: e.x, y: e.y }, e);
          else e.speed = 400;
        }
      }
    }
    expect(world.phase).toBe('upgrade');
    expect(world.stats.kills + world.stats.leaks).toBe(world.runner.spawned);
    expect(world.stats.kills).toBeGreaterThan(0);
    expect(world.stats.leaks).toBeGreaterThan(0);
  });

  it('upgrade choice starts the next wave; wave 8 ends in victory', () => {
    const world = new World({ seed: 5, startWave: 8, unlockAll: true });
    let guard = 0;
    while (world.phase === 'playing' && guard++ < 60 * 400) {
      world.step(DT);
      killEverything(world);
    }
    expect(world.phase).toBe('victory');
    expect(world.stats.wavesCleared).toBe(WAVES.total);
  });

  it('wave layouts are deterministic for a seed', () => {
    const a = buildWaveSchedule(3, new Rng(77));
    const b = buildWaveSchedule(3, new Rng(77));
    expect(a).toEqual(b);
    for (const g of a) for (const s of g.spawns) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(720);
    }
  });
});

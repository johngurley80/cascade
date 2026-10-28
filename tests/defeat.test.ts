import { describe, expect, it } from 'vitest';
import { awardDefeat, damageEnemy } from '../src/logic/damage';
import { World } from '../src/logic/world';
import { makeEnemy } from './helpers';

describe('defeats and rewards', () => {
  it('marks the enemy dead immediately and reports the kill only once', () => {
    const e = makeEnemy(0, 0, 'basic', 10);
    expect(damageEnemy(e, 15)).toEqual({ dealt: 10, killed: true });
    expect(e.alive).toBe(false);
    expect(damageEnemy(e, 15)).toEqual({ dealt: 0, killed: false });
  });

  it('awards a defeat only once', () => {
    const e = makeEnemy(0, 0);
    const stats = { kills: 0, score: 0 };
    expect(awardDefeat(e, stats)).toBe(10);
    expect(awardDefeat(e, stats)).toBeNull();
    expect(stats.kills).toBe(1);
    expect(stats.score).toBe(10);
  });

  it('an enemy caught by several reactions is rewarded once, with a cascade multiplier', () => {
    const world = new World({ seed: 1, startWave: 4, unlockAll: true });
    world.drainEvents();
    const group = [world.spawnAt('basic', 300, 400), world.spawnAt('basic', 340, 400), world.spawnAt('basic', 380, 400)];
    for (const e of group) {
      e.wet = 5;
      e.hp = 3;
    }
    world.reactions.projectileHit({ element: 'lightning', damage: 50, x: 300, y: 400 }, group[0]);
    world.reactions.projectileHit({ element: 'fire', damage: 50, x: 340, y: 400 }, group[1]);
    world.reactions.flush();
    expect(world.stats.kills).toBe(3);
    expect(world.runner.resolved).toBe(3);
    // The chain hit three enemies, so later defeats in it scored more than the base 10.
    expect(world.stats.score).toBeGreaterThan(30);
    expect(world.drainEvents().filter((e) => e.type === 'kill')).toHaveLength(3);
  });

  it('an enemy that crosses the line costs health and is not rewarded', () => {
    const world = new World({ seed: 2, unlockAll: true });
    const e = world.spawnAt('basic', 360, 1030);
    world.step(0.5);
    expect(world.health).toBe(2);
    expect(e.rewarded).toBe(false);
    expect(world.stats.kills).toBe(0);
  });

  it('a boss crossing the line costs all remaining health', () => {
    const world = new World({ seed: 3, unlockAll: true });
    world.spawnAt('monolith', 360, 1030);
    world.step(1);
    expect(world.health).toBe(0);
    expect(world.phase).toBe('defeat');
  });
});

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
    expect(awardDefeat(e, stats)).toBe(true);
    expect(awardDefeat(e, stats)).toBe(false);
    expect(stats.kills).toBe(1);
    expect(stats.score).toBe(10);
  });

  it('an enemy caught by a direct hit, chain, steam and flashover is rewarded once', () => {
    const world = new World({ seed: 1, startWave: 4, unlockAll: true });
    world.drainEvents();
    const a = world.spawnAt('basic', 300, 400);
    const b = world.spawnAt('basic', 340, 400);
    const c = world.spawnAt('basic', 380, 400);
    for (const e of [a, b, c]) {
      e.wet = 5;
      e.hp = 3;
    }
    world.reactions.projectileHit({ element: 'lightning', damage: 50, x: a.x, y: a.y }, a);
    world.reactions.projectileHit({ element: 'fire', damage: 50, x: b.x, y: b.y }, b);
    world.reactions.projectileHit({ element: 'fire', damage: 50, x: a.x, y: a.y }, a);
    world.reactions.flush();
    expect(world.stats.kills).toBe(3);
    expect(world.stats.score).toBe(30);
    expect(world.runner.resolved).toBe(3);
    expect(world.drainEvents().filter((e) => e.type === 'kill')).toHaveLength(3);
  });

  it('an enemy that crosses the line costs health and is not rewarded', () => {
    const world = new World({ seed: 2 });
    const e = world.spawnAt('basic', 360, 1030);
    world.step(1 / 60);
    world.step(0.5);
    expect(world.health).toBe(2);
    expect(e.rewarded).toBe(false);
    expect(world.stats.kills).toBe(0);
    expect(world.enemies.includes(e)).toBe(false);
  });

  it('the boss crossing the line costs all remaining health', () => {
    const world = new World({ seed: 3, startWave: 8 });
    world.spawnAt('boss', 360, 1030);
    world.step(1);
    expect(world.health).toBe(0);
    expect(world.phase).toBe('defeat');
  });
});

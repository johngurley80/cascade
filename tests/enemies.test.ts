import { describe, expect, it } from 'vitest';
import { BOSS, ENEMIES } from '../src/config';
import { World } from '../src/logic/world';
import { makeEnemy, setup, shoot } from './helpers';

describe('enemy traits', () => {
  it('shields block direct hits until a reaction breaks them', () => {
    const s = makeEnemy(200, 200, 'basic', 100, { shield: true });
    const other = makeEnemy(250, 200, 'basic', 100);
    s.wet = 3;
    const { host, engine } = setup([s, other]);
    shoot(engine, 'fire', s, 10);
    expect(s.hp).toBe(100);
    expect(host.eventsOf('shieldBlock')).toHaveLength(1);
    // The fire hit still consumed wet: the steam breaks the shield.
    engine.flush();
    expect(s.traits.shield).toBe(true); // steam never hits its own source
    other.wet = 3;
    shoot(engine, 'fire', other, 10);
    engine.flush();
    expect(s.traits.shield).toBe(false);
    expect(s.hp).toBeLessThan(100);
  });

  it('shields wear out after enough direct hits', () => {
    const s = makeEnemy(200, 200, 'basic', 100, { shield: true });
    const { engine } = setup([s]);
    for (let i = 0; i < 4; i++) shoot(engine, 'water', s, 10);
    expect(s.traits.shield).toBe(false);
    expect(s.hp).toBe(100);
    shoot(engine, 'water', s, 10);
    expect(s.hp).toBe(90);
  });

  it('poison eats through shields', () => {
    const s = makeEnemy(200, 200, 'basic', 100, { shield: true });
    const { engine } = setup([s]);
    shoot(engine, 'toxin', s, 6);
    expect(s.traits.shield).toBe(false);
    expect(s.hp).toBeLessThan(100);
  });

  it('fireproof enemies do not burn and take half fire damage', () => {
    const f = makeEnemy(200, 200, 'basic', 100, { fireproof: true });
    const { engine } = setup([f]);
    shoot(engine, 'fire', f, 10);
    expect(f.burn).toBeNull();
    expect(f.hp).toBe(95);
  });

  it('splitters split into two splitlings that count towards the wave', () => {
    const world = new World({ seed: 1, unlockAll: true });
    world.drainEvents();
    const sp = world.spawnAt('splitter', 360, 400);
    const before = world.runner.spawned;
    world.reactions.projectileHit({ element: 'fire', damage: 1000, x: sp.x, y: sp.y }, sp);
    world.step(1 / 60);
    const kids = world.enemies.filter((e) => e.kind === 'splitling');
    expect(kids).toHaveLength(2);
    expect(world.runner.spawned).toBeGreaterThanOrEqual(before + 2);
  });

  it('volatile enemies detonate when defeated', () => {
    const v = makeEnemy(200, 200, 'volatile', 1);
    const others = [makeEnemy(250, 200, 'volatile', 1), makeEnemy(300, 200, 'basic', 100)];
    const { host, engine } = setup([v, ...others]);
    shoot(engine, 'water', v, 5);
    engine.flush();
    expect(host.eventsOf('blast').filter((b) => b.kind === 'detonation')).toHaveLength(2);
    expect(others[1].hp).toBeLessThan(100);
  });

  it('elites are bigger, tougher and worth more', () => {
    const world = new World({ seed: 1 });
    const e = world.spawnAt('basic', 300, 400, 1, { elite: true });
    expect(e.maxHp).toBeGreaterThan(ENEMIES.basic.hp * 2);
    expect(e.radius).toBeGreaterThan(ENEMIES.basic.radius);
    world.reactions.projectileHit({ element: 'fire', damage: 1e6, x: e.x, y: e.y }, e);
    expect(world.stats.score).toBe(30);
  });

  it('the Aegis boss takes reduced direct damage', () => {
    const world = new World({ seed: 1 });
    const boss = world.spawnAt('aegis', 360, 300);
    world.reactions.projectileHit({ element: 'water', damage: 100, x: boss.x, y: boss.y }, boss);
    expect(boss.maxHp - boss.hp).toBeCloseTo(100 * BOSS.aegisDirectMult);
  });

  it('the Hive sheds splitlings as its health drops', () => {
    const world = new World({ seed: 1, unlockAll: true });
    const hive = world.spawnAt('hive', 360, 300);
    hive.hp = hive.maxHp * 0.4;
    world.step(1 / 60);
    expect(world.enemies.filter((e) => e.kind === 'splitling').length).toBe(10);
  });
});

import { describe, expect, it } from 'vitest';
import { REACTIONS } from '../src/config';
import { makeEnemy, setup } from './helpers';

describe('fire and water', () => {
  it('fire on a wet enemy consumes wet and creates a steam burst that damages nearby enemies', () => {
    const target = makeEnemy(200, 200, 'basic', 100);
    const near = makeEnemy(250, 200, 'basic', 100);
    const far = makeEnemy(500, 200, 'basic', 100);
    target.wet = 3;
    const { host, engine } = setup([target, near, far]);
    const cascade = engine.projectileHit({ element: 'fire', damage: 10, x: 200, y: 200 }, target);
    expect(target.wet).toBe(0);
    expect(target.burn).not.toBeNull();
    expect(engine.pending).toHaveLength(1);
    engine.flush();
    const steam = host.eventsOf('steam');
    expect(steam).toHaveLength(1);
    expect(steam[0].generation).toBe(1);
    expect(near.hp).toBe(100 - REACTIONS.steam.damage);
    expect(far.hp).toBe(100);
    // Steam never damages its source again and never applies wet.
    expect(target.hp).toBe(90);
    expect(near.wet).toBe(0);
    expect(cascade.hits.size).toBe(2);
  });

  it('fire on a dry enemy only burns', () => {
    const target = makeEnemy(200, 200, 'basic', 100);
    const near = makeEnemy(240, 200, 'basic', 100);
    const { host, engine } = setup([target, near]);
    engine.projectileHit({ element: 'fire', damage: 10, x: 200, y: 200 }, target);
    engine.flush();
    expect(host.eventsOf('steam')).toHaveLength(0);
    expect(near.hp).toBe(100);
  });

  it('water splash wets nearby enemies and does not remove burn', () => {
    const target = makeEnemy(200, 200, 'basic', 100);
    const near = makeEnemy(250, 210, 'basic', 100);
    const far = makeEnemy(600, 200, 'basic', 100);
    const { engine } = setup([target, near, far]);
    engine.projectileHit({ element: 'fire', damage: 1, x: 200, y: 200 }, target);
    engine.projectileHit({ element: 'water', damage: 5, x: 200, y: 200 }, target);
    expect(target.wet).toBeGreaterThan(0);
    expect(near.wet).toBeGreaterThan(0);
    expect(far.wet).toBe(0);
    expect(target.burn).not.toBeNull();
  });

  it('a water-then-fire combo hits a whole cluster through steam', () => {
    const cluster = [
      makeEnemy(300, 300),
      makeEnemy(346, 300),
      makeEnemy(254, 300),
      makeEnemy(323, 260),
      makeEnemy(277, 260),
      makeEnemy(323, 340),
      makeEnemy(277, 340),
    ];
    const { engine } = setup(cluster);
    engine.projectileHit({ element: 'water', damage: 5, x: 300, y: 300 }, cluster[0]);
    expect(cluster.every((e) => e.wet > 0)).toBe(true);
    const cascade = engine.projectileHit({ element: 'fire', damage: 10, x: 300, y: 300 }, cluster[0]);
    engine.flush();
    expect(cascade.hits.size).toBe(7);
  });
});

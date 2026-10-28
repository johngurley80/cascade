import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../src/config';
import { makeEnemy, setup } from './helpers';

describe('lightning chaining', () => {
  it('only deals direct damage to a non-wet enemy', () => {
    const a = makeEnemy(100, 100, 'basic', 100);
    const b = makeEnemy(140, 100, 'basic', 100);
    b.wet = 3;
    const { host, engine } = setup([a, b]);
    engine.projectileHit({ element: 'lightning', damage: 9, x: a.x, y: a.y }, a);
    expect(a.hp).toBe(91);
    expect(b.hp).toBe(100);
    expect(host.eventsOf('chain')).toHaveLength(0);
  });

  it('chains from a wet target to other wet enemies only', () => {
    const a = makeEnemy(100, 100, 'basic', 100);
    const wet1 = makeEnemy(160, 100, 'basic', 100);
    const dry = makeEnemy(130, 140, 'basic', 100);
    const wet2 = makeEnemy(220, 100, 'basic', 100);
    a.wet = wet1.wet = wet2.wet = 3;
    const { host, engine } = setup([a, wet1, dry, wet2]);
    const cascade = engine.projectileHit({ element: 'lightning', damage: 9, x: a.x, y: a.y }, a);
    expect(wet1.hp).toBe(100 - ELEMENTS.lightning.chainDamage);
    expect(wet2.hp).toBe(100 - ELEMENTS.lightning.chainDamage);
    expect(dry.hp).toBe(100);
    expect(cascade.hits.size).toBe(3);
    const chain = host.eventsOf('chain')[0];
    expect(chain.links).toHaveLength(2);
  });

  it('chains to at most four additional wet enemies, each hit once', () => {
    const origin = makeEnemy(300, 300, 'basic', 1000);
    const others = Array.from({ length: 8 }, (_, i) =>
      makeEnemy(300 + Math.cos(i) * 60, 300 + Math.sin(i) * 60, 'basic', 1000),
    );
    for (const e of [origin, ...others]) e.wet = 5;
    const { host, engine } = setup([origin, ...others]);
    const cascade = engine.projectileHit({ element: 'lightning', damage: 9, x: 300, y: 300 }, origin);
    const chained = others.filter((e) => e.hp < 1000);
    expect(chained).toHaveLength(ELEMENTS.lightning.chainTargets);
    for (const e of chained) expect(e.hp).toBe(1000 - ELEMENTS.lightning.chainDamage);
    expect(origin.hp).toBe(1000 - 9);
    expect(cascade.hits.size).toBe(5);
    const links = host.eventsOf('chain')[0].links;
    expect(links).toHaveLength(4);
    // Every link ends at a distinct target.
    expect(new Set(links.map((l) => `${l.x2},${l.y2}`)).size).toBe(4);
  });

  it('does not chain beyond its range', () => {
    const a = makeEnemy(100, 100, 'basic', 100);
    const far = makeEnemy(100 + ELEMENTS.lightning.chainRange + 30, 100, 'basic', 100);
    a.wet = far.wet = 3;
    const { engine } = setup([a, far]);
    engine.projectileHit({ element: 'lightning', damage: 9, x: a.x, y: a.y }, a);
    expect(far.hp).toBe(100);
  });
});

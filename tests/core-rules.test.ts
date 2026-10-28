import { describe, expect, it } from 'vitest';
import { ELEMENTS, REACTIONS } from '../src/config';
import { applyBurn } from '../src/logic/status';
import { cluster, makeEnemy, setup, shoot } from './helpers';

describe('lightning chaining', () => {
  it('only deals direct damage to a non-wet enemy', () => {
    const [a, b] = [makeEnemy(100, 100, 'basic', 100), makeEnemy(140, 100, 'basic', 100)];
    b.wet = 3;
    const { host, engine } = setup([a, b]);
    shoot(engine, 'lightning', a, 9);
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
    const { engine } = setup([a, wet1, dry, wet2]);
    const cascade = shoot(engine, 'lightning', a, 9);
    expect(wet1.hp).toBe(100 - ELEMENTS.lightning.chainDamage);
    expect(wet2.hp).toBe(100 - ELEMENTS.lightning.chainDamage);
    expect(dry.hp).toBe(100);
    expect(cascade.hits.size).toBe(3);
  });

  it('chains to at most four additional wet enemies, each hit once', () => {
    const origin = makeEnemy(300, 300, 'basic', 1000);
    const others = Array.from({ length: 8 }, (_, i) => makeEnemy(300 + Math.cos(i) * 60, 300 + Math.sin(i) * 60, 'basic', 1000));
    for (const e of [origin, ...others]) e.wet = 5;
    const { host, engine } = setup([origin, ...others]);
    const cascade = shoot(engine, 'lightning', origin, 9);
    const chained = others.filter((e) => e.hp < 1000);
    expect(chained).toHaveLength(4);
    for (const e of chained) expect(e.hp).toBe(1000 - ELEMENTS.lightning.chainDamage);
    expect(cascade.hits.size).toBe(5);
    const links = host.eventsOf('chain')[0].links;
    expect(new Set(links.map((l) => `${l.x2},${l.y2}`)).size).toBe(4);
  });

  it('Long Chain raises the limit', () => {
    const g = cluster(300, 300, 9, 1000);
    for (const e of g) e.wet = 5;
    const { engine } = setup(g, { longChain: 1 });
    expect(shoot(engine, 'lightning', g[0]).hits.size).toBe(1 + ELEMENTS.lightning.chainTargets + ELEMENTS.lightning.longChainBonus);
  });

  it('insulated enemies block the chain', () => {
    const g = cluster(300, 300, 7, 1000);
    for (const e of g) {
      e.wet = 5;
      e.traits.insulated = true;
    }
    g[0].traits.insulated = false;
    const { engine } = setup(g);
    expect(shoot(engine, 'lightning', g[0]).hits.size).toBe(1);
  });
});

describe('fire and water', () => {
  it('fire on wet consumes wet into steam that damages nearby enemies but never wets', () => {
    const target = makeEnemy(200, 200, 'basic', 100);
    const near = makeEnemy(250, 200, 'basic', 100);
    const far = makeEnemy(500, 200, 'basic', 100);
    target.wet = 3;
    const { host, engine } = setup([target, near, far]);
    shoot(engine, 'fire', target, 10);
    expect(target.wet).toBe(0);
    expect(target.burn).not.toBeNull();
    expect(engine.pending).toHaveLength(1);
    engine.flush();
    const steam = host.eventsOf('blast').filter((b) => b.kind === 'steam');
    expect(steam).toHaveLength(1);
    expect(steam[0].generation).toBe(1);
    expect(near.hp).toBe(100 - REACTIONS.steam.damage);
    expect(far.hp).toBe(100);
    expect(target.hp).toBe(90);
    expect(near.wet).toBe(0);
    expect(engine.clouds).toHaveLength(1);
  });

  it('water splash wets neighbours and does not remove burn', () => {
    const [t, near, far] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(250, 210, 'basic', 100), makeEnemy(600, 200, 'basic', 100)];
    applyBurn(t, null, 0);
    const { engine } = setup([t, near, far]);
    shoot(engine, 'water', t, 5);
    expect(t.wet).toBeGreaterThan(0);
    expect(near.wet).toBeGreaterThan(0);
    expect(far.wet).toBe(0);
    expect(t.burn).not.toBeNull();
  });

  it('water then fire hits a whole cluster', () => {
    const g = cluster(300, 300);
    const { engine } = setup(g);
    shoot(engine, 'water', g[0]);
    const cascade = shoot(engine, 'fire', g[0]);
    engine.flush();
    expect(cascade.hits.size).toBe(7);
  });
});

describe('wind and void move enemies', () => {
  it('a gust pulls neighbours towards the impact', () => {
    const [t, e] = [makeEnemy(300, 300, 'basic', 100), makeEnemy(400, 300, 'basic', 100)];
    const { engine } = setup([t, e]);
    shoot(engine, 'wind', t);
    expect(e.x).toBeLessThan(400);
    expect(t.y).toBeLessThan(300);
  });

  it('a singularity drags enemies in, then collapses', () => {
    const [t, e] = [makeEnemy(300, 300, 'basic', 100), makeEnemy(390, 300, 'basic', 100)];
    const { host, engine } = setup([t, e]);
    shoot(engine, 'void', t, 0);
    engine.update(0.5);
    expect(e.x).toBeLessThan(390);
    engine.update(1);
    expect(engine.singularities).toHaveLength(0);
    expect(host.eventsOf('blast').some((b) => b.kind === 'collapse')).toBe(true);
    expect(e.hp).toBeLessThan(100);
  });
});

describe('toxin', () => {
  it('poison ticks and corroded enemies take extra damage', () => {
    const a = makeEnemy(200, 200, 'basic', 100);
    const { engine } = setup([a]);
    shoot(engine, 'toxin', a, 0);
    expect(a.poison).not.toBeNull();
    const before = a.hp;
    shoot(engine, 'water', a, 10);
    expect(before - a.hp).toBeCloseTo(10 * ELEMENTS.toxin.corrodeMult);
  });
});

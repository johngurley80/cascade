import { describe, expect, it } from 'vitest';
import { ELEMENTS, REACTIONS } from '../src/config';
import { REACTION_INFO } from '../src/logic/codex';
import { applyBurn, applyFreeze, applyPoison } from '../src/logic/status';
import type { ReactionId } from '../src/logic/types';
import { cluster, makeEnemy, setup, shoot } from './helpers';

/**
 * One scenario per codex entry: each must actually happen through gameplay
 * rules, and the table must not contain reactions the codex doesn't list.
 */
const SCENARIOS: Record<ReactionId, () => Set<ReactionId>> = {
  steam: () => {
    const [a, b] = [makeEnemy(200, 200), makeEnemy(250, 200)];
    a.wet = 3;
    const { host, engine } = setup([a, b]);
    shoot(engine, 'fire', a);
    engine.flush();
    return host.reactions();
  },
  chain: () => {
    const g = cluster(300, 300);
    for (const e of g) e.wet = 3;
    const { host, engine } = setup(g);
    shoot(engine, 'lightning', g[0]);
    return host.reactions();
  },
  overload: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(250, 200, 'basic', 100)];
    applyBurn(a, null, 0);
    const { host, engine } = setup([a, b]);
    shoot(engine, 'lightning', a);
    engine.flush();
    expect(host.eventsOf('blast').some((b) => b.kind === 'overload')).toBe(true);
    expect(b.hp).toBeLessThan(100);
    return host.reactions();
  },
  conductive: () => {
    const g = cluster(300, 300);
    const { host, engine } = setup(g);
    engine.clouds.push({ id: 1, x: 300, y: 300, radius: 120, life: 2, maxLife: 2 });
    shoot(engine, 'lightning', g[0]);
    expect(host.eventsOf('chain')[0].links.length).toBe(Math.min(6, ELEMENTS.lightning.chainTargets));
    return host.reactions();
  },
  freeze: () => {
    const a = makeEnemy(200, 200);
    a.wet = 3;
    const { host, engine } = setup([a]);
    shoot(engine, 'frost', a);
    expect(a.frozen).toBeGreaterThan(0);
    expect(a.wet).toBe(0);
    return host.reactions();
  },
  shatter: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(250, 200, 'basic', 100)];
    applyFreeze(a);
    const { host, engine } = setup([a, b]);
    shoot(engine, 'water', a);
    engine.flush();
    expect(a.frozen).toBe(0);
    expect(b.hp).toBe(100 - REACTIONS.shatter.damage);
    return host.reactions();
  },
  thaw: () => {
    const a = makeEnemy(200, 200, 'basic', 100);
    applyFreeze(a);
    const { host, engine } = setup([a]);
    shoot(engine, 'fire', a);
    expect(a.frozen).toBe(0);
    expect(a.wet).toBeGreaterThan(0);
    return host.reactions();
  },
  thermalShock: () => {
    const a = makeEnemy(200, 200, 'basic', 100);
    applyBurn(a, null, 0);
    const { host, engine } = setup([a]);
    shoot(engine, 'frost', a, 0);
    expect(a.burn).toBeNull();
    expect(a.hp).toBe(100 - ELEMENTS.frost.thermalShockBonus);
    return host.reactions();
  },
  firestorm: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(280, 200, 'basic', 100)];
    applyBurn(a, null, 0);
    const { host, engine } = setup([a, b]);
    shoot(engine, 'wind', a);
    expect(b.burn).not.toBeNull();
    return host.reactions();
  },
  squall: () => {
    const [a, b] = [makeEnemy(200, 200), makeEnemy(340, 200)];
    a.wet = 3;
    const { host, engine } = setup([a, b]);
    shoot(engine, 'wind', a);
    expect(b.wet).toBeGreaterThan(0);
    return host.reactions();
  },
  steamFront: () => {
    const a = makeEnemy(200, 200);
    const { host, engine } = setup([a]);
    engine.clouds.push({ id: 1, x: 200, y: 200, radius: 80, life: 1, maxLife: 1 });
    shoot(engine, 'wind', a);
    expect(engine.clouds[0].radius).toBeGreaterThan(80);
    return host.reactions();
  },
  ignition: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(260, 200, 'basic', 100)];
    applyPoison(a, null, 0);
    const { host, engine } = setup([a, b]);
    shoot(engine, 'fire', a);
    engine.flush();
    expect(a.poison).toBeNull();
    expect(b.burn).not.toBeNull();
    return host.reactions();
  },
  brittle: () => {
    const a = makeEnemy(200, 200, 'basic', 100);
    applyPoison(a, null, 0);
    const { host, engine } = setup([a]);
    shoot(engine, 'frost', a, 0);
    expect(a.frozen).toBeGreaterThan(0);
    expect(a.brittle).toBe(true);
    return host.reactions();
  },
  toxicSplash: () => {
    const [a, b] = [makeEnemy(200, 200), makeEnemy(250, 200)];
    applyPoison(a, null, 0);
    const { host, engine } = setup([a, b]);
    shoot(engine, 'water', a);
    expect(b.poison).not.toBeNull();
    return host.reactions();
  },
  arcStorm: () => {
    const g = cluster(300, 300);
    const { host, engine } = setup(g);
    shoot(engine, 'void', g[1]);
    shoot(engine, 'lightning', g[0]);
    const chain = host.eventsOf('chain').find((c) => c.arc);
    expect(chain?.links.length).toBe(6);
    return host.reactions();
  },
  flashover: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 1), makeEnemy(260, 200, 'basic', 100)];
    const { host, engine } = setup([a, b], { flashover: 1 });
    shoot(engine, 'fire', a, 10);
    engine.flush();
    expect(b.burn).not.toBeNull();
    return host.reactions();
  },
  stormRelay: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 1), makeEnemy(320, 200, 'basic', 100)];
    const { host, engine } = setup([a, b], { stormRelay: 1 });
    shoot(engine, 'lightning', a, 10);
    engine.flush();
    expect(b.hp).toBeLessThan(100);
    return host.reactions();
  },
  detonation: () => {
    const [a, b] = [makeEnemy(200, 200, 'volatile', 1), makeEnemy(260, 200, 'basic', 100)];
    const { host, engine } = setup([a, b]);
    shoot(engine, 'fire', a, 10);
    engine.flush();
    expect(b.hp).toBe(100 - REACTIONS.detonation.damage);
    return host.reactions();
  },
  superheatedSteam: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(250, 200, 'basic', 100)];
    a.wet = 3;
    const { host, engine } = setup([a, b], { superheatedSteam: 1 });
    shoot(engine, 'fire', a);
    engine.flush();
    expect(b.burn).not.toBeNull();
    return host.reactions();
  },
  permafrost: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(250, 200, 'basic', 100)];
    applyFreeze(a);
    b.wet = 3;
    const { host, engine } = setup([a, b], { permafrost: 1 });
    shoot(engine, 'water', a, 0);
    engine.flush();
    expect(b.frozen).toBeGreaterThan(0);
    return host.reactions();
  },
  toxicStorm: () => {
    const [a, b] = [makeEnemy(200, 200, 'basic', 100), makeEnemy(290, 200, 'basic', 100)];
    applyPoison(a, null, 0);
    const { host, engine } = setup([a, b], { toxicStorm: 1 });
    shoot(engine, 'wind', a);
    expect(b.poison).not.toBeNull();
    return host.reactions();
  },
  plasmaArc: () => {
    const g = cluster(300, 300);
    for (const e of g) e.wet = 3;
    const { host, engine } = setup(g, { plasmaArc: 1 });
    shoot(engine, 'lightning', g[0]);
    expect(g.filter((e) => e.burn).length).toBe(Math.min(7, ELEMENTS.lightning.chainTargets + 1));
    return host.reactions();
  },
  gravityWell: () => {
    const g = cluster(300, 300, 4);
    const { host, engine } = setup(g, { gravityWell: 1 });
    shoot(engine, 'void', g[1]);
    shoot(engine, 'wind', g[0]);
    expect(engine.singularities).toHaveLength(0);
    expect(host.eventsOf('blast').some((b) => b.kind === 'collapse')).toBe(true);
    return host.reactions();
  },
  acidRain: () => {
    const [a, b] = [makeEnemy(200, 200), makeEnemy(250, 200)];
    const { host, engine } = setup([a, b], { acidRain: 1 });
    shoot(engine, 'water', a);
    expect(b.poison).not.toBeNull();
    return host.reactions();
  },
};

describe('reaction table', () => {
  it('has a codex entry for every reaction and vice versa', () => {
    expect(new Set(REACTION_INFO.map((r) => r.id))).toEqual(new Set(Object.keys(SCENARIOS)));
  });

  for (const info of REACTION_INFO) {
    it(`${info.name} (${info.recipe}) happens in play`, () => {
      expect(SCENARIOS[info.id]()).toContain(info.id);
    });
  }

  it('upgrade-gated reactions do not happen without their upgrade', () => {
    const g = cluster(300, 300);
    for (const e of g) e.wet = 3;
    const { host, engine } = setup(g);
    shoot(engine, 'lightning', g[0]);
    expect(g.some((e) => e.burn)).toBe(false);
    expect(host.reactions().has('plasmaArc')).toBe(false);
  });
});

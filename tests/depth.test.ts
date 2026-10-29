import { describe, expect, it } from 'vitest';
import { REACTIONS } from '../src/config';
import { applyBurn, applyFreeze } from '../src/logic/status';
import { makeEnemy, setup, shoot } from './helpers';

describe('bounded propagation', () => {
  it('a Flashover chain stops at the configured generation limit but still cascades', () => {
    const line = Array.from({ length: 12 }, (_, i) => makeEnemy(60 + i * 100, 400, 'basic', 1));
    const { host, engine } = setup(line, { flashover: 1 });
    for (const e of line) applyBurn(e, null, 0);
    const cascade = shoot(engine, 'fire', line[0], 10);
    engine.flush();
    const explosions = host.eventsOf('blast').filter((b) => b.kind === 'flashover');
    expect(explosions.length).toBe(REACTIONS.maxGeneration);
    expect(cascade.maxGeneration).toBe(REACTIONS.maxGeneration);
    expect(host.defeats).toHaveLength(REACTIONS.maxGeneration + 1);
    expect(line.slice(REACTIONS.maxGeneration + 1).every((e) => e.alive)).toBe(true);
    expect(engine.stats.depthLimited).toBeGreaterThan(0);
    expect(engine.pending).toHaveLength(0);
  });

  it('Catalyst allows exactly the configured extra generations', () => {
    const line = Array.from({ length: 12 }, (_, i) => makeEnemy(60 + i * 100, 400, 'basic', 1));
    const { host, engine } = setup(line, { flashover: 1, catalyst: 1 });
    for (const e of line) applyBurn(e, null, 0);
    shoot(engine, 'fire', line[0], 10);
    engine.flush();
    expect(host.eventsOf('blast').filter((b) => b.kind === 'flashover').length).toBe(REACTIONS.maxGeneration + REACTIONS.catalystBonus);
  });

  it('chains of shatters terminate', () => {
    const line = Array.from({ length: 12 }, (_, i) => makeEnemy(60 + i * 70, 400, 'basic', 1000));
    for (const e of line) applyFreeze(e);
    const { host, engine } = setup(line);
    shoot(engine, 'water', line[0], 0);
    engine.flush();
    const gens = host.eventsOf('blast').map((b) => b.generation);
    expect(Math.max(...gens)).toBeLessThanOrEqual(REACTIONS.maxGeneration);
    expect(line.some((e) => e.frozen > 0)).toBe(true);
  });

  it('a burn defeat inherits the depth of the reaction that ignited it', () => {
    const victim = makeEnemy(100, 100, 'basic', 1);
    const neighbour = makeEnemy(160, 100, 'basic', 50);
    const { host, engine } = setup([victim, neighbour], { flashover: 1 });
    const cascade = engine.startCascade(100, 100);
    applyBurn(victim, cascade, REACTIONS.maxGeneration);
    engine.dotTick(victim, 5, 'burn');
    engine.flush();
    expect(victim.alive).toBe(false);
    expect(host.eventsOf('blast')).toHaveLength(0);
    expect(engine.stats.depthLimited).toBe(1);
  });

  it('a dense swarm with every upgrade terminates and rewards each enemy once', () => {
    const swarm = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) swarm.push(makeEnemy(60 + c * 60, 200 + r * 60, r % 3 === 0 ? 'volatile' : 'basic', 4));
    for (const e of swarm) e.wet = 5;
    const all = { flashover: 1, stormRelay: 1, superheatedSteam: 1, permafrost: 1, plasmaArc: 1, catalyst: 1, virulence: 1, longChain: 1 };
    const { host, engine } = setup(swarm, all);
    shoot(engine, 'fire', swarm[0], 10);
    shoot(engine, 'lightning', swarm[45], 10);
    shoot(engine, 'void', swarm[60], 1);
    shoot(engine, 'frost', swarm[30], 1);
    shoot(engine, 'toxin', swarm[20], 1);
    shoot(engine, 'wind', swarm[21], 1);
    engine.flush();
    expect(engine.pending).toHaveLength(0);
    const gens = host.events.flatMap((e) => ('generation' in e ? [e.generation] : []));
    expect(Math.max(...gens)).toBeLessThanOrEqual(REACTIONS.maxGeneration + REACTIONS.catalystBonus);
    const ids = host.defeats.map((d) => d.enemy.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps pending reactions and steam clouds', () => {
    const many = Array.from({ length: 120 }, (_, i) => makeEnemy((i % 12) * 50 + 30, Math.floor(i / 12) * 50 + 30, 'basic', 1));
    for (const e of many) e.wet = 5;
    const { engine } = setup(many);
    for (const e of many.slice(0, 80)) shoot(engine, 'fire', e, 0.5);
    expect(engine.pending.length).toBeLessThanOrEqual(REACTIONS.maxPendingReactions);
    engine.flush();
    expect(engine.clouds.length).toBeLessThanOrEqual(REACTIONS.maxSteamClouds);
  });
});

import { describe, expect, it } from 'vitest';
import { REACTIONS } from '../src/config';
import { applyBurn } from '../src/logic/status';
import { makeEnemy, setup } from './helpers';

describe('bounded propagation', () => {
  it('a Flashover chain stops at the configured generation limit but still cascades', () => {
    // A long line of fragile, burning enemies: each explosion reaches only the next one.
    const line = Array.from({ length: 12 }, (_, i) => makeEnemy(60 + i * 80, 400, 'basic', 1));
    const { host, engine } = setup(line);
    host.modifiers.flashover = true;
    for (const e of line) applyBurn(e, null, 0);

    const cascade = engine.projectileHit({ element: 'fire', damage: 10, x: line[0].x, y: line[0].y }, line[0]);
    engine.flush();

    const explosions = host.eventsOf('flashover');
    expect(explosions.length).toBe(REACTIONS.maxGeneration);
    expect(Math.max(...explosions.map((e) => e.generation))).toBe(REACTIONS.maxGeneration);
    expect(cascade.maxGeneration).toBe(REACTIONS.maxGeneration);
    // Origin + one enemy per generation were defeated; the rest of the line survives.
    expect(host.defeats).toHaveLength(REACTIONS.maxGeneration + 1);
    expect(line.slice(REACTIONS.maxGeneration + 1).every((e) => e.alive)).toBe(true);
    expect(engine.stats.depthLimited).toBeGreaterThan(0);
    expect(engine.pending).toHaveLength(0);
  });

  it('Storm relay chains also count as generations and terminate', () => {
    const line = Array.from({ length: 12 }, (_, i) => makeEnemy(40 + i * 150, 600, 'basic', 1));
    const { host, engine } = setup(line);
    host.modifiers.stormRelay = true;
    engine.projectileHit({ element: 'lightning', damage: 10, x: line[0].x, y: line[0].y }, line[0]);
    engine.flush();
    const relays = host.eventsOf('chain').filter((c) => c.relay);
    expect(relays.length).toBeGreaterThan(0);
    expect(Math.max(...relays.map((r) => r.generation))).toBeLessThanOrEqual(REACTIONS.maxGeneration);
    expect(engine.pending).toHaveLength(0);
    expect(line.some((e) => e.alive)).toBe(true);
  });

  it('a burn defeat inherits the depth of the reaction that ignited it', () => {
    const victim = makeEnemy(100, 100, 'basic', 1);
    const neighbour = makeEnemy(160, 100, 'basic', 50);
    const { host, engine } = setup([victim, neighbour]);
    host.modifiers.flashover = true;
    const cascade = engine.startCascade(100, 100);
    applyBurn(victim, cascade, REACTIONS.maxGeneration);
    engine.burnTick(victim, 5);
    engine.flush();
    expect(victim.alive).toBe(false);
    expect(host.eventsOf('flashover')).toHaveLength(0);
    expect(engine.stats.depthLimited).toBe(1);
  });

  it('mixed steam / flashover / relay cascades terminate in a dense, fragile swarm', () => {
    const swarm = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) swarm.push(makeEnemy(60 + c * 60, 200 + r * 60, 'basic', 4));
    for (const e of swarm) e.wet = 5;
    const { host, engine } = setup(swarm);
    host.modifiers.flashover = true;
    host.modifiers.stormRelay = true;
    host.modifiers.splashRadius = 140;
    engine.projectileHit({ element: 'fire', damage: 10, x: swarm[0].x, y: swarm[0].y }, swarm[0]);
    engine.projectileHit({ element: 'lightning', damage: 10, x: swarm[45].x, y: swarm[45].y }, swarm[45]);
    engine.flush();
    expect(engine.pending).toHaveLength(0);
    const gens = host.events.flatMap((e) => ('generation' in e ? [e.generation] : []));
    expect(Math.max(...gens)).toBeLessThanOrEqual(REACTIONS.maxGeneration);
    // Each enemy is defeated (and reported) at most once.
    const ids = host.defeats.map((d) => d.enemy.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps the number of pending secondary reactions', () => {
    const many = Array.from({ length: 120 }, (_, i) => makeEnemy((i % 12) * 50 + 30, Math.floor(i / 12) * 50 + 30, 'basic', 1));
    for (const e of many) e.wet = 5;
    const { engine } = setup(many);
    for (const e of many.slice(0, 80)) {
      engine.projectileHit({ element: 'fire', damage: 0.5, x: e.x, y: e.y }, e);
    }
    expect(engine.pending.length).toBeLessThanOrEqual(REACTIONS.maxPendingReactions);
  });
});

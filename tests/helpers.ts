import { ENEMIES, type EnemyKind } from '../src/config';
import { ReactionEngine, type ReactionHost } from '../src/logic/reactions';
import type { Cascade, DamageSource, Enemy, EnemyTraits, GameEvent, ModifierId, ReactionId } from '../src/logic/types';
import { createLoadout } from '../src/logic/upgrades';

let nextId = 1;

export function makeEnemy(x: number, y: number, kind: EnemyKind = 'basic', hp?: number, traits: Partial<EnemyTraits> = {}): Enemy {
  const s = ENEMIES[kind];
  return {
    id: nextId++,
    kind,
    traits: { shield: false, insulated: false, fireproof: false, elite: false, ...traits },
    x,
    y,
    radius: s.radius,
    hp: hp ?? s.hp,
    maxHp: hp ?? s.hp,
    speed: s.speed,
    alive: true,
    rewarded: false,
    wet: 0,
    burn: null,
    poison: null,
    chill: 0,
    frozen: 0,
    brittle: false,
    flash: 0,
    age: 0,
    supportTimer: 0,
    splits: 0,
    shieldHits: 4,
  };
}

export class TestHost implements ReactionHost {
  enemies: Enemy[] = [];
  events: GameEvent[] = [];
  defeats: { enemy: Enemy; cause: DamageSource }[] = [];
  levels: Record<ModifierId, number> = createLoadout().levels;
  time = 0;
  emit(event: GameEvent): void {
    this.events.push(event);
  }
  onDefeat(enemy: Enemy, cause: DamageSource, _cascade: Cascade | null): void {
    this.defeats.push({ enemy, cause });
  }
  eventsOf<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];
  }
  reactions(): Set<ReactionId> {
    return new Set(this.eventsOf('reaction').map((r) => r.id));
  }
}

export function setup(enemies: Enemy[] = [], upgrades: Partial<Record<ModifierId, number>> = {}): { host: TestHost; engine: ReactionEngine } {
  const host = new TestHost();
  host.enemies = enemies;
  Object.assign(host.levels, upgrades);
  return { host, engine: new ReactionEngine(host) };
}

/** Fire a projectile of `element` at `target` with the given damage. */
export function shoot(engine: ReactionEngine, element: Parameters<ReactionEngine['projectileHit']>[0]['element'], target: Enemy, damage = 1): Cascade {
  return engine.projectileHit({ element, damage, x: target.x, y: target.y }, target);
}

/** A tight hex cluster of `n` basic enemies around (x, y). */
export function cluster(x: number, y: number, n = 7, hp = 100): Enemy[] {
  const out = [makeEnemy(x, y, 'basic', hp)];
  for (let i = 0; i < n - 1; i++) {
    const a = (i / 6) * Math.PI * 2;
    out.push(makeEnemy(x + Math.cos(a) * 46, y + Math.sin(a) * 46, 'basic', hp));
  }
  return out;
}

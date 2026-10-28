import { ENEMIES, type EnemyKind } from '../src/config';
import { ReactionEngine, type ReactionHost, type ReactionModifiers } from '../src/logic/reactions';
import type { DamageSource, Enemy, GameEvent } from '../src/logic/types';

let nextId = 1;

export function makeEnemy(x: number, y: number, kind: EnemyKind = 'basic', hp?: number): Enemy {
  const s = ENEMIES[kind];
  return {
    id: nextId++,
    kind,
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
    flash: 0,
    age: 0,
    supportTimer: 0,
  };
}

export class TestHost implements ReactionHost {
  enemies: Enemy[] = [];
  events: GameEvent[] = [];
  defeats: { enemy: Enemy; cause: DamageSource }[] = [];
  modifiers: ReactionModifiers = { flashover: false, stormRelay: false, splashRadius: 82 };
  emit(event: GameEvent): void {
    this.events.push(event);
  }
  onDefeat(enemy: Enemy, cause: DamageSource): void {
    this.defeats.push({ enemy, cause });
  }
  eventsOf<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];
  }
}

export function setup(enemies: Enemy[] = []): { host: TestHost; engine: ReactionEngine } {
  const host = new TestHost();
  host.enemies = enemies;
  return { host, engine: new ReactionEngine(host) };
}

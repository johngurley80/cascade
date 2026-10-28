import { ELEMENTS, REACTIONS } from '../config';
import { damageEnemy } from './damage';
import { applyBurn, applyWet, consumeWet, isBurning, isWet } from './status';
import type { Cascade, ChainLink, DamageSource, Element, Enemy, GameEvent } from './types';

/** What the reaction engine needs from the surrounding simulation. */
export interface ReactionHost {
  readonly enemies: readonly Enemy[];
  emit(event: GameEvent): void;
  /** Called exactly once per enemy, on the hit that defeats it. */
  onDefeat(enemy: Enemy, cause: DamageSource): void;
  /** Live upgrade state, read on every reaction so picks apply immediately. */
  readonly modifiers: ReactionModifiers;
}

export interface ReactionModifiers {
  flashover: boolean;
  stormRelay: boolean;
  splashRadius: number;
}

export type SecondaryKind = 'steam' | 'flashover' | 'relay';

export interface PendingReaction {
  kind: SecondaryKind;
  x: number;
  y: number;
  /** Enemy that produced this reaction; never damaged by it. */
  sourceId: number;
  cascade: Cascade;
  generation: number;
  delay: number;
}

export interface ReactionStats {
  largestCascade: number;
  secondaryReactions: number;
  /** Reactions not spawned because they would exceed the depth limit. */
  depthLimited: number;
  /** Reactions not spawned because the pending queue was full. */
  capLimited: number;
}

export interface ProjectileImpact {
  element: Element;
  damage: number;
  x: number;
  y: number;
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Resolves elemental hits and their secondary reactions.
 *
 * Bounding rules:
 * - Every projectile impact starts a new cascade with its own ID.
 * - The impact itself is generation 0. Steam bursts, Flashover explosions and
 *   Storm relay chains are each one generation deeper than their trigger, and
 *   nothing deeper than `maxGeneration` is created.
 * - Each individual reaction keeps a visited set, so it damages an enemy at most once.
 * - Enemies are marked dead on the damaging call and defeats are reported once.
 * - The queue of pending secondary reactions is capped.
 */
export class ReactionEngine {
  readonly pending: PendingReaction[] = [];
  readonly stats: ReactionStats = { largestCascade: 0, secondaryReactions: 0, depthLimited: 0, capLimited: 0 };
  private nextCascadeId = 1;

  constructor(
    private readonly host: ReactionHost,
    private readonly cfg = REACTIONS,
  ) {}

  startCascade(x: number, y: number): Cascade {
    return { id: this.nextCascadeId++, hits: new Set(), maxGeneration: 0, x, y };
  }

  /** Resolve a projectile striking `target`. Returns the new cascade. */
  projectileHit(impact: ProjectileImpact, target: Enemy): Cascade {
    const cascade = this.startCascade(impact.x, impact.y);
    this.host.emit({ type: 'hit', element: impact.element, x: impact.x, y: impact.y, enemyId: target.id });
    switch (impact.element) {
      case 'fire':
        this.fireHit(cascade, 0, target, impact.damage, 'fire');
        break;
      case 'water':
        this.waterHit(cascade, target, impact.damage, impact.x, impact.y);
        break;
      case 'lightning':
        this.lightningHit(cascade, target, impact.damage);
        break;
    }
    return cascade;
  }

  /** Burn damage tick from the world's status update. */
  burnTick(enemy: Enemy, amount: number): void {
    const burn = enemy.burn;
    const cascade = burn?.cascade ?? null;
    const generation = burn?.generation ?? 0;
    this.damage(cascade, generation, enemy, amount, 'burn');
  }

  /** Advance pending secondary reactions. */
  update(dt: number): void {
    if (this.pending.length === 0) return;
    // Resolve in arrival order; resolving may enqueue more (handled next frame or later).
    const ready: PendingReaction[] = [];
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const r = this.pending[i];
      r.delay -= dt;
      if (r.delay <= 0) {
        ready.push(r);
        this.pending.splice(i, 1);
      }
    }
    for (let i = ready.length - 1; i >= 0; i--) this.resolve(ready[i]);
  }

  /** Resolve every pending reaction immediately (used by tests and restarts). */
  flush(maxIterations = 1000): void {
    let guard = 0;
    while (this.pending.length > 0 && guard++ < maxIterations) {
      const r = this.pending.shift()!;
      this.resolve(r);
    }
  }

  clear(): void {
    this.pending.length = 0;
  }

  // ---------------------------------------------------------------- elements

  /** Fire (projectile or Flashover): consumes wet into steam, applies burn, deals damage. */
  private fireHit(cascade: Cascade, generation: number, target: Enemy, damage: number, source: DamageSource): void {
    if (!target.alive) return;
    const wasWet = consumeWet(target);
    applyBurn(target, cascade, generation);
    this.damage(cascade, generation, target, damage, source);
    if (wasWet) this.enqueue('steam', target.x, target.y, target.id, cascade, generation + 1);
  }

  private waterHit(cascade: Cascade, target: Enemy, damage: number, x: number, y: number): void {
    const radius = this.host.modifiers.splashRadius;
    applyWet(target);
    let wetted = 1;
    for (const e of this.inRadius(x, y, radius)) {
      if (e === target) continue;
      applyWet(e);
      wetted++;
    }
    this.host.emit({ type: 'splash', x, y, radius, wetted });
    this.damage(cascade, 0, target, damage, 'water');
  }

  private lightningHit(cascade: Cascade, target: Enemy, damage: number): void {
    const cfg = ELEMENTS.lightning;
    const targets: Enemy[] = [target];
    const links: ChainLink[] = [];
    if (isWet(target)) {
      const extra = this.chainWet(target, cfg.chainTargets, cfg.chainRange, links);
      targets.push(...extra);
    }
    this.damage(cascade, 0, target, damage, 'lightning');
    for (let i = 1; i < targets.length; i++) {
      this.damage(cascade, 0, targets[i], cfg.chainDamage, 'lightning');
    }
    if (links.length > 0) this.host.emit({ type: 'chain', links, relay: false, generation: 0 });
  }

  /**
   * Grow a branching chain through wet enemies: repeatedly link the closest
   * unvisited wet enemy to any enemy already in the chain (Prim-style), so the
   * bolt forks naturally through a formation. Each enemy joins at most once.
   */
  chainWet(origin: Enemy, maxExtra: number, range: number, links: ChainLink[]): Enemy[] {
    const visited = new Set<number>([origin.id]);
    const tree: Enemy[] = [origin];
    const added: Enemy[] = [];
    const range2 = range * range;
    while (added.length < maxExtra) {
      let best: Enemy | null = null;
      let bestFrom: Enemy | null = null;
      let bestD = Infinity;
      for (const e of this.host.enemies) {
        if (!e.alive || visited.has(e.id) || !isWet(e)) continue;
        for (const node of tree) {
          const d = dist2(node.x, node.y, e.x, e.y);
          if (d <= range2 && d < bestD) {
            bestD = d;
            best = e;
            bestFrom = node;
          }
        }
      }
      if (!best || !bestFrom) break;
      visited.add(best.id);
      tree.push(best);
      added.push(best);
      links.push({ x1: bestFrom.x, y1: bestFrom.y, x2: best.x, y2: best.y });
    }
    return added;
  }

  // ------------------------------------------------------- secondary effects

  private enqueue(kind: SecondaryKind, x: number, y: number, sourceId: number, cascade: Cascade, generation: number): boolean {
    if (generation > this.cfg.maxGeneration) {
      this.stats.depthLimited++;
      return false;
    }
    if (this.pending.length >= this.cfg.maxPendingReactions) {
      this.stats.capLimited++;
      return false;
    }
    const delay =
      kind === 'steam' ? this.cfg.steam.delay : kind === 'flashover' ? this.cfg.flashover.delay : this.cfg.stormRelay.delay;
    this.pending.push({ kind, x, y, sourceId, cascade, generation, delay });
    return true;
  }

  private resolve(r: PendingReaction): void {
    this.stats.secondaryReactions++;
    r.cascade.maxGeneration = Math.max(r.cascade.maxGeneration, r.generation);
    switch (r.kind) {
      case 'steam':
        this.resolveSteam(r);
        break;
      case 'flashover':
        this.resolveFlashover(r);
        break;
      case 'relay':
        this.resolveRelay(r);
        break;
    }
  }

  /** Steam: damages nearby enemies. It never applies wet. */
  private resolveSteam(r: PendingReaction): void {
    const { radius, damage } = this.cfg.steam;
    this.host.emit({ type: 'steam', x: r.x, y: r.y, radius, generation: r.generation });
    const visited = new Set<number>([r.sourceId]);
    for (const e of this.inRadius(r.x, r.y, radius)) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      this.damage(r.cascade, r.generation, e, damage, 'steam');
    }
  }

  /** Flashover: a small fire explosion that ignites (and can steam) others. */
  private resolveFlashover(r: PendingReaction): void {
    const { radius, damage } = this.cfg.flashover;
    this.host.emit({ type: 'flashover', x: r.x, y: r.y, radius, generation: r.generation });
    const visited = new Set<number>([r.sourceId]);
    for (const e of this.inRadius(r.x, r.y, radius)) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      this.fireHit(r.cascade, r.generation, e, damage, 'flashover');
    }
  }

  /** Storm relay: one weaker chain to the nearest enemies, wet or not. */
  private resolveRelay(r: PendingReaction): void {
    const { radius, targets, damage } = this.cfg.stormRelay;
    const visited = new Set<number>([r.sourceId]);
    const candidates = this.inRadius(r.x, r.y, radius)
      .filter((e) => !visited.has(e.id))
      .sort((a, b) => dist2(a.x, a.y, r.x, r.y) - dist2(b.x, b.y, r.x, r.y))
      .slice(0, targets);
    if (candidates.length === 0) return;
    const links: ChainLink[] = candidates.map((e) => ({ x1: r.x, y1: r.y, x2: e.x, y2: e.y }));
    this.host.emit({ type: 'chain', links, relay: true, generation: r.generation });
    for (const e of candidates) {
      visited.add(e.id);
      this.damage(r.cascade, r.generation, e, damage, 'relay');
    }
  }

  // ------------------------------------------------------------------ shared

  private inRadius(x: number, y: number, radius: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.host.enemies) {
      if (!e.alive) continue;
      const reach = radius + e.radius * 0.5;
      if (dist2(e.x, e.y, x, y) <= reach * reach) out.push(e);
    }
    return out;
  }

  private damage(cascade: Cascade | null, generation: number, enemy: Enemy, amount: number, source: DamageSource): void {
    if (!enemy.alive) return;
    if (cascade) {
      const before = cascade.hits.size;
      cascade.hits.add(enemy.id);
      if (cascade.hits.size !== before) {
        if (cascade.hits.size > this.stats.largestCascade) this.stats.largestCascade = cascade.hits.size;
        if (cascade.hits.size >= 2) {
          this.host.emit({ type: 'cascade', cascadeId: cascade.id, size: cascade.hits.size, x: enemy.x, y: enemy.y });
        }
      }
    }
    const result = damageEnemy(enemy, amount);
    if (result.killed) this.handleDefeat(enemy, source, cascade, generation);
  }

  private handleDefeat(enemy: Enemy, cause: DamageSource, cascade: Cascade | null, generation: number): void {
    const burning = isBurning(enemy);
    this.host.onDefeat(enemy, cause);
    if (!cascade) return;
    const mods = this.host.modifiers;
    if (mods.flashover && burning) {
      this.enqueue('flashover', enemy.x, enemy.y, enemy.id, cascade, generation + 1);
    }
    if (mods.stormRelay && (cause === 'lightning' || cause === 'relay')) {
      this.enqueue('relay', enemy.x, enemy.y, enemy.id, cascade, generation + 1);
    }
  }
}

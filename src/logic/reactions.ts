import { BOSS, ELEMENTS, PLAYER, REACTIONS, WORLD } from '../config';
import { damageEnemy } from './damage';
import {
  applyBurn,
  applyChill,
  applyFreeze,
  applyPoison,
  applyWet,
  consumeFreeze,
  consumePoison,
  consumeWet,
  extinguish,
  isBoss,
  isBurning,
  isFrozen,
  isPoisoned,
  isWet,
} from './status';
import type {
  BlastKind,
  Cascade,
  ChainLink,
  DamageSource,
  Element,
  Enemy,
  GameEvent,
  ModifierId,
  ReactionId,
  Singularity,
  SteamCloud,
} from './types';

/** What the reaction engine needs from the surrounding simulation. */
export interface ReactionHost {
  readonly enemies: readonly Enemy[];
  emit(event: GameEvent): void;
  /** Called exactly once per enemy, on the hit that defeats it. */
  onDefeat(enemy: Enemy, cause: DamageSource, cascade: Cascade | null): void;
  /** Live upgrade levels, read on every reaction so picks apply immediately. */
  readonly levels: Readonly<Record<ModifierId, number>>;
  /** Simulation clock (seconds), used for the cascade replay. */
  readonly time: number;
}

/** Secondary reactions resolve after a short delay, one generation deeper than their trigger. */
export type SecondaryKind = 'steam' | 'flashover' | 'relay' | 'shatter' | 'overload' | 'ignition' | 'detonation';

export interface PendingReaction {
  kind: SecondaryKind;
  x: number;
  y: number;
  /** Enemy that produced this reaction. */
  sourceId: number;
  cascade: Cascade;
  generation: number;
  delay: number;
  /** Shatter only: the freeze was brittle. */
  brittle?: boolean;
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

/** One elemental hit on one enemy. */
export interface Hit {
  cascade: Cascade;
  generation: number;
  target: Enemy;
  damage: number;
  source: DamageSource;
  /** Where the hit came from (for the replay diagram). */
  ox: number;
  oy: number;
  /** A projectile striking its target: blocked by shields, can start chains. */
  direct: boolean;
  /** Lightning delivered by a chain/relay/arc (never chains again). */
  chained?: boolean;
}

/** Statuses of the target at the moment of the hit. */
export interface HitSnapshot {
  wet: boolean;
  burning: boolean;
  frozen: boolean;
  poisoned: boolean;
  inSteam: boolean;
  singularity: Singularity | null;
}

/** Per-hit flags set by interactions and read by the element's base effect. */
interface HitFlags {
  spreadBurn?: boolean;
  spreadPoison?: boolean;
  frozeNow?: boolean;
}

/**
 * One row of the reaction table: when `element` hits an enemy whose snapshot
 * satisfies `when`, run `apply` (before the element's base effect).
 */
export interface Interaction {
  reaction: ReactionId;
  when: (s: HitSnapshot) => boolean;
  requires?: ModifierId;
  apply: (engine: ReactionEngine, hit: Hit, s: HitSnapshot, flags: HitFlags) => void;
}

const shatterRule: Interaction = {
  reaction: 'shatter',
  when: (s) => s.frozen,
  apply: (eng, hit) => {
    const freeze = consumeFreeze(hit.target);
    if (freeze) eng.queue('shatter', hit.target, hit.cascade, hit.generation + 1, freeze.brittle);
  },
};

/**
 * The reaction table. Every elemental combination in the game is a row here;
 * the matching rows run in order, then the element's base effect.
 */
export const INTERACTIONS: Record<Element, Interaction[]> = {
  fire: [
    {
      reaction: 'steam',
      when: (s) => s.wet,
      apply: (eng, hit) => {
        consumeWet(hit.target);
        eng.queue('steam', hit.target, hit.cascade, hit.generation + 1);
      },
    },
    {
      reaction: 'thaw',
      when: (s) => s.frozen,
      apply: (eng, hit) => {
        consumeFreeze(hit.target);
        applyWet(hit.target);
        eng.status('thaw', hit.target);
        eng.react('thaw', hit.target);
      },
    },
    {
      reaction: 'ignition',
      when: (s) => s.poisoned,
      apply: (eng, hit) => {
        consumePoison(hit.target);
        eng.queue('ignition', hit.target, hit.cascade, hit.generation + 1);
      },
    },
  ],
  water: [
    shatterRule,
    {
      reaction: 'toxicSplash',
      when: (s) => s.poisoned,
      apply: (eng, hit, _s, flags) => {
        flags.spreadPoison = true;
        eng.react('toxicSplash', hit.target);
      },
    },
  ],
  lightning: [
    shatterRule,
    {
      reaction: 'overload',
      when: (s) => s.burning,
      apply: (eng, hit) => {
        extinguish(hit.target);
        eng.queue('overload', hit.target, hit.cascade, hit.generation + 1);
      },
    },
  ],
  frost: [
    {
      reaction: 'brittle',
      when: (s) => s.poisoned && !s.frozen,
      apply: (eng, hit, _s, flags) => {
        applyFreeze(hit.target, eng.freezeMult, true);
        flags.frozeNow = true;
        eng.status('brittle', hit.target);
        eng.react('brittle', hit.target);
      },
    },
    {
      reaction: 'freeze',
      when: (s) => s.wet && !s.frozen,
      apply: (eng, hit, _s, flags) => {
        consumeWet(hit.target);
        if (!flags.frozeNow) applyFreeze(hit.target, eng.freezeMult);
        flags.frozeNow = true;
        eng.status('freeze', hit.target);
        eng.react('freeze', hit.target);
      },
    },
    {
      reaction: 'thermalShock',
      when: (s) => s.burning,
      apply: (eng, hit) => {
        extinguish(hit.target);
        eng.status('thermalShock', hit.target);
        eng.react('thermalShock', hit.target);
        eng.damage(hit.cascade, hit.generation, hit.target, ELEMENTS.frost.thermalShockBonus, 'thermalShock', hit.ox, hit.oy, false);
      },
    },
  ],
  wind: [
    shatterRule,
    {
      reaction: 'firestorm',
      when: (s) => s.burning,
      apply: (eng, hit, _s, flags) => {
        flags.spreadBurn = true;
        eng.react('firestorm', hit.target);
      },
    },
    {
      reaction: 'toxicStorm',
      requires: 'toxicStorm',
      when: (s) => s.poisoned,
      apply: (eng, hit, _s, flags) => {
        flags.spreadPoison = true;
        eng.react('toxicStorm', hit.target);
      },
    },
    {
      reaction: 'squall',
      when: (s) => s.wet,
      apply: (eng, hit) => {
        const r = eng.gustRadius * ELEMENTS.wind.squallRadiusMult;
        for (const e of eng.inRadius(hit.target.x, hit.target.y, r)) applyWet(e);
        eng.host.emit({ type: 'splash', x: hit.target.x, y: hit.target.y, radius: r, wetted: 0 });
        eng.react('squall', hit.target);
      },
    },
    {
      reaction: 'steamFront',
      when: (s) => s.inSteam,
      apply: (eng, hit) => {
        eng.expandClouds(hit.target);
        eng.react('steamFront', hit.target);
      },
    },
    {
      reaction: 'gravityWell',
      requires: 'gravityWell',
      when: (s) => s.singularity !== null,
      apply: (eng, _hit, s) => {
        if (!s.singularity) return;
        eng.react('gravityWell', s.singularity);
        eng.collapse(s.singularity, REACTIONS.gravityWell.collapseMult);
      },
    },
  ],
  toxin: [shatterRule],
  void: [shatterRule],
};

const FIRE_FAMILY = new Set<DamageSource>(['fire', 'flashover', 'ignition', 'burn']);
const LIGHTNING_CAUSES = new Set<DamageSource>(['lightning', 'relay', 'arcStorm']);

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Resolves elemental hits, the reaction table and all secondary reactions.
 *
 * Bounding rules:
 * - Every projectile impact starts a new cascade with its own ID.
 * - The impact itself is generation 0. Each blast or relay chain is one
 *   generation deeper than its trigger; nothing beyond the limit is created.
 * - Each individual reaction keeps a visited set, so it damages an enemy at most once.
 * - Enemies are marked dead on the damaging call and defeats are reported once.
 * - Pending reactions, steam clouds and singularities are capped.
 */
export class ReactionEngine {
  readonly pending: PendingReaction[] = [];
  readonly clouds: SteamCloud[] = [];
  readonly singularities: Singularity[] = [];
  readonly stats: ReactionStats = { largestCascade: 0, secondaryReactions: 0, depthLimited: 0, capLimited: 0 };
  /** The cascade that hit the most enemies (kept for the replay). */
  largest: Cascade | null = null;
  private nextCascadeId = 1;
  private nextFieldId = 1;

  constructor(readonly host: ReactionHost) {}

  // ------------------------------------------------------------ live values

  private lvl(id: ModifierId): number {
    return this.host.levels[id] ?? 0;
  }

  get maxGeneration(): number {
    return REACTIONS.maxGeneration + (this.lvl('catalyst') > 0 ? REACTIONS.catalystBonus : 0);
  }

  get splashRadius(): number {
    return ELEMENTS.water.splashRadius + ELEMENTS.water.splashRadiusPerLevel * this.lvl('widerSplash');
  }

  get gustRadius(): number {
    return ELEMENTS.wind.gustRadius * (1 + ELEMENTS.wind.galeForcePerLevel * this.lvl('galeForce'));
  }

  get freezeMult(): number {
    return this.lvl('deepFreeze') > 0 ? ELEMENTS.frost.deepFreezeMult : 1;
  }

  get chainTargets(): number {
    return ELEMENTS.lightning.chainTargets + (this.lvl('longChain') > 0 ? ELEMENTS.lightning.longChainBonus : 0);
  }

  get damageMult(): number {
    return 1 + PLAYER.overchargePerLevel * this.lvl('overcharge');
  }

  // ------------------------------------------------------------- entry API

  startCascade(x: number, y: number): Cascade {
    return { id: this.nextCascadeId++, hits: new Set(), maxGeneration: 0, x, y, startTime: this.host.time, replay: [] };
  }

  /** Resolve a projectile striking `target`. Returns the new cascade. */
  projectileHit(impact: ProjectileImpact, target: Enemy): Cascade {
    const cascade = this.startCascade(impact.x, impact.y);
    this.host.emit({ type: 'hit', element: impact.element, x: impact.x, y: impact.y, enemyId: target.id });
    this.elementHit(impact.element, {
      cascade,
      generation: 0,
      target,
      damage: impact.damage,
      source: impact.element,
      ox: impact.x,
      oy: impact.y + 60,
      direct: true,
    });
    return cascade;
  }

  /** Damage-over-time tick from the world's status update. */
  dotTick(enemy: Enemy, amount: number, kind: 'burn' | 'poison'): void {
    const dot = kind === 'burn' ? enemy.burn : enemy.poison;
    this.damage(dot?.cascade ?? null, dot?.generation ?? 0, enemy, amount, kind, enemy.x, enemy.y, false);
  }

  /** Advance fields and pending secondary reactions. */
  update(dt: number): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      this.clouds[i].life -= dt;
      if (this.clouds[i].life <= 0) this.clouds.splice(i, 1);
    }
    this.updateSingularities(dt);
    if (this.pending.length === 0) return;
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

  /** Resolve every pending reaction and field immediately (tests). */
  flush(maxIterations = 2000): void {
    let guard = 0;
    while ((this.pending.length > 0 || this.singularities.length > 0) && guard++ < maxIterations) {
      if (this.pending.length > 0) this.resolve(this.pending.shift()!);
      else this.update(0.05);
    }
  }

  clear(): void {
    this.pending.length = 0;
    this.clouds.length = 0;
    this.singularities.length = 0;
  }

  // ------------------------------------------------------------- core hit

  snapshot(e: Enemy): HitSnapshot {
    return {
      wet: isWet(e),
      burning: isBurning(e),
      frozen: isFrozen(e),
      poisoned: isPoisoned(e),
      inSteam: this.inSteam(e),
      singularity: this.singularityAt(e),
    };
  }

  /** Run the reaction table for `element` on the hit target, then its base effect. */
  elementHit(element: Element, hit: Hit): void {
    if (!hit.target.alive) return;
    const s = this.snapshot(hit.target);
    const flags: HitFlags = {};
    for (const rule of INTERACTIONS[element]) {
      if (rule.requires && this.lvl(rule.requires) <= 0) continue;
      if (rule.when(s)) rule.apply(this, hit, s, flags);
    }
    if (!hit.target.alive) return;
    switch (element) {
      case 'fire':
        applyBurn(hit.target, hit.cascade, hit.generation);
        this.damageHit(hit);
        break;
      case 'water':
        this.waterBase(hit, flags);
        break;
      case 'lightning':
        this.lightningBase(hit, s);
        break;
      case 'frost':
        if (!flags.frozeNow) applyChill(hit.target, this.freezeMult);
        this.damageHit(hit);
        break;
      case 'wind':
        this.windBase(hit, flags);
        break;
      case 'toxin':
        if (applyPoison(hit.target, hit.cascade, hit.generation)) this.host.emit({ type: 'shieldBreak', x: hit.target.x, y: hit.target.y });
        this.status('poison', hit.target);
        this.damageHit(hit);
        break;
      case 'void':
        this.spawnSingularity(hit);
        this.damageHit(hit);
        break;
    }
  }

  private damageHit(hit: Hit): void {
    this.damage(hit.cascade, hit.generation, hit.target, hit.damage, hit.source, hit.ox, hit.oy, hit.direct);
  }

  private waterBase(hit: Hit, flags: HitFlags): void {
    const t = hit.target;
    const radius = this.splashRadius;
    const acid = this.lvl('acidRain') > 0;
    applyWet(t);
    if (acid) applyPoison(t, hit.cascade, hit.generation);
    let wetted = 1;
    let poisoned = 0;
    for (const e of this.inRadius(t.x, t.y, radius)) {
      if (e === t) continue;
      applyWet(e);
      wetted++;
      if (flags.spreadPoison || acid) {
        if (applyPoison(e, hit.cascade, hit.generation)) this.host.emit({ type: 'shieldBreak', x: e.x, y: e.y });
        poisoned++;
      }
    }
    if (acid && poisoned > 0) this.react('acidRain', t);
    this.host.emit({ type: 'splash', x: t.x, y: t.y, radius, wetted });
    this.damageHit(hit);
  }

  private lightningBase(hit: Hit, s: HitSnapshot): void {
    const t = hit.target;
    this.damageHit(hit);
    if (hit.chained) return;
    const links: ChainLink[] = [];
    let targets: Enemy[] = [];
    let arc = false;
    if (s.singularity && !t.traits.insulated) {
      // Arc storm: everything caught in the singularity is linked, wet or not.
      const sg = s.singularity;
      targets = this.host.enemies
        .filter((e) => e !== t && e.alive && !e.traits.insulated && dist2(e.x, e.y, sg.x, sg.y) <= (sg.radius + e.radius * 0.5) ** 2)
        .sort((a, b) => dist2(a.x, a.y, t.x, t.y) - dist2(b.x, b.y, t.x, t.y))
        .slice(0, REACTIONS.arcStorm.targets);
      for (const e of targets) links.push({ x1: t.x, y1: t.y, x2: e.x, y2: e.y });
      arc = targets.length > 0;
      if (arc) this.react('arcStorm', t);
    } else if ((s.wet || s.inSteam) && !t.traits.insulated) {
      targets = this.chainWet(t, this.chainTargets, ELEMENTS.lightning.chainRange, links);
      if (targets.length > 0) {
        this.react('chain', t);
        if (!s.wet || targets.some((e) => !isWet(e))) this.react('conductive', t);
      }
    }
    if (targets.length === 0) return;
    this.host.emit({ type: 'chain', links, relay: false, generation: hit.generation, arc });
    const damage = arc ? REACTIONS.arcStorm.damage : ELEMENTS.lightning.chainDamage;
    targets.forEach((e, i) => {
      const link = links[i];
      this.elementHit('lightning', {
        cascade: hit.cascade,
        generation: hit.generation,
        target: e,
        damage,
        source: arc ? 'arcStorm' : 'lightning',
        ox: link.x1,
        oy: link.y1,
        direct: false,
        chained: true,
      });
    });
    // Plasma arc ignites after the chain resolves, so the flames survive to fuel the next shot.
    if (this.lvl('plasmaArc') > 0) {
      for (const e of [t, ...targets]) applyBurn(e, hit.cascade, hit.generation);
      this.react('plasmaArc', t);
    }
  }

  private windBase(hit: Hit, flags: HitFlags): void {
    const t = hit.target;
    const radius = this.gustRadius;
    const pull = ELEMENTS.wind.gustPull * (1 + ELEMENTS.wind.galeForcePerLevel * this.lvl('galeForce'));
    const affected = this.inRadius(t.x, t.y, radius).filter((e) => e !== t);
    for (const e of affected) {
      if (!isBoss(e)) {
        const dx = t.x - e.x;
        const dy = t.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const stop = (e.radius + t.radius) * 0.95;
        const move = Math.max(0, Math.min(pull, d - stop));
        e.x = clampX(e.x + (dx / d) * move, e.radius);
        // Gathered enemies are also shoved back a little: wind buys time.
        e.y += (dy / d) * move - ELEMENTS.wind.groupKnockback;
      }
      if (flags.spreadBurn) applyBurn(e, hit.cascade, hit.generation);
      if (flags.spreadPoison && applyPoison(e, hit.cascade, hit.generation)) this.host.emit({ type: 'shieldBreak', x: e.x, y: e.y });
    }
    if (!isBoss(t)) t.y -= ELEMENTS.wind.knockback;
    this.host.emit({ type: 'gust', x: t.x, y: t.y, radius });
    this.damageHit(hit);
  }

  /**
   * Grow a branching chain through conductive enemies (wet, or inside a steam
   * cloud): repeatedly link the closest unvisited conductor to any enemy
   * already in the chain (Prim-style), so the bolt forks through a formation.
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
        if (!e.alive || visited.has(e.id) || e.traits.insulated) continue;
        if (!isWet(e) && !this.inSteam(e)) continue;
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

  // ------------------------------------------------------------------ fields

  inSteam(e: Enemy): boolean {
    for (const c of this.clouds) if (dist2(e.x, e.y, c.x, c.y) <= (c.radius + e.radius * 0.5) ** 2) return true;
    return false;
  }

  singularityAt(e: Enemy): Singularity | null {
    for (const s of this.singularities) if (dist2(e.x, e.y, s.x, s.y) <= (s.radius + e.radius * 0.5) ** 2) return s;
    return null;
  }

  expandClouds(e: Enemy): void {
    for (const c of this.clouds) {
      if (dist2(e.x, e.y, c.x, c.y) <= (c.radius + e.radius * 0.5) ** 2) {
        c.radius *= REACTIONS.steamFront.radiusMult;
        c.life += REACTIONS.steamFront.extraLife;
        c.maxLife = Math.max(c.maxLife, c.life);
        this.host.emit({ type: 'blast', kind: 'steam', x: c.x, y: c.y, radius: c.radius, generation: 0 });
      }
    }
  }

  private spawnSingularity(hit: Hit): void {
    const cfg = ELEMENTS.void;
    if (this.singularities.length >= cfg.maxSingularities) return;
    const lvl = this.lvl('eventHorizon');
    const radius = cfg.singularityRadius * (1 + cfg.eventHorizonRadius * lvl);
    const life = cfg.singularityLife + cfg.eventHorizonLife * lvl;
    const t = hit.target;
    this.singularities.push({
      id: this.nextFieldId++,
      x: t.x,
      y: t.y,
      radius,
      life,
      maxLife: life,
      cascade: hit.cascade,
      generation: hit.generation,
    });
    this.host.emit({ type: 'singularity', x: t.x, y: t.y, radius });
  }

  private updateSingularities(dt: number): void {
    const speed = ELEMENTS.void.pullSpeed;
    for (let i = this.singularities.length - 1; i >= 0; i--) {
      const s = this.singularities[i];
      for (const e of this.host.enemies) {
        if (!e.alive || isBoss(e)) continue;
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d > s.radius + e.radius * 0.5 || d < 4) continue;
        const step = Math.min(speed * dt, d - 4);
        e.x = clampX(e.x + (dx / d) * step, e.radius);
        e.y += (dy / d) * step;
      }
      s.life -= dt;
      if (s.life <= 0) this.collapse(s, 1);
    }
  }

  /** Collapse a singularity: damage everything inside it. */
  collapse(s: Singularity, mult: number): void {
    const index = this.singularities.indexOf(s);
    if (index < 0) return;
    this.singularities.splice(index, 1);
    const gen = s.generation + 1;
    if (gen > this.maxGeneration) {
      this.stats.depthLimited++;
      return;
    }
    s.cascade.maxGeneration = Math.max(s.cascade.maxGeneration, gen);
    this.host.emit({ type: 'blast', kind: 'collapse', x: s.x, y: s.y, radius: s.radius, generation: gen });
    for (const e of this.inRadius(s.x, s.y, s.radius)) {
      this.kineticHit(s.cascade, gen, e, ELEMENTS.void.collapseDamage * mult, 'collapse', s.x, s.y);
    }
  }

  // ------------------------------------------------------- secondary queue

  queue(kind: SecondaryKind, at: { x: number; y: number; id?: number }, cascade: Cascade, generation: number, brittle = false): boolean {
    if (generation > this.maxGeneration) {
      this.stats.depthLimited++;
      return false;
    }
    if (this.pending.length >= REACTIONS.maxPendingReactions) {
      this.stats.capLimited++;
      return false;
    }
    const delay =
      kind === 'relay' ? REACTIONS.stormRelay.delay : kind === 'detonation' ? REACTIONS.detonation.delay : REACTIONS[kind].delay;
    this.pending.push({ kind, x: at.x, y: at.y, sourceId: at.id ?? -1, cascade, generation, delay, brittle });
    return true;
  }

  private resolve(r: PendingReaction): void {
    this.stats.secondaryReactions++;
    r.cascade.maxGeneration = Math.max(r.cascade.maxGeneration, r.generation);
    switch (r.kind) {
      case 'steam':
        return this.resolveSteam(r);
      case 'flashover':
        return this.resolveFireBlast(r, 'flashover', REACTIONS.flashover.radius, REACTIONS.flashover.damage);
      case 'ignition':
        return this.resolveFireBlast(r, 'ignition', REACTIONS.ignition.radius, REACTIONS.ignition.damage);
      case 'relay':
        return this.resolveRelay(r);
      case 'shatter':
        return this.resolveShatter(r);
      case 'overload':
        return this.resolveKineticBlast(r, 'overload', REACTIONS.overload.radius, REACTIONS.overload.damage, 'overload');
      case 'detonation':
        return this.resolveKineticBlast(r, 'detonation', REACTIONS.detonation.radius, REACTIONS.detonation.damage, 'detonation');
    }
  }

  /** Steam: damages nearby enemies (never applies wet) and leaves a conductive cloud. */
  private resolveSteam(r: PendingReaction): void {
    const big = this.lvl('bigSteam') > 0 ? REACTIONS.steam.bigSteamMult : 1;
    const radius = REACTIONS.steam.radius * big;
    this.react('steam', r);
    this.host.emit({ type: 'blast', kind: 'steam', x: r.x, y: r.y, radius, generation: r.generation });
    if (this.clouds.length >= REACTIONS.maxSteamClouds) this.clouds.shift();
    const life = REACTIONS.steam.cloudLife * big;
    this.clouds.push({ id: this.nextFieldId++, x: r.x, y: r.y, radius: radius * REACTIONS.steam.cloudRadiusMult, life, maxLife: life });
    const superheated = this.lvl('superheatedSteam') > 0;
    let burned = 0;
    const visited = new Set<number>([r.sourceId]);
    for (const e of this.inRadius(r.x, r.y, radius)) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      if (isFrozen(e)) {
        // Hot steam thaws ice back into water.
        consumeFreeze(e);
        applyWet(e);
        this.react('thaw', e);
      }
      if (superheated && applyBurn(e, r.cascade, r.generation)) burned++;
      this.damage(r.cascade, r.generation, e, REACTIONS.steam.damage, 'steam', r.x, r.y, false);
    }
    if (burned > 0) this.react('superheatedSteam', r);
  }

  /** Flashover / gas ignition: a fire explosion that runs the fire row of the table on each enemy. */
  private resolveFireBlast(r: PendingReaction, kind: 'flashover' | 'ignition', radius: number, damage: number): void {
    this.react(kind, r);
    this.host.emit({ type: 'blast', kind, x: r.x, y: r.y, radius, generation: r.generation });
    const visited = new Set<number>([r.sourceId]);
    for (const e of this.inRadius(r.x, r.y, radius)) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      this.elementHit('fire', { cascade: r.cascade, generation: r.generation, target: e, damage, source: kind, ox: r.x, oy: r.y, direct: false });
    }
  }

  private resolveKineticBlast(r: PendingReaction, kind: BlastKind, radius: number, damage: number, source: DamageSource): void {
    if (kind === 'detonation' || kind === 'overload') this.react(kind, r);
    this.host.emit({ type: 'blast', kind, x: r.x, y: r.y, radius, generation: r.generation });
    const visited = new Set<number>([r.sourceId]);
    for (const e of this.inRadius(r.x, r.y, radius)) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      this.kineticHit(r.cascade, r.generation, e, damage, source, r.x, r.y);
    }
  }

  /** Shatter: ice shards hit everything nearby, including the enemy that shattered. */
  private resolveShatter(r: PendingReaction): void {
    const cfg = REACTIONS.shatter;
    const radius = cfg.radius * (this.lvl('deepFreeze') > 0 ? cfg.deepFreezeRadiusMult : 1);
    const damage = cfg.damage * (r.brittle ? cfg.brittleMult : 1);
    this.react('shatter', r);
    this.host.emit({ type: 'blast', kind: 'shatter', x: r.x, y: r.y, radius, generation: r.generation });
    const permafrost = this.lvl('permafrost') > 0;
    const hitList = this.inRadius(r.x, r.y, radius);
    const visited = new Set<number>();
    for (const e of hitList) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      this.kineticHit(r.cascade, r.generation, e, damage, 'shatter', r.x, r.y);
    }
    if (permafrost) {
      let froze = 0;
      for (const e of hitList) {
        if (!e.alive) continue;
        applyChill(e, this.freezeMult);
        if (consumeWet(e)) {
          applyFreeze(e, this.freezeMult);
          froze++;
        }
      }
      if (froze > 0) this.react('permafrost', r);
    }
  }

  /** Storm relay: one weaker chain to the nearest enemies, wet or not. */
  private resolveRelay(r: PendingReaction): void {
    const { radius, targets, damage } = REACTIONS.stormRelay;
    const candidates = this.inRadius(r.x, r.y, radius)
      .filter((e) => e.id !== r.sourceId && !e.traits.insulated)
      .sort((a, b) => dist2(a.x, a.y, r.x, r.y) - dist2(b.x, b.y, r.x, r.y))
      .slice(0, targets);
    if (candidates.length === 0) return;
    this.react('stormRelay', r);
    const links: ChainLink[] = candidates.map((e) => ({ x1: r.x, y1: r.y, x2: e.x, y2: e.y }));
    this.host.emit({ type: 'chain', links, relay: true, generation: r.generation });
    for (const e of candidates) {
      this.elementHit('lightning', { cascade: r.cascade, generation: r.generation, target: e, damage, source: 'relay', ox: r.x, oy: r.y, direct: false, chained: true });
    }
  }

  /** Non-elemental reaction damage: shatters frozen enemies it touches. */
  private kineticHit(cascade: Cascade, gen: number, e: Enemy, amount: number, source: DamageSource, ox: number, oy: number): void {
    if (!e.alive) return;
    if (isFrozen(e)) {
      const freeze = consumeFreeze(e);
      if (freeze) this.queue('shatter', e, cascade, gen + 1, freeze.brittle);
    }
    this.damage(cascade, gen, e, amount, source, ox, oy, false);
  }

  // ------------------------------------------------------------------ shared

  inRadius(x: number, y: number, radius: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.host.enemies) {
      if (!e.alive) continue;
      const reach = radius + e.radius * 0.5;
      if (dist2(e.x, e.y, x, y) <= reach * reach) out.push(e);
    }
    return out;
  }

  react(id: ReactionId, at: { x: number; y: number }): void {
    this.host.emit({ type: 'reaction', id, x: at.x, y: at.y });
  }

  status(status: 'freeze' | 'thaw' | 'thermalShock' | 'poison' | 'brittle', at: { x: number; y: number }): void {
    this.host.emit({ type: 'status', status, x: at.x, y: at.y });
  }

  /**
   * Apply damage with all modifiers and shields, record it in the cascade and
   * report a defeat exactly once.
   */
  damage(
    cascade: Cascade | null,
    generation: number,
    enemy: Enemy,
    amount: number,
    source: DamageSource,
    ox: number,
    oy: number,
    direct: boolean,
  ): void {
    if (!enemy.alive) return;
    let amt = amount * this.damageMult;
    if (isPoisoned(enemy)) amt *= ELEMENTS.toxin.corrodeMult;
    if (enemy.traits.fireproof && FIRE_FAMILY.has(source)) amt *= 0.5;
    if (enemy.traits.shield) {
      if (source === 'burn') return;
      if (direct) {
        enemy.shieldHits--;
        if (enemy.shieldHits > 0) {
          this.host.emit({ type: 'shieldBlock', x: enemy.x, y: enemy.y });
          return;
        }
        // Worn down by direct hits: this one breaks it but is still absorbed.
        enemy.traits.shield = false;
        this.host.emit({ type: 'shieldBreak', x: enemy.x, y: enemy.y });
        return;
      }
      enemy.traits.shield = false;
      this.host.emit({ type: 'shieldBreak', x: enemy.x, y: enemy.y });
    }
    if (direct && enemy.kind === 'aegis') amt *= BOSS.aegisDirectMult;

    if (cascade) {
      cascade.maxGeneration = Math.max(cascade.maxGeneration, generation);
      if (cascade.replay.length < REACTIONS.replayRecordCap) {
        cascade.replay.push({
          t: this.host.time - cascade.startTime,
          fromX: ox,
          fromY: oy,
          x: enemy.x,
          y: enemy.y,
          enemyId: enemy.id,
          generation,
          source,
        });
      }
      const before = cascade.hits.size;
      cascade.hits.add(enemy.id);
      if (cascade.hits.size !== before) {
        if (cascade.hits.size > this.stats.largestCascade) {
          this.stats.largestCascade = cascade.hits.size;
          this.largest = cascade;
        }
        if (cascade.hits.size >= 2) {
          this.host.emit({ type: 'cascade', cascadeId: cascade.id, size: cascade.hits.size, x: enemy.x, y: enemy.y });
        }
      }
    }
    const result = damageEnemy(enemy, amt);
    if (result.killed) this.handleDefeat(enemy, source, cascade, generation);
  }

  private handleDefeat(enemy: Enemy, cause: DamageSource, cascade: Cascade | null, generation: number): void {
    const burning = isBurning(enemy);
    const poisoned = isPoisoned(enemy);
    this.host.onDefeat(enemy, cause, cascade);
    if (!cascade) return;
    if (this.lvl('flashover') > 0 && burning) this.queue('flashover', enemy, cascade, generation + 1);
    if (this.lvl('stormRelay') > 0 && LIGHTNING_CAUSES.has(cause)) this.queue('relay', enemy, cascade, generation + 1);
    if (enemy.kind === 'volatile') this.queue('detonation', enemy, cascade, generation + 1);
    if (this.lvl('virulence') > 0 && poisoned) {
      const cfg = ELEMENTS.toxin;
      const near = this.inRadius(enemy.x, enemy.y, cfg.virulenceRadius)
        .filter((e) => e !== enemy && !isPoisoned(e))
        .sort((a, b) => dist2(a.x, a.y, enemy.x, enemy.y) - dist2(b.x, b.y, enemy.x, enemy.y))
        .slice(0, cfg.virulenceTargets);
      for (const e of near) applyPoison(e, cascade, generation);
    }
  }
}

function clampX(x: number, r: number): number {
  return Math.max(WORLD.wallLeft + r, Math.min(WORLD.wallRight - r, x));
}

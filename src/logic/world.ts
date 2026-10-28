import { BOSS, ELEMENTS, ELITE, ENEMIES, PLAYER, SCORE, SHIELD, UPGRADES, WAVES, WORLD, type EnemyKind } from '../config';
import { awardDefeat } from './damage';
import { ReactionEngine, type ReactionHost } from './reactions';
import { Rng, deriveSeed } from './rng';
import { isBoss, speedFactor, tickStatuses } from './status';
import {
  applyUpgrade,
  buildElementOffer,
  buildOffer,
  createLoadout,
  fireInterval,
  offerKindAfterWave,
  unlockAll,
  type Loadout,
  type OfferContext,
} from './upgrades';
import { WaveRunner, actOf, bossSupportSpawns, isBossKind, noTraits, type SpawnSpec } from './waves';
import type {
  Cascade,
  DamageSource,
  Element,
  Enemy,
  EnemyTraits,
  GameEvent,
  ModifierId,
  Phase,
  Projectile,
  ReplayRecord,
  UpgradeId,
} from './types';

export interface WorldOptions {
  seed: number;
  startWave?: number;
  unlockAll?: boolean;
  /** Keep going after wave 15 with generated waves. */
  endless?: boolean;
}

export interface RunStats {
  kills: number;
  score: number;
  shots: number;
  leaks: number;
  time: number;
  wavesCleared: number;
}

/** Everything needed to resume a run between waves. */
export interface RunSave {
  version: 1;
  seed: number;
  endless: boolean;
  clearedWave: number;
  health: number;
  elements: Element[];
  levels: Record<ModifierId, number>;
  stats: RunStats;
  largestCascade: number;
  largestReplay: ReplayRecord[];
  rerollsLeft: number;
  selected: Element;
  offer: UpgradeId[];
}

const DEG = Math.PI / 180;

/**
 * The complete, renderer-independent game simulation. Phaser scenes feed it
 * input, call `step`, read its state for drawing and drain its events for
 * effects and audio.
 */
export class World implements ReactionHost {
  readonly seed: number;
  phase: Phase = 'start';
  /** Wave currently being played (or just cleared, during an upgrade choice). */
  wave: number;
  endless: boolean;
  health: number = PLAYER.maxHealth;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly loadout: Loadout = createLoadout();
  readonly reactions: ReactionEngine;
  readonly stats: RunStats = { kills: 0, score: 0, shots: 0, leaks: 0, time: 0, wavesCleared: 0 };
  selected: Element = 'fire';
  /** Radians from vertical; negative = left. Always within ±70°. */
  aimAngle = 0;
  firing = false;
  /** Current choices while phase is 'start' or 'upgrade'. */
  offer: UpgradeId[] = [];
  rerollsLeft: number = UPGRADES.rerollsPerRun;
  runner: WaveRunner;
  /** Restored replay of the largest cascade from a saved run. */
  private savedReplay: ReplayRecord[] = [];
  private savedLargest = 0;

  private events: GameEvent[] = [];
  private cooldown = 0;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private readonly bossRng: Rng;
  private readonly firstWave: number;
  private readonly unlockedAll: boolean;
  /** Children of defeated splitters, spawned at the end of the step. */
  private deferred: SpawnSpec[] = [];

  constructor(opts: WorldOptions) {
    this.seed = opts.seed >>> 0;
    this.endless = !!opts.endless;
    const first = Math.max(1, Math.floor(opts.startWave ?? 1));
    this.firstWave = this.endless ? first : Math.min(first, WAVES.total);
    this.wave = this.firstWave;
    this.unlockedAll = !!opts.unlockAll;
    this.reactions = new ReactionEngine(this);
    this.bossRng = new Rng(deriveSeed(this.seed, 'boss'));
    this.stats.wavesCleared = this.wave - 1;
    this.runner = this.createRunner(this.wave);
    if (this.unlockedAll) {
      unlockAll(this.loadout);
      this.selected = this.loadout.elements[0];
      this.beginWave(this.wave);
    } else {
      this.offer = buildOffer(0, this.loadout, new Rng(0), this.offerContext());
    }
  }

  /** Resume a run saved between waves (it opens on that upgrade choice). */
  static fromSave(save: RunSave): World {
    const world = new World({ seed: save.seed, startWave: save.clearedWave, endless: save.endless });
    world.loadout.elements = [...save.elements];
    Object.assign(world.loadout.levels, save.levels);
    world.health = save.health;
    Object.assign(world.stats, save.stats);
    world.savedLargest = save.largestCascade;
    world.reactions.stats.largestCascade = save.largestCascade;
    world.savedReplay = save.largestReplay;
    world.rerollsLeft = save.rerollsLeft;
    world.selected = save.selected;
    world.offer = [...save.offer];
    world.phase = 'upgrade';
    world.events = [];
    return world;
  }

  toSave(): RunSave | null {
    if (this.phase !== 'upgrade') return null;
    return {
      version: 1,
      seed: this.seed,
      endless: this.endless,
      clearedWave: this.wave,
      health: this.health,
      elements: [...this.loadout.elements],
      levels: { ...this.loadout.levels },
      stats: { ...this.stats },
      largestCascade: this.largestCascade,
      largestReplay: this.largestReplay,
      rerollsLeft: this.rerollsLeft,
      selected: this.selected,
      offer: [...this.offer],
    };
  }

  // ------------------------------------------------------------ host / API

  get levels(): Readonly<Record<ModifierId, number>> {
    return this.loadout.levels;
  }

  get time(): number {
    return this.stats.time;
  }

  get totalWaves(): number {
    return this.endless ? Infinity : WAVES.total;
  }

  get act(): number {
    return actOf(this.wave);
  }

  get largestCascade(): number {
    return Math.max(this.reactions.stats.largestCascade, this.savedLargest);
  }

  /** Damage records of the biggest cascade, for the results-screen replay. */
  get largestReplay(): ReplayRecord[] {
    const live = this.reactions.largest;
    if (live && live.hits.size >= this.savedLargest) return live.replay.map((r) => ({ ...r }));
    return this.savedReplay;
  }

  offerContext(): OfferContext {
    return { health: this.health, maxHealth: PLAYER.maxHealth, unlimitedSlots: this.unlockedAll };
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  onDefeat(enemy: Enemy, cause: DamageSource, cascade: Cascade | null): void {
    const combo = cascade ? Math.min(SCORE.comboMax, 1 + SCORE.comboPerHit * (cascade.hits.size - 1)) : 1;
    const score = awardDefeat(enemy, this.stats, combo);
    if (score === null) return;
    this.runner.noteResolved();
    this.emit({ type: 'kill', x: enemy.x, y: enemy.y, kind: enemy.kind, radius: enemy.radius, cause, elite: enemy.traits.elite, score });
    if (enemy.kind === 'splitter') this.queueSplit(enemy, 2);
  }

  selectElement(element: Element): boolean {
    if (!this.loadout.elements.includes(element)) return false;
    this.selected = element;
    return true;
  }

  /** Aim towards a point in gameplay coordinates (clamped to the arc). */
  aimAt(x: number, y: number): void {
    const dx = x - WORLD.launcherX;
    const dy = WORLD.launcherY - y;
    this.setAimAngle(Math.atan2(dx, Math.max(dy, 1)));
  }

  setAimAngle(angle: number): void {
    const max = PLAYER.maxAimAngleDeg * DEG;
    this.aimAngle = Math.max(-max, Math.min(max, angle));
  }

  /** Pick one of the current offers (starting element, new element or modifier). */
  chooseUpgrade(index: number): boolean {
    if (this.phase !== 'upgrade' && this.phase !== 'start') return false;
    const id = this.offer[index];
    if (!id) return false;
    const level = applyUpgrade(this.loadout, id, this.offerContext());
    if (id === 'repair') this.health = Math.min(PLAYER.maxHealth, this.health + 1);
    this.emit({ type: 'upgrade', id, level });
    if ((this.loadout.elements as UpgradeId[]).includes(id)) this.selected = id as Element;
    this.offer = [];
    if (this.phase === 'start') {
      this.grantTestElements();
      this.beginWave(this.wave);
    } else {
      this.beginWave(this.wave + 1);
    }
    return true;
  }

  /** Swap the current modifier choices for new ones (limited per run). */
  reroll(): boolean {
    if (this.phase !== 'upgrade' || this.rerollsLeft <= 0) return false;
    if (offerKindAfterWave(this.wave, this.loadout) !== 'modifier') return false;
    this.rerollsLeft--;
    const rng = new Rng(deriveSeed(this.seed, `reroll-${this.wave}-${this.rerollsLeft}`));
    this.offer = buildOffer(this.wave, this.loadout, rng, this.offerContext());
    return true;
  }

  /** Testing (`?wave=N`): grant the elements a normal run would have picked by then. */
  private grantTestElements(): void {
    const picks = PLAYER.elementPickAfterWaves.filter((w) => w < this.firstWave).length;
    const rng = new Rng(deriveSeed(this.seed, 'test-elements'));
    for (let i = 0; i < picks && this.loadout.elements.length < PLAYER.elementSlots; i++) {
      const offer = buildElementOffer(this.loadout, rng);
      if (offer.length === 0) break;
      applyUpgrade(this.loadout, offer[0], this.offerContext());
    }
  }

  // ------------------------------------------------------------ simulation

  step(dt: number): void {
    if (this.phase !== 'playing') return;
    this.stats.time += dt;

    const arenaEmpty = this.enemies.length === 0;
    for (const spec of this.runner.update(dt, arenaEmpty)) this.spawn(spec);

    this.updateFiring(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.reactions.update(dt);
    this.separateEnemies(dt);
    this.removeDead();
    for (const spec of this.deferred.splice(0)) this.spawn(spec);

    if (this.health <= 0) {
      this.health = 0;
      this.phase = 'defeat';
      this.firing = false;
      this.emit({ type: 'defeat' });
      return;
    }
    if (this.runner.complete) this.completeWave();
  }

  private createRunner(wave: number): WaveRunner {
    return new WaveRunner(wave, new Rng(deriveSeed(this.seed, `wave-${wave}`)));
  }

  private beginWave(wave: number): void {
    this.wave = wave;
    this.runner = this.createRunner(wave);
    this.projectiles.length = 0;
    this.reactions.clear();
    this.cooldown = 0.25;
    this.phase = 'playing';
    this.emit({ type: 'waveStart', wave });
  }

  private completeWave(): void {
    const cleared = this.wave;
    this.stats.wavesCleared = cleared;
    this.stats.score += SCORE.waveClearBonus * cleared;
    this.firing = false;
    this.projectiles.length = 0;
    this.reactions.clear();
    this.emit({ type: 'waveClear', wave: cleared });
    if (cleared % WAVES.actLength === 0) {
      const healed = this.health < PLAYER.maxHealth;
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.actClearHeal);
      this.emit({ type: 'actClear', act: actOf(cleared), healed });
    }
    if (cleared >= this.totalWaves) {
      this.phase = 'victory';
      this.emit({ type: 'victory' });
      return;
    }
    this.offer = buildOffer(cleared, this.loadout, new Rng(deriveSeed(this.seed, `offer-${cleared}`)), this.offerContext());
    if (this.offer.length === 0) {
      this.beginWave(cleared + 1);
    } else {
      this.phase = 'upgrade';
    }
  }

  /** After a normal victory, carry the same run on into endless waves. */
  continueEndless(): boolean {
    if (this.phase !== 'victory' || this.endless) return false;
    this.endless = true;
    this.offer = buildOffer(this.wave, this.loadout, new Rng(deriveSeed(this.seed, `offer-${this.wave}`)), this.offerContext());
    if (this.offer.length === 0) this.beginWave(this.wave + 1);
    else this.phase = 'upgrade';
    return true;
  }

  private spawn(spec: SpawnSpec): Enemy {
    const stats = ENEMIES[spec.kind];
    const traits: EnemyTraits = { ...spec.traits };
    const elite = traits.elite;
    const hp = Math.round(stats.hp * spec.hpMult * (elite ? ELITE.hpMult : 1));
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind: spec.kind,
      traits,
      x: spec.x,
      y: spec.y,
      radius: stats.radius * (elite ? ELITE.radiusMult : 1),
      hp,
      maxHp: hp,
      speed: spec.speed,
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
      supportTimer: BOSS.supportInterval * 0.6,
      splits: 0,
      shieldHits: SHIELD.directHits,
    };
    this.enemies.push(enemy);
    this.runner.noteSpawned();
    if (isBossKind(spec.kind)) this.emit({ type: 'bossSpawn', kind: spec.kind, x: enemy.x, y: enemy.y });
    return enemy;
  }

  /** Test helper: add an enemy directly at a position. */
  spawnAt(kind: EnemyKind, x: number, y: number, hpMult = 1, traits: Partial<EnemyTraits> = {}): Enemy {
    return this.spawn({ kind, x, y, speed: ENEMIES[kind].speed, hpMult, traits: { ...noTraits(), ...traits } });
  }

  private queueSplit(parent: Enemy, count: number): void {
    const hpMult = parent.maxHp / ENEMIES[parent.kind].hp / (parent.traits.elite ? ELITE.hpMult : 1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.PI / 2;
      this.deferred.push({
        kind: 'splitling',
        x: Math.max(20, Math.min(WORLD.width - 20, parent.x + Math.cos(a) * parent.radius * 0.8)),
        y: parent.y + Math.sin(a) * parent.radius * 0.5 - 10,
        speed: ENEMIES.splitling.speed,
        hpMult: isBossKind(parent.kind) ? 1 : hpMult,
        traits: noTraits(),
      });
    }
    this.emit({ type: 'split', x: parent.x, y: parent.y, count });
  }

  private updateFiring(dt: number): void {
    this.cooldown -= dt;
    if (!this.firing) {
      if (this.cooldown < 0) this.cooldown = 0;
      return;
    }
    if (this.cooldown > 0) return;
    this.cooldown = Math.max(this.cooldown, -dt) + fireInterval(this.loadout);
    this.fireVolley();
  }

  private fireVolley(): void {
    const element = this.selected;
    const base = ELEMENTS[element].damage;
    const angles: { a: number; minor: boolean }[] = [{ a: this.aimAngle, minor: false }];
    if (this.loadout.levels.splitShot > 0) {
      const spread = PLAYER.splitShotAngleDeg * DEG;
      angles.push({ a: this.aimAngle - spread, minor: true }, { a: this.aimAngle + spread, minor: true });
    }
    let fired = 0;
    for (const { a, minor } of angles) {
      if (this.projectiles.length >= PLAYER.maxProjectiles) break;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      this.projectiles.push({
        id: this.nextProjectileId++,
        element,
        x: WORLD.launcherX + sin * 44,
        y: WORLD.launcherY - cos * 44,
        vx: sin * PLAYER.projectileSpeed,
        vy: -cos * PLAYER.projectileSpeed,
        radius: PLAYER.projectileRadius * (minor ? 0.75 : 1),
        damage: base * (minor ? PLAYER.splitShotDamageMult : 1),
        bouncesLeft: this.loadout.levels.ricochet > 0 ? PLAYER.ricochetBounces : 0,
        hitsLeft: this.loadout.levels.piercing > 0 ? PLAYER.piercingHits : 1,
        hitIds: [],
        alive: true,
        minor,
      });
      fired++;
    }
    if (fired > 0) {
      this.stats.shots++;
      this.emit({ type: 'shot', element, x: WORLD.launcherX, y: WORLD.launcherY, angle: this.aimAngle, count: fired });
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < WORLD.wallLeft + p.radius || p.x > WORLD.wallRight - p.radius) {
        if (p.bouncesLeft > 0) {
          p.bouncesLeft--;
          p.vx = -p.vx;
          p.x = p.x < WORLD.width / 2 ? WORLD.wallLeft + p.radius : WORLD.wallRight - p.radius;
          this.emit({ type: 'bounce', x: p.x, y: p.y, element: p.element });
        } else {
          p.alive = false;
          continue;
        }
      }
      if (p.y < WORLD.arenaTop - 12) {
        p.alive = false;
        continue;
      }

      let target: Enemy | null = null;
      let best = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || e.y + e.radius < WORLD.arenaTop || p.hitIds.includes(e.id)) continue;
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        const reach = e.radius + p.radius;
        if (d2 <= reach * reach && d2 < best) {
          best = d2;
          target = e;
        }
      }
      if (target) {
        p.hitIds.push(target.id);
        p.hitsLeft--;
        if (p.hitsLeft <= 0) p.alive = false;
        this.reactions.projectileHit({ element: p.element, damage: p.damage, x: p.x, y: p.y }, target);
      }
    }
  }

  private updateEnemies(dt: number): void {
    // Iterate over a snapshot: damage-over-time defeats can trigger reactions that inspect the list.
    const list = this.enemies.slice();
    for (const e of list) {
      if (!e.alive) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      let speed = e.speed * speedFactor(e);
      if (e.kind === 'monolith' && e.hp < e.maxHp * BOSS.monolithEnrageAt) speed *= BOSS.monolithEnrageSpeedMult;
      e.y += speed * dt;

      const dot = tickStatuses(e, dt);
      if (dot.burn > 0) this.reactions.dotTick(e, dot.burn, 'burn');
      if (dot.poison > 0 && e.alive) this.reactions.dotTick(e, dot.poison, 'poison');
      if (!e.alive) continue;

      if (isBoss(e)) this.updateBoss(e, dt);

      if (e.y >= WORLD.defenceLineY) {
        e.alive = false;
        const damage = isBoss(e) ? BOSS.leakDamage : 1;
        this.health -= damage;
        this.stats.leaks++;
        this.runner.noteResolved();
        this.emit({ type: 'leak', x: e.x, y: e.y, kind: e.kind, damage: Math.min(damage, PLAYER.maxHealth) });
      }
    }
  }

  private updateBoss(e: Enemy, dt: number): void {
    if (e.kind === 'hive') {
      const thresholds = BOSS.hiveSplitThresholds;
      while (e.splits < thresholds.length && e.hp <= e.maxHp * thresholds[e.splits]) {
        e.splits++;
        this.queueSplit(e, BOSS.hiveSplitCount);
      }
    }
    e.supportTimer -= dt;
    if (e.supportTimer <= 0 && e.y > WORLD.arenaTop + 40) {
      e.supportTimer = BOSS.supportInterval;
      for (const spec of bossSupportSpawns(e.kind, e.x, this.wave, this.bossRng)) this.deferred.push(spec);
      this.emit({ type: 'bossSupport', x: e.x, y: e.y });
    }
  }

  /** Gently push overlapping enemies apart (gusts and singularities bunch them up). */
  private separateEnemies(dt: number): void {
    const list = this.enemies;
    const k = Math.min(1, 6 * dt);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) * k;
        const nx = d2 > 0 ? dx / d : 1;
        const ny = d2 > 0 ? dy / d : 0;
        // Bosses don't budge; everything else shares the push.
        const wa = isBoss(a) ? 0 : isBoss(b) ? 1 : 0.5;
        const wb = isBoss(b) ? 0 : isBoss(a) ? 1 : 0.5;
        a.x = clampX(a.x - nx * push * wa, a.radius);
        a.y -= ny * push * wa;
        b.x = clampX(b.x + nx * push * wb, b.radius);
        b.y += ny * push * wb;
      }
    }
  }

  private removeDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive) this.enemies.splice(i, 1);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
    }
  }
}

function clampX(x: number, r: number): number {
  return Math.max(WORLD.wallLeft + r, Math.min(WORLD.wallRight - r, x));
}

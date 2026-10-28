import { BOSS, ELEMENTS, ENEMIES, PLAYER, WAVES, WORLD, type EnemyKind } from '../config';
import { awardDefeat } from './damage';
import { ReactionEngine, type ReactionHost, type ReactionModifiers } from './reactions';
import { Rng, deriveSeed } from './rng';
import { tickStatuses } from './status';
import {
  applyUpgrade,
  buildOffer,
  createLoadout,
  elementsToGrantAfterWave,
  fireInterval,
  splashRadius,
  unlockAll,
  type Loadout,
} from './upgrades';
import { WaveRunner, bossSupportSpawns, type SpawnSpec } from './waves';
import type { DamageSource, Element, Enemy, GameEvent, Phase, Projectile, UpgradeId } from './types';

export interface WorldOptions {
  seed: number;
  startWave?: number;
  unlockAll?: boolean;
}

export interface RunStats {
  kills: number;
  score: number;
  shots: number;
  leaks: number;
  time: number;
  wavesCleared: number;
}

const DEG = Math.PI / 180;

/**
 * The complete, renderer-independent game simulation. Phaser scenes feed it
 * input, call `step`, read its state for drawing and drain its events for
 * effects and audio.
 */
export class World implements ReactionHost {
  readonly seed: number;
  phase: Phase = 'playing';
  wave: number;
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
  /** Current upgrade choices while phase === 'upgrade'. */
  offer: UpgradeId[] = [];
  runner: WaveRunner;

  private events: GameEvent[] = [];
  private cooldown = 0;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private readonly bossRng: Rng;

  constructor(opts: WorldOptions) {
    this.seed = opts.seed >>> 0;
    this.wave = Math.min(Math.max(Math.floor(opts.startWave ?? 1), 1), WAVES.total);
    this.reactions = new ReactionEngine(this);
    this.bossRng = new Rng(deriveSeed(this.seed, 'boss'));
    if (opts.unlockAll) {
      unlockAll(this.loadout);
    } else {
      // Starting later (testing) grants what a normal run would have by then.
      if (this.wave >= 2) this.loadout.elements.add('water');
      if (this.wave >= 4) this.loadout.elements.add('lightning');
    }
    this.stats.wavesCleared = this.wave - 1;
    this.runner = this.createRunner(this.wave);
    this.emit({ type: 'waveStart', wave: this.wave });
  }

  // ------------------------------------------------------------ host / API

  get modifiers(): ReactionModifiers {
    return {
      flashover: this.loadout.levels.flashover > 0,
      stormRelay: this.loadout.levels.stormRelay > 0,
      splashRadius: splashRadius(this.loadout),
    };
  }

  get largestCascade(): number {
    return this.reactions.stats.largestCascade;
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  onDefeat(enemy: Enemy, cause: DamageSource): void {
    if (!awardDefeat(enemy, this.stats)) return;
    this.runner.noteResolved();
    this.emit({ type: 'kill', x: enemy.x, y: enemy.y, kind: enemy.kind, radius: enemy.radius, cause });
  }

  selectElement(element: Element): boolean {
    if (!this.loadout.elements.has(element)) return false;
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

  chooseUpgrade(index: number): boolean {
    if (this.phase !== 'upgrade') return false;
    const id = this.offer[index];
    if (!id) return false;
    const level = applyUpgrade(this.loadout, id);
    this.emit({ type: 'upgrade', id, level });
    if (id === 'water' || id === 'lightning') this.selected = id;
    this.offer = [];
    this.startWave(this.wave + 1);
    return true;
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
    this.removeDead();

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

  private startWave(wave: number): void {
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
    this.firing = false;
    this.projectiles.length = 0;
    this.reactions.clear();
    this.emit({ type: 'waveClear', wave: cleared });
    if (cleared >= WAVES.total) {
      this.phase = 'victory';
      this.emit({ type: 'victory' });
      return;
    }
    for (const element of elementsToGrantAfterWave(cleared, this.loadout)) {
      applyUpgrade(this.loadout, element);
      this.emit({ type: 'elementGranted', element });
    }
    this.offer = buildOffer(cleared, this.loadout, new Rng(deriveSeed(this.seed, `offer-${cleared}`)));
    if (this.offer.length === 0) {
      this.startWave(cleared + 1);
    } else {
      this.phase = 'upgrade';
    }
  }

  private spawn(spec: SpawnSpec): Enemy {
    const stats = ENEMIES[spec.kind];
    const hp = Math.round(stats.hp * spec.hpMult);
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind: spec.kind,
      x: spec.x,
      y: spec.y,
      radius: stats.radius,
      hp,
      maxHp: hp,
      speed: spec.speed,
      alive: true,
      rewarded: false,
      wet: 0,
      burn: null,
      flash: 0,
      age: 0,
      supportTimer: BOSS.supportInterval * 0.6,
    };
    this.enemies.push(enemy);
    this.runner.noteSpawned();
    if (spec.kind === 'boss') this.emit({ type: 'bossSpawn', x: enemy.x, y: enemy.y });
    return enemy;
  }

  /** Test helper: add an enemy directly at a position. */
  spawnAt(kind: EnemyKind, x: number, y: number, hpMult = 1): Enemy {
    return this.spawn({ kind, x, y, speed: ENEMIES[kind].speed, hpMult });
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
        if (!e.alive || e.y + e.radius < WORLD.arenaTop) continue;
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        const reach = e.radius + p.radius;
        if (d2 <= reach * reach && d2 < best) {
          best = d2;
          target = e;
        }
      }
      if (target) {
        p.alive = false;
        this.reactions.projectileHit({ element: p.element, damage: p.damage, x: p.x, y: p.y }, target);
      }
    }
  }

  private updateEnemies(dt: number): void {
    // Iterate over a snapshot: burn defeats can trigger reactions that inspect the list.
    const list = this.enemies.slice();
    for (const e of list) {
      if (!e.alive) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.y += e.speed * dt;

      const burn = tickStatuses(e, dt);
      if (burn > 0) this.reactions.burnTick(e, burn);
      if (!e.alive) continue;

      if (e.kind === 'boss') {
        e.supportTimer -= dt;
        if (e.supportTimer <= 0 && e.y > WORLD.arenaTop + 40) {
          e.supportTimer = BOSS.supportInterval;
          for (const spec of bossSupportSpawns(e.x, this.wave, this.bossRng)) this.spawn(spec);
          this.emit({ type: 'bossSupport', x: e.x, y: e.y });
        }
      }

      if (e.y >= WORLD.defenceLineY) {
        e.alive = false;
        const damage = e.kind === 'boss' ? BOSS.leakDamage : 1;
        this.health -= damage;
        this.stats.leaks++;
        this.runner.noteResolved();
        this.emit({ type: 'leak', x: e.x, y: e.y, kind: e.kind, damage: Math.min(damage, PLAYER.maxHealth) });
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

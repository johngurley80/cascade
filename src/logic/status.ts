import { BOSS_KINDS, ELEMENTS } from '../config';
import type { Cascade, DotStatus, Enemy } from './types';

export const isBoss = (enemy: Enemy): boolean => BOSS_KINDS.includes(enemy.kind);

export function isWet(enemy: Enemy): boolean {
  return enemy.wet > 0;
}

export function isBurning(enemy: Enemy): boolean {
  return enemy.burn !== null && enemy.burn.remaining > 0;
}

export function isPoisoned(enemy: Enemy): boolean {
  return enemy.poison !== null && enemy.poison.remaining > 0;
}

export function isFrozen(enemy: Enemy): boolean {
  return enemy.frozen > 0;
}

/** Current movement multiplier from frost statuses. */
export function speedFactor(enemy: Enemy): number {
  if (enemy.frozen > 0) return 0;
  if (enemy.chill > 0) return ELEMENTS.frost.chillSpeedMult;
  return 1;
}

/** Wet the enemy (refreshes duration, never shortens it). */
export function applyWet(enemy: Enemy, duration: number = ELEMENTS.water.wetDuration): void {
  if (!enemy.alive) return;
  enemy.wet = Math.max(enemy.wet, duration);
}

/** Remove wet. Returns true if the enemy was wet. */
export function consumeWet(enemy: Enemy): boolean {
  if (enemy.wet <= 0) return false;
  enemy.wet = 0;
  return true;
}

function applyDot(
  current: DotStatus | null,
  duration: number,
  dps: number,
  tick: number,
  cascade: Cascade | null,
  generation: number,
): DotStatus {
  if (current && current.remaining > 0) {
    current.remaining = Math.max(current.remaining, duration);
    // Keep the deeper generation so re-application can never extend a cascade's depth.
    if (generation >= current.generation) {
      current.cascade = cascade;
      current.generation = generation;
    }
    return current;
  }
  return { remaining: duration, dps, interval: tick, tickTimer: tick, cascade, generation };
}

/**
 * Ignite the enemy. The burn records the cascade and generation that applied
 * it so that a later burn defeat stays within that cascade's depth budget.
 * Fireproof enemies can't burn. Returns true if the enemy is now burning.
 */
export function applyBurn(enemy: Enemy, cascade: Cascade | null, generation: number): boolean {
  if (!enemy.alive || enemy.traits.fireproof) return false;
  const cfg = ELEMENTS.fire;
  enemy.burn = applyDot(enemy.burn, cfg.burnDuration, cfg.burnDps, cfg.burnTickInterval, cascade, generation);
  return true;
}

export function extinguish(enemy: Enemy): boolean {
  if (!isBurning(enemy)) return false;
  enemy.burn = null;
  return true;
}

/** Poison (corrode) the enemy. Poison eats through shields. Returns true if a shield broke. */
export function applyPoison(enemy: Enemy, cascade: Cascade | null, generation: number): boolean {
  if (!enemy.alive) return false;
  const cfg = ELEMENTS.toxin;
  enemy.poison = applyDot(enemy.poison, cfg.poisonDuration, cfg.poisonDps, cfg.poisonTickInterval, cascade, generation);
  if (enemy.traits.shield) {
    enemy.traits.shield = false;
    return true;
  }
  return false;
}

export function consumePoison(enemy: Enemy): boolean {
  if (!isPoisoned(enemy)) return false;
  enemy.poison = null;
  return true;
}

export function applyChill(enemy: Enemy, durationMult = 1): void {
  if (!enemy.alive) return;
  const boss = isBoss(enemy) ? ELEMENTS.frost.bossStatusMult : 1;
  enemy.chill = Math.max(enemy.chill, ELEMENTS.frost.chillDuration * boss * durationMult);
}

/** Freeze solid. Brittle freezes shatter for double. */
export function applyFreeze(enemy: Enemy, durationMult = 1, brittle = false): void {
  if (!enemy.alive) return;
  const boss = isBoss(enemy) ? ELEMENTS.frost.bossStatusMult : 1;
  enemy.frozen = Math.max(enemy.frozen, ELEMENTS.frost.freezeDuration * boss * durationMult);
  enemy.brittle = enemy.brittle || brittle;
}

/** End a freeze. Returns whether it was brittle (or null if the enemy wasn't frozen). */
export function consumeFreeze(enemy: Enemy): { brittle: boolean } | null {
  if (enemy.frozen <= 0) return null;
  const brittle = enemy.brittle;
  enemy.frozen = 0;
  enemy.brittle = false;
  return { brittle };
}

function tickDot(dot: DotStatus | null, dt: number): { damage: number; dot: DotStatus | null } {
  if (!dot) return { damage: 0, dot: null };
  let damage = 0;
  dot.tickTimer -= dt;
  while (dot.tickTimer <= 0 && dot.remaining > 0) {
    damage += dot.dps * dot.interval;
    dot.tickTimer += dot.interval;
  }
  dot.remaining -= dt;
  return { damage, dot: dot.remaining > 0 ? dot : null };
}

/**
 * Advance status timers. Returns damage-over-time that should be dealt this
 * step (in discrete ticks, so it reads as pulses rather than a drain).
 */
export function tickStatuses(enemy: Enemy, dt: number): { burn: number; poison: number } {
  if (enemy.wet > 0) enemy.wet = Math.max(0, enemy.wet - dt);
  if (enemy.chill > 0) enemy.chill = Math.max(0, enemy.chill - dt);
  if (enemy.frozen > 0) {
    enemy.frozen = Math.max(0, enemy.frozen - dt);
    if (enemy.frozen === 0) enemy.brittle = false;
  }
  const b = tickDot(enemy.burn, dt);
  enemy.burn = b.dot;
  const p = tickDot(enemy.poison, dt);
  enemy.poison = p.dot;
  return { burn: b.damage, poison: p.damage };
}

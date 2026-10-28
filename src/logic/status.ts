import { ELEMENTS } from '../config';
import type { Cascade, Enemy } from './types';

export function isWet(enemy: Enemy): boolean {
  return enemy.wet > 0;
}

export function isBurning(enemy: Enemy): boolean {
  return enemy.burn !== null && enemy.burn.remaining > 0;
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

/**
 * Ignite the enemy. A fresh burn records the cascade and generation that
 * applied it so that a later burn defeat stays within that cascade's depth budget.
 */
export function applyBurn(enemy: Enemy, cascade: Cascade | null, generation: number): void {
  if (!enemy.alive) return;
  const cfg = ELEMENTS.fire;
  if (enemy.burn && enemy.burn.remaining > 0) {
    enemy.burn.remaining = Math.max(enemy.burn.remaining, cfg.burnDuration);
    // Keep the deeper generation so re-ignition can never extend a cascade's depth.
    if (generation >= enemy.burn.generation) {
      enemy.burn.cascade = cascade;
      enemy.burn.generation = generation;
    }
    return;
  }
  enemy.burn = {
    remaining: cfg.burnDuration,
    dps: cfg.burnDps,
    tickTimer: cfg.burnTickInterval,
    cascade,
    generation,
  };
}

/**
 * Advance status timers. Returns burn damage that should be dealt this step
 * (applied in discrete ticks so it reads as pulses rather than a drain).
 */
export function tickStatuses(enemy: Enemy, dt: number): number {
  if (enemy.wet > 0) enemy.wet = Math.max(0, enemy.wet - dt);
  const burn = enemy.burn;
  if (!burn) return 0;
  const interval = ELEMENTS.fire.burnTickInterval;
  let damage = 0;
  burn.tickTimer -= dt;
  while (burn.tickTimer <= 0 && burn.remaining > 0) {
    damage += burn.dps * interval;
    burn.tickTimer += interval;
  }
  burn.remaining -= dt;
  if (burn.remaining <= 0) enemy.burn = null;
  return damage;
}

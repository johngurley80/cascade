import { ELITE, ENEMIES } from '../config';
import type { Enemy } from './types';

export interface DamageResult {
  dealt: number;
  /** True only on the single call that takes the enemy from alive to dead. */
  killed: boolean;
}

/**
 * Apply damage. The enemy is marked dead immediately when its health reaches
 * zero, so later damage in the same frame (or the same cascade) is ignored.
 */
export function damageEnemy(enemy: Enemy, amount: number): DamageResult {
  if (!enemy.alive || amount <= 0) return { dealt: 0, killed: false };
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= amount;
  enemy.flash = 0.09;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
    return { dealt, killed: true };
  }
  return { dealt, killed: false };
}

export interface RewardStats {
  kills: number;
  score: number;
}

/** Base score for defeating an enemy (elites are worth more). */
export function baseScore(enemy: Enemy): number {
  return ENEMIES[enemy.kind].score * (enemy.traits.elite ? ELITE.scoreMult : 1);
}

/**
 * Award a defeat exactly once per enemy, with an optional score multiplier.
 * Returns the score awarded, or null if this enemy was already rewarded.
 */
export function awardDefeat(enemy: Enemy, stats: RewardStats, multiplier = 1): number | null {
  if (enemy.rewarded) return null;
  enemy.rewarded = true;
  const score = Math.round(baseScore(enemy) * multiplier);
  stats.kills += 1;
  stats.score += score;
  return score;
}

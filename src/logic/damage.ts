import { ENEMIES } from '../config';
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

/** Award a defeat exactly once per enemy. Returns false if already awarded. */
export function awardDefeat(enemy: Enemy, stats: RewardStats): boolean {
  if (enemy.rewarded) return false;
  enemy.rewarded = true;
  stats.kills += 1;
  stats.score += ENEMIES[enemy.kind].score;
  return true;
}

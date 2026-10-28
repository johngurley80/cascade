/**
 * Central tuning values for Cascade. Every number that affects gameplay,
 * balance or performance caps lives here so it can be tuned in one place.
 *
 * All distances are in gameplay units: the arena is a fixed 720 × 1280
 * portrait space, independent of the actual display size.
 */

export const WORLD = {
  width: 720,
  height: 1280,
  /** Enemies emerge from underneath the HUD panel. */
  arenaTop: 92,
  /** Enemies whose centre crosses this line are removed and cost health. */
  defenceLineY: 1036,
  launcherX: 360,
  launcherY: 1088,
  /** Bottom of the play area; the element bar is drawn below it. */
  arenaBottom: 1128,
  /** Horizontal limits used for spawning and side-wall bounces. */
  wallLeft: 0,
  wallRight: 720,
  spawnMarginX: 56,
  /** Fixed simulation step in seconds. */
  fixedStep: 1 / 60,
  /** Max simulation steps per rendered frame (avoids spiral of death). */
  maxStepsPerFrame: 5,
} as const;

export const PLAYER = {
  maxHealth: 3,
  /** Seconds between volleys before Rapid fire. */
  fireInterval: 0.2,
  /** Each Rapid fire level multiplies the interval by this. */
  rapidFireIntervalMult: 0.84,
  /** Aiming arc: ±70° from vertical. */
  maxAimAngleDeg: 70,
  projectileSpeed: 1000,
  projectileRadius: 7,
  /** Hard cap on live projectiles; extra volleys are skipped. */
  maxProjectiles: 70,
  ricochetBounces: 2,
  splitShotAngleDeg: 11,
  splitShotDamageMult: 0.5,
} as const;

export const ELEMENTS = {
  fire: {
    damage: 10,
    burnDuration: 1.8,
    burnDps: 6,
    burnTickInterval: 0.3,
  },
  water: {
    damage: 5,
    splashRadius: 82,
    /** Added splash radius per Wider splash level. */
    splashRadiusPerLevel: 32,
    wetDuration: 5.5,
  },
  lightning: {
    damage: 9,
    /** Max distance of one hop between wet enemies. */
    chainRange: 175,
    /** Additional wet targets beyond the first. */
    chainTargets: 4,
    chainDamage: 9,
  },
} as const;

export const REACTIONS = {
  steam: { radius: 108, damage: 14, delay: 0.08 },
  flashover: { radius: 92, damage: 8, delay: 0.12 },
  stormRelay: { radius: 210, targets: 2, damage: 7, delay: 0.1 },
  /** Secondary-reaction generations allowed after the originating hit. */
  maxGeneration: 4,
  /** Hard cap on queued (not yet resolved) secondary reactions. */
  maxPendingReactions: 48,
  /** Cascades remain "live" for the counter this long after last activity. */
  cascadeLinger: 1.4,
} as const;

export type EnemyKind = 'basic' | 'fast' | 'tank' | 'boss';

export interface EnemyStats {
  radius: number;
  hp: number;
  speed: number;
  score: number;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  basic: { radius: 20, hp: 30, speed: 34, score: 10 },
  fast: { radius: 14, hp: 12, speed: 72, score: 15 },
  tank: { radius: 30, hp: 110, speed: 20, score: 30 },
  boss: { radius: 74, hp: 3600, speed: 11, score: 500 },
};

export const BOSS = {
  /** Seconds between supporting spawns. */
  supportInterval: 6.5,
  supportCount: 3,
  /** The boss crossing the line costs this much health (all of it). */
  leakDamage: 99,
} as const;

export const WAVES = {
  total: 8,
  /** Enemy HP multiplier per wave beyond the first (the boss uses its fixed HP). */
  hpScalePerWave: 0.16,
  /** Delay before the first group spawns in a wave. */
  introDelay: 1.6,
  /** When the arena is empty, pull the next group forward to this lead time. */
  idleSkipLead: 0.8,
  /** Spacing between enemies inside formations. */
  clusterSpacing: 46,
  rowSpacing: 74,
  rowGap: 64,
  /** Random horizontal jitter applied to formation centres. */
  centreJitter: 90,
} as const;

export const FX = {
  maxParticles: 420,
  reducedParticleMult: 0.35,
  shakeMajor: 0.006,
  shakeDuration: 140,
  boltDuration: 0.26,
  rippleDuration: 0.45,
} as const;

export const STORAGE_KEYS = {
  settings: 'cascade.settings.v1',
  best: 'cascade.best.v1',
} as const;

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
  /** Health restored when an act's boss falls. */
  actClearHeal: 1,
  /** A run holds at most this many elements. */
  elementSlots: 4,
  /** Waves after which the player picks a new element (instead of a modifier). */
  elementPickAfterWaves: [1, 4, 8] as readonly number[],
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
  /** Piercing: enemies one projectile can hit. */
  piercingHits: 2,
  /** Overcharge: damage bonus per level. */
  overchargePerLevel: 0.08,
} as const;

export const ELEMENTS = {
  fire: {
    damage: 10,
    burnDuration: 1.8,
    burnDps: 6,
    burnTickInterval: 0.3,
  },
  water: {
    damage: 7,
    splashRadius: 82,
    /** Added splash radius per Wider splash level. */
    splashRadiusPerLevel: 32,
    wetDuration: 5.5,
  },
  lightning: {
    damage: 10,
    /** Max distance of one hop between wet enemies. */
    chainRange: 175,
    /** Additional wet targets beyond the first. */
    chainTargets: 4,
    /** Extra chain targets from Long chain. */
    longChainBonus: 2,
    chainDamage: 9,
  },
  frost: {
    damage: 8,
    chillDuration: 3,
    /** Speed multiplier while chilled. */
    chillSpeedMult: 0.5,
    freezeDuration: 2.4,
    /** Deep freeze multiplies freeze duration by this. */
    deepFreezeMult: 1.6,
    /** Bosses are only frozen/chilled for this fraction of the time. */
    bossStatusMult: 0.3,
    thermalShockBonus: 14,
  },
  wind: {
    damage: 10,
    gustRadius: 120,
    /** Max distance an enemy is pulled towards the impact in one gust. */
    gustPull: 46,
    /** The struck enemy is pushed back up by this much. */
    knockback: 22,
    /** Every enemy caught in the gust is pushed back by this much. */
    groupKnockback: 5,
    /** Gale force: gust radius and pull bonus per level. */
    galeForcePerLevel: 0.35,
    squallRadiusMult: 1.4,
  },
  toxin: {
    damage: 6,
    poisonDuration: 4.5,
    poisonDps: 5,
    poisonTickInterval: 0.5,
    /** Poisoned (corroded) enemies take this much more damage from everything. */
    corrodeMult: 1.3,
    /** Virulence: poison jumps to this many nearby enemies on death. */
    virulenceTargets: 2,
    virulenceRadius: 160,
  },
  void: {
    damage: 6,
    singularityRadius: 112,
    singularityLife: 1.2,
    /** Pull speed (px/s) towards a singularity's centre. */
    pullSpeed: 70,
    collapseDamage: 16,
    /** Event horizon: radius and life bonus per level. */
    eventHorizonRadius: 0.25,
    eventHorizonLife: 0.3,
    maxSingularities: 6,
  },
} as const;

export const REACTIONS = {
  steam: { radius: 108, damage: 14, delay: 0.08, cloudLife: 2.0, cloudRadiusMult: 0.85, bigSteamMult: 1.3 },
  flashover: { radius: 92, damage: 8, delay: 0.12 },
  stormRelay: { radius: 210, targets: 2, damage: 7, delay: 0.1 },
  shatter: { radius: 95, damage: 16, delay: 0.06, brittleMult: 2, deepFreezeRadiusMult: 1.3 },
  overload: { radius: 74, damage: 12, delay: 0.07 },
  ignition: { radius: 112, damage: 18, delay: 0.1 },
  detonation: { radius: 95, damage: 22, delay: 0.12 },
  steamFront: { radiusMult: 1.6, extraLife: 1.2 },
  arcStorm: { targets: 8, damage: 9 },
  gravityWell: { collapseMult: 2 },
  /** Secondary-reaction generations allowed after the originating hit. */
  maxGeneration: 4,
  /** Catalyst raises the generation limit by this much. */
  catalystBonus: 1,
  /** Hard cap on queued (not yet resolved) secondary reactions. */
  maxPendingReactions: 64,
  maxSteamClouds: 8,
  /** Damage records kept per cascade for the results-screen replay. */
  replayRecordCap: 160,
} as const;

export type EnemyKind = 'basic' | 'fast' | 'tank' | 'splitter' | 'splitling' | 'volatile' | 'hive' | 'aegis' | 'monolith';

export const BOSS_KINDS: readonly EnemyKind[] = ['hive', 'aegis', 'monolith'];

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
  splitter: { radius: 24, hp: 44, speed: 30, score: 20 },
  splitling: { radius: 12, hp: 10, speed: 56, score: 5 },
  volatile: { radius: 19, hp: 24, speed: 36, score: 20 },
  hive: { radius: 70, hp: 1100, speed: 12, score: 400 },
  aegis: { radius: 76, hp: 1800, speed: 11, score: 600 },
  monolith: { radius: 86, hp: 3400, speed: 10, score: 1000 },
};

export const ELITE = {
  hpMult: 2.5,
  radiusMult: 1.15,
  scoreMult: 3,
} as const;

export const SHIELD = {
  /** Direct hits a shield absorbs before it breaks on its own (reactions break it at once). */
  directHits: 4,
} as const;

export const BOSS = {
  /** Seconds between supporting spawns. */
  supportInterval: 8.5,
  supportCount: 3,
  /** A boss crossing the line costs this much health (all of it). */
  leakDamage: 99,
  /** The Aegis boss takes only this fraction of direct projectile damage. */
  aegisDirectMult: 0.4,
  /** The Hive splits off splitlings each time its health drops past these fractions. */
  hiveSplitThresholds: [0.75, 0.5, 0.25] as readonly number[],
  hiveSplitCount: 5,
  /** The Monolith speeds up below this health fraction. */
  monolithEnrageAt: 0.5,
  monolithEnrageSpeedMult: 1.5,
  /** Endless mode: boss HP multiplier per completed boss cycle. */
  endlessCycleHpMult: 0.45,
} as const;

export const WAVES = {
  /** Waves in a normal run (3 acts of 5). */
  total: 15,
  actLength: 5,
  /** Enemy HP multiplier per wave beyond the first (bosses use their own HP). */
  hpScalePerWave: 0.12,
  /** Steeper HP scaling for endless waves beyond the normal run. */
  endlessHpScalePerWave: 0.2,
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

export const UPGRADES = {
  offerSize: 3,
  /** Relative chance of each rarity being drawn into an offer. */
  rarityWeight: { common: 1, rare: 1.1, combo: 1.8 },
  rerollsPerRun: 1,
} as const;

export const SCORE = {
  /** Kill score multiplier gained per distinct enemy already hit by the same cascade. */
  comboPerHit: 0.15,
  comboMax: 6,
  waveClearBonus: 50,
  leaderboardSize: 10,
} as const;

export const FX = {
  maxParticles: 460,
  reducedParticleMult: 0.35,
  shakeMajor: 0.006,
  shakeDuration: 140,
  boltDuration: 0.26,
  rippleDuration: 0.45,
  /** Cascade sizes that trigger a brief slow-motion hit-stop. */
  hitStopThresholds: [8, 15, 25] as readonly number[],
  hitStopTimeScale: 0.2,
  hitStopDuration: 0.16,
} as const;

export const MUSIC = {
  bpm: 96,
  /** Music bus volume (0–1) relative to sound effects. */
  volume: 0.22,
  /** Brief dip applied under big reactions. */
  duckAmount: 0.45,
  duckTime: 0.35,
} as const;

export const STORAGE_KEYS = {
  settings: 'cascade.settings.v1',
  best: 'cascade.best.v1',
  codex: 'cascade.codex.v1',
  leaderboard: 'cascade.leaderboard.v1',
  save: 'cascade.save.v1',
} as const;

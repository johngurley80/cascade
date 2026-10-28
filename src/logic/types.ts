import type { EnemyKind } from '../config';

export type Element = 'fire' | 'water' | 'lightning' | 'frost' | 'wind' | 'toxin' | 'void';
export const ALL_ELEMENTS: readonly Element[] = ['fire', 'water', 'lightning', 'frost', 'wind', 'toxin', 'void'];

export type ModifierId =
  // Generic
  | 'ricochet'
  | 'splitShot'
  | 'rapidFire'
  | 'piercing'
  | 'catalyst'
  | 'overcharge'
  | 'repair'
  // Element-specific
  | 'flashover'
  | 'stormRelay'
  | 'widerSplash'
  | 'longChain'
  | 'bigSteam'
  | 'deepFreeze'
  | 'galeForce'
  | 'virulence'
  | 'eventHorizon'
  // Combo (need two elements)
  | 'superheatedSteam'
  | 'permafrost'
  | 'toxicStorm'
  | 'plasmaArc'
  | 'gravityWell'
  | 'acidRain';
export type UpgradeId = Element | ModifierId;

/** Every named combination the codex can record. */
export type ReactionId =
  | 'steam'
  | 'chain'
  | 'overload'
  | 'conductive'
  | 'freeze'
  | 'shatter'
  | 'thaw'
  | 'thermalShock'
  | 'firestorm'
  | 'squall'
  | 'steamFront'
  | 'ignition'
  | 'brittle'
  | 'toxicSplash'
  | 'arcStorm'
  | 'flashover'
  | 'stormRelay'
  | 'detonation'
  | 'superheatedSteam'
  | 'permafrost'
  | 'toxicStorm'
  | 'plasmaArc'
  | 'gravityWell'
  | 'acidRain';

/** One damage event inside a cascade, kept for the results-screen replay. */
export interface ReplayRecord {
  /** Seconds since the cascade began. */
  t: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  enemyId: number;
  generation: number;
  source: DamageSource;
}

/** A single originating reaction (one projectile impact) and everything it set off. */
export interface Cascade {
  id: number;
  /** Distinct enemies damaged by any part of this cascade. */
  hits: Set<number>;
  /** Deepest generation reached so far (0 = the originating hit). */
  maxGeneration: number;
  x: number;
  y: number;
  /** Simulation time at which the cascade began. */
  startTime: number;
  replay: ReplayRecord[];
}

export interface DotStatus {
  remaining: number;
  dps: number;
  /** Seconds between damage ticks. */
  interval: number;
  tickTimer: number;
  /** Cascade that applied it, so a damage-over-time defeat stays inside its depth budget. */
  cascade: Cascade | null;
  generation: number;
}

export interface EnemyTraits {
  /** Blocks direct projectile damage until a reaction or poison breaks it. */
  shield: boolean;
  /** Lightning chains can't pass through it. */
  insulated: boolean;
  /** Can't burn; fire-family damage is halved. */
  fireproof: boolean;
  /** Tougher, bigger, worth more. */
  elite: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  traits: EnemyTraits;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  alive: boolean;
  /** Set once when the defeat is awarded; guards against double rewards. */
  rewarded: boolean;
  /** Remaining wet duration in seconds (0 = dry). */
  wet: number;
  burn: DotStatus | null;
  poison: DotStatus | null;
  /** Remaining chill (slow) in seconds. */
  chill: number;
  /** Remaining frozen (stopped) time in seconds. */
  frozen: number;
  /** Frozen while poisoned: shatters for double. */
  brittle: boolean;
  /** Seconds of hit flash left (render only). */
  flash: number;
  /** Seconds since spawn (render only: warp-in, wobble, spin). */
  age: number;
  /** Bosses: time until next support spawn. */
  supportTimer: number;
  /** Hive: health thresholds already split at. */
  splits: number;
  /** Direct hits the shield can still absorb. */
  shieldHits: number;
}

export interface Projectile {
  id: number;
  element: Element;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  bouncesLeft: number;
  /** Enemies this projectile may still hit (Piercing). */
  hitsLeft: number;
  /** Enemies already hit by this projectile. */
  hitIds: number[];
  alive: boolean;
  /** Split-shot side projectile (weaker). */
  minor: boolean;
}

export interface Singularity {
  id: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  cascade: Cascade;
  generation: number;
}

export interface SteamCloud {
  id: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export type DamageSource =
  | Element
  | 'steam'
  | 'flashover'
  | 'relay'
  | 'burn'
  | 'poison'
  | 'shatter'
  | 'overload'
  | 'ignition'
  | 'detonation'
  | 'collapse'
  | 'thermalShock'
  | 'arcStorm';

export interface ChainLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type BlastKind = 'steam' | 'flashover' | 'shatter' | 'overload' | 'ignition' | 'detonation' | 'collapse';

export type GameEvent =
  | { type: 'shot'; element: Element; x: number; y: number; angle: number; count: number }
  | { type: 'hit'; element: Element; x: number; y: number; enemyId: number }
  | { type: 'splash'; x: number; y: number; radius: number; wetted: number }
  | { type: 'gust'; x: number; y: number; radius: number }
  | { type: 'singularity'; x: number; y: number; radius: number }
  | { type: 'blast'; kind: BlastKind; x: number; y: number; radius: number; generation: number }
  | { type: 'chain'; links: ChainLink[]; relay: boolean; generation: number; arc?: boolean }
  | { type: 'status'; status: 'freeze' | 'thaw' | 'thermalShock' | 'poison' | 'brittle'; x: number; y: number }
  | { type: 'shieldBreak'; x: number; y: number }
  | { type: 'shieldBlock'; x: number; y: number }
  | { type: 'reaction'; id: ReactionId; x: number; y: number }
  | { type: 'bounce'; x: number; y: number; element: Element }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind; radius: number; cause: DamageSource; elite: boolean; score: number }
  | { type: 'split'; x: number; y: number; count: number }
  | { type: 'leak'; x: number; y: number; kind: EnemyKind; damage: number }
  | { type: 'cascade'; cascadeId: number; size: number; x: number; y: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number }
  | { type: 'actClear'; act: number; healed: boolean }
  | { type: 'bossSpawn'; kind: EnemyKind; x: number; y: number }
  | { type: 'bossSupport'; x: number; y: number }
  | { type: 'upgrade'; id: UpgradeId; level: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export type Phase = 'start' | 'playing' | 'upgrade' | 'victory' | 'defeat';

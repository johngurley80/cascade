import type { EnemyKind } from '../config';

export type Element = 'fire' | 'water' | 'lightning';
export const ELEMENT_ORDER: readonly Element[] = ['fire', 'water', 'lightning'];

export type ModifierId = 'ricochet' | 'splitShot' | 'flashover' | 'stormRelay' | 'widerSplash' | 'rapidFire';
export type UpgradeId = Element | ModifierId;

/** A single originating reaction (one projectile impact) and everything it set off. */
export interface Cascade {
  id: number;
  /** Distinct enemies damaged by any part of this cascade. */
  hits: Set<number>;
  /** Deepest generation reached so far (0 = the originating hit). */
  maxGeneration: number;
  x: number;
  y: number;
}

export interface BurnStatus {
  remaining: number;
  dps: number;
  tickTimer: number;
  /** Cascade that applied the burn, so burn kills stay inside its depth budget. */
  cascade: Cascade | null;
  generation: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
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
  burn: BurnStatus | null;
  /** Seconds of hit flash left (render only). */
  flash: number;
  /** Seconds since spawn (render only: wobble/spin phase). */
  age: number;
  /** Boss only: time until next support spawn. */
  supportTimer: number;
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
  alive: boolean;
  /** Split-shot side projectile (weaker). */
  minor: boolean;
}

export type DamageSource = Element | 'steam' | 'flashover' | 'relay' | 'burn';

export type GameEvent =
  | { type: 'shot'; element: Element; x: number; y: number; angle: number; count: number }
  | { type: 'hit'; element: Element; x: number; y: number; enemyId: number }
  | { type: 'splash'; x: number; y: number; radius: number; wetted: number }
  | { type: 'steam'; x: number; y: number; radius: number; generation: number }
  | { type: 'flashover'; x: number; y: number; radius: number; generation: number }
  | { type: 'chain'; links: ChainLink[]; relay: boolean; generation: number }
  | { type: 'bounce'; x: number; y: number; element: Element }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind; radius: number; cause: DamageSource }
  | { type: 'leak'; x: number; y: number; kind: EnemyKind; damage: number }
  | { type: 'cascade'; cascadeId: number; size: number; x: number; y: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number }
  | { type: 'bossSpawn'; x: number; y: number }
  | { type: 'bossSupport'; x: number; y: number }
  | { type: 'upgrade'; id: UpgradeId; level: number }
  | { type: 'elementGranted'; element: Element }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface ChainLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Phase = 'playing' | 'upgrade' | 'victory' | 'defeat';

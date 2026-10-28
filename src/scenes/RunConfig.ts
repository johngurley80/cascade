import { dailySeed, randomSeed, utcDateKey, type LaunchParams } from '../logic/params';

/** Everything needed to start (or restart) a run. */
export interface RunConfig {
  seed: number;
  /** Seed was chosen explicitly (URL or daily) and is reused on restart. */
  fixedSeed: boolean;
  startWave: number;
  unlockAll: boolean;
  /** UTC date key for the daily run, or null for a normal run. */
  daily: string | null;
  speed: number;
}

/** Runs started with testing parameters don't count towards the saved best. */
export function isTestRun(cfg: RunConfig): boolean {
  return cfg.startWave > 1 || cfg.unlockAll || cfg.speed > 1;
}

export function normalRun(params: LaunchParams): RunConfig {
  return {
    seed: params.seed ?? randomSeed(),
    fixedSeed: params.seed !== null,
    startWave: params.wave,
    unlockAll: params.unlockAll,
    daily: null,
    speed: params.speed,
  };
}

export function dailyRun(params: LaunchParams, now = new Date()): RunConfig {
  return {
    seed: dailySeed(now),
    fixedSeed: true,
    startWave: 1,
    unlockAll: false,
    daily: utcDateKey(now),
    speed: params.speed,
  };
}

/** Config for "play again": same seed if it was fixed, otherwise a fresh one. */
export function restartConfig(cfg: RunConfig): RunConfig {
  return { ...cfg, seed: cfg.fixedSeed ? cfg.seed : randomSeed() };
}

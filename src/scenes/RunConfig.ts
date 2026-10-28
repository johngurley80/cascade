import { dailySeed, randomSeed, utcDateKey, type LaunchParams } from '../logic/params';
import type { SavedRun } from '../platform/storage';

/** Everything needed to start (or restart) a run. */
export interface RunConfig {
  seed: number;
  /** Seed was chosen explicitly (URL or daily) and is reused on restart. */
  fixedSeed: boolean;
  startWave: number;
  unlockAll: boolean;
  /** UTC date key for the daily run, or null for a normal run. */
  daily: string | null;
  endless: boolean;
  speed: number;
  /** Resume this saved run instead of starting fresh. */
  resume?: SavedRun;
}

export function normalRun(params: LaunchParams): RunConfig {
  return {
    seed: params.seed ?? randomSeed(),
    fixedSeed: params.seed !== null,
    startWave: params.wave,
    unlockAll: params.unlockAll,
    daily: null,
    endless: false,
    speed: params.speed,
  };
}

export function endlessRun(params: LaunchParams): RunConfig {
  return { ...normalRun(params), endless: true };
}

export function dailyRun(params: LaunchParams, now = new Date()): RunConfig {
  return {
    seed: dailySeed(now),
    fixedSeed: true,
    startWave: 1,
    unlockAll: false,
    daily: utcDateKey(now),
    endless: false,
    speed: params.speed,
  };
}

export function resumeRun(params: LaunchParams, saved: SavedRun): RunConfig {
  return {
    seed: saved.save.seed,
    fixedSeed: true,
    startWave: saved.save.clearedWave,
    unlockAll: false,
    daily: saved.daily,
    endless: saved.save.endless,
    speed: params.speed,
    resume: saved,
  };
}

/** Config for "play again": daily and explicitly seeded runs keep their seed; resumed runs start over. */
export function restartConfig(cfg: RunConfig): RunConfig {
  const keepSeed = cfg.daily !== null || (cfg.fixedSeed && !cfg.resume);
  return {
    seed: keepSeed ? cfg.seed : randomSeed(),
    fixedSeed: keepSeed,
    startWave: cfg.resume ? 1 : cfg.startWave,
    unlockAll: cfg.unlockAll,
    daily: cfg.daily,
    endless: cfg.endless,
    speed: cfg.speed,
  };
}

/** Runs started with testing parameters don't count towards records. */
export function isTestRun(cfg: RunConfig): boolean {
  return (cfg.startWave > 1 && !cfg.resume) || cfg.unlockAll || cfg.speed > 1;
}

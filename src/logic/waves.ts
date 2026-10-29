import { BOSS, BOSS_KINDS, ELITE, ENEMIES, WAVES, WORLD, type EnemyKind } from '../config';
import { Rng } from './rng';
import type { EnemyTraits } from './types';

export type Formation = 'row' | 'cluster' | 'staggered' | 'column' | 'vee';
export type Placement = 'left' | 'centre' | 'right' | 'any';
export type TraitName = keyof EnemyTraits;

export interface GroupDef {
  /** Seconds after the wave starts. */
  at: number;
  kind: EnemyKind;
  formation: Formation;
  count: number;
  /** Optional different kind placed at the heart of the formation. */
  core?: EnemyKind;
  coreCount?: number;
  /** Rows for staggered formations. */
  rows?: number;
  place?: Placement;
  /** Traits given to members of the group. */
  traits?: TraitName[];
  /** Apply `traits` only to every Nth member (default: all). */
  traitEvery?: number;
  /** Number of members (from the core outwards) promoted to elites. */
  elites?: number;
}

export interface WaveDef {
  groups: GroupDef[];
}

/**
 * The 15 authored waves, in three acts of five. Each act introduces new
 * enemy types and ends with its own boss. Clusters and staggered rows are
 * deliberate: they let one reaction spread through a whole formation.
 */
export const WAVE_DEFS: WaveDef[] = [
  // ── Act I ──────────────────────────────────────────────────────────────
  // 1 — One element. Rows, then the first clusters.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'row', count: 5 },
      { at: 6, kind: 'basic', formation: 'staggered', count: 10, rows: 2 },
      { at: 13, kind: 'basic', formation: 'cluster', count: 7, place: 'left' },
      { at: 18, kind: 'basic', formation: 'cluster', count: 7, place: 'right' },
      { at: 25, kind: 'fast', formation: 'vee', count: 5 },
      { at: 30, kind: 'basic', formation: 'cluster', count: 12, place: 'centre' },
      { at: 38, kind: 'basic', formation: 'staggered', count: 12, rows: 2 },
    ],
  },
  // 2 — Two elements. Big, dense crowds for the first real cascades.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 19, place: 'centre' },
      { at: 7, kind: 'basic', formation: 'cluster', count: 14, place: 'left' },
      { at: 9, kind: 'fast', formation: 'column', count: 6, place: 'right' },
      { at: 14, kind: 'basic', formation: 'staggered', count: 24, rows: 3 },
      { at: 22, kind: 'basic', formation: 'cluster', count: 19, place: 'right' },
      { at: 27, kind: 'fast', formation: 'vee', count: 9 },
      { at: 32, kind: 'basic', formation: 'cluster', count: 24, place: 'centre' },
      { at: 41, kind: 'basic', formation: 'staggered', count: 24, rows: 3 },
    ],
  },
  // 3 — Splitters: defeating one makes two more targets.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 19, core: 'tank', place: 'centre' },
      { at: 7, kind: 'splitter', formation: 'staggered', count: 10, rows: 2 },
      { at: 13, kind: 'fast', formation: 'column', count: 6, place: 'left' },
      { at: 14, kind: 'fast', formation: 'column', count: 6, place: 'right' },
      { at: 19, kind: 'basic', formation: 'staggered', count: 30, rows: 4 },
      { at: 28, kind: 'splitter', formation: 'cluster', count: 12, place: 'any' },
      { at: 34, kind: 'basic', formation: 'cluster', count: 24, core: 'tank', coreCount: 2, place: 'centre' },
      { at: 43, kind: 'basic', formation: 'cluster', count: 19, place: 'any' },
    ],
  },
  // 4 — Volatiles explode when defeated: buried in crowds they set off chains.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 19, core: 'volatile', coreCount: 4, place: 'left' },
      { at: 4, kind: 'basic', formation: 'cluster', count: 19, core: 'volatile', coreCount: 4, place: 'right' },
      { at: 12, kind: 'fast', formation: 'vee', count: 11 },
      { at: 17, kind: 'splitter', formation: 'staggered', count: 14, rows: 2 },
      { at: 24, kind: 'volatile', formation: 'cluster', count: 14, place: 'centre' },
      { at: 30, kind: 'tank', formation: 'row', count: 5 },
      { at: 34, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 6, place: 'centre' },
      { at: 44, kind: 'basic', formation: 'staggered', count: 28, rows: 4 },
    ],
  },
  // 5 — Boss: the Hive sheds splitlings as it takes damage.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 24, rows: 3 },
      { at: 7, kind: 'basic', formation: 'cluster', count: 19, core: 'volatile', coreCount: 3, place: 'left' },
      { at: 8, kind: 'basic', formation: 'cluster', count: 19, core: 'tank', place: 'right' },
      { at: 16, kind: 'hive', formation: 'row', count: 1, place: 'centre' },
      { at: 24, kind: 'basic', formation: 'cluster', count: 19, place: 'any' },
      { at: 36, kind: 'basic', formation: 'cluster', count: 19, place: 'any' },
    ],
  },
  // ── Act II ─────────────────────────────────────────────────────────────
  // 6 — Shields block direct hits: break them with reactions or poison.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 24, place: 'centre', traits: ['shield'], traitEvery: 4 },
      { at: 8, kind: 'fast', formation: 'column', count: 8, place: 'left' },
      { at: 10, kind: 'basic', formation: 'staggered', count: 28, rows: 4, traits: ['shield'], traitEvery: 6 },
      { at: 19, kind: 'splitter', formation: 'cluster', count: 12, place: 'right' },
      { at: 26, kind: 'basic', formation: 'cluster', count: 30, core: 'tank', coreCount: 2, place: 'centre' },
      { at: 36, kind: 'basic', formation: 'cluster', count: 24, core: 'volatile', coreCount: 4, place: 'any' },
      { at: 45, kind: 'fast', formation: 'vee', count: 11 },
    ],
  },
  // 7 — Insulated enemies stop lightning chains.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 30, rows: 4, traits: ['insulated'], traitEvery: 7 },
      { at: 9, kind: 'basic', formation: 'cluster', count: 24, core: 'volatile', coreCount: 5, place: 'left' },
      { at: 11, kind: 'fast', formation: 'vee', count: 11 },
      { at: 18, kind: 'tank', formation: 'staggered', count: 8, rows: 2 },
      { at: 25, kind: 'basic', formation: 'cluster', count: 30, place: 'right', traits: ['shield'], traitEvery: 6 },
      { at: 35, kind: 'splitter', formation: 'staggered', count: 16, rows: 2 },
      { at: 44, kind: 'basic', formation: 'cluster', count: 30, place: 'centre' },
    ],
  },
  // 8 — Fireproof enemies resist burning.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 30, core: 'tank', coreCount: 2, place: 'centre', traits: ['fireproof'], traitEvery: 5 },
      { at: 8, kind: 'splitter', formation: 'staggered', count: 16, rows: 2 },
      { at: 14, kind: 'fast', formation: 'column', count: 8, place: 'left' },
      { at: 14, kind: 'fast', formation: 'column', count: 8, place: 'right' },
      { at: 21, kind: 'volatile', formation: 'cluster', count: 19, place: 'any' },
      { at: 28, kind: 'basic', formation: 'staggered', count: 32, rows: 4, traits: ['shield'], traitEvery: 8 },
      { at: 38, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 5, place: 'any' },
    ],
  },
  // 9 — Elites: bigger, tougher, worth much more.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 30, place: 'left', elites: 1 },
      { at: 5, kind: 'basic', formation: 'cluster', count: 30, place: 'right', elites: 1, traits: ['shield'], traitEvery: 7 },
      { at: 14, kind: 'fast', formation: 'vee', count: 13 },
      { at: 19, kind: 'tank', formation: 'staggered', count: 10, rows: 2, elites: 1 },
      { at: 26, kind: 'basic', formation: 'cluster', count: 37, core: 'volatile', coreCount: 7, place: 'centre' },
      { at: 37, kind: 'splitter', formation: 'cluster', count: 19, place: 'any', elites: 1 },
      { at: 46, kind: 'basic', formation: 'staggered', count: 32, rows: 4 },
    ],
  },
  // 10 — Boss: the Aegis shrugs off direct hits. Reactions are the way through.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 5, place: 'centre' },
      { at: 8, kind: 'basic', formation: 'staggered', count: 28, rows: 4, traits: ['shield'], traitEvery: 5 },
      { at: 17, kind: 'aegis', formation: 'row', count: 1, place: 'centre' },
      { at: 26, kind: 'basic', formation: 'cluster', count: 24, place: 'any' },
      { at: 38, kind: 'basic', formation: 'cluster', count: 24, core: 'volatile', coreCount: 4, place: 'any' },
    ],
  },
  // ── Act III ────────────────────────────────────────────────────────────
  // 11
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 36, rows: 4, traits: ['insulated'], traitEvery: 8 },
      { at: 8, kind: 'splitter', formation: 'cluster', count: 19, place: 'left', elites: 1 },
      { at: 10, kind: 'volatile', formation: 'cluster', count: 19, place: 'right' },
      { at: 18, kind: 'fast', formation: 'vee', count: 13 },
      { at: 23, kind: 'basic', formation: 'cluster', count: 37, core: 'tank', coreCount: 3, place: 'centre', traits: ['shield'], traitEvery: 7 },
      { at: 34, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 6, place: 'any' },
      { at: 44, kind: 'fast', formation: 'column', count: 10, place: 'any' },
      { at: 47, kind: 'basic', formation: 'staggered', count: 32, rows: 4 },
    ],
  },
  // 12
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 30, core: 'tank', coreCount: 2, place: 'left', traits: ['fireproof'], traitEvery: 5 },
      { at: 3, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 6, place: 'right' },
      { at: 12, kind: 'tank', formation: 'staggered', count: 10, rows: 2, elites: 1 },
      { at: 18, kind: 'fast', formation: 'column', count: 10, place: 'left' },
      { at: 18, kind: 'fast', formation: 'column', count: 10, place: 'right' },
      { at: 25, kind: 'splitter', formation: 'staggered', count: 24, rows: 3 },
      { at: 35, kind: 'basic', formation: 'cluster', count: 37, place: 'centre', elites: 1 },
      { at: 46, kind: 'volatile', formation: 'cluster', count: 24, place: 'any' },
    ],
  },
  // 13
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 40, rows: 5, traits: ['shield'], traitEvery: 6 },
      { at: 10, kind: 'volatile', formation: 'cluster', count: 24, place: 'centre', elites: 1 },
      { at: 16, kind: 'basic', formation: 'cluster', count: 30, place: 'left', traits: ['insulated'], traitEvery: 6 },
      { at: 18, kind: 'splitter', formation: 'cluster', count: 19, place: 'right' },
      { at: 27, kind: 'tank', formation: 'staggered', count: 12, rows: 2, elites: 2 },
      { at: 36, kind: 'basic', formation: 'cluster', count: 37, core: 'volatile', coreCount: 8, place: 'any' },
      { at: 47, kind: 'fast', formation: 'vee', count: 15 },
    ],
  },
  // 14 — The big swarm before the last boss.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 37, core: 'volatile', coreCount: 7, place: 'left' },
      { at: 3, kind: 'basic', formation: 'cluster', count: 37, core: 'tank', coreCount: 3, place: 'right', traits: ['shield'], traitEvery: 8 },
      { at: 13, kind: 'fast', formation: 'vee', count: 15, elites: 1 },
      { at: 19, kind: 'splitter', formation: 'staggered', count: 24, rows: 3, traits: ['fireproof'], traitEvery: 5 },
      { at: 27, kind: 'basic', formation: 'staggered', count: 40, rows: 5, elites: 2 },
      { at: 38, kind: 'basic', formation: 'cluster', count: 37, core: 'volatile', coreCount: 8, place: 'centre' },
      { at: 48, kind: 'fast', formation: 'column', count: 12, place: 'any' },
    ],
  },
  // 15 — Final boss: the Monolith, escorted by elites.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 5, place: 'centre', elites: 1 },
      { at: 9, kind: 'tank', formation: 'staggered', count: 8, rows: 2, elites: 1 },
      { at: 17, kind: 'monolith', formation: 'row', count: 1, place: 'centre' },
      { at: 25, kind: 'basic', formation: 'cluster', count: 30, place: 'any' },
      { at: 37, kind: 'basic', formation: 'cluster', count: 30, core: 'volatile', coreCount: 5, place: 'any' },
      { at: 49, kind: 'basic', formation: 'staggered', count: 32, rows: 4 },
    ],
  },
];

/** Building blocks for generated endless waves. */
const ENDLESS_GROUPS: Omit<GroupDef, 'at'>[] = [
  { kind: 'basic', formation: 'cluster', count: 37, core: 'volatile', coreCount: 7, place: 'any' },
  { kind: 'basic', formation: 'staggered', count: 40, rows: 5, traits: ['shield'], traitEvery: 6 },
  { kind: 'splitter', formation: 'cluster', count: 19, place: 'any', elites: 1 },
  { kind: 'fast', formation: 'vee', count: 15 },
  { kind: 'fast', formation: 'column', count: 12, place: 'any' },
  { kind: 'tank', formation: 'staggered', count: 10, rows: 2, elites: 1 },
  { kind: 'volatile', formation: 'cluster', count: 24, place: 'any', traits: ['fireproof'], traitEvery: 5 },
  { kind: 'basic', formation: 'cluster', count: 37, core: 'tank', coreCount: 3, place: 'any', traits: ['insulated'], traitEvery: 7 },
];

export const isBossKind = (kind: EnemyKind): boolean => BOSS_KINDS.includes(kind);

export function actOf(wave: number): number {
  return Math.floor((wave - 1) / WAVES.actLength) + 1;
}

export function isBossWave(wave: number): boolean {
  return wave % WAVES.actLength === 0;
}

/** The boss for a boss wave (cycling in endless mode). */
export function bossForWave(wave: number): EnemyKind {
  return BOSS_KINDS[(actOf(wave) - 1) % BOSS_KINDS.length];
}

export function hpMultiplierForWave(wave: number): number {
  const w = Math.min(wave, WAVES.total) - 1;
  const base = 1 + WAVES.hpScalePerWave * w + WAVES.hpScaleCurve * w * w;
  return wave <= WAVES.total ? base : base + WAVES.endlessHpScalePerWave * (wave - WAVES.total);
}

export function speedMultiplierForWave(wave: number): number {
  return WAVES.speedMult * (1 + WAVES.speedGrowthPerWave * (Math.min(wave, WAVES.total + 10) - 1));
}

/** Bosses keep their own HP, growing with each endless cycle. */
export function bossHpMultiplier(wave: number): number {
  const cycle = Math.floor((wave - 1) / WAVES.total);
  return 1 + BOSS.endlessCycleHpMult * cycle;
}

/** Generate an endless wave: a few random groups and a boss every fifth wave. */
export function endlessWaveDef(wave: number, rng: Rng): WaveDef {
  const groups: GroupDef[] = [];
  const count = Math.min(9, 6 + Math.floor((wave - WAVES.total) / 4));
  let at = 0;
  const bossWave = isBossWave(wave);
  for (let i = 0; i < (bossWave ? 3 : count); i++) {
    const g = ENDLESS_GROUPS[Math.floor(rng.next() * ENDLESS_GROUPS.length)];
    groups.push({ ...g, at, elites: (g.elites ?? 0) + (rng.next() < 0.4 ? 1 : 0) });
    at += rng.range(4, 7);
  }
  if (bossWave) groups.push({ at: at + 4, kind: bossForWave(wave), formation: 'row', count: 1, place: 'centre' });
  return { groups };
}

const MIRROR: Record<Placement, Placement> = { left: 'right', right: 'left', centre: 'centre', any: 'any' };

/**
 * Authored waves gain a second phase from `repriseFromWave`: the same
 * formations mirrored and a little smaller, after a short breather. Bosses
 * aren't repeated.
 */
function withReprise(def: WaveDef, wave: number): WaveDef {
  if (wave < WAVES.repriseFromWave) return def;
  const span = Math.max(...def.groups.map((g) => g.at)) + WAVES.repriseGap;
  const phases = wave >= WAVES.doubleRepriseFromWave ? 2 : 1;
  const groups = [...def.groups];
  for (let k = 1; k <= phases; k++) {
    for (const g of def.groups) {
      if (isBossKind(g.kind)) continue;
      groups.push({
        ...g,
        at: g.at + span * k,
        count: Math.max(1, Math.round(g.count * WAVES.repriseCountMult)),
        // Alternate sides each phase so the same wave never plays out identically twice.
        place: k % 2 === 1 ? MIRROR[g.place ?? 'any'] : (g.place ?? 'any'),
      });
    }
  }
  return { groups };
}

export function waveDef(wave: number, rng: Rng): WaveDef {
  if (wave >= 1 && wave <= WAVE_DEFS.length) return withReprise(WAVE_DEFS[wave - 1], wave);
  return endlessWaveDef(wave, rng);
}

export interface SpawnSpec {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Formation speed: the whole group moves at its slowest member's pace. */
  speed: number;
  hpMult: number;
  traits: EnemyTraits;
}

interface ScheduledGroup {
  at: number;
  spawns: SpawnSpec[];
  spawned: boolean;
}

export const noTraits = (): EnemyTraits => ({ shield: false, insulated: false, fireproof: false, elite: false });

/** Relative positions for a formation, centred on x = 0 with dy ≤ 0. */
export function formationOffsets(formation: Formation, count: number, rows = 2): { dx: number; dy: number }[] {
  const out: { dx: number; dy: number }[] = [];
  switch (formation) {
    case 'row': {
      const s = WAVES.rowSpacing;
      for (let i = 0; i < count; i++) out.push({ dx: (i - (count - 1) / 2) * s, dy: 0 });
      break;
    }
    case 'staggered': {
      const perRow = Math.ceil(count / rows);
      const s = WAVES.rowSpacing;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(i / perRow);
        const c = i % perRow;
        const shift = r % 2 === 1 ? s / 2 : 0;
        out.push({ dx: (c - (perRow - 1) / 2) * s + shift - (rows > 1 ? s / 4 : 0), dy: -r * WAVES.rowGap });
      }
      break;
    }
    case 'cluster': {
      // Hex packing, filled from the centre outwards.
      const s = WAVES.clusterSpacing;
      const cells: { dx: number; dy: number; d: number }[] = [];
      for (let q = -4; q <= 4; q++) {
        for (let r = -4; r <= 4; r++) {
          const dx = s * (q + r / 2);
          const dy = s * r * 0.866;
          cells.push({ dx, dy, d: Math.hypot(dx, dy) + Math.abs(dy) * 0.001 + dx * 0.0001 });
        }
      }
      cells.sort((a, b) => a.d - b.d);
      for (let i = 0; i < count && i < cells.length; i++) out.push({ dx: cells[i].dx, dy: cells[i].dy });
      const minDy = Math.max(...out.map((o) => o.dy));
      for (const o of out) o.dy -= minDy;
      break;
    }
    case 'column': {
      for (let i = 0; i < count; i++) out.push({ dx: (i % 2) * 18 - 9, dy: -i * 58 });
      break;
    }
    case 'vee': {
      for (let i = 0; i < count; i++) {
        const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
        const rank = Math.ceil(i / 2);
        out.push({ dx: side * rank * 56, dy: -rank * 48 });
      }
      break;
    }
  }
  return out;
}

function radiusOf(kind: EnemyKind, elite: boolean): number {
  return ENEMIES[kind].radius * (elite ? ELITE.radiusMult : 1);
}

/** Build the concrete, jittered spawn schedule for a wave. */
export function buildWaveSchedule(wave: number, rng: Rng): ScheduledGroup[] {
  const def = waveDef(wave, rng);
  const hpMult = hpMultiplierForWave(wave);
  const groups: ScheduledGroup[] = [];
  for (const g of def.groups) {
    const boss = isBossKind(g.kind);
    const count = boss ? g.count : Math.round(g.count * Math.min(WAVES.maxCountMult, 1 + WAVES.countGrowthPerWave * Math.max(0, wave - 3)));
    const offsets = formationOffsets(g.formation, count, g.rows);
    const coreCount = g.core ? (g.coreCount ?? 1) : 0;
    const kinds: EnemyKind[] = offsets.map((_, i) => (i < coreCount && g.core ? g.core : g.kind));
    // Clusters fill from the centre, so the first members are the heart of the formation.
    const elites = offsets.map((_, i) => !boss && i < (g.elites ?? 0));
    // Spread wider formations so promoted elites don't overlap neighbours.
    const spread = elites.some(Boolean) ? ELITE.radiusMult : 1;
    for (const o of offsets) {
      o.dx *= spread;
      o.dy *= spread;
    }
    const maxRadius = Math.max(...kinds.map((k, i) => radiusOf(k, elites[i])));
    const minDx = Math.min(...offsets.map((o) => o.dx));
    const maxDx = Math.max(...offsets.map((o) => o.dx));
    const lo = WORLD.spawnMarginX + maxRadius - minDx;
    const hi = WORLD.width - WORLD.spawnMarginX - maxRadius - maxDx;
    const centre = (lo + hi) / 2;
    const span = Math.max(0, hi - lo);
    let cx: number;
    switch (g.place ?? 'any') {
      case 'left':
        cx = lo + span * rng.range(0, 0.3);
        break;
      case 'right':
        cx = hi - span * rng.range(0, 0.3);
        break;
      case 'centre':
        cx = centre + rng.range(-1, 1) * Math.min(WAVES.centreJitter, span / 2);
        break;
      default:
        cx = lo + span * rng.next();
    }
    if (span <= 0) cx = WORLD.width / 2;
    const speed = Math.min(...kinds.map((k) => ENEMIES[k].speed)) * speedMultiplierForWave(wave);
    const every = g.traitEvery ?? 1;
    const spawns = offsets.map((o, i): SpawnSpec => {
      const traits = noTraits();
      if (g.traits && i % every === 0) for (const t of g.traits) traits[t] = true;
      traits.elite = elites[i];
      const r = radiusOf(kinds[i], elites[i]);
      return {
        kind: kinds[i],
        x: Math.max(r + 4, Math.min(WORLD.width - r - 4, cx + o.dx)),
        y: WORLD.arenaTop - radiusOf(kinds[i], elites[i]) - 6 + o.dy,
        speed,
        hpMult: isBossKind(kinds[i]) ? bossHpMultiplier(wave) : hpMult,
        traits,
      };
    });
    groups.push({ at: g.at + WAVES.introDelay, spawns, spawned: false });
  }
  groups.sort((a, b) => a.at - b.at);
  return groups;
}

/** Supporting enemies a boss calls in: a small cluster beside it, themed per boss. */
export function bossSupportSpawns(boss: EnemyKind, bossX: number, wave: number, rng: Rng): SpawnSpec[] {
  const offsets = formationOffsets('cluster', BOSS.supportCount + (boss === 'monolith' ? 1 : 0));
  const side = bossX < WORLD.width / 2 ? 1 : -1;
  const cx = Math.min(WORLD.width - 110, Math.max(110, bossX + side * rng.range(150, 230)));
  return offsets.map((o, i) => {
    const traits = noTraits();
    if (boss === 'aegis') traits.shield = true;
    if (boss === 'monolith' && i === 0) traits.elite = true;
    const kind: EnemyKind = boss === 'monolith' && i === 1 ? 'volatile' : 'basic';
    return {
      kind,
      x: cx + o.dx,
      y: WORLD.arenaTop - radiusOf(kind, traits.elite) - 6 + o.dy,
      speed: ENEMIES.basic.speed,
      hpMult: hpMultiplierForWave(wave),
      traits,
    };
  });
}

/**
 * Tracks one wave's spawn schedule and how many spawned enemies have been
 * resolved (defeated or crossed the line). The wave is complete once every
 * group has spawned and every spawned enemy is resolved.
 */
export class WaveRunner {
  elapsed = 0;
  spawned = 0;
  resolved = 0;
  private readonly groups: ScheduledGroup[];

  constructor(
    readonly wave: number,
    rng: Rng,
  ) {
    this.groups = buildWaveSchedule(wave, rng);
  }

  get totalPlanned(): number {
    return this.groups.reduce((n, g) => n + g.spawns.length, 0);
  }

  get allGroupsSpawned(): boolean {
    return this.groups.every((g) => g.spawned);
  }

  /** Enemies the arena should hold before the next group is pulled forward. */
  get minPopulation(): number {
    return WAVES.minPopulationBase + WAVES.minPopulationPerWave * Math.min(this.wave, WAVES.total);
  }

  /** Advance the schedule. When the crowd thins out, pull the next group forward. */
  update(dt: number, population: number): SpawnSpec[] {
    this.elapsed += dt;
    const next = this.groups.find((g) => !g.spawned);
    if (next && population < this.minPopulation && next.at - this.elapsed > WAVES.idleSkipLead && this.elapsed > WAVES.introDelay) {
      this.elapsed = next.at - WAVES.idleSkipLead;
    }
    const out: SpawnSpec[] = [];
    for (const g of this.groups) {
      if (!g.spawned && this.elapsed >= g.at) {
        g.spawned = true;
        out.push(...g.spawns);
      }
    }
    return out;
  }

  noteSpawned(count = 1): void {
    this.spawned += count;
  }

  noteResolved(count = 1): void {
    this.resolved += count;
  }

  get complete(): boolean {
    return this.allGroupsSpawned && this.resolved >= this.spawned;
  }
}

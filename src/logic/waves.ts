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
  // 1 — One element. Gentle rows, then small clusters.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'row', count: 4 },
      { at: 5, kind: 'basic', formation: 'row', count: 5 },
      { at: 10, kind: 'basic', formation: 'cluster', count: 5, place: 'left' },
      { at: 15, kind: 'basic', formation: 'cluster', count: 5, place: 'right' },
      { at: 21, kind: 'basic', formation: 'staggered', count: 8, rows: 2 },
    ],
  },
  // 2 — Second element arrives. Dense clusters invite the first big combination.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 7, place: 'centre' },
      { at: 6, kind: 'basic', formation: 'cluster', count: 7, place: 'left' },
      { at: 10, kind: 'fast', formation: 'column', count: 4, place: 'right' },
      { at: 14, kind: 'basic', formation: 'cluster', count: 10, place: 'centre' },
      { at: 21, kind: 'basic', formation: 'staggered', count: 12, rows: 3 },
      { at: 27, kind: 'fast', formation: 'vee', count: 5 },
    ],
  },
  // 3 — Splitters: defeating one makes two more targets.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 9, core: 'tank', place: 'centre' },
      { at: 7, kind: 'splitter', formation: 'row', count: 4 },
      { at: 12, kind: 'fast', formation: 'column', count: 4, place: 'left' },
      { at: 13, kind: 'fast', formation: 'column', count: 4, place: 'right' },
      { at: 17, kind: 'basic', formation: 'staggered', count: 15, rows: 3 },
      { at: 25, kind: 'splitter', formation: 'cluster', count: 6, place: 'centre' },
    ],
  },
  // 4 — Volatiles explode when defeated: hide them inside crowds.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 10, core: 'volatile', coreCount: 3, place: 'left' },
      { at: 4, kind: 'basic', formation: 'cluster', count: 10, core: 'volatile', coreCount: 3, place: 'right' },
      { at: 11, kind: 'fast', formation: 'vee', count: 7 },
      { at: 15, kind: 'splitter', formation: 'staggered', count: 8, rows: 2 },
      { at: 22, kind: 'volatile', formation: 'cluster', count: 7, place: 'centre' },
      { at: 26, kind: 'tank', formation: 'row', count: 3 },
    ],
  },
  // 5 — Boss: the Hive sheds splitlings as it takes damage.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 12, rows: 2 },
      { at: 6, kind: 'basic', formation: 'cluster', count: 9, core: 'volatile', coreCount: 2, place: 'left' },
      { at: 7, kind: 'basic', formation: 'cluster', count: 9, core: 'tank', place: 'right' },
      { at: 14, kind: 'hive', formation: 'row', count: 1, place: 'centre' },
    ],
  },
  // ── Act II ─────────────────────────────────────────────────────────────
  // 6 — Shields block direct hits: break them with reactions or poison.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 10, place: 'centre', traits: ['shield'] },
      { at: 7, kind: 'fast', formation: 'column', count: 5, place: 'left' },
      { at: 9, kind: 'basic', formation: 'staggered', count: 12, rows: 2, traits: ['shield'], traitEvery: 2 },
      { at: 17, kind: 'splitter', formation: 'cluster', count: 7, place: 'right' },
      { at: 23, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', place: 'centre', traits: ['shield'], traitEvery: 3 },
    ],
  },
  // 7 — Insulated enemies stop lightning chains.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 15, rows: 3, traits: ['insulated'], traitEvery: 4 },
      { at: 8, kind: 'basic', formation: 'cluster', count: 10, core: 'volatile', coreCount: 3, place: 'left' },
      { at: 10, kind: 'fast', formation: 'vee', count: 7 },
      { at: 16, kind: 'tank', formation: 'row', count: 4, traits: ['insulated'] },
      { at: 22, kind: 'basic', formation: 'cluster', count: 12, place: 'right', traits: ['shield'], traitEvery: 3 },
    ],
  },
  // 8 — Fireproof enemies resist burning.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', place: 'centre', traits: ['fireproof'], traitEvery: 2 },
      { at: 7, kind: 'splitter', formation: 'staggered', count: 8, rows: 2 },
      { at: 12, kind: 'fast', formation: 'column', count: 6, place: 'left' },
      { at: 12, kind: 'fast', formation: 'column', count: 6, place: 'right' },
      { at: 18, kind: 'volatile', formation: 'cluster', count: 9, place: 'centre', traits: ['fireproof'], traitEvery: 3 },
      { at: 25, kind: 'basic', formation: 'staggered', count: 16, rows: 4, traits: ['shield'], traitEvery: 4 },
    ],
  },
  // 9 — Elites: bigger, tougher, worth much more.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 12, place: 'left', elites: 1 },
      { at: 4, kind: 'basic', formation: 'cluster', count: 12, place: 'right', elites: 1, traits: ['shield'], traitEvery: 3 },
      { at: 12, kind: 'fast', formation: 'vee', count: 9 },
      { at: 16, kind: 'tank', formation: 'staggered', count: 6, rows: 2, elites: 1 },
      { at: 23, kind: 'basic', formation: 'cluster', count: 14, core: 'volatile', coreCount: 4, place: 'centre' },
    ],
  },
  // 10 — Boss: the Aegis shrugs off direct hits. Reactions are the way through.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 12, core: 'volatile', coreCount: 3, place: 'centre' },
      { at: 7, kind: 'basic', formation: 'staggered', count: 12, rows: 2, traits: ['shield'], traitEvery: 2 },
      { at: 15, kind: 'aegis', formation: 'row', count: 1, place: 'centre' },
    ],
  },
  // ── Act III ────────────────────────────────────────────────────────────
  // 11
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 18, rows: 3, traits: ['insulated'], traitEvery: 5 },
      { at: 7, kind: 'splitter', formation: 'cluster', count: 8, place: 'left', elites: 1 },
      { at: 9, kind: 'volatile', formation: 'cluster', count: 8, place: 'right' },
      { at: 16, kind: 'fast', formation: 'vee', count: 9 },
      { at: 21, kind: 'basic', formation: 'cluster', count: 14, core: 'tank', coreCount: 2, place: 'centre', traits: ['shield'], traitEvery: 3 },
    ],
  },
  // 12
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', place: 'left', traits: ['fireproof'], traitEvery: 2 },
      { at: 2, kind: 'basic', formation: 'cluster', count: 12, core: 'volatile', coreCount: 3, place: 'right' },
      { at: 10, kind: 'tank', formation: 'row', count: 5, elites: 1 },
      { at: 15, kind: 'fast', formation: 'column', count: 7, place: 'left' },
      { at: 15, kind: 'fast', formation: 'column', count: 7, place: 'right' },
      { at: 22, kind: 'splitter', formation: 'staggered', count: 12, rows: 3 },
    ],
  },
  // 13
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 20, rows: 4, traits: ['shield'], traitEvery: 3 },
      { at: 9, kind: 'volatile', formation: 'cluster', count: 10, place: 'centre', elites: 1 },
      { at: 14, kind: 'basic', formation: 'cluster', count: 12, place: 'left', traits: ['insulated'], traitEvery: 3 },
      { at: 16, kind: 'splitter', formation: 'cluster', count: 9, place: 'right' },
      { at: 24, kind: 'tank', formation: 'staggered', count: 7, rows: 2, elites: 2 },
    ],
  },
  // 14 — The big swarm before the last boss.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 16, core: 'volatile', coreCount: 4, place: 'left' },
      { at: 2, kind: 'basic', formation: 'cluster', count: 16, core: 'tank', coreCount: 2, place: 'right', traits: ['shield'], traitEvery: 4 },
      { at: 11, kind: 'fast', formation: 'vee', count: 11, elites: 1 },
      { at: 16, kind: 'splitter', formation: 'staggered', count: 12, rows: 3, traits: ['fireproof'], traitEvery: 3 },
      { at: 23, kind: 'basic', formation: 'staggered', count: 20, rows: 4, elites: 2 },
    ],
  },
  // 15 — Final boss: the Monolith, escorted by elites.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 14, core: 'volatile', coreCount: 3, place: 'centre', elites: 1 },
      { at: 8, kind: 'tank', formation: 'row', count: 4, elites: 1 },
      { at: 16, kind: 'monolith', formation: 'row', count: 1, place: 'centre' },
    ],
  },
];

/** Building blocks for generated endless waves. */
const ENDLESS_GROUPS: Omit<GroupDef, 'at'>[] = [
  { kind: 'basic', formation: 'cluster', count: 14, core: 'volatile', coreCount: 3, place: 'any' },
  { kind: 'basic', formation: 'staggered', count: 18, rows: 3, traits: ['shield'], traitEvery: 3 },
  { kind: 'splitter', formation: 'cluster', count: 9, place: 'any', elites: 1 },
  { kind: 'fast', formation: 'vee', count: 11 },
  { kind: 'fast', formation: 'column', count: 7, place: 'any' },
  { kind: 'tank', formation: 'row', count: 5, elites: 1 },
  { kind: 'volatile', formation: 'cluster', count: 10, place: 'any', traits: ['fireproof'], traitEvery: 3 },
  { kind: 'basic', formation: 'cluster', count: 14, core: 'tank', coreCount: 2, place: 'any', traits: ['insulated'], traitEvery: 4 },
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
  const base = 1 + WAVES.hpScalePerWave * (Math.min(wave, WAVES.total) - 1);
  return wave <= WAVES.total ? base : base + WAVES.endlessHpScalePerWave * (wave - WAVES.total);
}

/** Bosses keep their own HP, growing with each endless cycle. */
export function bossHpMultiplier(wave: number): number {
  const cycle = Math.floor((wave - 1) / WAVES.total);
  return 1 + BOSS.endlessCycleHpMult * cycle;
}

/** Generate an endless wave: a few random groups and a boss every fifth wave. */
export function endlessWaveDef(wave: number, rng: Rng): WaveDef {
  const groups: GroupDef[] = [];
  const count = Math.min(7, 4 + Math.floor((wave - WAVES.total) / 4));
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

export function waveDef(wave: number, rng: Rng): WaveDef {
  if (wave >= 1 && wave <= WAVE_DEFS.length) return WAVE_DEFS[wave - 1];
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
      for (let q = -3; q <= 3; q++) {
        for (let r = -3; r <= 3; r++) {
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
    const offsets = formationOffsets(g.formation, g.count, g.rows);
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
    const speed = Math.min(...kinds.map((k) => ENEMIES[k].speed));
    const every = g.traitEvery ?? 1;
    const spawns = offsets.map((o, i): SpawnSpec => {
      const traits = noTraits();
      if (g.traits && i % every === 0) for (const t of g.traits) traits[t] = true;
      traits.elite = elites[i];
      return {
        kind: kinds[i],
        x: cx + o.dx,
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

  /** Advance the schedule. If the arena is empty, pull the next group forward. */
  update(dt: number, arenaEmpty: boolean): SpawnSpec[] {
    this.elapsed += dt;
    const next = this.groups.find((g) => !g.spawned);
    if (next && arenaEmpty && next.at - this.elapsed > WAVES.idleSkipLead && this.elapsed > WAVES.introDelay) {
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

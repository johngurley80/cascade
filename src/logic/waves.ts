import { BOSS, ENEMIES, WAVES, WORLD, type EnemyKind } from '../config';
import { Rng } from './rng';

export type Formation = 'row' | 'cluster' | 'staggered' | 'column' | 'vee';
export type Placement = 'left' | 'centre' | 'right' | 'any';

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
}

export interface WaveDef {
  groups: GroupDef[];
}

/**
 * Wave layouts. Waves 2–3 deliberately use tight clusters and staggered rows
 * so a water splash followed by fire (steam) or lightning (chain) hits 5+
 * enemies in one cascade. Positions are jittered by the seeded RNG.
 */
export const WAVE_DEFS: WaveDef[] = [
  // 1 — Fire only. Gentle rows, then small clusters to teach burn.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'row', count: 4 },
      { at: 5, kind: 'basic', formation: 'row', count: 5 },
      { at: 10, kind: 'basic', formation: 'cluster', count: 5, place: 'left' },
      { at: 15, kind: 'basic', formation: 'cluster', count: 5, place: 'right' },
      { at: 21, kind: 'basic', formation: 'staggered', count: 8, rows: 2 },
    ],
  },
  // 2 — Second element arrives. Dense clusters invite splash + steam / chains.
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
  // 3 — Tanks anchor clusters; staggered rows reward chains.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 9, core: 'tank', place: 'centre' },
      { at: 7, kind: 'fast', formation: 'column', count: 4, place: 'left' },
      { at: 8, kind: 'fast', formation: 'column', count: 4, place: 'right' },
      { at: 13, kind: 'basic', formation: 'staggered', count: 15, rows: 3 },
      { at: 21, kind: 'basic', formation: 'cluster', count: 8, core: 'tank', place: 'left' },
      { at: 24, kind: 'basic', formation: 'cluster', count: 8, place: 'right' },
    ],
  },
  // 4 — All three elements. Bigger, mixed formations.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 12, rows: 2 },
      { at: 6, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'left' },
      { at: 9, kind: 'fast', formation: 'vee', count: 7 },
      { at: 14, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'right' },
      { at: 20, kind: 'tank', formation: 'row', count: 3 },
      { at: 24, kind: 'basic', formation: 'cluster', count: 12, place: 'centre' },
    ],
  },
  // 5 — Pressure from fast flankers while tanks hold the middle.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', coreCount: 1, place: 'centre' },
      { at: 5, kind: 'fast', formation: 'column', count: 5, place: 'left' },
      { at: 6, kind: 'fast', formation: 'column', count: 5, place: 'right' },
      { at: 12, kind: 'basic', formation: 'staggered', count: 18, rows: 3 },
      { at: 20, kind: 'tank', formation: 'row', count: 4 },
      { at: 24, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'left' },
      { at: 26, kind: 'basic', formation: 'cluster', count: 10, place: 'right' },
    ],
  },
  // 6 — Double clusters; chains between them reward Storm relay and Flashover.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'left' },
      { at: 1, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'right' },
      { at: 9, kind: 'fast', formation: 'vee', count: 9 },
      { at: 14, kind: 'basic', formation: 'staggered', count: 18, rows: 3 },
      { at: 21, kind: 'tank', formation: 'staggered', count: 6, rows: 2 },
      { at: 26, kind: 'basic', formation: 'cluster', count: 14, core: 'tank', coreCount: 2, place: 'centre' },
    ],
  },
  // 7 — The big swarm before the boss.
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 18, rows: 3 },
      { at: 7, kind: 'fast', formation: 'column', count: 6, place: 'left' },
      { at: 7, kind: 'fast', formation: 'column', count: 6, place: 'right' },
      { at: 12, kind: 'basic', formation: 'cluster', count: 14, core: 'tank', coreCount: 2, place: 'centre' },
      { at: 19, kind: 'tank', formation: 'row', count: 5 },
      { at: 23, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', place: 'left' },
      { at: 25, kind: 'basic', formation: 'cluster', count: 12, core: 'tank', place: 'right' },
    ],
  },
  // 8 — Escorts, then the boss (which periodically calls supporting enemies).
  {
    groups: [
      { at: 0, kind: 'basic', formation: 'staggered', count: 12, rows: 2 },
      { at: 6, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'left' },
      { at: 7, kind: 'basic', formation: 'cluster', count: 10, core: 'tank', place: 'right' },
      { at: 15, kind: 'boss', formation: 'row', count: 1, place: 'centre' },
    ],
  },
];

export interface SpawnSpec {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Formation speed: the whole group moves at its slowest member's pace. */
  speed: number;
  hpMult: number;
}

interface ScheduledGroup {
  at: number;
  spawns: SpawnSpec[];
  spawned: boolean;
}

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

export function hpMultiplierForWave(wave: number): number {
  return 1 + WAVES.hpScalePerWave * (wave - 1);
}

/** Build the concrete, jittered spawn schedule for a wave. */
export function buildWaveSchedule(wave: number, rng: Rng): ScheduledGroup[] {
  const def = WAVE_DEFS[Math.min(Math.max(wave, 1), WAVE_DEFS.length) - 1];
  const hpMult = hpMultiplierForWave(wave);
  const groups: ScheduledGroup[] = [];
  for (const g of def.groups) {
    const offsets = formationOffsets(g.formation, g.count, g.rows);
    const coreCount = g.core ? (g.coreCount ?? 1) : 0;
    const kinds: EnemyKind[] = offsets.map((_, i) => (i < coreCount && g.core ? g.core : g.kind));
    const maxRadius = Math.max(...kinds.map((k) => ENEMIES[k].radius));
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
    const spawns = offsets.map((o, i) => ({
      kind: kinds[i],
      x: cx + o.dx,
      y: WORLD.arenaTop - ENEMIES[kinds[i]].radius - 6 + o.dy,
      speed,
      hpMult: kinds[i] === 'boss' ? 1 : hpMult,
    }));
    groups.push({ at: g.at + WAVES.introDelay, spawns, spawned: false });
  }
  groups.sort((a, b) => a.at - b.at);
  return groups;
}

/** Supporting enemies the boss calls in: a small cluster near it. */
export function bossSupportSpawns(bossX: number, wave: number, rng: Rng): SpawnSpec[] {
  const offsets = formationOffsets('cluster', BOSS.supportCount);
  const half = WORLD.width / 2;
  const side = bossX < half ? 1 : -1;
  const cx = Math.min(WORLD.width - 110, Math.max(110, bossX + side * rng.range(140, 220)));
  return offsets.map((o) => ({
    kind: 'basic' as EnemyKind,
    x: cx + o.dx,
    y: WORLD.arenaTop - ENEMIES.basic.radius - 6 + o.dy,
    speed: ENEMIES.basic.speed,
    hpMult: hpMultiplierForWave(wave),
  }));
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

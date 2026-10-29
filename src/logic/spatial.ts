import type { Enemy } from './types';

/**
 * Uniform grid over the arena for fast neighbour queries. Rebuilt each step;
 * queries return candidates from every cell the circle touches, and callers
 * do the exact distance test themselves.
 */
export class SpatialGrid {
  private readonly cells = new Map<number, Enemy[]>();
  private pool: Enemy[][] = [];

  constructor(private readonly cellSize = 64) {}

  private key(cx: number, cy: number): number {
    // Offset so slightly negative coordinates (above the arena) still map uniquely.
    return (cx + 64) * 4096 + (cy + 64);
  }

  rebuild(enemies: readonly Enemy[]): void {
    for (const list of this.cells.values()) {
      list.length = 0;
      this.pool.push(list);
    }
    this.cells.clear();
    for (const e of enemies) {
      if (!e.alive) continue;
      const k = this.key(Math.floor(e.x / this.cellSize), Math.floor(e.y / this.cellSize));
      let list = this.cells.get(k);
      if (!list) {
        list = this.pool.pop() ?? [];
        this.cells.set(k, list);
      }
      list.push(e);
    }
  }

  /** Alive enemies in cells overlapping the circle (not distance-filtered). */
  query(x: number, y: number, radius: number, out: Enemy[] = []): Enemy[] {
    out.length = 0;
    const s = this.cellSize;
    const x0 = Math.floor((x - radius) / s);
    const x1 = Math.floor((x + radius) / s);
    const y0 = Math.floor((y - radius) / s);
    const y1 = Math.floor((y + radius) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const e of list) if (e.alive) out.push(e);
      }
    }
    return out;
  }
}

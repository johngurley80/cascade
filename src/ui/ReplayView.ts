import Phaser from 'phaser';
import type { DamageSource, Element, ReplayRecord } from '../logic/types';
import { COLORS, ELEMENT_COLORS, FONT, css } from './theme';

/** Generation colours: the originating hit, then each deeper wave of reactions. */
const GEN_COLORS = [0xffffff, 0xffe94a, 0xff9a3c, 0xff5fa2, 0xb46bff, 0x6dffb0];

const SOURCE_COLOR: Partial<Record<DamageSource, number>> = {
  steam: COLORS.steam,
  flashover: ELEMENT_COLORS.fire.main,
  ignition: ELEMENT_COLORS.toxin.main,
  burn: ELEMENT_COLORS.fire.main,
  poison: ELEMENT_COLORS.toxin.main,
  relay: 0xc9b2ff,
  shatter: ELEMENT_COLORS.frost.main,
  overload: ELEMENT_COLORS.lightning.main,
  detonation: 0xff5a4a,
  collapse: ELEMENT_COLORS.void.main,
  thermalShock: ELEMENT_COLORS.frost.main,
  arcStorm: ELEMENT_COLORS.lightning.main,
};

function sourceColor(s: DamageSource): number {
  return SOURCE_COLOR[s] ?? ELEMENT_COLORS[s as Element]?.main ?? COLORS.text;
}

/**
 * An animated diagram of one cascade: every damage event becomes a link from
 * where the reaction came from to the enemy it hit, coloured by generation,
 * revealed in the order it happened.
 */
export class ReplayView extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly records: ReplayRecord[];
  private readonly duration: number;
  private readonly timeScale: number;
  private elapsed = 0;
  private readonly onUpdate: (time: number, delta: number) => void;
  private readonly map: (x: number, y: number) => [number, number];

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, records: ReplayRecord[]) {
    super(scene, x, y);
    this.records = [...records].sort((a, b) => a.t - b.t);
    const bg = scene.add.graphics();
    bg.fillStyle(0x060b1e, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(2, COLORS.panelEdge, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    this.g = scene.add.graphics();
    this.add([bg, this.g]);

    // Fit every point into the panel, keeping the arena's proportions.
    const xs = this.records.flatMap((r) => [r.x, r.fromX]);
    const ys = this.records.flatMap((r) => [r.y, r.fromY]);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 1);
    const pad = 26;
    const scale = Math.min((w - pad * 2) / Math.max(60, maxX - minX), (h - pad * 2 - 24) / Math.max(60, maxY - minY), 1.4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.map = (px, py) => [(px - cx) * scale, (py - cy) * scale - 10];

    const last = this.records.length ? this.records[this.records.length - 1].t : 0;
    // Stretch quick cascades so they read; squash long burns.
    this.timeScale = last > 0 ? Math.min(6, Math.max(0.6, 2.4 / last)) : 1;
    this.duration = last * this.timeScale + 1.4;

    const legend = scene.add
      .text(0, h / 2 - 16, 'generation   0 · 1 · 2 · 3 · 4', { fontFamily: FONT, fontSize: '14px', color: css(COLORS.textDim), resolution: 2 })
      .setOrigin(0.5, 1);
    this.add(legend);
    const dots = scene.add.graphics();
    GEN_COLORS.slice(0, 5).forEach((c, i) => {
      dots.fillStyle(c, 1);
      dots.fillCircle(-w / 2 + 40 + i * 16, h / 2 - 24, 5);
    });
    this.add(dots);

    this.onUpdate = (_t, delta) => {
      this.elapsed = (this.elapsed + delta / 1000) % this.duration;
      this.redraw();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
    this.redraw();
  }

  private redraw(): void {
    const g = this.g;
    g.clear();
    const now = this.elapsed;
    const seen = new Set<number>();
    for (const r of this.records) {
      const t = r.t * this.timeScale;
      if (t > now) break;
      const age = now - t;
      const [x1, y1] = this.map(r.fromX, r.fromY);
      const [x2, y2] = this.map(r.x, r.y);
      const col = GEN_COLORS[Math.min(r.generation, GEN_COLORS.length - 1)];
      const grow = Math.min(1, age / 0.18);
      g.lineStyle(age < 0.3 ? 4 : 2, col, age < 0.3 ? 1 : 0.55);
      g.lineBetween(x1, y1, x1 + (x2 - x1) * grow, y1 + (y2 - y1) * grow);
      if (!seen.has(r.enemyId) && grow >= 1) {
        seen.add(r.enemyId);
        const pop = age < 0.25 ? 1 + (0.25 - age) * 4 : 1;
        g.fillStyle(sourceColor(r.source), 1);
        g.fillCircle(x2, y2, 6 * pop);
        g.lineStyle(2, 0x000000, 0.6);
        g.strokeCircle(x2, y2, 6 * pop);
      }
    }
    if (this.records.length) {
      const [ox, oy] = this.map(this.records[0].fromX, this.records[0].fromY);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(ox - 7, oy + 8, ox + 7, oy + 8, ox, oy - 8);
    }
  }
}

import Phaser from 'phaser';
import { ENEMIES, type EnemyKind } from '../config';
import { ELEMENT_COLORS, ENEMY_COLORS, TRAIT_COLORS, css, mixColor } from '../ui/theme';

/**
 * Every sprite in the arena comes from one texture atlas painted at startup
 * with canvas paths (no image files). One texture means the GPU can draw
 * hundreds of enemies, projectiles and particles in a handful of batches.
 */
export const ATLAS = 'cascade-atlas';

export const TEX = {
  // White frames, tinted at runtime.
  dot: 'dot',
  puff: 'puff',
  spark: 'spark',
  trail: 'trail',
  shard: 'shard',
  ring: 'ring',
  dashRing: 'dash-ring',
  hex: 'hex',
  disc: 'disc',
  px: 'px',
  star: 'star',
  // Coloured status and trait marks.
  drop: 'drop',
  flake: 'flake',
  ice: 'ice',
  crack: 'crack',
  flame: 'flame',
  crown: 'crown',
  insulated: 'mark-insulated',
  fireproof: 'mark-fireproof',
  aegisRings: 'aegis-rings',
} as const;

/** Enemy bodies are painted at this multiple of their gameplay radius (crisper when scaled). */
export const BODY_SCALE = 2;
/** Overlay marks are painted for a reference radius of this many pixels. */
export const MARK_REF = 32;

export const bodyFrame = (kind: EnemyKind, damaged = false): string => `body-${kind}${damaged ? '-d' : ''}`;

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, w: number, h: number) => void;

interface FrameSpec {
  name: string;
  w: number;
  h: number;
  paint: Painter;
}

const TAU = Math.PI * 2;

function polygon(ctx: Ctx, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function regular(cx: number, cy: number, r: number, sides: number, rot: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function shape(ctx: Ctx, pts: [number, number][], fill: number, edge: number, width: number): void {
  polygon(ctx, pts);
  ctx.fillStyle = css(fill);
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = css(edge);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function arcs(ctx: Ctx, cx: number, cy: number, r: number, count: number, rot: number, color: string, width: number, fill = 0.55): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const span = TAU / count;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, rot + i * span, rot + i * span + span * fill);
    ctx.stroke();
  }
}

function softCircle(ctx: Ctx, cx: number, cy: number, r: number, stops: [number, number][]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
}

/** Body painters draw centred in a box sized for the kind's radius × BODY_SCALE. */
function bodyPainter(kind: EnemyKind, damaged: boolean): Painter {
  const c = ENEMY_COLORS[kind];
  return (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = ENEMIES[kind].radius * BODY_SCALE;
    // Dark under-outline keeps silhouettes readable over any effect.
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    switch (kind) {
      case 'basic':
        shape(ctx, regular(cx, cy, r * 1.05, 4, 0), c.fill, c.edge, 3 * BODY_SCALE);
        ctx.shadowBlur = 0;
        arcs(ctx, cx, cy, r * 0.6, 3, 0.3, css(c.edge), 2 * BODY_SCALE);
        break;
      case 'fast':
        shape(
          ctx,
          [
            [cx, cy + r * 1.3],
            [cx + r * 1.05, cy - r * 0.8],
            [cx, cy - r * 0.3],
            [cx - r * 1.05, cy - r * 0.8],
          ],
          c.fill,
          c.edge,
          3 * BODY_SCALE,
        );
        break;
      case 'tank': {
        shape(ctx, regular(cx, cy, r, 6, 0), c.fill, c.edge, 4 * BODY_SCALE);
        ctx.shadowBlur = 0;
        // Armour plates; the damaged version has lost half of them.
        ctx.fillStyle = css(mixColor(c.edge, 0x000000, 0.35));
        for (let i = 0; i < 6; i++) {
          if (damaged && i % 2 === 1) continue;
          const a = (i / 6) * TAU + Math.PI / 6;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, r * 0.17, 0, TAU);
          ctx.fill();
        }
        shape(ctx, regular(cx, cy, r * 0.5, 6, 0.4), mixColor(c.fill, c.edge, 0.2), c.edge, 2 * BODY_SCALE);
        break;
      }
      case 'splitter':
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + s * r * 0.42, cy, r * 0.68, 0, TAU);
          ctx.fillStyle = css(c.fill);
          ctx.fill();
          ctx.lineWidth = 3 * BODY_SCALE;
          ctx.strokeStyle = css(c.edge);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = css(c.core);
        ctx.lineWidth = 3 * BODY_SCALE;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.55);
        ctx.lineTo(cx, cy + r * 0.55);
        ctx.stroke();
        break;
      case 'splitling':
        shape(ctx, regular(cx, cy, r * 1.1, 3, Math.PI / 2), c.fill, c.edge, 2 * BODY_SCALE);
        break;
      case 'volatile': {
        const pts: [number, number][] = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const rr = i % 2 === 0 ? r * 1.15 : r * 0.72;
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        shape(ctx, pts, c.fill, c.edge, 2.5 * BODY_SCALE);
        break;
      }
      case 'hive':
        shape(ctx, regular(cx, cy, r, 6, Math.PI / 6), c.fill, c.edge, 5 * BODY_SCALE);
        ctx.shadowBlur = 0;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          shape(ctx, regular(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.3, 6, Math.PI / 6), mixColor(c.fill, c.core, 0.2), c.edge, 2 * BODY_SCALE);
        }
        break;
      case 'aegis':
        shape(ctx, regular(cx, cy, r, 8, Math.PI / 8), c.fill, c.edge, 5 * BODY_SCALE);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#060a18';
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.45, r * 0.25, 0, 0, TAU);
        ctx.fill();
        break;
      case 'monolith':
        shape(ctx, regular(cx, cy, r, 8, Math.PI / 8), c.fill, c.edge, 5 * BODY_SCALE);
        ctx.shadowBlur = 0;
        shape(ctx, regular(cx, cy, r * 0.7, 8, Math.PI / 8), mixColor(c.fill, 0x000000, 0.3), c.edge, 2 * BODY_SCALE);
        break;
    }
    ctx.shadowBlur = 0;
  };
}

function frames(): FrameSpec[] {
  const out: FrameSpec[] = [
    { name: TEX.dot, w: 32, h: 32, paint: (ctx) => softCircle(ctx, 16, 16, 16, [[0, 1], [0.45, 0.9], [1, 0]]) },
    { name: TEX.puff, w: 64, h: 64, paint: (ctx) => softCircle(ctx, 32, 32, 32, [[0, 0.9], [0.6, 0.45], [1, 0]]) },
    {
      name: TEX.spark,
      w: 64,
      h: 12,
      paint: (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 64, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(58, 1);
        ctx.arc(58, 6, 5, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      },
    },
    {
      name: TEX.trail,
      w: 128,
      h: 16,
      paint: (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 128, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(120, 1);
        ctx.arc(120, 8, 7, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      },
    },
    {
      name: TEX.shard,
      w: 16,
      h: 16,
      paint: (ctx) => {
        ctx.fillStyle = '#fff';
        polygon(ctx, [[15, 8], [1, 1], [4, 15]]);
        ctx.fill();
      },
    },
    {
      name: TEX.ring,
      w: 128,
      h: 128,
      paint: (ctx) => {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, TAU);
        ctx.stroke();
      },
    },
    { name: TEX.dashRing, w: 64, h: 64, paint: (ctx) => arcs(ctx, 32, 32, 29, 8, 0, '#fff', 3) },
    {
      name: TEX.hex,
      w: 64,
      h: 64,
      paint: (ctx) => {
        polygon(ctx, regular(32, 32, 29, 6, 0));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
      },
    },
    {
      name: TEX.disc,
      w: 64,
      h: 64,
      paint: (ctx) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(32, 32, 31, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: TEX.px,
      w: 4,
      h: 4,
      paint: (ctx) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 4, 4);
      },
    },
    {
      name: TEX.star,
      w: 64,
      h: 64,
      paint: (ctx) => {
        const pts: [number, number][] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          const rr = i % 2 === 0 ? 30 : 13;
          pts.push([32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr]);
        }
        polygon(ctx, pts);
        ctx.fillStyle = '#fff';
        ctx.fill();
      },
    },
    {
      name: TEX.drop,
      w: 24,
      h: 28,
      paint: (ctx) => {
        ctx.fillStyle = ELEMENT_COLORS.water.css;
        ctx.beginPath();
        ctx.moveTo(12, 1);
        ctx.quadraticCurveTo(22, 14, 21, 18);
        ctx.arc(12, 18, 9, 0, Math.PI);
        ctx.quadraticCurveTo(2, 14, 12, 1);
        ctx.fill();
        ctx.fillStyle = css(ELEMENT_COLORS.water.core);
        ctx.beginPath();
        ctx.arc(9, 18, 2.5, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: TEX.flake,
      w: 24,
      h: 24,
      paint: (ctx) => {
        ctx.strokeStyle = ELEMENT_COLORS.frost.css;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(12 - Math.cos(a) * 10, 12 - Math.sin(a) * 10);
          ctx.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10);
          ctx.stroke();
        }
      },
    },
    {
      name: TEX.ice,
      w: 80,
      h: 80,
      paint: (ctx) => {
        const s = 32;
        const pts: [number, number][] = [
          [40 - s * 1.15, 40 - s * 0.3],
          [40 - s * 0.4, 40 - s * 1.2],
          [40 + s * 0.7, 40 - s * 1.05],
          [40 + s * 1.2, 40 + s * 0.1],
          [40 + s * 0.5, 40 + s * 1.15],
          [40 - s * 0.8, 40 + s * 0.95],
        ];
        polygon(ctx, pts);
        ctx.fillStyle = 'rgba(168,244,255,0.38)';
        ctx.fill();
        ctx.strokeStyle = css(ELEMENT_COLORS.frost.core);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(40 - s * 0.4, 40 - s * 1.2);
        ctx.lineTo(40 + s * 0.1, 40);
        ctx.lineTo(40 + s * 0.5, 40 + s * 1.15);
        ctx.stroke();
        ctx.globalAlpha = 1;
      },
    },
    {
      name: TEX.crack,
      w: 64,
      h: 64,
      paint: (ctx) => {
        ctx.strokeStyle = ELEMENT_COLORS.toxin.css;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(10, 16);
        ctx.lineTo(26, 29);
        ctx.lineTo(20, 44);
        ctx.lineTo(38, 54);
        ctx.stroke();
      },
    },
    {
      name: TEX.flame,
      w: 64,
      h: 40,
      paint: (ctx) => {
        for (let k = -1; k <= 1; k++) {
          const fx = 32 + k * 16;
          const fh = k === 0 ? 30 : 22;
          ctx.fillStyle = ELEMENT_COLORS.fire.css;
          polygon(ctx, [[fx - 7, 39], [fx + 7, 39], [fx, 39 - fh]]);
          ctx.fill();
        }
        ctx.fillStyle = css(ELEMENT_COLORS.fire.core);
        ctx.beginPath();
        ctx.arc(32, 34, 5, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: TEX.crown,
      w: 48,
      h: 24,
      paint: (ctx) => {
        ctx.fillStyle = css(TRAIT_COLORS.elite);
        for (let k = -1; k <= 1; k++) {
          const bx = 24 + k * 14;
          polygon(ctx, [[bx - 6, 23], [bx + 6, 23], [bx, k === 0 ? 1 : 6]]);
          ctx.fill();
        }
      },
    },
    {
      name: TEX.insulated,
      w: 20,
      h: 20,
      paint: (ctx) => {
        ctx.fillStyle = '#15120a';
        ctx.beginPath();
        ctx.arc(10, 10, 9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(TRAIT_COLORS.insulated);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5, 15);
        ctx.lineTo(15, 5);
        ctx.stroke();
      },
    },
    {
      name: TEX.fireproof,
      w: 20,
      h: 20,
      paint: (ctx) => {
        ctx.fillStyle = '#1a0c06';
        ctx.beginPath();
        ctx.arc(10, 10, 9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(TRAIT_COLORS.fireproof);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = css(TRAIT_COLORS.fireproof);
        polygon(ctx, [[6, 13], [14, 13], [10, 4]]);
        ctx.fill();
      },
    },
    {
      name: TEX.aegisRings,
      w: 128,
      h: 128,
      paint: (ctx) => {
        arcs(ctx, 64, 64, 56, 6, 0, css(ENEMY_COLORS.aegis.core), 5);
        ctx.globalAlpha = 0.5;
        arcs(ctx, 64, 64, 62, 4, 0.4, css(ENEMY_COLORS.aegis.core), 3);
        ctx.globalAlpha = 1;
      },
    },
  ];
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
    const size = Math.ceil(ENEMIES[kind].radius * BODY_SCALE * 2.6) + 8;
    out.push({ name: bodyFrame(kind), w: size, h: size, paint: bodyPainter(kind, false) });
    if (kind === 'tank') out.push({ name: bodyFrame(kind, true), w: size, h: size, paint: bodyPainter(kind, true) });
  }
  return out;
}

/** Build the atlas once (simple shelf packing on a single canvas). */
export function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;
  const specs = frames().sort((a, b) => b.h - a.h);
  const width = 1024;
  const pad = 2;
  let x = pad;
  let y = pad;
  let shelf = 0;
  const placed: { spec: FrameSpec; x: number; y: number }[] = [];
  for (const spec of specs) {
    if (x + spec.w + pad > width) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    placed.push({ spec, x, y });
    x += spec.w + pad;
    shelf = Math.max(shelf, spec.h);
  }
  const height = Phaser.Math.Pow2.GetNext(y + shelf + pad);
  const tex = scene.textures.createCanvas(ATLAS, width, height);
  if (!tex) return;
  const ctx = tex.getContext();
  for (const { spec, x: px, y: py } of placed) {
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.rect(0, 0, spec.w, spec.h);
    ctx.clip();
    spec.paint(ctx, spec.w, spec.h);
    ctx.restore();
    tex.add(spec.name, 0, px, py, spec.w, spec.h);
  }
  tex.refresh();
}

/** A recycled set of sprites at one depth. `begin` + `next` per frame, `end` hides the rest. */
export class SpritePool {
  private readonly items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  next(frame: string): Phaser.GameObjects.Image {
    let img = this.items[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, ATLAS, frame).setDepth(this.depth);
      this.items.push(img);
    } else if (img.frame.name !== frame) {
      img.setFrame(frame);
    }
    this.used++;
    img.setVisible(true).setOrigin(0.5).setRotation(0).setAlpha(1).clearTint();
    return img;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) {
      if (this.items[i].visible) this.items[i].setVisible(false);
    }
  }

  get size(): number {
    return this.items.length;
  }
}

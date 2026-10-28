import Phaser from 'phaser';
import { FX } from '../config';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
  drag: number;
  gravity: number;
  /** 'spark' draws a short streak along velocity; 'dot' a fading circle; 'puff' a soft growing blob. */
  shape: 'spark' | 'dot' | 'puff';
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: number;
  width: number;
  fill: number;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: number;
}

interface Bolt {
  points: { x: number; y: number }[][];
  life: number;
  max: number;
  color: number;
  width: number;
}

/**
 * Lightweight, capped visual effects drawn into two Graphics layers:
 * `soft` (normal blending: steam, ripples) and `glow` (additive: sparks, bolts).
 */
export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private flashes: Flash[] = [];
  reduced = false;

  constructor(
    private readonly soft: Phaser.GameObjects.Graphics,
    private readonly glow: Phaser.GameObjects.Graphics,
  ) {}

  clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    this.flashes.length = 0;
  }

  /** A brief bright disc that pops and fades: the "impact" frame of a reaction. */
  flash(x: number, y: number, r: number, color: number, duration = 0.14): void {
    if (this.flashes.length > 40) this.flashes.shift();
    this.flashes.push({ x, y, r, life: duration, max: duration, color });
  }

  private budget(n: number): number {
    const scaled = this.reduced ? Math.ceil(n * FX.reducedParticleMult) : n;
    return Math.max(0, Math.min(scaled, FX.maxParticles - this.particles.length));
  }

  burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    opts: Partial<Pick<Particle, 'size' | 'drag' | 'gravity' | 'shape'>> & { life?: number; spread?: number; angle?: number } = {},
  ): void {
    const n = this.budget(count);
    const spread = opts.spread ?? Math.PI * 2;
    const base = opts.angle ?? 0;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.65);
      const life = (opts.life ?? 0.45) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.sin(a) * v,
        vy: -Math.cos(a) * v,
        life,
        max: life,
        size: (opts.size ?? 3) * (0.7 + Math.random() * 0.6),
        color,
        drag: opts.drag ?? 3,
        gravity: opts.gravity ?? 0,
        shape: opts.shape ?? 'spark',
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: number, duration: number = FX.rippleDuration, width = 4, fill = 0): void {
    if (this.rings.length > 80) this.rings.shift();
    this.rings.push({ x, y, r0, r1, life: duration, max: duration, color, width, fill });
  }

  /** Jagged lightning between successive link endpoints, with small forks. */
  bolt(links: { x1: number; y1: number; x2: number; y2: number }[], color: number, width = 3, duration: number = FX.boltDuration): void {
    const paths: { x: number; y: number }[][] = [];
    for (const l of links) {
      paths.push(jagged(l.x1, l.y1, l.x2, l.y2, 9));
      if (!this.reduced) {
        // A tiny decorative fork off the middle of each link.
        const mx = (l.x1 + l.x2) / 2;
        const my = (l.y1 + l.y2) / 2;
        const ang = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) + (Math.random() < 0.5 ? 0.9 : -0.9);
        const len = 18 + Math.random() * 22;
        paths.push(jagged(mx, my, mx + Math.cos(ang) * len, my + Math.sin(ang) * len, 3));
      }
    }
    if (this.bolts.length > 40) this.bolts.shift();
    this.bolts.push({ points: paths, life: duration, max: duration, color, width });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  draw(): void {
    const soft = this.soft;
    const glow = this.glow;
    soft.clear();
    glow.clear();

    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const ease = 1 - (1 - t) * (1 - t);
      const radius = r.r0 + (r.r1 - r.r0) * ease;
      const a = 1 - t;
      if (r.fill > 0) {
        soft.fillStyle(r.color, r.fill * a);
        soft.fillCircle(r.x, r.y, radius);
      }
      // Ring edges draw above enemies so reactions read even over a crowd.
      glow.lineStyle(r.width * (0.4 + a * 0.6), r.color, 0.95 * a);
      glow.strokeCircle(r.x, r.y, radius);
    }

    for (const f of this.flashes) {
      const t = 1 - f.life / f.max;
      glow.fillStyle(f.color, 0.75 * (1 - t));
      glow.fillCircle(f.x, f.y, f.r * (0.6 + 0.5 * t));
      glow.fillStyle(0xffffff, 0.8 * (1 - t));
      glow.fillCircle(f.x, f.y, f.r * 0.35 * (1 - t * 0.5));
    }

    for (const p of this.particles) {
      const a = p.life / p.max;
      if (p.shape === 'puff') {
        soft.fillStyle(p.color, 0.55 * a);
        soft.fillCircle(p.x, p.y, p.size * (2 - a));
      } else if (p.shape === 'dot') {
        glow.fillStyle(p.color, a);
        glow.fillCircle(p.x, p.y, p.size * (0.5 + a * 0.5));
      } else {
        glow.lineStyle(p.size * a + 0.5, p.color, a);
        glow.lineBetween(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      }
    }

    for (const b of this.bolts) {
      const a = b.life / b.max;
      const flicker = 0.75 + Math.random() * 0.25;
      for (const path of b.points) {
        glow.lineStyle(b.width * 4, b.color, 0.28 * a);
        strokePath(glow, path);
        glow.lineStyle(b.width, b.color, a * flicker);
        strokePath(glow, path);
        glow.lineStyle(Math.max(1, b.width * 0.4), 0xffffff, a);
        strokePath(glow, path);
      }
    }
  }

  get particleCount(): number {
    return this.particles.length;
  }
}

function jagged(x1: number, y1: number, x2: number, y2: number, segments: number): { x: number; y: number }[] {
  const pts = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const amp = Math.min(22, Math.max(6, len * 0.22));
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const off = (Math.random() - 0.5) * 2 * amp;
    pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

function strokePath(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[]): void {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}

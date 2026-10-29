import Phaser from 'phaser';
import { FX } from '../config';
import { SpritePool, TEX, ensureTextures } from './textures';

/** Photosensitivity guard: at most this many impact flashes may start per second. */
const MAX_FLASHES_PER_SECOND = 4;
const FLASH_ALPHA = 0.3;

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
  /** 'spark' draws a short streak along velocity; 'dot' a fading circle; 'puff' a soft growing blob; 'shard' a spinning fragment. */
  shape: 'spark' | 'dot' | 'puff' | 'shard';
  spin: number;
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
 * Capped visual effects. Particles and flashes are pooled, tinted sprites
 * (cheap to draw in bulk); rings and lightning bolts are vector lines drawn
 * into `soft` (below enemies) and `glow` (above enemies).
 */
export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private flashes: Flash[] = [];
  private readonly softSprites: SpritePool;
  private readonly glowSprites: SpritePool;
  private readonly ringSprites: SpritePool;
  private flashTimes: number[] = [];
  private clock = 0;
  reduced = false;

  constructor(
    scene: Phaser.Scene,
    private readonly soft: Phaser.GameObjects.Graphics,
    private readonly glow: Phaser.GameObjects.Graphics,
  ) {
    ensureTextures(scene);
    this.softSprites = new SpritePool(scene, soft.depth + 0.5);
    this.glowSprites = new SpritePool(scene, glow.depth + 0.5);
    this.ringSprites = new SpritePool(scene, glow.depth + 0.25);
  }

  clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    this.flashes.length = 0;
  }

  /**
   * A soft, dim, coloured disc that fades in a moment: the "impact" of a reaction.
   * Rate-limited and never white, so busy cascades don't strobe.
   */
  flash(x: number, y: number, r: number, color: number, duration = 0.22): void {
    if (this.reduced) return;
    this.flashTimes = this.flashTimes.filter((t) => this.clock - t < 1);
    if (this.flashTimes.length >= MAX_FLASHES_PER_SECOND) return;
    this.flashTimes.push(this.clock);
    this.flashes.push({ x, y, r, life: duration, max: duration, color });
  }

  /** Minor effects (shots, hits) only get a share of the budget, so big reactions always have room. */
  private budget(n: number, minor: boolean): number {
    const scaled = this.reduced ? Math.ceil(n * FX.reducedParticleMult) : n;
    const cap = minor ? FX.maxParticles * FX.minorParticleShare : FX.maxParticles;
    return Math.max(0, Math.min(scaled, Math.floor(cap) - this.particles.length));
  }

  burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    opts: Partial<Pick<Particle, 'size' | 'drag' | 'gravity' | 'shape'>> & { life?: number; spread?: number; angle?: number; minor?: boolean } = {},
  ): void {
    const n = this.budget(count, !!opts.minor);
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
        spin: (Math.random() - 0.5) * 14,
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: number, duration: number = FX.rippleDuration, width = 4, fill = 0, minor = false): void {
    if (minor && this.rings.length > 40) return;
    if (this.rings.length > 90) this.rings.shift();
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
    this.clock += dt;
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

    const sp = this.softSprites;
    const gp = this.glowSprites;
    const rp = this.ringSprites;
    sp.begin();
    gp.begin();
    rp.begin();
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const ease = 1 - (1 - t) * (1 - t);
      const radius = Math.max(1, r.r0 + (r.r1 - r.r0) * ease);
      const a = 1 - t;
      if (r.fill > 0) sp.next(TEX.disc).setPosition(r.x, r.y).setDisplaySize(radius * 2, radius * 2).setTint(r.color).setAlpha(r.fill * a * 0.8);
      // Ring edges draw above enemies so reactions read even over a crowd.
      rp.next(TEX.ring).setPosition(r.x, r.y).setDisplaySize(radius * 2.13, radius * 2.13).setTint(r.color).setAlpha(0.8 * a);
    }

    for (const f of this.flashes) {
      const t = 1 - f.life / f.max;
      const r = f.r * (0.7 + 0.4 * t);
      gp.next(TEX.dot).setPosition(f.x, f.y).setDisplaySize(r * 2.4, r * 2.4).setTint(f.color).setAlpha(FLASH_ALPHA * (1 - t));
    }

    for (const p of this.particles) {
      const a = p.life / p.max;
      if (p.shape === 'puff') {
        const d = p.size * (2 - a) * 2.6;
        sp.next(TEX.puff).setPosition(p.x, p.y).setDisplaySize(d, d).setTint(p.color).setAlpha(0.42 * a).setRotation(0);
      } else if (p.shape === 'shard') {
        const sz = p.size * (0.6 + 0.4 * a) * 2;
        gp.next(TEX.shard)
          .setPosition(p.x, p.y)
          .setDisplaySize(sz, sz)
          .setTint(p.color)
          .setAlpha(Math.min(1, a * 1.4))
          .setRotation(p.spin * (p.max - p.life) + p.spin);
      } else if (p.shape === 'dot') {
        const d = p.size * (0.5 + a * 0.5) * 2.6;
        gp.next(TEX.dot).setPosition(p.x, p.y).setDisplaySize(d, d).setTint(p.color).setAlpha(a).setRotation(0);
      } else {
        const len = Math.max(6, Math.hypot(p.vx, p.vy) * 0.035);
        gp.next(TEX.spark)
          .setPosition(p.x, p.y)
          .setOrigin(1, 0.5)
          .setDisplaySize(len, Math.max(2, p.size * a * 1.6 + 1))
          .setTint(p.color)
          .setAlpha(a)
          .setRotation(Math.atan2(p.vy, p.vx));
      }
    }
    sp.end();
    gp.end();
    rp.end();

    // Bolts fade out steadily (no random flicker).
    for (const b of this.bolts) {
      const a = b.life / b.max;
      for (const path of b.points) {
        glow.lineStyle(b.width * 3, b.color, 0.2 * a);
        strokePath(glow, path);
        glow.lineStyle(b.width, b.color, 0.85 * a);
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

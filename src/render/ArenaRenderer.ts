import Phaser from 'phaser';
import { PLAYER, WORLD } from '../config';
import type { Enemy, Projectile } from '../logic/types';
import type { World } from '../logic/world';
import { droplet } from '../ui/icons';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS, mixColor } from '../ui/theme';

type G = Phaser.GameObjects.Graphics;

/** Draws the static arena once, then enemies, projectiles and the launcher every frame. */
export class ArenaRenderer {
  readonly background: G;
  readonly enemyLayer: G;
  readonly glowLayer: G;
  readonly launcherLayer: G;
  private time = 0;

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics().setDepth(0);
    this.enemyLayer = scene.add.graphics().setDepth(20);
    this.glowLayer = scene.add.graphics().setDepth(30);
    this.launcherLayer = scene.add.graphics().setDepth(40);
    this.drawBackground();
  }

  private drawBackground(): void {
    const g = this.background;
    const { width, arenaTop, arenaBottom, defenceLineY } = WORLD;
    g.fillStyle(COLORS.arena, 1);
    g.fillRect(0, 0, width, WORLD.height);
    // Vertical depth gradient (bands).
    for (let i = 0; i < 12; i++) {
      g.fillStyle(COLORS.arenaDeep, 0.06 * (12 - i));
      g.fillRect(0, arenaTop + i * 30, width, 30);
    }
    g.lineStyle(1, COLORS.grid, 0.8);
    for (let x = 0; x <= width; x += 60) g.lineBetween(x, arenaTop, x, arenaBottom);
    for (let y = arenaTop; y <= arenaBottom; y += 60) g.lineBetween(0, y, width, y);
    // Danger zone tint below the defence line.
    g.fillStyle(COLORS.danger, 0.05);
    g.fillRect(0, defenceLineY, width, arenaBottom - defenceLineY);
    // Side walls.
    g.lineStyle(3, COLORS.panelEdge, 0.9);
    g.lineBetween(1.5, arenaTop, 1.5, arenaBottom);
    g.lineBetween(width - 1.5, arenaTop, width - 1.5, arenaBottom);
  }

  draw(world: World, dt: number, danger: number): void {
    this.time += dt;
    const e = this.enemyLayer;
    const glow = this.glowLayer;
    e.clear();
    glow.clear();
    this.launcherLayer.clear();

    this.drawDefenceLine(e, glow, danger);
    for (const enemy of world.enemies) if (enemy.alive) this.drawEnemy(e, glow, enemy);
    for (const p of world.projectiles) if (p.alive) this.drawProjectile(glow, p);
    this.drawLauncher(world);
  }

  private drawDefenceLine(g: G, glow: G, danger: number): void {
    const y = WORLD.defenceLineY;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (4 + danger * 8));
    glow.fillStyle(COLORS.danger, 0.06 + 0.1 * danger * pulse);
    glow.fillRect(0, y - 10, WORLD.width, 20);
    g.lineStyle(3, COLORS.danger, 0.65 + 0.35 * danger * pulse);
    for (let x = 0; x < WORLD.width; x += 28) g.lineBetween(x, y, x + 16, y);
  }

  private drawEnemy(g: G, glow: G, en: Enemy): void {
    const c = ENEMY_COLORS[en.kind];
    const wet = en.wet > 0;
    const burning = en.burn !== null;
    const flash = en.flash > 0;
    let fill = wet ? mixColor(c.fill, ELEMENT_COLORS.water.dark, 0.75) : c.fill;
    let edge = wet ? mixColor(c.edge, ELEMENT_COLORS.water.main, 0.55) : c.edge;
    if (flash) {
      // Brief hit flash that keeps the silhouette (the boss is hit constantly, so it flashes less).
      fill = mixColor(fill, 0xffffff, en.kind === 'boss' ? 0.3 : 0.7);
      edge = 0xffffff;
    }
    const r = en.radius;
    const near = en.y > WORLD.defenceLineY - 170;

    // Soft halo for readability against effects.
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(en.x, en.y + 4, r * 1.05);

    switch (en.kind) {
      case 'basic': {
        const s = r * 1.05;
        poly(g, en.x, en.y, s, 4, Math.PI / 4 + Math.sin(en.age * 2) * 0.08, fill, edge, 3);
        g.lineStyle(2, edge, 0.55);
        g.strokeCircle(en.x, en.y, r * 0.38);
        break;
      }
      case 'fast': {
        // Downward-pointing dart.
        g.fillStyle(fill, 1);
        g.lineStyle(3, edge, 1);
        g.beginPath();
        g.moveTo(en.x, en.y + r * 1.25);
        g.lineTo(en.x + r * 1.05, en.y - r * 0.8);
        g.lineTo(en.x, en.y - r * 0.3);
        g.lineTo(en.x - r * 1.05, en.y - r * 0.8);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'tank': {
        poly(g, en.x, en.y, r, 6, en.age * 0.3, fill, edge, 4);
        poly(g, en.x, en.y, r * 0.58, 6, en.age * 0.3, mixColor(fill, edge, 0.25), edge, 2);
        break;
      }
      case 'boss': {
        poly(g, en.x, en.y, r, 8, Math.PI / 8, fill, edge, 5);
        poly(g, en.x, en.y, r * 0.7, 8, Math.PI / 8, mixColor(fill, 0x000000, 0.3), edge, 2);
        // Rotating core star.
        g.fillStyle(flash ? 0xffffff : 0xffc2d4, 1);
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < 10; i++) {
          const a = en.age * 1.4 + (i / 10) * Math.PI * 2;
          const rr = i % 2 === 0 ? r * 0.42 : r * 0.18;
          pts.push(new Phaser.Math.Vector2(en.x + Math.cos(a) * rr, en.y + Math.sin(a) * rr));
        }
        g.fillPoints(pts, true);
        break;
      }
    }

    if (near && !flash) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 10 + en.id);
      g.lineStyle(2, COLORS.danger, 0.35 + 0.5 * pulse);
      g.strokeCircle(en.x, en.y, r * 1.35);
    }

    if (wet) {
      // Status ring plus droplet marker: readable without relying on tint alone.
      const fade = Math.min(1, en.wet / 1.2);
      g.lineStyle(2.5, ELEMENT_COLORS.water.main, 0.85 * fade);
      g.strokeCircle(en.x, en.y, r * 1.22);
      droplet(g, en.x + r * 0.9, en.y - r * 0.95, Math.max(7, r * 0.38), ELEMENT_COLORS.water.main, ELEMENT_COLORS.water.core);
    }
    if (burning) {
      // Flickering flame crown; the silhouette itself stays untouched.
      const flick = 0.65 + 0.35 * Math.sin(this.time * 22 + en.id * 3);
      glow.fillStyle(ELEMENT_COLORS.fire.main, 0.85 * flick);
      for (let k = -1; k <= 1; k++) {
        const fx = en.x + k * r * 0.5;
        const fh = r * (0.55 + 0.3 * Math.sin(this.time * 18 + k * 2 + en.id));
        const base = en.y - r * 0.55;
        glow.fillTriangle(fx - r * 0.22, base, fx + r * 0.22, base, fx, base - fh);
      }
      glow.fillStyle(ELEMENT_COLORS.fire.core, 0.5 * flick);
      glow.fillCircle(en.x, en.y - r * 0.6, r * 0.2);
    }

    if (en.hp < en.maxHp) {
      const w = en.kind === 'boss' ? r * 2.2 : r * 1.8;
      const h = en.kind === 'boss' ? 8 : 4;
      const y = en.kind === 'boss' ? en.y - r - 22 : en.y + r + 7;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(en.x - w / 2, y, w, h);
      g.fillStyle(en.kind === 'boss' ? COLORS.danger : c.edge, 1);
      g.fillRect(en.x - w / 2, y, w * (en.hp / en.maxHp), h);
    }
  }

  private drawProjectile(glow: G, p: Projectile): void {
    const col = ELEMENT_COLORS[p.element];
    // Tapered trail: segments get wider and brighter towards the head.
    const len = p.minor ? 0.05 : 0.075;
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const t0 = len * (1 - i / segs);
      const t1 = len * (1 - (i + 1) / segs);
      const k = (i + 1) / segs;
      glow.lineStyle(p.radius * (0.35 + 1.1 * k), col.main, 0.2 + 0.8 * k * k);
      glow.lineBetween(p.x - p.vx * t0, p.y - p.vy * t0, p.x - p.vx * t1, p.y - p.vy * t1);
    }
    glow.lineStyle(Math.max(1.5, p.radius * 0.5), col.core, 1);
    glow.lineBetween(p.x - p.vx * len * 0.45, p.y - p.vy * len * 0.45, p.x, p.y);
    glow.fillStyle(col.main, 0.22);
    glow.fillCircle(p.x, p.y, p.radius * 2.1);
    glow.fillStyle(col.main, 1);
    glow.fillCircle(p.x, p.y, p.radius * 1.1);
    glow.fillStyle(col.core, 1);
    glow.fillCircle(p.x, p.y, p.radius * 0.65);
  }

  private drawLauncher(world: World): void {
    const g = this.launcherLayer;
    const { launcherX: x, launcherY: y } = WORLD;
    const col = ELEMENT_COLORS[world.selected];
    const a = world.aimAngle;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    // Aim guide (faint dotted line) and arc limits.
    const max = (PLAYER.maxAimAngleDeg * Math.PI) / 180;
    g.lineStyle(2, COLORS.panelEdge, 0.5);
    g.beginPath();
    g.arc(x, y, 70, -Math.PI / 2 - max, -Math.PI / 2 + max, false);
    g.strokePath();
    g.fillStyle(col.main, 0.5);
    for (let d = 70; d < 330; d += 22) g.fillCircle(x + sin * d, y - cos * d, 2.2);

    // Barrel.
    g.lineStyle(16, 0x1a2550, 1);
    g.lineBetween(x, y, x + sin * 46, y - cos * 46);
    g.lineStyle(8, col.main, 1);
    g.lineBetween(x, y, x + sin * 44, y - cos * 44);
    // Base dome.
    g.fillStyle(COLORS.panel, 1);
    g.fillCircle(x, y, 30);
    g.lineStyle(3, col.main, 1);
    g.strokeCircle(x, y, 30);
    g.fillStyle(col.core, world.firing ? 1 : 0.7);
    g.fillCircle(x, y, 11);
  }
}

function poly(g: G, x: number, y: number, r: number, sides: number, rot: number, fill: number, edge: number, width: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  g.lineStyle(width, edge, 1);
  g.strokePoints(pts, true);
}

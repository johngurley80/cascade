import Phaser from 'phaser';
import { ELEMENTS, ENEMIES, PLAYER, SHIELD, WORLD } from '../config';
import { isBoss } from '../logic/status';
import type { Enemy, Projectile, Singularity } from '../logic/types';
import { rapidFireMult } from '../logic/upgrades';
import type { World } from '../logic/world';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS, TRAIT_COLORS, paletteForAct } from '../ui/theme';
import { BODY_SCALE, MARK_REF, SpritePool, TEX, bodyFrame, ensureTextures } from './textures';

type G = Phaser.GameObjects.Graphics;

const WARP_IN = 0.35;
/** Status tints multiply the enemy's own colours. */
const TINT = { none: 0xffffff, wet: 0x9fd2ff, poison: 0xd8ff9c, chill: 0xc6f2ff };

/**
 * Draws the arena. Enemies, status marks, clouds and projectiles are pooled
 * sprites from one atlas (cheap to draw in bulk); only the background,
 * singularities and launcher use vector graphics.
 *
 * Photosensitivity: nothing here strobes. Pulses are slow (≤ 1 Hz) and
 * low-contrast, and hits are shown with a small squash, never a white flash.
 */
export class ArenaRenderer {
  readonly background: G;
  readonly fieldLayer: G;
  readonly launcherLayer: G;
  private readonly lineGlow: Phaser.GameObjects.Image;
  private time = 0;
  private act = 0;
  private readonly clouds: SpritePool;
  private readonly under: SpritePool;
  private readonly bodies: SpritePool;
  private readonly cores: SpritePool;
  private readonly marks: SpritePool;
  private readonly bars: SpritePool;
  private readonly shots: SpritePool;

  constructor(scene: Phaser.Scene) {
    ensureTextures(scene);
    this.background = scene.add.graphics().setDepth(0);
    this.fieldLayer = scene.add.graphics().setDepth(12);
    this.clouds = new SpritePool(scene, 13);
    this.under = new SpritePool(scene, 18);
    this.bodies = new SpritePool(scene, 20);
    this.cores = new SpritePool(scene, 20.5);
    this.marks = new SpritePool(scene, 21);
    this.bars = new SpritePool(scene, 22);
    this.shots = new SpritePool(scene, 31);
    this.launcherLayer = scene.add.graphics().setDepth(40);
    this.lineGlow = scene.add.image(WORLD.width / 2, WORLD.defenceLineY, 'cascade-atlas', TEX.px).setDepth(19);
    this.lineGlow.setDisplaySize(WORLD.width, 22).setTint(COLORS.danger).setAlpha(0);
  }

  private drawBackground(act: number): void {
    const pal = paletteForAct(act);
    const g = this.background;
    g.clear();
    const { width, arenaTop, arenaBottom, defenceLineY } = WORLD;
    g.fillStyle(pal.arena, 1);
    g.fillRect(0, 0, width, WORLD.height);
    for (let i = 0; i < 12; i++) {
      g.fillStyle(pal.deep, 0.06 * (12 - i));
      g.fillRect(0, arenaTop + i * 30, width, 30);
    }
    g.lineStyle(1, pal.grid, 0.8);
    for (let x = 0; x <= width; x += 60) g.lineBetween(x, arenaTop, x, arenaBottom);
    for (let y = arenaTop; y <= arenaBottom; y += 60) g.lineBetween(0, y, width, y);
    g.fillStyle(COLORS.danger, 0.05);
    g.fillRect(0, defenceLineY, width, arenaBottom - defenceLineY);
    g.lineStyle(3, COLORS.panelEdge, 0.9);
    g.lineBetween(1.5, arenaTop, 1.5, arenaBottom);
    g.lineBetween(width - 1.5, arenaTop, width - 1.5, arenaBottom);
    // The defence line itself is static; only a soft glow under it reacts to danger.
    g.lineStyle(3, COLORS.danger, 0.85);
    for (let x = 0; x < width; x += 28) g.lineBetween(x, defenceLineY, x + 16, defenceLineY);
  }

  draw(world: World, dt: number, danger: number): void {
    this.time += dt;
    if (world.act !== this.act) {
      this.act = world.act;
      this.drawBackground(world.act);
    }
    // Slow breathing glow (≈0.5 Hz), stronger as enemies close in.
    this.lineGlow.setAlpha(danger * (0.18 + 0.08 * Math.sin(this.time * 3)));

    this.fieldLayer.clear();
    this.launcherLayer.clear();
    for (const p of [this.clouds, this.under, this.bodies, this.cores, this.marks, this.bars, this.shots]) p.begin();

    for (const c of world.reactions.clouds) {
      const a = Math.min(1, c.life / 0.5) * 0.16;
      for (let k = 0; k < 4; k++) {
        const ang = this.time * 0.5 + k * 1.6 + c.id;
        const r = c.radius * (0.9 + 0.08 * Math.sin(this.time + k));
        this.clouds
          .next(TEX.puff)
          .setPosition(c.x + Math.cos(ang) * c.radius * 0.3, c.y + Math.sin(ang) * c.radius * 0.25)
          .setDisplaySize(r * 1.6, r * 1.6)
          .setTint(COLORS.steam)
          .setAlpha(a);
      }
    }
    for (const s of world.reactions.singularities) this.drawSingularity(this.fieldLayer, s);

    for (const enemy of world.enemies) if (enemy.alive) this.drawEnemy(world, enemy);
    for (const p of world.projectiles) if (p.alive) this.drawProjectile(p);

    for (const p of [this.clouds, this.under, this.bodies, this.cores, this.marks, this.bars, this.shots]) p.end();
    this.drawLauncher(world);
  }

  private drawSingularity(g: G, s: Singularity): void {
    const t = 1 - s.life / s.maxLife;
    const col = ELEMENT_COLORS.void;
    g.fillStyle(col.dark, 0.3 + 0.2 * t);
    g.fillCircle(s.x, s.y, s.radius);
    g.lineStyle(3, col.main, 0.5);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      const start = this.time * 2.5 + (k / 3) * Math.PI * 2;
      for (let i = 0; i <= 10; i++) {
        const a = start + i * 0.4;
        const r = s.radius * (1 - i / 12);
        const px = s.x + Math.cos(a) * r;
        const py = s.y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    g.lineStyle(2, col.core, 0.6);
    g.strokeCircle(s.x, s.y, s.radius * (1 - t * 0.15));
    g.fillStyle(0x020008, 1);
    g.fillCircle(s.x, s.y, 10 + 8 * t);
  }

  // ----------------------------------------------------------------- enemies

  private mark(frame: string, x: number, y: number, size: number, tint?: number, alpha = 1, rotation = 0): Phaser.GameObjects.Image {
    const img = this.marks.next(frame).setPosition(x, y).setDisplaySize(size, size).setAlpha(alpha).setRotation(rotation);
    if (tint !== undefined) img.setTint(tint);
    return img;
  }

  private drawEnemy(world: World, en: Enemy): void {
    const c = ENEMY_COLORS[en.kind];
    const boss = isBoss(en);
    const frozen = en.frozen > 0;
    const warp = Math.min(1, en.age / WARP_IN);
    const scale = warp < 1 ? 0.3 + 0.7 * easeOutBack(warp) : 1;
    const r = en.radius * scale;
    // A small squash on hits instead of a white flash.
    const squash = en.flash > 0 && !boss ? 0.08 : 0;
    const base = (en.radius / ENEMIES[en.kind].radius) * scale / BODY_SCALE;
    const slow = 0.5 + 0.5 * Math.sin(this.time * 2 + en.id * 0.7);

    // Under-glows: primed (would react with one of your elements) and elite aura.
    const primed = world.primedElement(en);
    if (primed) this.under.next(TEX.dot).setPosition(en.x, en.y).setDisplaySize(r * 3.6, r * 3.6).setTint(ELEMENT_COLORS[primed].main).setAlpha(0.32 + 0.08 * slow);
    if (en.traits.elite) this.under.next(TEX.dot).setPosition(en.x, en.y).setDisplaySize(r * 3.2, r * 3.2).setTint(TRAIT_COLORS.elite).setAlpha(0.25);

    let tint = TINT.none;
    if (en.wet > 0 && !frozen) tint = TINT.wet;
    else if (en.poison) tint = TINT.poison;
    else if (en.chill > 0 && !frozen) tint = TINT.chill;

    let rotation = 0;
    switch (en.kind) {
      case 'basic':
        rotation = Math.PI / 4 + Math.sin(en.age * 2) * 0.08;
        break;
      case 'tank':
        rotation = en.age * 0.3;
        break;
      case 'splitling':
        rotation = en.age * 2;
        break;
      case 'volatile':
        rotation = en.age * 1.2;
        break;
    }
    const frame = bodyFrame(en.kind, en.kind === 'tank' && en.hp < en.maxHp * 0.5);

    if (en.kind === 'fast') {
      // Afterimages trail behind the dart.
      for (let k = 2; k >= 1; k--) {
        this.bodies.next(frame).setPosition(en.x, en.y - k * en.speed * 0.07).setScale(base).setAlpha(0.14 * (3 - k)).setTint(tint);
      }
    }
    this.bodies
      .next(frame)
      .setPosition(en.x, en.y)
      .setScale(base * (1 + squash), base * (1 - squash))
      .setRotation(rotation)
      .setTint(tint);

    // Glowing core(s): steady, with a slow breath.
    const coreSize = en.kind === 'volatile' ? r * (0.9 + 0.5 * (1 - en.hp / en.maxHp)) : r * (boss ? 0.7 : 0.6);
    if (en.kind === 'splitter') {
      for (const s of [-1, 1]) this.cores.next(TEX.dot).setPosition(en.x + s * r * 0.42, en.y).setDisplaySize(r * 0.5, r * 0.5).setTint(c.core).setAlpha(0.85);
    } else {
      this.cores.next(TEX.dot).setPosition(en.x, en.kind === 'fast' ? en.y - r * 0.15 : en.y).setDisplaySize(coreSize, coreSize).setTint(c.core).setAlpha(0.7 + 0.2 * slow);
    }
    if (en.kind === 'aegis') this.mark(TEX.aegisRings, en.x, en.y, r * 2.7, undefined, 0.75, this.time * 0.6);
    if (en.kind === 'monolith') {
      const enraged = en.hp < en.maxHp * 0.5;
      this.mark(TEX.star, en.x, en.y, r * 0.9, enraged ? 0xff5a5a : c.core, 1, en.age * (enraged ? 1.6 : 0.8));
    }

    const m = r / MARK_REF;
    if (warp < 1) this.mark(TEX.ring, en.x, en.y, en.radius * (3.6 - 1.6 * warp), c.edge, 1 - warp);

    // ---- traits
    if (en.traits.shield) {
      const hits = en.shieldHits / SHIELD.directHits;
      this.mark(TEX.hex, en.x, en.y, r * 2.8, TRAIT_COLORS.shield, 0.45 + 0.35 * hits, this.time * 0.3);
    }
    if (en.traits.insulated) {
      this.mark(TEX.ring, en.x, en.y, r * 2.3, TRAIT_COLORS.insulated, 0.85);
      this.mark(TEX.insulated, en.x - r * 0.95, en.y - r * 0.95, 18);
    }
    if (en.traits.fireproof) this.mark(TEX.fireproof, en.x + r * 0.95, en.y + r * 0.85, 18);
    if (en.traits.elite) this.marks.next(TEX.crown).setPosition(en.x, en.y - r * 1.2).setDisplaySize(r * 1.3, r * 0.65);

    // ---- statuses
    if (en.y > WORLD.defenceLineY - 170) this.mark(TEX.ring, en.x, en.y, r * 2.9, COLORS.danger, 0.55 + 0.2 * slow);
    if (en.wet > 0 && !frozen) {
      this.mark(TEX.ring, en.x, en.y, r * 2.45, ELEMENT_COLORS.water.main, 0.8 * Math.min(1, en.wet / 1.2));
      this.marks.next(TEX.drop).setPosition(en.x + r * 0.9, en.y - r * 0.95).setDisplaySize(12, 14);
    }
    if (frozen) {
      this.mark(TEX.ice, en.x, en.y, 80 * m * 1.25);
      if (en.brittle) this.mark(TEX.crack, en.x, en.y, 64 * m * 1.1);
    } else if (en.chill > 0) {
      this.mark(TEX.flake, en.x - r * 0.95, en.y - r * 0.95, 14);
    }
    if (en.poison) this.mark(TEX.dashRing, en.x, en.y, r * 2.6, ELEMENT_COLORS.toxin.main, 0.75, -this.time * 0.8);
    if (en.burn) {
      // Flames bob gently rather than flicker.
      const bob = 1 + 0.08 * Math.sin(this.time * 5 + en.id);
      this.marks
        .next(TEX.flame)
        .setOrigin(0.5, 1)
        .setPosition(en.x, en.y - r * 0.35)
        .setDisplaySize(r * 1.6, r * 1.0 * bob)
        .setAlpha(0.9);
    }

    if (en.hp < en.maxHp) {
      const w = boss ? r * 2.2 : r * 1.8;
      const h = boss ? 8 : 4;
      const y = boss ? en.y - r - 22 : en.y + r + 7;
      this.bars.next(TEX.px).setOrigin(0, 0.5).setPosition(en.x - w / 2, y).setDisplaySize(w, h).setTint(0x000000).setAlpha(0.6);
      this.bars
        .next(TEX.px)
        .setOrigin(0, 0.5)
        .setPosition(en.x - w / 2, y)
        .setDisplaySize(Math.max(1, w * (en.hp / en.maxHp)), h)
        .setTint(boss ? COLORS.danger : c.edge);
    }
  }

  // ------------------------------------------------------------- projectiles

  /** A tapered trail, a soft halo and a bright core. */
  private drawProjectile(p: Projectile): void {
    const col = ELEMENT_COLORS[p.element];
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const len = speed * (p.minor ? 0.05 : 0.07);
    this.shots
      .next(TEX.trail)
      .setOrigin(1, 0.5)
      .setPosition(p.x, p.y)
      .setDisplaySize(len, p.radius * 1.8)
      .setRotation(Math.atan2(p.vy, p.vx))
      .setTint(col.main)
      .setAlpha(0.9);
    this.shots.next(TEX.dot).setPosition(p.x, p.y).setDisplaySize(p.radius * 3.6, p.radius * 3.6).setTint(col.main).setAlpha(0.55);
    this.shots.next(TEX.dot).setPosition(p.x, p.y).setDisplaySize(p.radius * 1.7, p.radius * 1.7).setTint(col.core);
  }

  private drawLauncher(world: World): void {
    const g = this.launcherLayer;
    const { launcherX: x, launcherY: y } = WORLD;
    const els = world.loadout.elements;
    const a = world.aimAngle;

    const max = (PLAYER.maxAimAngleDeg * Math.PI) / 180;
    g.lineStyle(2, COLORS.panelEdge, 0.5);
    g.beginPath();
    g.arc(x, y, 70, -Math.PI / 2 - max, -Math.PI / 2 + max, false);
    g.strokePath();
    g.fillStyle(0xffffff, 0.3);
    for (let d = 70; d < 330; d += 22) g.fillRect(x + Math.sin(a) * d - 2, y - Math.cos(a) * d - 2, 4, 4);

    // One barrel per element, fanned like their shots (exaggerated so each one is visible).
    const rate = rapidFireMult(world.loadout);
    els.forEach((el, i) => {
      const col = ELEMENT_COLORS[el];
      const ba = a + (i - (els.length - 1) / 2) * PLAYER.barrelSpreadDeg * (Math.PI / 180) * 2.2;
      // Recoil: kicked back right after firing, easing out over 0.1 s.
      const sinceShot = ELEMENTS[el].fireInterval * rate - world.barrelCooldown(el);
      const len = 46 - 6 * Math.max(0, 1 - sinceShot / 0.1);
      g.lineStyle(13, 0x1a2550, 1);
      g.lineBetween(x, y, x + Math.sin(ba) * (len + 2), y - Math.cos(ba) * (len + 2));
      g.lineStyle(7, col.main, 1);
      g.lineBetween(x, y, x + Math.sin(ba) * len, y - Math.cos(ba) * len);
    });
    g.fillStyle(COLORS.panel, 1);
    g.fillCircle(x, y, 30);
    const n = Math.max(1, els.length);
    els.forEach((el, i) => {
      g.lineStyle(4, ELEMENT_COLORS[el].main, 1);
      g.beginPath();
      g.arc(x, y, 30, (i / n) * Math.PI * 2 - Math.PI / 2 + 0.06, ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - 0.06, false);
      g.strokePath();
    });
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x, y, 9);
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

import Phaser from 'phaser';
import { ELEMENTS, PLAYER, SHIELD, WORLD } from '../config';
import { rapidFireMult } from '../logic/upgrades';
import { isBoss } from '../logic/status';
import type { Element, Enemy, Projectile, Singularity, SteamCloud } from '../logic/types';
import type { World } from '../logic/world';
import { droplet, snowflake } from '../ui/icons';
import { SpritePool, TEX, ensureTextures } from './textures';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS, TRAIT_COLORS, mixColor, paletteForAct } from '../ui/theme';

type G = Phaser.GameObjects.Graphics;
type V = Phaser.Math.Vector2;
const v = (x: number, y: number): V => new Phaser.Math.Vector2(x, y);

const WARP_IN = 0.35;

/** Draws the arena, fields, enemies, projectiles and the launcher every frame. */
export class ArenaRenderer {
  readonly background: G;
  readonly fieldLayer: G;
  readonly enemyLayer: G;
  readonly glowLayer: G;
  readonly launcherLayer: G;
  private time = 0;
  private act = 0;
  private readonly projectileSprites: SpritePool;

  constructor(scene: Phaser.Scene) {
    ensureTextures(scene);
    this.projectileSprites = new SpritePool(scene, 31);
    this.background = scene.add.graphics().setDepth(0);
    this.fieldLayer = scene.add.graphics().setDepth(12);
    this.enemyLayer = scene.add.graphics().setDepth(20);
    this.glowLayer = scene.add.graphics().setDepth(30);
    this.launcherLayer = scene.add.graphics().setDepth(40);
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
  }

  draw(world: World, dt: number, danger: number): void {
    this.time += dt;
    const act = world.act;
    if (act !== this.act) {
      this.act = act;
      this.drawBackground(act);
    }
    const e = this.enemyLayer;
    const glow = this.glowLayer;
    const fields = this.fieldLayer;
    e.clear();
    glow.clear();
    fields.clear();
    this.launcherLayer.clear();

    for (const c of world.reactions.clouds) this.drawCloud(fields, c);
    for (const s of world.reactions.singularities) this.drawSingularity(fields, glow, s);
    this.drawDefenceLine(e, glow, danger);
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      const primed = world.primedElement(enemy);
      if (primed) this.drawPrimed(fields, enemy, primed);
      this.drawEnemy(e, glow, enemy);
    }
    this.projectileSprites.begin();
    for (const p of world.projectiles) if (p.alive) this.drawProjectile(p);
    this.projectileSprites.end();
    this.drawLauncher(world);
  }

  // ------------------------------------------------------------------ fields

  private drawCloud(g: G, c: SteamCloud): void {
    const a = Math.min(1, c.life / 0.5) * 0.13;
    for (let k = 0; k < 5; k++) {
      const ang = this.time * 0.6 + k * 1.3 + c.id;
      const r = c.radius * (0.55 + 0.1 * Math.sin(this.time * 2 + k));
      g.fillStyle(COLORS.steam, a);
      g.fillCircle(c.x + Math.cos(ang) * c.radius * 0.35, c.y + Math.sin(ang) * c.radius * 0.3, r);
    }
    g.lineStyle(2, COLORS.steam, a * 1.6);
    g.strokeCircle(c.x, c.y, c.radius);
  }

  private drawSingularity(g: G, glow: G, s: Singularity): void {
    const t = 1 - s.life / s.maxLife;
    const col = ELEMENT_COLORS.void;
    // Body and spiral arms sit beneath the enemies so silhouettes stay readable.
    g.fillStyle(col.dark, 0.3 + 0.2 * t);
    g.fillCircle(s.x, s.y, s.radius);
    g.lineStyle(3, col.main, 0.55);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      const start = this.time * 4 + (k / 4) * Math.PI * 2;
      for (let i = 0; i <= 14; i++) {
        const a = start + i * 0.3;
        const r = s.radius * (1 - i / 16);
        const px = s.x + Math.cos(a) * r;
        const py = s.y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    g.fillStyle(0x020008, 1);
    g.fillCircle(s.x, s.y, 10 + 8 * t);
    // Only the shrinking rim draws above, so the threat area is clear.
    glow.lineStyle(2, col.core, 0.7);
    glow.strokeCircle(s.x, s.y, s.radius * (1 - t * 0.15));
  }

  /** Soft halo in the colour of the element that would set off a reaction on this enemy. */
  private drawPrimed(g: G, en: Enemy, el: Element): void {
    const col = ELEMENT_COLORS[el];
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6 + en.id * 0.7);
    g.fillStyle(col.main, 0.1 + 0.1 * pulse);
    g.fillCircle(en.x, en.y, en.radius * (1.6 + 0.15 * pulse));
    g.fillStyle(col.main, 0.12);
    g.fillCircle(en.x, en.y, en.radius * 1.25);
  }

  private drawDefenceLine(g: G, glow: G, danger: number): void {
    const y = WORLD.defenceLineY;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (4 + danger * 8));
    glow.fillStyle(COLORS.danger, 0.06 + 0.1 * danger * pulse);
    glow.fillRect(0, y - 10, WORLD.width, 20);
    g.lineStyle(3, COLORS.danger, 0.65 + 0.35 * danger * pulse);
    for (let x = 0; x < WORLD.width; x += 28) g.lineBetween(x, y, x + 16, y);
  }

  // ----------------------------------------------------------------- enemies

  private drawEnemy(g: G, glow: G, en: Enemy): void {
    const c = ENEMY_COLORS[en.kind];
    const wet = en.wet > 0;
    const frozen = en.frozen > 0;
    const chilled = en.chill > 0 && !frozen;
    const poisoned = en.poison !== null;
    const flash = en.flash > 0;
    const boss = isBoss(en);

    // Spawn warp-in, then a little squash on every hit.
    const warp = Math.min(1, en.age / WARP_IN);
    const scale = warp < 1 ? 0.3 + 0.7 * easeOutBack(warp) : 1;
    const squash = flash && !boss ? 0.12 : 0;
    const r = en.radius * scale;
    const sx = 1 + squash;
    const sy = 1 - squash;

    let fill: number = c.fill;
    let edge: number = c.edge;
    if (wet) {
      fill = mixColor(fill, ELEMENT_COLORS.water.dark, 0.7);
      edge = mixColor(edge, ELEMENT_COLORS.water.main, 0.5);
    }
    if (poisoned) edge = mixColor(edge, ELEMENT_COLORS.toxin.main, 0.45);
    if (chilled) fill = mixColor(fill, ELEMENT_COLORS.frost.dark, 0.6);
    if (flash) {
      fill = mixColor(fill, 0xffffff, boss ? 0.3 : 0.7);
      edge = 0xffffff;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + en.id);
    const nearLine = en.y > WORLD.defenceLineY - 170;

    if (warp < 1) {
      glow.lineStyle(2, c.edge, 1 - warp);
      glow.strokeCircle(en.x, en.y, en.radius * (1.8 - warp));
    }

    // Shadow for readability over effects.
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(en.x, en.y + r * 0.25, r * 2.1, r * 1.9);

    if (en.traits.elite) {
      glow.fillStyle(TRAIT_COLORS.elite, 0.12 + 0.08 * pulse);
      glow.fillCircle(en.x, en.y, r * 1.55);
      // Crown spikes.
      glow.fillStyle(TRAIT_COLORS.elite, 0.9);
      for (let k = -1; k <= 1; k++) {
        const bx = en.x + k * r * 0.45;
        glow.fillTriangle(bx - r * 0.16, en.y - r * 1.05, bx + r * 0.16, en.y - r * 1.05, bx, en.y - r * (1.38 + (k === 0 ? 0.12 : 0)));
      }
    }

    switch (en.kind) {
      case 'basic': {
        const rot = Math.PI / 4 + Math.sin(en.age * 2) * 0.08;
        poly(g, en.x, en.y, r * 1.05, 4, rot, fill, edge, 3, sx, sy);
        // Rotating inner ring segments and glowing core.
        g.lineStyle(2, edge, 0.6);
        arcSegments(g, en.x, en.y, r * 0.62, 3, en.age * 1.6);
        core(glow, en.x, en.y, r * 0.24, c.core, 0.6 + 0.4 * pulse);
        break;
      }
      case 'fast': {
        // Afterimages trail behind the dart.
        for (let k = 2; k >= 1; k--) {
          dart(g, en.x, en.y - k * en.speed * 0.07, r, mixColor(fill, 0x000000, 0.2), edge, 0.18 * (3 - k), sx, sy);
        }
        dart(g, en.x, en.y, r, fill, edge, 1, sx, sy);
        core(glow, en.x, en.y - r * 0.15, r * 0.22, c.core, 0.8);
        break;
      }
      case 'tank': {
        poly(g, en.x, en.y, r, 6, en.age * 0.3, fill, edge, 4, sx, sy);
        // Armour plates fall away as it takes damage.
        const plates = Math.ceil((en.hp / en.maxHp) * 6);
        g.fillStyle(mixColor(edge, 0x000000, 0.35), 1);
        for (let i = 0; i < plates; i++) {
          const a = en.age * 0.3 + (i / 6) * Math.PI * 2 + Math.PI / 6;
          const px = en.x + Math.cos(a) * r * 0.78;
          const py = en.y + Math.sin(a) * r * 0.78;
          g.fillCircle(px, py, r * 0.17);
        }
        poly(g, en.x, en.y, r * 0.5, 6, -en.age * 0.5, mixColor(fill, edge, 0.2), edge, 2, sx, sy);
        core(glow, en.x, en.y, r * 0.2, c.core, 0.5 + 0.5 * pulse);
        break;
      }
      case 'splitter': {
        // Two lobes joined by a glowing seam: it will split along it.
        const wob = Math.sin(en.age * 3) * r * 0.08;
        g.fillStyle(fill, 1);
        g.lineStyle(3, edge, 1);
        g.fillCircle(en.x - r * 0.42 - wob, en.y, r * 0.68);
        g.strokeCircle(en.x - r * 0.42 - wob, en.y, r * 0.68);
        g.fillCircle(en.x + r * 0.42 + wob, en.y, r * 0.68);
        g.strokeCircle(en.x + r * 0.42 + wob, en.y, r * 0.68);
        glow.lineStyle(3, c.core, 0.6 + 0.4 * pulse);
        glow.lineBetween(en.x, en.y - r * 0.55, en.x, en.y + r * 0.55);
        core(glow, en.x - r * 0.42 - wob, en.y, r * 0.18, c.core, 0.7);
        core(glow, en.x + r * 0.42 + wob, en.y, r * 0.18, c.core, 0.7);
        break;
      }
      case 'splitling': {
        poly(g, en.x, en.y, r * 1.1, 3, Math.PI / 2 + en.age * 3, fill, edge, 2, sx, sy);
        core(glow, en.x, en.y, r * 0.3, c.core, 0.8);
        break;
      }
      case 'volatile': {
        // Spiky orb whose core blinks faster as it gets closer to bursting.
        const hpFrac = en.hp / en.maxHp;
        const blink = 0.5 + 0.5 * Math.sin(this.time * (6 + (1 - hpFrac) * 18));
        spiky(g, en.x, en.y, r, 8, en.age * 1.2, fill, edge, sx, sy);
        core(glow, en.x, en.y, r * (0.35 + 0.1 * blink), c.core, 0.5 + 0.5 * blink);
        break;
      }
      case 'hive': {
        // A honeycomb of cells around a pulsing heart.
        poly(g, en.x, en.y, r, 6, Math.PI / 6, fill, edge, 5);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const cell = BOSS_SPLIT_CELLS - en.splits > i / 2 ? 1 : 0.25;
          poly(g, en.x + Math.cos(a) * r * 0.55, en.y + Math.sin(a) * r * 0.55, r * 0.3, 6, Math.PI / 6, mixColor(fill, c.core, 0.2 * cell), edge, 2);
        }
        core(glow, en.x, en.y, r * 0.3, c.core, 0.6 + 0.4 * pulse);
        break;
      }
      case 'aegis': {
        // Layered shield rings around an armoured eye.
        poly(g, en.x, en.y, r, 8, Math.PI / 8, fill, edge, 5);
        glow.lineStyle(4, c.core, 0.5 + 0.3 * pulse);
        arcSegments(glow, en.x, en.y, r * 1.18, 6, this.time * 0.8);
        glow.lineStyle(3, c.core, 0.35);
        arcSegments(glow, en.x, en.y, r * 1.32, 4, -this.time * 0.5);
        g.fillStyle(0x060a18, 1);
        g.fillEllipse(en.x, en.y, r * 0.9, r * 0.5);
        core(glow, en.x, en.y, r * 0.18, c.core, 1);
        break;
      }
      case 'monolith': {
        const enraged = en.hp < en.maxHp * 0.5;
        poly(g, en.x, en.y, r, 8, Math.PI / 8, fill, edge, 5);
        poly(g, en.x, en.y, r * 0.7, 8, Math.PI / 8, mixColor(fill, 0x000000, 0.3), edge, 2);
        const pts: V[] = [];
        for (let i = 0; i < 10; i++) {
          const a = en.age * (enraged ? 3 : 1.4) + (i / 10) * Math.PI * 2;
          const rr = i % 2 === 0 ? r * 0.42 : r * 0.18;
          pts.push(v(en.x + Math.cos(a) * rr, en.y + Math.sin(a) * rr));
        }
        glow.fillStyle(enraged ? 0xff3d3d : c.core, 1);
        glow.fillPoints(pts, true);
        break;
      }
    }

    // ---- traits
    if (en.traits.shield) {
      const hits = en.shieldHits / SHIELD.directHits;
      glow.lineStyle(3, TRAIT_COLORS.shield, 0.45 + 0.35 * hits);
      hexOutline(glow, en.x, en.y, r * 1.38, this.time * 0.4);
      glow.fillStyle(TRAIT_COLORS.shield, 0.08 + 0.06 * pulse);
      glow.fillCircle(en.x, en.y, r * 1.3);
    }
    if (en.traits.insulated) {
      g.lineStyle(5, 0x2a2418, 1);
      g.strokeCircle(en.x, en.y, r * 1.12);
      g.lineStyle(2, TRAIT_COLORS.insulated, 0.9);
      g.strokeCircle(en.x, en.y, r * 1.12);
      // Crossed-out bolt marker.
      const mx = en.x - r * 0.95;
      const my = en.y - r * 0.95;
      g.fillStyle(0x15120a, 1);
      g.fillCircle(mx, my, 8);
      g.lineStyle(2, TRAIT_COLORS.insulated, 1);
      g.strokeCircle(mx, my, 8);
      g.lineBetween(mx - 5, my + 5, mx + 5, my - 5);
    }
    if (en.traits.fireproof) {
      const mx = en.x + r * 0.95;
      const my = en.y + r * 0.85;
      g.fillStyle(0x1a0c06, 1);
      g.fillCircle(mx, my, 8);
      g.lineStyle(2, TRAIT_COLORS.fireproof, 1);
      g.strokeCircle(mx, my, 8);
      g.fillStyle(TRAIT_COLORS.fireproof, 1);
      g.fillTriangle(mx - 3.5, my + 3, mx + 3.5, my + 3, mx, my - 5);
    }

    // ---- statuses
    if (nearLine && !flash) {
      g.lineStyle(2, COLORS.danger, 0.35 + 0.5 * pulse);
      g.strokeCircle(en.x, en.y, r * 1.45);
    }
    if (wet && !frozen) {
      const fade = Math.min(1, en.wet / 1.2);
      g.lineStyle(2.5, ELEMENT_COLORS.water.main, 0.85 * fade);
      g.strokeCircle(en.x, en.y, r * 1.22);
      droplet(g, en.x + r * 0.9, en.y - r * 0.95, Math.min(12, Math.max(7, r * 0.38)), ELEMENT_COLORS.water.main, ELEMENT_COLORS.water.core);
    }
    if (frozen) {
      // An ice block: translucent crystal facets over the silhouette.
      const ice = ELEMENT_COLORS.frost;
      glow.fillStyle(ice.main, 0.35);
      glow.fillPoints(
        [v(en.x - r * 1.15, en.y - r * 0.3), v(en.x - r * 0.4, en.y - r * 1.2), v(en.x + r * 0.7, en.y - r * 1.05), v(en.x + r * 1.2, en.y + r * 0.1), v(en.x + r * 0.5, en.y + r * 1.15), v(en.x - r * 0.8, en.y + r * 0.95)],
        true,
      );
      glow.lineStyle(2, ice.core, 0.9);
      glow.strokePoints(
        [v(en.x - r * 1.15, en.y - r * 0.3), v(en.x - r * 0.4, en.y - r * 1.2), v(en.x + r * 0.7, en.y - r * 1.05), v(en.x + r * 1.2, en.y + r * 0.1), v(en.x + r * 0.5, en.y + r * 1.15), v(en.x - r * 0.8, en.y + r * 0.95)],
        true,
      );
      glow.lineStyle(1.5, ice.core, 0.6);
      glow.lineBetween(en.x - r * 0.4, en.y - r * 1.2, en.x + r * 0.1, en.y);
      glow.lineBetween(en.x + r * 0.1, en.y, en.x + r * 0.5, en.y + r * 1.15);
      if (en.brittle) {
        // Cracks: the next shatter does double damage.
        glow.lineStyle(2, ELEMENT_COLORS.toxin.main, 0.9);
        glow.strokePoints([v(en.x - r * 0.7, en.y - r * 0.5), v(en.x - r * 0.2, en.y - r * 0.1), v(en.x - r * 0.4, en.y + r * 0.4), v(en.x + r * 0.2, en.y + r * 0.7)]);
      }
    } else if (chilled) {
      snowflake(g, en.x - r * 0.95, en.y - r * 0.95, Math.min(11, Math.max(6, r * 0.32)), ELEMENT_COLORS.frost.main, 0.95);
    }
    if (poisoned) {
      const tox = ELEMENT_COLORS.toxin;
      g.lineStyle(2, tox.main, 0.8);
      arcSegments(g, en.x, en.y, r * 1.3, 8, -this.time * 1.5);
      for (let k = 0; k < 3; k++) {
        const t = (this.time * 0.8 + k / 3 + en.id * 0.13) % 1;
        glow.fillStyle(tox.main, 0.8 * (1 - t));
        glow.fillCircle(en.x + (k - 1) * r * 0.45, en.y - r * 0.6 - t * r, 2.5 + 1.5 * (1 - t));
      }
    }
    if (en.burn) {
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
      const w = boss ? r * 2.2 : r * 1.8;
      const h = boss ? 8 : 4;
      const y = boss ? en.y - r - 22 : en.y + r + 7;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(en.x - w / 2, y, w, h);
      g.fillStyle(boss ? COLORS.danger : c.edge, 1);
      g.fillRect(en.x - w / 2, y, w * (en.hp / en.maxHp), h);
    }
  }

  // ------------------------------------------------------------- projectiles

  /** Tinted sprites: a tapered trail, a soft halo and a bright core. */
  private drawProjectile(p: Projectile): void {
    const col = ELEMENT_COLORS[p.element];
    const pool = this.projectileSprites;
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const len = speed * (p.minor ? 0.05 : 0.075);
    pool
      .next(TEX.trail)
      .setOrigin(1, 0.5)
      .setPosition(p.x, p.y)
      .setDisplaySize(len, p.radius * 1.9)
      .setRotation(Math.atan2(p.vy, p.vx))
      .setTint(col.main)
      .setAlpha(1);
    pool.next(TEX.dot).setPosition(p.x, p.y).setDisplaySize(p.radius * 4.4, p.radius * 4.4).setTint(col.main).setAlpha(0.7).setRotation(0);
    pool.next(TEX.dot).setPosition(p.x, p.y).setDisplaySize(p.radius * 1.9, p.radius * 1.9).setTint(col.core).setAlpha(1).setRotation(0);
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
    // Aim guide in white so it reads against every element colour.
    g.fillStyle(0xffffff, 0.35);
    for (let d = 70; d < 330; d += 22) g.fillCircle(x + Math.sin(a) * d, y - Math.cos(a) * d, 2.2);

    // One barrel per element, fanned like their shots (exaggerated so each one is visible).
    const rate = rapidFireMult(world.loadout);
    els.forEach((el, i) => {
      const col = ELEMENT_COLORS[el];
      const off = (i - (els.length - 1) / 2) * PLAYER.barrelSpreadDeg * (Math.PI / 180) * 2.2;
      const ba = a + off;
      // Recoil: kicked back right after firing, easing out over 0.1 s.
      const sinceShot = ELEMENTS[el].fireInterval * rate - world.barrelCooldown(el);
      const kick = 7 * Math.max(0, 1 - sinceShot / 0.1);
      const len = 46 - kick;
      g.lineStyle(13, 0x1a2550, 1);
      g.lineBetween(x, y, x + Math.sin(ba) * (len + 2), y - Math.cos(ba) * (len + 2));
      g.lineStyle(7, col.main, 1);
      g.lineBetween(x, y, x + Math.sin(ba) * len, y - Math.cos(ba) * len);
    });
    g.fillStyle(COLORS.panel, 1);
    g.fillCircle(x, y, 30);
    // Ring segments in each element's colour.
    const n = Math.max(1, els.length);
    els.forEach((el, i) => {
      g.lineStyle(4, ELEMENT_COLORS[el].main, 1);
      g.beginPath();
      g.arc(x, y, 30, (i / n) * Math.PI * 2 - Math.PI / 2 + 0.06, ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - 0.06, false);
      g.strokePath();
    });
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(x, y, 9);
  }
}

const BOSS_SPLIT_CELLS = 3;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function poly(g: G, x: number, y: number, r: number, sides: number, rot: number, fill: number, edge: number, width: number, sx = 1, sy = 1): void {
  const pts: V[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(v(x + Math.cos(a) * r * sx, y + Math.sin(a) * r * sy));
  }
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  g.lineStyle(width, edge, 1);
  g.strokePoints(pts, true);
}

function dart(g: G, x: number, y: number, r: number, fill: number, edge: number, alpha: number, sx = 1, sy = 1): void {
  const pts = [v(x, y + r * 1.3 * sy), v(x + r * 1.05 * sx, y - r * 0.8 * sy), v(x, y - r * 0.3 * sy), v(x - r * 1.05 * sx, y - r * 0.8 * sy)];
  g.fillStyle(fill, alpha);
  g.fillPoints(pts, true);
  g.lineStyle(3, edge, alpha);
  g.strokePoints(pts, true);
}

function spiky(g: G, x: number, y: number, r: number, spikes: number, rot: number, fill: number, edge: number, sx = 1, sy = 1): void {
  const pts: V[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 1.15 : r * 0.72;
    pts.push(v(x + Math.cos(a) * rr * sx, y + Math.sin(a) * rr * sy));
  }
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2.5, edge, 1);
  g.strokePoints(pts, true);
}

function core(g: G, x: number, y: number, r: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha * 0.3);
  g.fillCircle(x, y, r * 2);
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}

function arcSegments(g: G, x: number, y: number, r: number, count: number, rot: number): void {
  const span = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    g.beginPath();
    g.arc(x, y, r, rot + i * span, rot + i * span + span * 0.55, false);
    g.strokePath();
  }
}

function hexOutline(g: G, x: number, y: number, r: number, rot: number): void {
  const pts: V[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    pts.push(v(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  g.strokePoints(pts, true);
}

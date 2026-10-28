import Phaser from 'phaser';
import type { ReactionId, UpgradeId } from '../logic/types';
import { UPGRADE_DEFS } from '../logic/upgrades';
import { ELEMENT_COLORS } from './theme';

type G = Phaser.GameObjects.Graphics;
type V = Phaser.Math.Vector2;

const v = (x: number, y: number): V => new Phaser.Math.Vector2(x, y);

const MOD_COLORS: Partial<Record<UpgradeId, number>> = {
  ricochet: 0x9be7ff,
  splitShot: 0xc9a6ff,
  rapidFire: 0x7dffb5,
  piercing: 0xe6ecff,
  overcharge: 0xffd166,
  repair: 0xff6f8f,
  catalyst: 0xd2a6ff,
  flashover: 0xff9a3c,
  stormRelay: 0xfff27a,
  widerSplash: 0x58c8ff,
  longChain: 0xffe94a,
  bigSteam: 0xeaf6ff,
  deepFreeze: 0xa8f4ff,
  galeForce: 0x8dffc4,
  virulence: 0xb4ff2e,
  eventHorizon: 0xb46bff,
};

export function iconColor(id: UpgradeId): number {
  if (id in ELEMENT_COLORS) return ELEMENT_COLORS[id as keyof typeof ELEMENT_COLORS].main;
  if (UPGRADE_DEFS[id].rarity === 'combo') return 0xffd166;
  return MOD_COLORS[id] ?? 0xe6ecff;
}

function flame(g: G, x: number, y: number, s: number, color: number, core: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints([v(x, y - s), v(x + s * 0.55, y - s * 0.1), v(x + s * 0.5, y + s * 0.45), v(x, y + s * 0.75), v(x - s * 0.5, y + s * 0.45), v(x - s * 0.55, y - s * 0.1), v(x - s * 0.15, y - s * 0.35)], true);
  g.fillStyle(core, alpha);
  g.fillPoints([v(x, y - s * 0.15), v(x + s * 0.25, y + s * 0.35), v(x, y + s * 0.6), v(x - s * 0.25, y + s * 0.35)], true);
}

export function droplet(g: G, x: number, y: number, s: number, color: number, core?: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.55, y + s * 0.05);
  g.arc(x, y + s * 0.25, s * 0.58, -0.35, Math.PI + 0.35, false);
  g.lineTo(x, y - s);
  g.closePath();
  g.fillPath();
  if (core !== undefined) {
    g.fillStyle(core, 0.9);
    g.fillCircle(x - s * 0.18, y + s * 0.2, s * 0.16);
  }
}

function bolt(g: G, x: number, y: number, s: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints([v(x + s * 0.2, y - s), v(x - s * 0.5, y + s * 0.1), v(x - s * 0.05, y + s * 0.1), v(x - s * 0.25, y + s), v(x + s * 0.5, y - s * 0.15), v(x + s * 0.05, y - s * 0.15)], true);
}

export function snowflake(g: G, x: number, y: number, s: number, color: number, alpha = 1): void {
  g.lineStyle(Math.max(1.5, s * 0.16), color, alpha);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const dx = Math.cos(a) * s;
    const dy = Math.sin(a) * s;
    g.lineBetween(x - dx, y - dy, x + dx, y + dy);
    for (const sign of [-1, 1]) {
      const bx = x + sign * dx * 0.6;
      const by = y + sign * dy * 0.6;
      const ba = a + Math.PI / 2;
      g.lineBetween(bx, by, bx + Math.cos(ba + sign * 0.6) * s * 0.3 * sign, by + Math.sin(ba + sign * 0.6) * s * 0.3 * sign);
    }
  }
}

function swirl(g: G, x: number, y: number, s: number, color: number, alpha = 1): void {
  g.lineStyle(Math.max(2, s * 0.16), color, alpha);
  for (let k = 0; k < 3; k++) {
    const yy = y + (k - 1) * s * 0.55;
    const w = s * (k === 1 ? 1 : 0.75);
    g.beginPath();
    g.moveTo(x - w, yy);
    g.lineTo(x + w * 0.5, yy);
    g.arc(x + w * 0.5, yy - s * 0.18, s * 0.18, Math.PI / 2, -Math.PI / 2, true);
    g.strokePath();
  }
}

function bubbles(g: G, x: number, y: number, s: number, color: number, core: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillCircle(x - s * 0.3, y + s * 0.25, s * 0.48);
  g.fillCircle(x + s * 0.42, y - s * 0.05, s * 0.36);
  g.fillCircle(x + s * 0.05, y - s * 0.55, s * 0.26);
  g.fillStyle(core, alpha * 0.9);
  g.fillCircle(x - s * 0.42, y + s * 0.12, s * 0.14);
}

function vortex(g: G, x: number, y: number, s: number, color: number, core: number, alpha = 1): void {
  g.lineStyle(Math.max(2, s * 0.14), color, alpha);
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    const start = (k / 3) * Math.PI * 2;
    for (let i = 0; i <= 12; i++) {
      const a = start + i * 0.32;
      const r = s * (1 - i / 14);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
  g.fillStyle(0x05020c, alpha);
  g.fillCircle(x, y, s * 0.3);
  g.lineStyle(Math.max(1.5, s * 0.08), core, alpha);
  g.strokeCircle(x, y, s * 0.3);
}

function star(g: G, x: number, y: number, s: number, points: number, inner: number, color: number, alpha = 1): void {
  const pts: V[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? s : s * inner;
    pts.push(v(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

/** Draw a compact geometric icon for an element or modifier, centred at (x, y). */
export function drawIcon(g: G, id: UpgradeId, x: number, y: number, s: number, alpha = 1): void {
  const c = iconColor(id);
  const lw = Math.max(2, s * 0.14);
  g.lineStyle(lw, c, alpha);
  switch (id) {
    case 'fire':
      return flame(g, x, y, s, ELEMENT_COLORS.fire.main, ELEMENT_COLORS.fire.core, alpha);
    case 'water':
      return droplet(g, x, y, s, ELEMENT_COLORS.water.main, ELEMENT_COLORS.water.core);
    case 'lightning':
      return bolt(g, x, y, s, ELEMENT_COLORS.lightning.main, alpha);
    case 'frost':
      return snowflake(g, x, y, s, ELEMENT_COLORS.frost.main, alpha);
    case 'wind':
      return swirl(g, x, y, s, ELEMENT_COLORS.wind.main, alpha);
    case 'toxin':
      return bubbles(g, x, y, s, ELEMENT_COLORS.toxin.main, ELEMENT_COLORS.toxin.core, alpha);
    case 'void':
      return vortex(g, x, y, s, ELEMENT_COLORS.void.main, ELEMENT_COLORS.void.core, alpha);
    case 'ricochet':
      g.strokePoints([v(x - s * 0.9, y + s * 0.8), v(x - s * 0.1, y - s * 0.2), v(x + s * 0.3, y + s * 0.3), v(x + s * 0.9, y - s * 0.8)]);
      g.lineBetween(x - s, y - s, x - s, y + s);
      g.lineBetween(x + s, y - s, x + s, y + s);
      return;
    case 'splitShot':
      g.lineBetween(x, y + s, x, y - s);
      g.lineBetween(x, y + s, x - s * 0.7, y - s * 0.75);
      g.lineBetween(x, y + s, x + s * 0.7, y - s * 0.75);
      g.fillStyle(c, alpha);
      g.fillCircle(x, y - s, s * 0.18);
      g.fillCircle(x - s * 0.7, y - s * 0.75, s * 0.14);
      g.fillCircle(x + s * 0.7, y - s * 0.75, s * 0.14);
      return;
    case 'rapidFire':
      for (const off of [-0.45, 0.15]) {
        g.strokePoints([v(x - s * 0.7, y + s * (off + 0.45)), v(x, y + s * (off - 0.25)), v(x + s * 0.7, y + s * (off + 0.45))]);
      }
      return;
    case 'piercing':
      g.strokeCircle(x, y, s * 0.45);
      g.lineBetween(x, y + s, x, y - s);
      g.fillStyle(c, alpha);
      g.fillTriangle(x - s * 0.3, y - s * 0.6, x + s * 0.3, y - s * 0.6, x, y - s * 1.05);
      return;
    case 'overcharge':
      g.strokeRect(x - s * 0.5, y - s * 0.75, s, s * 1.5);
      g.fillStyle(c, alpha);
      g.fillRect(x - s * 0.2, y - s * 0.95, s * 0.4, s * 0.2);
      bolt(g, x, y, s * 0.55, c, alpha);
      return;
    case 'repair':
      g.fillStyle(c, alpha);
      g.fillRect(x - s * 0.22, y - s * 0.8, s * 0.44, s * 1.6);
      g.fillRect(x - s * 0.8, y - s * 0.22, s * 1.6, s * 0.44);
      return;
    case 'catalyst':
      g.strokePoints([v(x - s * 0.25, y - s), v(x - s * 0.25, y - s * 0.3), v(x - s * 0.8, y + s * 0.8), v(x + s * 0.8, y + s * 0.8), v(x + s * 0.25, y - s * 0.3), v(x + s * 0.25, y - s)]);
      g.fillStyle(c, alpha * 0.8);
      g.fillTriangle(x - s * 0.6, y + s * 0.65, x + s * 0.6, y + s * 0.65, x, y);
      return;
    case 'flashover':
      star(g, x, y, s, 8, 0.45, c, alpha);
      g.fillStyle(0xfff0c0, alpha);
      g.fillCircle(x, y, s * 0.3);
      return;
    case 'stormRelay':
      bolt(g, x, y, s * 0.7, c, alpha);
      g.strokeCircle(x - s * 0.75, y + s * 0.65, s * 0.22);
      g.strokeCircle(x + s * 0.75, y + s * 0.65, s * 0.22);
      return;
    case 'widerSplash':
      g.strokeCircle(x, y, s * 0.35);
      g.lineStyle(Math.max(2, s * 0.1), c, alpha * 0.75);
      g.strokeCircle(x, y, s * 0.68);
      g.lineStyle(Math.max(2, s * 0.08), c, alpha * 0.5);
      g.strokeCircle(x, y, s);
      return;
    case 'longChain':
      for (let i = -1; i <= 1; i++) g.strokeEllipse(x + i * s * 0.55, y, s * 0.7, s * 0.42);
      return;
    case 'bigSteam':
      g.fillStyle(c, alpha * 0.9);
      g.fillCircle(x - s * 0.45, y + s * 0.2, s * 0.42);
      g.fillCircle(x + s * 0.1, y - s * 0.2, s * 0.55);
      g.fillCircle(x + s * 0.55, y + s * 0.25, s * 0.38);
      return;
    case 'deepFreeze':
      snowflake(g, x, y, s, c, alpha);
      g.strokeCircle(x, y, s * 1.05);
      return;
    case 'galeForce':
      swirl(g, x, y, s, c, alpha);
      return;
    case 'virulence':
      g.fillStyle(c, alpha);
      g.fillCircle(x, y, s * 0.35);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineBetween(x, y, x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85);
        g.fillCircle(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9, s * 0.14);
      }
      return;
    case 'eventHorizon':
      vortex(g, x, y, s * 0.8, c, ELEMENT_COLORS.void.core, alpha);
      g.strokeCircle(x, y, s);
      return;
    case 'superheatedSteam':
      drawIcon(g, 'bigSteam', x - s * 0.15, y + s * 0.2, s * 0.75, alpha);
      flame(g, x + s * 0.5, y - s * 0.35, s * 0.5, ELEMENT_COLORS.fire.main, ELEMENT_COLORS.fire.core, alpha);
      return;
    case 'permafrost':
      g.fillStyle(ELEMENT_COLORS.frost.main, alpha);
      g.fillTriangle(x - s, y + s * 0.8, x - s * 0.2, y - s * 0.7, x + s * 0.5, y + s * 0.8);
      g.fillStyle(ELEMENT_COLORS.frost.core, alpha);
      g.fillTriangle(x - s * 0.1, y + s * 0.8, x + s * 0.45, y - s * 0.2, x + s, y + s * 0.8);
      return;
    case 'toxicStorm':
      swirl(g, x, y, s * 0.85, ELEMENT_COLORS.wind.main, alpha);
      g.fillStyle(ELEMENT_COLORS.toxin.main, alpha);
      g.fillCircle(x + s * 0.7, y - s * 0.7, s * 0.22);
      g.fillCircle(x - s * 0.75, y + s * 0.75, s * 0.18);
      return;
    case 'plasmaArc':
      bolt(g, x - s * 0.15, y, s * 0.85, ELEMENT_COLORS.lightning.main, alpha);
      flame(g, x + s * 0.55, y + s * 0.3, s * 0.45, ELEMENT_COLORS.fire.main, ELEMENT_COLORS.fire.core, alpha);
      return;
    case 'gravityWell':
      g.fillStyle(ELEMENT_COLORS.void.main, alpha);
      g.fillCircle(x, y, s * 0.5);
      g.lineStyle(Math.max(2, s * 0.12), ELEMENT_COLORS.wind.main, alpha);
      g.strokeEllipse(x, y, s * 2, s * 0.6);
      return;
    case 'acidRain':
      for (const [dx, dy] of [
        [-0.5, -0.3],
        [0.1, 0.1],
        [0.6, -0.4],
      ]) {
        droplet(g, x + dx * s, y + dy * s, s * 0.42, ELEMENT_COLORS.toxin.main, ELEMENT_COLORS.toxin.core);
      }
      return;
  }
}

/** Icon for a codex reaction: its first two elements side by side. */
export function drawReactionIcon(g: G, id: ReactionId, elements: UpgradeId[], x: number, y: number, s: number, known: boolean): void {
  if (!known) {
    g.lineStyle(2, 0x3a4070, 1);
    g.strokeCircle(x, y, s);
    return;
  }
  if (id === 'detonation') {
    star(g, x, y, s, 10, 0.5, 0xff5a4a);
    return;
  }
  if (elements.length === 1) {
    drawIcon(g, elements[0], x, y, s);
    return;
  }
  drawIcon(g, elements[0], x - s * 0.55, y, s * 0.7);
  drawIcon(g, elements[1], x + s * 0.55, y, s * 0.7);
}

import Phaser from 'phaser';
import type { UpgradeId } from '../logic/types';
import { ELEMENT_COLORS } from './theme';

type G = Phaser.GameObjects.Graphics;

export function iconColor(id: UpgradeId): number {
  switch (id) {
    case 'fire':
      return ELEMENT_COLORS.fire.main;
    case 'water':
      return ELEMENT_COLORS.water.main;
    case 'lightning':
      return ELEMENT_COLORS.lightning.main;
    case 'ricochet':
      return 0x9be7ff;
    case 'splitShot':
      return 0xc9a6ff;
    case 'flashover':
      return 0xff9a3c;
    case 'stormRelay':
      return 0xfff27a;
    case 'widerSplash':
      return 0x58c8ff;
    case 'rapidFire':
      return 0x7dffb5;
  }
}

function flame(g: G, x: number, y: number, s: number, color: number, core: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.55, y - s * 0.1);
  g.lineTo(x + s * 0.5, y + s * 0.45);
  g.lineTo(x, y + s * 0.75);
  g.lineTo(x - s * 0.5, y + s * 0.45);
  g.lineTo(x - s * 0.55, y - s * 0.1);
  g.lineTo(x - s * 0.15, y - s * 0.35);
  g.closePath();
  g.fillPath();
  g.fillStyle(core, 1);
  g.beginPath();
  g.moveTo(x, y - s * 0.15);
  g.lineTo(x + s * 0.25, y + s * 0.35);
  g.lineTo(x, y + s * 0.6);
  g.lineTo(x - s * 0.25, y + s * 0.35);
  g.closePath();
  g.fillPath();
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

function bolt(g: G, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x + s * 0.2, y - s);
  g.lineTo(x - s * 0.5, y + s * 0.1);
  g.lineTo(x - s * 0.05, y + s * 0.1);
  g.lineTo(x - s * 0.25, y + s);
  g.lineTo(x + s * 0.5, y - s * 0.15);
  g.lineTo(x + s * 0.05, y - s * 0.15);
  g.closePath();
  g.fillPath();
}

/** Draw a compact geometric icon for an element or modifier, centred at (x, y). */
export function drawIcon(g: G, id: UpgradeId, x: number, y: number, s: number, alpha = 1): void {
  const c = iconColor(id);
  g.lineStyle(Math.max(2, s * 0.14), c, alpha);
  switch (id) {
    case 'fire':
      flame(g, x, y, s, ELEMENT_COLORS.fire.main, ELEMENT_COLORS.fire.core);
      break;
    case 'water':
      droplet(g, x, y, s, ELEMENT_COLORS.water.main, ELEMENT_COLORS.water.core);
      break;
    case 'lightning':
      bolt(g, x, y, s, ELEMENT_COLORS.lightning.main);
      break;
    case 'ricochet': {
      g.beginPath();
      g.moveTo(x - s * 0.9, y + s * 0.8);
      g.lineTo(x - s * 0.1, y - s * 0.2);
      g.lineTo(x + s * 0.3, y + s * 0.3);
      g.lineTo(x + s * 0.9, y - s * 0.8);
      g.strokePath();
      g.lineBetween(x - s, y - s, x - s, y + s);
      g.lineBetween(x + s, y - s, x + s, y + s);
      break;
    }
    case 'splitShot': {
      g.lineBetween(x, y + s, x, y - s);
      g.lineBetween(x, y + s, x - s * 0.7, y - s * 0.75);
      g.lineBetween(x, y + s, x + s * 0.7, y - s * 0.75);
      g.fillStyle(c, alpha);
      g.fillCircle(x, y - s, s * 0.18);
      g.fillCircle(x - s * 0.7, y - s * 0.75, s * 0.14);
      g.fillCircle(x + s * 0.7, y - s * 0.75, s * 0.14);
      break;
    }
    case 'flashover': {
      g.fillStyle(c, alpha);
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 === 0 ? s : s * 0.45;
        pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.fillPoints(toPoints(pts), true);
      g.fillStyle(0xfff0c0, alpha);
      g.fillCircle(x, y, s * 0.3);
      break;
    }
    case 'stormRelay': {
      bolt(g, x, y, s * 0.7, c);
      g.lineStyle(Math.max(2, s * 0.1), c, alpha);
      g.strokeCircle(x - s * 0.75, y + s * 0.65, s * 0.22);
      g.strokeCircle(x + s * 0.75, y + s * 0.65, s * 0.22);
      break;
    }
    case 'widerSplash': {
      g.strokeCircle(x, y, s * 0.35);
      g.lineStyle(Math.max(2, s * 0.1), c, alpha * 0.75);
      g.strokeCircle(x, y, s * 0.68);
      g.lineStyle(Math.max(2, s * 0.08), c, alpha * 0.5);
      g.strokeCircle(x, y, s);
      break;
    }
    case 'rapidFire': {
      for (const off of [-0.45, 0.15]) {
        g.beginPath();
        g.moveTo(x - s * 0.7, y + s * (off + 0.45));
        g.lineTo(x, y + s * (off - 0.25));
        g.lineTo(x + s * 0.7, y + s * (off + 0.45));
        g.strokePath();
      }
      break;
    }
  }
}

function toPoints(flat: number[]): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  return out;
}

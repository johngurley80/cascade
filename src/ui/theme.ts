import type { EnemyKind } from '../config';
import type { Element } from '../logic/types';

export const COLORS = {
  margin: 0x04070f,
  arena: 0x0b1430,
  arenaDeep: 0x08102a,
  grid: 0x14214a,
  panel: 0x0d1736,
  panelEdge: 0x2a3a72,
  panelHi: 0x3c5199,
  text: 0xe6ecff,
  textDim: 0x8a96c4,
  danger: 0xff4d6d,
  good: 0x6dffb0,
  gold: 0xffd166,
  steam: 0xeaf6ff,
  white: 0xffffff,
} as const;

export const ELEMENT_COLORS: Record<Element, { main: number; core: number; dark: number; css: string }> = {
  fire: { main: 0xff7a2b, core: 0xffe0a0, dark: 0x5a2208, css: '#ff7a2b' },
  water: { main: 0x3db8ff, core: 0xd2f1ff, dark: 0x0b3a5c, css: '#3db8ff' },
  lightning: { main: 0xffe94a, core: 0xffffff, dark: 0x5a5208, css: '#ffe94a' },
};

export const ENEMY_COLORS: Record<EnemyKind, { fill: number; edge: number }> = {
  basic: { fill: 0x3b2a6e, edge: 0xb48cff },
  fast: { fill: 0x5a1838, edge: 0xff5fa2 },
  tank: { fill: 0x15493d, edge: 0x5ef0c0 },
  boss: { fill: 0x4a0f24, edge: 0xff3d6e },
};

export const FONT = '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

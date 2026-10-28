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
  frost: { main: 0xa8f4ff, core: 0xf4feff, dark: 0x1d4a5a, css: '#a8f4ff' },
  wind: { main: 0x8dffc4, core: 0xf0fff6, dark: 0x174634, css: '#8dffc4' },
  toxin: { main: 0xb4ff2e, core: 0xeeffc4, dark: 0x2e4a08, css: '#b4ff2e' },
  void: { main: 0xb46bff, core: 0xf0dcff, dark: 0x2e1452, css: '#b46bff' },
};

/**
 * Enemies use a silver/rose/bronze family so they never read as an element.
 * `core` is the glowing heart drawn inside each silhouette.
 */
export const ENEMY_COLORS: Record<EnemyKind, { fill: number; edge: number; core: number }> = {
  basic: { fill: 0x262b4e, edge: 0xd4daff, core: 0xff7aa8 },
  fast: { fill: 0x45162e, edge: 0xff7eb0, core: 0xffd0e0 },
  tank: { fill: 0x352d1c, edge: 0xe8c27a, core: 0xfff0c0 },
  splitter: { fill: 0x2a2450, edge: 0xc9b8ff, core: 0xff7aa8 },
  splitling: { fill: 0x3a1a3a, edge: 0xff9ec4, core: 0xffe0ee },
  volatile: { fill: 0x4a1414, edge: 0xff5a4a, core: 0xffd27a },
  hive: { fill: 0x3d1430, edge: 0xff6fae, core: 0xffd0e6 },
  aegis: { fill: 0x18264a, edge: 0xe8f0ff, core: 0x9fdcff },
  monolith: { fill: 0x2a0f1e, edge: 0xff3d6e, core: 0xffc2d4 },
};

export const TRAIT_COLORS = {
  shield: 0xbfe9ff,
  insulated: 0xffb347,
  fireproof: 0xff7a2b,
  elite: 0xffd166,
} as const;

/** Arena background per act (endless cycles through them). */
export const ACT_PALETTES: { arena: number; deep: number; grid: number; name: string }[] = [
  { arena: 0x0b1430, deep: 0x08102a, grid: 0x14214a, name: 'Act I' },
  { arena: 0x0a1d2a, deep: 0x061622, grid: 0x123244, name: 'Act II' },
  { arena: 0x1a0f2c, deep: 0x120a22, grid: 0x2a1a44, name: 'Act III' },
];

export function paletteForAct(act: number): (typeof ACT_PALETTES)[number] {
  return ACT_PALETTES[(Math.max(1, act) - 1) % ACT_PALETTES.length];
}

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

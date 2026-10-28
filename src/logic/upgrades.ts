import { ELEMENTS, PLAYER } from '../config';
import { Rng } from './rng';
import type { Element, ModifierId, UpgradeId } from './types';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  kind: 'element' | 'modifier';
  maxLevel: number;
  /** Short rules text shown on the upgrade card. */
  description: string;
  /** Short tag used in the HUD and share text. */
  short: string;
  emoji: string;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  fire: {
    id: 'fire',
    name: 'Fire',
    kind: 'element',
    maxLevel: 1,
    description: 'Damage + short burn. Hitting a WET enemy consumes wet → steam burst damages nearby enemies.',
    short: 'FIR',
    emoji: '🔥',
  },
  water: {
    id: 'water',
    name: 'Water',
    kind: 'element',
    maxLevel: 1,
    description: 'Low damage. Wets the target and splashes WET onto nearby enemies. Does not put out burn.',
    short: 'WAT',
    emoji: '💧',
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    kind: 'element',
    maxLevel: 1,
    description: 'Direct damage. On a WET enemy, chains to up to 4 more nearby WET enemies.',
    short: 'LIT',
    emoji: '⚡',
  },
  ricochet: {
    id: 'ricochet',
    name: 'Ricochet',
    kind: 'modifier',
    maxLevel: 1,
    description: `Shots bounce off the side walls, up to ${PLAYER.ricochetBounces} times.`,
    short: 'RIC',
    emoji: '↔️',
  },
  splitShot: {
    id: 'splitShot',
    name: 'Split Shot',
    kind: 'modifier',
    maxLevel: 1,
    description: 'Every volley adds 2 weaker angled shots.',
    short: 'SPL',
    emoji: '✂️',
  },
  flashover: {
    id: 'flashover',
    name: 'Flashover',
    kind: 'modifier',
    maxLevel: 1,
    description: 'Enemies defeated while BURNING explode, igniting enemies nearby (and steaming wet ones).',
    short: 'FLA',
    emoji: '💥',
  },
  stormRelay: {
    id: 'stormRelay',
    name: 'Storm Relay',
    kind: 'modifier',
    maxLevel: 1,
    description: 'Enemies defeated by lightning arc a weaker chain to the 2 nearest enemies — wet or not.',
    short: 'STR',
    emoji: '🌩️',
  },
  widerSplash: {
    id: 'widerSplash',
    name: 'Wider Splash',
    kind: 'modifier',
    maxLevel: 2,
    description: `Water splash radius +${ELEMENTS.water.splashRadiusPerLevel} (wets more of a formation).`,
    short: 'WSP',
    emoji: '🌊',
  },
  rapidFire: {
    id: 'rapidFire',
    name: 'Rapid Fire',
    kind: 'modifier',
    maxLevel: 3,
    description: `Fire rate +${Math.round((1 / PLAYER.rapidFireIntervalMult - 1) * 100)}%.`,
    short: 'RPD',
    emoji: '⏩',
  },
};

export const MODIFIER_IDS: readonly ModifierId[] = [
  'ricochet',
  'splitShot',
  'flashover',
  'stormRelay',
  'widerSplash',
  'rapidFire',
];

export interface Loadout {
  elements: Set<Element>;
  levels: Record<ModifierId, number>;
}

export function createLoadout(): Loadout {
  return {
    elements: new Set<Element>(['fire']),
    levels: { ricochet: 0, splitShot: 0, flashover: 0, stormRelay: 0, widerSplash: 0, rapidFire: 0 },
  };
}

export function levelOf(loadout: Loadout, id: UpgradeId): number {
  if (UPGRADE_DEFS[id].kind === 'element') return loadout.elements.has(id as Element) ? 1 : 0;
  return loadout.levels[id as ModifierId];
}

/** True if the upgrade can still be offered: not taken (or not yet at max level). */
export function isAvailable(loadout: Loadout, id: UpgradeId): boolean {
  return levelOf(loadout, id) < UPGRADE_DEFS[id].maxLevel;
}

/** Apply an upgrade. Returns the new level. Throws if it is unavailable. */
export function applyUpgrade(loadout: Loadout, id: UpgradeId): number {
  if (!isAvailable(loadout, id)) throw new Error(`Upgrade ${id} is not available`);
  const def = UPGRADE_DEFS[id];
  if (def.kind === 'element') {
    loadout.elements.add(id as Element);
    return 1;
  }
  loadout.levels[id as ModifierId] += 1;
  return loadout.levels[id as ModifierId];
}

export function missingElements(loadout: Loadout): Element[] {
  return (['water', 'lightning'] as Element[]).filter((e) => !loadout.elements.has(e));
}

/**
 * Elements granted automatically when a wave is cleared: after wave 3 any
 * element not yet taken is granted, so all three are available by wave 4.
 */
export function elementsToGrantAfterWave(completedWave: number, loadout: Loadout): Element[] {
  return completedWave >= 3 ? missingElements(loadout) : [];
}

/**
 * Build the choices offered after `completedWave`.
 * - After wave 1: the player picks Water or Lightning.
 * - After wave 2: the element not yet taken is guaranteed among the three choices.
 * - Later: three random modifiers that are neither taken nor maxed.
 */
export function buildOffer(completedWave: number, loadout: Loadout, rng: Rng, size = 3): UpgradeId[] {
  const missing = missingElements(loadout);
  if (completedWave === 1 && missing.length === 2) return [...missing];

  const offer: UpgradeId[] = [];
  if (completedWave <= 2) offer.push(...missing.slice(0, size));

  const pool: UpgradeId[] = MODIFIER_IDS.filter((id) => isAvailable(loadout, id));
  while (offer.length < size && pool.length > 0) {
    const index = Math.floor(rng.next() * pool.length);
    offer.push(pool.splice(index, 1)[0]);
  }
  return offer;
}

export function fireInterval(loadout: Loadout): number {
  return PLAYER.fireInterval * Math.pow(PLAYER.rapidFireIntervalMult, loadout.levels.rapidFire);
}

export function splashRadius(loadout: Loadout): number {
  return ELEMENTS.water.splashRadius + ELEMENTS.water.splashRadiusPerLevel * loadout.levels.widerSplash;
}

/** Grant everything (used by the `unlock=all` test parameter). */
export function unlockAll(loadout: Loadout): void {
  loadout.elements = new Set<Element>(['fire', 'water', 'lightning']);
  for (const id of MODIFIER_IDS) loadout.levels[id] = UPGRADE_DEFS[id].maxLevel;
}

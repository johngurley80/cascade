import { ELEMENTS, PLAYER, UPGRADES } from '../config';
import { partnersOf } from './codex';
import { Rng } from './rng';
import { ALL_ELEMENTS, type Element, type ModifierId, type UpgradeId } from './types';

export type Rarity = 'element' | 'common' | 'rare' | 'combo';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  kind: 'element' | 'modifier';
  rarity: Rarity;
  maxLevel: number;
  /** Short rules text shown on the upgrade card. */
  description: string;
  /** Short tag used in the HUD. */
  short: string;
  emoji: string;
  /** Elements that must all be owned before this is offered. */
  requires?: Element[];
}

const el = (id: Element, name: string, emoji: string, description: string): UpgradeDef => ({
  id,
  name,
  kind: 'element',
  rarity: 'element',
  maxLevel: 1,
  description,
  short: name.slice(0, 3).toUpperCase(),
  emoji,
});

const mod = (
  id: ModifierId,
  name: string,
  short: string,
  emoji: string,
  rarity: Exclude<Rarity, 'element'>,
  maxLevel: number,
  description: string,
  requires?: Element[],
): UpgradeDef => ({ id, name, kind: 'modifier', rarity, maxLevel, description, short, emoji, requires });

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  fire: el('fire', 'Fire', '🔥', 'Damage + short burn. On WET → Steam burst. On POISONED → Gas ignition. Thaws frozen enemies.'),
  water: el('water', 'Water', '💧', 'Low damage. Wets the target and splashes WET onto nearby enemies. Shatters frozen enemies.'),
  lightning: el('lightning', 'Lightning', '⚡', `Direct damage. On WET → chains to ${ELEMENTS.lightning.chainTargets} more wet enemies. On BURNING → Overload blast.`),
  frost: el('frost', 'Frost', '❄️', 'Chills (slows). On WET → freezes solid; any later hit Shatters it. On BURNING → Thermal shock.'),
  wind: el('wind', 'Wind', '🌪️', 'A gust pulls nearby enemies together and knocks the target back. Spreads burn and wet.'),
  toxin: el('toxin', 'Toxin', '☠️', 'Poison: damage over time, +30% damage taken, eats shields. Fire ignites it; Frost makes it brittle.'),
  void: el('void', 'Void', '🌀', 'Opens a singularity that drags enemies in, then collapses. Lightning arcs through it.'),

  ricochet: mod('ricochet', 'Ricochet', 'RIC', '↔️', 'common', 1, `Shots bounce off the side walls, up to ${PLAYER.ricochetBounces} times.`),
  splitShot: mod('splitShot', 'Split Shot', 'SPL', '✂️', 'common', 1, 'Every volley adds 2 weaker angled shots.'),
  rapidFire: mod('rapidFire', 'Rapid Fire', 'RPD', '⏩', 'common', 3, `Fire rate +${Math.round((1 / PLAYER.rapidFireIntervalMult - 1) * 100)}%.`),
  piercing: mod('piercing', 'Piercing', 'PRC', '📌', 'common', 1, `Shots pass through and can hit ${PLAYER.piercingHits} enemies.`),
  overcharge: mod('overcharge', 'Overcharge', 'OVR', '🔋', 'common', 5, `All damage +${Math.round(PLAYER.overchargePerLevel * 100)}%.`),
  repair: mod('repair', 'Repair', 'REP', '❤️', 'common', 99, 'Restore 1 health.'),
  catalyst: mod('catalyst', 'Catalyst', 'CAT', '🧪', 'rare', 1, 'Chain reactions can go one generation deeper.'),

  flashover: mod('flashover', 'Flashover', 'FLA', '💥', 'rare', 1, 'Enemies defeated while BURNING explode, igniting enemies nearby.', ['fire']),
  stormRelay: mod('stormRelay', 'Storm Relay', 'STR', '🌩️', 'rare', 1, 'Enemies defeated by lightning arc a weaker chain to the 2 nearest enemies — wet or not.', ['lightning']),
  widerSplash: mod('widerSplash', 'Wider Splash', 'WSP', '🌊', 'rare', 2, `Water splash radius +${ELEMENTS.water.splashRadiusPerLevel}.`, ['water']),
  longChain: mod('longChain', 'Long Chain', 'LCH', '🔗', 'rare', 1, `Lightning chains reach ${ELEMENTS.lightning.longChainBonus} more enemies.`, ['lightning']),
  bigSteam: mod('bigSteam', 'Pressure Cooker', 'PRS', '♨️', 'rare', 1, 'Steam bursts and clouds are 30% bigger and last longer.', ['fire', 'water']),
  deepFreeze: mod('deepFreeze', 'Deep Freeze', 'DPF', '🧊', 'rare', 1, 'Freezes and chills last 60% longer; shatters reach 30% further.', ['frost']),
  galeForce: mod('galeForce', 'Gale Force', 'GAL', '🍃', 'rare', 2, `Wind gusts reach ${Math.round(ELEMENTS.wind.galeForcePerLevel * 100)}% further and pull harder.`, ['wind']),
  virulence: mod('virulence', 'Virulence', 'VIR', '🦠', 'rare', 1, 'Poisoned enemies pass their poison to 2 neighbours when defeated.', ['toxin']),
  eventHorizon: mod('eventHorizon', 'Event Horizon', 'EVH', '🕳️', 'rare', 2, 'Singularities are 25% bigger and last longer.', ['void']),

  superheatedSteam: mod('superheatedSteam', 'Superheated Steam', 'SHS', '🌋', 'combo', 1, 'Steam bursts set everything they hit on fire.', ['fire', 'water']),
  permafrost: mod('permafrost', 'Permafrost', 'PMF', '🏔️', 'combo', 1, 'Shatter shards chill everything and freeze wet enemies.', ['frost', 'water']),
  toxicStorm: mod('toxicStorm', 'Toxic Storm', 'TXS', '☣️', 'combo', 1, 'A gust on a poisoned enemy spreads poison to everything it pulls in.', ['wind', 'toxin']),
  plasmaArc: mod('plasmaArc', 'Plasma Arc', 'PLA', '🔆', 'combo', 1, 'Chain lightning ignites every enemy it passes through.', ['lightning', 'fire']),
  gravityWell: mod('gravityWell', 'Gravity Well', 'GRV', '🪐', 'combo', 1, 'A gust inside a singularity collapses it at once for double damage.', ['wind', 'void']),
  acidRain: mod('acidRain', 'Acid Rain', 'ACD', '🌧️', 'combo', 1, 'Water splashes poison everything they wet.', ['water', 'toxin']),
};

export const MODIFIER_IDS = Object.values(UPGRADE_DEFS)
  .filter((d) => d.kind === 'modifier')
  .map((d) => d.id as ModifierId);

export interface Loadout {
  /** Owned elements, in the order they were acquired (= key 1, 2, 3, 4). */
  elements: Element[];
  levels: Record<ModifierId, number>;
}

export function createLoadout(): Loadout {
  const levels = Object.fromEntries(MODIFIER_IDS.map((id) => [id, 0])) as Record<ModifierId, number>;
  return { elements: [], levels };
}

export function hasElement(loadout: Loadout, element: Element): boolean {
  return loadout.elements.includes(element);
}

export function levelOf(loadout: Loadout, id: UpgradeId): number {
  if (UPGRADE_DEFS[id].kind === 'element') return hasElement(loadout, id as Element) ? 1 : 0;
  return loadout.levels[id as ModifierId];
}

export interface OfferContext {
  health: number;
  maxHealth: number;
  /** Ignore the element slot limit (unlock=all testing). */
  unlimitedSlots?: boolean;
}

/** True if the upgrade can be offered: not taken, not maxed, prerequisites owned, a slot free. */
export function isAvailable(loadout: Loadout, id: UpgradeId, ctx?: OfferContext): boolean {
  const def = UPGRADE_DEFS[id];
  if (def.kind === 'element') {
    return !hasElement(loadout, id as Element) && (ctx?.unlimitedSlots || loadout.elements.length < PLAYER.elementSlots);
  }
  if (levelOf(loadout, id) >= def.maxLevel) return false;
  if (def.requires && !def.requires.every((e) => hasElement(loadout, e))) return false;
  if (id === 'repair') return ctx !== undefined && ctx.health < ctx.maxHealth;
  return true;
}

/** Apply an upgrade. Returns the new level. Throws if it is unavailable. */
export function applyUpgrade(loadout: Loadout, id: UpgradeId, ctx?: OfferContext): number {
  if (!isAvailable(loadout, id, ctx ?? { health: 0, maxHealth: 1, unlimitedSlots: true })) {
    throw new Error(`Upgrade ${id} is not available`);
  }
  if (UPGRADE_DEFS[id].kind === 'element') {
    loadout.elements.push(id as Element);
    return 1;
  }
  loadout.levels[id as ModifierId] += 1;
  return loadout.levels[id as ModifierId];
}

export type OfferKind = 'start' | 'element' | 'modifier';

/** What the player chooses after clearing `completedWave` (0 = before the run starts). */
export function offerKindAfterWave(completedWave: number, loadout: Loadout): OfferKind {
  if (completedWave === 0 || loadout.elements.length === 0) return 'start';
  if (PLAYER.elementPickAfterWaves.includes(completedWave) && loadout.elements.length < PLAYER.elementSlots) return 'element';
  return 'modifier';
}

/** Elements not yet owned. */
export function missingElements(loadout: Loadout): Element[] {
  return ALL_ELEMENTS.filter((e) => !hasElement(loadout, e));
}

/**
 * Element choices: three elements you don't have, at least one of which
 * reacts directly with something you already own.
 */
export function buildElementOffer(loadout: Loadout, rng: Rng, size: number = UPGRADES.offerSize): Element[] {
  const remaining = missingElements(loadout);
  if (remaining.length <= size) return remaining;
  const partners = remaining.filter((e) => loadout.elements.some((owned) => partnersOf(owned).includes(e)));
  const offer: Element[] = [];
  if (partners.length > 0) offer.push(partners[Math.floor(rng.next() * partners.length)]);
  const pool = remaining.filter((e) => !offer.includes(e));
  while (offer.length < size && pool.length > 0) offer.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return offer;
}

/** Modifier choices: weighted by rarity, never taken/maxed, prerequisites satisfied. */
export function buildModifierOffer(loadout: Loadout, rng: Rng, ctx: OfferContext, size: number = UPGRADES.offerSize): ModifierId[] {
  const pool = MODIFIER_IDS.filter((id) => isAvailable(loadout, id, ctx));
  const offer: ModifierId[] = [];
  while (offer.length < size && pool.length > 0) {
    const weights = pool.map((id) => UPGRADES.rarityWeight[UPGRADE_DEFS[id].rarity as 'common' | 'rare' | 'combo']);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    let index = 0;
    while (index < pool.length - 1 && roll >= weights[index]) {
      roll -= weights[index];
      index++;
    }
    offer.push(pool.splice(index, 1)[0]);
  }
  return offer;
}

/** The full offer after `completedWave`. */
export function buildOffer(completedWave: number, loadout: Loadout, rng: Rng, ctx: OfferContext): UpgradeId[] {
  switch (offerKindAfterWave(completedWave, loadout)) {
    case 'start':
      return [...ALL_ELEMENTS];
    case 'element':
      return buildElementOffer(loadout, rng);
    case 'modifier':
      return buildModifierOffer(loadout, rng, ctx);
  }
}

/** Multiplier applied to every barrel's fire interval (Rapid Fire). */
export function rapidFireMult(loadout: Loadout): number {
  return Math.pow(PLAYER.rapidFireIntervalMult, loadout.levels.rapidFire);
}

/** Grant everything (used by the `unlock=all` test parameter). */
export function unlockAll(loadout: Loadout): void {
  loadout.elements = [...ALL_ELEMENTS];
  for (const id of MODIFIER_IDS) loadout.levels[id] = id === 'repair' ? 0 : UPGRADE_DEFS[id].maxLevel;
}

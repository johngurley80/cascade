import { ELEMENTS } from '../config';
import type { Element, ModifierId, ReactionId } from './types';

export interface ReactionInfo {
  id: ReactionId;
  name: string;
  /** Short "A + B" recipe shown in the codex. */
  recipe: string;
  description: string;
  /** Elements involved (for icons and undiscovered hints). */
  elements: Element[];
  /** Upgrade needed before this reaction can happen at all. */
  requires?: ModifierId;
  /** Enemy mechanic rather than an elemental combination. */
  enemy?: boolean;
}

/** Every reaction in the game, in codex order. */
export const REACTION_INFO: readonly ReactionInfo[] = [
  { id: 'steam', name: 'Steam', recipe: 'Fire → Wet', elements: ['fire', 'water'], description: 'Consumes wet; a burst of steam damages everything nearby and leaves a cloud.' },
  { id: 'chain', name: 'Chain Lightning', recipe: 'Lightning → Wet', elements: ['lightning', 'water'], description: `Arcs to up to ${ELEMENTS.lightning.chainTargets} more wet enemies, each hit once.` },
  { id: 'overload', name: 'Overload', recipe: 'Lightning → Burning', elements: ['lightning', 'fire'], description: 'The flames short-circuit into an electric explosion.' },
  { id: 'conductive', name: 'Conductive Steam', recipe: 'Lightning → Steam cloud', elements: ['lightning', 'fire', 'water'], description: 'Enemies inside a steam cloud conduct lightning as if they were wet.' },
  { id: 'freeze', name: 'Freeze', recipe: 'Frost → Wet', elements: ['frost', 'water'], description: 'Consumes wet and freezes the enemy solid.' },
  { id: 'shatter', name: 'Shatter', recipe: 'Hit → Frozen', elements: ['frost'], description: 'Any non-fire hit on a frozen enemy shatters it into damaging shards.' },
  { id: 'thaw', name: 'Thaw', recipe: 'Fire → Frozen', elements: ['fire', 'frost'], description: 'The ice melts and the enemy is wet again — ready for steam or chains.' },
  { id: 'thermalShock', name: 'Thermal Shock', recipe: 'Frost → Burning', elements: ['frost', 'fire'], description: 'Puts out the flames for a burst of bonus damage.' },
  { id: 'firestorm', name: 'Firestorm', recipe: 'Wind → Burning', elements: ['wind', 'fire'], description: 'The gust carries the flames to every enemy it pulls in.' },
  { id: 'squall', name: 'Squall', recipe: 'Wind → Wet', elements: ['wind', 'water'], description: 'Spray from the gust wets a wide area.' },
  { id: 'steamFront', name: 'Steam Front', recipe: 'Wind → Steam cloud', elements: ['wind', 'fire', 'water'], description: 'The gust spreads a steam cloud much wider and keeps it alive longer.' },
  { id: 'ignition', name: 'Gas Ignition', recipe: 'Fire → Poisoned', elements: ['fire', 'toxin'], description: 'The toxic gas ignites in a large, burning explosion.' },
  { id: 'brittle', name: 'Brittle Freeze', recipe: 'Frost → Poisoned', elements: ['frost', 'toxin'], description: 'Freezes instantly — and the next shatter does double damage.' },
  { id: 'toxicSplash', name: 'Toxic Splash', recipe: 'Water → Poisoned', elements: ['water', 'toxin'], description: 'The splash carries the poison to every enemy it wets.' },
  { id: 'arcStorm', name: 'Arc Storm', recipe: 'Lightning → Singularity', elements: ['lightning', 'void'], description: 'Lightning arcs to everything caught in a singularity, wet or not.' },
  { id: 'flashover', name: 'Flashover', recipe: 'Defeat while burning', elements: ['fire'], requires: 'flashover', description: 'Burning enemies explode when defeated, igniting others.' },
  { id: 'stormRelay', name: 'Storm Relay', recipe: 'Defeat by lightning', elements: ['lightning'], requires: 'stormRelay', description: 'Enemies defeated by lightning arc to the 2 nearest enemies.' },
  { id: 'detonation', name: 'Detonation', recipe: 'Defeat a Volatile', elements: [], enemy: true, description: 'Volatile enemies explode when defeated, damaging their neighbours.' },
  { id: 'superheatedSteam', name: 'Superheated Steam', recipe: 'Steam + upgrade', elements: ['fire', 'water'], requires: 'superheatedSteam', description: 'Steam bursts set everything they hit on fire.' },
  { id: 'permafrost', name: 'Permafrost', recipe: 'Shatter + upgrade', elements: ['frost', 'water'], requires: 'permafrost', description: 'Shatter shards chill everything and freeze wet enemies.' },
  { id: 'toxicStorm', name: 'Toxic Storm', recipe: 'Wind → Poisoned', elements: ['wind', 'toxin'], requires: 'toxicStorm', description: 'A gust on a poisoned enemy spreads the poison to everything it pulls in.' },
  { id: 'plasmaArc', name: 'Plasma Arc', recipe: 'Chain + upgrade', elements: ['lightning', 'fire'], requires: 'plasmaArc', description: 'Chain lightning ignites every enemy it passes through.' },
  { id: 'gravityWell', name: 'Gravity Well', recipe: 'Wind → Singularity', elements: ['wind', 'void'], requires: 'gravityWell', description: 'A gust inside a singularity collapses it at once for double damage.' },
  { id: 'acidRain', name: 'Acid Rain', recipe: 'Splash + upgrade', elements: ['water', 'toxin'], requires: 'acidRain', description: 'Water splashes poison everything they wet.' },
];

export const REACTION_BY_ID: Record<ReactionId, ReactionInfo> = Object.fromEntries(
  REACTION_INFO.map((r) => [r.id, r]),
) as Record<ReactionId, ReactionInfo>;

/** Pairs of elements that react with each other directly (used to guarantee useful element offers). */
export function partnersOf(element: Element): Element[] {
  const out = new Set<Element>();
  for (const r of REACTION_INFO) {
    if (r.requires || r.enemy || r.elements.length !== 2 || !r.elements.includes(element)) continue;
    for (const e of r.elements) if (e !== element) out.add(e);
  }
  // Wind and Void also combine through Gravity Well, Void has no other pairing besides Arc Storm.
  if (element === 'wind') out.add('void');
  if (element === 'void') out.add('wind');
  return [...out];
}

/** Merge newly discovered reactions into a known set. Returns the ids that are new. */
export function discover(known: Set<ReactionId>, ids: Iterable<ReactionId>): ReactionId[] {
  const fresh: ReactionId[] = [];
  for (const id of ids) {
    if (!known.has(id)) {
      known.add(id);
      fresh.push(id);
    }
  }
  return fresh;
}

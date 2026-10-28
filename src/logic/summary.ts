import { MODIFIER_IDS, UPGRADE_DEFS, type Loadout } from './upgrades';
import { ELEMENT_ORDER } from './types';

export interface SummaryInput {
  victory: boolean;
  wave: number;
  largestCascade: number;
  loadout: Loadout;
  dailyKey?: string | null;
}

/** One-line shareable result, e.g. `Cascade — Wave 8 ✅ | Biggest cascade: 17 | 🔥💧⚡ ↔️✂️💥`. */
export function resultSummary(input: SummaryInput): string {
  const elements = ELEMENT_ORDER.filter((e) => input.loadout.elements.has(e))
    .map((e) => UPGRADE_DEFS[e].emoji)
    .join('');
  const mods = MODIFIER_IDS.filter((id) => input.loadout.levels[id] > 0)
    .map((id) => UPGRADE_DEFS[id].emoji.repeat(input.loadout.levels[id]))
    .join('');
  const title = input.dailyKey ? `Cascade Daily ${input.dailyKey}` : 'Cascade';
  const mark = input.victory ? '✅' : '❌';
  const kit = mods ? `${elements} ${mods}` : elements;
  return `${title} — Wave ${input.wave} ${mark} | Biggest cascade: ${input.largestCascade} | ${kit}`;
}

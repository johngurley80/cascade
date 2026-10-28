import { MODIFIER_IDS, UPGRADE_DEFS, type Loadout } from './upgrades';

export interface SummaryInput {
  victory: boolean;
  wave: number;
  score: number;
  largestCascade: number;
  loadout: Loadout;
  dailyKey?: string | null;
  endless?: boolean;
}

/** One-line shareable result, e.g. `Cascade — Wave 15 ✅ | Score 12,340 | Biggest cascade: 17 | 🔥💧⚡❄️ ↔️✂️💥`. */
export function resultSummary(input: SummaryInput): string {
  const elements = input.loadout.elements.map((e) => UPGRADE_DEFS[e].emoji).join('');
  const mods = MODIFIER_IDS.filter((id) => input.loadout.levels[id] > 0 && id !== 'repair')
    .map((id) => UPGRADE_DEFS[id].emoji)
    .join('');
  const title = input.dailyKey ? `Cascade Daily ${input.dailyKey}` : input.endless ? 'Cascade Endless' : 'Cascade';
  const mark = input.endless ? '♾️' : input.victory ? '✅' : '❌';
  const kit = mods ? `${elements} ${mods}` : elements;
  const score = input.score.toLocaleString('en-US');
  return `${title} — Wave ${input.wave} ${mark} | Score ${score} | Biggest cascade: ${input.largestCascade} | ${kit}`;
}

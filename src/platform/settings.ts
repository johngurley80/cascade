import { sfx } from '../audio/Sfx';
import { loadSettings, saveSettings, type Settings } from './storage';

/** Shared, persisted user settings. */
export const settings: Settings = loadSettings();
sfx.setMuted(settings.muted);

export function setMuted(muted: boolean): void {
  settings.muted = muted;
  sfx.setMuted(muted);
  saveSettings(settings);
}

export function setReducedEffects(reduced: boolean): void {
  settings.reducedEffects = reduced;
  saveSettings(settings);
}

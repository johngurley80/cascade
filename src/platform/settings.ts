import { music } from '../audio/Music';
import { sfx } from '../audio/Sfx';
import { loadSettings, saveSettings, type Settings } from './storage';

/** Shared, persisted user settings. */
export const settings: Settings = loadSettings();
sfx.setMuted(settings.muted);

/** Call from any user gesture: creates/resumes audio and starts the music if it's on. */
export function unlockAudio(): void {
  sfx.unlock();
  if (settings.music) music.start();
}

export function setMuted(muted: boolean): void {
  settings.muted = muted;
  sfx.setMuted(muted);
  saveSettings(settings);
}

export function setMusic(on: boolean): void {
  settings.music = on;
  music.setEnabled(on);
  saveSettings(settings);
}

export function setReducedEffects(reduced: boolean): void {
  settings.reducedEffects = reduced;
  saveSettings(settings);
}

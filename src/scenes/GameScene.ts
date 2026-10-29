import Phaser from 'phaser';
import { music } from '../audio/Music';
import { sfx, type SoundName } from '../audio/Sfx';
import { FX, WAVES, WORLD } from '../config';
import { REACTION_BY_ID, REACTION_INFO } from '../logic/codex';
import { insertEntry, type RunMode } from '../logic/records';
import { isBoss } from '../logic/status';
import { resultSummary } from '../logic/summary';
import type { BlastKind, Element, GameEvent, ReactionId } from '../logic/types';
import { MODIFIER_IDS, UPGRADE_DEFS, offerKindAfterWave } from '../logic/upgrades';
import { World } from '../logic/world';
import { setMusic, setMuted, setReducedEffects, settings, unlockAudio } from '../platform/settings';
import {
  clearRun,
  loadBest,
  loadCodex,
  loadLeaderboard,
  recordRun,
  saveCodex,
  saveLeaderboard,
  saveRun,
  type BestRecord,
} from '../platform/storage';
import { ArenaRenderer } from '../render/ArenaRenderer';
import { Effects } from '../render/Effects';
import { Hud } from '../ui/Hud';
import { Overlay } from '../ui/Overlay';
import { ReplayView } from '../ui/ReplayView';
import { UpgradePanel } from '../ui/UpgradePanel';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS } from '../ui/theme';
import { isTestRun, restartConfig, type RunConfig } from './RunConfig';

const SHOT_SOUND: Record<Element, SoundName> = {
  fire: 'shotFire',
  water: 'shotWater',
  lightning: 'shotLightning',
  frost: 'shotFrost',
  wind: 'shotWind',
  toxin: 'shotToxin',
  void: 'shotVoid',
};
const RELAY_COLOR = 0xc9b2ff;

const BLAST_STYLE: Record<BlastKind, { color: number; core: number; sound: SoundName; shake: number }> = {
  steam: { color: COLORS.steam, core: ELEMENT_COLORS.water.core, sound: 'steam', shake: 0.8 },
  flashover: { color: ELEMENT_COLORS.fire.main, core: ELEMENT_COLORS.lightning.main, sound: 'flashover', shake: 1 },
  ignition: { color: ELEMENT_COLORS.toxin.main, core: ELEMENT_COLORS.fire.main, sound: 'ignition', shake: 1.3 },
  shatter: { color: ELEMENT_COLORS.frost.main, core: 0xffffff, sound: 'shatter', shake: 0.7 },
  overload: { color: ELEMENT_COLORS.lightning.main, core: 0xffffff, sound: 'overload', shake: 0.8 },
  detonation: { color: ENEMY_COLORS.volatile.edge, core: ENEMY_COLORS.volatile.core, sound: 'detonation', shake: 1.1 },
  collapse: { color: ELEMENT_COLORS.void.main, core: ELEMENT_COLORS.void.core, sound: 'collapse', shake: 1 },
};

/** Debug/test hook exposed on window (read-only snapshot of the run). */
interface CascadeHook {
  snapshot(): Record<string, unknown>;
}

export class GameScene extends Phaser.Scene {
  private cfg!: RunConfig;
  private world!: World;
  private arena!: ArenaRenderer;
  private effects!: Effects;
  private hud!: Hud;
  private upgradePanel!: UpgradePanel;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private accumulator = 0;
  private paused = false;
  private pauseOverlay: Overlay | null = null;
  private resultOverlay: Overlay | null = null;
  private resultScheduled = false;
  private pendingNotice = '';
  private lastCascadeMilestone = new Map<number, number>();
  private codex = new Set<ReactionId>();
  private hitStop = 0;
  private teardown: (() => void)[] = [];

  constructor() {
    super('game');
  }

  init(cfg: RunConfig): void {
    this.cfg = cfg;
  }

  create(): void {
    // Phaser reuses the scene instance on restart: reset every field here.
    this.accumulator = 0;
    this.paused = false;
    this.pauseOverlay = null;
    this.resultOverlay = null;
    this.resultScheduled = false;
    this.pendingNotice = '';
    this.lastCascadeMilestone = new Map();
    this.codex = loadCodex();
    this.hitStop = 0;
    this.teardown = [];

    if (this.cfg.resume) {
      this.world = World.fromSave(this.cfg.resume.save);
    } else {
      this.world = new World({ seed: this.cfg.seed, startWave: this.cfg.startWave, unlockAll: this.cfg.unlockAll, endless: this.cfg.endless });
      if (!isTestRun(this.cfg)) clearRun();
    }
    this.arena = new ArenaRenderer(this);
    const soft = this.add.graphics().setDepth(15);
    const glow = this.add.graphics().setDepth(35);
    this.effects = new Effects(this, soft, glow);
    this.effects.reduced = settings.reducedEffects;
    const mode = this.cfg.daily ? `DAILY RUN · ${this.cfg.daily}` : this.cfg.endless ? 'ENDLESS' : `seed ${this.cfg.seed}`;
    this.hud = new Hud(this, { onPause: () => this.pause('Paused') }, mode);
    this.upgradePanel = new UpgradePanel(this);
    this.flashRect = this.add.rectangle(0, 0, WORLD.width, WORLD.height, COLORS.danger, 0).setOrigin(0).setDepth(90);

    this.setupInput();
    this.setupFocusHandling();
    this.exposeHook();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // ------------------------------------------------------------------ input

  private inputBlocked(): boolean {
    return this.paused || this.world.phase !== 'playing';
  }

  /** Aim-only input: every element fires on its own. Mouse aims on hover, touch while dragging. */
  private setupInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.inputBlocked()) return;
      if (p.wasTouch && !p.isDown) return;
      if (p.y < WORLD.arenaBottom) this.world.aimAt(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      unlockAudio();
      if (over.length > 0 || this.inputBlocked()) return;
      if (p.y < WORLD.arenaBottom && p.y > WORLD.arenaTop) this.world.aimAt(p.x, p.y);
    });

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (ev: KeyboardEvent) => {
      unlockAudio();
      const key = ev.key.toLowerCase();
      if (this.resultOverlay) {
        if (key === 'r' || key === 'enter') this.restart();
        return;
      }
      if (this.upgradePanel.visible && !this.paused) {
        const n = Number.parseInt(key, 10);
        if (n >= 1 && n <= 9) this.upgradePanel.pick(n - 1);
        if (key === 'r') this.upgradePanel.reroll();
        return;
      }
      if (key === 'p' || key === 'escape') {
        if (this.paused) this.resume();
        else this.pause('Paused');
        return;
      }
      if (!this.paused && key === 'm') setMuted(!settings.muted);
    });
  }

  private setupFocusHandling(): void {
    const onBlur = () => this.pause('Paused — window lost focus');
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      music.setSuspended(hidden);
      if (hidden) onBlur();
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    this.teardown.push(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  private exposeHook(): void {
    const w = window as unknown as { __cascade?: CascadeHook };
    w.__cascade = {
      snapshot: () => ({
        phase: this.world.phase,
        paused: this.paused,
        wave: this.world.wave,
        act: this.world.act,
        health: this.world.health,
        score: this.world.stats.score,
        enemies: this.world.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind, wet: e.wet > 0, frozen: e.frozen > 0, shield: e.traits.shield })),
        largestCascade: this.world.largestCascade,
        kills: this.world.stats.kills,
        offer: [...this.world.offer],
        offerKind: offerKindAfterWave(this.world.phase === 'start' ? 0 : this.world.wave, this.world.loadout),
        elements: [...this.world.loadout.elements],
        levels: { ...this.world.loadout.levels },
        codex: [...this.codex],
        upgradeVisible: this.upgradePanel.visible,
        resultVisible: this.resultOverlay !== null,
        particles: this.effects.particleCount,
        audio: sfx.context?.state ?? 'locked',
        music: settings.music,
      }),
    };
    this.teardown.push(() => {
      if (w.__cascade) delete w.__cascade;
    });
  }

  private cleanup(): void {
    for (const fn of this.teardown) fn();
    this.teardown = [];
    // Phaser's input and keyboard plugins drop their scene listeners on shutdown.
    this.effects.clear();
    this.tweens.killAll();
    this.time.removeAllEvents();
    music.setBoss(false);
    music.setIntensity(0);
  }

  // ------------------------------------------------------------ pause/menus

  private pause(reason: string): void {
    if (this.paused || this.resultOverlay || this.world.phase !== 'playing') return;
    this.paused = true;
    music.setIntensity(0);
    const o = new Overlay(this, 'PAUSED', COLORS.text, 180);
    this.pauseOverlay = o;
    if (reason !== 'Paused') o.text(reason, 24, COLORS.gold);
    o.space(14);
    o.button({ label: 'RESUME', primary: true, accent: COLORS.good, onClick: () => this.resume() });
    o.button({ label: 'RESTART RUN', onClick: () => this.restart() });
    const [snd, fx] = o.buttonRow(
      {
        label: settings.muted ? 'SOUND: OFF' : 'SOUND: ON',
        onClick: () => {
          setMuted(!settings.muted);
          snd.setLabel(settings.muted ? 'SOUND: OFF' : 'SOUND: ON');
        },
      },
      {
        label: settings.reducedEffects ? 'FX: LOW' : 'FX: FULL',
        onClick: () => {
          setReducedEffects(!settings.reducedEffects);
          this.effects.reduced = settings.reducedEffects;
          fx.setLabel(settings.reducedEffects ? 'FX: LOW' : 'FX: FULL');
        },
      },
    );
    const [mus] = o.buttonRow(
      {
        label: settings.music ? 'MUSIC: ON' : 'MUSIC: OFF',
        onClick: () => {
          setMusic(!settings.music);
          if (settings.music) unlockAudio();
          mus.setLabel(settings.music ? 'MUSIC: ON' : 'MUSIC: OFF');
        },
      },
      { label: 'QUIT TO TITLE', onClick: () => this.scene.start('title') },
    );
    o.space(10);
    o.text('YOUR COMBINATIONS', 18, COLORS.textDim, 8, true);
    const owned = this.world.loadout.elements;
    const lines = REACTION_INFO.filter((r) => !r.enemy && r.elements.length >= 1 && r.elements.every((e) => owned.includes(e)))
      .filter((r) => !r.requires || this.world.loadout.levels[r.requires] > 0)
      .slice(0, 7)
      .map((r) => `${this.codex.has(r.id) ? r.name : '???'} — ${r.recipe}`);
    o.text(lines.length ? lines.join('\n') : 'Pick up a second element to unlock combinations.', 19, COLORS.text, 6);
  }

  private resume(): void {
    if (!this.paused) return;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.paused = false;
    this.accumulator = 0;
  }

  private restart(): void {
    this.scene.restart(restartConfig(this.cfg));
  }

  private showChoice(): void {
    const w = this.world;
    const notice = this.pendingNotice;
    this.pendingNotice = '';
    music.setIntensity(0);
    music.setBoss(false);
    // Save between waves so the run can be continued later.
    if (w.phase === 'upgrade' && !isTestRun(this.cfg)) {
      const save = w.toSave();
      if (save) saveRun({ save, daily: this.cfg.daily });
    }
    const kind = w.phase === 'start' ? 'start' : offerKindAfterWave(w.wave, w.loadout);
    this.upgradePanel.show({
      offer: w.offer,
      kind,
      clearedWave: w.wave,
      loadout: w.loadout,
      notice,
      rerollsLeft: w.rerollsLeft,
      onPick: (index) => {
        this.upgradePanel.hide();
        w.chooseUpgrade(index);
      },
      onReroll: () => {
        if (w.reroll()) {
          sfx.play('select');
          this.upgradePanel.hide();
        }
      },
    });
  }

  private showResults(): void {
    const w = this.world;
    const victory = w.phase === 'victory';
    const testRun = isTestRun(this.cfg);
    const endlessRun = w.endless;
    if (!testRun) clearRun();
    const mode: RunMode = this.cfg.daily ? 'daily' : endlessRun ? 'endless' : 'normal';
    const prev = testRun ? { record: loadBest(), isNewBest: false } : recordRunSafe(w.wave, w.largestCascade, victory, endlessRun);
    let rank = -1;
    if (!testRun) {
      const result = insertEntry(loadLeaderboard(), {
        score: w.stats.score,
        wave: w.wave,
        cascade: w.largestCascade,
        mode,
        victory,
        date: new Date().toISOString().slice(0, 10),
        elements: [...w.loadout.elements],
      });
      saveLeaderboard(result.board);
      rank = result.rank;
    }

    const o = new Overlay(this, victory ? 'VICTORY' : endlessRun ? 'RUN OVER' : 'DEFEAT', victory ? COLORS.good : COLORS.danger, 110);
    this.resultOverlay = o;
    const where = victory
      ? `All ${WAVES.total} waves survived — the Monolith has fallen.`
      : endlessRun && w.wave > WAVES.total
        ? `Endless: reached wave ${w.wave}.`
        : `Overrun on wave ${w.wave} of ${WAVES.total}.`;
    o.text(where, 24, COLORS.text, 14);
    o.text(`SCORE ${w.stats.score.toLocaleString('en-US')}${rank === 0 ? '  ·  NEW HIGH SCORE!' : rank > 0 ? `  ·  #${rank + 1} on your records` : ''}`, 30, COLORS.gold, 12, true);
    o.text(`BIGGEST CASCADE  ×${w.largestCascade}`, 22, COLORS.text, 8, true);
    const replay = w.largestReplay;
    if (replay.length >= 2) o.addBlock(new ReplayView(this, 0, 0, 620, 300, replay), 300);
    const mins = Math.floor(w.stats.time / 60);
    const secs = Math.floor(w.stats.time % 60)
      .toString()
      .padStart(2, '0');
    o.text(`Enemies defeated ${w.stats.kills}   ·   Time ${mins}:${secs}`, 21, COLORS.text, 6);
    const kit = [...w.loadout.elements, ...MODIFIER_IDS.filter((id) => w.loadout.levels[id] > 0 && id !== 'repair')]
      .map((id) => UPGRADE_DEFS[id].name)
      .join(' · ');
    o.text(kit, 17, COLORS.textDim, 8);
    const newBest = prev.isNewBest ? '   NEW BEST!' : '';
    o.text(
      testRun ? 'Test run (URL parameters) — not saved to records' : `Best: wave ${prev.record.bestWave} · cascade ${prev.record.bestCascade}${newBest}`,
      19,
      prev.isNewBest ? COLORS.gold : COLORS.textDim,
      16,
    );
    if (victory && !endlessRun) {
      o.button({
        label: 'KEEP GOING · ENDLESS',
        primary: true,
        accent: ELEMENT_COLORS.void.main,
        height: 72,
        onClick: () => {
          o.destroy();
          this.resultOverlay = null;
          this.resultScheduled = false;
          w.continueEndless();
        },
      });
    }
    o.button({ label: 'PLAY AGAIN  (R)', primary: !victory || endlessRun, accent: COLORS.good, height: 72, onClick: () => this.restart() });
    let feedback: Phaser.GameObjects.Text | null = null;
    const [copyBtn] = o.buttonRow(
      {
        label: 'COPY RESULT',
        onClick: () => {
          const line = resultSummary({ victory, wave: w.wave, score: w.stats.score, largestCascade: w.largestCascade, loadout: w.loadout, dailyKey: this.cfg.daily, endless: endlessRun });
          void copyText(line).then((ok) => {
            copyBtn.setLabel(ok ? 'COPIED!' : 'COPY FAILED');
            if (!ok && !feedback) feedback = o.text(line, 16, COLORS.textDim, 6);
          });
        },
      },
      { label: 'TITLE', onClick: () => this.scene.start('title') },
    );
    music.setIntensity(0);
    music.setBoss(false);
    sfx.play(victory ? 'victory' : 'defeat');
  }

  // ----------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const w = this.world;

    if (!this.paused && w.phase === 'playing') {
      // Hit-stop: a brief slow-motion beat when a cascade grows huge.
      let scale = this.cfg.speed;
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        scale *= FX.hitStopTimeScale;
      }
      this.accumulator += dt * scale;
      let steps = 0;
      const maxSteps = WORLD.maxStepsPerFrame * Math.ceil(this.cfg.speed);
      while (this.accumulator >= WORLD.fixedStep && steps < maxSteps) {
        w.step(WORLD.fixedStep);
        this.accumulator -= WORLD.fixedStep;
        steps++;
        if (w.phase !== 'playing') break;
      }
      if (steps >= maxSteps) this.accumulator = 0;
    }

    for (const ev of w.drainEvents()) this.handleEvent(ev);

    const fxDt = this.hitStop > 0 ? dt * 0.35 : dt;
    if (!this.paused) {
      this.effects.update(fxDt);
      this.emitAmbient(fxDt);
    }
    let danger = 0;
    let bossAlive = false;
    for (const e of w.enemies) {
      danger = Math.max(danger, (e.y - (WORLD.defenceLineY - 220)) / 220);
      if (isBoss(e)) bossAlive = true;
    }
    danger = Math.max(0, Math.min(1, danger));
    this.arena.draw(w, this.paused ? 0 : fxDt, danger);
    this.effects.draw();
    this.hud.update(w, dt);

    if (w.phase === 'playing' && !this.paused) {
      music.setIntensity(w.wave >= 6 || danger > 0.6 ? 2 : 1);
      music.setBoss(bossAlive);
      // Tempo follows the threat: how close the nearest enemy is, plus how crowded the arena is.
      let closest = 0;
      for (const e of w.enemies) closest = Math.max(closest, (e.y - (WORLD.defenceLineY - 560)) / 560);
      music.setTempo(Math.min(1, Math.max(0, closest) * 0.85 + Math.min(1, w.enemies.length / 140) * 0.25));
    } else {
      music.setTempo(0);
    }
    if ((w.phase === 'upgrade' || w.phase === 'start') && !this.upgradePanel.visible && !this.paused) this.showChoice();
    if ((w.phase === 'victory' || w.phase === 'defeat') && !this.resultScheduled) {
      this.resultScheduled = true;
      this.time.delayedCall(w.phase === 'victory' ? 1400 : 900, () => this.showResults());
    }
  }

  /** Burning enemies shed sparks, wet ones drip, poisoned ones bubble. Kept sparse. */
  private emitAmbient(dt: number): void {
    const rate = this.effects.reduced ? 2 : 7;
    for (const e of this.world.enemies) {
      if (e.burn && Math.random() < rate * dt) {
        this.effects.burst(e.x + (Math.random() - 0.5) * e.radius, e.y - e.radius * 0.5, ELEMENT_COLORS.fire.main, 1, 60, {
          angle: 0,
          spread: 0.8,
          life: 0.5,
          drag: 1,
          gravity: -40,
          shape: 'dot',
          size: 2.5,
          minor: true,
        });
      }
      if (e.wet > 0 && Math.random() < rate * 0.3 * dt) {
        this.effects.burst(e.x + (Math.random() - 0.5) * e.radius, e.y + e.radius * 0.6, ELEMENT_COLORS.water.main, 1, 20, {
          angle: Math.PI,
          spread: 0.3,
          life: 0.5,
          gravity: 220,
          shape: 'dot',
          size: 2.2,
          minor: true,
        });
      }
      if (e.frozen > 0 && Math.random() < rate * 0.25 * dt) {
        this.effects.burst(e.x, e.y, ELEMENT_COLORS.frost.core, 1, 40, { life: 0.4, shape: 'dot', size: 1.8, minor: true });
      }
    }
  }

  private shake(intensity: number = FX.shakeMajor, duration: number = FX.shakeDuration): void {
    if (settings.reducedEffects) return;
    const cam = this.cameras.main;
    if (cam.shakeEffect.isRunning) return;
    cam.shake(duration, intensity);
  }

  private discover(id: ReactionId): void {
    if (this.codex.has(id)) return;
    this.codex.add(id);
    saveCodex(this.codex);
    const info = REACTION_BY_ID[id];
    this.hud.toast(`NEW REACTION · ${this.codex.size}/${REACTION_INFO.length}`, `${info.name.toUpperCase()}  ·  ${info.recipe}`);
    sfx.play('discovery');
  }

  private handleEvent(ev: GameEvent): void {
    const fx = this.effects;
    switch (ev.type) {
      case 'shot': {
        const col = ELEMENT_COLORS[ev.element];
        const tipX = ev.x + Math.sin(ev.angle) * 50;
        const tipY = ev.y - Math.cos(ev.angle) * 50;
        fx.burst(tipX, tipY, col.main, 2, 260, { angle: ev.angle, spread: 0.7, life: 0.12, size: 2.5, minor: true });
        sfx.play(SHOT_SOUND[ev.element]);
        break;
      }
      case 'hit': {
        const col = ELEMENT_COLORS[ev.element];
        fx.burst(ev.x, ev.y, col.main, 4, 240, { life: 0.22, size: 2.5, minor: true });
        fx.ring(ev.x, ev.y, 4, 22, col.core, 0.16, 3, 0, true);
        sfx.play('hit');
        break;
      }
      case 'splash': {
        const col = ELEMENT_COLORS.water;
        fx.flash(ev.x, ev.y, 26, col.main, 0.12);
        fx.ring(ev.x, ev.y, ev.radius * 0.2, ev.radius, col.main, 0.5, 5, 0.14);
        fx.ring(ev.x, ev.y, ev.radius * 0.1, ev.radius * 0.7, col.core, 0.38, 2);
        fx.burst(ev.x, ev.y, col.main, 12, 300, { life: 0.5, gravity: 500, shape: 'dot', size: 3, drag: 2 });
        sfx.play('splash');
        break;
      }
      case 'gust': {
        const col = ELEMENT_COLORS.wind;
        fx.ring(ev.x, ev.y, ev.radius, ev.radius * 0.25, col.main, 0.35, 4, 0.08);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          fx.burst(ev.x + Math.cos(a) * ev.radius, ev.y + Math.sin(a) * ev.radius, col.core, 1, 260, { angle: Math.atan2(-Math.cos(a), Math.sin(a)) + Math.PI, spread: 0.2, life: 0.3, size: 2 });
        }
        sfx.play('gust');
        break;
      }
      case 'singularity':
        fx.ring(ev.x, ev.y, ev.radius * 1.3, ev.radius, ELEMENT_COLORS.void.main, 0.3, 5);
        sfx.play('singularity');
        break;
      case 'blast': {
        const st = BLAST_STYLE[ev.kind];
        fx.flash(ev.x, ev.y, ev.radius * 0.55, st.color, 0.16);
        fx.ring(ev.x, ev.y, ev.radius * 0.25, ev.radius, st.color, 0.42, 7, 0.24);
        if (ev.kind === 'steam') {
          fx.ring(ev.x, ev.y, ev.radius * 0.15, ev.radius * 0.75, st.core, 0.35, 3);
          fx.burst(ev.x, ev.y, COLORS.steam, 18, 230, { life: 0.85, shape: 'puff', size: 13, drag: 3.5, gravity: -70 });
        } else if (ev.kind === 'shatter') {
          fx.burst(ev.x, ev.y, st.color, 18, 480, { life: 0.5, shape: 'shard', size: 7, drag: 3 });
          fx.burst(ev.x, ev.y, 0xffffff, 8, 300, { life: 0.3, size: 2 });
        } else if (ev.kind === 'collapse') {
          fx.ring(ev.x, ev.y, 4, ev.radius * 1.2, st.core, 0.3, 3);
          fx.burst(ev.x, ev.y, st.color, 16, 360, { life: 0.45, size: 3 });
        } else {
          fx.burst(ev.x, ev.y, st.color, 22, 460, { life: 0.5, size: 3.5 });
          fx.burst(ev.x, ev.y, st.core, 10, 320, { life: 0.35, size: 2.5 });
        }
        if (ev.kind === 'flashover' || ev.kind === 'ignition') fx.burst(ev.x, ev.y, 0x5a2a20, 8, 120, { life: 0.8, shape: 'puff', size: 10, drag: 3, gravity: -50 });
        this.shake(FX.shakeMajor * st.shake);
        sfx.play(st.sound, 1 + ev.generation * 0.2);
        if (ev.generation >= 2) music.duck();
        break;
      }
      case 'chain': {
        const color = ev.relay ? RELAY_COLOR : ev.arc ? ELEMENT_COLORS.void.core : ELEMENT_COLORS.lightning.main;
        fx.bolt(ev.links, color, ev.relay ? 3.5 : 5, ev.relay ? FX.boltDuration * 0.85 : FX.boltDuration);
        for (const l of ev.links) {
          fx.flash(l.x2, l.y2, 22, color, 0.12);
          fx.burst(l.x2, l.y2, color, 6, 260, { life: 0.25, size: 2.4 });
        }
        if (ev.links.length >= 3) this.shake(FX.shakeMajor * 0.7);
        sfx.play('chain');
        break;
      }
      case 'status': {
        const color =
          ev.status === 'poison' ? ELEMENT_COLORS.toxin.main : ev.status === 'thaw' ? ELEMENT_COLORS.water.main : ev.status === 'brittle' ? ELEMENT_COLORS.toxin.core : ELEMENT_COLORS.frost.main;
        fx.ring(ev.x, ev.y, 6, 34, color, 0.25, 3);
        if (ev.status === 'freeze' || ev.status === 'brittle') {
          fx.burst(ev.x, ev.y, ELEMENT_COLORS.frost.core, 8, 180, { life: 0.35, shape: 'shard', size: 4 });
          sfx.play('freeze');
        } else if (ev.status === 'poison') {
          sfx.play('poison');
        } else if (ev.status === 'thermalShock') {
          fx.burst(ev.x, ev.y, 0xffffff, 10, 260, { life: 0.3, size: 2.5 });
          sfx.play('shatter', 0.6);
        }
        break;
      }
      case 'shieldBlock':
        fx.ring(ev.x, ev.y, 18, 30, 0xbfe9ff, 0.15, 3);
        sfx.play('shieldBlock');
        break;
      case 'shieldBreak':
        fx.burst(ev.x, ev.y, 0xbfe9ff, 14, 340, { life: 0.4, shape: 'shard', size: 5 });
        fx.ring(ev.x, ev.y, 20, 60, 0xbfe9ff, 0.3, 4);
        sfx.play('shieldBreak');
        break;
      case 'reaction':
        this.discover(ev.id);
        break;
      case 'bounce':
        fx.burst(ev.x, ev.y, ELEMENT_COLORS[ev.element].main, 4, 200, { angle: ev.x < WORLD.width / 2 ? Math.PI / 2 : -Math.PI / 2, spread: 1.4, life: 0.2, minor: true });
        break;
      case 'kill': {
        const col = ENEMY_COLORS[ev.kind];
        const big = ev.radius > 60;
        // Break apart into fragments of the enemy's own colours.
        fx.burst(ev.x, ev.y, col.edge, big ? 40 : 8, big ? 520 : 360, { life: big ? 0.9 : 0.45, shape: 'shard', size: big ? 10 : 5.5, drag: 3 });
        fx.burst(ev.x, ev.y, col.core, big ? 30 : 6, big ? 600 : 300, { life: big ? 0.7 : 0.3, size: big ? 4 : 2.5, drag: 4 });
        fx.ring(ev.x, ev.y, ev.radius * 0.5, ev.radius * (big ? 4 : 1.8), col.edge, big ? 0.8 : 0.22, big ? 8 : 4);
        if (ev.elite) fx.ring(ev.x, ev.y, ev.radius, ev.radius * 2.6, COLORS.gold, 0.4, 5);
        if (big) {
          this.shake(0.02, 600);
          this.hud.banner('BOSS DESTROYED', COLORS.gold, '', 1600);
          music.duck();
        }
        sfx.play('kill');
        break;
      }
      case 'split':
        fx.burst(ev.x, ev.y, ENEMY_COLORS.splitling.edge, 8, 220, { life: 0.3, size: 2.5 });
        sfx.play('split');
        break;
      case 'leak': {
        fx.ring(ev.x, WORLD.defenceLineY, 10, 120, COLORS.danger, 0.5, 6, 0.2);
        fx.burst(ev.x, WORLD.defenceLineY, COLORS.danger, 18, 380, { life: 0.5 });
        this.flashRect.setAlpha(0.28);
        this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 380 });
        this.hud.hurt();
        this.shake(0.012, 260);
        sfx.play('leak');
        break;
      }
      case 'cascade': {
        this.hud.cascade(ev.cascadeId, ev.size);
        const reached = this.lastCascadeMilestone.get(ev.cascadeId) ?? 0;
        const milestone = ev.size >= 25 ? 25 : ev.size >= 15 ? 15 : ev.size >= 10 ? 10 : ev.size >= 8 ? 8 : ev.size >= 5 ? 5 : ev.size >= 3 ? 3 : 0;
        if (milestone > reached) {
          this.lastCascadeMilestone.set(ev.cascadeId, milestone);
          if (this.lastCascadeMilestone.size > 64) this.lastCascadeMilestone.clear();
          sfx.play('cascade', milestone / 5);
          if (milestone >= 5) this.shake(FX.shakeMajor * (milestone >= 10 ? 1.6 : 1.1), 200);
          if (FX.hitStopThresholds.includes(milestone)) {
            this.hitStop = FX.hitStopDuration;
            music.duck();
          }
        }
        break;
      }
      case 'waveStart': {
        const w = ev.wave;
        if (w > WAVES.total) this.hud.banner(`ENDLESS ${w}`, ELEMENT_COLORS.void.main, w % WAVES.actLength === 0 ? 'A boss returns, stronger' : '', 1400);
        else if (w === WAVES.total) this.hud.banner('FINAL WAVE', COLORS.danger, 'The Monolith approaches', 1600);
        else if (w % WAVES.actLength === 1 && w > 1) this.hud.banner(`ACT ${w === 6 ? 'II' : 'III'}`, COLORS.gold, `Wave ${w} — new enemies ahead`, 1600);
        else this.hud.banner(`WAVE ${w}`, COLORS.text, w === 1 ? 'Hold to fire · stop them at the red line' : '', 1200);
        sfx.play('waveStart');
        break;
      }
      case 'waveClear':
        sfx.play('waveClear');
        break;
      case 'actClear':
        if (ev.healed) this.pendingNotice = `ACT ${ev.act} CLEARED — +1 health restored`;
        sfx.play('actClear');
        break;
      case 'bossSpawn': {
        const name = ev.kind === 'hive' ? 'THE HIVE' : ev.kind === 'aegis' ? 'THE AEGIS' : 'THE MONOLITH';
        const tip =
          ev.kind === 'hive' ? 'It sheds splitlings as it takes damage' : ev.kind === 'aegis' ? 'Direct hits glance off — use reactions' : 'It speeds up when wounded';
        this.hud.banner(name, COLORS.danger, tip, 2000);
        this.shake(0.01, 500);
        sfx.play('boss');
        break;
      }
      case 'bossSupport':
        fx.ring(ev.x, ev.y, 20, 160, ENEMY_COLORS.monolith.edge, 0.6, 5);
        break;
      case 'upgrade':
        sfx.play('upgrade');
        break;
    }
  }
}

function recordRunSafe(wave: number, cascade: number, victory: boolean, endless: boolean): { record: BestRecord; isNewBest: boolean } {
  try {
    const before = loadBest();
    const record = recordRun(wave, cascade, victory, endless);
    return { record, isNewBest: wave > before.bestWave || cascade > before.bestCascade };
  } catch {
    return { record: { bestWave: wave, bestCascade: cascade, victories: victory ? 1 : 0, bestEndlessWave: 0 }, isNewBest: false };
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

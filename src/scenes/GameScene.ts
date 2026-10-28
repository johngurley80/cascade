import Phaser from 'phaser';
import { sfx, type SoundName } from '../audio/Sfx';
import { FX, WAVES, WORLD } from '../config';
import { resultSummary } from '../logic/summary';
import { ELEMENT_ORDER, type Element, type GameEvent } from '../logic/types';
import { MODIFIER_IDS, UPGRADE_DEFS } from '../logic/upgrades';
import { World } from '../logic/world';
import { settings, setMuted, setReducedEffects } from '../platform/settings';
import { loadBest, recordRun, type BestRecord } from '../platform/storage';
import { ArenaRenderer } from '../render/ArenaRenderer';
import { Effects } from '../render/Effects';
import { Hud } from '../ui/Hud';
import { Overlay } from '../ui/Overlay';
import { UpgradePanel } from '../ui/UpgradePanel';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS } from '../ui/theme';
import { isTestRun, restartConfig, type RunConfig } from './RunConfig';

const SHOT_SOUND: Record<Element, SoundName> = { fire: 'shotFire', water: 'shotWater', lightning: 'shotLightning' };
const RELAY_COLOR = 0xc9b2ff;

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
  private firePointerId = -1;
  private spaceHeld = false;
  private pendingNotice = '';
  private lastCascadeMilestone = new Map<number, number>();
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
    this.firePointerId = -1;
    this.spaceHeld = false;
    this.pendingNotice = '';
    this.lastCascadeMilestone = new Map();
    this.teardown = [];

    this.world = new World({ seed: this.cfg.seed, startWave: this.cfg.startWave, unlockAll: this.cfg.unlockAll });
    this.arena = new ArenaRenderer(this);
    const soft = this.add.graphics().setDepth(15);
    const glow = this.add.graphics().setDepth(35);
    this.effects = new Effects(soft, glow);
    this.effects.reduced = settings.reducedEffects;
    const subtitle = this.cfg.daily ? `DAILY RUN · ${this.cfg.daily}` : `seed ${this.cfg.seed}`;
    this.hud = new Hud(this, { onSelect: (el) => this.select(el), onPause: () => this.pause('Paused') }, subtitle);
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

  private setupInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.inputBlocked()) return;
      // Mouse aims on hover; touch aims only while dragging.
      if (p.wasTouch && !p.isDown) return;
      if (p.y < WORLD.arenaBottom || p.id === this.firePointerId) this.world.aimAt(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      sfx.unlock();
      if (over.length > 0 || this.inputBlocked()) return;
      if (p.y > WORLD.arenaBottom || p.y < WORLD.arenaTop) return;
      if (p.rightButtonDown()) {
        this.cycleElement(1);
        return;
      }
      this.world.aimAt(p.x, p.y);
      this.firePointerId = p.id;
      this.world.firing = true;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.firePointerId) return;
      this.firePointerId = -1;
      if (!this.spaceHeld) this.world.firing = false;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => {
      if (this.firePointerId !== -1 && !this.input.activePointer.isDown) {
        this.firePointerId = -1;
        if (!this.spaceHeld) this.world.firing = false;
      }
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.inputBlocked() && dy !== 0) this.cycleElement(dy > 0 ? 1 : -1);
    });

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (ev: KeyboardEvent) => {
      sfx.unlock();
      const key = ev.key.toLowerCase();
      if (this.resultOverlay) {
        if (key === 'r' || key === 'enter') this.restart();
        return;
      }
      if (this.upgradePanel.visible && !this.paused) {
        const n = Number.parseInt(key, 10);
        if (n >= 1 && n <= 3) this.upgradePanel.pick(n - 1);
        return;
      }
      if (key === 'p' || key === 'escape') {
        if (this.paused) this.resume();
        else this.pause('Paused');
        return;
      }
      if (this.paused) return;
      if (key === 'm') {
        setMuted(!settings.muted);
        return;
      }
      if (key === '1' || key === '2' || key === '3') this.select(ELEMENT_ORDER[Number(key) - 1]);
      if (key === 'q') this.cycleElement(-1);
      if (key === 'e') this.cycleElement(1);
      if (key === ' ' && !ev.repeat) {
        this.spaceHeld = true;
        if (!this.inputBlocked()) this.world.firing = true;
      }
    });
    kb.on('keyup', (ev: KeyboardEvent) => {
      if (ev.key === ' ') {
        this.spaceHeld = false;
        if (this.firePointerId === -1) this.world.firing = false;
      }
    });
  }

  private select(el: Element): void {
    if (this.inputBlocked()) return;
    if (this.world.selected !== el && this.world.selectElement(el)) sfx.play('select');
  }

  private cycleElement(dir: number): void {
    const owned = ELEMENT_ORDER.filter((e) => this.world.loadout.elements.has(e));
    if (owned.length < 2) return;
    const i = owned.indexOf(this.world.selected);
    this.select(owned[(i + dir + owned.length) % owned.length]);
  }

  private setupFocusHandling(): void {
    const onBlur = () => this.pause('Paused — window lost focus');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBlur();
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
        health: this.world.health,
        enemies: this.world.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind, wet: e.wet > 0 })),
        largestCascade: this.world.largestCascade,
        kills: this.world.stats.kills,
        offer: [...this.world.offer],
        selected: this.world.selected,
        elements: [...this.world.loadout.elements],
        levels: { ...this.world.loadout.levels },
        upgradeVisible: this.upgradePanel.visible,
        resultVisible: this.resultOverlay !== null,
        particles: this.effects.particleCount,
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
  }

  // ------------------------------------------------------------ pause/menus

  private pause(reason: string): void {
    if (this.paused || this.resultOverlay || this.world.phase !== 'playing') return;
    this.paused = true;
    this.world.firing = false;
    this.firePointerId = -1;
    this.spaceHeld = false;
    const o = new Overlay(this, 'PAUSED', COLORS.text, 220);
    this.pauseOverlay = o;
    if (reason !== 'Paused') o.text(reason, 24, COLORS.gold);
    o.space(20);
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
        label: settings.reducedEffects ? 'FX: REDUCED' : 'FX: FULL',
        onClick: () => {
          setReducedEffects(!settings.reducedEffects);
          this.effects.reduced = settings.reducedEffects;
          fx.setLabel(settings.reducedEffects ? 'FX: REDUCED' : 'FX: FULL');
        },
      },
    );
    o.button({ label: 'QUIT TO TITLE', onClick: () => this.scene.start('title') });
    o.space(16);
    o.text('WATER wets + splashes nearby enemies', 21, ELEMENT_COLORS.water.main, 6);
    o.text('FIRE on wet → STEAM burst hits the crowd', 21, ELEMENT_COLORS.fire.main, 6);
    o.text('LIGHTNING on wet → chains to 4 more wet enemies', 21, ELEMENT_COLORS.lightning.main, 6);
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

  private showUpgrades(): void {
    const notice = this.pendingNotice;
    this.pendingNotice = '';
    this.world.firing = false;
    this.firePointerId = -1;
    this.upgradePanel.show(this.world.offer, this.world.wave, this.world.loadout, notice, (index) => {
      this.upgradePanel.hide();
      this.world.chooseUpgrade(index);
    });
  }

  private showResults(): void {
    const w = this.world;
    const victory = w.phase === 'victory';
    const testRun = isTestRun(this.cfg);
    const prev = testRun
      ? { record: loadBest(), isNewBest: false }
      : recordRunSafe(w.wave, w.largestCascade, victory);
    const o = new Overlay(this, victory ? 'VICTORY' : 'DEFEAT', victory ? COLORS.good : COLORS.danger, 190);
    this.resultOverlay = o;
    o.text(victory ? `All ${WAVES.total} waves survived — the boss is down.` : `Overrun on wave ${w.wave} of ${WAVES.total}.`, 26, COLORS.text, 26);
    o.text('BIGGEST CASCADE', 22, COLORS.textDim, 0, true);
    o.text(`${w.largestCascade}`, 96, COLORS.gold, 6, true);
    o.text('distinct enemies hit by one shot', 20, COLORS.textDim, 26);
    const mins = Math.floor(w.stats.time / 60);
    const secs = Math.floor(w.stats.time % 60)
      .toString()
      .padStart(2, '0');
    o.text(`Enemies defeated ${w.stats.kills}   ·   Time ${mins}:${secs}`, 24, COLORS.text, 10);
    const kit = [...ELEMENT_ORDER.filter((e) => w.loadout.elements.has(e)), ...MODIFIER_IDS.filter((id) => w.loadout.levels[id] > 0)]
      .map((id) => UPGRADE_DEFS[id].name)
      .join(' · ');
    o.text(kit, 20, COLORS.textDim, 12);
    const newBest = prev.isNewBest ? '   NEW BEST!' : '';
    o.text(
      testRun ? 'Test run (URL parameters) — not saved to best' : `Best: wave ${prev.record.bestWave} · cascade ${prev.record.bestCascade}${newBest}`,
      22,
      prev.isNewBest ? COLORS.gold : COLORS.textDim,
      30,
    );
    o.button({ label: 'PLAY AGAIN  (R)', primary: true, accent: COLORS.good, onClick: () => this.restart() });
    const feedback = { text: null as Phaser.GameObjects.Text | null };
    const [copyBtn] = o.buttonRow(
      {
        label: 'COPY RESULT',
        onClick: () => {
          const line = resultSummary({ victory, wave: w.wave, largestCascade: w.largestCascade, loadout: w.loadout, dailyKey: this.cfg.daily });
          void copyText(line).then((ok) => {
            copyBtn.setLabel(ok ? 'COPIED!' : 'COPY FAILED');
            if (!ok && !feedback.text) feedback.text = o.text(line, 18, COLORS.textDim, 6);
          });
        },
      },
      { label: 'TITLE', onClick: () => this.scene.start('title') },
    );
    sfx.play(victory ? 'victory' : 'defeat');
  }

  // ----------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const w = this.world;

    if (!this.paused && w.phase === 'playing') {
      this.accumulator += dt * this.cfg.speed;
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

    if (!this.paused) {
      this.effects.update(dt);
      this.emitAmbient(dt);
    }
    let danger = 0;
    for (const e of w.enemies) danger = Math.max(danger, (e.y - (WORLD.defenceLineY - 220)) / 220);
    this.arena.draw(w, this.paused ? 0 : dt, Math.max(0, Math.min(1, danger)));
    this.effects.draw();
    this.hud.update(w, dt);

    if (w.phase === 'upgrade' && !this.upgradePanel.visible && !this.paused) this.showUpgrades();
    if ((w.phase === 'victory' || w.phase === 'defeat') && !this.resultScheduled) {
      this.resultScheduled = true;
      this.time.delayedCall(w.phase === 'victory' ? 1200 : 900, () => this.showResults());
    }
  }

  /** Burning enemies shed sparks; wet ones drip. Kept sparse. */
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
        });
      }
    }
  }

  private shake(intensity: number = FX.shakeMajor, duration: number = FX.shakeDuration): void {
    if (settings.reducedEffects) return;
    const cam = this.cameras.main;
    if (cam.shakeEffect.isRunning) return;
    cam.shake(duration, intensity);
  }

  private handleEvent(ev: GameEvent): void {
    const fx = this.effects;
    switch (ev.type) {
      case 'shot': {
        const col = ELEMENT_COLORS[ev.element];
        const tipX = ev.x + Math.sin(ev.angle) * 50;
        const tipY = ev.y - Math.cos(ev.angle) * 50;
        fx.burst(tipX, tipY, col.main, 3, 260, { angle: ev.angle, spread: 0.7, life: 0.14, size: 2.5 });
        sfx.play(SHOT_SOUND[ev.element]);
        break;
      }
      case 'hit': {
        const col = ELEMENT_COLORS[ev.element];
        fx.burst(ev.x, ev.y, col.main, 6, 240, { life: 0.25, size: 2.5 });
        fx.ring(ev.x, ev.y, 4, 22, col.core, 0.16, 3);
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
      case 'steam': {
        fx.flash(ev.x, ev.y, ev.radius * 0.55, COLORS.steam, 0.16);
        fx.ring(ev.x, ev.y, ev.radius * 0.3, ev.radius, COLORS.steam, 0.45, 8, 0.25);
        fx.ring(ev.x, ev.y, ev.radius * 0.15, ev.radius * 0.75, ELEMENT_COLORS.water.core, 0.35, 3);
        fx.burst(ev.x, ev.y, COLORS.steam, 18, 230, { life: 0.85, shape: 'puff', size: 13, drag: 3.5, gravity: -70 });
        fx.burst(ev.x, ev.y, 0xffd9a0, 10, 380, { life: 0.35, size: 2.5 });
        this.shake(FX.shakeMajor * 0.8);
        sfx.play('steam', 1 + ev.generation * 0.2);
        break;
      }
      case 'flashover': {
        fx.flash(ev.x, ev.y, ev.radius * 0.6, ELEMENT_COLORS.fire.main, 0.16);
        fx.ring(ev.x, ev.y, 10, ev.radius, ELEMENT_COLORS.fire.main, 0.4, 8, 0.3);
        fx.burst(ev.x, ev.y, ELEMENT_COLORS.fire.main, 24, 460, { life: 0.5, size: 3.5 });
        fx.burst(ev.x, ev.y, ELEMENT_COLORS.lightning.main, 10, 320, { life: 0.35, size: 2.5 });
        fx.burst(ev.x, ev.y, 0x5a2a20, 8, 120, { life: 0.8, shape: 'puff', size: 10, drag: 3, gravity: -50 });
        this.shake();
        sfx.play('flashover', 1 + ev.generation * 0.2);
        break;
      }
      case 'chain': {
        const color = ev.relay ? RELAY_COLOR : ELEMENT_COLORS.lightning.main;
        fx.bolt(ev.links, color, ev.relay ? 3.5 : 5, ev.relay ? FX.boltDuration * 0.85 : FX.boltDuration);
        for (const l of ev.links) {
          fx.flash(l.x2, l.y2, 22, color, 0.12);
          fx.burst(l.x2, l.y2, color, 6, 260, { life: 0.25, size: 2.4 });
        }
        if (ev.links.length >= 3) this.shake(FX.shakeMajor * 0.7);
        sfx.play('chain');
        break;
      }
      case 'bounce':
        fx.burst(ev.x, ev.y, ELEMENT_COLORS[ev.element].main, 5, 200, { angle: ev.x < WORLD.width / 2 ? Math.PI / 2 : -Math.PI / 2, spread: 1.4, life: 0.2 });
        break;
      case 'kill': {
        const col = ENEMY_COLORS[ev.kind].edge;
        const big = ev.kind === 'boss';
        fx.burst(ev.x, ev.y, col, big ? 60 : 10, big ? 600 : 380, { life: big ? 0.9 : 0.32, size: big ? 5 : 3.5, drag: 4 });
        fx.burst(ev.x, ev.y, 0xffffff, big ? 20 : 3, big ? 400 : 200, { life: 0.22, size: 2, shape: 'dot' });
        fx.ring(ev.x, ev.y, ev.radius * 0.5, ev.radius * (big ? 4 : 1.8), col, big ? 0.8 : 0.22, big ? 8 : 4);
        if (big) {
          this.shake(0.02, 600);
          this.hud.banner('BOSS DESTROYED', COLORS.gold, '', 1600);
        }
        sfx.play('kill');
        break;
      }
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
        const milestone = ev.size >= 15 ? 15 : ev.size >= 10 ? 10 : ev.size >= 5 ? 5 : ev.size >= 3 ? 3 : 0;
        if (milestone > reached) {
          this.lastCascadeMilestone.set(ev.cascadeId, milestone);
          if (this.lastCascadeMilestone.size > 64) this.lastCascadeMilestone.clear();
          sfx.play('cascade', milestone / 5);
          if (milestone >= 5) this.shake(FX.shakeMajor * (milestone >= 10 ? 1.6 : 1.1), 200);
        }
        break;
      }
      case 'waveStart':
        if (ev.wave >= WAVES.total) this.hud.banner('FINAL WAVE', COLORS.danger, 'Something big is coming', 1600);
        else this.hud.banner(`WAVE ${ev.wave}`, COLORS.text, ev.wave === 1 ? 'Hold to fire · stop them at the red line' : '', 1200);
        sfx.play('waveStart');
        break;
      case 'waveClear':
        sfx.play('waveClear');
        break;
      case 'bossSpawn':
        this.hud.banner('BOSS INCOMING', COLORS.danger, 'If it crosses the line, the run is over', 1800);
        this.shake(0.01, 500);
        sfx.play('boss');
        break;
      case 'bossSupport':
        fx.ring(ev.x, ev.y, 20, 160, ENEMY_COLORS.boss.edge, 0.6, 5);
        break;
      case 'upgrade':
        sfx.play('upgrade');
        break;
      case 'elementGranted':
        this.pendingNotice = `${UPGRADE_DEFS[ev.element].name.toUpperCase()} UNLOCKED — all three elements are ready (keys 1–3)`;
        break;
      case 'victory':
      case 'defeat':
        this.world.firing = false;
        break;
    }
  }
}

function recordRunSafe(wave: number, cascade: number, victory: boolean): { record: BestRecord; isNewBest: boolean } {
  try {
    const before = loadBest();
    const record = recordRun(wave, cascade, victory);
    return { record, isNewBest: wave > before.bestWave || cascade > before.bestCascade };
  } catch {
    return { record: { bestWave: wave, bestCascade: cascade, victories: victory ? 1 : 0 }, isNewBest: false };
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

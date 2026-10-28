import Phaser from 'phaser';
import { PLAYER, SCORE, WAVES, WORLD } from '../config';
import { MODIFIER_IDS, UPGRADE_DEFS } from '../logic/upgrades';
import type { ModifierId } from '../logic/types';
import type { World } from '../logic/world';
import { drawIcon } from './icons';
import { COLORS, ELEMENT_COLORS, FONT, css, paletteForAct } from './theme';

export interface HudCallbacks {
  /** Select the element in slot `index` (0-based, in acquisition order). */
  onSelectSlot(index: number): void;
  onPause(): void;
}

const BAR_Y = WORLD.arenaBottom;
const SLOT_AREA = { x: 12, w: 472, h: 112, y: BAR_Y + 76 };
const CHIPS = { x: 496, y: BAR_Y + 18, w: 48, h: 40, gap: 5, cols: 4, rows: 3 };
const MAX_SLOTS = 7;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const style = (size: number, color: number = COLORS.text, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color: css(color),
  resolution: 2,
});

/** Top status panel, bottom element bar, upgrade chips, cascade counter, banners and toasts. */
export class Hud {
  private readonly top: Phaser.GameObjects.Graphics;
  private readonly bottom: Phaser.GameObjects.Graphics;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly slotLabels: Phaser.GameObjects.Text[] = [];
  private readonly slotZones: Phaser.GameObjects.Zone[] = [];
  private readonly chipTexts: Phaser.GameObjects.Text[] = [];
  private readonly counterLabel: Phaser.GameObjects.Text;
  private readonly counterValue: Phaser.GameObjects.Text;
  private readonly counterMult: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private readonly bannerSub: Phaser.GameObjects.Text;
  private readonly toastBg: Phaser.GameObjects.Graphics;
  private readonly toastTitle: Phaser.GameObjects.Text;
  private readonly toastBody: Phaser.GameObjects.Text;
  private toastQueue: { title: string; body: string; color: number }[] = [];
  private toastTimer = 0;
  private counterTimer = 0;
  private counterCascadeId = -1;
  private counterSize = 0;
  private lastSignature = '';
  private healthFlash = 0;
  private shownScore = 0;
  private slotLayout = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cb: HudCallbacks,
    subtitle: string,
  ) {
    this.top = scene.add.graphics().setDepth(60);
    this.bottom = scene.add.graphics().setDepth(60);
    this.waveText = scene.add.text(WORLD.width / 2, 28, '', style(28)).setOrigin(0.5).setDepth(61);
    scene.add.text(WORLD.width / 2, 76, subtitle, style(14, COLORS.textDim, false)).setOrigin(0.5).setDepth(61);
    this.scoreText = scene.add.text(20, 76, '', style(16, COLORS.gold)).setOrigin(0, 0.5).setDepth(61);

    for (let i = 0; i < MAX_SLOTS; i++) {
      this.slotLabels.push(scene.add.text(0, 0, '', style(17)).setOrigin(0.5).setDepth(62));
      const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(63);
      zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        this.cb.onSelectSlot(i);
      });
      this.slotZones.push(zone);
    }
    for (let i = 0; i < CHIPS.cols * CHIPS.rows; i++) {
      this.chipTexts.push(scene.add.text(0, 0, '', style(12, COLORS.text)).setOrigin(0.5, 1).setDepth(62));
    }

    const pause = scene.add.zone(WORLD.width - 46, 46, 84, 84).setInteractive({ useHandCursor: true }).setDepth(63);
    pause.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.cb.onPause();
    });

    this.counterLabel = scene.add.text(WORLD.width / 2, 870, 'CASCADE', style(22, COLORS.textDim)).setOrigin(0.5).setDepth(55);
    this.counterValue = scene.add.text(WORLD.width / 2, 920, '', style(60)).setOrigin(0.5).setDepth(55);
    this.counterMult = scene.add.text(WORLD.width / 2, 968, '', style(18, COLORS.gold)).setOrigin(0.5).setDepth(55);
    for (const t of [this.counterValue, this.counterLabel, this.counterMult]) {
      t.setStroke('#04070f', 7);
      t.setAlpha(0);
    }

    this.bannerText = scene.add.text(WORLD.width / 2, 520, '', style(64)).setOrigin(0.5).setDepth(70).setAlpha(0);
    this.bannerText.setStroke('#04070f', 10);
    this.bannerSub = scene.add.text(WORLD.width / 2, 584, '', style(24, COLORS.textDim)).setOrigin(0.5).setDepth(70).setAlpha(0);
    this.bannerSub.setStroke('#04070f', 6);

    this.toastBg = scene.add.graphics().setDepth(72).setAlpha(0);
    this.toastTitle = scene.add.text(WORLD.width / 2, 132, '', style(17, COLORS.gold)).setOrigin(0.5).setDepth(73).setAlpha(0);
    this.toastBody = scene.add.text(WORLD.width / 2, 160, '', style(24)).setOrigin(0.5).setDepth(73).setAlpha(0);
  }

  /** Show / grow the reaction counter for a cascade. */
  cascade(cascadeId: number, size: number): void {
    if (size < 3) return;
    if (cascadeId !== this.counterCascadeId && size < this.counterSize && this.counterTimer > 0.6) return;
    const grew = cascadeId !== this.counterCascadeId || size > this.counterSize;
    this.counterCascadeId = cascadeId;
    this.counterSize = size;
    this.counterTimer = 1.6;
    this.counterValue.setText(`×${size}`);
    const color = size >= 10 ? 0xff6fd8 : size >= 5 ? COLORS.gold : 0xbfe4ff;
    this.counterValue.setColor(css(color));
    this.counterLabel.setText(size >= 15 ? 'COLOSSAL CASCADE' : size >= 10 ? 'MEGA CASCADE' : size >= 5 ? 'BIG CASCADE' : 'CASCADE');
    const mult = Math.min(SCORE.comboMax, 1 + SCORE.comboPerHit * (size - 1));
    this.counterMult.setText(`score ×${mult.toFixed(1)}`);
    if (grew) {
      this.scene.tweens.killTweensOf(this.counterValue);
      this.counterValue.setScale(1.4);
      this.scene.tweens.add({ targets: this.counterValue, scale: 1, duration: 180, ease: 'Back.Out' });
    }
  }

  banner(text: string, color: number = COLORS.text, sub = '', duration = 1400): void {
    this.scene.tweens.killTweensOf([this.bannerText, this.bannerSub]);
    this.bannerText.setText(text).setColor(css(color)).setAlpha(0).setScale(0.85);
    this.bannerSub.setText(sub).setAlpha(0);
    this.scene.tweens.add({ targets: [this.bannerText, this.bannerSub], alpha: 1, scale: 1, duration: 220, ease: 'Cubic.Out' });
    this.scene.tweens.add({ targets: [this.bannerText, this.bannerSub], alpha: 0, delay: duration, duration: 400 });
  }

  /** Queue a small toast under the top panel (e.g. a newly discovered reaction). */
  toast(title: string, body: string, color: number = COLORS.gold): void {
    this.toastQueue.push({ title, body, color });
  }

  hurt(): void {
    this.healthFlash = 0.6;
  }

  update(world: World, dt: number): void {
    this.counterTimer = Math.max(0, this.counterTimer - dt);
    const ca = Math.min(1, this.counterTimer / 0.4);
    this.counterValue.setAlpha(ca);
    this.counterLabel.setAlpha(ca);
    this.counterMult.setAlpha(ca);
    if (this.counterTimer <= 0) this.counterSize = 0;
    this.healthFlash = Math.max(0, this.healthFlash - dt);
    this.updateToast(dt);

    const act = world.act;
    const label = world.endless && world.wave > WAVES.total ? `ENDLESS · WAVE ${world.wave}` : `${paletteForAct(act).name.toUpperCase()} · WAVE ${world.wave}/${WAVES.total}`;
    this.waveText.setText(label);
    // Score counts up smoothly.
    this.shownScore += (world.stats.score - this.shownScore) * Math.min(1, dt * 8);
    if (Math.abs(world.stats.score - this.shownScore) < 1) this.shownScore = world.stats.score;
    this.scoreText.setText(`SCORE ${Math.round(this.shownScore).toLocaleString('en-US')}`);
    this.drawTop(world);
    this.drawBottom(world);
  }

  private updateToast(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      const a = Math.min(1, this.toastTimer / 0.4, (2.6 - this.toastTimer) / 0.25);
      for (const o of [this.toastBg, this.toastTitle, this.toastBody]) o.setAlpha(Math.max(0, a));
      return;
    }
    const next = this.toastQueue.shift();
    if (!next) return;
    this.toastTimer = 2.6;
    this.toastTitle.setText(next.title).setColor(css(next.color));
    this.toastBody.setText(next.body);
    const w = Math.max(this.toastBody.width, this.toastTitle.width) + 48;
    this.toastBg.clear();
    this.toastBg.fillStyle(COLORS.panel, 0.95);
    this.toastBg.fillRoundedRect(WORLD.width / 2 - w / 2, 112, w, 70, 14);
    this.toastBg.lineStyle(2, next.color, 1);
    this.toastBg.strokeRoundedRect(WORLD.width / 2 - w / 2, 112, w, 70, 14);
  }

  private drawTop(world: World): void {
    const g = this.top;
    g.clear();
    g.fillStyle(COLORS.panel, 0.97);
    g.fillRect(0, 0, WORLD.width, WORLD.arenaTop);
    g.lineStyle(2, COLORS.panelEdge, 1);
    g.lineBetween(0, WORLD.arenaTop, WORLD.width, WORLD.arenaTop);

    for (let i = 0; i < PLAYER.maxHealth; i++) {
      const filled = i < world.health;
      const x = 34 + i * 46;
      const flash = !filled && this.healthFlash > 0 && i === world.health;
      heart(g, x, 36, 15, filled ? COLORS.danger : flash ? 0xffffff : 0x2a2f55, filled ? 0xffb3c1 : 0x3a4070);
    }

    const r = world.runner;
    const planned = Math.max(r.totalPlanned, r.spawned, 1);
    const progress = Math.min(1, r.resolved / planned);
    const bw = 240;
    const bx = WORLD.width / 2 - bw / 2;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(bx, 50, bw, 8, 4);
    g.fillStyle(COLORS.good, 0.9);
    if (progress > 0) g.fillRoundedRect(bx, 50, Math.max(8, bw * progress), 8, 4);

    const px = WORLD.width - 46;
    g.fillStyle(COLORS.panelEdge, 0.6);
    g.fillRoundedRect(px - 30, 16, 60, 60, 12);
    g.fillStyle(COLORS.text, 1);
    g.fillRect(px - 11, 32, 8, 28);
    g.fillRect(px + 3, 32, 8, 28);
  }

  private drawBottom(world: World): void {
    const g = this.bottom;
    g.clear();
    g.fillStyle(COLORS.panel, 0.98);
    g.fillRect(0, BAR_Y, WORLD.width, WORLD.height - BAR_Y);
    g.lineStyle(2, COLORS.panelEdge, 1);
    g.lineBetween(0, BAR_Y, WORLD.width, BAR_Y);

    const owned = world.loadout.elements;
    const slots = Math.max(PLAYER.elementSlots, owned.length);
    const gap = slots > 4 ? 6 : 8;
    const w = (SLOT_AREA.w - gap * (slots - 1)) / slots;
    const h = SLOT_AREA.h;
    if (slots !== this.slotLayout) {
      this.slotLayout = slots;
      this.slotZones.forEach((zone, i) => {
        if (i >= slots) {
          zone.disableInteractive();
          this.slotLabels[i].setText('');
        } else {
          zone.setPosition(SLOT_AREA.x + w / 2 + i * (w + gap), SLOT_AREA.y).setSize(w, h).setInteractive({ useHandCursor: true });
        }
      });
    }
    for (let i = 0; i < slots; i++) {
      const label = this.slotLabels[i];
      const x = SLOT_AREA.x + w / 2 + i * (w + gap);
      const y = SLOT_AREA.y;
      const el = owned[i];
      if (!el) {
        // Empty slot: shows when the next element arrives.
        g.lineStyle(2, COLORS.panelEdge, 0.45);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
        const next = [1, 4, 8][i - 1];
        label.setPosition(x, y).setText(next ? `after\nwave ${next}` : '').setColor(css(COLORS.textDim)).setAlpha(0.6).setAlign('center');
        label.setFontSize(14);
        continue;
      }
      const sel = world.selected === el;
      const col = ELEMENT_COLORS[el];
      g.fillStyle(sel ? col.dark : 0x0a1230, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
      g.lineStyle(sel ? 5 : 2, col.main, sel ? 1 : 0.6);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
      const compact = slots > 4;
      drawIcon(g, el, x, y - (compact ? 10 : 16), compact ? 14 : sel ? 22 : 19);
      label.setPosition(x, y + (compact ? 30 : 32));
      label.setFontSize(compact ? 14 : 16);
      label.setText(compact ? `${i + 1}` : `${i + 1} ${UPGRADE_DEFS[el].name.toUpperCase()}`);
      label.setColor(sel ? '#ffffff' : css(col.main)).setAlpha(1);
    }

    // Acquired modifiers as an icon grid with level numerals.
    const mods = MODIFIER_IDS.filter((id) => world.loadout.levels[id] > 0 && id !== 'repair');
    const cap = CHIPS.cols * CHIPS.rows;
    const shown: ModifierId[] = mods.slice(0, mods.length > cap ? cap - 1 : cap);
    shown.forEach((id, i) => {
      const cx = CHIPS.x + (i % CHIPS.cols) * (CHIPS.w + CHIPS.gap);
      const cy = CHIPS.y + Math.floor(i / CHIPS.cols) * (CHIPS.h + CHIPS.gap);
      const combo = UPGRADE_DEFS[id].rarity === 'combo';
      g.fillStyle(0x0a1230, 1);
      g.fillRoundedRect(cx, cy, CHIPS.w, CHIPS.h, 8);
      g.lineStyle(2, combo ? COLORS.gold : COLORS.panelEdge, 1);
      g.strokeRoundedRect(cx, cy, CHIPS.w, CHIPS.h, 8);
      drawIcon(g, id, cx + CHIPS.w / 2, cy + CHIPS.h / 2 - (UPGRADE_DEFS[id].maxLevel > 1 ? 4 : 0), 11);
    });
    if (shown.length === 0) {
      g.lineStyle(2, COLORS.panelEdge, 0.4);
      g.strokeRoundedRect(CHIPS.x, CHIPS.y, CHIPS.cols * (CHIPS.w + CHIPS.gap) - CHIPS.gap, CHIPS.rows * (CHIPS.h + CHIPS.gap) - CHIPS.gap, 10);
    }
    const signature = `${mods.join(',')}|${mods.map((id) => world.loadout.levels[id]).join(',')}`;
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.chipTexts.forEach((t, i) => {
        const cx = CHIPS.x + (i % CHIPS.cols) * (CHIPS.w + CHIPS.gap) + CHIPS.w / 2;
        const cy = CHIPS.y + Math.floor(i / CHIPS.cols) * (CHIPS.h + CHIPS.gap) + CHIPS.h - 1;
        t.setPosition(cx, cy);
        const id = shown[i];
        if (i === cap - 1 && mods.length > cap) {
          t.setText(`+${mods.length - cap + 1}`).setFontSize(16).setOrigin(0.5, 0.5).setPosition(cx, cy - CHIPS.h / 2);
          return;
        }
        t.setOrigin(0.5, 1).setFontSize(12);
        if (!id || UPGRADE_DEFS[id].maxLevel <= 1) {
          t.setText('');
          return;
        }
        t.setText(ROMAN[world.loadout.levels[id]] ?? `${world.loadout.levels[id]}`);
      });
    }
  }
}

function heart(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, fill: number, edge: number): void {
  g.fillStyle(fill, 1);
  g.fillCircle(x - s * 0.5, y - s * 0.25, s * 0.55);
  g.fillCircle(x + s * 0.5, y - s * 0.25, s * 0.55);
  g.fillTriangle(x - s * 1.02, y - s * 0.05, x + s * 1.02, y - s * 0.05, x, y + s);
  g.lineStyle(2, edge, 0.6);
  g.strokeCircle(x - s * 0.5, y - s * 0.3, s * 0.18);
}

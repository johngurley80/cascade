import Phaser from 'phaser';
import { PLAYER, WAVES, WORLD } from '../config';
import { ELEMENT_ORDER, type Element } from '../logic/types';
import { MODIFIER_IDS, UPGRADE_DEFS } from '../logic/upgrades';
import type { World } from '../logic/world';
import { drawIcon } from './icons';
import { COLORS, ELEMENT_COLORS, FONT, css } from './theme';

export interface HudCallbacks {
  onSelect(element: Element): void;
  onPause(): void;
}

const BAR_Y = WORLD.arenaBottom;
const ELEMENT_BTN = { w: 150, h: 112, y: BAR_Y + 76, x0: 99, gap: 162 };
const ROMAN = ['', 'I', 'II', 'III'];

/** Top status panel, bottom element bar, upgrade chips, cascade counter and banners. */
export class Hud {
  private readonly top: Phaser.GameObjects.Graphics;
  private readonly bottom: Phaser.GameObjects.Graphics;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly elementLabels: Phaser.GameObjects.Text[] = [];
  private readonly chipTexts: Phaser.GameObjects.Text[] = [];
  private readonly counterLabel: Phaser.GameObjects.Text;
  private readonly counterValue: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private readonly bannerSub: Phaser.GameObjects.Text;
  private counterTimer = 0;
  private counterCascadeId = -1;
  private counterSize = 0;
  private lastSignature = '';
  private healthFlash = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cb: HudCallbacks,
    subtitle: string,
  ) {
    this.top = scene.add.graphics().setDepth(60);
    this.bottom = scene.add.graphics().setDepth(60);
    const style = (size: number, color: number = COLORS.text, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color: css(color),
      resolution: 2,
    });
    this.waveText = scene.add.text(WORLD.width / 2, 30, '', style(30)).setOrigin(0.5).setDepth(61);
    scene.add.text(WORLD.width / 2, 74, subtitle, style(15, COLORS.textDim, false)).setOrigin(0.5).setDepth(61);

    ELEMENT_ORDER.forEach((el, i) => {
      const x = ELEMENT_BTN.x0 + i * ELEMENT_BTN.gap;
      const label = scene.add
        .text(x, ELEMENT_BTN.y + 30, '', style(18))
        .setOrigin(0.5)
        .setDepth(62);
      this.elementLabels.push(label);
      const zone = scene.add
        .zone(x, ELEMENT_BTN.y, ELEMENT_BTN.w, ELEMENT_BTN.h)
        .setInteractive({ useHandCursor: true })
        .setDepth(63);
      zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        this.cb.onSelect(el);
      });
    });

    for (let i = 0; i < MODIFIER_IDS.length; i++) {
      const t = scene.add.text(0, 0, '', style(15)).setOrigin(0, 0.5).setDepth(62);
      this.chipTexts.push(t);
    }

    const pause = scene.add.zone(WORLD.width - 46, 46, 84, 84).setInteractive({ useHandCursor: true }).setDepth(63);
    pause.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.cb.onPause();
    });

    this.counterLabel = scene.add.text(WORLD.width / 2, 884, 'CASCADE', style(22, COLORS.textDim)).setOrigin(0.5).setDepth(55);
    this.counterValue = scene.add.text(WORLD.width / 2, 934, '', style(60)).setOrigin(0.5).setDepth(55);
    this.counterValue.setStroke('#04070f', 8);
    this.counterLabel.setStroke('#04070f', 6);
    this.counterLabel.setAlpha(0);
    this.counterValue.setAlpha(0);

    this.bannerText = scene.add.text(WORLD.width / 2, 520, '', style(64)).setOrigin(0.5).setDepth(70).setAlpha(0);
    this.bannerText.setStroke('#04070f', 10);
    this.bannerSub = scene.add.text(WORLD.width / 2, 584, '', style(24, COLORS.textDim)).setOrigin(0.5).setDepth(70).setAlpha(0);
    this.bannerSub.setStroke('#04070f', 6);
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
    this.counterLabel.setText(size >= 10 ? 'MEGA CASCADE' : size >= 5 ? 'BIG CASCADE' : 'CASCADE');
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

  hurt(): void {
    this.healthFlash = 0.6;
  }

  update(world: World, dt: number): void {
    this.counterTimer = Math.max(0, this.counterTimer - dt);
    const ca = Math.min(1, this.counterTimer / 0.4);
    this.counterValue.setAlpha(ca);
    this.counterLabel.setAlpha(ca);
    if (this.counterTimer <= 0) this.counterSize = 0;
    this.healthFlash = Math.max(0, this.healthFlash - dt);

    this.waveText.setText(world.wave >= WAVES.total ? `WAVE ${world.wave}/${WAVES.total} · BOSS` : `WAVE ${world.wave}/${WAVES.total}`);
    this.drawTop(world);
    this.drawBottom(world);
  }

  private drawTop(world: World): void {
    const g = this.top;
    g.clear();
    g.fillStyle(COLORS.panel, 0.97);
    g.fillRect(0, 0, WORLD.width, WORLD.arenaTop);
    g.lineStyle(2, COLORS.panelEdge, 1);
    g.lineBetween(0, WORLD.arenaTop, WORLD.width, WORLD.arenaTop);

    // Health.
    for (let i = 0; i < PLAYER.maxHealth; i++) {
      const filled = i < world.health;
      const x = 38 + i * 50;
      const flash = !filled && this.healthFlash > 0 && i === world.health;
      heart(g, x, 44, 17, filled ? COLORS.danger : flash ? 0xffffff : 0x2a2f55, filled ? 0xffb3c1 : 0x3a4070);
    }

    // Wave progress bar.
    const r = world.runner;
    const planned = Math.max(r.totalPlanned, r.spawned, 1);
    const progress = Math.min(1, r.resolved / planned);
    const bw = 220;
    const bx = WORLD.width / 2 - bw / 2;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(bx, 54, bw, 8, 4);
    g.fillStyle(COLORS.good, 0.9);
    if (progress > 0) g.fillRoundedRect(bx, 54, Math.max(8, bw * progress), 8, 4);

    // Pause button.
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

    ELEMENT_ORDER.forEach((el, i) => {
      const x = ELEMENT_BTN.x0 + i * ELEMENT_BTN.gap;
      const y = ELEMENT_BTN.y;
      const owned = world.loadout.elements.has(el);
      const sel = world.selected === el;
      const col = ELEMENT_COLORS[el];
      const w = ELEMENT_BTN.w;
      const h = ELEMENT_BTN.h;
      g.fillStyle(sel ? col.dark : 0x0a1230, owned ? 1 : 0.5);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.lineStyle(sel ? 5 : 2, owned ? col.main : COLORS.panelEdge, owned ? (sel ? 1 : 0.6) : 0.5);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      if (owned) {
        drawIcon(g, el, x, y - 14, sel ? 24 : 20, 1);
      } else {
        // Padlock.
        g.lineStyle(4, COLORS.textDim, 0.7);
        g.strokeCircle(x, y - 22, 10);
        g.fillStyle(COLORS.textDim, 0.7);
        g.fillRoundedRect(x - 16, y - 18, 32, 24, 4);
      }
      const label = this.elementLabels[i];
      label.setText(owned ? `${i + 1} ${UPGRADE_DEFS[el].name.toUpperCase()}` : `${i + 1} LOCKED`);
      label.setColor(owned ? (sel ? '#ffffff' : css(col.main)) : css(COLORS.textDim));
      label.setAlpha(owned ? 1 : 0.6);
    });

    // Acquired modifiers.
    const signature = MODIFIER_IDS.map((id) => world.loadout.levels[id]).join(',');
    const owned = MODIFIER_IDS.filter((id) => world.loadout.levels[id] > 0);
    owned.forEach((id, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 514 + col * 100;
      const cy = BAR_Y + 30 + row * 46;
      g.fillStyle(0x0a1230, 1);
      g.fillRoundedRect(cx, cy - 18, 94, 36, 10);
      g.lineStyle(2, COLORS.panelEdge, 1);
      g.strokeRoundedRect(cx, cy - 18, 94, 36, 10);
      drawIcon(g, id, cx + 18, cy, 11);
    });
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.chipTexts.forEach((t, i) => {
        const id = owned[i];
        if (!id) {
          t.setText('');
          return;
        }
        const lvl = world.loadout.levels[id];
        const max = UPGRADE_DEFS[id].maxLevel;
        t.setText(max > 1 ? `${UPGRADE_DEFS[id].short} ${ROMAN[lvl]}` : UPGRADE_DEFS[id].short);
        t.setPosition(514 + (i % 2) * 100 + 36, BAR_Y + 30 + Math.floor(i / 2) * 46);
      });
    }
    if (owned.length === 0) {
      g.lineStyle(2, COLORS.panelEdge, 0.5);
      g.strokeRoundedRect(514, BAR_Y + 12, 194, 128, 12);
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

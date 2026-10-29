import Phaser from 'phaser';
import { PLAYER, WORLD } from '../config';
import { partnersOf } from '../logic/codex';
import type { Element, UpgradeId } from '../logic/types';
import { UPGRADE_DEFS, levelOf, type Loadout, type OfferKind } from '../logic/upgrades';
import { Button } from './Button';
import { drawIcon, iconColor } from './icons';
import { COLORS, FONT, css } from './theme';

/** One-line role of each element, shown when picking. */
const ELEMENT_ROLE: Record<Element, string> = {
  fire: 'DAMAGE · BURN',
  water: 'SETUP · WET',
  lightning: 'CHAINS',
  frost: 'CONTROL · FREEZE',
  wind: 'CONTROL · GATHER',
  toxin: 'AMPLIFY · POISON',
  void: 'CONTROL · PULL',
};

const RARITY_LABEL = { element: 'NEW ELEMENT', common: 'COMMON', rare: 'RARE', combo: 'COMBO' } as const;
const RARITY_COLOR = { element: COLORS.gold, common: COLORS.textDim, rare: 0x9fd2ff, combo: COLORS.gold } as const;

export interface UpgradePanelOptions {
  offer: UpgradeId[];
  kind: OfferKind;
  clearedWave: number;
  loadout: Loadout;
  notice: string;
  rerollsLeft: number;
  onPick: (index: number) => void;
  onReroll: () => void;
}

/** Between-wave choice: the starting element grid, or up to three large cards. */
export class UpgradePanel {
  private container: Phaser.GameObjects.Container | null = null;
  private openedAt = 0;
  private opts: UpgradePanelOptions | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get visible(): boolean {
    return this.container !== null;
  }

  show(opts: UpgradePanelOptions): void {
    this.hide();
    this.opts = opts;
    this.openedAt = this.scene.time.now;
    const s = this.scene;
    const c = s.add.container(0, 0).setDepth(100);
    this.container = c;
    c.add(s.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x02040c, 0.84).setOrigin(0).setInteractive());

    const start = opts.kind === 'start';
    const title = start ? 'CHOOSE YOUR ELEMENT' : `WAVE ${opts.clearedWave} CLEARED`;
    const subtitle = start
      ? `Your first element. Every element you carry fires at once — up to ${PLAYER.elementSlots}.`
      : opts.kind === 'element'
        ? `Choose a new element (${opts.loadout.elements.length + 1} of ${PLAYER.elementSlots})`
        : 'Choose an upgrade';
    c.add(this.text(WORLD.width / 2, start ? 150 : 170, title, 48, start ? COLORS.text : COLORS.good, true));
    c.add(this.text(WORLD.width / 2, start ? 205 : 226, subtitle, 25, COLORS.text));
    if (opts.notice) c.add(this.text(WORLD.width / 2, 268, opts.notice, 21, COLORS.gold, true, 640));

    if (start) {
      const w = 330;
      const h = 196;
      opts.offer.forEach((id, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const lastAlone = i === opts.offer.length - 1 && opts.offer.length % 2 === 1;
        const x = lastAlone ? WORLD.width / 2 : WORLD.width / 2 + (col === 0 ? -1 : 1) * (w / 2 + 8);
        const y = 350 + row * (h + 14);
        c.add(this.card(id, i, x, y, w, h, true));
      });
      c.add(this.text(WORLD.width / 2, 1218, 'Tap a card  ·  or press 1–7', 20, COLORS.textDim));
      return;
    }

    const startY = opts.offer.length === 3 ? 450 : 520;
    opts.offer.forEach((id, i) => {
      const card = this.card(id, i, WORLD.width / 2, startY + i * 222, 640, 196, false);
      card.setAlpha(0);
      card.y += 30;
      s.tweens.add({ targets: card, alpha: 1, y: card.y - 30, duration: 240, delay: 80 + i * 70, ease: 'Cubic.Out' });
      c.add(card);
    });
    if (opts.kind === 'modifier' && opts.rerollsLeft > 0) {
      const reroll = new Button(s, WORLD.width / 2, 1110, {
        width: 280,
        height: 64,
        label: `REROLL (${opts.rerollsLeft})  ·  R`,
        fontSize: 22,
        onClick: () => this.reroll(),
      });
      c.add(reroll);
    } else {
      c.add(this.text(WORLD.width / 2, 1100, `Tap a card  ·  or press 1–${opts.offer.length}`, 20, COLORS.textDim));
    }
  }

  /** Keyboard selection. Ignored briefly after opening so held inputs don't pick by accident. */
  pick(index: number): void {
    if (!this.opts || this.scene.time.now - this.openedAt < 350 || index >= this.opts.offer.length) return;
    const cb = this.opts.onPick;
    this.opts = null;
    cb(index);
  }

  reroll(): void {
    if (!this.opts || this.opts.kind !== 'modifier' || this.opts.rerollsLeft <= 0) return;
    if (this.scene.time.now - this.openedAt < 350) return;
    this.opts.onReroll();
  }

  hide(): void {
    this.container?.destroy(true);
    this.container = null;
    this.opts = null;
  }

  private text(x: number, y: number, content: string, size: number, color: number, bold = false, wrap?: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, content, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color: css(color),
        resolution: 2,
        align: 'center',
        wordWrap: wrap ? { width: wrap } : undefined,
      })
      .setOrigin(0.5);
  }

  private card(id: UpgradeId, index: number, x: number, y: number, w: number, h: number, compact: boolean): Phaser.GameObjects.Container {
    const s = this.scene;
    const opts = this.opts!;
    const def = UPGRADE_DEFS[id];
    const accent = iconColor(id);
    const card = s.add.container(x, y);
    const bg = s.add.graphics();
    const iconX = compact ? -w / 2 + 44 : -w / 2 + 80;
    const iconY = compact ? -h / 2 + 46 : 0;
    const iconR = compact ? 30 : 54;
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.4);
      bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 20);
      bg.fillStyle(hover ? 0x16224a : COLORS.panel, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      bg.lineStyle(hover ? 5 : 3, def.rarity === 'combo' ? COLORS.gold : accent, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
      bg.fillStyle(0x060b1e, 1);
      bg.fillCircle(iconX, iconY, iconR);
      bg.lineStyle(2, accent, 0.6);
      bg.strokeCircle(iconX, iconY, iconR);
      drawIcon(bg, id, iconX, iconY, compact ? 18 : 30);
    };
    draw(false);
    card.add(bg);

    const textX = compact ? -w / 2 + 86 : -w / 2 + 156;
    const level = levelOf(opts.loadout, id);
    let tag: string = RARITY_LABEL[def.rarity];
    if (def.kind === 'element') tag = ELEMENT_ROLE[id as Element];
    else if (def.maxLevel > 1 && id !== 'repair') tag = `${tag} · ${level + 1}/${def.maxLevel}`;
    const name = this.text(0, 0, def.name.toUpperCase(), compact ? 26 : 34, accent, true).setOrigin(0, 0).setPosition(textX, -h / 2 + (compact ? 22 : 20));
    const tagText = this.text(0, 0, tag, compact ? 13 : 16, def.kind === 'element' ? accent : RARITY_COLOR[def.rarity], true)
      .setOrigin(compact ? 0 : 1, 0)
      .setPosition(compact ? textX : w / 2 - 24, compact ? -h / 2 + 54 : -h / 2 + 30)
      .setAlpha(def.kind === 'element' ? 0.85 : 1);
    const desc = s.add
      .text(compact ? -w / 2 + 18 : textX, compact ? -h / 2 + 84 : -h / 2 + 70, def.description, {
        fontFamily: FONT,
        fontSize: compact ? '16px' : '22px',
        color: css(COLORS.text),
        resolution: 2,
        wordWrap: { width: compact ? w - 36 : w - 186 },
        lineSpacing: compact ? 2 : 4,
      })
      .setOrigin(0, 0);
    const key = this.text(0, 0, `${index + 1}`, 20, COLORS.textDim, true).setOrigin(1, 1).setPosition(w / 2 - 16, h / 2 - 10);
    card.add([name, tagText, desc, key]);

    // Highlight elements that react with what you already carry.
    if (def.kind === 'element' && opts.loadout.elements.length > 0) {
      const partners = opts.loadout.elements.filter((e) => partnersOf(e).includes(id as Element));
      if (partners.length > 0) {
        const combo = this.text(0, 0, `REACTS WITH YOUR ${partners.map((p) => UPGRADE_DEFS[p].name.toUpperCase()).join(' + ')}`, 16, COLORS.gold, true)
          .setOrigin(0, 1)
          .setPosition(textX, h / 2 - 12);
        card.add(combo);
      }
    }

    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });
    let armed = false;
    card.on('pointerover', () => draw(true));
    card.on('pointerout', () => {
      armed = false;
      draw(false);
    });
    card.on('pointerdown', () => {
      if (this.scene.time.now - this.openedAt < 350) return;
      armed = true;
    });
    card.on('pointerup', () => {
      if (armed) this.pick(index);
      armed = false;
    });
    return card;
  }
}

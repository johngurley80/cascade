import Phaser from 'phaser';
import { WORLD } from '../config';
import type { UpgradeId } from '../logic/types';
import { UPGRADE_DEFS, levelOf, type Loadout } from '../logic/upgrades';
import { drawIcon, iconColor } from './icons';
import { COLORS, FONT, css } from './theme';

const CARD_W = 640;
const CARD_H = 196;

/** Between-wave upgrade choice: up to three large cards (tap/click or keys 1–3). */
export class UpgradePanel {
  private container: Phaser.GameObjects.Container | null = null;
  private openedAt = 0;
  private onPick: ((index: number) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get visible(): boolean {
    return this.container !== null;
  }

  show(offer: UpgradeId[], clearedWave: number, loadout: Loadout, notice: string, onPick: (index: number) => void): void {
    this.hide();
    this.onPick = onPick;
    this.openedAt = this.scene.time.now;
    const s = this.scene;
    const c = s.add.container(0, 0).setDepth(100);
    this.container = c;

    const dim = s.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x02040c, 0.82).setOrigin(0).setInteractive();
    c.add(dim);

    const elementPick = offer.every((id) => UPGRADE_DEFS[id].kind === 'element');
    const title = s.add
      .text(WORLD.width / 2, 170, `WAVE ${clearedWave} CLEARED`, {
        fontFamily: FONT,
        fontSize: '50px',
        fontStyle: 'bold',
        color: css(COLORS.good),
        resolution: 2,
      })
      .setOrigin(0.5);
    const subtitle = s.add
      .text(WORLD.width / 2, 228, elementPick ? 'Choose your second element' : 'Choose an upgrade', {
        fontFamily: FONT,
        fontSize: '28px',
        color: css(COLORS.text),
        resolution: 2,
      })
      .setOrigin(0.5);
    c.add([title, subtitle]);
    if (notice) {
      const n = s.add
        .text(WORLD.width / 2, 276, notice, {
          fontFamily: FONT,
          fontSize: '22px',
          fontStyle: 'bold',
          color: css(COLORS.gold),
          resolution: 2,
          align: 'center',
          wordWrap: { width: 620 },
        })
        .setOrigin(0.5);
      c.add(n);
    }

    const startY = offer.length === 3 ? 440 : 500;
    offer.forEach((id, i) => {
      const card = this.makeCard(id, i, loadout);
      card.setPosition(WORLD.width / 2, startY + i * (CARD_H + 26));
      card.setAlpha(0);
      card.y += 30;
      s.tweens.add({ targets: card, alpha: 1, y: card.y - 30, duration: 240, delay: 80 + i * 70, ease: 'Cubic.Out' });
      c.add(card);
    });

    const hint = s.add
      .text(WORLD.width / 2, 1060, 'Tap a card  ·  or press 1–' + offer.length, {
        fontFamily: FONT,
        fontSize: '20px',
        color: css(COLORS.textDim),
        resolution: 2,
      })
      .setOrigin(0.5);
    c.add(hint);
  }

  /** Keyboard selection. Ignored briefly after opening so held inputs don't pick by accident. */
  pick(index: number): void {
    if (!this.onPick || this.scene.time.now - this.openedAt < 350) return;
    const cb = this.onPick;
    this.onPick = null;
    cb(index);
  }

  hide(): void {
    this.container?.destroy(true);
    this.container = null;
    this.onPick = null;
  }

  private makeCard(id: UpgradeId, index: number, loadout: Loadout): Phaser.GameObjects.Container {
    const s = this.scene;
    const def = UPGRADE_DEFS[id];
    const accent = iconColor(id);
    const card = s.add.container(0, 0);
    const bg = s.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.4);
      bg.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 6, CARD_W, CARD_H, 20);
      bg.fillStyle(hover ? 0x16224a : COLORS.panel, 1);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
      bg.lineStyle(hover ? 5 : 3, accent, 1);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
      bg.fillStyle(0x060b1e, 1);
      bg.fillCircle(-CARD_W / 2 + 80, 0, 54);
      bg.lineStyle(2, accent, 0.6);
      bg.strokeCircle(-CARD_W / 2 + 80, 0, 54);
      drawIcon(bg, id, -CARD_W / 2 + 80, 0, 30);
    };
    draw(false);
    card.add(bg);

    const level = levelOf(loadout, id);
    const tag =
      def.kind === 'element' ? 'NEW ELEMENT' : def.maxLevel > 1 ? `LEVEL ${level + 1}/${def.maxLevel}` : 'ONCE';
    const name = s.add
      .text(-CARD_W / 2 + 156, -CARD_H / 2 + 22, def.name.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: css(accent),
        resolution: 2,
      })
      .setOrigin(0, 0);
    const tagText = s.add
      .text(CARD_W / 2 - 24, -CARD_H / 2 + 30, tag, {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: css(def.kind === 'element' ? COLORS.gold : COLORS.textDim),
        resolution: 2,
      })
      .setOrigin(1, 0);
    const desc = s.add
      .text(-CARD_W / 2 + 156, -CARD_H / 2 + 74, def.description, {
        fontFamily: FONT,
        fontSize: '23px',
        color: css(COLORS.text),
        resolution: 2,
        wordWrap: { width: CARD_W - 190 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    const key = s.add
      .text(CARD_W / 2 - 22, CARD_H / 2 - 16, `${index + 1}`, {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: css(COLORS.textDim),
        resolution: 2,
      })
      .setOrigin(1, 1);
    card.add([name, tagText, desc, key]);

    card.setSize(CARD_W, CARD_H);
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

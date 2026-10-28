import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { unlockAudio } from '../platform/settings';
import { COLORS, FONT, css } from './theme';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  fontSize?: number;
  accent?: number;
  primary?: boolean;
  onClick: () => void;
}

/**
 * A large, touch-friendly button. A click only fires if the press both started
 * and ended on the button, so a held fire input can't select it by accident.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  private armed = false;
  private hovered = false;
  private enabled = true;
  private readonly opts: ButtonOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, opts.label, {
        fontFamily: FONT,
        fontSize: `${opts.fontSize ?? 28}px`,
        fontStyle: 'bold',
        color: css(opts.primary ? COLORS.arena : COLORS.text),
        resolution: 2,
      })
      .setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.setSize(opts.width, opts.height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.armed = false;
      this.redraw();
    });
    this.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!this.enabled) return;
      unlockAudio();
      this.armed = true;
      this.redraw();
    });
    this.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!this.enabled || !this.armed) return;
      this.armed = false;
      this.redraw();
      sfx.play('click');
      this.opts.onClick();
    });
    this.redraw();
    scene.add.existing(this);
  }

  setLabel(label: string): this {
    this.text.setText(label);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { width: w, height: h, accent = COLORS.panelHi, primary } = this.opts;
    const g = this.bg;
    g.clear();
    const pressed = this.armed;
    const base = primary ? accent : COLORS.panel;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 14);
    g.fillStyle(base, this.enabled ? 1 : 0.4);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h, 14);
    g.lineStyle(3, this.hovered || pressed ? 0xffffff : accent, this.enabled ? 1 : 0.4);
    g.strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h, 14);
    this.text.setY(pressed ? 2 : 0);
    this.text.setAlpha(this.enabled ? 1 : 0.5);
  }
}

import Phaser from 'phaser';
import { WORLD } from '../config';
import { Button, type ButtonOptions } from './Button';
import { COLORS, FONT, css } from './theme';

/** A dimmed full-screen panel with a title, free text lines and stacked buttons. */
export class Overlay {
  readonly container: Phaser.GameObjects.Container;
  private cursorY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    titleColor: number = COLORS.text,
    top = 200,
  ) {
    const c = scene.add.container(0, 0).setDepth(110);
    this.container = c;
    const dim = scene.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x02040c, 0.86).setOrigin(0).setInteractive();
    c.add(dim);
    const t = scene.add
      .text(WORLD.width / 2, top, title, {
        fontFamily: FONT,
        fontSize: '64px',
        fontStyle: 'bold',
        color: css(titleColor),
        resolution: 2,
      })
      .setOrigin(0.5);
    t.setStroke('#04070f', 8);
    c.add(t);
    this.cursorY = top + 70;
  }

  text(content: string, size = 26, color: number = COLORS.text, gap = 14, bold = false): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(WORLD.width / 2, this.cursorY, content, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color: css(color),
        align: 'center',
        resolution: 2,
        wordWrap: { width: 620 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    this.container.add(t);
    this.cursorY += t.height + gap;
    return t;
  }

  space(px: number): void {
    this.cursorY += px;
  }

  button(opts: Omit<ButtonOptions, 'width' | 'height'> & { width?: number; height?: number }): Button {
    const h = opts.height ?? 84;
    const b = new Button(this.scene, WORLD.width / 2, this.cursorY + h / 2, { width: 420, height: h, ...opts });
    this.container.add(b);
    this.cursorY += h + 18;
    return b;
  }

  /** Two buttons side by side. */
  buttonRow(left: Omit<ButtonOptions, 'width' | 'height'>, right: Omit<ButtonOptions, 'width' | 'height'>): [Button, Button] {
    const h = 76;
    const y = this.cursorY + h / 2;
    const a = new Button(this.scene, WORLD.width / 2 - 155, y, { width: 290, height: h, fontSize: 24, ...left });
    const b = new Button(this.scene, WORLD.width / 2 + 155, y, { width: 290, height: h, fontSize: 24, ...right });
    this.container.add([a, b]);
    this.cursorY += h + 18;
    return [a, b];
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

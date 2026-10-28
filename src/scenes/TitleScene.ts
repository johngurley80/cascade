import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { WORLD } from '../config';
import { utcDateKey, type LaunchParams } from '../logic/params';
import { settings, setMuted, setReducedEffects } from '../platform/settings';
import { loadBest } from '../platform/storage';
import { Button } from '../ui/Button';
import { drawIcon } from '../ui/icons';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS, FONT, css } from '../ui/theme';
import { dailyRun, normalRun, type RunConfig } from './RunConfig';

interface Drifter {
  x: number;
  y: number;
  r: number;
  speed: number;
  sides: number;
  color: number;
  spin: number;
}

export class TitleScene extends Phaser.Scene {
  private deco!: Phaser.GameObjects.Graphics;
  private drifters: Drifter[] = [];
  private t = 0;

  constructor() {
    super('title');
  }

  create(): void {
    const params = this.registry.get('params') as LaunchParams;
    this.t = 0;
    this.cameras.main.setBackgroundColor(COLORS.arena);
    this.deco = this.add.graphics();
    this.drifters = [];
    const kinds = [ENEMY_COLORS.basic.edge, ENEMY_COLORS.fast.edge, ENEMY_COLORS.tank.edge];
    for (let i = 0; i < 16; i++) {
      this.drifters.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: 10 + Math.random() * 18,
        speed: 12 + Math.random() * 24,
        sides: [4, 3, 6][i % 3],
        color: kinds[i % 3],
        spin: Math.random() * 2,
      });
    }

    // Title: each letter shifts through the three element colours.
    const word = 'CASCADE';
    const palette = [ELEMENT_COLORS.fire.main, 0xffb347, ELEMENT_COLORS.lightning.main, 0xb8f06a, 0x7fe0ff, ELEMENT_COLORS.water.main, 0x7a8cff];
    const letterW = 82;
    word.split('').forEach((ch, i) => {
      const t = this.add
        .text(WORLD.width / 2 + (i - (word.length - 1) / 2) * letterW, 190, ch, {
          fontFamily: FONT,
          fontSize: '104px',
          fontStyle: 'bold',
          color: css(palette[i]),
          resolution: 2,
        })
        .setOrigin(0.5);
      t.setStroke('#04070f', 10);
      t.setShadow(0, 0, css(palette[i]), 24, true, true);
      this.tweens.add({ targets: t, y: 178, duration: 900, yoyo: true, repeat: -1, delay: i * 110, ease: 'Sine.InOut' });
    });
    this.add
      .text(WORLD.width / 2, 280, 'Choose your upgrades. Then one shot sets everything off.', {
        fontFamily: FONT,
        fontSize: '22px',
        color: css(COLORS.textDim),
        resolution: 2,
      })
      .setOrigin(0.5);

    this.drawHowTo(330);

    const startY = 860;
    new Button(this, WORLD.width / 2, startY, {
      width: 440,
      height: 96,
      label: 'PLAY',
      fontSize: 40,
      primary: true,
      accent: COLORS.good,
      onClick: () => this.start(normalRun(params)),
    });
    const today = utcDateKey(new Date());
    new Button(this, WORLD.width / 2, startY + 112, {
      width: 440,
      height: 76,
      label: `DAILY RUN · ${today}`,
      fontSize: 24,
      accent: COLORS.gold,
      onClick: () => this.start(dailyRun(params)),
    });
    const sound = new Button(this, WORLD.width / 2 - 112, startY + 208, {
      width: 216,
      height: 70,
      label: settings.muted ? 'SOUND: OFF' : 'SOUND: ON',
      fontSize: 22,
      onClick: () => {
        setMuted(!settings.muted);
        sound.setLabel(settings.muted ? 'SOUND: OFF' : 'SOUND: ON');
      },
    });
    const fx = new Button(this, WORLD.width / 2 + 112, startY + 208, {
      width: 216,
      height: 70,
      label: settings.reducedEffects ? 'FX: REDUCED' : 'FX: FULL',
      fontSize: 22,
      onClick: () => {
        setReducedEffects(!settings.reducedEffects);
        fx.setLabel(settings.reducedEffects ? 'FX: REDUCED' : 'FX: FULL');
      },
    });

    const best = loadBest();
    const bestLine =
      best.bestWave > 0
        ? `BEST  ·  wave ${best.bestWave}  ·  biggest cascade ${best.bestCascade}  ·  victories ${best.victories}`
        : 'Survive 8 waves and the boss. Chain reactions win.';
    this.add
      .text(WORLD.width / 2, WORLD.height - 50, bestLine, {
        fontFamily: FONT,
        fontSize: '19px',
        color: css(best.bestWave > 0 ? COLORS.gold : COLORS.textDim),
        resolution: 2,
      })
      .setOrigin(0.5);

    if (params.wave > 1 || params.unlockAll || params.seed !== null || params.speed > 1) {
      const bits = [
        params.wave > 1 ? `wave ${params.wave}` : '',
        params.unlockAll ? 'unlock all' : '',
        params.seed !== null ? `seed ${params.seed}` : '',
        params.speed > 1 ? `speed ×${params.speed}` : '',
      ].filter(Boolean);
      this.add
        .text(WORLD.width / 2, WORLD.height - 84, `Test parameters: ${bits.join(' · ')}`, {
          fontFamily: FONT,
          fontSize: '17px',
          color: css(COLORS.danger),
          resolution: 2,
        })
        .setOrigin(0.5);
    }

    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', () => this.start(normalRun(params)));
    kb?.on('keydown-SPACE', () => this.start(normalRun(params)));
    kb?.on('keydown-M', () => {
      setMuted(!settings.muted);
      sound.setLabel(settings.muted ? 'SOUND: OFF' : 'SOUND: ON');
    });
    this.input.on('pointerdown', () => sfx.unlock());

    if (params.daily) this.time.delayedCall(50, () => this.start(dailyRun(params)));
  }

  private drawHowTo(y: number): void {
    const g = this.add.graphics();
    const x0 = 48;
    const w = WORLD.width - 96;
    const h = 440;
    g.fillStyle(COLORS.panel, 0.92);
    g.fillRoundedRect(x0, y, w, h, 18);
    g.lineStyle(2, COLORS.panelEdge, 1);
    g.strokeRoundedRect(x0, y, w, h, 18);

    const label = (tx: number, ty: number, text: string, color: number = COLORS.text, size = 22, bold = false) =>
      this.add
        .text(tx, ty, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color), resolution: 2 })
        .setOrigin(0, 0.5);

    label(x0 + 28, y + 36, 'HOW TO PLAY', COLORS.textDim, 18, true);
    const rows: [string, string][] = [
      ['AIM', 'Mouse  ·  or drag on touch'],
      ['FIRE', 'Hold mouse / finger  ·  or Space'],
      ['ELEMENT', 'Keys 1–3  ·  or tap the buttons'],
      ['PAUSE', 'P / Esc  ·  or the pause button'],
    ];
    rows.forEach(([k, v], i) => {
      label(x0 + 28, y + 76 + i * 36, k, COLORS.gold, 20, true);
      label(x0 + 168, y + 76 + i * 36, v, COLORS.text, 21);
    });

    label(x0 + 28, y + 236, 'COMBINATIONS', COLORS.textDim, 18, true);
    const combos: { a: 'water'; b: 'fire' | 'lightning'; text: string }[] = [
      { a: 'water', b: 'fire', text: 'Water wets a crowd → Fire turns wet into STEAM' },
      { a: 'water', b: 'lightning', text: 'Water wets a crowd → Lightning CHAINS through it' },
    ];
    combos.forEach((c, i) => {
      const cy = y + 280 + i * 50;
      drawIcon(g, c.a, x0 + 44, cy, 15);
      g.lineStyle(3, COLORS.textDim, 1);
      g.lineBetween(x0 + 64, cy, x0 + 82, cy);
      drawIcon(g, c.b, x0 + 100, cy, 15);
      label(x0 + 130, cy, c.text, COLORS.text, 21);
    });
    label(x0 + 28, y + 392, 'Stop enemies before the red defence line. Survive 8 waves.', COLORS.textDim, 20);
  }

  private start(cfg: RunConfig): void {
    sfx.unlock();
    sfx.play('click');
    this.scene.start('game', cfg);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    this.t += dt;
    const g = this.deco;
    g.clear();
    g.lineStyle(1, COLORS.grid, 0.7);
    for (let x = 0; x <= WORLD.width; x += 60) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += 60) g.lineBetween(0, y, WORLD.width, y);
    for (const d of this.drifters) {
      d.y += d.speed * dt;
      if (d.y > WORLD.height + 40) {
        d.y = -40;
        d.x = Math.random() * WORLD.width;
      }
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < d.sides; i++) {
        const a = this.t * d.spin * 0.3 + (i / d.sides) * Math.PI * 2;
        pts.push(new Phaser.Math.Vector2(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r));
      }
      g.lineStyle(2, d.color, 0.25);
      g.strokePoints(pts, true);
    }
  }
}

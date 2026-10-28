import Phaser from 'phaser';
import { music } from '../audio/Music';
import { sfx } from '../audio/Sfx';
import { WORLD } from '../config';
import { REACTION_INFO } from '../logic/codex';
import { utcDateKey, type LaunchParams } from '../logic/params';
import { UPGRADE_DEFS } from '../logic/upgrades';
import { setMusic, setMuted, setReducedEffects, settings, unlockAudio } from '../platform/settings';
import { loadBest, loadCodex, loadLeaderboard, loadRun } from '../platform/storage';
import { Button } from '../ui/Button';
import { drawIcon, drawReactionIcon } from '../ui/icons';
import { Overlay } from '../ui/Overlay';
import { COLORS, ELEMENT_COLORS, ENEMY_COLORS, FONT, css } from '../ui/theme';
import { dailyRun, endlessRun, normalRun, resumeRun, type RunConfig } from './RunConfig';

interface Drifter {
  x: number;
  y: number;
  r: number;
  speed: number;
  sides: number;
  color: number;
  spin: number;
}

const label = (on: boolean, name: string, onText = 'ON', offText = 'OFF') => `${name}: ${on ? onText : offText}`;

export class TitleScene extends Phaser.Scene {
  private deco!: Phaser.GameObjects.Graphics;
  private drifters: Drifter[] = [];
  private t = 0;
  private panel: Overlay | null = null;

  constructor() {
    super('title');
  }

  create(): void {
    const params = this.registry.get('params') as LaunchParams;
    this.t = 0;
    this.panel = null;
    music.setIntensity(0);
    music.setBoss(false);
    this.cameras.main.setBackgroundColor(COLORS.arena);
    this.deco = this.add.graphics();
    this.drifters = [];
    const kinds = [ENEMY_COLORS.basic.edge, ENEMY_COLORS.fast.edge, ENEMY_COLORS.tank.edge, ENEMY_COLORS.volatile.edge];
    for (let i = 0; i < 16; i++) {
      this.drifters.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: 10 + Math.random() * 18,
        speed: 12 + Math.random() * 24,
        sides: [4, 3, 6, 8][i % 4],
        color: kinds[i % 4],
        spin: Math.random() * 2,
      });
    }

    // Title: each letter shifts through the element colours.
    const word = 'CASCADE';
    const palette = [ELEMENT_COLORS.fire.main, 0xffb347, ELEMENT_COLORS.lightning.main, ELEMENT_COLORS.toxin.main, ELEMENT_COLORS.frost.main, ELEMENT_COLORS.water.main, ELEMENT_COLORS.void.main];
    word.split('').forEach((ch, i) => {
      const t = this.add
        .text(WORLD.width / 2 + (i - (word.length - 1) / 2) * 82, 140, ch, { fontFamily: FONT, fontSize: '104px', fontStyle: 'bold', color: css(palette[i]), resolution: 2 })
        .setOrigin(0.5);
      t.setStroke('#04070f', 10);
      t.setShadow(0, 0, css(palette[i]), 24, true, true);
      this.tweens.add({ targets: t, y: 128, duration: 900, yoyo: true, repeat: -1, delay: i * 110, ease: 'Sine.InOut' });
    });
    this.text(WORLD.width / 2, 222, 'Choose your elements. Then one shot sets everything off.', 21, COLORS.textDim);

    this.drawHowTo(258);

    const best = loadBest();
    const saved = loadRun();
    const codex = loadCodex();
    let y = 680;
    if (saved) {
      const mode = saved.save.endless ? 'endless' : saved.daily ? 'daily' : 'run';
      new Button(this, WORLD.width / 2, y, {
        width: 460,
        height: 76,
        label: `CONTINUE ${mode.toUpperCase()} · WAVE ${saved.save.clearedWave + 1}`,
        fontSize: 25,
        primary: true,
        accent: COLORS.gold,
        onClick: () => this.start(resumeRun(params, saved)),
      });
      y += 92;
    }
    new Button(this, WORLD.width / 2, y + 8, {
      width: 460,
      height: 92,
      label: saved ? 'NEW RUN' : 'PLAY',
      fontSize: 38,
      primary: true,
      accent: COLORS.good,
      onClick: () => this.start(normalRun(params)),
    });
    y += 112;
    const today = utcDateKey(new Date());
    new Button(this, WORLD.width / 2 - 116, y, { width: 224, height: 70, label: `DAILY · ${today.slice(5)}`, fontSize: 22, accent: COLORS.gold, onClick: () => this.start(dailyRun(params)) });
    const endlessUnlocked = best.victories > 0 || params.unlockAll;
    const endless = new Button(this, WORLD.width / 2 + 116, y, {
      width: 224,
      height: 70,
      label: endlessUnlocked ? 'ENDLESS' : 'ENDLESS · LOCKED',
      fontSize: 22,
      accent: ELEMENT_COLORS.void.main,
      onClick: () => {
        if (endlessUnlocked) this.start(endlessRun(params));
      },
    });
    if (!endlessUnlocked) endless.setEnabled(false);
    y += 84;
    new Button(this, WORLD.width / 2 - 116, y, { width: 224, height: 70, label: `CODEX ${codex.size}/${REACTION_INFO.length}`, fontSize: 22, onClick: () => this.showCodex() });
    new Button(this, WORLD.width / 2 + 116, y, { width: 224, height: 70, label: 'RECORDS', fontSize: 22, onClick: () => this.showRecords() });
    y += 80;
    const sound = new Button(this, WORLD.width / 2 - 154, y, {
      width: 148,
      height: 60,
      label: label(!settings.muted, 'SOUND'),
      fontSize: 17,
      onClick: () => {
        setMuted(!settings.muted);
        sound.setLabel(label(!settings.muted, 'SOUND'));
      },
    });
    const mus = new Button(this, WORLD.width / 2, y, {
      width: 148,
      height: 60,
      label: label(settings.music, 'MUSIC'),
      fontSize: 17,
      onClick: () => {
        setMusic(!settings.music);
        if (settings.music) unlockAudio();
        mus.setLabel(label(settings.music, 'MUSIC'));
      },
    });
    const fx = new Button(this, WORLD.width / 2 + 154, y, {
      width: 148,
      height: 60,
      label: label(!settings.reducedEffects, 'FX', 'FULL', 'LOW'),
      fontSize: 17,
      onClick: () => {
        setReducedEffects(!settings.reducedEffects);
        fx.setLabel(label(!settings.reducedEffects, 'FX', 'FULL', 'LOW'));
      },
    });

    const bestLine =
      best.bestWave > 0
        ? `BEST  ·  wave ${best.bestWave}  ·  cascade ${best.bestCascade}  ·  wins ${best.victories}${best.bestEndlessWave ? `  ·  endless ${best.bestEndlessWave}` : ''}`
        : endlessUnlocked
          ? 'Endless mode unlocked.'
          : 'Win a run to unlock Endless mode.';
    this.text(WORLD.width / 2, WORLD.height - 44, bestLine, 18, best.bestWave > 0 ? COLORS.gold : COLORS.textDim);

    if (params.wave > 1 || params.unlockAll || params.seed !== null || params.speed > 1) {
      const bits = [
        params.wave > 1 ? `wave ${params.wave}` : '',
        params.unlockAll ? 'unlock all' : '',
        params.seed !== null ? `seed ${params.seed}` : '',
        params.speed > 1 ? `speed ×${params.speed}` : '',
      ].filter(Boolean);
      this.text(WORLD.width / 2, WORLD.height - 74, `Test parameters: ${bits.join(' · ')}`, 16, COLORS.danger);
    }

    const kb = this.input.keyboard;
    kb?.on('keydown', (ev: KeyboardEvent) => {
      unlockAudio();
      if (this.panel) {
        if (ev.key === 'Escape' || ev.key === 'Enter') this.closePanel();
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') this.start(normalRun(params));
      if (ev.key.toLowerCase() === 'm') {
        setMuted(!settings.muted);
        sound.setLabel(label(!settings.muted, 'SOUND'));
      }
    });
    this.input.on('pointerdown', () => unlockAudio());

    if (params.daily) this.time.delayedCall(50, () => this.start(dailyRun(params)));
  }

  private text(x: number, y: number, content: string, size: number, color: number, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color), resolution: 2 }).setOrigin(0.5);
  }

  private drawHowTo(y: number): void {
    const g = this.add.graphics();
    const x0 = 48;
    const w = WORLD.width - 96;
    const h = 368;
    g.fillStyle(COLORS.panel, 0.92);
    g.fillRoundedRect(x0, y, w, h, 18);
    g.lineStyle(2, COLORS.panelEdge, 1);
    g.strokeRoundedRect(x0, y, w, h, 18);

    const left = (tx: number, ty: number, text: string, color: number = COLORS.text, size = 21, bold = false) =>
      this.add.text(tx, ty, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color), resolution: 2 }).setOrigin(0, 0.5);

    left(x0 + 26, y + 32, 'HOW TO PLAY', COLORS.textDim, 17, true);
    const rows: [string, string][] = [
      ['AIM', 'Mouse  ·  or drag on touch'],
      ['FIRE', 'Hold mouse / finger  ·  or Space'],
      ['ELEMENT', 'Keys 1–4  ·  or tap the buttons'],
      ['PAUSE', 'P / Esc  ·  or the pause button'],
    ];
    rows.forEach(([k, v], i) => {
      left(x0 + 26, y + 68 + i * 34, k, COLORS.gold, 19, true);
      left(x0 + 160, y + 68 + i * 34, v, COLORS.text, 20);
    });

    left(x0 + 26, y + 222, `7 ELEMENTS · ${REACTION_INFO.length} REACTIONS TO DISCOVER`, COLORS.textDim, 17, true);
    const els = Object.keys(ELEMENT_COLORS) as (keyof typeof ELEMENT_COLORS)[];
    els.forEach((e, i) => drawIcon(g, e, x0 + 50 + i * 82, y + 268, 18));
    els.forEach((e, i) => this.text(x0 + 50 + i * 82, y + 302, UPGRADE_DEFS[e].name, 14, ELEMENT_COLORS[e].main, true));
    left(x0 + 26, y + 340, 'Water + Fire → Steam  ·  Frost on wet → Freeze → Shatter…', COLORS.text, 18);
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  private showCodex(): void {
    this.closePanel();
    const known = loadCodex();
    const o = new Overlay(this, 'CODEX', COLORS.gold, 76);
    this.panel = o;
    o.text(`${known.size} of ${REACTION_INFO.length} reactions discovered`, 20, COLORS.textDim, 6);
    const g = this.add.graphics();
    o.container.add(g);
    const detail = this.add
      .text(WORLD.width / 2, 1104, 'Tap a reaction to read about it.', { fontFamily: FONT, fontSize: '19px', color: css(COLORS.textDim), resolution: 2, align: 'center', wordWrap: { width: 620 } })
      .setOrigin(0.5, 0);
    o.container.add(detail);
    const cellW = 330;
    const cellH = 72;
    REACTION_INFO.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = WORLD.width / 2 + (col === 0 ? -cellW / 2 - 6 : cellW / 2 + 6);
      const y = 180 + row * (cellH + 4);
      const isKnown = known.has(r.id);
      g.fillStyle(isKnown ? 0x111c40 : 0x0a1230, 1);
      g.fillRoundedRect(x - cellW / 2, y, cellW, cellH, 10);
      g.lineStyle(2, isKnown ? (r.requires ? COLORS.gold : COLORS.panelHi) : COLORS.panelEdge, isKnown ? 1 : 0.5);
      g.strokeRoundedRect(x - cellW / 2, y, cellW, cellH, 10);
      drawReactionIcon(g, r.id, r.elements, x - cellW / 2 + 36, y + cellH / 2, 15, isKnown);
      const name = this.add
        .text(x - cellW / 2 + 70, y + 22, isKnown ? r.name : '???', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: css(isKnown ? COLORS.text : COLORS.textDim), resolution: 2 })
        .setOrigin(0, 0.5);
      const hint = isKnown ? r.recipe : r.enemy ? 'An enemy secret' : r.elements.map((e) => UPGRADE_DEFS[e].name).join(' + ') + (r.requires ? ' + upgrade' : '');
      const recipe = this.add
        .text(x - cellW / 2 + 70, y + 50, hint, { fontFamily: FONT, fontSize: '15px', color: css(COLORS.textDim), resolution: 2 })
        .setOrigin(0, 0.5);
      const zone = this.add.zone(x, y + cellH / 2, cellW, cellH).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        detail.setText(isKnown ? `${r.name.toUpperCase()} — ${r.description}` : 'Undiscovered. Try combining the elements shown.');
        detail.setColor(css(isKnown ? COLORS.text : COLORS.textDim));
        sfx.play('click');
      });
      o.container.add([name, recipe, zone]);
    });
    const close = new Button(this, WORLD.width / 2, 1210, { width: 300, height: 70, label: 'CLOSE', onClick: () => this.closePanel() });
    o.container.add(close);
  }

  private showRecords(): void {
    this.closePanel();
    const o = new Overlay(this, 'RECORDS', COLORS.gold, 110);
    this.panel = o;
    const best = loadBest();
    o.text(`Best wave ${best.bestWave}  ·  biggest cascade ${best.bestCascade}  ·  wins ${best.victories}  ·  endless ${best.bestEndlessWave}`, 19, COLORS.textDim, 20);
    const board = loadLeaderboard();
    const g = this.add.graphics();
    o.container.add(g);
    if (board.length === 0) {
      o.text('No finished runs yet.', 24, COLORS.text, 10);
    }
    board.forEach((e, i) => {
      const y = 250 + i * 74;
      g.fillStyle(i === 0 ? 0x1b2650 : 0x0d1736, 1);
      g.fillRoundedRect(40, y, WORLD.width - 80, 64, 10);
      g.lineStyle(2, i === 0 ? COLORS.gold : COLORS.panelEdge, 1);
      g.strokeRoundedRect(40, y, WORLD.width - 80, 64, 10);
      const t = (x: number, s: string, size: number, color: number, origin = 0) =>
        o.container.add(this.add.text(x, y + 32, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: css(color), resolution: 2 }).setOrigin(origin, 0.5));
      t(64, `${i + 1}`, 24, i === 0 ? COLORS.gold : COLORS.textDim);
      t(108, e.score.toLocaleString('en-US'), 24, COLORS.text);
      t(300, `W${e.wave}${e.victory ? ' ✓' : ''}`, 18, e.victory ? COLORS.good : COLORS.textDim);
      t(380, `×${e.cascade}`, 18, COLORS.gold);
      t(450, e.mode === 'normal' ? e.date.slice(5) : e.mode.toUpperCase(), 15, COLORS.textDim);
      e.elements.forEach((el, k) => drawIcon(g, el, 560 + k * 34, y + 32, 11));
    });
    const close = new Button(this, WORLD.width / 2, 1210, { width: 300, height: 70, label: 'CLOSE', onClick: () => this.closePanel() });
    o.container.add(close);
  }

  private start(cfg: RunConfig): void {
    unlockAudio();
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

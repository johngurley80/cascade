import Phaser from 'phaser';
import { WORLD } from './config';
import { parseParams } from './logic/params';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { COLORS } from './ui/theme';

const params = parseParams(window.location.search);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: COLORS.margin,
  disableContextMenu: true,
  banner: false,
  scale: {
    // Fixed gameplay coordinates; the canvas is scaled to fit and centred,
    // leaving dark margins on wide screens. Resizing never touches the run.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  render: { antialias: true, powerPreference: 'high-performance' },
  audio: { noAudio: true },
  scene: [TitleScene, GameScene],
  callbacks: {
    preBoot: (g) => g.registry.set('params', params),
  },
});

// Stop the page from scrolling/zooming when touching the game canvas only.
game.events.once(Phaser.Core.Events.READY, () => {
  const canvas = game.canvas;
  const block = (e: Event) => e.preventDefault();
  canvas.addEventListener('touchmove', block, { passive: false });
  canvas.addEventListener('touchstart', block, { passive: false });
  canvas.addEventListener('gesturestart', block);
});

import Phaser from 'phaser';

/**
 * Small white textures generated once at runtime (no image files). Effects and
 * projectiles are pooled sprites using these, tinted per element, so hundreds
 * of them draw in a few batched calls instead of being re-tessellated as
 * vector shapes every frame.
 */
export const TEX = {
  dot: 'fx-dot',
  spark: 'fx-spark',
  shard: 'fx-shard',
  puff: 'fx-puff',
  trail: 'fx-trail',
} as const;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  paint(tex.getContext());
  tex.refresh();
}

export function ensureTextures(scene: Phaser.Scene): void {
  // Soft round glow: solid core fading to transparent.
  canvasTexture(scene, TEX.dot, 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  // Very soft blob for steam and smoke.
  canvasTexture(scene, TEX.puff, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  // A streak: bright head on the right, fading tail to the left.
  canvasTexture(scene, TEX.spark, 64, 12, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(58, 1);
    ctx.arc(58, 6, 5, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  });
  // Projectile trail: a long tapered streak.
  canvasTexture(scene, TEX.trail, 128, 16, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(120, 1);
    ctx.arc(120, 8, 7, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  });
  // Shard: a sharp triangle with a slightly dimmer facet.
  canvasTexture(scene, TEX.shard, 16, 16, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(15, 8);
    ctx.lineTo(1, 1);
    ctx.lineTo(4, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(15, 8);
    ctx.lineTo(4, 15);
    ctx.lineTo(7, 8);
    ctx.closePath();
    ctx.fill();
  });
}

/** A recycled set of sprites. `begin` + `next` per frame, `end` hides the rest. */
export class SpritePool {
  private readonly items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  next(texture: string): Phaser.GameObjects.Image {
    let img = this.items[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, texture).setDepth(this.depth);
      this.items.push(img);
    } else if (img.texture.key !== texture) {
      img.setTexture(texture);
    }
    this.used++;
    img.setVisible(true).setOrigin(0.5);
    return img;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) {
      if (this.items[i].visible) this.items[i].setVisible(false);
    }
  }

  get size(): number {
    return this.items.length;
  }
}

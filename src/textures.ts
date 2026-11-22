import Phaser from 'phaser';
import { TEAM_COLORS, UNIT_TYPES } from './config';

type G = Phaser.GameObjects.Graphics;

export function makeTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: G) => void) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const shadow = (g: G, x = 16, y = 27, w = 24, h = 7) => g.fillStyle(0x000000, 0.25).fillEllipse(x, y, w, h);

  make('grass', 64, 64, (g) => {
    g.fillStyle(0x4e8a3a).fillRect(0, 0, 64, 64);
    const cols = [0x457d33, 0x5a9945, 0x3f7330, 0x63a24c];
    for (let i = 0; i < 110; i++) {
      g.fillStyle(cols[i % 4], 1).fillRect(Math.floor(Math.random() * 63), Math.floor(Math.random() * 62), 2, 2 + (i % 2));
    }
  });

  make('res_wood', 32, 32, (g) => {
    shadow(g);
    g.fillStyle(0x6b4423).fillRect(13, 17, 6, 11);
    g.fillStyle(0x24561f).fillCircle(16, 13, 12);
    g.fillStyle(0x2f7a2a).fillCircle(14, 11, 9);
    g.fillStyle(0x44a03a).fillCircle(11, 8, 4);
  });

  make('res_steel', 32, 32, (g) => {
    shadow(g, 16, 28, 26, 6);
    g.fillStyle(0x5c6169).fillPoints(
      [{ x: 4, y: 25 }, { x: 7, y: 11 }, { x: 15, y: 4 }, { x: 26, y: 8 }, { x: 29, y: 21 }, { x: 20, y: 29 }, { x: 9, y: 29 }], true);
    g.fillStyle(0x80868f).fillPoints([{ x: 8, y: 12 }, { x: 15, y: 6 }, { x: 24, y: 9 }, { x: 22, y: 17 }, { x: 12, y: 19 }], true);
    g.lineStyle(2, 0xe4edf7, 1).lineBetween(11, 23, 17, 20).lineBetween(19, 13, 24, 15).lineBetween(14, 10, 18, 9);
  });

  make('res_wire', 32, 32, (g) => {
    shadow(g, 16, 28, 24, 6);
    g.fillStyle(0x7a4a1f).fillCircle(16, 16, 12);
    g.lineStyle(2, 0xe0893a).strokeCircle(16, 16, 10).strokeCircle(16, 16, 7.5);
    g.lineStyle(2, 0xffb366).strokeCircle(16, 16, 5);
    g.fillStyle(0x3b2412).fillCircle(16, 16, 2.5);
    g.lineStyle(2, 0xe0893a).lineBetween(26, 18, 31, 26);
  });

  const horse = (g: G) => {
    g.fillStyle(0x4a2e15).fillRect(8, 18, 3, 9).fillRect(12, 19, 3, 8).fillRect(19, 19, 3, 8).fillRect(23, 18, 3, 9);
    g.fillStyle(0x8b5a2b).fillEllipse(16, 16, 22, 11);
    g.fillEllipse(26, 11, 7, 10).fillEllipse(29, 8, 8, 5);
    g.fillStyle(0x3b2412).fillRect(23, 5, 3, 8);
    g.lineStyle(3, 0x3b2412).lineBetween(5, 14, 2, 22);
    g.fillStyle(0x000000).fillCircle(29, 7, 1);
  };
  make('res_horse', 32, 32, (g) => { shadow(g, 16, 28, 26, 5); horse(g); });

  TEAM_COLORS.forEach((c, team) => {
    make(`player${team}`, 28, 28, (g) => {
      g.fillStyle(0xf0c8a0).fillCircle(21, 6, 4).fillCircle(21, 22, 4);
      g.fillStyle(c).fillCircle(13, 14, 10);
      g.lineStyle(2, 0xffffff).strokeCircle(13, 14, 10);
      g.fillStyle(0xf0c8a0).fillCircle(14, 14, 5);
    });

    for (const t of UNIT_TYPES) {
      make(`unit_${t}_${team}`, 32, 32, (g) => {
        if (t === 'defense') {
          g.fillStyle(0x000000, 0.25).fillCircle(16, 18, 12);
          g.fillStyle(c).fillCircle(13, 16, 10);
          g.lineStyle(2, 0x111111, 0.6).strokeCircle(13, 16, 10);
          g.fillStyle(0xaab4c0).fillRoundedRect(19, 3, 8, 26, 3);
          g.lineStyle(2, 0x55606c).strokeRoundedRect(19, 3, 8, 26, 3);
          g.fillStyle(c).fillCircle(23, 16, 2.5);
        } else if (t === 'melee') {
          g.fillStyle(0x000000, 0.25).fillCircle(15, 18, 10);
          g.fillStyle(c).fillCircle(14, 16, 9);
          g.lineStyle(2, 0x111111, 0.6).strokeCircle(14, 16, 9);
          g.lineStyle(3, 0xdfe6ee).lineBetween(18, 20, 29, 8);
          g.lineStyle(3, 0x6b4423).lineBetween(15, 18, 21, 23);
        } else if (t === 'range') {
          g.fillStyle(0x000000, 0.25).fillCircle(14, 18, 9);
          g.fillStyle(c).fillCircle(13, 16, 8);
          g.lineStyle(2, 0x111111, 0.6).strokeCircle(13, 16, 8);
          g.lineStyle(2, 0x8b5a2b);
          g.beginPath();
          g.arc(14, 16, 12, -1.2, 1.2, false);
          g.strokePath();
          const ex = 14 + 12 * Math.cos(1.2), ey = 12 * Math.sin(1.2);
          g.lineStyle(1, 0xeeeeee).lineBetween(ex, 16 - ey, ex, 16 + ey);
          g.lineStyle(1, 0xdddddd).lineBetween(12, 16, 28, 16);
        } else {
          g.fillStyle(0x000000, 0.25).fillEllipse(16, 19, 28, 14);
          g.fillStyle(0x8b5a2b).fillEllipse(15, 16, 24, 12);
          g.fillEllipse(27, 16, 9, 7);
          g.fillStyle(0x3b2412).fillRect(21, 14, 5, 4);
          g.fillStyle(c).fillCircle(13, 16, 7);
          g.lineStyle(2, 0xffffff, 0.9).strokeCircle(13, 16, 7);
          g.lineStyle(2, 0xdfe6ee).lineBetween(14, 9, 31, 7);
        }
      });
    }
  });

  make('arrow', 16, 4, (g) => {
    g.lineStyle(2, 0x8b5a2b).lineBetween(0, 2, 12, 2);
    g.fillStyle(0xdddddd).fillTriangle(11, 0, 16, 2, 11, 4);
    g.fillStyle(0xffffff).fillRect(0, 0, 3, 1).fillRect(0, 3, 3, 1);
  });

  make('px', 4, 4, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
}

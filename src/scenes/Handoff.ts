import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, TEAM_COLORS, TEAM_CSS } from '../config';
import { Button } from '../ui';

export interface HandoffData {
  title: string;
  lines: string[];
  button: string;
  next: string;
  nextData?: object;
  team?: number;
}

export class HandoffScene extends Phaser.Scene {
  constructor() { super('Handoff'); }

  create(d: HandoffData): void {
    const color = d.team !== undefined ? TEAM_CSS[d.team] : '#ffd54a';
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'grass').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.78).setOrigin(0);
    if (d.team !== undefined) this.add.image(GAME_W / 2, 170, `player${d.team}`).setScale(4);
    this.add.text(GAME_W / 2, 270, d.title, { fontFamily: FONT, fontSize: '64px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#000000', 8);
    this.add.text(GAME_W / 2, 380, d.lines.join('\n'), {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 10,
    }).setOrigin(0.5);
    let done = false;
    const go = (e?: KeyboardEvent) => {
      if (done || e?.repeat) return;
      done = true;
      this.scene.start(d.next, d.nextData ?? {});
    };
    new Button(this, GAME_W / 2, 560, d.button, () => go(), {
      w: 340, h: 64, fontSize: 26, fill: d.team !== undefined ? TEAM_COLORS[d.team] : 0x2e7d32,
    });
    this.add.text(GAME_W / 2, 615, 'or press ENTER', { fontFamily: FONT, fontSize: '16px', color: '#aab4c0' }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ENTER', go);
  }
}

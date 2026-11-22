import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, gatherTime, MAX_UNITS_PER_TEAM, recipeText, UNIT_INFO, UNIT_TYPES } from '../config';
import { newGame } from '../state';
import { Button } from '../ui';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'grass').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);

    this.add.text(GAME_W / 2, 80, 'WAR SIMULATOR', { fontFamily: FONT, fontSize: '72px', color: '#ffd54a', fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#000000', 8);
    this.add.text(GAME_W / 2, 140, 'Gather. Build. Battle.', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    const mins = Math.round(gatherTime() / 6) / 10;
    const how = [
      `1. Each player gets ${mins} min to gather resources (the map refills for Player 2).`,
      '    Move with WASD / Arrow keys. Left-click (or hold) nearby resources to break them.',
      '2. Spend your resources to build an army of soldiers.',
      '3. Both players place their units on their half of the battlefield.',
      '4. Press BATTLE and watch the AI armies fight it out!',
    ];
    this.add.text(170, 190, how.join('\n'), { fontFamily: FONT, fontSize: '20px', color: '#e8eef5', lineSpacing: 8 });

    this.add.text(GAME_W / 2, 375, 'UNITS', { fontFamily: FONT, fontSize: '24px', color: '#ffd54a', fontStyle: 'bold' }).setOrigin(0.5);
    UNIT_TYPES.forEach((t, i) => {
      const x = 200 + i * 290;
      this.add.image(x - 70, 440, `unit_${t}_0`).setScale(2);
      this.add.text(x - 30, 415, UNIT_INFO[t].label, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' });
      this.add.text(x - 30, 445, recipeText(t), { fontFamily: FONT, fontSize: '16px', color: '#ffd54a' });
      this.add.text(x - 110, 485, UNIT_INFO[t].desc, { fontFamily: FONT, fontSize: '15px', color: '#cfd8e3', wordWrap: { width: 250 } });
    });

    const startClassic = () => {
      newGame('classic');
      this.scene.start('Handoff', {
        title: 'Player 1',
        lines: ['Get ready to gather resources!', 'Player 2: no peeking.'],
        button: 'Start Gathering',
        next: 'Gather',
        nextData: { player: 0 },
        team: 0,
      });
    };
    const startCreative = () => {
      newGame('creative');
      this.scene.start('Handoff', {
        title: 'Creative Mode',
        lines: ['Unlimited resources — no gathering needed.', `Up to ${MAX_UNITS_PER_TEAM} units each, limited by space.`,
          'Player 1 positions units first. Player 2: look away!'],
        button: 'Player 1: Position Units',
        next: 'Battle',
        team: 0,
      });
    };
    new Button(this, GAME_W / 2 - 200, 625, 'CLASSIC', startClassic, { w: 280, h: 60, fontSize: 28, fill: 0x2e7d32 });
    new Button(this, GAME_W / 2 + 200, 625, 'CREATIVE', startCreative, { w: 280, h: 60, fontSize: 28, fill: 0x6a1b9a });
    const cap = { fontFamily: FONT, fontSize: '15px', color: '#cfd8e3' };
    this.add.text(GAME_W / 2 - 200, 670, 'Gather, build, then battle', cap).setOrigin(0.5, 0);
    this.add.text(GAME_W / 2 + 200, 670, 'Unlimited units, straight to battle', cap).setOrigin(0.5, 0);
    this.input.keyboard?.once('keydown-ENTER', startClassic);
  }
}

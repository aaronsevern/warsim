import Phaser from 'phaser';
import {
  FONT, GAME_H, GAME_W, RECIPES, recipeText, RES_INFO, RESOURCES, type ResourceType, TEAM_COLORS, TEAM_CSS, TEAM_NAMES,
  UNIT_INFO, UNIT_TYPES, type UnitType,
} from '../config';
import { type Army, emptyArmy, game, type Inventory } from '../state';
import { Button } from '../ui';

export class ShopScene extends Phaser.Scene {
  private pIdx = 0;
  private counts: Army = emptyArmy();
  private inv!: Inventory;
  private resTexts = {} as Record<ResourceType, Phaser.GameObjects.Text>;
  private countTexts = {} as Record<UnitType, Phaser.GameObjects.Text>;
  private plus = {} as Record<UnitType, Button[]>;
  private minus = {} as Record<UnitType, Button>;
  private totalText!: Phaser.GameObjects.Text;

  constructor() { super('Shop'); }

  init(d: { player: number }): void {
    this.pIdx = d.player ?? 0;
    this.counts = emptyArmy();
  }

  create(): void {
    this.inv = game.inventories[this.pIdx];
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'grass').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0);
    this.cameras.main.fadeIn(300);

    this.add.text(GAME_W / 2, 45, `${TEAM_NAMES[this.pIdx]} — Build Your Army`, {
      fontFamily: FONT, fontSize: '40px', color: TEAM_CSS[this.pIdx], fontStyle: 'bold',
    }).setOrigin(0.5).setStroke('#000000', 6);

    this.add.text(GAME_W / 2, 92, 'Resources left (unused resources are lost):', {
      fontFamily: FONT, fontSize: '18px', color: '#cfd8e3',
    }).setOrigin(0.5);
    RESOURCES.forEach((r, i) => {
      const x = 400 + i * 150;
      this.add.image(x, 130, RES_INFO[r].texture);
      this.resTexts[r] = this.add.text(x + 22, 130, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0, 0.5);
    });

    UNIT_TYPES.forEach((t, i) => {
      const y = 215 + i * 95;
      this.add.rectangle(GAME_W / 2, y, 1100, 84, 0xffffff, 0.06).setStrokeStyle(1, 0xffffff, 0.15);
      this.add.image(150, y, `unit_${t}_${this.pIdx}`).setScale(2.2);
      this.add.text(200, y - 30, UNIT_INFO[t].label, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', fontStyle: 'bold' });
      this.add.text(380, y - 24, `Cost: ${recipeText(t)}`, { fontFamily: FONT, fontSize: '18px', color: '#ffd54a' });
      this.add.text(200, y + 6, UNIT_INFO[t].desc, { fontFamily: FONT, fontSize: '16px', color: '#cfd8e3' });
      this.countTexts[t] = this.add.text(800, y, '0', { fontFamily: FONT, fontSize: '36px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.minus[t] = new Button(this, 880, y, '−', () => this.change(t, -1), { w: 50, h: 46, fontSize: 28 });
      this.plus[t] = [
        new Button(this, 945, y, '+', () => this.change(t, 1), { w: 50, h: 46, fontSize: 28 }),
        new Button(this, 1030, y, 'Max', () => this.change(t, 999), { w: 90, h: 46, fontSize: 20 }),
      ];
    });

    this.totalText = this.add.text(GAME_W / 2, 600, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    new Button(this, 480, 655, 'Clear', () => { this.counts = emptyArmy(); this.refresh(); }, { w: 160, h: 52 });
    new Button(this, 760, 655, 'Confirm Army', () => this.confirm(), { w: 300, h: 56, fontSize: 24, fill: TEAM_COLORS[this.pIdx] });
    this.refresh();
  }

  private remaining(): Inventory {
    const rem = { ...this.inv };
    for (const t of UNIT_TYPES) {
      for (const [r, n] of Object.entries(RECIPES[t])) rem[r as ResourceType] -= n! * this.counts[t];
    }
    return rem;
  }

  private canAfford(t: UnitType, rem: Inventory): boolean {
    return Object.entries(RECIPES[t]).every(([r, n]) => rem[r as ResourceType] >= n!);
  }

  private change(t: UnitType, delta: number): void {
    if (delta < 0) {
      this.counts[t] = Math.max(0, this.counts[t] + delta);
    } else {
      for (let i = 0; i < delta; i++) {
        if (!this.canAfford(t, this.remaining())) break;
        this.counts[t]++;
      }
    }
    this.refresh();
  }

  private refresh(): void {
    const rem = this.remaining();
    for (const r of RESOURCES) this.resTexts[r].setText(`${rem[r]} / ${this.inv[r]}`);
    let total = 0;
    for (const t of UNIT_TYPES) {
      total += this.counts[t];
      this.countTexts[t].setText(String(this.counts[t]));
      this.minus[t].setEnabled(this.counts[t] > 0);
      const ok = this.canAfford(t, rem);
      for (const b of this.plus[t]) b.setEnabled(ok);
    }
    this.totalText.setText(`Army size: ${total} soldier${total === 1 ? '' : 's'}`);
  }

  private confirm(): void {
    game.armies[this.pIdx] = { ...this.counts };
    if (this.pIdx === 0) {
      this.scene.start('Handoff', {
        title: 'Player 2',
        lines: ['Player 1 has built their army.', 'Pass the controls to Player 2.', 'The map has been fully replenished.'],
        button: 'Start Gathering', next: 'Gather', nextData: { player: 1 }, team: 1,
      });
    } else {
      this.scene.start('Handoff', {
        title: 'Battle Setup',
        lines: ['Both armies are built!', 'Player 1 positions their units first.', 'Player 2: look away!'],
        button: 'Player 1: Position Units', next: 'Battle', team: 0,
      });
    }
  }
}

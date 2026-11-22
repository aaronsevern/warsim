import Phaser from 'phaser';
import { FONT } from './config';

export interface ButtonOpts {
  w?: number;
  h?: number;
  fill?: number;
  fontSize?: number;
}

export class Button {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  enabled = true;
  selected = false;
  private hover = false;
  private fill: number;
  private hoverFill: number;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOpts = {}) {
    const w = opts.w ?? 180;
    const h = opts.h ?? 44;
    this.fill = opts.fill ?? 0x2c3e55;
    this.hoverFill = Phaser.Display.Color.IntegerToColor(this.fill).lighten(15).color;
    this.bg = scene.add.rectangle(x, y, w, h, this.fill).setStrokeStyle(2, 0xffffff, 0.5);
    this.text = scene.add
      .text(x, y, label, { fontFamily: FONT, fontSize: `${opts.fontSize ?? 20}px`, color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => { this.hover = true; this.refresh(); });
    this.bg.on('pointerout', () => { this.hover = false; this.refresh(); });
    this.bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.enabled && this.bg.visible && p.leftButtonDown()) onClick();
    });
  }

  private refresh(): void {
    const f = !this.enabled ? 0x3a3a3a : this.hover ? this.hoverFill : this.fill;
    this.bg.setFillStyle(f);
    if (this.selected) this.bg.setStrokeStyle(4, 0xffd54a, 1);
    else this.bg.setStrokeStyle(2, 0xffffff, 0.5);
    this.text.setAlpha(this.enabled ? 1 : 0.5);
  }

  setLabel(s: string): this { this.text.setText(s); return this; }
  setEnabled(b: boolean): this { this.enabled = b; this.refresh(); return this; }
  setSelected(b: boolean): this { this.selected = b; this.refresh(); return this; }
  setVisible(b: boolean): this { this.bg.setVisible(b); this.text.setVisible(b); return this; }
  setDepth(d: number): this { this.bg.setDepth(d); this.text.setDepth(d + 1); return this; }
  setScrollFactor(f: number): this { this.bg.setScrollFactor(f); this.text.setScrollFactor(f); return this; }
  objects(): Phaser.GameObjects.GameObject[] { return [this.bg, this.text]; }
  destroy(): void { this.bg.destroy(); this.text.destroy(); }
}

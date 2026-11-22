import Phaser from 'phaser';
import {
  FONT, GAME_H, GAME_W, gatherTime, MAP_H, MAP_W, PLAYER_RADIUS, PLAYER_SPEED, REACH, RES_INFO, RESOURCES,
  type ResourceType, SPAWN, TEAM_CSS, TEAM_NAMES, TILE, WORLD_H, WORLD_W,
} from '../config';
import { resolveCircle } from '../collision';
import { type Cell, generateMap } from '../mapgen';
import { emptyInv, game, type Inventory } from '../state';
import { Button } from '../ui';

interface Node { img: Phaser.GameObjects.Image; hp: number; type: ResourceType }

const HUD_H = 60;
const MM_W = 220;
const MM_H = (MM_W * WORLD_H) / WORLD_W;
const MM_X = GAME_W - MM_W - 12;
const MM_Y = GAME_H - MM_H - 12;
const HIT_INTERVAL = 200;

export class GatherScene extends Phaser.Scene {
  private pIdx = 0;
  private cells: Cell[] = [];
  private nodes = new Map<number, Node>();
  private player!: Phaser.GameObjects.Image;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private inv!: Inventory;
  private remaining = 0;
  private ended = false;
  private nextHit = 0;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private invTexts = {} as Record<ResourceType, Phaser.GameObjects.Text>;
  private timerText!: Phaser.GameObjects.Text;
  private hover!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Arc;
  private viewRect!: Phaser.GameObjects.Graphics;

  constructor() { super('Gather'); }

  init(d: { player: number }): void {
    this.pIdx = d.player ?? 0;
    this.nodes = new Map();
    this.hud = [];
    this.ended = false;
    this.nextHit = 0;
  }

  create(): void {
    this.inv = game.inventories[this.pIdx] = emptyInv();
    this.remaining = gatherTime();

    // --- world ---
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass').setOrigin(0);
    this.cells = generateMap(game.seed); // same seed => fully replenished map for each player
    this.cells.forEach((c, i) => {
      if (!c) return;
      const x = (i % MAP_W) * TILE + TILE / 2;
      const y = Math.floor(i / MAP_W) * TILE + TILE / 2;
      const img = this.add.image(x, y, RES_INFO[c].texture).setDepth(y);
      this.nodes.set(i, { img, hp: RES_INFO[c].hp, type: c });
    });
    this.player = this.add.image(SPAWN.x, SPAWN.y, `player${this.pIdx}`).setDepth(SPAWN.y);
    this.hover = this.add.graphics().setDepth(5000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.fadeIn(300);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as typeof this.keys;
    this.input.mouse?.disableContextMenu();

    this.buildHud();
    this.buildMinimap();
  }

  private addHud<T extends Phaser.GameObjects.GameObject & { setScrollFactor(f: number): T; setDepth(d: number): T }>(o: T): T {
    o.setScrollFactor(0).setDepth(10000);
    this.hud.push(o);
    return o;
  }

  private buildHud(): void {
    this.addHud(this.add.rectangle(0, 0, GAME_W, HUD_H, 0x000000, 0.6).setOrigin(0));
    this.addHud(this.add.text(16, 14, `${TEAM_NAMES[this.pIdx].toUpperCase()} — GATHER`, {
      fontFamily: FONT, fontSize: '24px', color: TEAM_CSS[this.pIdx], fontStyle: 'bold',
    }));
    this.timerText = this.addHud(this.add.text(GAME_W / 2 - 60, HUD_H / 2, '', {
      fontFamily: FONT, fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    RESOURCES.forEach((r, i) => {
      const x = 760 + i * 90;
      this.addHud(this.add.image(x, HUD_H / 2, RES_INFO[r].texture));
      this.invTexts[r] = this.addHud(this.add.text(x + 20, HUD_H / 2, '0', {
        fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0, 0.5));
    });
    const btn = new Button(this, 1205, HUD_H / 2, 'Finish', () => this.finish(), { w: 110, h: 38, fontSize: 18, fill: 0x8e3b3b });
    btn.setScrollFactor(0).setDepth(10000);
    this.hud.push(...btn.objects());

    this.addHud(this.add.text(12, GAME_H - 12, 'WASD / Arrows: move    Left-click (hold): break nearby resources', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 10, y: 6 },
    }).setOrigin(0, 1));
    this.addHud(this.add.rectangle(MM_X - 3, MM_Y - 3, MM_W + 6, MM_H + 6, 0x000000, 0.9).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.6));
    this.updateTimer();
  }

  private buildMinimap(): void {
    this.marker = this.add.circle(this.player.x, this.player.y, 40, 0xffeb3b).setDepth(9000);
    this.viewRect = this.add.graphics().setDepth(9001);
    this.cameras.main.ignore([this.marker, this.viewRect]);
    const mm = this.cameras.add(MM_X, MM_Y, MM_W, MM_H).setZoom(MM_W / WORLD_W).setBackgroundColor(0x2d4f22);
    mm.centerOn(WORLD_W / 2, WORLD_H / 2);
    mm.ignore([...this.hud, this.hover, this.player]);
  }

  private isBlocked = (tx: number, ty: number): boolean =>
    tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || this.cells[ty * MAP_W + tx] !== null;

  private overHud(p: Phaser.Input.Pointer): boolean {
    return p.y < HUD_H || (p.x > MM_X - 6 && p.y > MM_Y - 6);
  }

  private updateTimer(): void {
    const s = Math.max(0, Math.ceil(this.remaining));
    this.timerText.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    this.timerText.setColor(s <= 15 ? '#ff5252' : s <= 30 ? '#ffd54a' : '#ffffff');
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(delta, 50) / 1000;
    this.remaining -= dt;
    this.updateTimer();
    if (this.remaining <= 0) { this.finish(); return; }

    // movement
    const k = this.keys;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    const pos = { x: this.player.x + mx * PLAYER_SPEED * dt, y: this.player.y + my * PLAYER_SPEED * dt };
    resolveCircle(pos, PLAYER_RADIUS, this.isBlocked);
    this.player.setPosition(pos.x, pos.y).setDepth(pos.y);

    // aim / hover
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    this.player.setRotation(Math.atan2(wp.y - pos.y, wp.x - pos.x));
    const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
    const idx = ty * MAP_W + tx;
    const node = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !this.overHud(ptr) ? this.nodes.get(idx) : undefined;
    this.hover.clear();
    if (node) {
      const inReach = Math.hypot(node.img.x - pos.x, node.img.y - pos.y) <= REACH;
      this.hover.lineStyle(2, inReach ? 0x76ff03 : 0xff5252, 0.9).strokeRect(tx * TILE, ty * TILE, TILE, TILE);
      if (inReach && ptr.leftButtonDown() && time >= this.nextHit) {
        this.nextHit = time + HIT_INTERVAL;
        this.hit(idx, node);
      }
    }

    // minimap
    this.marker.setPosition(pos.x, pos.y);
    const v = this.cameras.main.worldView;
    this.viewRect.clear().lineStyle(14, 0xffffff, 0.9).strokeRect(v.x, v.y, v.width, v.height);
  }

  private hit(idx: number, node: Node): void {
    node.hp--;
    const info = RES_INFO[node.type];
    this.tweens.add({ targets: node.img, angle: { from: Phaser.Math.Between(-12, 12), to: 0 }, duration: 140 });
    for (let i = 0; i < 4; i++) {
      const chip = this.add.image(node.img.x, node.img.y, 'px').setTint(info.color).setDepth(6000);
      this.tweens.add({
        targets: chip, x: chip.x + Phaser.Math.Between(-24, 24), y: chip.y + Phaser.Math.Between(-24, 10),
        alpha: 0, duration: 350, onComplete: () => chip.destroy(),
      });
    }
    if (node.hp > 0) return;

    this.inv[node.type]++;
    this.cells[idx] = null;
    this.nodes.delete(idx);
    this.tweens.add({ targets: node.img, scale: 0, alpha: 0, duration: 150, onComplete: () => node.img.destroy() });
    const t = this.add.text(node.img.x, node.img.y - 16, `+1 ${info.label}`, {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7000).setStroke('#000000', 4);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    const txt = this.invTexts[node.type];
    txt.setText(String(this.inv[node.type]));
    this.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 200 });
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Shop', { player: this.pIdx });
    });
  }
}

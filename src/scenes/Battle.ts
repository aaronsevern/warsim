import Phaser from 'phaser';
import {
  FONT, GAME_H, GAME_W, MAP_H, MAP_W, RES_INFO, TEAM_COLORS, TEAM_CSS, TEAM_NAMES, TILE, UNIT_INFO, UNIT_TYPES,
  type UnitType, WORLD_H, WORLD_W,
} from '../config';
import { generateMap, largestComponent } from '../mapgen';
import { type Arrow, BattleSim, MAX_BATTLE_TIME, type Result, type Unit } from '../battle/sim';
import { type Army, game, newGame } from '../state';
import { Button } from '../ui';

type Phase = 'place' | 'handoff' | 'ready' | 'fight' | 'over';
type Img = Phaser.GameObjects.Image;

const BAR_H = 80;
const S = Math.min(GAME_W / WORLD_W, (GAME_H - BAR_H) / WORLD_H); // 0.5
const OFF_X = (GAME_W - WORLD_W * S) / 2;
const OFF_Y = 0;
const ZONE_COLS = 28; // P1: x < 28, P2: x >= MAP_W - 28
const SPEEDS = [1, 2, 4];

export class BattleScene extends Phaser.Scene {
  private phase: Phase = 'place';
  private team = 0;
  private blocked = new Uint8Array(0);
  private reachable = new Uint8Array(0);
  private world!: Phaser.GameObjects.Container;
  private zoneG!: Phaser.GameObjects.Graphics;
  private unitC!: Phaser.GameObjects.Container;
  private arrowC!: Phaser.GameObjects.Container;
  private fxC!: Phaser.GameObjects.Container;
  private hpG!: Phaser.GameObjects.Graphics;
  private placeC: Phaser.GameObjects.Container[] = [];
  private placed: Map<number, { type: UnitType; img: Img }>[] = [];
  private pool: Army[] = [];
  private selected: UnitType = 'defense';
  private ghost!: Img;
  private banner!: Phaser.GameObjects.Text;
  private palette = {} as Record<UnitType, Button>;
  private placeBtns: Button[] = [];
  private battleBtn!: Button;
  private speedBtn!: Button;
  private speedIdx = 0;
  private panelTexts: Phaser.GameObjects.Text[][] = [];
  private timeText!: Phaser.GameObjects.Text;
  private sim: BattleSim | null = null;

  constructor() { super('Battle'); }

  init(): void {
    this.phase = 'place';
    this.team = 0;
    this.placed = [new Map(), new Map()];
    this.pool = game.armies.map((a) => ({ ...a }));
    this.sim = null;
    this.speedIdx = 0;
    this.panelTexts = [];
    this.placeBtns = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x10151c).fadeIn(300);
    this.input.mouse?.disableContextMenu();

    // ---- world (whole map, scaled to fit; resources reset as obstacles) ----
    const cells = generateMap(game.seed);
    this.blocked = new Uint8Array(cells.map((c) => (c ? 1 : 0)));
    this.reachable = largestComponent(this.blocked);
    this.world = this.add.container(OFF_X, OFF_Y).setScale(S);
    this.world.add(this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass').setOrigin(0));
    this.zoneG = this.add.graphics();
    this.world.add(this.zoneG);
    cells.forEach((c, i) => {
      if (!c) return;
      this.world.add(this.add.image((i % MAP_W) * TILE + TILE / 2, Math.floor(i / MAP_W) * TILE + TILE / 2, RES_INFO[c].texture));
    });
    this.unitC = this.add.container();
    this.placeC = [this.add.container(), this.add.container()];
    this.arrowC = this.add.container();
    this.fxC = this.add.container();
    this.hpG = this.add.graphics();
    this.ghost = this.add.image(0, 0, 'unit_defense_0').setAlpha(0.55).setVisible(false);
    this.world.add([this.placeC[0], this.placeC[1], this.unitC, this.arrowC, this.fxC, this.hpG, this.ghost]);
    this.world.add(this.add.rectangle(0, 0, WORLD_W, WORLD_H).setOrigin(0).setStrokeStyle(4, 0x000000, 0.8));

    this.buildHud();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onDown(p, over));
    UNIT_TYPES.forEach((t, i) => {
      this.input.keyboard?.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`, () => this.select(t));
    });

    this.beginPlacement(0);
  }

  // ---------------- HUD ----------------

  private buildHud(): void {
    this.add.rectangle(0, GAME_H - BAR_H, GAME_W, BAR_H, 0x0d1117, 0.95).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.2);
    UNIT_TYPES.forEach((t, i) => {
      this.palette[t] = new Button(this, 105 + i * 180, GAME_H - BAR_H / 2, '', () => this.select(t), { w: 170, h: 52, fontSize: 18 });
    });
    this.placeBtns = [
      new Button(this, 885, GAME_H - BAR_H / 2, 'Auto-place', () => { this.autoPlace(this.team); this.refreshPlacement(); }, { w: 140, h: 52, fontSize: 18 }),
      new Button(this, 1035, GAME_H - BAR_H / 2, 'Clear', () => this.clearTeam(this.team), { w: 130, h: 52, fontSize: 18 }),
      new Button(this, 1185, GAME_H - BAR_H / 2, 'Done ✓', () => this.donePlacing(), { w: 160, h: 52, fontSize: 20, fill: 0x2e7d32 }),
    ];
    this.battleBtn = new Button(this, GAME_W / 2, GAME_H - BAR_H / 2, '⚔  BATTLE!  ⚔', () => this.startFight(), {
      w: 320, h: 60, fontSize: 28, fill: 0xc62828,
    }).setVisible(false);
    this.speedBtn = new Button(this, 1150, GAME_H - BAR_H / 2, 'Speed: 1x', () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.speedBtn.setLabel(`Speed: ${SPEEDS[this.speedIdx]}x`);
    }, { w: 160, h: 52, fontSize: 20 }).setVisible(false);
    this.timeText = this.add.text(130, GAME_H - BAR_H / 2, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
      .setOrigin(0, 0.5).setVisible(false);

    this.banner = this.add.text(GAME_W / 2, 22, '', {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 14, y: 6 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(50);

    // side panels: unit counts per team
    for (let team = 0; team < 2; team++) {
      const cx = team === 0 ? OFF_X / 2 : GAME_W - OFF_X / 2;
      this.add.text(cx, 20, TEAM_NAMES[team].toUpperCase(), { fontFamily: FONT, fontSize: '18px', color: TEAM_CSS[team], fontStyle: 'bold' })
        .setOrigin(0.5, 0);
      this.panelTexts[team] = UNIT_TYPES.map((t, i) => {
        const y = 80 + i * 60;
        this.add.image(cx - 22, y, `unit_${t}_${team}`).setScale(1.3);
        return this.add.text(cx + 2, y, '0', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
      });
    }
    this.refreshPanels();
  }

  private refreshPanels(): void {
    for (let team = 0; team < 2; team++) {
      UNIT_TYPES.forEach((t, i) => {
        let n = game.armies[team][t];
        if (this.sim) n = this.sim.units.filter((u) => u.team === team && u.type === t).length;
        this.panelTexts[team][i].setText(String(n));
      });
    }
  }

  // ---------------- placement ----------------

  private inZone(team: number, tx: number): boolean {
    return team === 0 ? tx < ZONE_COLS : tx >= MAP_W - ZONE_COLS;
  }

  private canPlaceAt(team: number, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || !this.inZone(team, tx)) return false;
    const i = ty * MAP_W + tx;
    return !this.blocked[i] && this.reachable[i] === 1 && !this.placed[team].has(i);
  }

  private beginPlacement(team: number): void {
    this.phase = 'place';
    this.team = team;
    this.placeC[team].setVisible(true);
    this.placeC[1 - team].setVisible(false); // no peeking at the opponent
    const x0 = team === 0 ? 0 : (MAP_W - ZONE_COLS) * TILE;
    this.zoneG.clear().fillStyle(TEAM_COLORS[team], 0.16).fillRect(x0, 0, ZONE_COLS * TILE, WORLD_H)
      .lineStyle(6, TEAM_COLORS[team], 0.8).strokeRect(x0, 0, ZONE_COLS * TILE, WORLD_H);
    this.banner.setText(`${TEAM_NAMES[team]}: place your units in the highlighted zone.  Left-click place · Right-click remove · 1-4 select`)
      .setColor(TEAM_CSS[team]);
    const first = UNIT_TYPES.find((t) => this.pool[team][t] > 0);
    this.select(first ?? 'defense');
  }

  private select(t: UnitType): void {
    if (this.phase !== 'place') return;
    this.selected = t;
    this.ghost.setTexture(`unit_${t}_${this.team}`).setRotation(this.team === 0 ? 0 : Math.PI);
    this.refreshPlacement();
  }

  private refreshPlacement(): void {
    const pool = this.pool[this.team];
    for (const t of UNIT_TYPES) {
      this.palette[t].setLabel(`${t === this.selected ? '▶ ' : ''}${UNIT_INFO[t].label} ×${pool[t]}`)
        .setEnabled(pool[t] > 0).setSelected(t === this.selected);
    }
    const left = UNIT_TYPES.reduce((s, t) => s + pool[t], 0);
    this.placeBtns[2].setLabel(left > 0 ? `Done (${left} left)` : 'Done ✓');
  }

  private toTile(p: Phaser.Input.Pointer): { tx: number; ty: number } {
    return { tx: Math.floor((p.x - OFF_X) / S / TILE), ty: Math.floor((p.y - OFF_Y) / S / TILE) };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'place') { this.ghost.setVisible(false); return; }
    const { tx, ty } = this.toTile(p);
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && p.y < GAME_H - BAR_H;
    this.ghost.setVisible(inside && this.pool[this.team][this.selected] > 0)
      .setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    if (this.canPlaceAt(this.team, tx, ty)) this.ghost.clearTint(); else this.ghost.setTint(0xff3333);
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.phase !== 'place' || over.length || p.y >= GAME_H - BAR_H) return;
    const { tx, ty } = this.toTile(p);
    const i = ty * MAP_W + tx;
    if (p.rightButtonDown()) {
      const e = this.placed[this.team].get(i);
      if (e) {
        e.img.destroy();
        this.placed[this.team].delete(i);
        this.pool[this.team][e.type]++;
        this.refreshPlacement();
      }
      return;
    }
    if (this.pool[this.team][this.selected] <= 0 || !this.canPlaceAt(this.team, tx, ty)) return;
    this.placeUnit(this.team, this.selected, i);
    if (this.pool[this.team][this.selected] === 0) {
      const next = UNIT_TYPES.find((t) => this.pool[this.team][t] > 0);
      if (next) this.selected = next;
      this.ghost.setTexture(`unit_${this.selected}_${this.team}`);
    }
    this.refreshPlacement();
    this.onMove(p);
  }

  private placeUnit(team: number, type: UnitType, i: number): void {
    const img = this.add.image((i % MAP_W) * TILE + TILE / 2, Math.floor(i / MAP_W) * TILE + TILE / 2, `unit_${type}_${team}`)
      .setRotation(team === 0 ? 0 : Math.PI);
    this.placeC[team].add(img);
    this.placed[team].set(i, { type, img });
    this.pool[team][type]--;
  }

  /** Formation: defense in front, melee & cavalry behind, archers at the back. */
  private autoPlace(team: number): void {
    const total = UNIT_TYPES.reduce((s, t) => s + this.pool[team][t] + 0, 0) + this.placed[team].size;
    const band = Math.min(MAP_H, Math.max(8, Math.ceil(Math.sqrt(total) * 1.6)));
    const cy = (MAP_H - 1) / 2;
    const cands: { i: number; key: number }[] = [];
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (!this.canPlaceAt(team, tx, ty)) continue;
        const rank = team === 0 ? ZONE_COLS - 1 - tx : tx - (MAP_W - ZONE_COLS);
        const off = Math.abs(ty - cy);
        cands.push({ i: ty * MAP_W + tx, key: (off > band / 2 ? 100000 : 0) + rank * 1000 + off });
      }
    }
    cands.sort((a, b) => a.key - b.key);
    let k = 0;
    for (const t of ['defense', 'melee', 'rideable', 'range'] as UnitType[]) {
      while (this.pool[team][t] > 0 && k < cands.length) this.placeUnit(team, t, cands[k++].i);
    }
  }

  private clearTeam(team: number): void {
    for (const e of this.placed[team].values()) {
      e.img.destroy();
      this.pool[team][e.type]++;
    }
    this.placed[team].clear();
    this.refreshPlacement();
  }

  private donePlacing(): void {
    if (this.phase !== 'place') return;
    this.autoPlace(this.team);
    this.ghost.setVisible(false);
    if (this.team === 0) {
      this.phase = 'handoff';
      this.placeC[0].setVisible(false);
      this.zoneG.clear();
      this.overlay(TEAM_NAMES[1], ['Player 1 has positioned their army.', 'Pass the controls to Player 2.'],
        'Player 2: Position Units', TEAM_COLORS[1], () => this.beginPlacement(1));
    } else {
      this.toReady();
    }
  }

  private toReady(): void {
    this.phase = 'ready';
    this.zoneG.clear();
    this.placeC[0].setVisible(true);
    this.placeC[1].setVisible(true);
    for (const t of UNIT_TYPES) this.palette[t].setVisible(false);
    for (const b of this.placeBtns) b.setVisible(false);
    this.battleBtn.setVisible(true);
    this.banner.setText('Both armies are in position. Click BATTLE to begin!').setColor('#ffd54a');
  }

  private overlay(title: string, lines: string[], btnLabel: string, color: number, onGo: () => void, extra?: [string, () => void]): void {
    const objs: { destroy(): void }[] = [];
    const bg = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0).setDepth(100).setInteractive();
    objs.push(bg);
    objs.push(this.add.text(GAME_W / 2, 230, title, {
      fontFamily: FONT, fontSize: '64px', color: '#' + color.toString(16).padStart(6, '0'), fontStyle: 'bold',
    }).setOrigin(0.5).setStroke('#000000', 8).setDepth(101));
    objs.push(this.add.text(GAME_W / 2, 340, lines.join('\n'), {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 10,
    }).setOrigin(0.5).setDepth(101));
    const close = () => objs.forEach((o) => o.destroy());
    const b = new Button(this, extra ? GAME_W / 2 - 180 : GAME_W / 2, 480, btnLabel, () => { close(); onGo(); }, {
      w: 320, h: 60, fontSize: 24, fill: color,
    }).setDepth(102);
    objs.push(b);
    if (extra) {
      objs.push(new Button(this, GAME_W / 2 + 180, 480, extra[0], () => { close(); extra[1](); }, { w: 320, h: 60, fontSize: 24 }).setDepth(102));
    }
  }

  // ---------------- battle ----------------

  private startFight(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'fight';
    this.battleBtn.setVisible(false);
    this.speedBtn.setVisible(true);
    this.timeText.setVisible(true);
    this.banner.setText('FIGHT!').setColor('#ff5252');
    this.time.delayedCall(1500, () => { if (this.phase === 'fight') this.banner.setVisible(false); });

    this.sim = new BattleSim(this.blocked, {
      hit: (x, y) => this.spark(x, y, 0xffffff, 2),
      death: (u) => this.onDeath(u),
      arrowGone: (a) => (a.view as Img | null)?.destroy(),
    });
    for (let team = 0; team < 2; team++) {
      for (const [i, e] of this.placed[team]) {
        const u = this.sim.addUnit(e.type, team, (i % MAP_W) * TILE + TILE / 2, Math.floor(i / MAP_W) * TILE + TILE / 2);
        const img = this.add.image(u.x, u.y, `unit_${e.type}_${team}`).setRotation(u.facing);
        this.unitC.add(img);
        u.view = img;
      }
      this.placeC[team].destroy();
    }
  }

  private spark(x: number, y: number, color: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const s = this.add.image(x, y, 'px').setTint(color);
      this.fxC.add(s);
      this.tweens.add({
        targets: s, x: x + Phaser.Math.Between(-14, 14), y: y + Phaser.Math.Between(-14, 14), alpha: 0, duration: 250,
        onComplete: () => s.destroy(),
      });
    }
  }

  private onDeath(u: Unit): void {
    const img = u.view as Img;
    this.spark(u.x, u.y, TEAM_COLORS[u.team], 8);
    this.unitC.remove(img);
    this.fxC.add(img);
    img.clearTint();
    this.tweens.add({ targets: img, alpha: 0, scale: 0.5, angle: img.angle + 90, duration: 450, onComplete: () => img.destroy() });
  }

  update(_t: number, delta: number): void {
    if (this.phase !== 'fight' || !this.sim) return;
    const sim = this.sim;
    const total = (Math.min(delta, 50) / 1000) * SPEEDS[this.speedIdx];
    const n = Math.max(1, Math.ceil(total / (1 / 60)));
    let res: Result = null;
    for (let k = 0; k < n && res === null; k++) {
      sim.step(total / n);
      res = sim.result();
    }
    this.render(sim);
    this.refreshPanels();
    const left = Math.max(0, Math.ceil(MAX_BATTLE_TIME - sim.time));
    this.timeText.setText(`Time left ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    if (res !== null) this.endBattle(res, sim);
  }

  private render(sim: BattleSim): void {
    for (const u of sim.units) {
      const img = u.view as Img;
      const lo = u.lunge > 0 ? Math.sin((u.lunge / 0.12) * Math.PI) * 5 : 0;
      img.setPosition(u.x + Math.cos(u.facing) * lo, u.y + Math.sin(u.facing) * lo).setRotation(u.facing);
      if (u.flash > 0) img.setTintFill(0xffffff); else img.clearTint();
    }
    this.unitC.sort('y');
    for (const a of sim.arrows) {
      let img = a.view as Img | null;
      if (!img) {
        img = this.add.image(a.x, a.y, 'arrow').setRotation(Math.atan2(a.vy, a.vx));
        this.arrowC.add(img);
        a.view = img;
      }
      img.setPosition(a.x, a.y);
    }
    const g = this.hpG.clear();
    for (const u of sim.units) {
      if (u.hp >= u.maxHp) continue;
      const f = Math.max(0, u.hp / u.maxHp);
      const x = u.x - 13, y = u.y - u.r - 10;
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, 28, 7);
      g.fillStyle(f > 0.5 ? 0x4caf50 : f > 0.25 ? 0xffc107 : 0xf44336, 1).fillRect(x, y, 26 * f, 5);
    }
  }

  private endBattle(res: Result, sim: BattleSim): void {
    this.phase = 'over';
    this.speedBtn.setVisible(false);
    for (const a of sim.arrows) (a as Arrow & { view: Img | null }).view?.destroy();
    const survivors = sim.units.length;
    const timeout = sim.time >= MAX_BATTLE_TIME && sim.count(0) > 0 && sim.count(1) > 0;
    const title = res === 'draw' ? 'DRAW!' : `${TEAM_NAMES[res as number]} WINS!`;
    const color = res === 'draw' ? 0xffd54a : TEAM_COLORS[res as number];
    const lines = res === 'draw'
      ? ['Both armies were wiped out.']
      : [timeout ? 'Time ran out — most remaining health wins.' : 'The enemy army has been defeated!',
        `${survivors} soldier${survivors === 1 ? '' : 's'} survived.`];
    this.time.delayedCall(900, () => {
      this.overlay(title, lines, 'Play Again', color, () => { newGame(); this.scene.start('Menu'); },
        ['View Battlefield', () => this.banner.setText('Battle over. Refresh or press ENTER for menu.').setVisible(true)]);
      this.input.keyboard?.once('keydown-ENTER', () => { newGame(); this.scene.start('Menu'); });
    });
  }
}

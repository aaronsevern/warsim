import { MAP_H, MAP_W, TILE, UNIT_INFO, WORLD_H, WORLD_W, type UnitType } from '../config';
import { resolveCircle } from '../collision';
import { Pathfinder } from './pathfinding';

const ARROW_SPEED = 460;
export const MAX_BATTLE_TIME = 240;

export interface Pt { x: number; y: number }

export class Unit {
  hp: number;
  maxHp: number;
  r: number;
  cd = Math.random() * 0.5;
  target: Unit | null = null;
  retarget = Math.random() * 0.3;
  path: Pt[] = [];
  pathTx = -99;
  pathTy = -99;
  pathTimer = 0;
  routeTimer = 0;
  direct = true;
  guard: Pt | null = null;
  vx = 0;
  vy = 0;
  facing: number;
  flash = 0;
  lunge = 0;
  alive = true;
  /** Owned by the renderer. */
  view: unknown = null;

  constructor(public type: UnitType, public team: number, public x: number, public y: number) {
    const s = UNIT_INFO[type];
    this.hp = this.maxHp = s.hp;
    this.r = s.radius;
    this.facing = team === 0 ? 0 : Math.PI;
  }
  get stats() { return UNIT_INFO[this.type]; }
}

export interface Arrow {
  x: number; y: number; vx: number; vy: number;
  travelled: number; maxDist: number; team: number; dmg: number;
  dead: boolean; view: unknown;
}

export type Result = 0 | 1 | 'draw' | null;

export interface SimEvents {
  hit?(x: number, y: number, team: number): void;
  death?(u: Unit): void;
  arrowGone?(a: Arrow): void;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class BattleSim {
  units: Unit[] = [];
  arrows: Arrow[] = [];
  time = 0;
  private guardTimer = 0;
  private pf: Pathfinder;
  private blockedFn: (tx: number, ty: number) => boolean;

  constructor(private blocked: Uint8Array, private events: SimEvents = {}) {
    this.pf = new Pathfinder(MAP_W, MAP_H, blocked);
    this.blockedFn = (tx, ty) => tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || blocked[ty * MAP_W + tx] === 1;
  }

  addUnit(type: UnitType, team: number, x: number, y: number): Unit {
    const u = new Unit(type, team, x, y);
    this.units.push(u);
    return u;
  }

  count(team: number): number {
    let n = 0;
    for (const u of this.units) if (u.team === team) n++;
    return n;
  }

  step(dt: number): void {
    this.time += dt;
    this.guardTimer -= dt;
    if (this.guardTimer <= 0) {
      this.guardTimer = 0.3;
      this.computeGuards(0);
      this.computeGuards(1);
    }
    for (const u of this.units) {
      u.cd -= dt;
      u.flash -= dt;
      u.lunge = Math.max(0, u.lunge - dt);
      u.retarget -= dt;
      u.pathTimer -= dt;
      u.routeTimer -= dt;
      if (u.retarget <= 0 || !u.target || !u.target.alive) {
        u.target = this.pickTarget(u);
        u.retarget = 0.3 + Math.random() * 0.2;
      }
      this.moveToward(u, this.think(u), dt);
    }
    this.separate();
    for (const u of this.units) resolveCircle(u, u.r, this.blockedFn);
    this.updateArrows(dt);
    for (const u of this.units) {
      if (u.hp <= 0 && u.alive) {
        u.alive = false;
        this.events.death?.(u);
      }
    }
    this.units = this.units.filter((u) => u.alive);
  }

  result(): Result {
    const a = this.count(0), b = this.count(1);
    if (a === 0 && b === 0) return 'draw';
    if (a === 0) return 1;
    if (b === 0) return 0;
    if (this.time >= MAX_BATTLE_TIME) {
      let ha = 0, hb = 0;
      for (const u of this.units) {
        if (u.team === 0) ha += u.hp; else hb += u.hp;
      }
      return ha === hb ? 'draw' : ha > hb ? 0 : 1;
    }
    return null;
  }

  // ---------- AI ----------

  private pickTarget(u: Unit): Unit | null {
    let best: Unit | null = null, bd = Infinity;
    let bestR: Unit | null = null, bdR = Infinity;
    for (const e of this.units) {
      if (e.team === u.team || !e.alive) continue;
      const d2 = (e.x - u.x) ** 2 + (e.y - u.y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
      if (e.type === 'range' && d2 < bdR) { bdR = d2; bestR = e; }
    }
    if (u.type === 'rideable' && bestR && bdR < 380 * 380) return bestR;
    return best;
  }

  /** Defense units take line slots between their protectees and the nearest enemy. */
  private computeGuards(team: number): void {
    const mine = this.units.filter((u) => u.team === team);
    const defenders = mine.filter((u) => u.type === 'defense');
    if (!defenders.length) return;
    let protect = mine.filter((u) => u.type === 'range');
    if (!protect.length) protect = mine.filter((u) => u.type !== 'defense');
    const enemies = this.units.filter((u) => u.team !== team);
    if (!protect.length || !enemies.length) {
      for (const d of defenders) d.guard = null;
      return;
    }
    const A = { x: 0, y: 0 };
    for (const p of protect) { A.x += p.x; A.y += p.y; }
    A.x /= protect.length; A.y /= protect.length;
    let E = enemies[0], ed = Infinity;
    for (const e of enemies) {
      const d = dist(A, e);
      if (d < ed) { ed = d; E = e; }
    }
    const dir = ed > 0.01 ? { x: (E.x - A.x) / ed, y: (E.y - A.y) / ed } : { x: team === 0 ? 1 : -1, y: 0 };
    const perp = { x: -dir.y, y: dir.x };
    const offset = Math.max(40, Math.min(110, ed * 0.5));
    const sorted = [...defenders].sort(
      (a, b) => (a.x - A.x) * perp.x + (a.y - A.y) * perp.y - ((b.x - A.x) * perp.x + (b.y - A.y) * perp.y),
    );
    const PER_RANK = 10, SPACING = 30;
    const n = sorted.length;
    sorted.forEach((d, i) => {
      const rank = Math.floor(i / PER_RANK);
      const inRank = Math.min(PER_RANK, n - rank * PER_RANK);
      const slot = (i % PER_RANK) - (inRank - 1) / 2;
      const fwd = offset - rank * 28;
      d.guard = {
        x: Math.max(16, Math.min(WORLD_W - 16, A.x + dir.x * fwd + perp.x * slot * SPACING)),
        y: Math.max(16, Math.min(WORLD_H - 16, A.y + dir.y * fwd + perp.y * slot * SPACING)),
      };
    });
  }

  private think(u: Unit): Pt | null {
    const t = u.target;
    const s = u.stats;
    if (u.type === 'defense' && u.guard) {
      if (t) {
        const edge = dist(u, t) - u.r - t.r;
        if (edge <= s.reach) { this.melee(u, t); return null; }
        if (edge < 55) return t;
      }
      if (dist(u, u.guard) < 8) {
        if (t) u.facing = Math.atan2(t.y - u.y, t.x - u.x);
        return null;
      }
      return u.guard;
    }
    if (!t) return null;
    const d = dist(u, t);
    const edge = d - u.r - t.r;
    if (u.type === 'range') {
      if (d <= s.reach) {
        u.facing = Math.atan2(t.y - u.y, t.x - u.x);
        if (u.cd <= 0) this.shoot(u, t);
        if (edge < 70 && d > 0.01) return { x: u.x + ((u.x - t.x) / d) * 60, y: u.y + ((u.y - t.y) / d) * 60 };
        return null;
      }
      return t;
    }
    if (edge <= s.reach) { this.melee(u, t); return null; }
    return t;
  }

  private damage(t: Unit, amt: number, kind: 'melee' | 'arrow', attacker: Unit | null): void {
    if (t.type === 'defense') amt *= kind === 'arrow' ? 0.5 : 0.6;
    if (attacker && attacker.type === 'rideable' && t.type === 'range') amt *= 1.5;
    t.hp -= amt;
    t.flash = 0.08;
    this.events.hit?.(t.x, t.y, t.team);
  }

  private melee(u: Unit, t: Unit): void {
    u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    u.vx = u.vy = 0;
    if (u.cd > 0) return;
    u.cd = u.stats.cooldown * (0.85 + Math.random() * 0.3);
    u.lunge = 0.12;
    this.damage(t, u.stats.damage, 'melee', u);
  }

  private shoot(u: Unit, t: Unit): void {
    u.cd = u.stats.cooldown * (0.85 + Math.random() * 0.3);
    const tt = dist(u, t) / ARROW_SPEED;
    const ax = t.x + t.vx * tt * 0.8, ay = t.y + t.vy * tt * 0.8;
    const d = Math.hypot(ax - u.x, ay - u.y) || 1;
    const dx = (ax - u.x) / d, dy = (ay - u.y) / d;
    this.arrows.push({
      x: u.x + dx * u.r, y: u.y + dy * u.r, vx: dx * ARROW_SPEED, vy: dy * ARROW_SPEED,
      travelled: 0, maxDist: u.stats.reach * 1.3, team: u.team, dmg: u.stats.damage, dead: false, view: null,
    });
  }

  // ---------- movement ----------

  private solidAt(x: number, y: number): boolean {
    return this.blockedFn(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  private los(x0: number, y0: number, x1: number, y1: number, r: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.ceil(Math.hypot(dx, dy) / 10);
    const rr = r * 0.7;
    for (let i = 0; i <= n; i++) {
      const f = n ? i / n : 0;
      const x = x0 + dx * f, y = y0 + dy * f;
      if (this.solidAt(x - rr, y - rr) || this.solidAt(x + rr, y - rr) || this.solidAt(x - rr, y + rr) || this.solidAt(x + rr, y + rr)) return false;
    }
    return true;
  }

  private route(u: Unit, goal: Pt): Pt {
    if (u.routeTimer <= 0) {
      u.routeTimer = 0.2 + Math.random() * 0.1;
      u.direct = this.los(u.x, u.y, goal.x, goal.y, u.r);
      if (!u.direct && u.path.length > 1 && this.los(u.x, u.y, u.path[1].x, u.path[1].y, u.r)) u.path.shift();
    }
    if (u.direct) { u.path.length = 0; return goal; }
    const gtx = Math.floor(goal.x / TILE), gty = Math.floor(goal.y / TILE);
    const moved = Math.max(Math.abs(gtx - u.pathTx), Math.abs(gty - u.pathTy)) > 2;
    if (!u.path.length || u.pathTimer <= 0 || moved) {
      u.pathTx = gtx; u.pathTy = gty;
      u.pathTimer = 0.8 + Math.random() * 0.5;
      const res = this.pf.find(Math.floor(u.x / TILE), Math.floor(u.y / TILE), gtx, gty);
      u.path = res ? res.map((i) => ({ x: (i % MAP_W) * TILE + TILE / 2, y: Math.floor(i / MAP_W) * TILE + TILE / 2 })) : [];
    }
    while (u.path.length && dist(u.path[0], u) < 10) u.path.shift();
    return u.path[0] ?? goal;
  }

  private moveToward(u: Unit, goal: Pt | null, dt: number): void {
    if (!goal) { u.vx = u.vy = 0; return; }
    const wp = this.route(u, goal);
    const dx = wp.x - u.x, dy = wp.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) { u.vx = u.vy = 0; return; }
    const sp = u.stats.speed;
    const step = Math.min(d, sp * dt);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.vx = (dx / d) * sp;
    u.vy = (dy / d) * sp;
    u.facing = Math.atan2(dy, dx);
  }

  private separate(): void {
    const us = this.units;
    const n = us.length;
    for (let i = 0; i < n; i++) {
      const a = us[i];
      for (let j = i + 1; j < n; j++) {
        const b = us[j];
        let dx = b.x - a.x;
        if (dx > 24 || dx < -24) continue;
        let dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        let d = Math.sqrt(d2);
        if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        const ma = a.stats.mass, mb = b.stats.mass;
        const overlap = minD - d;
        const nx = dx / d, ny = dy / d;
        const wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
        b.x += nx * overlap * wb; b.y += ny * overlap * wb;
      }
    }
  }

  private updateArrows(dt: number): void {
    for (const a of this.arrows) {
      for (let s = 0; s < 2 && !a.dead; s++) {
        a.x += (a.vx * dt) / 2;
        a.y += (a.vy * dt) / 2;
        a.travelled += (ARROW_SPEED * dt) / 2;
        for (const u of this.units) {
          if (u.team === a.team || !u.alive) continue;
          const r = u.r + 3;
          const dx = u.x - a.x, dy = u.y - a.y;
          if (dx * dx + dy * dy < r * r) {
            this.damage(u, a.dmg, 'arrow', null);
            a.dead = true;
            break;
          }
        }
        if (a.travelled > a.maxDist || a.x < 0 || a.y < 0 || a.x > WORLD_W || a.y > WORLD_H) a.dead = true;
      }
      if (a.dead) this.events.arrowGone?.(a);
    }
    this.arrows = this.arrows.filter((a) => !a.dead);
  }
}

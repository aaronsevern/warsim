/** 8-directional A* on a tile grid (no corner cutting). Returns tile indices, start excluded. */
export class Pathfinder {
  private g: Float32Array;
  private from: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private gen = 0;
  private heapIdx: number[] = [];
  private heapPri: number[] = [];

  constructor(private w: number, private h: number, private blocked: Uint8Array) {
    const n = w * h;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  private isBlocked(x: number, y: number): boolean {
    return x < 0 || y < 0 || x >= this.w || y >= this.h || this.blocked[y * this.w + x] === 1;
  }

  private nearestFree(x: number, y: number): number {
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.isBlocked(x + dx, y + dy)) return (y + dy) * this.w + (x + dx);
        }
      }
    }
    return -1;
  }

  private push(i: number, p: number): void {
    const hi = this.heapIdx, hp = this.heapPri;
    let k = hi.length;
    hi.push(i); hp.push(p);
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (hp[parent] <= p) break;
      hi[k] = hi[parent]; hp[k] = hp[parent];
      k = parent;
    }
    hi[k] = i; hp[k] = p;
  }

  private pop(): number {
    const hi = this.heapIdx, hp = this.heapPri;
    const top = hi[0];
    const li = hi.pop()!, lp = hp.pop()!;
    const n = hi.length;
    if (n > 0) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && hp[c + 1] < hp[c]) c++;
        if (hp[c] >= lp) break;
        hi[k] = hi[c]; hp[k] = hp[c];
        k = c;
      }
      hi[k] = li; hp[k] = lp;
    }
    return top;
  }

  find(sx: number, sy: number, gx: number, gy: number): number[] | null {
    const w = this.w;
    gx = Math.max(0, Math.min(this.w - 1, gx));
    gy = Math.max(0, Math.min(this.h - 1, gy));
    let goal = gy * w + gx;
    if (this.isBlocked(gx, gy)) {
      goal = this.nearestFree(gx, gy);
      if (goal < 0) return null;
      gx = goal % w;
      gy = (goal / w) | 0;
    }
    const start = sy * w + sx;
    if (start === goal) return [];
    const gen = ++this.gen;
    this.heapIdx.length = 0;
    this.heapPri.length = 0;
    const heur = (x: number, y: number) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    this.g[start] = 0;
    this.stamp[start] = gen;
    this.from[start] = -1;
    this.push(start, heur(sx, sy));
    while (this.heapIdx.length) {
      const cur = this.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === goal) {
        const path: number[] = [];
        let c = cur;
        while (c !== start && c >= 0) { path.push(c); c = this.from[c]; }
        return path.reverse();
      }
      const cx = cur % w, cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (this.isBlocked(nx, ny)) continue;
          const diag = dx !== 0 && dy !== 0;
          if (diag && (this.isBlocked(nx, cy) || this.isBlocked(cx, ny))) continue;
          const ni = ny * w + nx;
          if (this.closed[ni] === gen) continue;
          const ng = this.g[cur] + (diag ? Math.SQRT2 : 1);
          if (this.stamp[ni] !== gen || ng < this.g[ni]) {
            this.stamp[ni] = gen;
            this.g[ni] = ng;
            this.from[ni] = cur;
            this.push(ni, ng + heur(nx, ny));
          }
        }
      }
    }
    return null;
  }
}

import { MAP_H, MAP_W, type ResourceType } from './config';

export type Cell = ResourceType | null;

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic map for a seed; left/right mirrored so both battle sides are fair. */
export function generateMap(seed: number): Cell[] {
  const rand = mulberry32(seed);
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2;
  const cells: Cell[] = new Array(MAP_W * MAP_H).fill(null);
  const half = MAP_W / 2;
  const cx0 = MAP_W / 2;
  const cy0 = MAP_H / 2;

  const put = (x: number, y: number, t: ResourceType) => {
    if (x < 0 || x >= half || y < 0 || y >= MAP_H) return;
    if (Math.abs(x + 0.5 - cx0) < 5 && Math.abs(y + 0.5 - cy0) < 4) return; // spawn clearing
    const i = y * MAP_W + x;
    if (cells[i]) return;
    cells[i] = t;
    cells[y * MAP_W + (MAP_W - 1 - x)] = t;
  };

  // [type, clusters per half, items per cluster, spread]
  const clusters: [ResourceType, number, number, number][] = [
    ['wood', 12, 10, 2.0],
    ['steel', 9, 5, 1.2],
    ['wire', 12, 3, 1.0],
    ['horse', 8, 3, 1.4],
  ];
  for (const [t, count, size, spread] of clusters) {
    for (let c = 0; c < count; c++) {
      const cx = rand() * half;
      const cy = rand() * MAP_H;
      for (let k = 0; k < size; k++) {
        put(Math.round(cx + gauss() * spread), Math.round(cy + gauss() * spread), t);
      }
    }
  }
  return cells;
}

/** 1 for every free tile in the largest connected free region. */
export function largestComponent(blocked: Uint8Array): Uint8Array {
  const comp = new Int32Array(MAP_W * MAP_H).fill(-1);
  let best = -1;
  let bestSize = 0;
  let id = 0;
  const stack: number[] = [];
  for (let s = 0; s < comp.length; s++) {
    if (blocked[s] || comp[s] >= 0) continue;
    let size = 0;
    comp[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < MAP_W - 1 ? i + 1 : -1, y > 0 ? i - MAP_W : -1, y < MAP_H - 1 ? i + MAP_W : -1];
      for (const n of nb) {
        if (n >= 0 && !blocked[n] && comp[n] < 0) {
          comp[n] = id;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
    id++;
  }
  const out = new Uint8Array(comp.length);
  for (let i = 0; i < comp.length; i++) out[i] = comp[i] === best ? 1 : 0;
  return out;
}

import { TILE, WORLD_H, WORLD_W } from './config';

export type BlockedFn = (tx: number, ty: number) => boolean;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Push a circle out of any blocked tiles and keep it inside the world. */
export function resolveCircle(p: { x: number; y: number }, r: number, blocked: BlockedFn): void {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const x0 = Math.floor((p.x - r) / TILE);
    const x1 = Math.floor((p.x + r) / TILE);
    const y0 = Math.floor((p.y - r) / TILE);
    const y1 = Math.floor((p.y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!blocked(tx, ty)) continue;
        const rx = tx * TILE;
        const ry = ty * TILE;
        const cx = clamp(p.x, rx, rx + TILE);
        const cy = clamp(p.y, ry, ry + TILE);
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = r - d;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        } else {
          const left = p.x - rx, right = rx + TILE - p.x, top = p.y - ry, bottom = ry + TILE - p.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = rx - r;
          else if (m === right) p.x = rx + TILE + r;
          else if (m === top) p.y = ry - r;
          else p.y = ry + TILE + r;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  p.x = clamp(p.x, r, WORLD_W - r);
  p.y = clamp(p.y, r, WORLD_H - r);
}

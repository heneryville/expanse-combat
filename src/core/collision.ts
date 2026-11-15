import { Quat, Vec3, cross, dot, len, rotate, scale, sub, unrotate, v3 } from "./vec";

export interface Obb { c: Vec3; q: Quat; h: Vec3 } // center, attitude, half extents

/** Earliest fraction t in [0,1] at which point p0 + t·d enters the box, or null. Box assumed fixed over the step. */
export function sweptPointObb(p0: Vec3, d: Vec3, box: Obb): number | null {
  const p = unrotate(box.q, sub(p0, box.c)), dl = unrotate(box.q, d);
  let t0 = 0, t1 = 1;
  const axes: [number, number, number][] = [[p.x, dl.x, box.h.x], [p.y, dl.y, box.h.y], [p.z, dl.z, box.h.z]];
  for (const [pi, di, hi] of axes) {
    if (Math.abs(di) < 1e-300) {
      if (pi < -hi || pi > hi) return null;
      continue;
    }
    let ta = (-hi - pi) / di, tb = (hi - pi) / di;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

const axesOf = (q: Quat): Vec3[] => [rotate(q, v3(1, 0, 0)), rotate(q, v3(0, 1, 0)), rotate(q, v3(0, 0, 1))];

/** Earliest fraction t in [0,1] at which box A, moving by d relative to B, touches B (separating-axis test). */
export function sweptObbObb(a: Obb, b: Obb, d: Vec3): number | null {
  const A = axesOf(a.q), B = axesOf(b.q);
  const ha = [a.h.x, a.h.y, a.h.z], hb = [b.h.x, b.h.y, b.h.z];
  const axes: Vec3[] = [...A, ...B];
  for (const x of A) for (const y of B) {
    const c = cross(x, y);
    const l = len(c);
    if (l > 1e-9) axes.push(scale(c, 1 / l));
  }
  const s0 = sub(a.c, b.c);
  let t0 = 0, t1 = 1;
  for (const L of axes) {
    const r = ha.reduce((acc, h, i) => acc + h * Math.abs(dot(A[i], L)), 0)
      + hb.reduce((acc, h, i) => acc + h * Math.abs(dot(B[i], L)), 0);
    const s = dot(s0, L), v = dot(d, L);
    if (Math.abs(v) < 1e-300) {
      if (Math.abs(s) > r) return null;
      continue;
    }
    let ta = (-r - s) / v, tb = (r - s) / v;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/** Area of a box's silhouette seen along unit direction u. */
export function silhouetteArea(q: Quat, size: [number, number, number], u: Vec3): number {
  const ub = unrotate(q, u);
  const [l, w, h] = size;
  return Math.abs(ub.x) * w * h + Math.abs(ub.y) * l * h + Math.abs(ub.z) * l * w;
}

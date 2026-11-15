import { G0, SHIPS, ShipClass, TORPEDO } from "./constants";
import { hazardOver, strainAfter } from "./crew";
import { ObservedState } from "./perception";
import { Rng } from "./rng";
import { Vec3, add, addScaled, angleBetween, rotate, scale, v3 } from "./vec";

/** One burn of a maneuver plan, in the contact's body frame at the moment it was observed. */
interface Burn { dir: Vec3; accel: number; start: number; end: number }

/** A precomputed maneuver: keep the observed burn for `hold` (a fraction of the query span; Infinity = keep it), then up to three burns. */
export interface Plan { hold: number; burns: Burn[] }

export interface Performance { maxG: number; alpha: number; crewed: boolean; dvMax: number }

export const performanceOf = (kind: ShipClass["id"] | "torpedo"): Performance =>
  kind === "torpedo"
    ? { maxG: TORPEDO.maxG, alpha: (4 * Math.PI) / TORPEDO.flipS ** 2, crewed: false, dvMax: TORPEDO.dvKms * 1000 }
    : { maxG: SHIPS[kind].maxG, alpha: (4 * Math.PI) / SHIPS[kind].flipS ** 2, crewed: true, dvMax: SHIPS[kind].dvKms * 1000 };

const turnTime = (theta: number, alpha: number) => 2 * Math.sqrt(theta / alpha);
const logUniform = (r: Rng, lo: number, hi: number) => Math.exp(r.range(Math.log(lo), Math.log(hi)));

/** Build the reusable maneuver set for one ship or torpedo type. Plan 0 continues the observed burn; plan 1 coasts. */
export function buildPlans(perf: Performance, n: number, seed: number, maxHorizon = 4000): Plan[] {
  const r = new Rng(seed);
  const plans: Plan[] = [
    { hold: Infinity, burns: [] },
    { hold: 0, burns: [] },
  ];
  while (plans.length < n) {
    const nb = 1 + Math.floor(r.next() * 3);
    // The first maneuver is equally likely to start anywhere in the span being asked about.
    const hold = r.next() < 0.25 ? 0 : r.next();
    let t = 0;
    let prev = v3(1, 0, 0);
    const burns: Burn[] = [];
    for (let i = 0; i < nb; i++) {
      const dir = r.dir();
      t += turnTime(angleBetween(prev, dir), perf.alpha);
      const g = r.range(0.05, 1) * perf.maxG;
      const dur = logUniform(r, 0.2, maxHorizon);
      burns.push({ dir, accel: g * G0, start: t, end: t + dur });
      t += dur + (r.next() < 0.5 ? 0 : logUniform(r, 0.1, maxHorizon / 2));
      prev = dir;
    }
    plans.push({ hold, burns });
  }
  return plans;
}

/** Displacement from constant acceleration a applied over [s, e], evaluated at time h (all measured from observation). */
const burnDisp = (a: Vec3, s: number, e: number, h: number): Vec3 => {
  const s1 = Math.min(s, h), e1 = Math.min(e, h), d = e1 - s1;
  return d <= 0 ? v3() : scale(a, d * (h - e1) + 0.5 * d * d);
};

export interface Cloud { t: number; points: Vec3[]; weights: number[]; mean: Vec3; spread: number }

export interface Track { doseSeen: number; dvSeen: number }

/**
 * Where the contact could be at time tQuery, from its observed state and the reusable plan set.
 * Crewed contacts are weighted only by crew survival; torpedoes only by fuel.
 */
export function predict(obs: ObservedState, tQuery: number, plans: Plan[], perf: Performance, track: Track = { doseSeen: 0, dvSeen: 0 }): Cloud {
  const h = Math.max(0, tQuery - obs.t);
  const base = addScaled(obs.pos, obs.vel, h);
  const obsG = Math.hypot(obs.acc.x, obs.acc.y, obs.acc.z) / G0;
  const points: Vec3[] = [], weights: number[] = [];
  let sw = 0, mx = 0, my = 0, mz = 0;
  for (const p of plans) {
    const hold = p.hold === Infinity ? h : p.hold * h;
    let d = burnDisp(obs.acc, 0, hold, h);
    // Crew death hazard integrated along the plan; strain heals in the gaps between burns.
    let hz = perf.crewed ? hazardOver(track.doseSeen, obsG, hold) : 0, strain = strainAfter(track.doseSeen, obsG, hold), tNow = hold;
    let dv = obsG * G0 * hold;
    for (let i = 0; i < p.burns.length; i++) {
      const b = p.burns[i];
      const s = hold + b.start, e = hold + b.end;
      if (s >= h) break;
      const aw = scale(rotate(obs.q, b.dir), b.accel);
      d = add(d, burnDisp(aw, s, e, h));
      const burnt = Math.min(e, h) - s;
      if (perf.crewed) {
        strain = strainAfter(strain, 0, s - tNow);
        hz += hazardOver(strain, b.accel / G0, burnt);
        strain = strainAfter(strain, b.accel / G0, burnt);
        tNow = s + burnt;
      }
      dv += b.accel * burnt;
    }
    let w: number;
    if (perf.crewed) w = Math.exp(-hz);
    else w = track.dvSeen + dv <= perf.dvMax ? 1 : 0;
    if (w < 1e-6) continue;
    const pt = add(base, d);
    points.push(pt);
    weights.push(w);
    sw += w; mx += w * pt.x; my += w * pt.y; mz += w * pt.z;
  }
  const mean = sw > 0 ? v3(mx / sw, my / sw, mz / sw) : base;
  let sp = 0;
  for (let i = 0; i < points.length; i++) {
    const q = points[i];
    sp += weights[i] * ((q.x - mean.x) ** 2 + (q.y - mean.y) ** 2 + (q.z - mean.z) ** 2);
  }
  return { t: tQuery, points, weights, mean, spread: sw > 0 ? Math.sqrt(sp / sw) : 0 };
}

/** The most likely place to find the contact: the heaviest neighbourhood of radius-sized grid cells, then its heaviest sample. */
export function densest(c: Cloud, radius: number): Vec3 {
  if (c.points.length === 0) return c.mean;
  const cells = new Map<string, { w: number; best: Vec3; bestW: number }>();
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  const idx = c.points.map((p) => [Math.floor(p.x / radius), Math.floor(p.y / radius), Math.floor(p.z / radius)]);
  idx.forEach(([i, j, k], n) => {
    const kk = key(i, j, k);
    const cell = cells.get(kk) ?? { w: 0, best: c.points[n], bestW: -1 };
    cell.w += c.weights[n];
    if (c.weights[n] > cell.bestW) { cell.bestW = c.weights[n]; cell.best = c.points[n]; }
    cells.set(kk, cell);
  });
  let best = c.mean, bestW = -1;
  for (const [kk, cell] of cells) {
    const [i, j, k] = kk.split(",").map(Number);
    let w = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) w += cells.get(key(i + a, j + b, k + d))?.w ?? 0;
    if (w > bestW) { bestW = w; best = cell.best; }
  }
  return best;
}

/** Weight of cloud samples lying within radius of a point. */
export function weightNear(c: Cloud, p: Vec3, radius: number): number {
  let inside = 0, total = 0;
  const r2 = radius * radius;
  for (let i = 0; i < c.points.length; i++) {
    const q = c.points[i];
    total += c.weights[i];
    if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2 <= r2) inside += c.weights[i];
  }
  return total > 0 ? inside / total : 0;
}

/** The reusable plan sets, built once per type. */
const cache = new Map<string, { plans: Plan[]; perf: Performance }>();
export function plansFor(kind: ShipClass["id"] | "torpedo", n = 1500) {
  const key = `${kind}:${n}`;
  let c = cache.get(key);
  if (!c) {
    const perf = performanceOf(kind);
    c = { perf, plans: buildPlans(perf, n, [...kind].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) + n) };
    cache.set(key, c);
  }
  return c;
}

/** Accumulates what an observer has seen a contact do: dose for crewed ships, Δv spent for torpedoes. */
export class Tracker {
  private tracks = new Map<number, Track & { lastT: number; lastG: number }>();
  update(obs: ObservedState): Track {
    let tr = this.tracks.get(obs.id);
    const g = Math.hypot(obs.acc.x, obs.acc.y, obs.acc.z) / G0;
    if (!tr) {
      tr = { doseSeen: 0, dvSeen: 0, lastT: obs.t, lastG: g };
      this.tracks.set(obs.id, tr);
    }
    const dt = obs.t - tr.lastT;
    if (dt > 0) {
      tr.doseSeen = strainAfter(tr.doseSeen, tr.lastG, dt);
      tr.dvSeen += tr.lastG * G0 * dt;
      tr.lastT = obs.t;
    }
    tr.lastG = g;
    return tr;
  }
  get(id: number): Track | undefined { return this.tracks.get(id); }
}

/** Chance a projectile flying along dir through aim meets the contact: cloud weight within radius of that line. */
export function hitProbability(c: Cloud, aim: Vec3, dir: Vec3, radius: number): number {
  let inside = 0, total = 0;
  const r2 = radius * radius;
  for (let i = 0; i < c.points.length; i++) {
    const p = c.points[i];
    const dx = p.x - aim.x, dy = p.y - aim.y, dz = p.z - aim.z;
    const along = dx * dir.x + dy * dir.y + dz * dir.z;
    const perp2 = dx * dx + dy * dy + dz * dz - along * along;
    total += c.weights[i];
    if (perp2 <= r2) inside += c.weights[i];
  }
  return total > 0 ? inside / total : 0;
}

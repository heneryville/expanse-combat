import { Body, Side, integrateBody, mass, applyImpulse } from "./body";
import { DT, TORPEDO } from "./constants";
import { Obb, sweptObbObb, sweptPointObb } from "./collision";
import { Rng } from "./rng";
import { Vec3, add, addScaled, dot, len, scale, sub, v3 } from "./vec";

export interface Slug { id: number; side: Side; pos: Vec3; vel: Vec3; mass: number; alive: boolean; firedBy: number }

export type SimEvent =
  | { t: number; type: "hit"; target: number; by: number; byKind: "slug" | "body" | "pdc"; relSpeed: number; energy: number; pos: Vec3 }
  | { t: number; type: "flash"; source: number; kind: FlashKind; pos: Vec3 }
  | { t: number; type: "crewDeath"; ship: number }
  | { t: number; type: "end"; result: MatchResult };

export type FlashKind = "burnChange" | "launch" | "railgun" | "pdc" | "impact";
export type MatchResult = "playerWin" | "enemyWin" | "mutualKill" | "draw";

/** Something that runs once per step before integration (controllers, weapons) or after it (clouds, crew). */
export interface System {
  pre?(w: World): void;
  /** Runs before each physics substep; a step splits into substeps while a torpedo closes on a ship. */
  sub?(w: World): void;
  post?(w: World): void;
}

export class World {
  t = 0;
  /** Length of the current physics substep. */
  dt = DT;
  stepIndex = 0;
  bodies: Body[] = [];
  slugs: Slug[] = [];
  events: SimEvent[] = [];
  systems: System[] = [];
  rng: Rng;
  private nextIdN = 1;
  /** Called for every body that is destroyed this step. */
  onKill: ((b: Body, e: SimEvent) => void)[] = [];

  constructor(public seed: number) {
    this.rng = new Rng(seed);
  }

  nextId(): number { return this.nextIdN++; }

  addBody(b: Body): Body {
    this.bodies.push(b);
    return b;
  }

  body(id: number): Body | undefined { return this.bodies.find((b) => b.id === id); }

  emit(e: SimEvent): void { this.events.push(e); }

  /** Fire a projectile of mass m at velocity vRel relative to the shooter; the shooter takes the opposite impulse. */
  fireSlug(shooter: Body, m: number, vRel: Vec3, muzzleOffset = 0): Slug {
    const dir = scale(vRel, 1 / len(vRel));
    const s: Slug = {
      id: this.nextId(), side: shooter.side, pos: addScaled(shooter.pos, dir, muzzleOffset),
      vel: add(shooter.vel, vRel), mass: m, alive: true, firedBy: shooter.id,
    };
    applyImpulse(shooter, scale(vRel, -m));
    shooter.dryMass -= m; // the round leaves with its mass
    this.slugs.push(s);
    return s;
  }

  step(): void {
    for (const s of this.systems) s.pre?.(this);
    const t0 = this.t, n = this.substeps();
    this.dt = DT / n;
    for (let k = 0; k < n; k++) {
      for (const s of this.systems) s.sub?.(this);
      // Wrecks keep drifting (no thrust) and stay solid; only the living can be killed.
      const live = this.bodies;
      const before = new Map(live.map((b) => [b.id, { pos: b.pos, q: b.q, vel: b.vel }]));
      for (const b of live) {
        if (!b.alive) { b.cmdAccel = 0; b.cmdTorque = v3(); }
        integrateBody(b, this.dt);
      }
      const slugStart = this.slugs.filter((s) => s.alive).map((s) => ({ s, pos: s.pos }));
      for (const { s } of slugStart) s.pos = addScaled(s.pos, s.vel, this.dt);
      this.collide(live, before, slugStart);
      this.t = k === n - 1 ? t0 + DT : t0 + (DT * (k + 1)) / n;
    }
    this.dt = DT;
    this.stepIndex++;
    for (const s of this.systems) s.post?.(this);
  }

  /** Substeps so no torpedo within a second of an enemy ship moves more than SUBSTEP_M relative to it per substep. */
  private substeps(): number {
    let n = 1;
    for (const t of this.bodies) {
      if (t.kind !== "torpedo" || !t.alive) continue;
      for (const s of this.bodies) {
        if (!s.alive || !isFuse(t, s)) continue;
        const r = sub(s.pos, t.pos), v = sub(s.vel, t.vel), d = len(r);
        if (dot(r, v) >= 0 || d - TORPEDO.fuseM > -dot(r, v) / d) continue;
        n = Math.max(n, Math.min(MAX_SUBSTEPS, Math.ceil((len(v) * DT) / SUBSTEP_M)));
      }
    }
    return n;
  }

  private obbAt(b: Body, pos: Vec3, q: Body["q"]): Obb {
    return { c: pos, q, h: v3(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2) };
  }

  private kill(b: Body, e: SimEvent): void {
    if (!b.alive) return;
    b.alive = false;
    b.cmdAccel = 0;
    this.emit(e);
    for (const f of this.onKill) f(b, e);
  }

  private collide(live: Body[], before: Map<number, { pos: Vec3; q: Body["q"]; vel: Vec3 }>, slugs: { s: Slug; pos: Vec3 }[]): void {
    const hits: { t: number; apply: () => void }[] = [];
    // Slugs against bodies: slug path relative to the body over the step.
    for (const { s, pos } of slugs) {
      for (const b of live) {
        const st = before.get(b.id)!;
        const dRel = sub(scale(s.vel, this.dt), sub(b.pos, st.pos));
        const tHit = sweptPointObb(pos, dRel, this.obbAt(b, st.pos, st.q));
        if (tHit === null) continue;
        const rel = sub(s.vel, b.vel), rs = len(rel);
        hits.push({
          t: tHit,
          apply: () => {
            if (!s.alive || !b.alive) return;
            s.alive = false;
            this.kill(b, {
              t: this.t + tHit * this.dt, type: "hit", target: b.id, by: s.id, byKind: "slug",
              relSpeed: rs, energy: 0.5 * s.mass * rs * rs, pos: addScaled(pos, scale(s.vel, this.dt), tHit),
            });
          },
        });
      }
    }
    // Bodies against bodies, sweep-and-prune on x over each body's swept extent.
    const spans = live.map((b) => {
      const st = before.get(b.id)!, r = len3(b.size) / 2 + (b.kind === "torpedo" ? TORPEDO.fuseM : 0);
      return { b, lo: Math.min(st.pos.x, b.pos.x) - r, hi: Math.max(st.pos.x, b.pos.x) + r };
    }).sort((x, y) => x.lo - y.lo);
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length && spans[j].lo <= spans[i].hi; j++) {
        const a = spans[i].b, b = spans[j].b;
        if (!a.alive && !b.alive) continue;
        const sa = before.get(a.id)!, sb = before.get(b.id)!;
        const dRel = sub(sub(a.pos, sa.pos), sub(b.pos, sb.pos));
        // Cheap reject: centers farther apart than both radii plus the relative travel.
        const fused = isFuse(a, b) || isFuse(b, a);
        const gap = len(sub(sa.pos, sb.pos)) - len(dRel) - (len3(a.size) + len3(b.size)) / 2 - (fused ? TORPEDO.fuseM : 0);
        if (gap > 0) continue;
        const tContact = sweptObbObb(this.obbAt(a, sa.pos, sa.q), this.obbAt(b, sb.pos, sb.q), dRel);
        const tFuse = fused ? sweptSphere(sub(sa.pos, sb.pos), dRel, TORPEDO.fuseM) : null;
        const tHit = tFuse === null ? tContact : tContact === null ? tFuse : Math.min(tFuse, tContact);
        if (tHit === null) continue;
        const rel = sub(a.vel, b.vel), rs = len(rel);
        hits.push({
          t: tHit,
          apply: () => {
            if (!a.alive || !b.alive) return;
            const ma = mass(a), mb = mass(b), mu = (ma * mb) / (ma + mb);
            const p = addScaled(sa.pos, sub(a.pos, sa.pos), tHit);
            const e = { t: this.t + tHit * this.dt, type: "hit" as const, relSpeed: rs, energy: 0.5 * mu * rs * rs, pos: p, byKind: "body" as const };
            this.kill(a, { ...e, target: a.id, by: b.id });
            this.kill(b, { ...e, target: b.id, by: a.id });
          },
        });
      }
    }
    hits.sort((x, y) => x.t - y.t);
    for (const h of hits) h.apply();
    this.slugs = this.slugs.filter((s) => s.alive);
  }

  /** Mark a body destroyed by something other than a direct collision (e.g. a PDC hit draw). */
  destroy(b: Body, e: SimEvent): void { this.kill(b, e); }
}

const SUBSTEP_M = 10, MAX_SUBSTEPS = 100;
const len3 = (s: [number, number, number]) => Math.hypot(s[0], s[1], s[2]);
const isFuse = (t: Body, s: Body) => t.kind === "torpedo" && s.kind === "ship" && t.side !== s.side;

/** Earliest step fraction at which relative position p0 + t·d comes within r of the origin, or null. */
function sweptSphere(p0: Vec3, d: Vec3, r: number): number | null {
  const c = dot(p0, p0) - r * r;
  if (c <= 0) return 0;
  const a = dot(d, d), b = 2 * dot(p0, d), disc = b * b - 4 * a * c;
  if (a < 1e-300 || disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Relative closing speed helper for logs. */
export const closingSpeed = (a: Body, b: Body) => -dot(sub(a.vel, b.vel), sub(a.pos, b.pos)) / Math.max(1, len(sub(a.pos, b.pos)));

/** Runs whole fixed steps for elapsed real time at a warp factor, capped by a per-frame CPU budget. */
export class Scheduler {
  private acc = 0;
  /** Warp actually achieved last frame (lower than requested when capped). */
  achievedWarp = 1;
  constructor(public warp = 1, public budgetMs = 12, private now: () => number = () => performance.now()) {}

  advance(realDt: number, step: () => void, stop: () => boolean = () => false): number {
    this.acc += realDt * this.warp;
    const want = Math.floor(this.acc / DT);
    const start = this.now();
    let n = 0;
    while (n < want) {
      step();
      n++;
      if (stop()) { this.acc = 0; break; }
      if (this.now() - start > this.budgetMs) break;
    }
    // Capped or interrupted: drop the backlog instead of lengthening the step.
    this.acc = n < want ? 0 : this.acc - n * DT;
    this.achievedWarp = realDt > 0 ? (n * DT) / realDt : this.warp;
    return n;
  }
}

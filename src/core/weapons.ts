import { Body, applyImpulse, keel, makeBody, mass, torqueForFlip } from "./body";
import { aligned, torqueToward } from "./attitude";
import { silhouetteArea } from "./collision";
import { DT, G0, PDC, RAILGUN, TORPEDO } from "./constants";
import { Perception } from "./perception";
import { Observer, ClassKey } from "./sensors";
import { Ship, canAct } from "./ship";
import {
  Vec3, add, addScaled, angleBetween, dot, len, norm, perp, rotate, scale, sub, v3,
} from "./vec";
import { World } from "./world";

/** Time and direction for a projectile of speed `speed` (relative to the shooter) to meet a moving point. */
export function solveIntercept(pos: Vec3, vel: Vec3, speed: number, target: (T: number) => Vec3): { T: number; dir: Vec3 } {
  const gap = (T: number) => len(sub(target(T), addScaled(pos, vel, T))) - speed * T;
  let T = len(sub(target(0), pos)) / speed;
  let ok = false;
  for (let i = 0; i < 30; i++) {
    const T2 = (gap(T) + speed * T) / speed;
    if (Math.abs(T2 - T) < 1e-9 * Math.max(1, T)) { T = T2; ok = true; break; }
    T = T2;
  }
  // Fixed-point diverges when the target outruns the projectile (e.g. a torpedo closing faster than PDC rounds): bracket and bisect.
  if (!ok || !Number.isFinite(T)) {
    let lo = 0, hi = NaN;
    for (let t = 1e-3; t < 1e6; t *= 1.2) { if (gap(t) <= 0) { hi = t; break; } lo = t; }
    if (Number.isNaN(hi)) return { T: Infinity, dir: norm(sub(target(0), pos)) };
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (gap(m) <= 0) hi = m; else lo = m; }
    T = hi;
  }
  return { T, dir: norm(sub(target(T), addScaled(pos, vel, T))) };
}

export type Aim = { point: Vec3 } | { contact: number };

export interface Combat {
  w: World;
  perception: Perception;
  ships: Ship[];
  observers: Map<number, Observer>;
  torpedoes: Map<number, TorpedoState>;
  clouds: PdcCloud[];
  classOf: (id: number) => ClassKey;
}

// ---------- Railgun ----------

export interface RailOrder { aim: Aim; point?: Vec3; dir?: Vec3; range?: number; prevDir?: Vec3 }

/** The point a slug should meet: the fixed aim point, or the contact's predicted cloud mean at slug arrival. */
export function railgunAimPoint(c: Combat, s: Ship, aim: Aim): Vec3 | null {
  if ("point" in aim) return aim.point;
  const o = c.observers.get(s.body.id)!;
  const obs = o.contact(c.w, aim.contact);
  if (!obs) return null;
  const b = s.body;
  const sol = solveIntercept(b.pos, b.vel, RAILGUN.muzzleKms * 1000, (T) => o.cloud(obs, c.w.t + T, 300).mean);
  return o.aimPoint(obs, c.w.t + sol.T, 1500);
}

export const railgunSystem = (c: Combat) => ({
  pre(w: World) {
    for (const s of c.ships) {
      if (!s.railOrder || !canAct(s)) continue;
      if (s.cls.railguns === 0) { s.railOrder = null; continue; }
      // Refresh the aim point every 0.1 s while turning, then lock it: re-sampling the cloud near alignment
      // moves the target by more than the firing tolerance every step, and the gun never settles.
      const nearlyAligned = s.railOrder.dir !== undefined && angleBetween(keel(s.body), s.railOrder.dir) < 0.01;
      if (!s.railOrder.point || (!nearlyAligned && w.stepIndex % 6 === 0)) {
        const sol = railgunAimPoint(c, s, s.railOrder.aim);
        if (!sol) { s.railOrder = null; s.notice = "Railgun: target not visible"; continue; }
        s.railOrder.point = sol;
      }
      const P = s.railOrder.point;
      const sol = solveIntercept(s.body.pos, s.body.vel, RAILGUN.muzzleKms * 1000, () => P);
      const prev = s.railOrder.dir;
      s.railOrder.dir = sol.dir;
      s.railOrder.range = sol.T * RAILGUN.muzzleKms * 1000;
      const dir = sol.dir;
      // Feed forward how fast the solution actually swings, measured step to step.
      const swing = prev ? scale(cross3(prev, dir), 1 / DT) : v3();
      s.body.cmdAccel = 0;
      s.body.cmdTorque = torqueToward(s.body, dir, DT, swing);
      // The keel can't hold a drifting solution to the nanoradians a long shot needs, so the last few
      // microradians are fine-aim: inside that cone the slug leaves along the exact solution.
      if (w.t >= s.railgunReadyAt && aligned(s.body, dir, RAILGUN.fineAimRad)) {
        w.fireSlug(s.body, RAILGUN.slugKg, scale(dir, RAILGUN.muzzleKms * 1000), s.cls.size[0] / 2 + 1);
        c.perception.flash(w, { t: w.t, pos: s.body.pos, kind: "railgun", source: s.body.id, side: s.body.side });
        s.railgunReadyAt = w.t + RAILGUN.cooldownS;
        s.railOrder = null;
      }
    }
  },
});

// ---------- Torpedoes ----------

export interface TorpedoState { body: Body; targetId: number; launcher: number; lane: Vec3; observer: Observer; nextGuideAt: number; aim: Vec3; accel: number; tgo: number; igniteAt: number }

export function launchTorpedo(c: Combat, s: Ship, targetId: number): string | null {
  if (!canAct(s)) return "Ship can't act";
  if (s.magazine <= 0) return "Torpedo magazine empty";
  const tube = s.tubesReadyAt.findIndex((t) => t <= c.w.t);
  if (tube < 0) return "All tubes reloading";
  const b = s.body, w = c.w;
  const side = rotate(b.q, v3(0, tube % 2 === 0 ? 1 : -1, 0));
  // Stagger tube pairs along the keel by more than a torpedo length, so a salvo turning onto course can't clip itself.
  const row = Math.floor(tube / 2) - (Math.ceil(s.cls.torpedoTubes / 2) - 1) / 2;
  const eject = 20; // m/s tube ejection
  const tm = TORPEDO.massKg, fuel = tm * (1 - Math.exp(-TORPEDO.dvKms / TORPEDO.exhaustKms));
  const torp = w.addBody(makeBody({
    id: w.nextId(), kind: "torpedo", side: b.side, q: b.q,
    pos: addScaled(addScaled(b.pos, side, s.cls.size[1] / 2 + 4), keel(b), row * 3 * TORPEDO.size[0]),
    vel: addScaled(b.vel, side, eject), dryMass: tm - fuel, fuel, size: TORPEDO.size,
    exhaustV: TORPEDO.exhaustKms * 1000, maxAccel: TORPEDO.maxG * G0, maxTorque: torqueForFlip(tm, TORPEDO.size, TORPEDO.flipS),
  }));
  applyImpulse(b, scale(side, -tm * eject));
  b.dryMass -= tm;
  s.magazine--;
  s.tubesReadyAt[tube] = w.t + TORPEDO.tubeReloadS;
  const obs = new Observer(torp, c.perception, c.classOf);
  c.observers.set(torp.id, obs);
  // Coast clear of the launcher's hull before lighting the drive.
  const clearS = (Math.hypot(...s.cls.size) / 2 + 10) / eject;
  c.torpedoes.set(torp.id, { body: torp, targetId, launcher: b.id, lane: w.rng.fork(torp.id).dir(), observer: obs, nextGuideAt: w.t + 0.5, aim: keel(b), accel: 0, tgo: Infinity, igniteAt: w.t + clearS });
  c.perception.flash(w, { t: w.t, pos: b.pos, kind: "launch", source: b.id, side: b.side });
  return null;
}

const LANE_M = 5000; // m, salvo lane spacing before the terminal merge

/** Constant-acceleration intercept: the acceleration that puts the torpedo on the target's predicted mean at T. */
function guide(c: Combat, ts: TorpedoState): void {
  const b = ts.body, w = c.w;
  const obs = ts.observer.observe(w).find((x) => x.id === ts.targetId);
  if (!obs) { ts.accel = 0; return; }
  // Plan on 70% of max thrust so guidance keeps authority to correct.
  const A = b.maxAccel * 0.7;
  const dvLeft = b.fuel > 0 ? b.exhaustV * Math.log(mass(b) / b.dryMass) : 0;
  // Coarse search on the cheap "keeps doing what it did" extrapolation, then refine on the cloud mean.
  const extrap = (T: number) => {
    const h = w.t + T - obs.t;
    return add(addScaled(obs.pos, obs.vel, h), scale(obs.acc, 0.5 * h * h));
  };
  const need = (T: number, P: Vec3) => scale(sub(P, addScaled(b.pos, b.vel, T)), 2 / (T * T));
  // Earliest intercept that fits the thrust margin and keeps fuel in reserve for the end game.
  const reserve = (T: number) => (T > 30 ? 0.6 : 1) * dvLeft;
  const ok = (T: number) => { const a = len(need(T, extrap(T))); return a <= A && a * T <= reserve(T); };
  // Coarse geometric scan for the first feasible intercept, then bisect inside that bracket.
  // At high closing speed the feasible span is narrower than a scan step, so also test where the drift passes the target.
  const rel = (T: number) => sub(extrap(T), addScaled(b.pos, b.vel, T));
  const r0 = rel(0);
  let lo = 0.01, hi = NaN;
  for (let T = 0.2; T <= 20000; T *= 1.05) {
    if (ok(T)) { hi = T; break; }
    if (dot(rel(T), r0) < 0) {
      let a = lo, z = T;
      for (let i = 0; i < 50; i++) { const m = (a + z) / 2; if (dot(rel(m), r0) < 0) z = m; else a = m; }
      if (ok(z)) { hi = z; break; }
    }
    lo = T;
  }
  if (Number.isNaN(hi)) {
    // No intercept fits: chase the most likely current position at full thrust.
    const P0 = ts.observer.aimPoint(obs, w.t);
    ts.aim = norm(sub(P0, b.pos));
    ts.accel = dvLeft > 0 ? b.maxAccel : 0;
    ts.tgo = Infinity;
    ts.nextGuideAt = w.t + 1;
    return;
  }
  for (let i = 0; i < 40 && hi - lo > 1e-3; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid; else lo = mid;
  }
  const T = hi;
  // Aim at where the target is most likely to be, not where its current burn would carry it.
  // Each torpedo flies its own lane that merges only in the last 30 s, so a salvo doesn't collide with itself on the way in.
  const toward = norm(sub(obs.pos, b.pos));
  const lane = sub(ts.lane, scale(toward, dot(ts.lane, toward)));
  const P = addScaled(ts.observer.aimPoint(obs, w.t + T), lane, LANE_M * Math.min(1, T / 30));
  const a = need(T, P);
  ts.tgo = T;
  ts.aim = norm(a);
  ts.accel = dvLeft > 0 ? Math.min(len(a), b.maxAccel) : 0;
  ts.nextGuideAt = w.t + (T > 60 ? 1 : T > 5 ? 0.1 : 0);
}

/** The guidance direction, bent tangent to the launcher's hull while burning straight would cross it. */
function clearOfLauncher(w: World, ts: TorpedoState): Vec3 {
  const L = w.body(ts.launcher);
  if (!L || !L.alive) return ts.aim;
  const d = sub(L.pos, ts.body.pos), along = dot(ts.aim, d);
  const R = Math.hypot(...L.size) / 2 + 10;
  if (along <= 0 || len(sub(d, scale(ts.aim, along))) >= R) return ts.aim;
  const u = norm(d), tangent = sub(ts.aim, scale(u, dot(ts.aim, u)));
  return len(tangent) > 1e-6 ? norm(tangent) : perp(u);
}

export const torpedoSystem = (c: Combat) => ({
  sub(w: World) {
    for (const ts of c.torpedoes.values()) {
      const b = ts.body;
      if (!b.alive) continue;
      if (w.t >= ts.nextGuideAt) guide(c, ts);
      const aim = clearOfLauncher(w, ts);
      b.cmdTorque = torqueToward(b, aim, w.dt);
      // Thrust only once the keel is near the wanted direction, scaled by alignment.
      const cosErr = Math.cos(angleBetween(keel(b), aim));
      b.cmdAccel = w.t >= ts.igniteAt && cosErr > Math.cos(0.2) ? ts.accel * cosErr : 0;
    }
  },
});

// ---------- PDC clouds ----------

export interface PdcCloud {
  id: number; side: Body["side"]; firedBy: number; t0: number; c0: Vec3; vel: Vec3; dir: Vec3; n: number; burstS: number;
}

const SIGMA0 = 1; // m, transverse spread at the muzzle

export function cloudSigmas(cl: PdcCloud, t: number): { sl: number; st: number } {
  const tau = Math.max(0, t - cl.t0), vm = PDC.muzzleKms * 1000;
  const st = Math.hypot(SIGMA0, PDC.dispersionRad * vm * tau);
  const sl = Math.hypot((vm * cl.burstS) / Math.sqrt(12), PDC.muzzleSpread * vm * tau, SIGMA0);
  return { sl, st };
}

export const cloudCenter = (cl: PdcCloud, t: number) => addScaled(cl.c0, cl.vel, t - cl.t0);
const trailingEdge = (cl: PdcCloud, t: number) => addScaled(cloudCenter(cl, t), cl.dir, (-PDC.muzzleKms * 1000 * cl.burstS) / 2);

/** Fire one mount's burst toward a world direction. Returns null on success or the reason it can't. */
export function fireBurst(c: Combat, s: Ship, mount: number, dir: Vec3): string | null {
  if (!canAct(s)) return "Ship can't act";
  if ((s.pdcBusyUntil[mount] ?? 0) > c.w.t) return "PDC mount busy";
  const n = Math.min(s.pdcAmmo[mount], Math.round((PDC.rpm / 60) * PDC.burstS));
  if (n <= 0) return "PDC mount out of ammunition";
  const b = s.body, vm = PDC.muzzleKms * 1000, w = c.w;
  s.pdcAmmo[mount] -= n;
  s.pdcBusyUntil[mount] = w.t + PDC.burstS;
  const muzzle = addScaled(b.pos, dir, Math.max(...s.cls.size) / 2 + 2);
  // Treat the burst as leaving at its midpoint; the shooter's velocity carries into the rounds.
  const vel = addScaled(b.vel, dir, vm);
  c.clouds.push({ id: w.nextId(), side: b.side, firedBy: b.id, t0: w.t + PDC.burstS / 2, c0: addScaled(muzzle, vel, PDC.burstS / 2), vel, dir, n, burstS: PDC.burstS });
  applyImpulse(b, scale(dir, -n * PDC.roundKg * vm));
  b.dryMass -= n * PDC.roundKg;
  c.perception.flash(w, { t: w.t, pos: b.pos, kind: "pdc", source: b.id, side: b.side });
  return null;
}

// Abramowitz & Stegun 7.1.26, |error| < 1.5e-7.
function erf(x: number): number {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

/** Rounds per m² along the straight path r0 -> r0+d through a Gaussian cloud (cloud frame, axes dir/perp/perp). */
export function columnDensity(n: number, sl: number, st: number, r0: Vec3, d: Vec3): number {
  // Coordinates scaled by sigma make the Gaussian isotropic.
  const z0 = v3(r0.x / sl, r0.y / st, r0.z / st), dz = v3(d.x / sl, d.y / st, d.z / st);
  const A = dot(dz, dz), B = dot(z0, dz), C0 = dot(z0, z0);
  const dl = len(d);
  if (A < 1e-300 || dl === 0) return 0;
  const minQ = C0 - (B * B) / A;
  if (minQ > 900) return 0;
  const k = Math.sqrt(A / 2);
  const integral = Math.exp(-0.5 * minQ) * Math.sqrt(Math.PI / (2 * A)) * (erf(k * (1 + B / A)) - erf(k * (B / A)));
  return (n / (Math.pow(2 * Math.PI, 1.5) * sl * st * st)) * integral * dl;
}

/** Expected PDC hits for a body crossing a cloud between t0 and t1, given its start and end positions. */
export function expectedHits(cl: PdcCloud, body: Body, p0: Vec3, p1: Vec3, t0: number, t1: number): number {
  const c0 = cloudCenter(cl, t0), c1 = cloudCenter(cl, t1);
  const r0w = sub(p0, c0), dw = sub(sub(p1, c1), r0w);
  if (len(dw) === 0) return 0;
  const { sl, st } = cloudSigmas(cl, (t0 + t1) / 2);
  const reach = 10 * Math.max(sl, st) + len(dw);
  if (len(r0w) > reach) return 0;
  // Cloud frame: x along the firing direction.
  const ex = cl.dir, ey = perp(ex), ez = norm(cross3(ex, ey));
  const toCloud = (v: Vec3) => v3(dot(v, ex), dot(v, ey), dot(v, ez));
  const col = columnDensity(cl.n, sl, st, toCloud(r0w), toCloud(dw));
  return col * silhouetteArea(body.q, body.size, norm(dw));
}

const cross3 = (a: Vec3, b: Vec3) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** Draws PDC hits for every body that crossed any cloud during the step. */
export const cloudSystem = (c: Combat) => {
  let start = new Map<number, Vec3>();
  return {
    pre(w: World) {
      start = new Map(w.bodies.filter((b) => b.alive).map((b) => [b.id, b.pos]));
    },
    post(w: World) {
      const t0 = w.t - DT, t1 = w.t;
      // Drop clouds so spread out that even a broadside destroyer crossing their core expects under 1e-7 hits.
      c.clouds = c.clouds.filter((cl) => { const { st } = cloudSigmas(cl, t1); return (cl.n * 3500) / (2 * Math.PI * st * st) > 1e-7; });
      for (const b of w.bodies) {
        const p0 = start.get(b.id);
        if (!b.alive || !p0) continue;
        for (const cl of c.clouds) {
          if (cl.t0 - cl.burstS / 2 > t1) continue;
          // Rounds never move back past the muzzle, so the shooter can only meet its own cloud ahead of the trailing edge.
          if (b.id === cl.firedBy && (t1 < cl.t0 + cl.burstS / 2 || dot(sub(b.pos, trailingEdge(cl, t1)), cl.dir) < 0)) continue;
          const lambda = expectedHits(cl, b, p0, b.pos, Math.max(t0, cl.t0 - cl.burstS / 2), t1);
          if (lambda <= 1e-12) continue;
          const hits = w.rng.poisson(lambda);
          if (hits > 0) {
            const rel = len(sub(b.vel, cl.vel));
            w.destroy(b, { t: t1, type: "hit", target: b.id, by: cl.id, byKind: "pdc", relSpeed: rel, energy: 0.5 * PDC.roundKg * rel * rel * hits, pos: b.pos });
            break;
          }
        }
      }
    },
  };
};

// ---------- Point defense ----------

const PD_MAX_T = 3; // s of round flight: beyond ~15 km the cloud is too thin to matter
const PD_REFIRE = 0.5; // s between bursts at the same torpedo per mount pair

/** Automatic PDC fire at incoming hostile torpedoes, aimed at each torpedo's predicted cloud mean. */
export const pointDefenseSystem = (c: Combat) => {
  const lastShot = new Map<string, number>();
  return {
    pre(w: World) {
      if (w.stepIndex % 6 !== 0) return;
      for (const s of c.ships) {
        if (!canAct(s) || s.cls.pdcMounts === 0) continue;
        const o = c.observers.get(s.body.id)!;
        const threats = o.contacts(w).filter((x) => x.kind === "torpedo" && x.side !== s.body.side);
        const b = s.body;
        threats.sort((x, y) => len(sub(x.pos, b.pos)) - len(sub(y.pos, b.pos)));
        for (const th of threats) {
          // Only torpedoes closing on us, and only once they could reach the PDC envelope soon.
          const rel = sub(th.pos, b.pos), relV = sub(th.vel, b.vel);
          const closing = -dot(relV, rel) / Math.max(1, len(rel));
          if (closing <= 0) continue;
          const lagS = w.t - th.t;
          const reach = (closing + PDC.muzzleKms * 1000) * (PD_MAX_T + lagS + 1) + 0.5 * TORPEDO.maxG * G0 * (PD_MAX_T + lagS + 1) ** 2;
          if (len(rel) > reach) continue;
          // Solve on the cheap extrapolation, then aim at the prediction cloud's mean for that time.
          const extrap = (T: number) => { const h = w.t + T - th.t; return add(addScaled(th.pos, th.vel, h), scale(th.acc, 0.5 * h * h)); };
          const T0 = solveIntercept(b.pos, b.vel, PDC.muzzleKms * 1000, extrap).T;
          const P = o.aimPoint(th, w.t + T0);
          const sol = solveIntercept(b.pos, b.vel, PDC.muzzleKms * 1000, () => P);
          if (!(sol.T > 0 && sol.T <= PD_MAX_T)) continue;
          const key = `${b.id}:${th.id}`;
          if ((lastShot.get(key) ?? -Infinity) + PD_REFIRE > w.t) continue;
          let fired = 0;
          for (let m = 0; m < s.cls.pdcMounts && fired < 2; m++) if (fireBurst(c, s, m, sol.dir) === null) fired++;
          if (fired) lastShot.set(key, w.t);
        }
      }
    },
  };
};


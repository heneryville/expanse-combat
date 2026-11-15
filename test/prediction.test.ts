import { describe, it, expect } from "vitest";
import { Plan, buildPlans, performanceOf, plansFor, predict } from "../src/core/prediction";
import { ObservedState } from "../src/core/perception";
import { G0 } from "../src/core/constants";
import { makeBody, integrateBody } from "../src/core/body";
import { Vec3, len, sub, v3, rotate, qFromTo, qAxisAngle, norm } from "../src/core/vec";

const obs = (over: Partial<ObservedState> = {}): ObservedState => ({
  id: 7, kind: "ship", side: "enemy", size: [140, 25, 25], t: 100, pos: v3(1e9, 2e8, 0), vel: v3(-3000, 500, 20),
  acc: v3(), q: qAxisAngle(v3(0, 0, 1), 0.7), alive: true, ...over,
});

describe("prediction cloud", () => {
  const { plans, perf } = plansFor("destroyer");
  it("grows with time and stays within ½·a_max·t² of the coasting point", () => {
    const o = obs();
    const c1 = predict(o, o.t + 1, plans, perf), c20 = predict(o, o.t + 20, plans, perf);
    expect(c20.spread).toBeGreaterThan(c1.spread);
    const base = v3(o.pos.x + o.vel.x * 20, o.pos.y + o.vel.y * 20, o.pos.z + o.vel.z * 20);
    const maxD = 0.5 * perf.maxG * G0 * 400;
    for (const p of c20.points) expect(len(sub(p, base))).toBeLessThanOrEqual(maxD * (1 + 1e-9));
  });
  it("weights lethal maneuvers near zero", () => {
    const lethal: Plan = { hold: 0, burns: [{ dir: v3(1, 0, 0), accel: 12 * G0, start: 0, end: 2000 }] };
    const mild: Plan = { hold: 0, burns: [{ dir: v3(1, 0, 0), accel: 3 * G0, start: 0, end: 2000 }] };
    const c = predict(obs(), obs().t + 2000, [lethal, mild], perf);
    expect(c.weights.length).toBe(1); // lethal plan dropped below 1e-6
  });
  it("includes 'keep doing it' and 'coast' plans", () => {
    const o = obs({ acc: v3(2 * G0, 0, 0) });
    const c = predict(o, o.t + 10, plans.slice(0, 2), perf);
    expect(c.points[0].x - c.points[1].x).toBeCloseTo(0.5 * 2 * G0 * 100, 6);
  });
  it("torpedo plans beyond the fuel budget are excluded", () => {
    const tp = performanceOf("torpedo");
    const burnAll: Plan = { hold: 0, burns: [{ dir: v3(1, 0, 0), accel: 150 * G0, start: 0, end: 400 }] };
    const c = predict(obs({ kind: "torpedo" }), obs().t + 400, [burnAll], tp, { doseSeen: 0, dvSeen: 0 });
    expect(c.points.length).toBe(0);
  });
});

/** Integrate a plan with the rigid-body integrator, splitting steps exactly at burn boundaries. */
function simulate(o: ObservedState, plan: Plan, h: number): Vec3 {
  const b = makeBody({ id: 1, kind: "ship", side: "enemy", dryMass: 1e6, size: o.size, pos: o.pos, vel: o.vel });
  const edges = new Set<number>([0, h]);
  const segs: { s: number; e: number; dir: Vec3; a: number }[] = [];
  const accG = len(o.acc), hold = plan.hold === Infinity ? h : plan.hold * h;
  if (accG > 0) segs.push({ s: 0, e: hold, dir: o.acc, a: accG });
  for (const x of plan.burns) segs.push({ s: hold + x.start, e: hold + x.end, dir: rotate(o.q, x.dir), a: x.accel });
  for (const s of segs) { edges.add(Math.min(s.s, h)); edges.add(Math.min(s.e, h)); }
  const ts = [...edges].filter((t) => t <= h).sort((a, c) => a - c);
  let t = 0;
  for (const next of ts) {
    while (t < next - 1e-12) {
      const dt = Math.min(1 / 60, next - t);
      const seg = segs.find((s) => t >= s.s - 1e-12 && t < s.e - 1e-12);
      if (seg) { b.q = qFromTo(v3(1, 0, 0), norm(seg.dir)); b.cmdAccel = seg.a; } else b.cmdAccel = 0;
      integrateBody(b, dt);
      t += dt;
    }
  }
  return b.pos;
}

describe("precomputed plans", () => {
  // Weighting off so every plan yields a point we can match one-to-one.
  const perf = { ...performanceOf("destroyer"), crewed: false, dvMax: Infinity };
  const plans = buildPlans(perf, 40, 123);
  for (const h of [1, 60, 1000]) {
    it(`agree with direct simulation within the ship's length at ${h} s`, () => {
      const o = obs({ acc: v3(0, 1.5 * G0, 0) });
      for (const p of plans) {
        const [pt] = predict(o, o.t + h, [p], perf).points;
        expect(len(sub(pt, simulate(o, p, h)))).toBeLessThan(140);
      }
    });
  }
});

import { hitProbability, densest } from "../src/core/prediction";
describe("shot odds", () => {
  const { plans, perf } = plansFor("destroyer");
  it("is near certain at point blank and near zero at a million km", () => {
    const o = obs();
    const near = predict(o, o.t + 1.3, plans, perf), far = predict(o, o.t + 667, plans, perf);
    const dir = v3(1, 0, 0);
    expect(hitProbability(near, densest(near, 140), dir, 20)).toBeGreaterThan(0.5);
    expect(hitProbability(far, densest(far, far.spread / 30), dir, 20)).toBeLessThan(0.05);
  });
});

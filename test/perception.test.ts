import { describe, it, expect } from "vitest";
import { World } from "../src/core/world";
import { makeBody } from "../src/core/body";
import { Perception, perceptionSystem, retardedTime } from "../src/core/perception";
import { C, DT, G0 } from "../src/core/constants";
import { v3 } from "../src/core/vec";

function setup(emitterPos = v3(3 * C, 0, 0), obsVel = v3()) {
  const w = new World(1);
  const obs = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "player", dryMass: 1e5, size: [46, 12, 12], vel: obsVel }));
  const em = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "enemy", dryMass: 1e6, size: [140, 25, 25], pos: emitterPos }));
  const p = new Perception(30);
  p.observers.add(obs.id);
  p.record(w);
  w.systems.push(perceptionSystem(p));
  return { w, obs, em, p };
}

describe("retarded time", () => {
  it("a static emitter 3 light-seconds away is seen 3 s late", () => {
    const { w, obs, em, p } = setup();
    for (let i = 0; i < 600; i++) w.step();
    const tr = retardedTime(p.history(em.id)!, obs.pos, w.t);
    expect(w.t - tr).toBeCloseTo(3, 9);
  });
  it("a moving observer converges to the light-cone solution", () => {
    const { w, obs, em, p } = setup(v3(1 * C, 0, 0), v3(50_000, 0, 0));
    em.cmdAccel = 5 * G0;
    for (let i = 0; i < 900; i++) w.step();
    const h = p.history(em.id)!;
    const tr = retardedTime(h, obs.pos, w.t);
    const s = h.at(tr);
    const gap = Math.hypot(obs.pos.x - s.pos.x, obs.pos.y - s.pos.y, obs.pos.z - s.pos.z);
    expect(Math.abs(C * (w.t - tr) - gap)).toBeLessThan(1e-3);
  });
  it("observed state matches the true state at the emission time", () => {
    const { w, em, p, obs } = setup(v3(0.5 * C, 0, 0));
    const truth: { t: number; x: number }[] = [];
    em.cmdAccel = 2 * G0;
    for (let i = 0; i < 300; i++) { w.step(); truth.push({ t: w.t, x: em.pos.x }); }
    const view = p.view(obs.id, obs.pos, w.t).find((s) => s.id === em.id)!;
    const sample = truth.reduce((a, b) => (Math.abs(b.t - view.t) < Math.abs(a.t - view.t) ? b : a));
    // Between samples the state is the constant-acceleration interpolation.
    expect(Math.abs(view.pos.x - sample.x)).toBeLessThan(2 * G0 * DT * 0.5 * 1.1 + Math.abs(sample.t - view.t) * Math.abs(em.vel.x) + 1);
  });
});

describe("flashes", () => {
  it("a launch flash 1.5M km away is delivered exactly 5.0 s later", () => {
    const d = 1.5e9;
    const { w, obs, p } = setup(v3(d, 0, 0));
    p.flash(w, { t: w.t, pos: v3(d, 0, 0), kind: "launch", source: 999, side: "enemy" });
    const t0 = w.t;
    let seen: number | undefined;
    for (let i = 0; i < 400 && seen === undefined; i++) {
      w.step();
      const f = p.drain(obs.id).find((x) => x.kind === "launch");
      if (f) seen = f.seenAt;
    }
    expect(seen! - t0).toBeCloseTo(d / C, 9);
    expect(d / C).toBeCloseTo(5.0, 2);
  });
  it("burn changes emit flashes", () => {
    const { w, em } = setup();
    em.cmdAccel = 3 * G0;
    w.step(); w.step();
    expect(w.events.some((e) => e.type === "flash" && e.kind === "burnChange" && e.source === em.id)).toBe(true);
  });
});

describe("observer view", () => {
  it("contains only light-delayed states: a burn is invisible until its light arrives", () => {
    const { w, obs, em, p } = setup(v3(2 * C, 0, 0));
    for (let i = 0; i < 300; i++) w.step(); // 5 s of history
    em.cmdAccel = 10 * G0;
    for (let i = 0; i < 60; i++) w.step(); // 1 s of burn
    const v1 = p.view(obs.id, obs.pos, w.t).find((s) => s.id === em.id)!;
    expect(v1.vel.x).toBe(0); // light from the burn is still 1 s away
    expect(em.vel.x).toBeGreaterThan(0);
    for (let i = 0; i < 90; i++) w.step();
    const v2 = p.view(obs.id, obs.pos, w.t).find((s) => s.id === em.id)!;
    expect(v2.vel.x).toBeGreaterThan(0);
    expect(v2.vel.x).toBeLessThan(em.vel.x);
  });
  it("never includes slugs", () => {
    const { w, obs, em, p } = setup(v3(1e5, 0, 0));
    w.fireSlug(em, 2, v3(-1e6, 0, 0), 80);
    w.step();
    const ids = p.view(obs.id, obs.pos, w.t).map((s) => s.id);
    expect(ids).toEqual([em.id]);
  });
});

describe("spawned bodies", () => {
  it("a torpedo launched far away is invisible until its first light arrives", () => {
    const { w, obs, p } = setup(v3(1e9, 0, 0));
    for (let i = 0; i < 60; i++) w.step();
    const torp = w.addBody(makeBody({ id: w.nextId(), kind: "torpedo", side: "enemy", dryMass: 500, size: [4, 0.6, 0.6], pos: v3(1e9, 100, 0) }));
    const t0 = w.t;
    w.step();
    const seen = () => p.view(obs.id, obs.pos, w.t).some((s) => s.id === torp.id);
    expect(seen()).toBe(false);
    while (!seen()) w.step();
    expect(w.t - t0).toBeGreaterThanOrEqual(1e9 / C - DT);
  });
});

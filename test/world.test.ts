import { describe, it, expect } from "vitest";
import { World, Scheduler } from "../src/core/world";
import { makeBody, mass, keel } from "../src/core/body";
import { DT } from "../src/core/constants";
import { v3, scale } from "../src/core/vec";

function scenario(seed: number): World {
  const w = new World(seed);
  const a = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "player", dryMass: 300_000, size: [46, 12, 12], maxTorque: 1e7 }));
  const b = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "enemy", dryMass: 7e6, size: [140, 25, 25], pos: v3(2e6, 0, 0), maxTorque: 1e8 }));
  w.systems.push({
    pre: (w) => {
      if (w.stepIndex % 120 === 0) {
        a.cmdAccel = w.rng.range(0, 30);
        a.cmdTorque = v3(0, w.rng.range(-1e6, 1e6), w.rng.range(-1e6, 1e6));
        b.cmdAccel = w.rng.range(0, 10);
      }
      if (w.stepIndex === 600) w.fireSlug(a, 2, scale(keel(a), 1_500_000), 24);
    },
  });
  return w;
}

describe("determinism and warp", () => {
  it("same seed and orders give identical results at ×1 and at max warp", () => {
    let clock = 0;
    const slow = scenario(9), fast = scenario(9);
    const s1 = new Scheduler(1, 1e9, () => clock);
    const s2 = new Scheduler(1000, 1e9, () => clock);
    const target = 3600;
    while (slow.stepIndex < target) s1.advance(DT, () => slow.step());
    while (fast.stepIndex < target) s2.advance(DT, () => { if (fast.stepIndex < target) fast.step(); });
    expect(fast.stepIndex).toBe(slow.stepIndex);
    expect(fast.bodies.map((b) => [b.pos, b.vel, b.q])).toEqual(slow.bodies.map((b) => [b.pos, b.vel, b.q]));
    expect(fast.events).toEqual(slow.events);
    expect(fast.slugs).toEqual(slow.slugs);
  });
  it("scheduler caps warp instead of lengthening the step", () => {
    let clock = 0;
    const s = new Scheduler(1000, 5, () => clock);
    let steps = 0;
    s.advance(1, () => { steps++; clock += 1; }); // each step "costs" 1 ms
    expect(steps).toBe(6);
    expect(s.achievedWarp).toBeCloseTo(6 * DT, 9);
  });
});

describe("firing and impacts", () => {
  it("railgun recoil is -m·v/M along the keel", () => {
    const w = new World(1);
    const roci = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "player", dryMass: 300_000, size: [46, 12, 12] }));
    const M = mass(roci);
    w.fireSlug(roci, 2, v3(1_500_000, 0, 0), 24);
    expect(roci.vel.x).toBeCloseTo(-(2 * 1_500_000) / M, 12);
  });
  it("slug hit records relative speed and energy", () => {
    const w = new World(1);
    const roci = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "player", dryMass: 300_000, size: [46, 12, 12] }));
    const target = w.addBody(makeBody({ id: w.nextId(), kind: "ship", side: "enemy", dryMass: 7e6, size: [140, 25, 25], pos: v3(30_000, 3, 0), vel: v3(-1000, 0, 0) }));
    w.fireSlug(roci, 2, v3(1_500_000, 0, 0), 24);
    for (let i = 0; i < 10 && target.alive; i++) w.step();
    expect(target.alive).toBe(false);
    const hit = w.events.find((e) => e.type === "hit")!;
    expect(hit.type).toBe("hit");
    if (hit.type === "hit") {
      const rel = 1_500_000 + 1000;
      expect(hit.relSpeed).toBeCloseTo(rel, 3);
      expect(hit.energy).toBeCloseTo(0.5 * 2 * rel * rel, -3);
    }
  });
});

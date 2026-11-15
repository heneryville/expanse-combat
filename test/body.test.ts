import { describe, it, expect } from "vitest";
import { applyImpulse, inertia, integrateBody, keel, makeBody, mass, torqueForFlip } from "../src/core/body";
import { torqueToward, minTurnTime, aligned } from "../src/core/attitude";
import { v3, len, dot } from "../src/core/vec";
import { DT } from "../src/core/constants";

const box = (over = {}) => makeBody({ id: 1, kind: "ship", side: "player", dryMass: 300_000, size: [46, 12, 12], ...over });

describe("translation", () => {
  it("coasting moves v·t within 1e-9", () => {
    const b = box({ vel: v3(1234.5, -987.25, 42.125) });
    const steps = 6000;
    for (let i = 0; i < steps; i++) integrateBody(b, DT);
    const t = steps * DT;
    expect(Math.abs(b.pos.x - 1234.5 * t) / (1234.5 * t)).toBeLessThan(1e-9);
    expect(Math.abs(b.pos.y + 987.25 * t) / (987.25 * t)).toBeLessThan(1e-9);
  });
  it("constant thrust from rest gives ½at² within 1e-6", () => {
    const b = box({ cmdAccel: 9.80665 * 3 });
    const steps = 3600;
    for (let i = 0; i < steps; i++) integrateBody(b, DT);
    const t = steps * DT, exp = 0.5 * 9.80665 * 3 * t * t;
    expect(Math.abs(b.pos.x - exp) / exp).toBeLessThan(1e-6);
    expect(b.pos.y).toBe(0);
  });
  it("drive thrust is only along the keel", () => {
    const b = box({ cmdAccel: 10, q: { w: Math.cos(0.3), x: 0, y: 0, z: Math.sin(0.3) } });
    integrateBody(b, DT);
    const k = keel(b);
    const a = b.accel;
    expect(len(a) - Math.abs(dot(a, k))).toBeLessThan(1e-9);
  });
});

describe("reaction mass", () => {
  it("burning to empty matches the rocket equation, then no thrust", () => {
    const ve = 10_000_000;
    const b = box({ dryMass: 200_000, fuel: 100_000, exhaustV: ve, cmdAccel: 15 * 9.80665 });
    while (b.fuel > 0) integrateBody(b, DT);
    const expected = ve * Math.log(300_000 / 200_000);
    expect(Math.abs(b.vel.x - expected) / expected).toBeLessThan(1e-9);
    const v = b.vel.x;
    integrateBody(b, DT);
    expect(b.vel.x).toBe(v);
  });
});

describe("rotation", () => {
  it("180° flip takes no less than the bang-bang minimum and finishes close to it", () => {
    const tau = torqueForFlip(300_000, [46, 12, 12], 10);
    const b = box({ maxTorque: tau });
    const target = v3(-1, 0, 0);
    // Start a hair off-axis so the turn axis is defined.
    b.q = { w: Math.cos(0.0005), x: 0, y: 0, z: Math.sin(0.0005) };
    const alpha = tau / inertia(b).y;
    let t = 0;
    while (!aligned(b, target, 1e-3) && t < 100) {
      b.cmdTorque = torqueToward(b, target, DT);
      integrateBody(b, DT);
      t += DT;
    }
    const tmin = minTurnTime(Math.PI, alpha);
    expect(t).toBeGreaterThanOrEqual(tmin);
    expect(t).toBeLessThan(tmin * 1.6);
  });
  it("torque never exceeds the limit", () => {
    const b = box({ maxTorque: 1000 });
    const tq = torqueToward(b, v3(0, 1, 0), DT);
    expect(len(tq)).toBeLessThanOrEqual(1000 + 1e-9);
  });
  it("no torque means no heading change", () => {
    const b = box({ omega: v3() });
    const q0 = b.q;
    for (let i = 0; i < 100; i++) integrateBody(b, DT);
    expect(b.q).toEqual(q0);
  });
});

describe("impulse", () => {
  it("applies Δv = J/m", () => {
    const b = box();
    applyImpulse(b, v3(-3_000_000, 0, 0));
    expect(b.vel.x).toBeCloseTo(-3_000_000 / mass(b), 12);
  });
});

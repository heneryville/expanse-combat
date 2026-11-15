import { describe, it, expect } from "vitest";
import { feltG, hazardOver, riskPerHour, strainAfter } from "../src/core/crew";
import { makeBody, integrateBody } from "../src/core/body";
import { DT, G0 } from "../src/core/constants";

const pDeath = (g: number, seconds: number) => 1 - Math.exp(-hazardOver(0, g, seconds));

describe("lethality calibration", () => {
  it("3 g for 1 hour: survival above 99%", () => expect(1 - pDeath(3, 3600)).toBeGreaterThan(0.99));
  it("10 g for 1 minute: survival above 95%", () => expect(1 - pDeath(10, 60)).toBeGreaterThan(0.95));
  it("10 g for 5 minutes: death above 50%", () => expect(pDeath(10, 300)).toBeGreaterThan(0.5));
  it("20 g for 30 seconds: death above 50%", () => expect(pDeath(20, 30)).toBeGreaterThan(0.5));
  it("rises steeply above 5 g", () => expect(pDeath(8, 300)).toBeLessThan(pDeath(10, 300)));
  it("5 g for 3 days: survival above 99%", () => expect(1 - pDeath(5, 3 * 86400)).toBeGreaterThan(0.99));
  it("7 g held: a few percent per hour", () => {
    const r = riskPerHour(strainAfter(0, 7, 3600));
    expect(r).toBeGreaterThan(0.02);
    expect(r).toBeLessThan(0.15);
  });
  it("hazardOver matches stepping", () => {
    let s = 30, h = 0;
    for (let i = 0; i < 600; i++) { h += hazardOver(s, 9, 0.1); s = strainAfter(s, 9, 0.1); }
    expect(hazardOver(30, 9, 60)).toBeCloseTo(h, 12);
  });
  it("strain heals after easing off", () => {
    const hard = strainAfter(0, 12, 120);
    expect(strainAfter(hard, 1, 3600)).toBeLessThan(0.1 * hard);
  });
});

describe("felt acceleration", () => {
  it("equals drive g at the center", () => {
    const b = makeBody({ id: 1, kind: "ship", side: "player", dryMass: 1000, size: [10, 2, 2], cmdAccel: 6 * G0 });
    integrateBody(b, DT);
    expect(feltG(b, 0)).toBeCloseTo(6, 9);
  });
  it("includes centripetal acceleration from spinning", () => {
    const b = makeBody({ id: 1, kind: "ship", side: "player", dryMass: 1000, size: [10, 2, 2], omega: { x: 0, y: 1, z: 0 } });
    integrateBody(b, DT);
    expect(feltG(b, 9.80665)).toBeCloseTo(1, 6); // ω²r = 1·9.80665 m/s²
  });
});

import { World } from "../src/core/world";
import { createShip, crewSystem } from "../src/core/ship";
import { v3 } from "../src/core/vec";

describe("crew death", () => {
  it("a crew killed mid-burn leaves the ship coasting", () => {
    const w = new World(3);
    const s = createShip(w, "rocinante", "player", v3());
    s.crew.threshold = 0.01; // dies early in a hard burn
    w.systems.push({ pre: () => { if (s.crew.alive) s.body.cmdAccel = 14 * G0; } }, crewSystem([s]));
    let steps = 0;
    while (s.crew.alive && steps < 60 * 120) { w.step(); steps++; }
    expect(s.crew.alive).toBe(false);
    expect(w.events.some((e) => e.type === "crewDeath")).toBe(true);
    const v = { ...s.body.vel };
    for (let i = 0; i < 60; i++) w.step();
    expect(s.body.vel.x).toBeCloseTo(v.x, 9);
    expect(s.body.cmdAccel).toBe(0);
  });
});

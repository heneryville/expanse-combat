import { describe, it, expect } from "vitest";
import { sweptObbObb, sweptPointObb, silhouetteArea } from "../src/core/collision";
import { QI, qAxisAngle, v3 } from "../src/core/vec";

const roci = { c: v3(0, 0, 0), q: QI, h: v3(23, 6, 6) };

describe("swept point vs box", () => {
  for (const dt of [1 / 60, 1 / 10, 1]) {
    it(`1,500 km/s slug crossing a 46 m ship is hit with step ${dt}s`, () => {
      const v = 1_500_000;
      const start = v3(-v * dt * 0.37, 1, 2); // crosses mid-step
      const t = sweptPointObb(start, v3(v * dt, 0, 0), roci);
      expect(t).not.toBeNull();
      expect(start.x + t! * v * dt).toBeCloseTo(-23, 6);
    });
  }
  it("misses when passing beside", () => {
    expect(sweptPointObb(v3(-1e6, 7, 0), v3(2e6, 0, 0), roci)).toBeNull();
  });
  it("respects rotation", () => {
    const rotated = { ...roci, q: qAxisAngle(v3(0, 0, 1), Math.PI / 2) };
    // Ship now lies along y; a point at y=20 is inside.
    expect(sweptPointObb(v3(-100, 20, 0), v3(200, 0, 0), rotated)).not.toBeNull();
    expect(sweptPointObb(v3(-100, 20, 0), v3(200, 0, 0), roci)).toBeNull();
  });
});

describe("swept box vs box", () => {
  it("fast torpedo hits a ship within one step", () => {
    const torp = { c: v3(-5000, 0, 0), q: QI, h: v3(2, 0.3, 0.3) };
    const t = sweptObbObb(torp, roci, v3(10000, 0, 0));
    expect(t).not.toBeNull();
    expect(-5000 + 2 + t! * 10000).toBeCloseTo(-23, 6);
  });
  it("misses when offset", () => {
    const torp = { c: v3(-5000, 6.5, 0), q: QI, h: v3(2, 0.3, 0.3) };
    expect(sweptObbObb(torp, roci, v3(10000, 0, 0))).toBeNull();
  });
});

describe("silhouette", () => {
  it("broadside vs nose-on", () => {
    expect(silhouetteArea(QI, [46, 12, 12], v3(1, 0, 0))).toBeCloseTo(144);
    expect(silhouetteArea(QI, [46, 12, 12], v3(0, 1, 0))).toBeCloseTo(552);
  });
});

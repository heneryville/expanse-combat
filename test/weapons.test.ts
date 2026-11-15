import { describe, it, expect } from "vitest";
import { createCombat, shipOf } from "../src/core/combat";
import { C, DT, G0, PDC } from "../src/core/constants";
import { keel, makeBody } from "../src/core/body";
import { angleBetween, len, norm, sub, v3, QI, qAxisAngle } from "../src/core/vec";
import { PdcCloud, cloudSigmas, columnDensity, expectedHits, fireBurst, launchTorpedo, solveIntercept } from "../src/core/weapons";

const run = (c: ReturnType<typeof createCombat>, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < seconds / DT; i++) { c.w.step(); if (until?.()) break; }
};

describe("solveIntercept", () => {
  it("meets a target closing faster than the projectile", () => {
    // Torpedo 100 km out closing at 60 km/s; PDC rounds at 5 km/s.
    const target = (T: number) => v3(1e5 - 6e4 * T, 0, 0);
    const { T, dir } = solveIntercept(v3(), v3(), 5000, target);
    expect(T).toBeCloseTo(1e5 / 6.5e4, 6);
    expect(dir.x).toBeCloseTo(1, 9);
  });
});

describe("railgun", () => {
  it("waits for keel alignment and the 6 s cooldown, then fires along the keel", () => {
    const c = createCombat(1, [
      { cls: "rocinante", side: "player", pos: v3() },
      { cls: "destroyer", side: "enemy", pos: v3(0, 1e9, 0) },
    ]);
    const roci = shipOf(c, "player");
    roci.railOrder = { aim: { point: v3(0, 2e6, 0) } };
    c.w.step();
    expect(c.w.slugs.length).toBe(0); // must rotate 90° first
    run(c, 30, () => c.w.slugs.length > 0);
    expect(c.w.slugs.length).toBe(1);
    expect(c.w.t).toBeGreaterThan(5); // a 90° turn takes several seconds
    const slug = c.w.slugs[0];
    expect(angleBetween(norm(sub(slug.vel, roci.body.vel)), keel(roci.body))).toBeLessThan(1e-3);
    // A second shot right away must wait out the cooldown.
    const firedAt = c.w.t;
    roci.railOrder = { aim: { point: v3(0, 2e6, 0) } };
    run(c, 10, () => c.w.slugs.length > 1);
    expect(c.w.t - firedAt).toBeGreaterThanOrEqual(6 - 1e-9);
  });
  it("a slug fired at a point lands on it", () => {
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3(), vel: v3(3000, -200, 0) }]);
    const roci = shipOf(c, "player");
    const target = v3(1.5e6, 4e5, -2e5);
    roci.railOrder = { aim: { point: target } };
    run(c, 30, () => c.w.slugs.length > 0);
    const s = c.w.slugs[0];
    const T = len(sub(target, s.pos)) / len(s.vel);
    const miss = len(sub(target, v3(s.pos.x + s.vel.x * T, s.pos.y + s.vel.y * T, s.pos.z + s.vel.z * T)));
    expect(miss).toBeLessThan(20);
  });
});

describe("torpedoes", () => {
  it("intercepts a non-maneuvering target", () => {
    const c = createCombat(2, [
      { cls: "destroyer", side: "enemy", pos: v3() },
      { cls: "rocinante", side: "player", pos: v3(3e7, 1e6, 0), vel: v3(-2000, 500, 0) },
    ]);
    const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
    expect(launchTorpedo(c, d, roci.body.id)).toBeNull();
    // Keep the Roci's PDCs out of it.
    roci.pdcAmmo.fill(0);
    run(c, 600, () => !roci.body.alive);
    expect(roci.body.alive).toBe(false);
    const hit = c.w.events.find((e) => e.type === "hit");
    expect(hit && hit.type === "hit" && hit.byKind).toBe("body");
  });
  it("a full destroyer salvo clears the ship without hitting itself", () => {
    const c = createCombat(4, [
      { cls: "destroyer", side: "enemy", pos: v3() },
      { cls: "rocinante", side: "player", pos: v3(0, 3e8, 0) },
    ]);
    const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
    for (let i = 0; i < d.cls.torpedoTubes; i++) expect(launchTorpedo(c, d, roci.body.id)).toBeNull();
    run(c, 20);
    expect(c.w.events.filter((e) => e.type === "hit")).toEqual([]);
    expect([...c.torpedoes.values()].every((t) => t.body.alive)).toBe(true);
  });
  it("coasts after its fuel is spent", () => {
    const c = createCombat(3, [
      { cls: "destroyer", side: "enemy", pos: v3() },
      { cls: "rocinante", side: "player", pos: v3(5e9, 0, 0) },
    ]);
    const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
    launchTorpedo(c, d, roci.body.id);
    const t = [...c.torpedoes.values()][0].body;
    t.fuel = 2; // nearly dry, so it runs out quickly
    run(c, 600, () => t.fuel === 0);
    expect(t.fuel).toBe(0);
    const v = { ...t.vel };
    run(c, 2);
    expect(t.vel).toEqual(v);
  });
  it("refuses with an empty magazine and uses tubes in turn", () => {
    const c = createCombat(3, [{ cls: "rocinante", side: "player", pos: v3() }, { cls: "destroyer", side: "enemy", pos: v3(1e9, 0, 0) }]);
    const roci = shipOf(c, "player");
    expect(launchTorpedo(c, roci, 2)).toBeNull();
    expect(launchTorpedo(c, roci, 2)).toBeNull();
    expect(launchTorpedo(c, roci, 2)).toBe("All tubes reloading");
    roci.magazine = 0;
    run(c, 11);
    expect(launchTorpedo(c, roci, 2)).toBe("Torpedo magazine empty");
  });
});

describe("PDC clouds", () => {
  const cloud = (over: Partial<PdcCloud> = {}): PdcCloud => ({
    id: 1, side: "player", firedBy: 1, t0: 0, c0: v3(), vel: v3(5000, 0, 0), dir: v3(1, 0, 0), n: 33, burstS: 0.5, ...over,
  });
  it("density through the center at twice the distance is about a quarter", () => {
    const cl = cloud();
    const through = (t: number) => {
      const { sl, st } = cloudSigmas(cl, t);
      return columnDensity(cl.n, sl, st, v3(1e5, 0, 0), v3(-2e5, 0, 0)); // head-on, along the line of fire
    };
    const ratio = through(4) / through(2); // 20 km vs 10 km out
    expect(ratio).toBeGreaterThan(0.24);
    expect(ratio).toBeLessThan(0.27);
  });
  it("a full crossing integrates to N / (2π σ²) through the center", () => {
    const { sl, st } = { sl: 700, st: 10 };
    const col = columnDensity(1000, sl, st, v3(0, -1e4, 0), v3(0, 2e4, 0));
    expect(col).toBeCloseTo(1000 / (2 * Math.PI * sl * st), 6);
  });
  it("broadside expects more hits than nose-on by the silhouette ratio", () => {
    const cl = cloud({ vel: v3(0, 0, 0), t0: 0 });
    const ship = (q = QI) => makeBody({ id: 9, kind: "ship", side: "enemy", dryMass: 1, size: [46, 12, 12], q });
    const p0 = v3(0, -5e4, 0), p1 = v3(0, 5e4, 0);
    const noseOn = expectedHits(cl, ship(qAxisAngle(v3(0, 0, 1), Math.PI / 2)), p0, p1, 2, 2 + DT);
    const broadside = expectedHits(cl, ship(), p0, p1, 2, 2 + DT);
    expect(broadside / noseOn).toBeCloseTo(552 / 144, 6);
  });
  it("seeded hit rate matches the expected mean", () => {
    const c = createCombat(5, [{ cls: "rocinante", side: "player", pos: v3() }]);
    let hits = 0;
    const N = 4000, mean = 0.7;
    for (let i = 0; i < N; i++) hits += c.w.rng.poisson(mean) > 0 ? 1 : 0;
    expect(hits / N).toBeCloseTo(1 - Math.exp(-mean), 1);
  });
  it("firing a burst spends ammo and an empty mount can't fire", () => {
    const c = createCombat(5, [{ cls: "rocinante", side: "player", pos: v3() }]);
    const roci = shipOf(c, "player");
    expect(fireBurst(c, roci, 0, v3(1, 0, 0))).toBeNull();
    expect(roci.pdcAmmo[0]).toBe(PDC.ammoPerMount - Math.round((PDC.rpm / 60) * PDC.burstS));
    roci.pdcAmmo[1] = 0;
    expect(fireBurst(c, roci, 1, v3(1, 0, 0))).toBe("PDC mount out of ammunition");
  });
});

describe("point defense and friendly fire", () => {
  it("usually kills a single non-evading torpedo before impact", () => {
    let kills = 0;
    const trials = 6;
    for (let seed = 0; seed < trials; seed++) {
      const c = createCombat(100 + seed, [
        { cls: "destroyer", side: "enemy", pos: v3() },
        { cls: "rocinante", side: "player", pos: v3(2e6, 0, 0) },
      ]);
      const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
      d.pdcAmmo.fill(0);
      launchTorpedo(c, d, roci.body.id);
      const torp = [...c.torpedoes.values()][0].body;
      run(c, 400, () => !torp.alive || !roci.body.alive);
      if (!torp.alive && roci.body.alive) kills++;
    }
    expect(kills).toBeGreaterThanOrEqual(trials / 2);
  }, 60_000);
  it("the Roci's own slug destroys its own torpedo", () => {
    const c = createCombat(6, [{ cls: "rocinante", side: "player", pos: v3() }, { cls: "destroyer", side: "enemy", pos: v3(0, 5 * C, 0) }]);
    const roci = shipOf(c, "player");
    launchTorpedo(c, roci, 2);
    const torp = [...c.torpedoes.values()][0];
    torp.nextGuideAt = Infinity; // no guidance: drift it 2 km clear of the ship
    torp.accel = 0;
    torp.body.vel = v3(0, 1000, 0);
    run(c, 2);
    torp.body.vel = v3();
    roci.railOrder = { aim: { point: torp.body.pos } };
    run(c, 30, () => !torp.body.alive);
    expect(torp.body.alive).toBe(false);
    const hit = c.w.events.find((e) => e.type === "hit");
    expect(hit && hit.type === "hit" && hit.byKind).toBe("slug");
    void G0;
  });
});

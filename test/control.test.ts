import { describe, it, expect } from "vitest";
import { createCombat, shipOf } from "../src/core/combat";
import { DT, G0 } from "../src/core/constants";
import { len, v3 } from "../src/core/vec";
import { LoggedOrder, WarpState, aiSystem, applyOrder, autopilotSystem, orderSystem, warpCheck } from "../src/core/control";
import { feltG } from "../src/core/crew";

describe("autopilot", () => {
  it("reverse course flips and decelerates without exceeding the g allowance", () => {
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3(), vel: v3(5000, 0, 0) }], [autopilotSystem]);
    const roci = shipOf(c, "player");
    applyOrder(c, roci, { type: "setG", g: 4 });
    applyOrder(c, roci, { type: "heading", dir: v3(-1, 0, 0) });
    let maxLinG = 0;
    for (let i = 0; i < 200 / DT && roci.body.vel.x > 0; i++) {
      c.w.step();
      maxLinG = Math.max(maxLinG, len(roci.body.accel) / G0);
    }
    expect(roci.body.vel.x).toBeLessThanOrEqual(0);
    expect(maxLinG).toBeLessThanOrEqual(4 + 1e-9);
    expect(c.w.t).toBeGreaterThan(5000 / (4 * G0)); // at least the burn time, plus the flip
    expect(feltG(roci.body, 0)).toBeLessThan(4.5);
  });
});

describe("orders", () => {
  it("an empty-magazine launch is refused with a reason", () => {
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3() }, { cls: "destroyer", side: "enemy", pos: v3(1e9, 0, 0) }]);
    const roci = shipOf(c, "player");
    roci.magazine = 0;
    expect(applyOrder(c, roci, { type: "torpedo", target: 2 })).toBe("Torpedo magazine empty");
    expect(c.torpedoes.size).toBe(0);
  });
  it("the destroyer refuses railgun orders", () => {
    const c = createCombat(1, [{ cls: "destroyer", side: "enemy", pos: v3() }]);
    expect(applyOrder(c, shipOf(c, "enemy"), { type: "railgun", aim: { point: v3(1, 0, 0) } })).toBe("No railgun");
  });
  it("logged orders apply at their step", () => {
    const log: LoggedOrder[] = [{ step: 10, side: "player", order: { type: "setG", g: 7 } }];
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3() }], [(cc) => orderSystem(cc, log)]);
    for (let i = 0; i < 10; i++) c.w.step();
    expect(shipOf(c, "player").gAllowance).toBe(3);
    c.w.step();
    expect(shipOf(c, "player").gAllowance).toBe(7);
  });
});

describe("enemy AI", () => {
  const mk = (burn: boolean) => {
    const range = 3e9; // 10 light-seconds
    const c = createCombat(4, [
      { cls: "destroyer", side: "enemy", pos: v3() },
      { cls: "rocinante", side: "player", pos: v3(range, 0, 0), vel: v3(-20_000, 0, 0) },
    ], [autopilotSystem, (cc) => aiSystem(cc, "enemy", { keepRangeM: 4e5, launchRangeM: 4e9, salvo: 4, salvoIntervalS: 30, cruiseG: 3, jinkG: 5 })], 30);
    if (burn) c.w.systems.unshift({ pre: (w) => { if (w.t >= 20) { const r = shipOf(c, "player"); r.heading = v3(0, 1, 0); r.gAllowance = 12; } } });
    return c;
  };
  it("can't react to a player burn before its light arrives", () => {
    const a = mk(false), b = mk(true);
    const trace = (c: ReturnType<typeof mk>) => {
      const d = shipOf(c, "enemy");
      return JSON.stringify([d.heading, d.gAllowance, c.torpedoes.size, d.body.pos]);
    };
    let diverged = -1;
    for (let i = 0; i < 45 / DT; i++) {
      a.w.step(); b.w.step();
      if (diverged < 0 && trace(a) !== trace(b)) diverged = a.w.t;
    }
    // The burn starts at 20 s 10 light-seconds away; nothing may change before ~30 s.
    expect(diverged === -1 || diverged >= 29).toBe(true);
    expect(shipOf(a, "enemy").magazine).toBeLessThanOrEqual(40 - 2); // and it does fire salvos of more than one
  }, 60_000);
});

describe("time warp", () => {
  it("drops to ×1 when a hostile launch flash arrives", () => {
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3() }, { cls: "destroyer", side: "enemy", pos: v3(1e9, 0, 0) }]);
    const warp: WarpState = { level: 100, paused: false, dropReason: null };
    warpCheck(c, "player", warp, [{ kind: "launch", side: "enemy" }]);
    expect(warp.level).toBe(1);
    expect(warp.dropReason).toBe("Launch seen");
  });
  it("ignores the player's own flashes", () => {
    const c = createCombat(1, [{ cls: "rocinante", side: "player", pos: v3() }]);
    const warp: WarpState = { level: 50, paused: false, dropReason: null };
    warpCheck(c, "player", warp, [{ kind: "railgun", side: "player" }]);
    expect(warp.level).toBe(50);
  });
});

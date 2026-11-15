import { describe, it, expect } from "vitest";
import { Match, DEFAULT_MATCH } from "../src/core/match";
import { DT, SHIPS } from "../src/core/constants";
import { mass } from "../src/core/body";
import { v3 } from "../src/core/vec";

const quiet = { ...DEFAULT_MATCH, rangeM: 3e9 }; // AI holds fire beyond its launch range

describe("setup", () => {
  it("places the Roci 1–3 million km from two book-stat frigates", () => {
    const m = new Match(1);
    expect(m.enemies.map((e) => e.cls.id)).toEqual(["frigate", "frigate"]);
    for (const e of m.enemies) {
      const d = Math.hypot(e.body.pos.x, e.body.pos.y, e.body.pos.z);
      expect(d).toBeGreaterThanOrEqual(1e9);
      expect(d).toBeLessThanOrEqual(3e9);
      expect(mass(e.body)).toBeCloseTo(SHIPS.frigate.massT * 1000, 3);
    }
    expect(mass(m.player.body)).toBeCloseTo(SHIPS.rocinante.massT * 1000, 3);
    expect(m.player.body.maxAccel / 9.80665).toBeCloseTo(15, 9);
  });
});

describe("end conditions", () => {
  const kill = (m: Match, b: Match["player"]["body"]) => m.combat.w.destroy(b, { t: m.t, type: "hit", target: b.id, by: 0, byKind: "slug", relSpeed: 1, energy: 1, pos: b.pos });
  it("killing one frigate is not a win", () => {
    const m = new Match(1, quiet);
    kill(m, m.enemies[0].body);
    for (let i = 0; i < 20 / DT; i++) m.step();
    expect(m.result).toBeNull();
  });
  it("killing both frigates is a player win", () => {
    const m = new Match(1, quiet);
    for (const e of m.enemies) kill(m, e.body);
    m.step();
    // The kill is 10 light-seconds away: the player learns of it when that light arrives.
    expect(m.result).toBeNull();
    while (!m.result) m.step();
    expect(m.result).toBe("playerWin");
    const far = Math.max(...m.enemies.map((e) => Math.hypot(e.body.pos.x, e.body.pos.y, e.body.pos.z)));
    expect(m.t).toBeCloseTo(far / 299_792_458, 1);
    expect(m.combat.w.events.some((e) => e.type === "end")).toBe(true);
  });
  it("crew death ends the match with an end event", () => {
    const m = new Match(2, quiet);
    m.player.crew.threshold = 1e-6;
    m.order({ type: "setG", g: 15 });
    m.order({ type: "heading", dir: v3(1, 0, 0) });
    for (let i = 0; i < 120 / DT && !m.result; i++) m.step();
    expect(m.result).toBe("enemyWin");
    expect(m.combat.w.events.some((e) => e.type === "crewDeath")).toBe(true);
    expect(m.combat.w.events.at(-1)?.type).toBe("end");
  });
  it("both destroyed in the same step is a mutual kill", () => {
    const m = new Match(3, quiet);
    const hit = (b: typeof m.player.body) => m.combat.w.destroy(b, { t: m.t, type: "hit", target: b.id, by: 0, byKind: "body", relSpeed: 1, energy: 1, pos: v3() });
    hit(m.player.body); for (const e of m.enemies) hit(e.body);
    m.step();
    expect(m.result).toBe("mutualKill");
  });
  it("is a draw when neither side can engage", () => {
    const m = new Match(4, quiet);
    for (const s of [m.player, ...m.enemies]) { s.magazine = 0; s.pdcAmmo.fill(0); s.body.fuel = 0; }
    m.player.cls = { ...m.player.cls, railguns: 0 };
    m.step();
    expect(m.result).toBe("draw");
  });
});

describe("evade", () => {
  it("jinks across the line to the enemy until a heading order ends it", () => {
    const m = new Match(9, quiet);
    m.order({ type: "evade" });
    const headings = new Set<string>();
    for (let i = 0; i < 60 / DT; i++) {
      m.step();
      if (m.player.heading) headings.add(JSON.stringify(m.player.heading));
    }
    expect(headings.size).toBeGreaterThanOrEqual(4);
    // Mostly sideways to the frigates (which sit along +x), not toward or away.
    const v = m.player.body.vel;
    expect(Math.hypot(v.y, v.z)).toBeGreaterThan(Math.abs(v.x));
    m.order({ type: "heading", dir: null });
    m.step();
    expect(m.player.evade).toBeNull();
  });
});

describe("railgun", () => {
  it("fires while the Roci drifts sideways at speed", () => {
    const m = new Match(3, DEFAULT_MATCH);
    m.order({ type: "setG", g: 6 });
    m.order({ type: "heading", dir: v3(0, 1, 0) });
    for (let i = 0; i < 1200 / DT; i++) m.step();
    m.order({ type: "railgun", aim: { contact: m.enemies[0].body.id } });
    m.step(); // orders apply on the next step
    for (let i = 0; i < 30 / DT && m.player.railOrder; i++) m.step();
    expect(m.player.railOrder).toBeNull();
    expect(m.combat.w.slugs.length).toBe(1);
  });
});

describe("pause and replay", () => {
  it("orders queued while paused apply on the next step", () => {
    const m = new Match(5, quiet);
    m.warp.paused = true;
    m.order({ type: "setG", g: 9 });
    expect(m.tick(1)).toBe(0);
    expect(m.player.gAllowance).not.toBe(9);
    m.warp.paused = false;
    m.step();
    expect(m.player.gAllowance).toBe(9);
  });
  it("the truth replay reproduces the live event log", () => {
    const m = new Match(6, { ...DEFAULT_MATCH, rangeM: 1e9 });
    m.order({ type: "setG", g: 5 });
    m.order({ type: "heading", dir: v3(0, 1, 0) });
    for (let i = 0; i < 90 / DT; i++) {
      if (i === 1800) m.order({ type: "torpedo", target: m.enemies[0].body.id, count: 2 });
      if (i === 2400) m.order({ type: "railgun", aim: { contact: m.enemies[0].body.id } });
      m.step();
    }
    const r = Match.replay(m);
    expect(r.combat.w.stepIndex).toBe(m.combat.w.stepIndex);
    expect(JSON.stringify(r.combat.w.events)).toBe(JSON.stringify(m.combat.w.events));
    expect(r.combat.w.events.length).toBeGreaterThan(5);
  }, 120_000);
});

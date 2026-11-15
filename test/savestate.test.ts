import { describe, it, expect } from "vitest";
import { Match, DEFAULT_MATCH } from "../src/core/match";
import { SHIPS } from "../src/core/constants";
import { restoreMatch, saveMatch } from "../src/core/savestate";
import { v3 } from "../src/core/vec";

const close = { ...DEFAULT_MATCH, rangeM: 3e8, wingSepM: 5e7 }; // inside launch range, so salvos and torpedo observers exist

describe("save state", () => {
  it("a restored match continues exactly like the original", () => {
    const m = new Match(7, close);
    m.order({ type: "setG", g: 4 });
    m.order({ type: "heading", dir: v3(1, 0.2, 0) });
    for (let i = 0; i < 400 * 60; i++) {
      if (i === 200 * 60) m.order({ type: "torpedo", target: m.enemies[0].body.id, count: 2 });
      m.step();
    }
    expect(m.combat.torpedoes.size).toBeGreaterThan(0);
    const saved = structuredClone(saveMatch(m));

    const r = new Match(7, close);
    restoreMatch(saved, r);
    expect(r.combat.w.stepIndex).toBe(m.combat.w.stepIndex);
    for (let i = 0; i < 300 * 60; i++) { m.step(); r.step(); }
    expect(JSON.stringify(r.combat.w.events)).toBe(JSON.stringify(m.combat.w.events));
    expect(JSON.stringify(r.combat.w.bodies)).toBe(JSON.stringify(m.combat.w.bodies));
    expect(r.enemies.map((e) => e.magazine)).toEqual(m.enemies.map((e) => e.magazine));
    expect(r.enemies[0].magazine).toBeLessThan(20); // the AI kept fighting after the restore
  }, 120_000);

  it("never writes saved values into shared constants", () => {
    const m = new Match(8);
    const saved = structuredClone(saveMatch(m));
    const frigate = JSON.stringify(SHIPS.frigate), config = JSON.stringify(DEFAULT_MATCH);
    restoreMatch(saved, new Match(8));
    expect(JSON.stringify(SHIPS.frigate)).toBe(frigate);
    expect(JSON.stringify(DEFAULT_MATCH)).toBe(config);
  });
});

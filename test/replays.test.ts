import { describe, it, expect } from "vitest";
import { Match, DEFAULT_MATCH } from "../src/core/match";
import { DT } from "../src/core/constants";
import { launchTorpedo } from "../src/core/weapons";
import { len, sub, v3 } from "../src/core/vec";
import { newReplayState, scanReplays } from "../src/worker/replays";
import type { ActionClip } from "../src/worker/protocol";

const nameOf = (m: Match, id: number) => (id === m.player.body.id ? "Rocinante" : m.enemies.some((e) => e.body.id === id) ? "Frigate" : "torpedo");
const close = { ...DEFAULT_MATCH, rangeM: 2e6, wingSepM: 2e6, offsetZ: 0 };

/** Step the match, scanning for replays the way the worker does, until a kill shows up. */
function runUntilKill(m: Match, maxS: number): ActionClip[] {
  const st = newReplayState(), out: ActionClip[] = [];
  for (let i = 0; i < maxS / DT && !out.some((c) => c.kind === "kill"); i++) {
    m.step();
    if (i % 6 === 0) out.push(...scanReplays(m, st, nameOf));
  }
  return out;
}

describe("instant replays", () => {
  it("a torpedo kill becomes an approach shot then a slow-motion impact", () => {
    const m = new Match(4, close);
    const f = m.enemies[0];
    for (const e of m.enemies) { e.pdcAmmo.fill(0); e.magazine = 0; }
    f.body.maxAccel = 0; // a sitting duck: this is about the replay, not the dodge
    for (let i = 0; i < 30; i++) m.step();
    expect(launchTorpedo(m.combat, m.player, f.body.id)).toBeNull();
    const clips = runUntilKill(m, 200);
    const kill = clips.find((c) => c.kind === "kill");
    expect(kill, JSON.stringify(clips.map((c) => c.title))).toBeDefined();
    expect(kill!.title).toMatch(/destroyed Frigate/);
    expect(kill!.destroyed).toBe(true);
    expect(kill!.shots.map((s) => s.label.split(" ")[0])).toEqual(["Approach", "Impact"]);
    // The approach shot sees the torpedo coming in: it ends far closer to the frigate than it starts.
    const dist = (fr: ActionClip["shots"][0]["frames"][0]) => {
      const t = fr.bodies.find((b) => b.kind === "torpedo"), s = fr.bodies.find((b) => b.id === f.body.id)!;
      return t ? len(sub(t.pos, s.pos)) : NaN;
    };
    const ap = kill!.shots[0].frames;
    expect(dist(ap.at(-1)!)).toBeLessThan(dist(ap[0]) / 5);
  }, 60_000);

  it("a railgun kill is replayed with the slug in frame", () => {
    const m = new Match(5, close);
    const f = m.enemies[0];
    m.combat.w.destroy(f.body, { t: m.t, type: "hit", target: f.body.id, by: 999, byKind: "slug", relSpeed: 1.5e6, energy: 2.25e12, pos: f.body.pos });
    // Give the replay finder a slug path to work from, as if it had watched the slug fly.
    const st = newReplayState();
    st.slugPaths.set(999, { pos: v3(0, 0, 0), vel: v3(1.5e6, 0, 0), t: m.t - 1 });
    let clips: ActionClip[] = [];
    for (let i = 0; i < 20 / DT && !clips.length; i++) { m.step(); clips = scanReplays(m, st, nameOf); }
    expect(clips[0]?.title).toBe("Railgun slug destroyed Frigate");
    expect(clips[0].detail).toMatch(/kt TNT|t TNT/);
    expect(clips[0].shots[1].frames.some((fr) => fr.bodies.some((b) => b.kind === "slug"))).toBe(true);
  });
});

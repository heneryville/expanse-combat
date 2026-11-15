import { it } from "vitest";
import { createCombat, shipOf } from "../src/core/combat";
import { DT } from "../src/core/constants";
import { len, sub, v3 } from "../src/core/vec";
import { launchTorpedo } from "../src/core/weapons";
it("dbg", () => {
  const c = createCombat(2, [{ cls: "destroyer", side: "enemy", pos: v3() }, { cls: "rocinante", side: "player", pos: v3(3e7, 1e6, 0), vel: v3(-2000, 500, 0) }]);
  const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
  roci.pdcAmmo.fill(0);
  launchTorpedo(c, d, roci.body.id);
  const ts = [...c.torpedoes.values()][0];
  let best = Infinity, bestT = 0;
  for (let i = 0; i < 600 / DT && roci.body.alive && ts.body.alive; i++) {
    c.w.step();
    const r = len(sub(ts.body.pos, roci.body.pos));
    if (r < best) { best = r; bestT = c.w.t; }
    if (r < 2e6 && i % 6 === 0) console.log("t", c.w.t.toFixed(2), "r", r.toFixed(0), "tgo", ts.tgo.toFixed(2), "acc", ts.accel.toFixed(0), "cmd", ts.body.cmdAccel.toFixed(0));
  }
  console.log("best", best, "at", bestT);
});

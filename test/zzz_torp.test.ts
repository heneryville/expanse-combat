import { it } from "vitest";
import { createCombat, shipOf } from "../src/core/combat";
import { launchTorpedo } from "../src/core/weapons";
import { keel } from "../src/core/body";
import { angleBetween, len, sub, v3 } from "../src/core/vec";
it("torp", () => {
  const c = createCombat(2, [{ cls: "destroyer", side: "enemy", pos: v3() }, { cls: "rocinante", side: "player", pos: v3(2e6, 0, 0), vel: v3() }]);
  const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
  roci.pdcAmmo.fill(0);
  launchTorpedo(c, d, roci.body.id);
  const ts = [...c.torpedoes.values()][0], b = ts.body;
  const dv = () => b.fuel > 0 ? b.exhaustV * Math.log((b.dryMass + b.fuel) / b.dryMass) / 1000 : 0;
  for (let i = 0; i < 200 * 60; i++) {
    c.w.step();
    if (i % 120 === 0 || i < 60 && i % 6 === 0) console.log(c.w.t.toFixed(2), "dist", (len(sub(b.pos, roci.body.pos)) / 1000).toFixed(1), "km v", (len(b.vel) / 1000).toFixed(2), "dvLeft", dv().toFixed(1), "accel", (ts.accel / 9.8).toFixed(1), "g tgo", ts.tgo.toFixed(1), "aimErr", angleBetween(keel(b), ts.aim).toFixed(3), "cmdA", (b.cmdAccel / 9.8).toFixed(1));
    if (!b.alive || !roci.body.alive) { console.log("end", c.w.t, b.alive, roci.body.alive); break; }
  }
}, 300000);

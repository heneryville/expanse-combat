import { it } from "vitest";
import { createCombat, shipOf } from "../src/core/combat";
import { DT } from "../src/core/constants";
import { len, sub, v3, dot, norm } from "../src/core/vec";
import { launchTorpedo } from "../src/core/weapons";
it("probe", () => {
  for (const seed of [2, 3, 4]) {
    const c = createCombat(seed, [{ cls: "destroyer", side: "enemy", pos: v3() }, { cls: "rocinante", side: "player", pos: v3(3e7, 1e6, 0), vel: v3(-2000, 500, 0) }]);
    const d = shipOf(c, "enemy"), roci = shipOf(c, "player");
    launchTorpedo(c, d, roci.body.id); roci.pdcAmmo.fill(0);
    const ts = [...c.torpedoes.values()][0], tb = ts.body;
    let min = Infinity, lines: string[] = [];
    for (let i = 0; i < 600 / DT && roci.body.alive && tb.alive; i++) {
      c.w.step();
      const r = len(sub(tb.pos, roci.body.pos));
      if (r < 2e5 && i % 6 === 0) {
        const rv = sub(tb.vel, roci.body.vel), rel = sub(roci.body.pos, tb.pos);
        const miss = len(sub(rel, v3(...([0,0,0] as [number,number,number])))) ;
        const tgo = -dot(rel, rv) / dot(rv, rv) * -1;
        const zem = len(sub(rel, v3(rv.x * tgo, rv.y * tgo, rv.z * tgo)));
        lines.push(`r=${r.toFixed(0)} tgo=${tgo.toFixed(2)} ZEM=${zem.toFixed(1)} cmd=${(tb.cmdAccel/9.8).toFixed(0)}g aimErr=${(Math.acos(Math.min(1,dot(norm(ts.aim), v3(...(() => { const k = tb.q; return [0,0,0] as [number,number,number]; })()))))||0).toFixed(2)} T=${ts.tgo.toFixed(2)}`);
      }
      min = Math.min(min, r);
    }
    console.log("SEED", seed, "min", min.toFixed(1), "alive", roci.body.alive, "\n" + lines.slice(-25).join("\n"));
  }
}, 120000);

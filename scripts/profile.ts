import { Match } from "../src/core/match";
const m = new Match(1000);
let w0 = performance.now();
while (m.t < 1800 && !m.result) {
  m.step();
  if (m.combat.w.stepIndex % 3600 === 0) {
    const live = [...m.combat.torpedoes.values()].filter((t) => t.body.alive).length;
    console.log(`t=${m.t.toFixed(0)} wall=${(performance.now() - w0).toFixed(0)}ms torps=${live} clouds=${m.combat.clouds.length} bodies=${m.combat.w.bodies.length} hist=${m.combat.perception.histories.size}`);
    w0 = performance.now();
  }
}
console.log("result", m.result, m.t);

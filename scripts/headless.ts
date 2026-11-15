// Headless bot-vs-AI matches: measures game length, CPU cost per step and the real time a player would spend.
import { Match, DEFAULT_MATCH, MatchConfig } from "../src/core/match";
import { DT } from "../src/core/constants";
import { len, sub, norm } from "../src/core/vec";

const MAX_WARP = Number(process.env.MAX_WARP ?? 100);
const DWELL_S = 4; // real seconds a player spends at ×1 after each warp drop

function botTick(m: Match, botState: { lastTorp: number; lastRail: number }) {
  if (m.combat.w.stepIndex % 60 !== 0) return;
  const o = m.combat.observers.get(m.player.body.id)!;
  const e = o.contacts(m.combat.w).find((x) => x.kind === "ship");
  if (!e) return;
  const now = o.cloud(e, m.t, 300).mean;
  const range = len(sub(now, m.player.body.pos));
  if (m.player.gAllowance !== 4) m.order({ type: "setG", g: 4 });
  // Close to torpedo range, braking so we don't fly through.
  const u = norm(sub(now, m.player.body.pos));
  const closing = -((m.player.body.vel.x - e.vel.x) * -u.x + (m.player.body.vel.y - e.vel.y) * -u.y + (m.player.body.vel.z - e.vel.z) * -u.z);
  const stop = (closing * Math.abs(closing)) / (2 * 4 * 9.80665);
  // Out of torpedoes: press in for railgun range.
  const press = m.player.magazine === 0;
  const far = press ? 5e6 : 3e8, near = press ? 1e6 : 1.5e8;
  m.order({ type: "heading", dir: range - stop > far ? u : range - stop < near ? { x: -u.x, y: -u.y, z: -u.z } : null });
  if (range < 4e8 && m.t - botState.lastTorp > 120 && m.player.magazine > 0) {
    m.order({ type: "torpedo", target: e.id, count: 2 });
    botState.lastTorp = m.t;
  }
  if (range < 2e7 && m.t - botState.lastRail > 7) {
    m.order({ type: "railgun", aim: { contact: e.id } });
    botState.lastRail = m.t;
  }
}

export function play(seed: number, cfg: MatchConfig, maxGameS = Number(process.env.MAX_GAME_S ?? 7200), trace = !!process.env.TRACE) {
  const m = new Match(seed, cfg);
  const bot = { lastTorp: -Infinity, lastRail: -Infinity };
  let realS = 0, dwell = 0, steps = 0, maxStepMs = 0;
  const cpu0 = performance.now();
  while (!m.result && m.t < maxGameS) {
    botTick(m, bot);
    if (m.warp.level === 1) {
      dwell += DT;
      if (dwell >= DWELL_S) { m.setWarp(MAX_WARP); dwell = 0; }
    }
    const s0 = performance.now();
    m.step();
    maxStepMs = Math.max(maxStepMs, performance.now() - s0);
    steps++;
    realS += DT / m.warp.level;
    if (trace && m.combat.w.stepIndex % 3600 === 0) {
      const live = [...m.combat.torpedoes.values()].filter((t) => t.body.alive).length;
      console.log(`t=${m.t.toFixed(0)} cpu=${(performance.now() - cpu0).toFixed(0)}ms torps=${live} clouds=${m.combat.clouds.length} range=${(len(sub(m.enemy.body.pos, m.player.body.pos)) / 1e6).toFixed(0)}Mm`);
    }
  }
  const cpuMs = performance.now() - cpu0;
  const ships = new Set([m.player.body.id, m.enemy.body.id]);
  const kill = m.combat.w.events.find((e) => e.type === "hit" && ships.has(e.target));
  const how = kill && kill.type === "hit" ? `${kill.target === m.player.body.id ? "roci" : "dest"} by ${kill.byKind} @${kill.t.toFixed(0)}s` : m.combat.w.events.find((e) => e.type === "crewDeath") ? "crew death" : "-";
  const launches = (id: number) => m.combat.w.events.filter((e) => e.type === "flash" && e.kind === "launch" && e.source === id).length;
  const slugs = m.combat.w.events.filter((e) => e.type === "flash" && e.kind === "railgun").length;
  if (process.env.EVENTS) for (const e of m.combat.w.events) if (e.type !== "flash" || e.kind !== "burnChange") console.log(e.t.toFixed(1), e.type, e.type === "hit" ? `${m.combat.w.body(e.target)?.kind}/${m.combat.w.body(e.target)?.side} by ${e.byKind} rel ${(e.relSpeed / 1000).toFixed(0)}km/s` : e.type === "flash" ? `${e.kind} src ${e.source}` : "");
  return { seed, result: m.result ?? "timeout", how, salvos: `${launches(m.player.body.id)}/${launches(m.enemy.body.id)}`, slugs, gameS: m.t, realMin: realS / 60, msPerStep: cpuMs / steps, maxStepMs, torpsFired: [...m.combat.torpedoes.values()].length };
}

const N = Number(process.env.N ?? 6);
const rows = [];
for (let i = 0; i < N; i++) {
  const r = play(1000 + i, { ...DEFAULT_MATCH });
  console.log(JSON.stringify(r));
  rows.push(r);
}
console.table(rows.map((r) => ({ ...r, gameS: r.gameS.toFixed(0), realMin: r.realMin.toFixed(1), msPerStep: r.msPerStep.toFixed(3), maxStepMs: r.maxStepMs.toFixed(1) })));
const avgStep = rows.reduce((a, r) => a + r.msPerStep, 0) / rows.length;
console.log(`avg ms/step ${avgStep.toFixed(3)} -> sustainable warp at 12 ms/frame, 60 fps: x${(12 / avgStep * DT * 60).toFixed(0)}`);

// Runs the match off the main thread; the page only ever receives the player's light-delayed view (or the replay).
import { C, G0, RAILGUN } from "../core/constants";
import { riskPerHour } from "../core/crew";
import { Match } from "../core/match";
import type { Order } from "../core/control";
import { DeliveredFlash, ObservedState } from "../core/perception";
import { Cloud, densest, hitProbability } from "../core/prediction";
import { canAct } from "../core/ship";
import { addScaled, angleBetween, dot, len, norm, sub, Vec3 } from "../core/vec";
import { silhouetteArea } from "../core/collision";
import { cloudCenter, cloudSigmas, solveIntercept } from "../core/weapons";
import { keel } from "../core/body";
import type { CloudView, ContactView, FromWorker, LogEntry, ReplayFrame, Snapshot, ToWorker } from "./protocol";
import { restoreMatch, saveMatch, SaveState } from "../core/savestate";
import { newReplayState, ReplayState, scanReplays } from "./replays";

let replays = newReplayState();

let match: Match | null = null;
let selected: { id: number; aiming: boolean } | null = null;
let last = performance.now();
let frames: ReplayFrame[] = [];
// Slugs the player fired: known exactly at launch, then extrapolated until light of an impact on their path arrives.
let knownSlugs = new Map<number, { pos: Vec3; vel: Vec3; t: number; from: Vec3; firedAt: number }>();
// Event log: entries not yet posted, plus what has already been turned into entries.
let pendingLog: LogEntry[] = [];
let allLog: LogEntry[] = []; // kept for the save; older lines are dropped
let lastEntry: LogEntry | null = null;
let flashesLogged = 0, lastNotice: string | null = null, headingLabel = "";
let ownLogged = new Set<number>(), crewDeathLogged = false;
const post = (m: FromWorker, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

/** Stable display name for any body: the Roci, Frigate 1/2, or a torpedo by who launched it. */
function nameOf(m: Match, id: number): string {
  if (id === m.player.body.id) return "Rocinante";
  const i = m.enemies.findIndex((e) => e.body.id === id);
  if (i >= 0) return `Frigate ${i + 1}`;
  const torp = m.combat.torpedoes.get(id);
  if (!torp) return "contact";
  return torp.launcher === m.player.body.id ? "your torpedo" : `torpedo from ${nameOf(m, torp.launcher)}`;
}

/** Append to the log, folding a repeat of the previous line within 3 s into a count. */
function log(t: number, kind: LogEntry["kind"], text: string, age = 0): void {
  if (lastEntry && lastEntry.text === text && t - lastEntry.t < 3) lastEntry.count++;
  else lastEntry = { id: (lastEntry?.id ?? 0) + 1, t, text, kind, age, count: 1 };
  if (!pendingLog.includes(lastEntry)) pendingLog.push(lastEntry);
  if (allLog.at(-1) !== lastEntry) allLog.push(lastEntry);
  if (allLog.length > 400) allLog = allLog.slice(-200);
}

function describeOrder(m: Match, o: Order, label: string): string {
  switch (o.type) {
    case "setG": return `Order: g allowance ${o.g.toFixed(1)} g`;
    case "heading": return o.dir ? `Order: burn ${label}` : "Order: cut drive, coast";
    case "railgun": return `Order: railgun at ${"contact" in o.aim ? nameOf(m, o.aim.contact) : "point"}`;
    case "torpedo": return `Order: launch ${o.count ?? 1} torpedo${(o.count ?? 1) > 1 ? "es" : ""} at ${nameOf(m, o.target)}`;
    case "pdc": return `Order: PDC burst at ${"contact" in o.aim ? nameOf(m, o.aim.contact) : "point"}`;
    case "evade": return "Order: evade, random jinks across the line of fire";
  }
}

const FLASH_TEXT: Record<string, string> = { launch: "launched a torpedo", burnChange: "changed its burn", railgun: "fired its railgun", pdc: "fired PDCs" };

/**
 * What an enemy flash shows and a likely reason, read only from the light that carried it:
 * the ship's state at the flash versus the Roci's own state when that light arrived.
 */
function describeFlash(m: Match, f: DeliveredFlash): string {
  const who = nameOf(m, f.source), base = `${who} ${FLASH_TEXT[f.kind] ?? f.kind}`;
  const h = m.combat.perception.histories, me = h.get(m.player.body.id)?.at(f.seenAt), them = h.get(f.source)?.at(f.t);
  if (!me || !them) return base;
  const rel = sub(me.pos, them.pos), u = norm(rel), range = len(rel);
  const closing = dot(sub(them.vel, me.vel), u); // >0: the gap is shrinking
  const ownTorps = [...m.combat.torpedoes.values()].some((t) => t.launcher === m.player.body.id && t.body.alive);
  if (f.kind === "launch") return `${base} at you · ${fmtKm(range)} out`;
  if (f.kind === "pdc") return `${base} · ${ownTorps ? "likely point defense against your torpedoes" : "an offensive burst"}`;
  if (f.kind !== "burnChange") return base;
  const g = len(them.acc) / G0;
  if (g < 0.05) return closing > 1000
    ? `${who} cut its drive · coasting in at ${fmtKms(closing)}, saving reaction mass for the fight`
    : `${who} cut its drive · coasting, likely holding this range`;
  const along = dot(norm(them.acc), u);
  const shotAt = m.combat.w.events.some((e) => e.type === "flash" && e.kind === "railgun" && e.source === m.player.body.id && e.t < f.t && f.t - e.t < 120 + range / C);
  const burn = `${who} burning ${g.toFixed(1)} g`;
  if (along > 0.7) return `${burn} toward you · ${closing > 1000 ? "pressing the attack, closing faster" : "closing the range"}`;
  if (along < -0.7) return closing > 1000
    ? `${burn} away from you · braking, killing ${fmtKms(closing)} of closing speed to hold range`
    : `${burn} away from you · opening the range, backing off`;
  return `${burn} sideways · ${shotAt ? "jinking, likely dodging your railgun" : "evasive, getting off your line of fire"}`;
}

// Described once per drop; the snapshot asks 30 times a second.
let dropMemo: { flash: object; text: string } | null = null;
function dropText(m: Match): string | null {
  const f = m.warp.dropFlash;
  if (!f || !("source" in f)) return m.warp.dropReason;
  if (dropMemo?.flash !== f) dropMemo = { flash: f, text: describeFlash(m, f as DeliveredFlash) };
  return dropMemo.text;
}

const fmtKm = (m: number) => `${Math.round(m / 1000).toLocaleString()} km`;
const fmtKms = (v: number) => `${(v / 1000).toFixed(1)} km/s`;

/** Turn what the Roci did, and the light it just received, into log lines. */
function updateLog(m: Match): void {
  const w = m.combat.w, p = m.player, pid = p.body.id;
  // Own actions are known the moment they happen.
  for (const [id, torp] of m.combat.torpedoes) {
    if (torp.launcher !== pid || ownLogged.has(id)) continue;
    ownLogged.add(id);
    log(w.t, "own", `Launched torpedo at ${nameOf(m, torp.targetId)}`);
  }
  for (const sl of w.slugs) {
    if (sl.firedBy !== pid || ownLogged.has(sl.id)) continue;
    ownLogged.add(sl.id);
    log(w.t, "own", "Railgun fired");
  }
  if (!p.crew.alive && !crewDeathLogged) {
    crewDeathLogged = true;
    log(w.t, "kill", `Crew killed by g-load at ${p.crew.lastG.toFixed(1)} g (death risk was ${(riskPerHour(p.crew.dose) * 100).toFixed(0)}%/h). The Roci is adrift.`);
  }
  if (p.notice !== lastNotice) {
    if (p.notice) log(w.t, "fail", p.notice);
    lastNotice = p.notice;
  }
  // Everything else arrives as light. Torpedo burn changes are guidance noise.
  for (; flashesLogged < m.playerFlashes.length; flashesLogged++) {
    const f = m.playerFlashes[flashesLogged];
    const who = nameOf(m, f.source), age = f.seenAt - f.t;
    if (f.kind === "impact") log(f.seenAt, "kill", `${who[0].toUpperCase()}${who.slice(1)} destroyed`, age);
    else if (f.side !== "player" && !(f.kind === "burnChange" && m.combat.torpedoes.has(f.source))) log(f.seenAt, "enemy", describeFlash(m, f), age);
  }
}

/** Plain-language summary of what the Roci is doing under its current orders. */
function standing(m: Match, seen: ObservedState[]): Snapshot["standing"] {
  const p = m.player, b = p.body, w = m.combat.w;
  let drive: string, driveState: Snapshot["standing"]["driveState"];
  if (!canAct(p)) { drive = "Ship disabled"; driveState = "coast"; }
  else if (p.railOrder) {
    const off = p.railOrder.dir ? angleBetween(keel(b), p.railOrder.dir) * 180 / Math.PI : NaN;
    const offText = !Number.isFinite(off) ? "" : off >= 0.1 ? ` · ${off.toFixed(1)}° off` : ` · ${(off * Math.PI / 180 * 1e6).toFixed(1)} µrad off (fires inside 10)`;
    drive = `Turning to aim railgun${offText}`; driveState = "aim";
  } else if (!p.heading) { drive = "Coasting · drive cut"; driveState = "coast"; }
  else {
    const off = angleBetween(keel(b), p.heading) * 180 / Math.PI;
    const next = p.evade ? ` · next jink in ${Math.max(0, p.evade.nextAt - w.t).toFixed(0)} s` : "";
    if (p.evade) {
      drive = off > 3 ? `Evading · turning to a new jink, ${off.toFixed(0)}° off${next}` : `Evading · burning ${Math.min(p.gAllowance, p.cls.maxG).toFixed(1)} g on a random jink${next}`;
      driveState = off > 3 ? "turn" : "burn";
    } else if (off > 3) { drive = `Turning to burn ${headingLabel} · ${off.toFixed(0)}° off`; driveState = "turn"; }
    else if (p.gAllowance <= 0) { drive = `Pointed ${headingLabel}, but g allowance is 0`; driveState = "coast"; }
    else { drive = `Burning ${Math.min(p.gAllowance, p.cls.maxG).toFixed(1)} g ${headingLabel}`; driveState = "burn"; }
  }
  const railgun = p.railOrder && "contact" in p.railOrder.aim ? `Aiming at ${nameOf(m, p.railOrder.aim.contact)}`
    : p.railgunReadyAt > w.t ? `Reloading · ${(p.railgunReadyAt - w.t).toFixed(1)} s` : "Ready";
  const byTarget = new Map<string, number>();
  for (const s of seen) {
    const torp = s.kind === "torpedo" && s.side === "player" ? m.combat.torpedoes.get(s.id) : undefined;
    if (torp) byTarget.set(nameOf(m, torp.targetId), (byTarget.get(nameOf(m, torp.targetId)) ?? 0) + 1);
  }
  const torpedoes = [...byTarget].map(([t, n]) => `${n} torpedo${n > 1 ? "es" : ""} → ${t}`);
  return { drive, driveState, evading: !!p.evade, railgun, torpedoes };
}

const contactView = (m: Match, s: ObservedState, t: number): ContactView => ({
  id: s.id, name: nameOf(m, s.id), slot: m.enemies.findIndex((e) => e.body.id === s.id), kind: s.kind, side: s.side, pos: s.pos, vel: s.vel, q: s.q, size: s.size, age: t - s.t, g: len(s.acc) / G0,
});

function cloudView(c: Cloud, label: string): CloudView {
  const origin = c.mean, n = c.points.length;
  const pts = new Float32Array(n * 3), w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = c.points[i];
    pts[i * 3] = p.x - origin.x; pts[i * 3 + 1] = p.y - origin.y; pts[i * 3 + 2] = p.z - origin.z;
    w[i] = c.weights[i];
  }
  return { points: pts, weights: w, origin, t: c.t, spread: c.spread, label };
}

function snapshot(m: Match): Snapshot {
  const c = m.combat, w = c.w, p = m.player, b = p.body;
  const o = c.observers.get(b.id)!;
  const seen = o.contacts(w);
  let sel: Snapshot["selected"] = null;
  if (selected) {
    const obs = seen.find((s) => s.id === selected!.id);
    if (obs) {
      let tq = w.t, label = "now", arrival: number | null = null, hitP: number | null = null;
      if (selected.aiming) {
        // The cloud at the moment a slug fired now would arrive, and the share of it a slug through its densest point meets.
        const sol = solveIntercept(b.pos, b.vel, RAILGUN.muzzleKms * 1000, (T) => o.cloud(obs, w.t + T, 300).mean);
        tq = w.t + sol.T; arrival = sol.T; label = `slug arrival +${sol.T.toFixed(1)} s`;
        const cl = o.cloud(obs, tq);
        const aim = densest(cl, Math.max(Math.max(...obs.size), cl.spread / 30));
        const dir = norm(sub(aim, b.pos));
        hitP = hitProbability(cl, aim, dir, Math.sqrt(silhouetteArea(obs.q, obs.size, dir) / Math.PI));
        sel = { id: obs.id, cloud: cloudView(cl, label), arrivalS: arrival, hitP };
      } else sel = { id: obs.id, cloud: cloudView(o.cloud(obs, tq), label), arrivalS: arrival, hitP };
    }
  }
  const threats = seen.filter((x) => x.kind === "torpedo" && x.side !== "player").map((x) => {
    const rel = sub(x.pos, b.pos), range = len(rel), closing = -dot(sub(x.vel, b.vel), rel) / Math.max(1, range);
    return { id: x.id, range, closing, eta: closing > 0 ? range / closing - (w.t - x.t) : Infinity, age: w.t - x.t };
  }).sort((a, z) => a.eta - z.eta);
  updateLog(m);
  for (const clip of scanReplays(m, replays, nameOf)) post({ type: "action", clip });
  const entries = pendingLog.map((e) => ({ ...e }));
  pendingLog = [];
  const mine = c.perception.flashes.filter((f) => f.source === b.id).at(-1);
  const pdcRounds = p.pdcAmmo.reduce((a, x) => a + x, 0);
  return {
    type: "snapshot", t: w.t, warp: m.warp.level, achievedWarp: m.scheduler.achievedWarp, dropReason: dropText(m),
    paused: m.warp.paused, result: m.result,
    player: {
      id: b.id, pos: b.pos, vel: b.vel, q: b.q, size: b.size, g: p.crew.lastG, gAllowance: p.gAllowance, maxG: p.cls.maxG,
      dose: p.crew.dose, riskPerHour: riskPerHour(p.crew.dose), dvLeftKms: b.fuel > 0 ? (b.exhaustV * Math.log((b.dryMass + b.fuel) / b.dryMass)) / 1000 : 0,
      magazine: p.magazine, tubesReady: p.tubesReadyAt.filter((x) => x <= w.t).length, tubes: p.tubesReadyAt.length, pdcRounds,
      railReadyIn: Math.max(0, p.railgunReadyAt - w.t), railAiming: !!p.railOrder, notice: p.notice, heading: p.heading, alive: canAct(p), crewAlive: p.crew.alive,
    },
    contacts: seen.map((s) => contactView(m, s, w.t)),
    ownSlugs: trackSlugs(m),
    ownClouds: c.clouds.filter((cl) => cl.side === "player" && w.t - cl.t0 < 120).map((cl) => ({ id: cl.id, center: cloudCenter(cl, w.t), dir: cl.dir, ...cloudSigmas(cl, w.t), n: cl.n })),
    lastEmission: mine ? { t: mine.t, pos: mine.pos, kind: mine.kind } : null,
    recentFlashes: m.playerFlashes.filter((f) => w.t - f.seenAt < 30).map((f) => ({ kind: f.kind, pos: f.pos, seenAt: f.seenAt, side: f.side })),
    enemyClouds: seen.filter((x) => x.kind === "ship" && x.side === "enemy").map((x) => ({
      id: x.id, slot: m.enemies.findIndex((e) => e.body.id === x.id), name: nameOf(m, x.id), cloud: cloudView(o.cloud(x, w.t, 600), "now"),
    })),
    selected: sel,
    threats,
    standing: standing(m, seen),
    log: entries,
  };
}

function trackSlugs(m: Match): Snapshot["ownSlugs"] {
  const w = m.combat.w, t = w.t;
  for (const s of w.slugs) {
    if (s.side !== "player" || knownSlugs.has(s.id)) continue;
    // At high warp the slug is first seen far downrange; its railgun flash marks the muzzle.
    const fire = [...w.events].reverse().find((e) => e.type === "flash" && e.kind === "railgun" && e.source === s.firedBy);
    knownSlugs.set(s.id, { pos: s.pos, vel: s.vel, t, from: fire && "pos" in fire ? fire.pos : s.pos, firedAt: fire ? fire.t : t });
  }
  const impacts = m.playerFlashes.filter((f) => f.kind === "impact");
  const out: Snapshot["ownSlugs"] = [];
  for (const [id, k] of knownSlugs) {
    const at = (tt: number) => addScaled(k.pos, k.vel, tt - k.t);
    const ended = impacts.some((f) => f.t >= k.t && len(sub(at(f.t), f.pos)) < 5000);
    if (ended || len(sub(at(t), m.player.body.pos)) > 1e10) { knownSlugs.delete(id); continue; }
    out.push({ pos: at(t), vel: k.vel, from: k.from, age: t - k.firedAt });
  }
  return out;
}

/** The freshest view any living enemy has of each contact. */
function enemySaw(m: Match): ContactView[] {
  const w = m.combat.w, best = new Map<number, ObservedState>();
  for (const e of m.enemies) {
    if (!e.body.alive) continue;
    for (const s of m.combat.observers.get(e.body.id)!.contacts(w)) {
      const prev = best.get(s.id);
      if (!prev || s.t > prev.t) best.set(s.id, s);
    }
  }
  return [...best.values()].map((s) => contactView(m, s, w.t));
}

/** Rebuild the finished match from seed and orders, keeping one omniscient frame per game second. */
function buildReplay(m: Match): void {
  const r = new Match(m.seed, m.config, m.log.slice());
  frames = [];
  const end = m.combat.w.stepIndex;
  let shot: ReplayFrame["shot"] = null;
  const capture = () => {
    const c = r.combat, w = c.w;
    const pv = c.observers.get(r.player.body.id)!;
    frames.push({
      t: w.t,
      truth: w.bodies.map((x) => ({ id: x.id, kind: x.kind, side: x.side, pos: x.pos, q: x.q, size: x.size, alive: x.alive })),
      slugs: w.slugs.map((s) => s.pos),
      clouds: c.clouds.filter((cl) => w.t - cl.t0 < 120 && cl.t0 - cl.burstS / 2 <= w.t).map((cl) => ({ id: cl.id, center: cloudCenter(cl, w.t), dir: cl.dir, ...cloudSigmas(cl, w.t), n: cl.n })),
      playerSaw: pv.contacts(w).map((s) => contactView(m, s, w.t)),
      enemySaw: enemySaw(r),
      shot,
    });
  };
  capture();
  while (r.combat.w.stepIndex < end) {
    const p = r.player, aiming = p.railOrder;
    const before = r.combat.w.slugs.length;
    r.step();
    // Record the cloud the player aimed at whenever a slug leaves the Roci.
    if (aiming && r.combat.w.slugs.length > before && aiming.point && "contact" in aiming.aim) {
      const o = r.combat.observers.get(p.body.id)!;
      const obs = o.contact(r.combat.w, aiming.aim.contact);
      if (obs) {
        const T = len(sub(aiming.point, p.body.pos)) / (RAILGUN.muzzleKms * 1000);
        shot = { aim: aiming.point, cloud: cloudView(o.cloud(obs, r.t + T), `aimed at, +${T.toFixed(1)} s`) };
      }
    }
    if (r.combat.w.stepIndex % 60 === 0 || r.combat.w.stepIndex === end) { capture(); shot = null; }
  }
  post({ type: "replayReady", frames: frames.length, duration: r.t });
}

function reset(m: Match): void {
  match = m; selected = null; frames = []; knownSlugs = new Map();
  replays = newReplayState();
  pendingLog = []; allLog = []; lastEntry = null; flashesLogged = 0; lastNotice = null; headingLabel = ""; ownLogged = new Set(); crewDeathLogged = false; dropMemo = null;
}

// ---------- Save state: the whole match, per tab, in IndexedDB (too big for sessionStorage) ----------

interface Saved { tabId: string; savedAt: number; seed: number; state: SaveState; ui: UiState }
interface UiState {
  log: LogEntry[]; headingLabel: string; flashesLogged: number; ownLogged: Set<number>; knownSlugs: typeof knownSlugs; lastNotice: string | null;
  replays?: ReplayState;
}

let tabId: string | null = null;
let lastSave = 0, savedStep = -1, saving = false;
let dbp: Promise<IDBDatabase> | null = null;
const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    const open = indexedDB.open("expanse-combat", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("saves", { keyPath: "tabId" });
    dbp = req(open);
  }
  return dbp;
}
const store = async (mode: IDBTransactionMode) => (await db()).transaction("saves", mode).objectStore("saves");

async function writeSave(m: Match): Promise<void> {
  const rec: Saved = {
    tabId: tabId!, savedAt: Date.now(), seed: m.seed, state: saveMatch(m),
    ui: { log: allLog.slice(-200), headingLabel, flashesLogged, ownLogged, knownSlugs, lastNotice, replays },
  };
  const s = await store("readwrite");
  await req(s.put(rec));
  // Keep the five most recent tabs' saves; older ones are from closed tabs.
  const all = await req((await store("readonly")).getAll()) as Saved[];
  const old = all.sort((a, b) => b.savedAt - a.savedAt).slice(5);
  if (old.length) { const w = await store("readwrite"); for (const o of old) w.delete(o.tabId); }
}

async function resume(id: string, seed: number): Promise<void> {
  tabId = id;
  let saved: Saved | undefined;
  try { saved = await req((await store("readonly")).get(id)) as Saved | undefined; } catch { /* no storage */ }
  if (saved) {
    try {
      const m = new Match(saved.seed);
      restoreMatch(saved.state, m);
      reset(m);
      const u = saved.ui;
      ({ headingLabel, flashesLogged, ownLogged, knownSlugs, lastNotice } = u);
      replays = u.replays ?? { ...newReplayState(), eventsSeen: m.combat.w.events.length };
      allLog = u.log; pendingLog = u.log.slice(); lastEntry = u.log.at(-1) ?? null;
      savedStep = m.combat.w.stepIndex;
      post({ type: "resumed", restored: true });
      return;
    } catch (err) {
      console.warn("Saved match could not be restored; starting fresh.", err);
    }
  }
  newMatch(seed);
  post({ type: "resumed", restored: false });
}

function newMatch(seed: number): void {
  reset(new Match(seed));
  savedStep = -1;
  log(0, "order", "Two frigates on scope. Select one, then burn toward it or launch.");
}

function maybeSave(m: Match, now: number): void {
  // Skip while nothing moves (paused, no new orders): the stored copy is already current.
  if (!tabId || saving || now - lastSave < 1000 || (m.combat.w.stepIndex === savedStep && pendingLog.length === 0)) return;
  lastSave = now; saving = true; savedStep = m.combat.w.stepIndex;
  writeSave(m).catch((err) => console.warn("Save failed", err)).finally(() => { saving = false; });
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "start": newMatch(msg.seed); break;
    case "resume": void resume(msg.tabId, msg.seed); break;
    case "order":
      if (!match) break;
      if (msg.order.type === "heading") headingLabel = msg.label;
      match.order(msg.order);
      log(match.t, "order", describeOrder(match, msg.order, msg.label));
      break;
    case "warp": match?.setWarp(msg.level); break;
    case "pause": if (match) match.warp.paused = msg.paused; break;
    case "select": selected = msg.contactId === null ? null : { id: msg.contactId, aiming: msg.aiming }; break;
    case "replay": if (match?.result) buildReplay(match); break;
    case "scrub": {
      const f = frames[Math.max(0, Math.min(frames.length - 1, msg.index))];
      if (f) post({ type: "replayFrame", index: msg.index, frame: f });
      break;
    }
  }
};

setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!match) return;
  match.tick(dt);
  const s = snapshot(match);
  const clouds = [...s.enemyClouds.map((e) => e.cloud), ...(s.selected?.cloud ? [s.selected.cloud] : [])];
  const transfer = clouds.flatMap((c) => [c.points.buffer, c.weights.buffer]);
  post(s, transfer);
  maybeSave(match, now);
}, 1000 / 30);


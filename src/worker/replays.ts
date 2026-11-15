// Instant replays: find ship kills, torpedoes shot down and near-misses, and cut clips of them from the light histories.
import { C, G0 } from "../core/constants";
import { Match } from "../core/match";
import { History } from "../core/perception";
import { add, addScaled, cross, dot, len, norm, perp, qFromTo, scale, sub, v3, Vec3 } from "../core/vec";
import { cloudCenter, cloudSigmas } from "../core/weapons";
import type { ActionClip, ClipBody } from "./protocol";


interface SlugPath { pos: Vec3; vel: Vec3; t: number }
interface PendingAction {
  kind: ActionClip["kind"]; t: number; pos: Vec3; target: number; revealAt: number;
  torp?: number; slug?: SlugPath; cloud?: number; byKind?: string; energy?: number; missM?: number;
}
const MISS_REPORT_M = 50_000;

/** What the replay finder has already looked at; plain data so it saves with the match. */
export interface ReplayState {
  eventsSeen: number;
  actions: PendingAction[];
  /** Per torpedo: was it closing on its target last time we looked (a closing-to-opening flip is a pass). */
  torpWatch: Map<number, boolean>;
  /** Slugs in flight, as straight lines, so a slug kill can be replayed after the slug is gone. */
  slugPaths: Map<number, SlugPath>;
}

export const newReplayState = (): ReplayState => ({ eventsSeen: 0, actions: [], torpWatch: new Map(), slugPaths: new Map() });
type NameOf = (m: Match, id: number) => string;

/** Find ship kills, torpedoes shot down and torpedo near-misses; returns the replays whose light has reached the Roci. */
export function scanReplays(m: Match, st: ReplayState, nameOf: NameOf): ActionClip[] {
  const c = m.combat, w = c.w, me = m.player.body.pos, { slugPaths, torpWatch } = st;
  const queue = (a: Omit<PendingAction, "revealAt">) => st.actions.push({ ...a, revealAt: a.t + len(sub(a.pos, me)) / C });
  for (const sl of w.slugs) if (!slugPaths.has(sl.id)) slugPaths.set(sl.id, { pos: sl.pos, vel: sl.vel, t: w.t });
  for (; st.eventsSeen < w.events.length; st.eventsSeen++) {
    const e = w.events[st.eventsSeen];
    if (e.type !== "hit") continue;
    const asTorp = c.torpedoes.get(e.target);
    if (asTorp) {
      if (e.byKind === "pdc") queue({ kind: "pdcKill", t: e.t, pos: e.pos, torp: e.target, target: asTorp.targetId, cloud: e.by });
      continue;
    }
    const base = { kind: "kill" as const, t: e.t, pos: e.pos, target: e.target, byKind: e.byKind, energy: e.energy };
    if (e.byKind === "slug") queue({ ...base, slug: slugPaths.get(e.by) ?? slugFromFlash(m, e.t, e.pos) });
    else if (e.byKind === "pdc") queue({ ...base, cloud: e.by });
    else queue({ ...base, torp: c.torpedoes.has(e.by) ? e.by : undefined });
  }
  for (const [id, sp] of slugPaths) if (w.t - sp.t > 3000) slugPaths.delete(id);
  for (const [id, ts] of c.torpedoes) {
    const tgt = w.body(ts.targetId);
    if (!ts.body.alive || !tgt?.alive) continue;
    const closing = dot(sub(tgt.pos, ts.body.pos), sub(tgt.vel, ts.body.vel)) < 0;
    if (torpWatch.get(id) && !closing) {
      const cpa = closestApproach(m, id, ts.targetId);
      if (cpa && cpa.d < MISS_REPORT_M) queue({ kind: "miss", t: cpa.t, pos: cpa.pos, torp: id, target: ts.targetId, missM: cpa.d });
    }
    torpWatch.set(id, closing);
  }
  const due = st.actions.filter((x) => w.t >= x.revealAt);
  st.actions = st.actions.filter((x) => w.t < x.revealAt);
  return due.map((a) => buildClip(m, a, nameOf)).filter((x): x is ActionClip => !!x);
}

/** A slug fired and landed between two looks: rebuild its straight path from the last railgun flash to the hit. */
function slugFromFlash(m: Match, t: number, hit: Vec3): SlugPath | undefined {
  const f = [...m.combat.w.events].reverse().find((e) => e.type === "flash" && e.kind === "railgun" && e.t < t);
  if (!f || f.type !== "flash") return undefined;
  return { pos: f.pos, vel: scale(sub(hit, f.pos), 1 / (t - f.t)), t: f.t };
}

/** Closest approach between two bodies over the recorded history: coarse scan, then golden-section refine. */
function closestApproach(m: Match, a: number, b: number): { t: number; d: number; pos: Vec3 } | null {
  const h = m.combat.perception.histories, ha = h.get(a), hb = h.get(b);
  if (!ha || !hb) return null;
  const t1 = m.t, t0 = Math.max(ha.spawnT, hb.spawnT, t1 - 60);
  const d = (t: number) => len(sub(ha.at(t).pos, hb.at(t).pos));
  let best = t1, bd = Infinity;
  for (let i = 0; i <= 600; i++) { const t = t0 + ((t1 - t0) * i) / 600; const x = d(t); if (x < bd) { bd = x; best = t; } }
  let lo = Math.max(t0, best - (t1 - t0) / 600), hi = Math.min(t1, best + (t1 - t0) / 600);
  for (let i = 0; i < 60; i++) {
    const m1 = hi - (hi - lo) * 0.618, m2 = lo + (hi - lo) * 0.618;
    if (d(m1) < d(m2)) hi = m2; else lo = m1;
  }
  const t = (lo + hi) / 2, pa = ha.at(t).pos, pb = hb.at(t).pos;
  return { t, d: len(sub(pa, pb)), pos: scale(add(pa, pb), 0.5) };
}

/**
 * Cut the replay from the light histories (exact states at any sub-step time): an approach shot in the
 * target's frame with the incoming weapon's track, then the moment itself in slow motion.
 */
function buildClip(m: Match, a: PendingAction, nameOf: NameOf): ActionClip | null {
  const c = m.combat, h = c.perception.histories, tgtH = h.get(a.target);
  if (!tgtH) return null;
  const torpH = a.torp !== undefined ? h.get(a.torp) : undefined;
  const cloud = a.cloud !== undefined ? c.clouds.find((x) => x.id === a.cloud) : undefined;
  const slug = a.slug;
  const tPre = a.t - 0.02;
  const tgt0 = tgtH.at(tPre);
  const projVel = torpH ? torpH.at(tPre).vel : slug ? slug.vel : cloud ? cloud.vel : tgt0.vel;
  const relV = sub(projVel, tgt0.vel), relSpeed = Math.max(1, len(relV));
  const tgtLen = Math.max(...tgtH.size);

  const slugBody = (t: number, center: Vec3): ClipBody | null => {
    if (!slug || t < slug.t || t > a.t) return null;
    return { id: -1, kind: "slug", side: "player", slot: -1, pos: sub(addScaled(slug.pos, slug.vel, t - slug.t), center), q: qFromTo(v3(1, 0, 0), norm(slug.vel)), size: [0.4, 0.15, 0.15], g: 0, alive: true };
  };
  const bodiesAt = (near: History[], t: number, center: Vec3): ClipBody[] => {
    const out: ClipBody[] = near.filter((x) => x.spawnT <= t).map((x) => {
      const s = x.at(t);
      return { id: x.id, kind: x.kind, side: x.side, slot: m.enemies.findIndex((e) => e.body.id === x.id), pos: sub(s.pos, center), q: s.q, size: x.size, g: len(s.acc) / G0, alive: s.alive };
    });
    const sb = slugBody(t, center);
    if (sb) out.push(sb);
    return out;
  };
  const cloudsAt = (t: number, center: Vec3, r: number) => c.clouds.filter((cl) => cl.t0 <= t && len(sub(cloudCenter(cl, t), center)) < r)
    .map((cl) => ({ id: cl.id, center: sub(cloudCenter(cl, t), center), dir: cl.dir, ...cloudSigmas(cl, t), n: cl.n }));
  const all = [...h.values()];
  const sideView = (v: Vec3) => {
    const ap = norm(v), side = len(cross(ap, v3(0, 0, 1))) > 0.1 ? norm(cross(ap, v3(0, 0, 1))) : perp(ap);
    return norm(add(side, v3(0, 0, 0.45)));
  };
  const view = sideView(len(relV) > 1 ? relV : v3(1, 0, 0));

  // Approach: the last few seconds in the target's frame, starting with the weapon well out.
  const born = torpH ? torpH.spawnT : slug ? slug.t : a.t - 3;
  const approachS = Math.max(0.05, Math.min(a.t - born, Math.min(3, Math.max(2e5, 4 * tgtLen) / relSpeed)));
  const reach = Math.max(relSpeed * approachS, 6 * tgtLen, 500);
  const nearApproach = all.filter((x) => x.spawnT <= a.t && len(sub(x.at(tPre).pos, tgt0.pos)) < 1.3 * reach);
  const approach: ActionClip["shots"][number] = { label: `Approach · last ${fmtSpan(approachS)}, from ${tgtName(m, a.target, nameOf)}'s frame`, radius: reach * 0.8, view, playS: 2.5, frames: [] };
  // The camera closes in with the weapon, so both stay big enough to read.
  const weaponAt = (t: number) => torpH ? torpH.at(t).pos : slug ? addScaled(slug.pos, slug.vel, t - slug.t) : cloud ? cloudCenter(cloud, t) : null;
  for (let i = 0; i < 60; i++) {
    const t = a.t - approachS + (approachS * i) / 59 - (i === 59 ? 0.001 : 0);
    const center = tgtH.at(t).pos, wp = weaponAt(t);
    const radius = wp ? Math.max(1.3 * len(sub(wp, center)), 3 * tgtLen, 150) : reach * 0.8;
    approach.frames.push({ t, bodies: bodiesAt(nearApproach, t, center), clouds: cloudsAt(t, center, 2 * reach), radius });
  }

  // Impact: the moment itself, framed on the event point.
  const radius =
    a.kind === "kill" ? Math.max(4 * tgtLen, 200) :
    a.kind === "miss" ? Math.max(2.5 * (a.missM ?? 0), 3 * tgtLen, 120) :
    Math.max(250, Math.min(3000, cloud ? 3 * cloudSigmas(cloud, a.t).st : 250));
  const span = Math.min((2.4 * radius) / relSpeed, 20);
  const tStart = Math.max(a.t - span, born), tEnd = Math.min(a.t + 0.6 * span, m.t);
  const nearImpact = all.filter((x) => x.spawnT <= a.t && len(sub(x.at(a.t).pos, a.pos)) < 4 * radius);
  const impact: ActionClip["shots"][number] = { label: `Impact · ${fmtSpan(tEnd - tStart)} in slow motion`, radius, view, playS: 4, frames: [] };
  for (let i = 0; i < 120; i++) {
    const t = tStart + ((tEnd - tStart) * i) / 119;
    impact.frames.push({ t, bodies: bodiesAt(nearImpact, t, a.pos), clouds: cloudsAt(t, a.pos, 6 * radius) });
  }

  const victim = tgtName(m, a.target, nameOf), kms = (relSpeed / 1000).toFixed(1);
  const torpName = a.torp !== undefined ? nameOf(m, a.torp) : "torpedo";
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const boom = a.energy ? ` · ${fmtEnergy(a.energy)}` : "";
  const [title, detail] =
    a.kind === "kill" ? [
      a.byKind === "slug" ? `Railgun slug destroyed ${victim}` :
      a.byKind === "pdc" ? `${cloud ? nameOf(m, cloud.firedBy) : "PDC"} PDCs destroyed ${victim}` :
      a.torp !== undefined ? `${cap(torpName)} destroyed ${victim}` : `${cap(victim)} destroyed in a collision`,
      `Hit at ${kms} km/s${boom}`] :
    a.kind === "pdcKill" ? [`${cloud ? cap(nameOf(m, cloud.firedBy)) : "PDC"} PDCs shot down ${torpName}`, `Torpedo was crossing the stream at ${kms} km/s`] :
    [`${cap(torpName)} missed ${victim}`, `Closest pass ${fmtDistM(a.missM ?? 0)} at ${kms} km/s`];
  return { kind: a.kind, title, detail, t: a.t, destroyed: a.kind !== "miss", flash: a.kind === "miss" ? null : v3(), shots: [approach, impact] };
}

const tgtName = (m: Match, id: number, nameOf: NameOf) => (id === m.player.body.id ? "the Rocinante" : nameOf(m, id));
const fmtSpan = (s: number) => (s < 1 ? `${(s * 1000).toFixed(s < 0.01 ? 2 : 1)} ms` : `${s.toFixed(1)} s`);
// 1 t TNT = 4.184 GJ.
const fmtEnergy = (j: number) => { const t = j / 4.184e9; return t >= 1000 ? `≈${(t / 1000).toFixed(1)} kt TNT` : t >= 1 ? `≈${t.toFixed(0)} t TNT` : `≈${(t * 1000).toFixed(0)} kg TNT`; };

const fmtDistM = (d: number) => d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toFixed(0)} m`;


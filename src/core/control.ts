import { inertia, keel } from "./body";
import { torqueToward } from "./attitude";
import { DT, G0 } from "./constants";
import { Ship, canAct } from "./ship";
import { Vec3, angleBetween, cross, dot, len, norm, rotate, scale, sub, v3, add, perp } from "./vec";
import { Aim, Combat, fireBurst, launchTorpedo, solveIntercept } from "./weapons";
import { PDC } from "./constants";
import { System, World } from "./world";
import { ObservedState } from "./perception";

export type Order =
  | { type: "setG"; g: number }
  | { type: "heading"; dir: Vec3 | null }
  | { type: "railgun"; aim: Aim }
  | { type: "torpedo"; target: number; count?: number }
  | { type: "pdc"; aim: Aim }
  | { type: "evade" };

export interface LoggedOrder { step: number; side: Ship["body"]["side"]; order: Order }

/** Carry out one order now. Returns null on success or the reason it can't be done. */
export function applyOrder(c: Combat, s: Ship, o: Order): string | null {
  if (!canAct(s)) return "Ship can't act";
  switch (o.type) {
    case "setG":
      s.gAllowance = Math.max(0, Math.min(o.g, s.cls.maxG));
      return null;
    case "heading":
      s.heading = o.dir ? norm(o.dir) : null;
      s.evade = null;
      return null;
    case "evade":
      s.evade = { nextAt: c.w.t };
      return null;
    case "railgun":
      if (s.cls.railguns === 0) return "No railgun";
      s.railOrder = { aim: o.aim };
      return null;
    case "torpedo": {
      let err: string | null = null;
      for (let i = 0; i < (o.count ?? 1) && !err; i++) err = launchTorpedo(c, s, o.target);
      return err;
    }
    case "pdc": {
      let dir: Vec3;
      if ("point" in o.aim) {
        const P = o.aim.point;
        dir = solveIntercept(s.body.pos, s.body.vel, PDC.muzzleKms * 1000, () => P).dir;
      } else {
        const ob = c.observers.get(s.body.id)!, obs = ob.contact(c.w, o.aim.contact);
        if (!obs) return "PDC: target not visible";
        const T = solveIntercept(s.body.pos, s.body.vel, PDC.muzzleKms * 1000, (t) => ob.cloud(obs, c.w.t + t, 300).mean).T;
        const P = ob.aimPoint(obs, c.w.t + T);
        dir = solveIntercept(s.body.pos, s.body.vel, PDC.muzzleKms * 1000, () => P).dir;
      }
      let fired = 0, last: string | null = null;
      for (let m = 0; m < s.cls.pdcMounts; m++) {
        last = fireBurst(c, s, m, dir);
        if (!last) fired++;
      }
      return fired > 0 ? null : last;
    }
  }
}


/** Applies orders logged for the current step, so a match replays exactly from its order log. */
export const orderSystem = (c: Combat, log: LoggedOrder[]) => {
  let next = -1;
  return {
    pre(w: World) {
      // Found from the step rather than kept from the start, so a restored match picks up where it was.
      if (next < 0) { next = log.findIndex((o) => o.step >= w.stepIndex); if (next < 0) next = log.length; }
      while (next < log.length && log[next].step <= w.stepIndex) {
        const { side, order } = log[next++];
        const s = c.ships.find((x) => x.body.side === side);
        if (s) s.notice = applyOrder(c, s, order);
      }
    },
  };
};

/** Rotate to the ordered heading, then burn at the g allowance. Railgun aiming takes priority over the heading. */
export const autopilotSystem = (c: Combat) => ({
  pre() {
    for (const s of c.ships) {
      const b = s.body;
      if (!canAct(s)) { b.cmdAccel = 0; b.cmdTorque = v3(); continue; }
      if (s.railOrder) continue;
      if (s.evade && c.w.t >= s.evade.nextAt) jink(c, s);
      if (!s.heading) {
        b.cmdAccel = 0;
        const I = inertia(b); // null any rotation, clamped to the thruster limit
        b.cmdTorque = v3((-I.x * b.omega.x) / DT, (-I.y * b.omega.y) / DT, (-I.z * b.omega.z) / DT);
        continue;
      }
      b.cmdTorque = torqueToward(b, s.heading, DT);
      const err = angleBetween(keel(b), s.heading);
      b.cmdAccel = err < 0.05 ? Math.min(s.gAllowance, s.cls.maxG) * G0 : 0;
    }
  },
});

/**
 * Burn somewhere random across the line to the nearest seen enemy, so a slug or PDC stream aimed
 * at the observed track misses. Each new jink is 30–90° from the last: a full flip spends too long with the drive off.
 */
function jink(c: Combat, s: Ship): void {
  const w = c.w, b = s.body;
  const foes = c.observers.get(b.id)!.contacts(w).filter((x) => x.kind === "ship" && x.side !== b.side);
  foes.sort((x, y) => len(sub(x.pos, b.pos)) - len(sub(y.pos, b.pos)));
  const los = foes.length ? norm(sub(foes[0].pos, b.pos)) : keel(b);
  const e1 = perp(los), e2 = cross(los, e1);
  let dir = e1;
  for (let i = 0; i < 12; i++) {
    const a = w.rng.range(0, 2 * Math.PI);
    dir = norm(add(add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))), scale(los, w.rng.range(-0.3, 0.3))));
    const turn = s.heading ? angleBetween(dir, s.heading) : 1;
    if (turn > 0.5 && turn < 1.6) break;
  }
  s.heading = dir;
  s.evade!.nextAt = w.t + w.rng.range(5, 12);
}

// ---------- Enemy AI ----------

export interface AiParams {
  keepRangeM: number; // back off inside this range
  launchRangeM: number; // launch salvos inside this range
  salvo: number;
  salvoIntervalS: number;
  cruiseG: number;
  jinkG: number;
}

export const DEFAULT_AI: AiParams = {
  keepRangeM: 5e7, launchRangeM: 4e8, salvo: 4, salvoIntervalS: 120, cruiseG: 3, jinkG: 6,
};

/**
 * Torpedo-heavy doctrine: keep distance, launch salvos sized to swamp point defense, and jink off railgun lines.
 * Each ship on `side` decides from its own light-delayed observations only.
 */
export const aiSystem = (c: Combat, side: Ship["body"]["side"], p: AiParams = DEFAULT_AI): System => {
  const brains = c.ships.filter((s) => s.body.side === side).map((me) => shipAi(c, me, side, p));
  return { pre: (w) => { for (const b of brains) b(w); } };
};

/** Per-ship AI memory, kept on the ship so it saves and restores with it. */
export interface AiState { lastSalvo: number; jinkUntil: number; jinkDir: Vec3 | null; mode: "close" | "open" | "hold"; modeSince: number }

function shipAi(c: Combat, me: Ship, side: Ship["body"]["side"], p: AiParams) {
  // Hold each approach decision a while so the ship doesn't flicker its drive (every change is a visible flash).
  me.ai ??= { lastSalvo: -Infinity, jinkUntil: -Infinity, jinkDir: null, mode: "hold", modeSince: -Infinity };
  return (w: World) => {
    const ai = me.ai!;
    if (w.stepIndex % 30 !== 0) return; // decide twice a second of game time
    if (!canAct(me)) return;
    const o = c.observers.get(me.body.id)!;
    const seen = o.contacts(w);
    const flashes = c.perception.drain(me.body.id);
    const enemy = seen.find((x) => x.kind === "ship" && x.side !== side);
    if (!enemy) return;
    const b = me.body;
    const now = o.cloud(enemy, w.t, 300).mean;
    const los = sub(now, b.pos), range = len(los), u = norm(los);

    // A railgun flash, or a close enemy pointing its keel at us, means get off the line.
    const threatened = flashes.some((f) => f.kind === "railgun") || (range < 4 * p.keepRangeM && pointingAt(enemy, b.pos));
    if (threatened && w.t > ai.jinkUntil) {
      const side1 = perp(u);
      ai.jinkDir = norm(add(side1, scale(cross(u, side1), w.rng.range(-1, 1))));
      ai.jinkUntil = w.t + w.rng.range(4, 10);
    }
    // Stay off the dose curve: only jink above cruise while the crew has margin.
    const doseOk = me.crew.dose < 30;
    // Our own torpedoes are remote too: count only the ones whose light still shows them flying.
    const ownTorps = seen.filter((x) => x.kind === "torpedo" && x.side === side).length;
    const wing = 1 + seen.filter((x) => x.kind === "ship" && x.side === side).length;
    const spent = me.magazine === 0 && ownTorps === 0;
    if (spent) {
      // Out of torpedoes: close to PDC range and shoot it out.
      me.heading = u;
      me.gAllowance = p.cruiseG;
      const closingV = Math.max(0, dot(sub(enemy.vel, b.vel), scale(u, -1)));
      // Brake in time: stopping distance at cruise g plus the distance covered during the flip.
      if (range < (closingV * closingV) / (2 * p.cruiseG * 9.80665) + closingV * me.cls.flipS + 2e4) me.heading = scale(u, -1);
      if (range < 2e4) applyOrder(c, me, { type: "pdc", aim: { contact: enemy.id } });
    } else if (w.t < ai.jinkUntil && ai.jinkDir) {
      me.heading = ai.jinkDir;
      me.gAllowance = doseOk ? p.jinkG : p.cruiseG;
    } else if (range < p.keepRangeM) {
      me.heading = norm(sub(scale(u, -1), scale(perp(u), 0.3)));
      me.gAllowance = p.cruiseG;
    } else {
      // Close to launch range without overshooting: brake when the closing speed would carry us inside keep range.
      const closing = dot(sub(enemy.vel, b.vel), scale(u, -1));
      const stopDist = (closing * Math.abs(closing)) / (2 * p.cruiseG * 9.80665);
      const want = range - stopDist > 0.8 * p.launchRangeM ? "close" : range - stopDist < p.keepRangeM * 2 ? "open" : "hold";
      if (want !== ai.mode && w.t - ai.modeSince > 30) { ai.mode = want; ai.modeSince = w.t; }
      me.heading = ai.mode === "close" ? u : ai.mode === "open" ? scale(u, -1) : null;
      me.gAllowance = p.cruiseG;
    }

    if (range < p.launchRangeM && w.t - ai.lastSalvo > p.salvoIntervalS && ownTorps < p.salvo * wing) {
      const n = Math.min(p.salvo, me.magazine, me.tubesReadyAt.filter((t) => t <= w.t).length);
      if (n >= 2) {
        applyOrder(c, me, { type: "torpedo", target: enemy.id, count: n });
        ai.lastSalvo = w.t;
      }
    }
  };
}

const pointingAt = (s: ObservedState, at: Vec3) => dot(rotate(s.q, v3(1, 0, 0)), norm(sub(at, s.pos))) > 0.999;

// ---------- Time warp ----------

/** `dropFlash` is the flash that caused the last drop, so the UI can say who did what. */
export interface WarpState { level: number; paused: boolean; dropReason: string | null; dropFlash?: { kind: string; side: string } | null; lastBurnDropAt?: number }

export const WARP_LEVELS = [1, 2, 5, 10, 20, 50, 100, 200, 400, 800];
const TTI_DROP_S = 20;

/** Drops warp to ×1 when new light reaches the player or a hostile torpedo is about to arrive. */
export function warpCheck(c: Combat, playerSide: Ship["body"]["side"], warp: WarpState, newFlashes: { kind: string; side: string }[]): void {
  const me = c.ships.find((s) => s.body.side === playerSide);
  if (!me) return;
  // Launches and shots always drop warp; routine burn changes at most every 20 s so a maneuvering enemy doesn't pin you at ×1.
  const t = c.w.t;
  const hostile = newFlashes.find((f) => f.side !== playerSide && (f.kind !== "burnChange" || t - (warp.lastBurnDropAt ?? -Infinity) > 20));
  if (hostile && warp.level > 1) {
    if (hostile.kind === "burnChange") warp.lastBurnDropAt = t;
    warp.level = 1;
    warp.dropFlash = hostile;
    warp.dropReason = hostile.kind === "launch" ? "Launch seen" : hostile.kind === "burnChange" ? "Burn change seen" : hostile.kind === "impact" ? "Impact seen" : "Weapon fire seen";
    return;
  }
  if (warp.level === 1) return;
  const o = c.observers.get(me.body.id)!;
  for (const t of o.contacts(c.w)) {
    if (t.kind !== "torpedo" || t.side === playerSide) continue;
    const rel = sub(t.pos, me.body.pos), relV = sub(t.vel, me.body.vel);
    const closing = -dot(relV, norm(rel));
    if (closing > 0 && len(rel) / closing < TTI_DROP_S) {
      warp.level = 1;
      warp.dropFlash = null;
      warp.dropReason = "Torpedo inbound";
      return;
    }
  }
}

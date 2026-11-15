import { createCombat } from "./combat";
import { C } from "./constants";
import { DEFAULT_AI, LoggedOrder, Order, WARP_LEVELS, WarpState, aiSystem, autopilotSystem, orderSystem, warpCheck } from "./control";
import { DeliveredFlash } from "./perception";
import { Ship } from "./ship";
import { Vec3, dot, len, sub, v3, qFromTo, norm, scale } from "./vec";
import { Combat } from "./weapons";
import { MatchResult, Scheduler } from "./world";

export interface MatchConfig {
  rangeM: number; // starting separation, 1–3 million km
  rociVel: Vec3;
  enemyVel: Vec3;
  /** Height of the frigate pair above the Roci's plane, m. */
  offsetZ: number;
  /** Distance between the two frigates, m. */
  wingSepM: number;
}

export const DEFAULT_MATCH: MatchConfig = { rangeM: 1e9, rociVel: v3(0, 0, 0), enemyVel: v3(0, 0, 0), offsetZ: 5e7, wingSepM: 6e8 };

export class Match {
  combat: Combat;
  log: LoggedOrder[] = [];
  warp: WarpState = { level: 1, paused: false, dropReason: null };
  result: MatchResult | null = null;
  endedAt: number | null = null;
  /** Decided but not yet visible: the player learns the outcome when its light arrives. */
  private pending: { result: MatchResult; revealAt: number } | null = null;
  playerFlashes: DeliveredFlash[] = [];
  // Runs in a worker, so it can take most of each 33 ms tick; ×800 needs ~48k steps a second.
  scheduler = new Scheduler(1, 24);

  constructor(public seed: number, public config: MatchConfig = DEFAULT_MATCH, log: LoggedOrder[] = []) {
    this.log = log;
    const toEnemy = v3(config.rangeM, 0, config.offsetZ);
    const face = qFromTo(v3(1, 0, 0), norm(toEnemy));
    const frigate = (dy: number) => {
      const pos = v3(toEnemy.x, dy, toEnemy.z);
      return { cls: "frigate" as const, side: "enemy" as const, pos, vel: config.enemyVel, q: qFromTo(v3(1, 0, 0), norm(scale(pos, -1))) };
    };
    this.combat = createCombat(seed, [
      { cls: "rocinante", side: "player", pos: v3(0, 0, 0), vel: config.rociVel, q: face },
      frigate(config.wingSepM / 2),
      frigate(-config.wingSepM / 2),
    ], [
      (c) => orderSystem(c, this.log),
      autopilotSystem,
      (c) => aiSystem(c, "enemy", DEFAULT_AI),
    ], Math.max(60, (3 * config.rangeM) / C));
    this.combat.w.systems.push({ post: () => this.checkEnd() });
  }

  get player(): Ship { return this.combat.ships.find((s) => s.body.side === "player")!; }
  get enemies(): Ship[] { return this.combat.ships.filter((s) => s.body.side === "enemy"); }
  get t(): number { return this.combat.w.t; }

  /** Queue a player order; it applies at the start of the next step, so it works while paused and replays exactly. */
  order(o: Order): void {
    this.log.push({ step: this.combat.w.stepIndex, side: "player", order: o });
  }

  setWarp(level: number): void {
    this.warp.level = WARP_LEVELS.includes(level) ? level : 1;
    this.warp.dropReason = null;
    this.warp.dropFlash = null;
  }

  /** One fixed step plus the player-facing bookkeeping (flashes, warp drops). */
  step(): void {
    if (this.result) return;
    this.combat.w.step();
    const fresh = this.combat.perception.drain(this.player.body.id);
    if (fresh.length) this.playerFlashes.push(...fresh);
    if (fresh.length || this.combat.w.stepIndex % 6 === 0) warpCheck(this.combat, "player", this.warp, fresh);
  }

  /** Advance by real elapsed time at the current warp; stops early when warp drops. */
  tick(realDt: number): number {
    if (this.warp.paused || this.result) { this.scheduler.achievedWarp = this.warp.level; return 0; }
    this.scheduler.warp = this.warp.level;
    const before = this.warp.level;
    return this.scheduler.advance(realDt, () => this.step(), () => this.warp.level !== before || this.result !== null);
  }

  private checkEnd(): void {
    if (this.result) return;
    if (this.pending) {
      if (this.t >= this.pending.revealAt) this.finish(this.pending.result);
      return;
    }
    const p = this.player, es = this.enemies;
    const down = (s: Ship) => !s.body.alive || !s.crew.alive;
    const pDown = down(p), eDown = es.every(down);
    let r: MatchResult | null = null;
    if (pDown && eDown) r = "mutualKill";
    else if (pDown) r = "enemyWin";
    else if (eDown) r = "playerWin";
    else if (es.filter((e) => !down(e)).every((e) => disengaged(this.combat, p, e))) r = "draw";
    if (!r) return;
    // Our own loss is known at once; anything that happened over there is known when its light gets here.
    const revealAt = pDown || r === "draw" ? this.t : this.t + Math.max(...es.map((e) => len(sub(e.body.pos, p.body.pos)))) / C;
    this.pending = { result: r, revealAt };
    if (this.t >= revealAt) this.finish(r);
  }

  private finish(r: MatchResult): void {
    this.result = r;
    this.endedAt = this.t;
    this.combat.w.emit({ t: this.t, type: "end", result: r });
  }

  /** Re-run the match from its seed and order log up to a step, for the truth replay. */
  static replay(m: Match, toStep = m.combat.w.stepIndex): Match {
    const r = new Match(m.seed, m.config, m.log.slice());
    while (r.combat.w.stepIndex < toStep && !r.result) r.step();
    return r;
  }
}

/** Neither side can still engage: no weapons left, or far apart, separating, and out of torpedoes in flight. */
function disengaged(c: Combat, p: Ship, e: Ship): boolean {
  const armed = (s: Ship) => s.cls.railguns > 0 || s.magazine > 0 || s.pdcAmmo.some((a) => a > 0);
  if (!armed(p) && !armed(e)) return true;
  const torpsOut = [...c.torpedoes.values()].some((t) => t.body.alive);
  const rel = sub(e.body.pos, p.body.pos);
  return !torpsOut && len(rel) > 3e9 && dot(sub(e.body.vel, p.body.vel), rel) > 0;
}

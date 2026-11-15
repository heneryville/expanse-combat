import { Body, Side } from "./body";
import { C, DT, G0 } from "./constants";
import { Quat, Vec3, addScaled, dist, len, scale, sub, v3, add } from "./vec";
import { FlashKind, World } from "./world";

const STRIDE = 15; // t, pos(3), vel(3), acc(3), q(4), alive

/** Ring buffer of one body's per-step states, so any observer can look up where it was when its light left. */
export class History {
  private buf: Float64Array;
  private start = 0;
  count = 0;
  lastAlive = true;
  /** Time of the first sample; bodies created after t=0 can't be seen before their light exists. */
  spawnT = NaN;
  constructor(public readonly id: number, public readonly kind: Body["kind"], public readonly side: Side, public readonly size: [number, number, number], private cap: number) {
    this.buf = new Float64Array(cap * STRIDE);
  }
  push(t: number, b: Body): void {
    // The previous sample's acceleration is the one achieved over the step that just ended.
    if (this.count > 0) {
      const p = this.offset(this.count - 1);
      this.buf[p + 7] = b.accel.x; this.buf[p + 8] = b.accel.y; this.buf[p + 9] = b.accel.z;
    }
    if (this.count === 0) this.spawnT = t;
    if (this.count === this.cap) { this.start = (this.start + 1) % this.cap; this.count--; }
    const o = this.offset(this.count);
    const B = this.buf;
    B[o] = t; B[o + 1] = b.pos.x; B[o + 2] = b.pos.y; B[o + 3] = b.pos.z;
    B[o + 4] = b.vel.x; B[o + 5] = b.vel.y; B[o + 6] = b.vel.z;
    B[o + 7] = b.accel.x; B[o + 8] = b.accel.y; B[o + 9] = b.accel.z;
    B[o + 10] = b.q.w; B[o + 11] = b.q.x; B[o + 12] = b.q.y; B[o + 13] = b.q.z;
    B[o + 14] = b.alive ? 1 : 0;
    this.lastAlive = b.alive;
    this.count++;
  }
  private offset(i: number): number { return ((this.start + i) % this.cap) * STRIDE; }
  /** Enlarge the buffer, keeping samples in order. */
  grow(cap: number): void {
    if (cap <= this.cap) return;
    const nb = new Float64Array(cap * STRIDE);
    for (let i = 0; i < this.count; i++) nb.set(this.buf.subarray(this.offset(i), this.offset(i) + STRIDE), i * STRIDE);
    this.buf = nb;
    this.start = 0;
    this.cap = cap;
  }
  get capacity(): number { return this.cap; }
  time(i: number): number { return this.buf[this.offset(i)]; }
  /** State at time t, exact under constant acceleration within each step; clamps to the stored span. */
  at(t: number): ObservedState {
    let lo = 0, hi = this.count - 1;
    if (t <= this.time(0)) hi = 0;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (this.time(mid) <= t) lo = mid; else hi = mid;
      }
      if (this.time(hi) <= t) lo = hi;
    }
    const o = this.offset(lo), B = this.buf;
    // Before the first sample: bodies present at the start were coasting into the arena; later ones didn't exist yet.
    const tau = t - B[o];
    if (tau < 0 && this.spawnT > 0) return { id: this.id, kind: this.kind, side: this.side, size: this.size, t, pos: v3(B[o + 1], B[o + 2], B[o + 3]), vel: v3(), acc: v3(), q: { w: 1, x: 0, y: 0, z: 0 }, alive: false };
    if (tau < 0) {
      const p0 = v3(B[o + 1], B[o + 2], B[o + 3]), v0 = v3(B[o + 4], B[o + 5], B[o + 6]);
      return { id: this.id, kind: this.kind, side: this.side, size: this.size, t, pos: addScaled(p0, v0, tau), vel: v0, acc: v3(),
        q: { w: B[o + 10], x: B[o + 11], y: B[o + 12], z: B[o + 13] } as Quat, alive: true };
    }
    const pos = v3(B[o + 1], B[o + 2], B[o + 3]), vel = v3(B[o + 4], B[o + 5], B[o + 6]), acc = v3(B[o + 7], B[o + 8], B[o + 9]);
    return {
      id: this.id, kind: this.kind, side: this.side, size: this.size, t,
      pos: add(addScaled(pos, vel, tau), scale(acc, 0.5 * tau * tau)), vel: addScaled(vel, acc, tau), acc,
      q: { w: B[o + 10], x: B[o + 11], y: B[o + 12], z: B[o + 13] } as Quat, alive: B[o + 14] === 1,
    };
  }
  get earliest(): number { return this.time(0); }
}

export interface ObservedState {
  id: number; kind: Body["kind"]; side: Side; size: [number, number, number];
  t: number; // time the observed light left the object
  pos: Vec3; vel: Vec3; acc: Vec3; q: Quat; alive: boolean;
}

/** Solve for the emission time t_r with |x_obs - x_src(t_r)| = c (tNow - t_r). Fixed-point: contracts by v/c each pass. */
export function retardedTime(h: History, obsPos: Vec3, tNow: number): number {
  let tr = tNow - dist(obsPos, h.at(tNow).pos) / C;
  for (let i = 0; i < 20; i++) {
    const next = tNow - dist(obsPos, h.at(tr).pos) / C;
    if (Math.abs(next - tr) < 1e-13) return next;
    tr = next;
  }
  return tr;
}

export interface Flash { t: number; pos: Vec3; kind: FlashKind; source: number; side: Side }
export interface DeliveredFlash extends Flash { seenAt: number }

/** Records history for every body, emits light-speed flashes, and delivers them to observers when the light arrives. */
export class Perception {
  histories = new Map<number, History>();
  flashes: Flash[] = [];
  inbox = new Map<number, DeliveredFlash[]>(); // observer id -> flashes received
  private delivered = new Map<number, Set<Flash>>();
  private lastThrust = new Map<number, number>();
  observers = new Set<number>(); // bodies whose flash inbox is tracked

  constructor(public horizonS = 60) {}

  history(id: number): History | undefined { return this.histories.get(id); }

  record(w: World): void {
    // Keep enough history for the light lag across the widest separation between ships, so nobody ever reads ahead.
    const ships = w.bodies.filter((b) => b.kind === "ship");
    let span = 0;
    for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) span = Math.max(span, dist(ships[i].pos, ships[j].pos));
    this.horizonS = Math.max(this.horizonS, (2 * span) / C + 10);
    const cap = Math.ceil(this.horizonS / DT) + 2;
    for (const b of w.bodies) {
      let h = this.histories.get(b.id);
      if (!h) {
        h = new History(b.id, b.kind, b.side, b.size, cap);
        this.histories.set(b.id, h);
      } else if (h.lastAlive === false) {
        continue; // one dead sample is enough; lookups past it stay dead
      } else if (h.capacity < cap) h.grow(cap);
      h.push(w.t, b);
      // Drive light-up, cut-off and burn changes are visible events.
      const thrust = b.alive ? len(b.accel) / G0 : 0;
      const prev = this.lastThrust.get(b.id) ?? 0;
      // Ships flash on any burn change; a torpedo's throttle hunts constantly, so only its ignition and cut-off count.
      const onOff = (prev < 0.05) !== (thrust < 0.05);
      if (onOff || (b.kind === "ship" && Math.abs(thrust - prev) > 0.5)) {
        this.lastThrust.set(b.id, thrust);
        this.flash(w, { t: w.t, pos: b.pos, kind: "burnChange", source: b.id, side: b.side });
      }
    }
  }

  flash(w: World, f: Flash): void {
    this.flashes.push(f);
    w.emit({ t: f.t, type: "flash", source: f.source, kind: f.kind, pos: f.pos });
  }

  deliver(w: World): void {
    for (const id of this.observers) {
      const b = w.body(id);
      if (!b) continue;
      let got = this.delivered.get(id);
      if (!got) this.delivered.set(id, (got = new Set()));
      const inbox = this.inbox.get(id) ?? [];
      for (const f of this.flashes) {
        if (got.has(f) || f.source === id) continue;
        const r = dist(b.pos, f.pos);
        if (C * (w.t - f.t) >= r) {
          got.add(f);
          inbox.push({ ...f, seenAt: f.t + r / C });
        }
      }
      this.inbox.set(id, inbox);
    }
    // Forget flashes every observer has already seen.
    const live = [...this.observers].filter((id) => w.body(id)?.alive);
    this.flashes = this.flashes.filter((f) => live.some((id) => id !== f.source && !this.delivered.get(id)?.has(f)));
    const kept = new Set(this.flashes);
    for (const set of this.delivered.values()) for (const f of set) if (!kept.has(f)) set.delete(f);
  }

  /** What an observer at obsPos sees of every other body right now: light-delayed states only. */
  view(obsId: number, obsPos: Vec3, tNow: number): ObservedState[] {
    const out: ObservedState[] = [];
    for (const h of this.histories.values()) {
      if (h.id === obsId || h.count === 0) continue;
      const tr = retardedTime(h, obsPos, tNow);
      const s = h.at(tr);
      if (s.alive) out.push(s);
    }
    return out;
  }

  /** Take flashes an observer has received since last call. */
  drain(obsId: number): DeliveredFlash[] {
    const box = this.inbox.get(obsId) ?? [];
    this.inbox.set(obsId, []);
    return box;
  }
}

export const perceptionSystem = (p: Perception) => ({
  post(w: World) {
    p.record(w);
    p.deliver(w);
  },
});

export const lightDelay = (a: Vec3, b: Vec3) => len(sub(a, b)) / C;

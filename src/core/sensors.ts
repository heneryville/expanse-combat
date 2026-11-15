import { Body } from "./body";
import { ShipClass } from "./constants";
import { ObservedState, Perception } from "./perception";
import { Cloud, Tracker, densest, plansFor, predict } from "./prediction";
import { Vec3 } from "./vec";
import { World } from "./world";

export type ClassKey = ShipClass["id"] | "torpedo";

/** One observer's light-delayed picture of the world; the only source of information controllers may use. */
export class Observer {
  tracker = new Tracker();
  constructor(public readonly self: Body, private perception: Perception, private classOf: (id: number) => ClassKey) {}

  /** Contacts as their light now reaching this observer shows them. Read-only: safe to call from the UI. */
  contacts(w: World): ObservedState[] {
    return this.perception.view(this.self.id, this.self.pos, w.t);
  }

  /** Fold the current view into the tracker; called on a fixed game-time cadence so results don't depend on UI polling. */
  observe(w: World): ObservedState[] {
    const seen = this.contacts(w);
    for (const s of seen) this.tracker.update(s);
    return seen;
  }

  contact(w: World, id: number): ObservedState | undefined {
    return this.contacts(w).find((c) => c.id === id);
  }

  /** Where a contact could be at tQuery, from what this observer has seen. */
  cloud(obs: ObservedState, tQuery: number, samples = 1500): Cloud {
    const { plans, perf } = plansFor(this.classOf(obs.id), samples);
    return predict(obs, tQuery, plans, perf, this.tracker.get(obs.id));
  }

  /** Most likely position at tQuery: the densest part of the cloud, resolved to about the contact's own size. */
  aimPoint(obs: ObservedState, tQuery: number, samples = 300): Vec3 {
    const c = this.cloud(obs, tQuery, samples);
    return densest(c, Math.max(Math.max(...obs.size), c.spread / 30));
  }
}

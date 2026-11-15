import { Side } from "./body";
import { ShipClass } from "./constants";
import { Perception, perceptionSystem } from "./perception";
import { Observer, ClassKey } from "./sensors";
import { Ship, createShip, crewSystem } from "./ship";
import { Quat, Vec3, QI, v3 } from "./vec";
import { Combat, cloudSystem, pointDefenseSystem, railgunSystem, torpedoSystem } from "./weapons";
import { System, World } from "./world";

export interface ShipSpec { cls: ShipClass["id"]; side: Side; pos: Vec3; vel?: Vec3; q?: Quat }

/** A world with ships, perception and weapons wired in system order. `controllers` run first each step. */
export function createCombat(seed: number, specs: ShipSpec[], controllers: ((c: Combat) => System)[] = [], horizonS = 60): Combat {
  const w = new World(seed);
  const perception = new Perception(horizonS);
  const ships: Ship[] = specs.map((s) => createShip(w, s.cls, s.side, s.pos, s.vel ?? v3(), s.q ?? QI));
  const c: Combat = {
    w, perception, ships, observers: new Map(), torpedoes: new Map(), clouds: [],
    classOf: (id: number): ClassKey => ships.find((s) => s.body.id === id)?.cls.id ?? "torpedo",
  };
  for (const s of ships) {
    c.observers.set(s.body.id, new Observer(s.body, perception, c.classOf));
    perception.observers.add(s.body.id);
  }
  perception.record(w);
  // A kill is visible as a flash at the impact point, seen by each observer when its light arrives.
  w.onKill.push((b, e) => { if (e.type === "hit") perception.flash(w, { t: e.t, pos: e.pos, kind: "impact", source: b.id, side: b.side }); });
  const clouds = cloudSystem(c);
  // Ship observers fold what they see into their trackers ten times a second of game time.
  const tracking: System = { pre: (w) => { if (w.stepIndex % 6 === 0) for (const s of ships) if (s.body.alive) c.observers.get(s.body.id)!.observe(w); } };
  w.systems.push(
    tracking,
    ...controllers.map((f) => f(c)),
    railgunSystem(c), torpedoSystem(c), pointDefenseSystem(c), clouds,
    crewSystem(ships), perceptionSystem(perception),
  );
  return c;
}

export const shipOf = (c: Combat, side: Side) => c.ships.find((s) => s.body.side === side)!;

import { Body, Side, makeBody, torqueForFlip } from "./body";
import { G0, PDC, SHIPS, ShipClass } from "./constants";
import { Crew, accumulate, feltG, makeCrew } from "./crew";
import { Quat, Vec3, QI, v3 } from "./vec";
import { World } from "./world";
import type { RailOrder } from "./weapons";
import type { AiState } from "./control";

export interface Ship {
  body: Body;
  cls: ShipClass;
  crew: Crew;
  gAllowance: number; // g
  /** Desired thrust direction (world), or null to hold and coast. */
  heading: Vec3 | null;
  railgunReadyAt: number;
  tubesReadyAt: number[];
  magazine: number;
  pdcAmmo: number[];
  pdcBusyUntil: number[];
  railOrder: RailOrder | null;
  /** Last reason an order was refused, for the HUD. */
  notice: string | null;
  /** Standing evade order: re-jink at nextAt. Cleared by any heading order. */
  evade: { nextAt: number } | null;
  ai?: AiState;
}

export function createShip(w: World, clsId: ShipClass["id"], side: Side, pos: Vec3, vel: Vec3 = v3(), q: Quat = QI): Ship {
  const cls = SHIPS[clsId];
  const wet = cls.massT * 1000;
  const dry = wet / Math.exp(cls.dvKms / cls.exhaustKms);
  const body = w.addBody(makeBody({
    id: w.nextId(), kind: "ship", side, pos, vel, q, dryMass: dry, fuel: wet - dry, size: cls.size,
    exhaustV: cls.exhaustKms * 1000, maxAccel: cls.maxG * G0, maxTorque: torqueForFlip(wet, cls.size, cls.flipS),
  }));
  return {
    body, cls, crew: makeCrew(w.rng, cls.crewOffset), gAllowance: Math.min(3, cls.maxG), heading: null,
    railgunReadyAt: 0, tubesReadyAt: Array(cls.torpedoTubes).fill(0), magazine: cls.torpedoMagazine,
    pdcAmmo: Array(cls.pdcMounts).fill(PDC.ammoPerMount), pdcBusyUntil: Array(cls.pdcMounts).fill(0),
    railOrder: null, notice: null, evade: null,
  };
}

/** Accumulates crew g-dose after each step; a dead crew cuts the drive and stops steering. */
export const crewSystem = (ships: Ship[]) => ({
  post(w: World) {
    for (const s of ships) {
      if (!s.body.alive || !s.crew.alive) continue;
      if (accumulate(s.crew, feltG(s.body, s.crew.offset))) {
        s.body.cmdAccel = 0;
        s.body.cmdTorque = v3();
        s.heading = null;
        w.emit({ t: w.t, type: "crewDeath", ship: s.body.id });
      }
    }
  },
});

export const canAct = (s: Ship) => s.body.alive && s.crew.alive;

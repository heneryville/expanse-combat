import { Body } from "./body";
import { DT, G0 } from "./constants";
import { Rng } from "./rng";
import { Vec3, add, cross, len, unrotate, v3 } from "./vec";

// Juiced tolerance: no strain at or below 4 g; strain builds 1/s at 10 g, steeper above (exponent 2.5).
const G_FREE = 4, G_REF = 10, EXPONENT = 2.5;
// Strain heals with this time constant, so a steady burn levels off at doseRate·RECOVERY_S.
export const RECOVERY_S = 180;
// Death hazard per second ∝ strain⁴: 55% dead after 5 min at 10 g, ~0.1%/h held at 6 g, ~6%/h at 7 g.
const HAZARD_A = 1.757e-11;

export const doseRate = (g: number) => (g <= G_FREE ? 0 : Math.pow((g - G_FREE) / (G_REF - G_FREE), EXPONENT));
/** Strain after holding g for t seconds from s0. */
export const strainAfter = (s0: number, g: number, t: number) => {
  const eq = doseRate(g) * RECOVERY_S;
  return eq + (s0 - eq) * Math.exp(-t / RECOVERY_S);
};
export const hazardPerS = (strain: number) => HAZARD_A * strain ** 4;
export const riskPerHour = (strain: number) => 1 - Math.exp(-hazardPerS(strain) * 3600);
/** Integrated hazard from holding g for t seconds from strain s0 (exact for the exponential strain curve). */
export function hazardOver(s0: number, g: number, t: number): number {
  const eq = doseRate(g) * RECOVERY_S, d = s0 - eq, u = Math.exp(-t / RECOVERY_S);
  let sum = eq ** 4 * t;
  for (let j = 1, c = 4; j <= 4; c = (c * (4 - j)) / (j + 1), j++) sum += c * eq ** (4 - j) * d ** j * RECOVERY_S * (1 - u ** j) / j;
  return HAZARD_A * sum;
}

export interface Crew {
  alive: boolean;
  dose: number; // strain: builds above 4 g, heals over RECOVERY_S
  hazard: number; // integrated death hazard so far
  threshold: number; // death happens when 1 - exp(-hazard) reaches this draw
  offset: number; // crew position forward of the center of mass along the keel, m
  lastG: number;
}

export const makeCrew = (rng: Rng, offset: number): Crew => ({ alive: true, dose: 0, hazard: 0, threshold: rng.next(), offset, lastG: 0 });

/** Acceleration felt at the crew position in g: drive thrust plus rotational acceleration at the offset. */
export function feltG(b: Body, offset: number): number {
  const r = v3(offset, 0, 0);
  const linBody: Vec3 = unrotate(b.q, b.accel);
  const rot = add(cross(b.alpha, r), cross(b.omega, cross(b.omega, r)));
  return len(add(linBody, rot)) / G0;
}

/** Advance one step of strain; returns true if the crew died this step. */
export function accumulate(crew: Crew, g: number, dt = DT): boolean {
  if (!crew.alive) return false;
  crew.lastG = g;
  crew.hazard += hazardOver(crew.dose, g, dt);
  crew.dose = strainAfter(crew.dose, g, dt);
  if (1 - Math.exp(-crew.hazard) >= crew.threshold) {
    crew.alive = false;
    return true;
  }
  return false;
}

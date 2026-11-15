// Physical constants and book-derived ship/weapon stats (projects/expanse-physics/EXPANSE_COMBAT_REFERENCE.md).

export const C = 299_792_458; // m/s
export const G0 = 9.80665; // m/s^2
export const DT = 1 / 60; // fixed physics step, game seconds

export interface ShipClass {
  id: "rocinante" | "frigate" | "destroyer";
  name: string;
  massT: number; // wet mass, tonnes
  size: [number, number, number]; // length (keel, x), width, height in m
  maxG: number;
  dvKms: number; // reaction-mass budget
  exhaustKms: number;
  flipS: number; // 180° flip time from rest at max torque; sets RCS torque
  railguns: number;
  pdcMounts: number;
  torpedoTubes: number;
  torpedoMagazine: number;
  crewOffset: number; // m forward of center of mass where the crew sits
}

export const SHIPS: Record<ShipClass["id"], ShipClass> = {
  rocinante: {
    id: "rocinante", name: "Rocinante", massT: 300, size: [46, 12, 12], maxG: 15, dvKms: 4000,
    exhaustKms: 10_000, flipS: 10, railguns: 1, pdcMounts: 6, torpedoTubes: 2, torpedoMagazine: 20, crewOffset: 5,
  },
  // Same hull as the Roci before its keel-railgun refit.
  frigate: {
    id: "frigate", name: "MCRN frigate", massT: 300, size: [46, 12, 12], maxG: 15, dvKms: 4000,
    exhaustKms: 10_000, flipS: 10, railguns: 0, pdcMounts: 6, torpedoTubes: 2, torpedoMagazine: 20, crewOffset: 5,
  },
  destroyer: {
    id: "destroyer", name: "Destroyer", massT: 7000, size: [140, 25, 25], maxG: 10, dvKms: 3000,
    exhaustKms: 10_000, flipS: 30, railguns: 0, pdcMounts: 10, torpedoTubes: 8, torpedoMagazine: 40, crewOffset: 10,
  },
};

export const TORPEDO = {
  massKg: 1000,
  size: [4, 0.6, 0.6] as [number, number, number],
  maxG: 150,
  dvKms: 500,
  exhaustKms: 721, // mass ratio 2 for 500 km/s
  flipS: 1,
  tubeReloadS: 10,
  fuseM: 100, // proximity fuse: detonates this close to an enemy ship's center
};

export const RAILGUN = { slugKg: 2, muzzleKms: 1500, cooldownS: 6, alignRad: 1e-4, fineAimRad: 1e-5 };

export const PDC = {
  roundKg: 0.025,
  muzzleKms: 5,
  rpm: 4000,
  ammoPerMount: 20_000,
  dispersionRad: 1e-3, // 1-sigma angular spread of rounds
  muzzleSpread: 0.005, // 1-sigma fractional muzzle-velocity spread
  burstS: 0.5,
};

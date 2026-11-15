import {
  Quat, Vec3, QI, add, addScaled, cross, rotate, scale, v3, qIntegrate, ZERO,
} from "./vec";

export type Side = "player" | "enemy";

export interface Body {
  id: number;
  kind: "ship" | "torpedo";
  side: Side;
  pos: Vec3;
  vel: Vec3;
  q: Quat;
  omega: Vec3; // body-frame angular velocity, rad/s
  dryMass: number; // kg
  fuel: number; // kg of reaction mass
  size: [number, number, number]; // full extents along body x (keel), y, z
  exhaustV: number; // m/s; Infinity means no reaction-mass use
  maxAccel: number; // m/s^2, structural/drive cap
  maxTorque: number; // N·m about any axis
  cmdAccel: number; // commanded keel acceleration, m/s^2
  cmdTorque: Vec3; // commanded body-frame torque, N·m
  accel: Vec3; // world-frame linear acceleration actually achieved last step
  alpha: Vec3; // body-frame angular acceleration last step
  alive: boolean;
}

export const mass = (b: Body) => b.dryMass + b.fuel;

/** Principal moments of a uniform solid box about its body axes. */
export function inertia(b: Body): Vec3 {
  const m = mass(b), [l, w, h] = b.size;
  return v3((m / 12) * (w * w + h * h), (m / 12) * (l * l + h * h), (m / 12) * (l * l + w * w));
}

/** Max torque giving a bang-bang 180° pitch flip from rest in flipS seconds. */
export function torqueForFlip(massKg: number, size: [number, number, number], flipS: number): number {
  const [l, , h] = size;
  const iPitch = (massKg / 12) * (l * l + h * h);
  return iPitch * (4 * Math.PI) / (flipS * flipS);
}

export function makeBody(p: Partial<Body> & Pick<Body, "id" | "kind" | "side" | "dryMass" | "size">): Body {
  return {
    pos: v3(), vel: v3(), q: QI, omega: v3(), fuel: 0, exhaustV: Infinity, maxAccel: Infinity, maxTorque: 0,
    cmdAccel: 0, cmdTorque: v3(), accel: v3(), alpha: v3(), alive: true, ...p,
  };
}

export const keel = (b: Body): Vec3 => rotate(b.q, v3(1, 0, 0));

/** Advance one body by dt under its commanded thrust and torque. */
export function integrateBody(b: Body, dt: number): void {
  // Rotation: Euler's equations with diagonal inertia, torque clamped to the thruster limit.
  const I = inertia(b);
  let tau = b.cmdTorque;
  const tl = Math.hypot(tau.x, tau.y, tau.z);
  if (tl > b.maxTorque) tau = scale(tau, b.maxTorque / tl);
  const Iw = v3(I.x * b.omega.x, I.y * b.omega.y, I.z * b.omega.z);
  const gyro = cross(b.omega, Iw);
  const alpha = v3((tau.x - gyro.x) / I.x, (tau.y - gyro.y) / I.y, (tau.z - gyro.z) / I.z);
  const omega0 = b.omega;
  b.omega = addScaled(b.omega, alpha, dt);
  b.alpha = alpha;
  const qStart = b.q;
  b.q = qIntegrate(b.q, scale(add(omega0, b.omega), 0.5), dt);

  // Translation: constant thrust along the start-of-step keel; rocket equation for mass loss.
  const a = Math.max(0, Math.min(b.cmdAccel, b.maxAccel));
  let dv = 0;
  if (a > 0 && (b.fuel > 0 || b.exhaustV === Infinity)) {
    // Thrust is throttled to hold the commanded acceleration as mass falls.
    if (b.exhaustV === Infinity) {
      dv = a * dt;
    } else {
      const m0 = mass(b);
      const dvMax = b.exhaustV * Math.log(m0 / b.dryMass);
      dv = Math.min(a * dt, dvMax);
      b.fuel = Math.max(0, b.fuel - m0 * (1 - Math.exp(-dv / b.exhaustV)));
      if (dv === dvMax || b.fuel < 1e-9) b.fuel = 0;
    }
  }
  // Thrust along the mid-step keel, so a ship turning while burning pushes where it points on average.
  const dir = rotate(qIntegrate(qStart, scale(add(omega0, b.omega), 0.5), dt / 2), v3(1, 0, 0));
  const dvVec = scale(dir, dv);
  // Average velocity over the step: exact for constant acceleration.
  b.pos = add(b.pos, add(scale(b.vel, dt), scale(dvVec, dt / 2)));
  b.vel = add(b.vel, dvVec);
  b.accel = dt > 0 ? scale(dvVec, 1 / dt) : ZERO;
}

/** Apply an instantaneous impulse (N·s) through the center of mass. */
export function applyImpulse(b: Body, impulse: Vec3): void {
  b.vel = addScaled(b.vel, impulse, 1 / mass(b));
}

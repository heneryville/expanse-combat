import { Body, inertia } from "./body";
import { Vec3, add, angleBetween, cross, len, norm, scale, sub, unrotate, v3, dot } from "./vec";

/** Body-frame torque that turns the keel toward a world direction near time-optimally within the torque limit. */
/** omegaFF: world-frame rate at which the target direction itself is turning, tracked without lag. */
export function torqueToward(b: Body, targetWorld: Vec3, dt: number, omegaFF: Vec3 = v3()): Vec3 {
  const t = norm(unrotate(b.q, targetWorld));
  const x = v3(1, 0, 0);
  const theta = angleBetween(x, t);
  const I = inertia(b);
  let axis = cross(x, t);
  axis = len(axis) > 1e-12 ? norm(axis) : v3(0, 1, 0);
  // Inertia about the turn axis sets the deceleration we can count on.
  const Iaxis = I.x * axis.x * axis.x + I.y * axis.y * axis.y + I.z * axis.z * axis.z;
  const alphaMax = (b.maxTorque / Iaxis) * 0.95;
  const wMag = Math.min(Math.sqrt(2 * alphaMax * theta), theta / (2 * dt));
  const wDesired = add(scale(axis, wMag), unrotate(b.q, omegaFF));
  const dw = sub(wDesired, b.omega);
  const tau = v3(I.x * dw.x / dt, I.y * dw.y / dt, I.z * dw.z / dt);
  const tl = len(tau);
  return tl > b.maxTorque ? scale(tau, b.maxTorque / tl) : tau;
}

/** True when the keel points within tol radians of the world direction and rotation has settled. */
export function aligned(b: Body, targetWorld: Vec3, tol: number): boolean {
  const t = norm(unrotate(b.q, targetWorld));
  return angleBetween(v3(1, 0, 0), t) <= tol && len(b.omega) < Math.max(1e-3, tol * 10);
}

/** Minimum bang-bang time to rotate theta radians from rest about an axis with angular acceleration alpha. */
export const minTurnTime = (theta: number, alpha: number) => 2 * Math.sqrt(theta / alpha);

export const keelDot = (b: Body, dirWorld: Vec3) => dot(norm(unrotate(b.q, dirWorld)), v3(1, 0, 0));

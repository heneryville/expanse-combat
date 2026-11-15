// 3D vectors and unit quaternions. Body frame: +x is the keel (drive thrusts toward +x).

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { w: number; x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const ZERO: Vec3 = Object.freeze(v3()) as Vec3;
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => v3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a: Vec3): number => Math.sqrt(dot(a, a));
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 0 ? scale(a, 1 / l) : v3(1, 0, 0);
};
export const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z);
/** Any unit vector perpendicular to a. */
export const perp = (a: Vec3): Vec3 => norm(Math.abs(a.x) < 0.9 ? cross(a, v3(1, 0, 0)) : cross(a, v3(0, 1, 0)));

export const QI: Quat = Object.freeze({ w: 1, x: 0, y: 0, z: 0 }) as Quat;
export const qmul = (a: Quat, b: Quat): Quat => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
export const qconj = (q: Quat): Quat => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });
export const qnorm = (q: Quat): Quat => {
  const l = Math.hypot(q.w, q.x, q.y, q.z);
  return { w: q.w / l, x: q.x / l, y: q.y / l, z: q.z / l };
};
export const qAxisAngle = (axis: Vec3, angle: number): Quat => {
  const a = norm(axis), s = Math.sin(angle / 2);
  return { w: Math.cos(angle / 2), x: a.x * s, y: a.y * s, z: a.z * s };
};
/** Rotate body-frame vector into world frame. */
export const rotate = (q: Quat, v: Vec3): Vec3 => {
  const t = qmul(qmul(q, { w: 0, x: v.x, y: v.y, z: v.z }), qconj(q));
  return v3(t.x, t.y, t.z);
};
/** Rotate world-frame vector into body frame. */
export const unrotate = (q: Quat, v: Vec3): Vec3 => rotate(qconj(q), v);
/** Shortest-arc rotation taking unit vector a onto unit vector b. */
export const qFromTo = (a: Vec3, b: Vec3): Quat => {
  const d = dot(a, b);
  if (d < -0.999999) return qAxisAngle(perp(a), Math.PI);
  const c = cross(a, b);
  return qnorm({ w: 1 + d, x: c.x, y: c.y, z: c.z });
};
/** Integrate attitude by body-frame angular velocity over dt (exact for constant omega). */
export const qIntegrate = (q: Quat, omegaBody: Vec3, dt: number): Quat => {
  const w = len(omegaBody);
  if (w * dt < 1e-12) return q;
  return qnorm(qmul(q, qAxisAngle(omegaBody, w * dt)));
};
export const angleBetween = (a: Vec3, b: Vec3): number =>
  Math.atan2(len(cross(a, b)), dot(a, b));

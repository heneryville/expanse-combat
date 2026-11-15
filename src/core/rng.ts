// Seeded PRNG (mulberry32) so every random draw is reproducible from the match seed.

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number { return lo + (hi - lo) * this.next(); }
  gauss(): number {
    const u = this.next() || 1e-12, v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Uniform direction on the unit sphere. */
  dir(): { x: number; y: number; z: number } {
    const z = this.range(-1, 1), a = this.range(0, 2 * Math.PI), r = Math.sqrt(1 - z * z);
    return { x: r * Math.cos(a), y: r * Math.sin(a), z };
  }
  poisson(mean: number): number {
    if (mean <= 0) return 0;
    if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * this.gauss()));
    const L = Math.exp(-mean);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
  fork(salt: number): Rng { return new Rng((Math.imul(this.s ^ salt, 2654435761) + salt) >>> 0); }
}

import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/rng";

describe("Rng", () => {
  it("same seed gives same sequence", () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it("different seeds differ", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
  it("poisson mean matches", () => {
    const r = new Rng(7);
    let s = 0;
    for (let i = 0; i < 20000; i++) s += r.poisson(2.5);
    expect(s / 20000).toBeCloseTo(2.5, 1);
  });
});

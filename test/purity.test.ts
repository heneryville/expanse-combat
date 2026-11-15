import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CORE = join(__dirname, "..", "src", "core");

describe("simulation core purity", () => {
  const files = readdirSync(CORE).filter((f) => f.endsWith(".ts"));
  it("has source files", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${f} has no DOM or three.js dependency`, () => {
      const src = readFileSync(join(CORE, f), "utf8");
      expect(src).not.toMatch(/from\s+["']three/);
      expect(src).not.toMatch(/\b(window|document|requestAnimationFrame)\b/);
      expect(src).not.toMatch(/from\s+["']\.\.\/(render|ui|worker)/);
    });
  }
});

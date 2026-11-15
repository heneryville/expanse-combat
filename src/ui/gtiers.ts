import { doseRate, hazardOver, riskPerHour, RECOVERY_S } from "../core/crew";

export interface GTier { color: number; css: string; label: string; secondsTo10: number }

const H_10PCT = -Math.log(0.9);

/** Seconds of g from rested to a 10% cumulative death risk, by bisection over a day. */
function secondsTo10(g: number): number {
  if (hazardOver(0, g, 86400) < H_10PCT) return Infinity;
  let lo = 0, hi = 86400;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (hazardOver(0, g, m) < H_10PCT) lo = m; else hi = m; }
  return hi;
}

const fmtPerH = (p: number) => (p >= 99.5 ? ">99" : p >= 10 ? p.toFixed(0) : p >= 0.1 ? p.toFixed(1) : "<0.1");

/** How bad sustained g is for the crew: steady death risk per hour, plus how soon it bites when that comes fast. */
export function gTier(g: number): GTier {
  const s = secondsTo10(g), perH = riskPerHour(doseRate(g) * RECOVERY_S) * 100;
  const soon = s > 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;
  const color = perH === 0 ? 0x5cc48a : s > 3600 ? 0xb6d35c : s > 600 ? 0xe3b049 : s > 60 ? 0xf08a4c : 0xf05a5a;
  const label = perH === 0 ? "0%/h · no strain" : `${fmtPerH(perH)}%/h held${s <= 600 ? ` · 1 in 10 dead after ${soon}` : ""}`;
  return { color, css: `#${color.toString(16).padStart(6, "0")}`, label, secondsTo10: s };
}

export const G_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];

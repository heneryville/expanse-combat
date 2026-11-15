import type { Order } from "../core/control";
import type { Quat, Vec3 } from "../core/vec";

export type ToWorker =
  | { type: "start"; seed: number }
  /** Restore this tab's saved match if there is one, else start one with `seed`. */
  | { type: "resume"; tabId: string; seed: number }
  | { type: "order"; order: Order; label: string }
  | { type: "warp"; level: number }
  | { type: "pause"; paused: boolean }
  | { type: "select"; contactId: number | null; aiming: boolean }
  | { type: "replay" }
  | { type: "scrub"; index: number };

export interface ContactView {
  /** `slot` is the enemy ship index (picks its color), -1 for everything else. */
  id: number; name: string; slot: number; kind: "ship" | "torpedo"; side: "player" | "enemy";
  pos: Vec3; vel: Vec3; q: Quat; size: [number, number, number]; age: number; g: number;
}

export interface CloudView { points: Float32Array; weights: Float32Array; origin: Vec3; t: number; spread: number; label: string }

export interface PdcView { center: Vec3; dir: Vec3; sl: number; st: number; n: number; id: number }

export interface Snapshot {
  type: "snapshot";
  t: number;
  warp: number;
  achievedWarp: number;
  dropReason: string | null;
  paused: boolean;
  result: string | null;
  player: {
    id: number; pos: Vec3; vel: Vec3; q: Quat; size: [number, number, number]; g: number; gAllowance: number; maxG: number;
    dose: number; riskPerHour: number; dvLeftKms: number; magazine: number; tubesReady: number; tubes: number; pdcRounds: number;
    railReadyIn: number; railAiming: boolean; notice: string | null; heading: Vec3 | null; alive: boolean; crewAlive: boolean;
  };
  contacts: ContactView[];
  /** Slugs the Roci fired, extrapolated from launch: `from` is the muzzle position, `age` seconds since firing. */
  ownSlugs: { pos: Vec3; vel: Vec3; from: Vec3; age: number }[];
  ownClouds: PdcView[];
  /** The player's latest burn change or shot, spreading at c. */
  lastEmission: { t: number; pos: Vec3; kind: string } | null;
  recentFlashes: { kind: string; pos: Vec3; seenAt: number; side: string }[];
  /** Where each seen enemy ship could be right now. */
  enemyClouds: { id: number; slot: number; name: string; cloud: CloudView }[];
  selected: { id: number; cloud: CloudView | null; arrivalS: number | null; hitP: number | null } | null;
  /** Hostile torpedoes as last seen: range, closing speed and estimated time to impact. */
  threats: { id: number; range: number; closing: number; eta: number; age: number }[];
  /** What the Roci is doing right now under its standing orders. */
  standing: { drive: string; driveState: "burn" | "turn" | "coast" | "aim"; evading: boolean; railgun: string; torpedoes: string[] };
  /** Event-log entries added since the previous snapshot. */
  log: LogEntry[];
}

/** One line of the event log: an own action, or something whose light just reached the Roci. */
export interface LogEntry { id: number; t: number; text: string; kind: "order" | "own" | "enemy" | "kill" | "fail"; age: number; count: number }

export interface ReplayFrame {
  t: number;
  truth: { id: number; kind: string; side: string; pos: Vec3; q: Quat; size: [number, number, number]; alive: boolean }[];
  slugs: Vec3[];
  clouds: PdcView[];
  playerSaw: ContactView[];
  enemySaw: ContactView[];
  shot: { aim: Vec3; cloud: CloudView } | null;
}

/** One body in an action-shot frame, relative to that frame's center. */
export interface ClipBody { id: number; kind: "ship" | "torpedo" | "slug"; side: "player" | "enemy"; slot: number; pos: Vec3; q: Quat; size: [number, number, number]; g: number; alive: boolean }

/** One camera shot of a replay: frames played over playS seconds, framing a sphere of `radius` (or a frame's own) seen from `view`. */
export interface ClipShot { label: string; radius: number; view: Vec3; playS: number; frames: { t: number; bodies: ClipBody[]; clouds: PdcView[]; radius?: number }[] }

/** An instant replay of a ship kill, a torpedo shot down or a near-miss, cut from the light histories. */
export interface ActionClip {
  kind: "kill" | "pdcKill" | "miss";
  title: string;
  detail: string;
  /** Game time of the event. */
  t: number;
  /** Something was destroyed: the replay ends on its debris. */
  destroyed: boolean;
  /** Where the blast goes in the impact shot (its center), none for a miss. */
  flash: Vec3 | null;
  shots: ClipShot[];
}

export type FromWorker =
  | Snapshot
  | { type: "action"; clip: ActionClip }
  | { type: "resumed"; restored: boolean }
  | { type: "replayReady"; frames: number; duration: number }
  | { type: "replayFrame"; index: number; frame: ReplayFrame };

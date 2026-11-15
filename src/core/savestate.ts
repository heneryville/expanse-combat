// Whole-match save state: the object graph as structured-clonable data, restored in place into a fresh Match so systems' closures stay wired.
import { Match } from "./match";
import { History, Perception } from "./perception";
import { Tracker } from "./prediction";
import { Rng } from "./rng";
import { Observer } from "./sensors";
import { Scheduler, World } from "./world";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const CLASSES: Record<string, { prototype: object }> = { Match, World, Scheduler, Perception, History, Observer, Tracker, Rng };
const CLASS_NAME = new Map<object, string>(Object.entries(CLASSES).map(([k, v]) => [v.prototype, k]));

/** A value: primitive, non-finite number, reference to a node, or a function slot left to the fresh match. */
type Enc = number | string | boolean | null | { $n: string } | { $r: number } | { $f: 1 } | { $u: 1 };
type Node =
  | { t: "O"; c?: string; f: Record<string, Enc> }
  | { t: "A"; v: Enc[] }
  | { t: "M"; v: [Enc, Enc][] }
  | { t: "S"; v: Enc[] }
  | { t: "F64"; a: Float64Array }
  | { t: "K" }; // a module constant (ship class, default config): kept as the live one, never overwritten

export interface SaveState { v: 2; nodes: Node[] }

/** Objects every new match shares (module constants), found by building a second match and seeing what it reaches. */
const staticCache = new WeakMap<Match, Set<object>>();
function staticsOf(m: Match): Set<object> {
  let s = staticCache.get(m);
  if (!s) staticCache.set(m, (s = reachable(new Match(m.seed, m.config))));
  return s;
}

export function saveMatch(m: Match): SaveState {
  const statics = staticsOf(m);
  const ids = new Map<object, number>(), nodes: Node[] = [];
  const enc = (x: unknown): Enc => {
    if (typeof x === "function") return { $f: 1 };
    if (typeof x === "number") return Number.isFinite(x) ? x : { $n: String(x) };
    if (x === undefined) return { $u: 1 };
    if (x === null || typeof x !== "object") return x as Enc;
    let id = ids.get(x);
    if (id !== undefined) return { $r: id };
    id = nodes.length;
    ids.set(x, id);
    nodes.push(null as unknown as Node);
    nodes[id] = node(x);
    return { $r: id };
  };
  const node = (x: object): Node => {
    if (statics.has(x)) return { t: "K" };
    if (x instanceof Float64Array) return { t: "F64", a: x.slice() };
    if (Array.isArray(x)) return { t: "A", v: x.map(enc) };
    if (x instanceof Map) return { t: "M", v: [...x].map(([k, v]) => [enc(k), enc(v)] as [Enc, Enc]) };
    if (x instanceof Set) return { t: "S", v: [...x].map(enc) };
    const proto = Object.getPrototypeOf(x);
    const c = proto === Object.prototype ? undefined : CLASS_NAME.get(proto);
    if (proto !== Object.prototype && !c) throw new Error(`savestate: unregistered class ${proto?.constructor?.name}`);
    const f: Record<string, Enc> = {};
    for (const k of Object.keys(x)) f[k] = enc((x as Any)[k]);
    return c ? { t: "O", c, f } : { t: "O", f };
  };
  enc(m);
  return { v: 2, nodes };
}

/** Overwrite a freshly built match (same seed) with the saved state. */
export function restoreMatch(save: SaveState, fresh: Match): void {
  const { nodes } = save;
  const objs: Any[] = new Array(nodes.length);
  const claimed = new Set<object>();
  const reused = new Set<number>();
  const templates = classTemplates(fresh);
  const statics = staticsOf(fresh);

  const fits = (n: Node, f: Any) => {
    if (!f || typeof f !== "object" || claimed.has(f) || statics.has(f)) return false;
    if (n.t === "A") return Array.isArray(f);
    if (n.t === "M") return f instanceof Map;
    if (n.t === "S") return f instanceof Set;
    if (n.t === "O") return !Array.isArray(f) && Object.getPrototypeOf(f) === (n.c ? CLASSES[n.c].prototype : Object.prototype);
    return false;
  };
  const create = (n: Node): Any => {
    if (n.t === "A") return [];
    if (n.t === "M") return new Map();
    if (n.t === "S") return new Set();
    if (n.t === "F64") return n.a.slice();
    if (n.t === "K") throw new Error("savestate: constant has no fresh counterpart");
    if (n.c && !CLASSES[n.c]) throw new Error(`savestate: unknown class ${n.c}`);
    return n.c ? Object.create(CLASSES[n.c].prototype) : {};
  };
  // Pair each saved object with the fresh one at the same path, so closures over fresh objects see restored data.
  const pair = (id: number, f: Any): void => {
    if (objs[id] !== undefined) return;
    const n = nodes[id];
    if (n.t === "K") {
      if (!f || !statics.has(f)) throw new Error("savestate: constant moved; save no longer matches the code");
      objs[id] = f;
      return;
    }
    const reuse = fits(n, f);
    objs[id] = reuse ? f : create(n);
    if (reuse) { claimed.add(f); reused.add(id); }
    const sub = (e: Enc, child: Any) => { if (e && typeof e === "object" && "$r" in e) pair(e.$r, reuse ? child : undefined); };
    if (n.t === "O") for (const k in n.f) sub(n.f[k], f?.[k]);
    else if (n.t === "A") n.v.forEach((e, i) => sub(e, f?.[i]));
    else if (n.t === "M") for (const [k, v] of n.v) { sub(k, undefined); sub(v, reuse ? f.get(dec(k)) : undefined); }
    else if (n.t === "S") n.v.forEach((e) => sub(e, undefined));
  };
  const dec = (e: Enc): Any => {
    if (e === null || typeof e !== "object") return e;
    if ("$n" in e) return Number(e.$n);
    if ("$r" in e) return objs[e.$r];
    return undefined;
  };
  const isFn = (e: Enc) => !!e && typeof e === "object" && "$f" in e;

  pair(0, fresh);
  nodes.forEach((n, id) => {
    const o = objs[id];
    if (n.t === "O") {
      for (const k in n.f) if (!isFn(n.f[k])) o[k] = dec(n.f[k]);
      // Objects made mid-match (a torpedo's Observer) take their function fields from a fresh instance of the class.
      const tpl = n.c && !reused.has(id) ? templates.get(n.c) : undefined;
      if (tpl) for (const k of Object.keys(tpl)) if (typeof tpl[k] === "function") o[k] = tpl[k];
    } else if (n.t === "A") {
      const old = reused.has(id) ? o.slice() : [];
      o.length = 0;
      n.v.forEach((e, i) => o.push(isFn(e) ? old[i] : dec(e)));
    } else if (n.t === "M") {
      o.clear();
      for (const [k, v] of n.v) o.set(dec(k), dec(v));
    } else if (n.t === "S") {
      o.clear();
      for (const e of n.v) o.add(dec(e));
    }
  });
}

/** One fresh instance of each registered class, found by walking the fresh match. */
function classTemplates(root: object): Map<string, Any> {
  const out = new Map<string, Any>();
  for (const x of reachable(root)) {
    const c = CLASS_NAME.get(Object.getPrototypeOf(x));
    if (c && !out.has(c)) out.set(c, x);
  }
  return out;
}

function reachable(root: object): Set<object> {
  const seen = new Set<object>(), stack: Any[] = [root];
  while (stack.length) {
    const x = stack.pop();
    if (!x || typeof x !== "object" || seen.has(x)) continue;
    seen.add(x);
    if (ArrayBuffer.isView(x)) continue;
    if (x instanceof Map) for (const [k, v] of x) stack.push(k, v);
    else if (x instanceof Set || Array.isArray(x)) for (const v of x) stack.push(v);
    else for (const k of Object.keys(x)) stack.push(x[k]);
  }
  return seen;
}

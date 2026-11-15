import { ENEMY_COLORS, TacticalView, fmtDist } from "./render/view";
import { MiniView } from "./render/mini";
import type { ActionClip, FromWorker, Snapshot, ToWorker } from "./worker/protocol";
import type { Order } from "./core/control";
import { WARP_LEVELS } from "./core/control";
import { G_STEPS, gTier } from "./ui/gtiers";
import type { Vec3 } from "./core/vec";

const app = document.getElementById("app")!;
app.innerHTML = `
  <div id="stage"><div class="notice" id="notice" hidden></div></div>
  <div class="action" id="action" hidden>
    <div class="action-head"><b id="action-title"></b><span id="action-more" class="muted"></span><button id="action-close" title="Close (Esc)">✕</button></div>
    <div class="action-stage" id="action-stage"></div>
    <div class="action-foot"><span id="action-detail"></span><span id="action-speed" class="muted"></span><button id="action-replay">Replay</button></div>
  </div>
  <header class="hud" id="hud">
    <div><span>Game clock</span><b id="h-clock"></b></div>
    <div><span>Warp</span><b id="h-warp"></b></div>
    <div><span>G allowance</span><b id="h-allow"></b></div>
    <div><span>Current g</span><b id="h-g"></b></div>
    <div class="wide"><span>Crew death risk per hour</span><div class="bar"><i id="h-dose"></i></div><small id="h-risk"></small></div>
    <div><span>Reaction mass</span><b id="h-dv"></b></div>
    <div><span>Railgun</span><b id="h-rail"></b></div>
    <div><span>Torpedoes</span><b id="h-torp"></b></div>
    <div><span>PDC rounds</span><b id="h-pdc"></b></div>
  </header>
  <div class="bottom">
    <section class="log" id="log-box">
      <h2>Event log <small>own actions now · everything else when its light arrives</small></h2>
      <ol id="log"></ol>
    </section>
    <div class="insets" id="insets"></div>
  </div>
  <aside class="panel" id="panel">
    <section class="standing">
      <h2>Current orders</h2>
      <dl>
        <dt>Drive</dt><dd id="o-drive"></dd>
        <dt>Railgun</dt><dd id="o-rail"></dd>
        <dt>Torpedoes</dt><dd id="o-torp"></dd>
      </dl>
    </section>
    <section>
      <h2>Drive</h2>
      <div class="gsel" id="g-buttons" title="G allowance; color is how fast it hurts the crew (+/− step 0.5 g)"></div>
      <div class="gnote" id="g-note"></div>
      <div class="row wrap">
        <button id="hd-to" title="Burn toward the selected contact">Toward</button>
        <button id="hd-away" title="Burn away from the selected contact">Away</button>
        <button id="hd-up">Up</button><button id="hd-down">Down</button>
        <button id="hd-click" title="Click the grid to pick a burn direction (H)">Pick on grid</button>
        <button id="hd-cut" title="Cut the drive and coast (X)">Cut drive</button>
        <button id="hd-evade" title="Jink at random across the line of fire until another drive order (E)">Evade</button>
      </div>
    </section>
    <section>
      <h2>Weapons <small id="sel-name">no target</small></h2>
      <div class="row wrap">
        <button id="w-aim" title="Show the target's cloud at slug arrival (A)">Aim view</button>
        <button id="w-rail" title="Fire railgun at the selected contact (R)">Railgun</button>
        <button id="w-torp" title="Launch torpedo at the selected contact (T)">Torpedo</button>
        <button id="w-torp2">Salvo ×2</button>
        <button id="w-pdc" title="Offensive PDC burst at the selected contact (P)">PDC burst</button>
      </div>
    </section>
    <section>
      <h2>Incoming</h2>
      <ol class="threats" id="threats"><li class="muted">No torpedoes seen</li></ol>
    </section>
    <section>
      <h2>Time</h2>
      <div class="row wrap" id="warp-buttons"></div>
      <div class="row"><button id="pause" title="Pause (Space)">Pause</button><button id="focus" title="Center camera on target / own ship (F)">Focus target</button></div>
    </section>
    <section id="end" hidden>
      <h2 id="end-title"></h2>
      <button id="replay">Truth replay</button>
      <input id="scrub" type="range" min="0" max="0" value="0" hidden>
      <div id="scrub-t" class="muted"></div>
      <button id="new-match">New match</button>
    </section>
    <button id="help-btn" title="Controls and how to read the display (?)">How to play</button>
  </aside>
  <div class="help" id="help" hidden>
    <h2>Command the Rocinante</h2>
    <p>Two MCRN frigates, the Roci's own class, are hunting you. Kill both.</p>
    <p>Everything you see is old light. Contacts sit where they were when their light left them, labelled with that age. The orange cloud is where a contact could be by now, drawn at true size: zoom in to see it.</p>
    <ul>
      <li><b>Select</b> a contact by clicking its label. <b>Aim view (A)</b> shows its cloud when a slug would arrive, and your odds of a hit.</li>
      <li><b>Drive:</b> set g with <b>+/−</b>, then burn Toward / Away from the selected contact (or the nearest frigate) / Up / Down, pick a direction on the grid (<b>H</b>), or cut the drive (<b>X</b>). <b>Evade (E)</b> jinks at random across the line to the nearest frigate every 5–12 s, so a slug or PDC stream aimed at your track misses; any other drive order ends it. Above 4 g your crew builds up strain, and the death-risk bar shows the chance per hour of a fatal stroke at the current strain. Strain heals within a few minutes once you ease off: 5–6 g can be held for days, 7 g costs about 6%/h, and 10 g kills half of crews within 5 minutes.</li>
      <li><b>Railgun (R):</b> 2 kg at 1,500 km/s along the keel. The ship turns to aim, then fires. Only worth it when the odds are high.</li>
      <li><b>Torpedo (T):</b> about 150 g, with 500 km/s of fuel. Good inside about 400,000 km. PDCs defend you automatically; <b>P</b> fires an offensive burst.</li>
      <li><b>Time:</b> <b>[ ]</b> change warp, <b>Space</b> pauses. Warp drops to ×1 when new light shows the enemy acting, or a torpedo is close.</li>
      <li>Ships and torpedoes are drawn enlarged so you can read their attitude. Arrows show each one's direction of travel. Drive plumes show thrust: longer and hotter-colored with more g, in the same colors as the g buttons.</li>
      <li>Faint rings mark range every 2 light-seconds.</li>
      <li><b>F</b> centres the camera on your target. Drag to orbit, middle-drag to tilt, scroll to zoom from metres to millions of km.</li>
    </ul>
    <p class="credits">Ship models: "MCRN Tachi" by Jakub.Vildomec (CC BY 4.0); "The Corvette Class Light Frigate" by wintermute666 (CC BY-NC-SA 4.0), recolored. Both via Sketchfab.</p>
    <button id="help-close">Close</button>
  </div>`;

const worker = new Worker(new URL("./worker/sim.worker.ts", import.meta.url), { type: "module" });
const send = (m: ToWorker) => worker.postMessage(m);
const view = new TacticalView(document.getElementById("stage")!);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let snap: Snapshot | null = null;
let selected: number | null = null;
let aiming = false;
let replaying = false;

const order = (o: Order, label = "") => send({ type: "order", order: o, label });
const select = (id: number | null) => { selected = id; send({ type: "select", contactId: id, aiming }); };
view.onPickContact = (id) => select(id);
view.onPlanePoint = (p) => {
  if (!snap) return;
  order({ type: "heading", dir: sub(p, snap.player.pos) }, "toward a grid point");
  view.headingMode = false;
  $("hd-click").classList.remove("on");
};

const target = () => snap?.contacts.find((c) => c.id === selected);
/** The selected contact, or the nearest frigate when nothing is selected. */
const targetOrNearest = () => {
  if (!snap) return undefined;
  const me = snap.player.pos, d = (c: { pos: Vec3 }) => Math.hypot(c.pos.x - me.x, c.pos.y - me.y, c.pos.z - me.z);
  return target() ?? snap.contacts.filter((c) => c.kind === "ship" && c.side === "enemy").sort((a, b) => d(a) - d(b))[0];
};
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

function setG(delta: number) {
  if (!snap) return;
  const g = Math.max(0, Math.min(snap.player.maxG, Math.round((snap.player.gAllowance + delta) * 2) / 2));
  order({ type: "setG", g });
}
for (const g of G_STEPS) {
  const b = document.createElement("button"), t = gTier(g);
  b.textContent = String(g);
  b.dataset.g = String(g);
  b.title = `${g} g · ${t.label}`;
  b.style.setProperty("--tier", t.css);
  b.onclick = () => order({ type: "setG", g });
  $("g-buttons").appendChild(b);
}
// Toward/Away fix a bearing at the moment of the order; they don't track the contact.
$("hd-to").onclick = () => { const t = targetOrNearest(); if (t && snap) order({ type: "heading", dir: sub(t.pos, snap.player.pos) }, `toward ${t.name}`); };
$("hd-away").onclick = () => { const t = targetOrNearest(); if (t && snap) order({ type: "heading", dir: sub(snap.player.pos, t.pos) }, `away from ${t.name}`); };
$("hd-up").onclick = () => order({ type: "heading", dir: { x: 0, y: 0, z: 1 } }, "up");
$("hd-down").onclick = () => order({ type: "heading", dir: { x: 0, y: 0, z: -1 } }, "down");
$("hd-cut").onclick = () => order({ type: "heading", dir: null });
$("hd-evade").onclick = () => order({ type: "evade" });
$("hd-click").onclick = () => { view.headingMode = !view.headingMode; $("hd-click").classList.toggle("on", view.headingMode); };
$("w-aim").onclick = () => { aiming = !aiming; $("w-aim").classList.toggle("on", aiming); select(selected); };
$("w-rail").onclick = () => { if (selected !== null) order({ type: "railgun", aim: { contact: selected } }); };
$("w-torp").onclick = () => { if (selected !== null) order({ type: "torpedo", target: selected }); };
$("w-torp2").onclick = () => { if (selected !== null) order({ type: "torpedo", target: selected, count: 2 }); };
$("w-pdc").onclick = () => { if (selected !== null) order({ type: "pdc", aim: { contact: selected } }); };
$("pause").onclick = () => send({ type: "pause", paused: !snap?.paused });
$("focus").onclick = () => { view.focusOn = view.focusOn === "player" && selected !== null ? selected : "player"; };
$("replay").onclick = () => { send({ type: "replay" }); $("replay").textContent = "Building replay…"; };
$("scrub").oninput = () => send({ type: "scrub", index: Number(($("scrub") as HTMLInputElement).value) });
$("new-match").onclick = () => start();
$("help-btn").onclick = () => { $("help").hidden = false; };
$("help-close").onclick = () => { $("help").hidden = true; };
for (const w of WARP_LEVELS) {
  const b = document.createElement("button");
  b.textContent = `×${w}`;
  b.dataset.warp = String(w);
  b.onclick = () => send({ type: "warp", level: w });
  $("warp-buttons").appendChild(b);
}

addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); $("pause").click(); }
  else if (k === "+" || k === "=") setG(0.5);
  else if (k === "-") setG(-0.5);
  else if (k === "r") $("w-rail").click();
  else if (k === "t") $("w-torp").click();
  else if (k === "p") $("w-pdc").click();
  else if (k === "a") $("w-aim").click();
  else if (k === "f") $("focus").click();
  else if (k === "h") $("hd-click").click();
  else if (k === "x") $("hd-cut").click();
  else if (k === "e") $("hd-evade").click();
  else if (k === "escape" && !$("action").hidden) $("action-close").click();
  else if (k === "?" || k === "escape") $("help").hidden = k === "escape" ? true : !$("help").hidden;
  else if (k === "]" || k === "[") {
    const i = WARP_LEVELS.indexOf(snap?.warp ?? 1) + (k === "]" ? 1 : -1);
    send({ type: "warp", level: WARP_LEVELS[Math.max(0, Math.min(WARP_LEVELS.length - 1, i))] });
  }
});

const fmtRisk = (p: number) => (p >= 0.995 ? ">99%" : p >= 0.1 ? `${(p * 100).toFixed(0)}%` : p >= 0.001 ? `${(p * 100).toFixed(1)}%` : p > 0 ? "<0.1%" : "0%");
const clock = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  return `T+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const RESULTS: Record<string, string> = { playerWin: "Both frigates killed. You win.", enemyWin: "The Rocinante is lost.", mutualKill: "Mutual kill.", draw: "Draw: neither side can engage." };

let lastLogId = 0;
function appendLog(entries: Snapshot["log"]) {
  const ol = $("log");
  const stick = ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 4;
  for (const e of entries) {
    const li = document.createElement("li");
    li.className = e.kind;
    const age = e.age > 0.05 ? `<span class="muted">light ${e.age.toFixed(1)} s old</span>` : "";
    li.innerHTML = `<span class="muted">${clock(e.t)}</span><span>${e.text}${e.count > 1 ? ` ×${e.count}` : ""}</span>${age}`;
    // A repeat of the last line comes back with the same id and a higher count.
    if (e.id === lastLogId && ol.lastElementChild) ol.lastElementChild.replaceWith(li);
    else ol.appendChild(li);
    lastLogId = e.id;
  }
  if (stick) ol.scrollTop = ol.scrollHeight;
}

function hud(s: Snapshot) {
  const p = s.player;
  $("h-clock").textContent = clock(s.t);
  $("h-warp").textContent = `×${s.warp}${s.achievedWarp < s.warp * 0.9 && !s.paused ? ` (CPU ×${s.achievedWarp.toFixed(0)})` : ""}${s.paused ? " · paused" : ""}`;
  $("h-allow").textContent = `${p.gAllowance.toFixed(1)} g`;
  const tier = gTier(p.gAllowance);
  $("g-note").innerHTML = `<b style="color:${tier.css}">${p.gAllowance.toFixed(1)} g</b> · ${tier.label}`;
  for (const b of $("g-buttons").querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.g) === p.gAllowance);
  $("h-g").textContent = `${p.g.toFixed(1)} g`;
  $("h-dose").style.width = `${Math.min(100, p.riskPerHour * 100)}%`;
  $("h-dose").className = p.riskPerHour > 0.3 ? "crit" : p.riskPerHour > 0.05 ? "warn" : "";
  $("h-risk").textContent = `${fmtRisk(p.riskPerHour)}/h`;
  $("h-dv").textContent = `Δv ${Math.round(p.dvLeftKms).toLocaleString()} km/s`;
  $("h-rail").textContent = p.railAiming ? "aiming…" : p.railReadyIn > 0 ? `${p.railReadyIn.toFixed(1)} s` : "ready";
  $("h-torp").textContent = `${p.tubesReady}/${p.tubes} tubes · ${p.magazine} left`;
  $("h-pdc").textContent = p.pdcRounds.toLocaleString();
  for (const b of $("warp-buttons").querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.warp) === s.warp);
  $("pause").textContent = s.paused ? "Resume" : "Pause";
  const t = target();
  $("sel-name").textContent = t ? `${t.name} · ${fmtDist(Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y, t.pos.z - p.pos.z))}${s.selected?.arrivalS ? ` · slug flight ${s.selected.arrivalS.toFixed(1)} s` : ""}` : "no target";
  $("w-rail").textContent = s.selected?.hitP != null ? `Railgun · ${(s.selected.hitP * 100).toFixed(s.selected.hitP < 0.1 ? 1 : 0)}%` : "Railgun";
  $("threats").innerHTML = s.threats.length
    ? s.threats.slice(0, 6).map((x) => `<li class="${x.eta < 30 ? "hot" : ""}"><span>${fmtDist(x.range)}</span><span>${x.closing > 0 ? `${(x.closing / 1000).toFixed(1)} km/s` : "opening"}</span><b>${Number.isFinite(x.eta) ? `${Math.max(0, x.eta).toFixed(0)} s` : "—"}</b></li>`).join("")
    : `<li class="muted">No torpedoes seen</li>`;
  $("o-drive").textContent = s.standing.drive;
  $("o-drive").className = s.standing.driveState;
  $("hd-evade").classList.toggle("on", s.standing.evading);
  $("o-rail").textContent = s.standing.railgun;
  $("o-torp").textContent = s.standing.torpedoes.length ? s.standing.torpedoes.join(" · ") : "None in flight";
  appendLog(s.log);
  const notes = [s.dropReason && s.warp === 1 ? `Warp dropped: ${s.dropReason}` : null, p.notice].filter(Boolean);
  $("notice").hidden = notes.length === 0;
  $("notice").textContent = notes.join(" · ");
  if (s.result) {
    $("end").hidden = false;
    const crewLost = !p.crewAlive && (s.result === "enemyWin" || s.result === "mutualKill");
    $("end-title").textContent = crewLost ? `${RESULTS[s.result]} Your crew died under g-load.` : RESULTS[s.result] ?? s.result;
  }
}

/** This tab's id: sessionStorage survives reloads (and Vite's) but not closing the tab, so each tab keeps its own match. */
function tabId(): string {
  try {
    let id = sessionStorage.getItem("expanse-combat-tab");
    if (!id) sessionStorage.setItem("expanse-combat-tab", (id = crypto.randomUUID()));
    return id;
  } catch { return crypto.randomUUID(); }
}

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const m = e.data;
  if (m.type === "resumed") {
    if (m.restored) $("help").hidden = true;
  } else if (m.type === "action") {
    if (playing) actionQueue.push(m.clip); else playAction(m.clip);
  } else if (m.type === "snapshot") {
    snap = m;
    if (!replaying) { view.update(m); hud(m); updateInsets(m); }
  } else if (m.type === "replayReady") {
    replaying = true;
    const r = $("scrub") as HTMLInputElement;
    r.max = String(m.frames - 1);
    r.value = "0";
    r.hidden = false;
    $("replay").hidden = true;
    send({ type: "scrub", index: 0 });
  } else if (m.type === "replayFrame") {
    view.updateReplay(m.frame);
    $("scrub-t").textContent = `${clock(m.frame.t)} · truth (solid), what you saw (violet), what the frigates saw of you (green)${m.frame.shot ? " · railgun shot: violet cloud is what you aimed at" : ""}`;
  }
};

function start() {
  replaying = false;
  selected = null;
  aiming = false;
  $("end").hidden = true;
  $("replay").hidden = false;
  $("replay").textContent = "Truth replay";
  $("scrub").hidden = true;
  view.focusOn = "player";
  $("log").innerHTML = "";
  lastLogId = 0;
  send({ type: "start", seed: (Math.random() * 2 ** 31) | 0 });
}

/** Pick up this tab's saved match if there is one, so a reload (or a code change) doesn't lose the scenario. */
function resume() {
  $("log").innerHTML = "";
  lastLogId = 0;
  send({ type: "resume", tabId: tabId(), seed: (Math.random() * 2 ** 31) | 0 });
}

// ---------- Enemy close-ups: each frigate big enough to read its attitude, in its now-cloud ----------

const insets = new Map<number, { el: HTMLDivElement; label: HTMLElement; view: MiniView }>();
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const COLOR = { roci: 0x6cb4e4, torp: 0xf07a6c, ownTorp: 0x9fd3f5, slug: 0xfff3a8 };
const norm3 = (v: Vec3) => { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; };

function updateInsets(s: Snapshot) {
  const live = new Set<number>();
  for (const ec of s.enemyClouds) {
    const c = s.contacts.find((x) => x.id === ec.id);
    if (!c) continue;
    live.add(ec.id);
    const color = ENEMY_COLORS[ec.slot] ?? ENEMY_COLORS[0];
    let ins = insets.get(ec.id);
    if (!ins) {
      const el = document.createElement("div");
      el.className = "inset";
      el.style.setProperty("--c", hex(color));
      el.innerHTML = `<div class="inset-label"></div><div class="inset-stage"></div><div class="inset-key"><span style="color:${hex(COLOR.roci)}">→ Roci</span> <span>→ velocity vs Roci</span> · drag to turn</div>`;
      $("insets").appendChild(el);
      const v = new MiniView(el.querySelector(".inset-stage") as HTMLElement);
      el.onclick = () => { if (!v.dragged) select(ec.id); };
      ins = { el, label: el.firstElementChild as HTMLElement, view: v };
      insets.set(ec.id, ins);
    }
    const toMe = sub(s.player.pos, ec.cloud.origin), range = Math.hypot(toMe.x, toMe.y, toMe.z);
    const los = norm3(toMe), up = { x: 0, y: 0, z: 1 };
    // Side-on to the line to the Roci: a ship pointed at you would otherwise be seen nose-on.
    const side = { x: los.y * up.z - los.z * up.y, y: los.z * up.x - los.x * up.z, z: los.x * up.y - los.y * up.x };
    const shipLen = Math.max(...c.size);
    ins.view.look({ x: side.x, y: side.y, z: side.z + 0.35 }, Math.max(1.5 * shipLen, 1.6 * ec.cloud.spread));
    const torps = s.contacts.filter((x) => x.kind === "torpedo" && Math.hypot(...Object.values(sub(x.pos, ec.cloud.origin))) < 20 * shipLen);
    // Drawn at its most likely position now (the cloud's center): its old light is often km away.
    ins.view.setBodies([
      { key: "ship", pos: { x: 0, y: 0, z: 0 }, q: c.q, size: c.size, color, g: c.g, minPx: 90, model: "frigate" },
      ...torps.map((t) => ({ key: `t${t.id}`, pos: sub(t.pos, ec.cloud.origin), q: t.q, size: t.size, color: t.side === "enemy" ? COLOR.torp : COLOR.ownTorp, g: t.g, minPx: 16 })),
    ]);
    ins.view.setArrows([
      { key: "los", from: { x: 0, y: 0, z: 0 }, dir: los, color: COLOR.roci, px: 70 },
      { key: "vel", from: { x: 0, y: 0, z: 0 }, dir: sub(c.vel, s.player.vel), color: 0xe3e8ee, px: 55 },
    ]);
    ins.view.setCloud(ec.cloud.points, ec.cloud.weights, color);
    const closing = -((c.vel.x - s.player.vel.x) * los.x + (c.vel.y - s.player.vel.y) * los.y + (c.vel.z - s.player.vel.z) * los.z);
    const nose = c.q ? keelDotLos(c.q, los) : 0;
    ins.label.innerHTML = `<b>${ec.name}</b> · ${fmtDist(range)} · ${c.g.toFixed(1)} g · ${closing >= 0 ? "closing" : "opening"} ${(Math.abs(closing) / 1000).toFixed(1)} km/s<br>`
      + `<span class="muted">nose ${nose > 0.95 ? "on you" : nose < -0.95 ? "away from you" : `${Math.round(Math.acos(Math.max(-1, Math.min(1, nose))) * 180 / Math.PI)}° off you`} · seen ${c.age.toFixed(1)} s ago · cloud ±${fmtDist(2 * ec.cloud.spread)}</span>`;
    ins.el.classList.toggle("selected", selected === ec.id);
  }
  for (const [id, ins] of insets) if (!live.has(id)) { ins.view.dispose(); ins.el.remove(); insets.delete(id); }
}

/** Cosine between a contact's keel and the line to the Roci (1 = pointed straight at us). */
function keelDotLos(q: { w: number; x: number; y: number; z: number }, los: Vec3): number {
  const kx = 1 - 2 * (q.y * q.y + q.z * q.z), ky = 2 * (q.x * q.y + q.w * q.z), kz = 2 * (q.x * q.z - q.w * q.y);
  return kx * los.x + ky * los.y + kz * los.z;
}

// ---------- Instant replays: ship kills, torpedoes shot down, near-misses ----------

const GAP_S = 0.5, AFTER_S = 2.5;
const actionView = new MiniView($("action-stage"));
const actionQueue: ActionClip[] = [];
let playing: { clip: ActionClip; start: number; plays: number } | null = null;

const clipColor = (b: ActionClip["shots"][number]["frames"][number]["bodies"][number]) =>
  b.kind === "slug" ? COLOR.slug : b.kind === "torpedo" ? (b.side === "enemy" ? COLOR.torp : COLOR.ownTorp) : b.side === "player" ? COLOR.roci : ENEMY_COLORS[b.slot] ?? ENEMY_COLORS[0];
const clipLength = (c: ActionClip) => c.shots.reduce((a, s) => a + s.playS + GAP_S, 0) + (c.destroyed ? AFTER_S : 0);

function playAction(clip: ActionClip) {
  playing = { clip, start: performance.now(), plays: 0 };
  $("action").hidden = false;
  $("action").classList.toggle("destroyed", clip.kind === "kill");
  $("action-title").textContent = clip.title;
  $("action-detail").textContent = clip.detail;
  // A kill is worth stopping for: drop warp so the fight doesn't run on while it plays.
  if (clip.kind === "kill") send({ type: "warp", level: 1 });
}
const nextAction = () => { const c = actionQueue.shift(); if (c) playAction(c); else { playing = null; $("action").hidden = true; } };
$("action-close").onclick = nextAction;
$("action-replay").onclick = () => { if (playing) { playing.start = performance.now(); playing.plays = 0; } };

function drawAction(now: number) {
  $("action-more").textContent = actionQueue.length ? `+${actionQueue.length} more` : "";
  if (!playing) return;
  const { clip } = playing;
  let el = (now - playing.start) / 1000;
  // Find the shot this moment falls in; past the last shot is the aftermath (held impact frame + debris).
  let shotIdx = 0;
  while (shotIdx < clip.shots.length && el > clip.shots[shotIdx].playS + GAP_S) { el -= clip.shots[shotIdx].playS + GAP_S; shotIdx++; }
  const after = shotIdx >= clip.shots.length;
  const shot = clip.shots[Math.min(shotIdx, clip.shots.length - 1)];
  const fi = after ? shot.frames.length - 1 : Math.min(shot.frames.length - 1, Math.floor((el / shot.playS) * shot.frames.length));
  const f = shot.frames[fi];
  actionView.look(shot.view, f.radius ?? shot.radius, true);
  const isImpact = shotIdx === clip.shots.length - 1 || after;
  actionView.setBodies(f.bodies.filter((b) => b.alive).map((b) => ({
    key: `${shotIdx}:${b.id}`, pos: b.pos, q: b.q, size: b.size, g: b.g, color: clipColor(b),
    minPx: b.kind === "ship" ? 34 : b.kind === "slug" ? 10 : 16,
    model: b.kind === "torpedo" ? "torpedo" : b.kind !== "ship" ? undefined : b.side === "player" ? "rocinante" : "frigate",
  })));
  // Tracks of everything that moved so far in this shot.
  const trails = new Map<number, { color: number; points: Vec3[] }>();
  for (let i = 0; i <= fi; i++) for (const b of shot.frames[i].bodies) {
    if (!b.alive) continue;
    const tr = trails.get(b.id) ?? { color: clipColor(b), points: [] };
    tr.points.push(b.pos);
    trails.set(b.id, tr);
  }
  actionView.setTrails([...trails].map(([id, t]) => ({ key: `${shotIdx}:${id}`, ...t })));
  actionView.setPdc(f.clouds);
  // Blast and debris from the moment of impact on; the aftermath lets the debris fly.
  const tEnd = shot.frames.at(-1)!.t;
  const k = after ? 1 + el / AFTER_S : isImpact && clip.flash && f.t >= clip.t ? (f.t - clip.t) / Math.max(1e-9, tEnd - clip.t) : -1;
  actionView.setFlash(k >= 0 && clip.flash ? clip.flash : null, shot.radius * (0.05 + 0.2 * Math.min(k, 1)), Math.max(0, 1 - Math.max(0, k - 1)));
  actionView.setDebris(k >= 0 && clip.destroyed && clip.flash ? clip.flash : null, shot.radius * 0.6 * k, Math.round(clip.t * 1000), Math.max(0.2, 1 - Math.max(0, k - 1) * 0.6));
  $("action-speed").textContent = after ? "Aftermath" : `${shotIdx + 1}/${clip.shots.length} · ${shot.label}`;
  actionView.render();
  // Two plays (a beat between), then the next replay if one is waiting.
  if ((now - playing.start) / 1000 > clipLength(clip) + 1) {
    playing.plays++;
    if (playing.plays >= 2 && actionQueue.length) nextAction();
    else if (playing.plays < 2) playing.start = now;
  }
}

function loop() {
  view.render();
  for (const ins of insets.values()) ins.view.render();
  drawAction(performance.now());
  requestAnimationFrame(loop);
}
resume();
loop();

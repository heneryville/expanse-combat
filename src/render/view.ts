import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { CloudView, ContactView, PdcView, ReplayFrame, Snapshot } from "../worker/protocol";
import type { Quat, Vec3 } from "../core/vec";
import { makePlume, updatePlume } from "./plume";
import { dressHull, HullModel, useEnvironment } from "./models";

const C = 299_792_458;
/** One color per enemy ship, by slot; used for its box, label and cloud. */
export const ENEMY_COLORS = [0xfb8a4c, 0xd77be8];
const enemyColor = (slot: number) => ENEMY_COLORS[slot] ?? COLORS.enemy;
const COLORS = { roci: 0x6cb4e4, enemy: 0xfb8a4c, torp: 0xf07a6c, ownTorp: 0x9fd3f5, pdc: 0xe3b049, ring: 0x6cb4e4, grid: 0x1c2733, truth: 0xe3e8ee, slug: 0xfff3a8 };

/** Soft round sprite shared by every point cloud. */
function dotTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

interface ContactObj { group: THREE.Group; box: THREE.Mesh; model?: HullModel; plume: THREE.Group; vel: THREE.ArrowHelper; drop: THREE.Line; foot: THREE.Mesh; label: CSS2DObject; el: HTMLDivElement }
// Minimum on-screen length of a contact's long axis, so attitude reads at any zoom.
const MIN_PX = { ship: 50, torpedo: 18 };

/**
 * The tactical scene. Positions are kept in float64 and re-centered on the focus point every frame,
 * so WebGL's float32 never has to hold arena-scale coordinates.
 */
export class TacticalView {
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  focus: Vec3 = { x: 0, y: 0, z: 0 };
  focusOn: "player" | number = "player";
  private tex = dotTexture();
  private contacts = new Map<string, ContactObj>();
  private grid = new THREE.Group();
  private rings: THREE.LineLoop[] = [];
  private ringLabels: CSS2DObject[] = [];
  private cloud: THREE.Points | null = null;
  private cloudLabel: CSS2DObject;
  private enemyClouds = new THREE.Group();
  private cloudRings: CSS2DObject[] = [];
  private pdc = new THREE.Group();
  private slugTrails = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.slug, transparent: true, opacity: 0.45, depthTest: false }));
  private slugLabels: CSS2DObject[] = [];
  private markers: THREE.Points;
  private planeZ = 0;
  private velLabel = new CSS2DObject(div("vec-label"));
  private lastSnap: Snapshot | null = null;
  onPickContact: (id: number | null) => void = () => {};
  onPlanePoint: (p: Vec3) => void = () => {};
  headingMode = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setClearColor(0x0b1016);
    host.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = "labels";
    host.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 1e13);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-2e9, -2.6e9, 1.6e9);
    this.controls = new OrbitControls(this.camera, this.labels.domElement);
    this.controls.minDistance = 80;
    this.controls.maxDistance = 5e10;
    this.controls.zoomSpeed = 1.6;
    this.controls.enableDamping = true;
    this.controls.mouseButtons.MIDDLE = null;
    this.tiltOnMiddleDrag(this.labels.domElement);

    this.scene.add(this.grid, this.pdc, this.enemyClouds);
    useEnvironment(this.renderer, this.scene);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, -0.6, 1.4);
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.9));
    for (let i = 0; i < 14; i++) {
      const ring = this.circle(COLORS.ring, 0.35);
      this.rings.push(ring);
      this.scene.add(ring);
      const el = div("ring-label");
      const lab = new CSS2DObject(el);
      this.ringLabels.push(lab);
      this.scene.add(lab);
    }
    this.cloudLabel = new CSS2DObject(div("cloud-label"));
    this.scene.add(this.cloudLabel);

    this.markers = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, map: this.tex, transparent: true, depthTest: false }));
    this.scene.add(this.slugTrails, this.markers, this.velLabel);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.labels.domElement.addEventListener("click", (e) => this.click(e));
  }

  /** Middle-drag changes only the camera's tilt above the plane, keeping heading and range. */
  private tiltOnMiddleDrag(el: HTMLElement): void {
    let lastY: number | null = null;
    el.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 1) return;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (lastY === null) return;
      const off = this.camera.position.clone().sub(this.controls.target);
      const s = new THREE.Spherical().setFromVector3(new THREE.Vector3(off.x, off.z, -off.y)); // z-up to y-up
      s.phi = THREE.MathUtils.clamp(s.phi - ((e.clientY - lastY) * 2 * Math.PI) / el.clientHeight, 0.01, Math.PI - 0.01);
      const v = new THREE.Vector3().setFromSpherical(s);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3(v.x, -v.z, v.y));
      lastY = e.clientY;
    });
    const end = (e: PointerEvent) => { if (e.button !== 1) return; lastY = null; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  resize(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private circle(color: number, opacity: number): THREE.LineLoop {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  /** World (float64) to render space (relative to focus). */
  private r(p: Vec3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(p.x - this.focus.x, p.y - this.focus.y, p.z - this.focus.z);
  }

  private contactObj(key: string, color: number, dashed = false, labelClass = "", model?: HullModel): ContactObj {
    let o = this.contacts.get(key);
    if (o) return o;
    const mat = dashed
      ? new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7 })
      : new THREE.MeshLambertMaterial({ color });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    if (!dashed && !model) box.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x0b1016 })));
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x93a0b0, dashSize: 1, gapSize: 1, transparent: true, opacity: 0.6 }));
    const foot = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0x93a0b0, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    const el = div(`contact-label ${labelClass}`);
    const label = new CSS2DObject(el);
    const group = new THREE.Group();
    group.add(box);
    const plume = makePlume();
    box.add(plume);
    const vel = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color);
    vel.visible = false;
    this.scene.add(group, vel, drop, foot, label);
    o = { group, box, model, plume, vel, drop, foot, label, el };
    this.contacts.set(key, o);
    return o;
  }

  private placeContact(o: ContactObj, pos: Vec3, q: Quat, size: [number, number, number], text: string, pxPerM: number, kind = "ship", vel?: Vec3, gNow?: number): void {
    updatePlume(o.plume, gNow);
    const p = this.r(pos);
    o.group.position.copy(p);
    o.box.quaternion.set(q.x, q.y, q.z, q.w);
    const k = Math.max(1, MIN_PX[kind === "torpedo" ? "torpedo" : "ship"] / (Math.max(...size) * pxPerM));
    o.box.scale.set(size[0] * k, size[1] * k, size[2] * k);
    if (o.model) (o.box.material as THREE.Material).visible = !dressHull(o.box, o.model, size, (o.box.material as THREE.MeshBasicMaterial).color.getHex());
    // Velocity arrow at a fixed screen length; direction only, the label carries the speed.
    const speed = vel ? Math.hypot(vel.x, vel.y, vel.z) : 0;
    o.vel.visible = speed > 0.01;
    if (vel && o.vel.visible) {
      const L = (kind === "torpedo" ? 50 : 90) / pxPerM;
      o.vel.position.copy(p);
      o.vel.setDirection(new THREE.Vector3(vel.x / speed, vel.y / speed, vel.z / speed));
      o.vel.setLength(L, 12 / pxPerM, 6 / pxPerM);
    }
    o.label.position.copy(p);
    setText(o.el, text);
    // Drop line to the reference plane; the foot ring is sized to stay visible at any zoom.
    const foot = new THREE.Vector3(p.x, p.y, this.planeZ - this.focus.z);
    const g = o.drop.geometry as THREE.BufferGeometry;
    g.setFromPoints([p, foot]);
    o.drop.computeLineDistances();
    const mat = o.drop.material as THREE.LineDashedMaterial;
    mat.dashSize = mat.gapSize = 4 / pxPerM;
    o.drop.visible = Math.abs(p.z - foot.z) * pxPerM > 2;
    o.foot.position.copy(foot);
    o.foot.scale.setScalar(5 / pxPerM);
    o.foot.visible = o.drop.visible;
  }

  private sweep(keep: Set<string>): void {
    for (const [k, o] of this.contacts) {
      if (keep.has(k)) continue;
      this.scene.remove(o.group, o.vel, o.drop, o.foot, o.label);
      this.contacts.delete(k);
    }
  }

  /** Metres per pixel at the focus distance. */
  private pxPerMetre(): number {
    const d = this.camera.position.length();
    const h = 2 * d * Math.tan((this.camera.fov * Math.PI) / 360);
    return this.host.clientHeight / h;
  }

  private drawGrid(pxPerM: number, center: Vec3): void {
    this.grid.clear();
    const span = 1 / pxPerM * this.host.clientWidth;
    const step = Math.pow(10, Math.floor(Math.log10(span / 8)));
    const n = 24;
    const g = new THREE.GridHelper(step * n, n, COLORS.grid, COLORS.grid);
    g.rotation.x = Math.PI / 2;
    // Snap the grid to multiples of its step so it doesn't swim as the focus moves.
    const cx = Math.round(center.x / step) * step, cy = Math.round(center.y / step) * step;
    g.position.copy(this.r({ x: cx, y: cy, z: this.planeZ }));
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.8;
    this.grid.add(g);
    this.gridStep = step;
  }
  gridStep = 1;

  private drawCloud(c: CloudView | null, color: number): void {
    if (this.cloud) { this.scene.remove(this.cloud); this.cloud.geometry.dispose(); this.cloud = null; }
    this.cloudLabel.visible = false;
    if (!c || c.points.length === 0) return;
    this.cloud = this.cloudPoints(c, color);
    this.scene.add(this.cloud);
    this.cloudLabel.position.copy(this.cloud.position);
    setText(this.cloudLabel.element, `cloud ${fmtDist(2 * c.spread)} · ${c.label}`);
    this.cloudLabel.visible = true;
  }

  /** Each enemy's now-cloud at true size, ringed at no less than 28 px so a metres-wide cloud still shows at Mm zoom. */
  private drawEnemyClouds(items: Snapshot["enemyClouds"], pxPerM: number): void {
    for (const ch of this.enemyClouds.children) (ch as THREE.Points).geometry.dispose();
    this.enemyClouds.clear();
    while (this.cloudRings.length < items.length) {
      const ring = new CSS2DObject(div("cloud-ring"));
      this.cloudRings.push(ring);
      this.scene.add(ring);
    }
    this.cloudRings.forEach((ring, i) => {
      const it = items[i];
      ring.visible = !!it;
      if (!it) return;
      const color = enemyColor(it.slot);
      if (it.cloud.points.length) this.enemyClouds.add(this.cloudPoints(it.cloud, color));
      ring.position.copy(this.r(it.cloud.origin));
      const px = Math.max(28, 4 * it.cloud.spread * pxPerM);
      const el = ring.element;
      el.style.width = el.style.height = `${px}px`;
      el.style.borderColor = el.style.color = hex(color);
      setText(el, `${it.name} now · ±${fmtDist(2 * it.cloud.spread)}`);
    });
  }

  private cloudPoints(c: CloudView, color: number): THREE.Points {
    const n = c.weights.length;
    const max = Math.max(...c.weights);
    const col = new Float32Array(n * 3);
    const base = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = (c.weights[i] / max) * 0.35;
      col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(c.points, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    // Blob size scales with the cloud itself, so it is drawn at true size and never inflated.
    const mat = new THREE.PointsMaterial({ size: Math.max(2, c.spread * 0.12), map: this.tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.copy(this.r(c.origin));
    return pts;
  }

  private drawPdc(clouds: PdcView[]): void {
    this.pdc.clear();
    for (const cl of clouds) {
      const n = 160, pts = new Float32Array(n * 3);
      let s = cl.id * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
      const ex = new THREE.Vector3(cl.dir.x, cl.dir.y, cl.dir.z);
      const ey = new THREE.Vector3().crossVectors(ex, Math.abs(ex.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const ez = new THREE.Vector3().crossVectors(ex, ey);
      for (let i = 0; i < n; i++) {
        const v = ex.clone().multiplyScalar(gauss() * cl.sl).addScaledVector(ey, gauss() * cl.st).addScaledVector(ez, gauss() * cl.st);
        pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: COLORS.pdc, size: Math.max(0.5, cl.st * 0.3), map: this.tex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      p.position.copy(this.r(cl.center));
      this.pdc.add(p);
    }
  }

  private drawMarkers(items: { pos: Vec3; color: number }[]): void {
    const pos = new Float32Array(items.length * 3), col = new Float32Array(items.length * 3);
    const v = new THREE.Vector3(), c = new THREE.Color();
    items.forEach((it, i) => {
      this.r(it.pos, v);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(it.color);
      col.set([c.r, c.g, c.b], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.markers.geometry.dispose();
    this.markers.geometry = g;
  }

  /** Slug labels, plus a tracer back to the muzzle where that is known. */
  private drawSlugs(items: { pos: Vec3; from?: Vec3; text: string }[]): void {
    const seg: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const it of items) if (it.from) { this.r(it.from, a); this.r(it.pos, b); seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    this.slugTrails.geometry.dispose();
    this.slugTrails.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    while (this.slugLabels.length < items.length) {
      const lab = new CSS2DObject(div("slug-label"));
      this.slugLabels.push(lab);
      this.scene.add(lab);
    }
    this.slugLabels.forEach((lab, i) => {
      lab.visible = i < items.length;
      if (!lab.visible) return;
      lab.position.copy(this.r(items[i].pos));
      setText(lab.element, items[i].text);
    });
  }

  /** Draw what the player knows right now. */
  update(s: Snapshot): void {
    this.lastSnap = s;
    const me = s.player;
    this.planeZ = me.pos.z;
    if (this.focusOn === "player") this.focus = me.pos;
    else {
      const c = s.contacts.find((x) => x.id === this.focusOn);
      if (s.selected?.id === this.focusOn && s.selected.cloud) this.focus = s.selected.cloud.origin;
      else if (c) this.focus = c.pos;
    }
    const pxPerM = this.pxPerMetre();
    this.drawGrid(pxPerM, me.pos);
    const keep = new Set<string>();

    const roci = this.contactObj("me", COLORS.roci, false, "", "rocinante");
    keep.add("me");
    this.placeContact(roci, me.pos, me.q, me.size, `ROCINANTE · ${me.g.toFixed(1)} g`, pxPerM, "ship", me.vel, me.g);
    const p0 = this.r(me.pos), L = 90 / pxPerM;
    const speed = Math.hypot(me.vel.x, me.vel.y, me.vel.z);
    this.velLabel.visible = roci.vel.visible;
    if (speed > 0.01) this.velLabel.position.copy(p0.clone().addScaledVector(new THREE.Vector3(me.vel.x, me.vel.y, me.vel.z).normalize(), L));
    setText(this.velLabel.element, `v ${fmtSpeed(speed)}`);
    const markers: { pos: Vec3; color: number }[] = [{ pos: me.pos, color: COLORS.roci }];
    this.markers.renderOrder = 10;
    for (const c of s.contacts) {
      const key = `c${c.id}`;
      keep.add(key);
      const color = c.kind === "torpedo" ? (c.side === "enemy" ? COLORS.torp : COLORS.ownTorp) : enemyColor(c.slot);
      const o = this.contactObj(key, color, true, "", c.kind === "ship" ? "frigate" : "torpedo");
      this.placeContact(o, c.pos, c.q, c.size, contactText(c, s.selected?.id === c.id), pxPerM, c.kind, c.vel, c.g);
      o.el.classList.toggle("selected", s.selected?.id === c.id);
      o.el.dataset.id = String(c.id);
      o.el.classList.toggle("torp", c.kind === "torpedo");
      if (c.kind === "ship") o.el.style.color = hex(color);
      markers.push({ pos: c.pos, color });
    }
    for (const sl of s.ownSlugs) markers.push({ pos: sl.pos, color: COLORS.slug });
    this.drawMarkers(markers);
    this.sweep(keep);
    this.drawSlugs(s.ownSlugs.map((sl) => ({ pos: sl.pos, from: sl.from, text: `SLUG · ${sl.age.toFixed(0)} s · ${fmtDist(Math.hypot(sl.pos.x - sl.from.x, sl.pos.y - sl.from.y, sl.pos.z - sl.from.z))} out` })));

    // Static range rings around the ship, one every 2 light-seconds.
    this.rings.forEach((loop, i) => {
      const lab = this.ringLabels[i];
      const ls = 2 * (i + 1), rad = ls * C;
      loop.visible = lab.visible = i < 8;
      if (!loop.visible) return;
      loop.position.copy(this.r({ ...me.pos, z: this.planeZ }));
      loop.scale.setScalar(rad);
      (loop.material as THREE.LineBasicMaterial).opacity = 0.28;
      lab.position.copy(this.r({ x: me.pos.x + rad * 0.707, y: me.pos.y + rad * 0.707, z: this.planeZ }));
      setText(lab.element, `${ls} ls · ${fmtDist(ls * C)}`);
    });

    this.drawEnemyClouds(s.enemyClouds, pxPerM);
    // An unaimed ship selection is the same as its now-cloud; only draw the selected cloud when it adds something.
    const sel = s.contacts.find((c) => c.id === s.selected?.id);
    const extra = sel && (sel.kind !== "ship" || (s.selected?.arrivalS ?? null) !== null);
    this.drawCloud(extra ? s.selected!.cloud : null, sel ? enemyColor(sel.slot) : COLORS.enemy);
    this.drawPdc(s.ownClouds);
  }

  /** Draw a truth-replay frame: true positions next to what each side saw. */
  updateReplay(f: ReplayFrame): void {
    const me = f.truth.find((x) => x.side === "player" && x.kind === "ship")!;
    this.planeZ = me.pos.z;
    if (this.focusOn === "player") this.focus = me.pos;
    const pxPerM = this.pxPerMetre();
    this.drawGrid(pxPerM, me.pos);
    const keep = new Set<string>();
    const markers: { pos: Vec3; color: number }[] = [];
    for (const b of f.truth) {
      if (!b.alive) continue;
      const key = `t${b.id}`;
      keep.add(key);
      const color = b.side === "player" ? COLORS.roci : b.kind === "torpedo" ? COLORS.torp : COLORS.enemy;
      const model = b.kind === "torpedo" ? "torpedo" : b.kind !== "ship" ? undefined : b.side === "player" ? "rocinante" : "frigate";
      this.placeContact(this.contactObj(key, color, false, "", model), b.pos, b.q, b.size, b.kind === "ship" ? `${b.side === "player" ? "ROCINANTE" : "FRIGATE"} (truth)` : "", pxPerM, b.kind);
      markers.push({ pos: b.pos, color });
    }
    for (const c of f.playerSaw) {
      const key = `p${c.id}`;
      keep.add(key);
      this.placeContact(this.contactObj(key, 0xb79cff, true, "saw"), c.pos, c.q, c.size, c.kind === "ship" ? `you saw · ${c.age.toFixed(1)} s old` : "", pxPerM, c.kind, c.vel);
      markers.push({ pos: c.pos, color: 0xb79cff });
    }
    for (const c of f.enemySaw) {
      if (c.kind !== "ship") continue;
      const key = `e${c.id}`;
      keep.add(key);
      this.placeContact(this.contactObj(key, 0x5cc48a, true, "enemy-saw"), c.pos, c.q, c.size, `enemy saw you · ${c.age.toFixed(1)} s old`, pxPerM, c.kind, c.vel);
      markers.push({ pos: c.pos, color: 0x5cc48a });
    }
    for (const x of f.slugs) markers.push({ pos: x, color: COLORS.slug });
    this.drawMarkers(markers);
    this.sweep(keep);
    this.drawSlugs(f.slugs.map((x) => ({ pos: x, text: "SLUG" })));
    this.velLabel.visible = false;
    setText(this.velLabel.element, "");
    for (const r of this.rings) r.visible = false;
    for (const l of this.ringLabels) l.visible = false;
    this.drawCloud(f.shot?.cloud ?? null, 0xb79cff);
    this.drawEnemyClouds([], 0);
    this.drawPdc(f.clouds);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  private click(e: MouseEvent): void {
    const s = this.lastSnap;
    if (!s) return;
    const labelHit = (e.target as HTMLElement).closest?.(".contact-label") as HTMLElement | null;
    if (labelHit?.dataset.id && !this.headingMode) { this.onPickContact(Number(labelHit.dataset.id)); return; }
    const rect = this.labels.domElement.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (this.headingMode) {
      // Intersect the click ray with the reference plane.
      const ndc = new THREE.Vector2((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(this.planeZ - this.focus.z));
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) this.onPlanePoint({ x: hit.x + this.focus.x, y: hit.y + this.focus.y, z: this.planeZ });
      return;
    }
    let best: ContactView | null = null, bestD = 18;
    for (const c of s.contacts) {
      const p = this.r(c.pos).project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - mx, sy - my);
      if (p.z < 1 && d < bestD) { best = c; bestD = d; }
    }
    this.onPickContact(best ? best.id : null);
  }
}

/** Label element; the text sits in an inner span because CSS2DRenderer owns the outer element's transform. */
function div(cls: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  d.appendChild(document.createElement("span"));
  return d;
}
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const setText = (el: Element, text: string) => { (el.firstChild as HTMLElement).textContent = text; };

export function fmtDist(m: number): string {
  if (m >= 1e9) return `${(m / 1e9).toFixed(2)}M km`;
  if (m >= 1e6) return `${(m / 1e3).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  if (m >= 1e3) return `${(m / 1e3).toFixed(1)} km`;
  return `${m.toFixed(m < 10 ? 1 : 0)} m`;
}

const fmtSpeed = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(2)} km/s` : `${v.toFixed(0)} m/s`;

function contactText(c: ContactView, selected: boolean): string {
  const name = c.kind === "ship" ? c.name.toUpperCase() : c.side === "enemy" ? "TORPEDO" : "your torpedo";
  const age = `seen ${c.age.toFixed(1)} s ago`;
  // Torpedo labels only when selected; their markers carry them otherwise.
  const v = fmtSpeed(Math.hypot(c.vel.x, c.vel.y, c.vel.z));
  return c.kind === "ship" || selected ? `${name} · ${age} · ${c.g.toFixed(1)} g · v ${v}` : "";
}

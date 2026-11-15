import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Quat, Vec3 } from "../core/vec";
import type { PdcView } from "../worker/protocol";
import { makePlume, updatePlume } from "./plume";
import { dressHull, HullModel, useEnvironment } from "./models";

export interface MiniBody { key: string; pos: Vec3; q: Quat; size: [number, number, number]; color: number; g?: number; minPx?: number; model?: HullModel }
export interface MiniArrow { key: string; from: Vec3; dir: Vec3; color: number; px: number }
export interface MiniTrail { key: string; points: Vec3[]; color: number }

/** A hull in a unit box: block body, pointed nose at +x and a dark drive bell at -x, so attitude reads at a glance. */
function makeHull(color: number): THREE.Group {
  const mat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 1), mat);
  body.position.x = -0.14;
  const noseGeo = new THREE.ConeGeometry(0.62, 0.28, 4);
  noseGeo.rotateZ(-Math.PI / 2); // apex to +x
  noseGeo.rotateX(Math.PI / 4); // square base lines up with the body's faces
  const nose = new THREE.Mesh(noseGeo, mat);
  nose.position.x = 0.36;
  const bellGeo = new THREE.CylinderGeometry(0.28, 0.4, 0.1, 16);
  bellGeo.rotateZ(Math.PI / 2);
  const bell = new THREE.Mesh(bellGeo, new THREE.MeshLambertMaterial({ color: 0x2a3440 }));
  bell.position.x = -0.55;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x0b1016 }));
  edges.position.copy(body.position);
  const hull = new THREE.Group();
  hull.add(body, nose, bell, edges);
  return hull;
}

/**
 * A small 3D view of one spot: its own scene centered on that spot, so coordinates stay small and float32-safe
 * however far it is from the Roci. Drag to orbit; the framing distance still follows `look`.
 */
export class MiniView {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1e9);
  private controls: OrbitControls;
  private bodies = new Map<string, { hull: THREE.Group; plume: THREE.Group }>();
  private arrows = new Map<string, THREE.ArrowHelper>();
  private trails = new Map<string, THREE.Line>();
  private cloud: THREE.Points | null = null;
  private pdc = new THREE.Group();
  private debris: THREE.Points;
  private flash: THREE.Mesh;
  private dist = 100;
  private userTurned = false;
  /** True if the last pointer press turned the view, so the click that ends it isn't a selection. */
  dragged = false;

  constructor(private host: HTMLElement) {
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setClearColor(0x080c11);
    host.appendChild(this.renderer.domElement);
    useEnvironment(this.renderer, this.scene);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(1, -0.6, 1.4);
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.8), this.pdc);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.visible = false;
    this.debris = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffc27a, size: 3, sizeAttenuation: false, transparent: true }));
    this.debris.visible = false;
    this.scene.add(this.flash, this.debris);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    let down: { x: number; y: number } | null = null;
    this.renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; this.dragged = false; });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) { this.dragged = true; this.userTurned = true; }
    });
    addEventListener("pointerup", () => { down = null; });
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  private resize(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Frame a sphere of `radius` at the center, looking from `from` unless the user has turned the view. */
  look(from: Vec3, radius: number, reset = false): void {
    if (reset) this.userTurned = false;
    this.dist = (radius / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.15;
    const cur = this.camera.position.clone();
    const dir = this.userTurned && cur.lengthSq() > 0 ? cur.normalize() : new THREE.Vector3(from.x, from.y, from.z).normalize();
    this.camera.position.copy(dir.multiplyScalar(this.dist));
    this.camera.near = this.dist / 1000;
    this.camera.far = this.dist * 1000;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
  }

  pxPerM(): number {
    return this.host.clientHeight / (2 * this.dist * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  /** Bodies drawn at true size, but never smaller than minPx on screen so their attitude still reads. */
  setBodies(list: MiniBody[]): void {
    const keep = new Set<string>(), ppm = this.pxPerM();
    for (const b of list) {
      keep.add(b.key);
      let o = this.bodies.get(b.key);
      if (!o) {
        const hull = makeHull(b.color), plume = makePlume();
        plume.position.x = -0.6;
        hull.add(plume);
        this.scene.add(hull);
        this.bodies.set(b.key, (o = { hull, plume }));
      }
      const k = Math.max(1, (b.minPx ?? 14) / (Math.max(...b.size) * ppm));
      o.hull.position.set(b.pos.x, b.pos.y, b.pos.z);
      o.hull.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);
      o.hull.scale.set(b.size[0] * k, b.size[1] * k, b.size[2] * k);
      if (b.model && dressHull(o.hull, b.model, b.size, b.color)) for (const ch of o.hull.children) ch.visible = ch === o.plume || ch === o.hull.userData.model;
      updatePlume(o.plume, b.g);
    }
    for (const [k, o] of this.bodies) if (!keep.has(k)) { this.scene.remove(o.hull); this.bodies.delete(k); }
  }

  /** Arrows of fixed screen length (direction only). */
  setArrows(list: MiniArrow[]): void {
    const keep = new Set<string>(), ppm = this.pxPerM();
    for (const a of list) {
      const n = Math.hypot(a.dir.x, a.dir.y, a.dir.z);
      if (n < 1e-9) continue;
      keep.add(a.key);
      let o = this.arrows.get(a.key);
      if (!o) { o = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, a.color); this.scene.add(o); this.arrows.set(a.key, o); }
      o.position.set(a.from.x, a.from.y, a.from.z);
      o.setDirection(new THREE.Vector3(a.dir.x / n, a.dir.y / n, a.dir.z / n));
      o.setLength(a.px / ppm, 10 / ppm, 6 / ppm);
    }
    for (const [k, o] of this.arrows) if (!keep.has(k)) { this.scene.remove(o); this.arrows.delete(k); }
  }

  setTrails(list: MiniTrail[]): void {
    const keep = new Set<string>();
    for (const t of list) {
      if (t.points.length < 2) continue;
      keep.add(t.key);
      let o = this.trails.get(t.key);
      if (!o) { o = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: t.color, transparent: true, opacity: 0.55 })); this.scene.add(o); this.trails.set(t.key, o); }
      o.geometry.dispose();
      o.geometry = new THREE.BufferGeometry().setFromPoints(t.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    }
    for (const [k, o] of this.trails) if (!keep.has(k)) { this.scene.remove(o); o.geometry.dispose(); this.trails.delete(k); }
  }

  /** A point cloud already relative to the view center (e.g. a contact's now-cloud). */
  setCloud(points: Float32Array | null, weights: Float32Array | null, color: number): void {
    if (this.cloud) { this.scene.remove(this.cloud); this.cloud.geometry.dispose(); this.cloud = null; }
    if (!points || !weights || !weights.length) return;
    const n = weights.length, max = Math.max(...weights), base = new THREE.Color(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 0.25 + 0.75 * (weights[i] / max); col.set([base.r * k, base.g * k, base.b * k], i * 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
    this.scene.add(this.cloud);
  }

  /** PDC round streams as Gaussian point clouds along their direction. */
  setPdc(list: PdcView[]): void {
    for (const ch of this.pdc.children) (ch as THREE.Points).geometry.dispose();
    this.pdc.clear();
    for (const cl of list) {
      const n = 220, pts = new Float32Array(n * 3);
      let s = cl.id * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
      const ex = new THREE.Vector3(cl.dir.x, cl.dir.y, cl.dir.z);
      const ey = new THREE.Vector3().crossVectors(ex, Math.abs(ex.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const ez = new THREE.Vector3().crossVectors(ex, ey);
      for (let i = 0; i < n; i++) {
        const v = ex.clone().multiplyScalar(gauss() * cl.sl).addScaledVector(ey, gauss() * cl.st).addScaledVector(ez, gauss() * cl.st);
        pts.set([cl.center.x + v.x, cl.center.y + v.y, cl.center.z + v.z], i * 3);
      }
      const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pts, 3));
      this.pdc.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe3b049, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
    }
  }

  /** A blast sphere; null hides it. */
  setFlash(pos: Vec3 | null, radius: number, opacity = 1): void {
    this.flash.visible = !!pos;
    if (!pos) return;
    this.flash.position.set(pos.x, pos.y, pos.z);
    this.flash.scale.setScalar(radius);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = opacity;
  }

  /** Fragments flying out from `pos`; `spread` is how far they've got, `seed` keeps the pattern fixed per kill. */
  setDebris(pos: Vec3 | null, spread: number, seed: number, opacity = 1): void {
    this.debris.visible = !!pos;
    if (!pos) return;
    let s = seed % 233280;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const n = 160, pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = spread * (0.3 + 0.7 * rnd()), w = Math.sqrt(1 - u * u);
      pts.set([pos.x + r * w * Math.cos(a), pos.y + r * w * Math.sin(a), pos.z + r * u], i * 3);
    }
    this.debris.geometry.dispose();
    this.debris.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pts, 3));
    (this.debris.material as THREE.PointsMaterial).opacity = opacity;
  }

  render(): void { this.renderer.render(this.scene, this.camera); }

  dispose(): void { this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

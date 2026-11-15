import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type HullModel = "rocinante" | "frigate" | "torpedo";

// Each file's glTF axes mapped onto the hull frame (nose +x, dorsal +z), as basis columns for glTF x, y, z.
const SOURCES: Record<Exclude<HullModel, "torpedo">, { url: string; basis: [number, number, number][]; paint?: number }> = {
  rocinante: { url: "models/rocinante.glb", basis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] }, // MCRN Tachi by Jakub.Vildomec, CC-BY
  // Corvette Class Light Frigate by wintermute666, CC-BY-NC-SA; repainted so it can't be mistaken for the Roci.
  frigate: { url: "models/frigate.glb", basis: [[0, -1, 0], [0, 0, 1], [-1, 0, 0]], paint: 0x2a5bd7 },
};

const templates = new Map<HullModel, THREE.Object3D>();

/** Each model centered, turned into the hull frame and scaled to unit length along x. */
function normalize(scene: THREE.Object3D, basis: [number, number, number][]): THREE.Object3D {
  const [a, b, c] = basis.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  scene.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c));
  const fit = new THREE.Group();
  fit.add(scene);
  fit.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const len = box.max.x - box.min.x;
  scene.position.copy(box.getCenter(new THREE.Vector3()).negate());
  fit.scale.setScalar(1 / len);
  const root = new THREE.Group();
  root.add(fit);
  return root;
}

/** Gunmetal hull with the texture's painted (saturated) areas recolored to `paint`, keeping their shading. */
function repaint(root: THREE.Object3D, paint: number): void {
  const c = new THREE.Color(paint);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = (o.material as THREE.MeshStandardMaterial).clone();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPaint = { value: c };
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", "uniform vec3 uPaint;\nvoid main() {")
        .replace("#include <map_fragment>", `#include <map_fragment>
          vec3 col = diffuseColor.rgb;
          float hi = max(col.r, max(col.g, col.b)), sat = hi - min(col.r, min(col.g, col.b));
          vec3 metal = vec3(dot(col, vec3(0.299, 0.587, 0.114))) * vec3(0.82, 0.88, 0.95);
          diffuseColor.rgb = mix(metal, uPaint * hi, smoothstep(0.12, 0.3, sat));`);
    };
    m.customProgramCacheKey = () => "repaint";
    o.material = m;
  });
}

/** A torpedo at unit length, nose +x: ogive warhead with a side-colored band, slim body, fins and a drive bell. */
function makeTorpedo(): THREE.Object3D {
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3138, metalness: 0.6, roughness: 0.6 });
  const band = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.5 });
  band.name = "band";
  const R = 0.075;
  // Lathe profiles are (radius, axial) pairs around +y; turned onto +x below.
  const lathe = (pts: [number, number][], mat: THREE.Material) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24);
    g.rotateZ(-Math.PI / 2);
    return new THREE.Mesh(g, mat);
  };
  const nose: [number, number][] = [[R, 0.3]];
  for (let i = 1; i <= 8; i++) { const u = i / 8; nose.push([R * Math.sqrt(1 - u * u) + 0.004 * u, 0.3 + 0.2 * u]); }
  nose.push([0, 0.5]);
  const root = new THREE.Group();
  root.add(
    lathe([[0, -0.36], [R, -0.36], [R, 0.22]], metal),
    lathe([[R * 1.01, 0.22], [R * 1.01, 0.3]], band),
    lathe(nose, metal),
    lathe([[R, -0.36], [R * 0.7, -0.42], [R * 0.55, -0.44]], dark),
    lathe([[R * 0.45, -0.43], [R * 0.95, -0.5], [R * 0.85, -0.5], [R * 0.4, -0.44]], dark),
  );
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.06), dark);
    fin.position.set(-0.27, 0, R + 0.03);
    const arm = new THREE.Group();
    arm.rotation.x = (k * Math.PI) / 2 + Math.PI / 4;
    arm.add(fin);
    root.add(arm);
  }
  return root;
}

export const modelsReady: Promise<void> = (() => {
  templates.set("torpedo", makeTorpedo());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all((Object.keys(SOURCES) as Exclude<HullModel, "torpedo">[]).map(async (k) => {
    const gltf = await loader.loadAsync(import.meta.env.BASE_URL + SOURCES[k].url);
    const { basis, paint } = SOURCES[k];
    if (paint !== undefined) repaint(gltf.scene, paint);
    templates.set(k, normalize(gltf.scene, basis));
  })).then(() => undefined);
})();

/**
 * Puts the model inside a unit-box hull its owner scales to `size`, undoing the box's squash so the model keeps
 * its own proportions. False until the model has loaded.
 */
export function dressHull(box: THREE.Object3D, kind: HullModel, size: [number, number, number], tint?: number): boolean {
  let m = box.userData.model as THREE.Object3D | undefined;
  if (!m) {
    const t = templates.get(kind);
    if (!t) return false;
    box.userData.model = m = t.clone();
    box.add(m);
    // Clones share materials; the band gets its own so each side can color it.
    if (tint !== undefined) m.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material.name === "band") { o.material = o.material.clone(); o.material.color.set(tint); }
    });
  }
  m.scale.set(1, size[0] / size[1], size[0] / size[2]);
  return true;
}

/** Reflections for the models' metal; without them PBR metal renders near-black. */
export function useEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

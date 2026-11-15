import * as THREE from "three";
import { gTier } from "../ui/gtiers";

/** A drive plume for a hull drawn as a unit box (scaled to the ship): base at the stern, trailing aft. */
export function makePlume(): THREE.Group {
  const cone = (r: number, opacity: number) => {
    const geo = new THREE.ConeGeometry(r, 1, 24, 1, true);
    geo.rotateZ(Math.PI / 2); // apex from +y to -x
    geo.translate(-0.5, 0, 0); // base at x=0, apex at x=-1
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  };
  const plume = new THREE.Group();
  plume.add(cone(0.5, 0.45), cone(0.22, 0.8));
  plume.position.x = -0.5;
  plume.visible = false;
  return plume;
}

/** Longer, wider and hotter-colored with more g; the color matches the g-selector's crew-risk tiers. */
export function updatePlume(plume: THREE.Group, g: number | undefined): void {
  plume.visible = g !== undefined && g > 0.05;
  if (!plume.visible) return;
  const f = Math.min(g!, 15) / 15;
  plume.scale.set(0.35 + 1.9 * f, 0.55 + 0.5 * f, 0.55 + 0.5 * f);
  const [outer, core] = plume.children as THREE.Mesh[];
  (outer.material as THREE.MeshBasicMaterial).color.set(gTier(g!).color);
  (core.material as THREE.MeshBasicMaterial).color.set(0xffffff).lerp(new THREE.Color(gTier(g!).color), 0.35);
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

// CC0 Poly Haven props (decimated by tools/blender/optimize_polyhaven.py).
const FILES = [
  'fire_hydrant', 'metal_trash_can', 'utility_box_01', 'modular_fire_escape', 'water_manhole_cover',
  'exterior_aircon_unit', 'concrete_road_barrier_02', 'covered_car', 'cardboard_box_01', 'wooden_crate_01',
  'trashbag', 'Barrel_01', 'old_tyre', 'WetFloorSign_01',
];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

/**
 * Loads the prop GLBs once, flattens each into parts (geometry + material +
 * local matrix, feet at y=0), and places them either as per-segment instanced
 * decor (cheap) or as individual groups (for obstacles that can be smashed).
 */
export class PropLibrary {
  constructor() {
    this.props = {};
    this.ready = false;
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all(FILES.map((name) => loader.loadAsync(`assets/models/${name}.glb`).then((gltf) => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const lift = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const parts = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.userData.shared = true;
        o.material.envMapIntensity = 0.9;
        parts.push({ geometry: o.geometry, material: o.material, matrix: lift.clone().multiply(o.matrixWorld) });
      });
      const size = box.getSize(new THREE.Vector3());
      this.props[name] = { parts, size };
    }).catch(() => {}).finally(() => onProgress?.(++done / FILES.length))));
    this.ready = Object.keys(this.props).length > 0;
  }

  has(name) {
    return !!this.props[name];
  }

  size(name) {
    return this.props[name]?.size;
  }

  /** A standalone group (shares geometry) — for obstacles that get flung. */
  group(name, scale = 1) {
    const p = this.props[name];
    const g = new THREE.Group();
    if (!p) return g;
    for (const part of p.parts) {
      const m = new THREE.Mesh(part.geometry, part.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(part.matrix);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.scale.setScalar(scale);
    return g;
  }

  /** Queue instanced decor for a segment. */
  place(seg, name, x, y, z, ry = 0, scale = 1) {
    if (!this.props[name]) return;
    seg.decor ??= {};
    (seg.decor[name] ??= []).push([x, y, z, ry, scale]);
  }

  /** Turn queued decor into one InstancedMesh per prop part. */
  flush(seg) {
    if (!seg.decor) return;
    for (const [name, list] of Object.entries(seg.decor)) {
      const p = this.props[name];
      for (const part of p.parts) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach(([x, y, z, ry, sc], i) => {
          _e.set(0, ry, 0);
          _q.setFromEuler(_e);
          _s.setScalar(sc);
          _p.set(x, y, z);
          _m.compose(_p, _q, _s).multiply(part.matrix);
          inst.setMatrixAt(i, _m);
        });
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        seg.group.add(inst);
      }
    }
    seg.decor = null;
  }
}

export { LAYER_NO_OUTLINE };

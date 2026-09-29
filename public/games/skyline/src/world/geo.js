import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

// Shared primitive geometries (unit sized) reused by every builder.
export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cylLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  sphere: new THREE.SphereGeometry(0.5, 16, 10),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(0.5, 0.12, 8, 20),
};

export function mat4(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/**
 * Collects many small geometries per material key and merges them into one
 * mesh per key, keeping draw calls low for whole city blocks.
 */
export class Buckets {
  constructor() {
    this.map = new Map();
  }

  add(key, geometry, matrix, color, scaleColor = 1) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r * scaleColor;
      col[i * 3 + 1] = _c.g * scaleColor;
      col[i * 3 + 2] = _c.b * scaleColor;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    let list = this.map.get(key);
    if (!list) this.map.set(key, (list = []));
    list.push(g);
    return g;
  }

  /** Shorthand: box at centre with size, optional rotation. */
  box(key, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0, glowScale = 1) {
    return this.add(key, PRIM.box, mat4(x, y, z, sx, sy, sz, rx, ry, rz), color, glowScale);
  }

  cyl(key, x, y, z, r, h, color, rx = 0, ry = 0, rz = 0, low = false, glowScale = 1) {
    return this.add(key, low ? PRIM.cylLow : PRIM.cyl, mat4(x, y, z, r * 2, h, r * 2, rx, ry, rz), color, glowScale);
  }

  /**
   * Building block with a window-atlas UV mapping on the sides and a plain
   * wall UV on top/bottom. cellW/cellH are metres per window cell.
   */
  building(key, x, y0, z, w, h, d, color, cellW = 3.2, cellH = 3.6) {
    const g = PRIM.box.toNonIndexed();
    g.applyMatrix4(mat4(x, y0 + h / 2, z, w, h, d));
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    const rep = 8; // atlas holds 8x8 cells
    for (let i = 0; i < pos.count; i++) {
      const nx = nor.getX(i);
      const ny = nor.getY(i);
      const px = pos.getX(i);
      const py = pos.getY(i) - y0;
      const pz = pos.getZ(i);
      if (Math.abs(ny) > 0.5) {
        uv[i * 2] = 0.003;
        uv[i * 2 + 1] = 0.003;
      } else {
        const horiz = Math.abs(nx) > 0.5 ? pz : px;
        uv[i * 2] = horiz / (cellW * rep);
        uv[i * 2 + 1] = py / (cellH * rep);
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const col = new Float32Array(pos.count * 3);
    _c.set(color);
    for (let i = 0; i < pos.count; i++) {
      // Roofs a touch darker than walls; street level darker (fake ambient occlusion).
      const py = pos.getY(i) - y0;
      const k = Math.abs(nor.getY(i)) > 0.5 ? 0.7 : 0.62 + 0.38 * Math.min(1, py / 16);
      col[i * 3] = _c.r * k;
      col[i * 3 + 1] = _c.g * k;
      col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    let list = this.map.get(key);
    if (!list) this.map.set(key, (list = []));
    list.push(g);
  }

  /** Flat textured quad (floor / wall) with metre-based tiling. */
  quad(key, x, y, z, w, h, rx, ry, rz, tileW, tileH, color = 0xffffff) {
    const g = PRIM.plane.clone();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (tileW ? w / tileW : 1), uv.getY(i) * (tileH ? h / tileH : 1));
    }
    this.add(key, g, mat4(x, y, z, w, h, 1, rx, ry, rz), color);
  }

  build(materials, parent, shadowKeys = new Set(), receiveKeys = new Set()) {
    const meshes = [];
    for (const [key, list] of this.map) {
      const mat = materials[key];
      if (!mat || !list.length) continue;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadowKeys.has(key);
      mesh.receiveShadow = receiveKeys.has(key) || shadowKeys.has(key);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.map.clear();
    return meshes;
  }
}

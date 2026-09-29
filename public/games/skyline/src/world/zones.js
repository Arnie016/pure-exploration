import * as THREE from 'three';
import { CFG } from '../config.js';
import { Buckets } from './geo.js';
import * as PR from './props.js';
import { glow, PALETTE as P } from '../render/materials.js';
import { textures } from '../render/textures.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

let PROPS = null;
/** Hook up the loaded Poly Haven prop library (decor + model obstacles). */
export function setPropLibrary(lib) {
  PROPS = lib && lib.ready ? lib : null;
}
const prop = (seg, name, x, y, z, ry = 0, sc = 1) => PROPS?.place(seg, name, x, y, z, ry, sc);

const W = CFG.corridorHalf;
const LW = CFG.laneWidth;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

const towerFn = (...a) => tower(...a);
const BRICK_COLS = [0xff8a7a, 0xffc36b, 0xf2a0c8, 0xe8d2b0, 0xff9f5a, 0xd9b8ff, 0x9fe3c9, 0xc8583f];
const GLASS_COLS = [0x9fdcff, 0xb8b0ff, 0x8ff0d8, 0xffd0f0, 0xd6e4ff, 0x7fc8ff];
const TRAIN_STRIPES = [0xff3fa4, 0x19d3b5, 0xff9a2e, 0x7b4dff, 0x3fc7ff];

export function createWorldMaterials() {
  const T = textures();
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const mats = {
    bldBrick: std({ map: T.brick.map, emissiveMap: T.brick.glow, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.86 }),
    bldGlass: std({ map: T.glass.map, emissiveMap: T.glass.glow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.16, metalness: 0.5 }),
    solid: std({ roughness: 0.6 }),
    metal: std({ roughness: 0.3, metalness: 0.82 }),
    glowV: new THREE.MeshBasicMaterial({ vertexColors: true }),
    asphalt: std({ map: T.asphalt, roughness: 0.22, metalness: 0.2 }),
    roof: std({ map: T.roof, roughness: 0.92 }),
    track: std({ map: T.track, roughness: 0.95 }),
    tiles: std({ map: T.tiles, roughness: 0.3 }),
    concrete: std({ roughness: 0.88 }),
    sign: new THREE.MeshBasicMaterial({ color: new THREE.Color(P.butter).multiplyScalar(3), side: THREE.DoubleSide }),
  };
  T.ads.forEach((t, i) => {
    mats[`ad${i}`] = std({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.45 });
  });
  T.graffiti.forEach((t, i) => {
    mats[`graf${i}`] = std({ map: t, alphaTest: 0.5, roughness: 0.8 });
  });
  return mats;
}

const SHADOW_KEYS = new Set(['bldBrick', 'bldGlass', 'solid', 'metal']);
const RECEIVE_KEYS = new Set(['asphalt', 'roof', 'track', 'tiles', 'concrete']);

function finish(B, mats, parent) {
  const meshes = B.build(mats, parent, SHADOW_KEYS, RECEIVE_KEYS);
  for (const m of meshes) if (m.material === mats.glowV || m.material === mats.sign) m.layers.set(LAYER_NO_OUTLINE);
  return meshes;
}

/** Is the road open on `side` at the end of this segment? (both sides at a T-junction) */
const openSide = (seg, side) => seg.fork || seg.turnEnd === side;

/** Lateral range (in d) where side buildings may stand, respecting corners. */
function sideRange(seg, side, inset) {
  let a = seg.index === 0 ? -70 : 0;
  let b = seg.length;
  if (seg.turnStart) {
    a = seg.turnStart === side ? W + inset : -W - inset - 2;
    // Two branches share the far side of a T: only the right branch wraps the corner.
    if (seg.forkBranch === -1 && side !== seg.turnStart) a = W + inset + 2;
  }
  if (seg.turnEnd) b = openSide(seg, side) ? seg.length - W - inset : seg.length + W + inset + 2;
  return [a, b];
}

/** Building with optional setback crown so tall towers read as real skyscrapers. */
function tower(B, key, x, y0, z, w, h, d, color) {
  if (h - y0 > 55 && chance(0.65)) {
    const base = (h - y0) * rand(0.55, 0.72);
    B.building(key, x, y0, z, w, base, d, color);
    const w2 = w * rand(0.62, 0.8);
    const d2 = d * rand(0.62, 0.8);
    B.building(key, x, y0 + base, z, w2, h - y0 - base, d2, color);
    B.box('solid', x, y0 + base + 0.4, z, w + 0.4, 0.8, d + 0.4, 0xe8e0f0);
    if (chance(0.5)) B.cyl('metal', x, h + 5, z, 0.35, 10, 0xc9cfe0, 0, 0, 0, true);
    if (chance(0.4)) B.box('glowV', x, h + 0.3, z, w2 * 0.9, 0.3, d2 * 0.9, pick([P.hotPink, P.sky, P.butter]), 0, 0, 0, 2.2);
  } else {
    B.building(key, x, y0, z, w, h - y0, d, color);
    B.box('solid', x, h + 0.3, z, w + 0.3, 0.6, d + 0.3, 0xe8e0f0);
  }
}

/** Two extra rows of city blocks behind the street wall, plus the ground. */
function backRows(seg, B, firstFace, hMin, hMax, ground = false) {
  for (const side of [-1, 1]) {
    const [ra, rb] = sideRange(seg, side, 4.5);
    for (let row = 0; row < 2; row++) {
      const face = firstFace + 30 + row * 34;
      let d = ra;
      while (d < rb) {
        const w = Math.min(rand(14, 30), rb - d);
        if (w < 6) break;
        const depth = rand(16, 28);
        const h = rand(hMin, hMax) * (row ? 1.15 : 1);
        const glass = chance(0.5);
        tower(B, glass ? 'bldGlass' : 'bldBrick', side * (face + depth / 2), 0, -(d + w / 2), depth, h, w, glass ? pick(GLASS_COLS) : pick(BRICK_COLS));
        d += w + rand(3, 9);
      }
    }
  }
  if (!ground) return;
  // Don't spill over a corner: the next segment owns that ground (and may cut a
  // subway ramp into it).
  const a = seg.turnStart ? seg.floorStart : seg.floorStart - 20;
  const b = seg.turnEnd ? seg.length - W : seg.floorEnd + 20;
  B.quad('concrete', 0, -0.06, -(a + b) / 2, 260, b - a, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
}

// Ramp-following floor strip (used for the subway entrance).
function slopedFloor(B, key, seg, d0, d1, halfW, tile) {
  const step = 4;
  for (let d = d0; d < d1 - 0.01; d += step) {
    const e = Math.min(d1, d + step);
    const y0 = seg.floorY(d);
    const y1 = seg.floorY(e);
    const len = Math.hypot(e - d, y1 - y0);
    const rx = Math.atan2(-(e - d), y1 - y0);
    B.quad(key, 0, (y0 + y1) / 2, -(d + e) / 2, halfW * 2, len + 0.05, rx, 0, 0, 0, tile);
  }
}

// ───────────────────────────── STREET ─────────────────────────────
function buildStreet(seg, B) {
  const y = seg.baseY;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  B.quad('asphalt', 0, y, -(a + b) / 2, W * 2, b - a, -Math.PI / 2, 0, 0, 0, 10.4);
  if (seg.turnStart && seg.prevBaseY !== seg.baseY) {
    B.quad('asphalt', 0, y - 0.01, 0, W * 2, W * 2, -Math.PI / 2, 0, 0, 0, 10.4);
  }
  for (const side of [-1, 1]) {
    let sa = seg.index === 0 ? -70 : 0;
    let sb = seg.length;
    if (seg.turnStart) sa = seg.turnStart === side ? W : seg.forkBranch === -1 ? W + 4 : -W - 4;
    if (seg.turnEnd) sb = openSide(seg, side) ? seg.length - W : seg.length + W + 4;
    const sx = side * (W + 2.2);
    B.box('concrete', sx, y + 0.12, -(sa + sb) / 2, 4.4, 0.24, sb - sa, 0xcfc6dc);
    B.box('solid', side * (W + 0.05), y + 0.12, -(sa + sb) / 2, 0.2, 0.26, sb - sa, 0x8e86a6);
    for (let d = sa + 12; d < sb - 4; d += 32) {
      PR.streetLight(B, side * (W + 3.6), y + 0.24, -d, side);
      seg.faces.push({ side, d0: d - 0.5, d1: d + 0.5, x: side * (W + 2.1), top: y + 7.1, pole: true });
    }
    for (let d = sa + 40; d < sb - 10; d += 90) {
      if (PROPS) prop(seg, 'fire_hydrant', side * (W + 1.2), y + 0.24, -d, side > 0 ? Math.PI : 0, 1.1);
      else PR.hydrant(B, side * (W + 1.4), y + 0.24, -d);
    }
    for (let d = sa + 22; d < sb - 8; d += rand(28, 44)) {
      const r = Math.random();
      const x = side * (W + 3.7);
      if (r < 0.45) {
        prop(seg, 'metal_trash_can', x, y + 0.24, -d, rand(0, 6), 1);
        prop(seg, 'trashbag', x - side * 0.2, y + 0.24, -d - 1.1, rand(0, 6), 1);
      } else if (r < 0.7) prop(seg, 'utility_box_01', x, y + 0.24, -d, side > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
      else prop(seg, 'Barrel_01', x, y + 0.24, -d, rand(0, 6), 1);
    }
  }
  if (seg.length > 150) PR.trafficSignal(B, W + 3.2, y + 0.24, -seg.length * 0.5, 1);
  for (let d = seg.floorStart + 20; d < seg.floorEnd - 10; d += rand(30, 50)) {
    prop(seg, 'water_manhole_cover', pick([-1, 0, 1]) * LW + rand(-0.4, 0.4), y + 0.005, -d, rand(0, 6), 1);
  }

  for (const side of [-1, 1]) {
    const [ra, rb] = sideRange(seg, side, 4.5);
    let d = ra;
    while (d < rb) {
      const w = Math.min(rand(10, 24), rb - d);
      if (w < 4) break;
      const depth = rand(14, 26);
      const tall = chance(0.55);
      const h = tall ? rand(55, 115) : rand(24, 50);
      const glass = tall && chance(0.65);
      const zc = -(d + w / 2);
      const face = side * (W + 4.5);
      tower(B, glass ? 'bldGlass' : 'bldBrick', face + side * depth / 2, y, zc, depth, y + h, w,
        glass ? pick(GLASS_COLS) : pick(BRICK_COLS));
      seg.faces.push({ side, d0: d, d1: d + w, x: face, top: y + h });
      if (chance(0.55)) PR.neonStrip(B, face - side * 0.1, y + rand(4, 6), zc, w * 0.6, rand(0.8, 1.4), pick([P.hotPink, P.sky, P.lime, P.butter, P.orange, P.magenta]), side);
      if (chance(0.3)) PR.billboard(B, `ad${Math.floor(Math.random() * 5)}`, face - side * 0.2, y + rand(12, 22), zc, Math.min(w * 0.75, 9), 5, side > 0 ? -Math.PI / 2 : Math.PI / 2, false);
      // Iron fire escapes zig-zag down classic brick fronts.
      if (!glass && h > 22 && w > 8 && chance(0.45)) {
        prop(seg, 'modular_fire_escape', face - side * 0.72, y + 3.2, zc + rand(-1, 1), side > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
      }
      const gap = chance(0.22) ? rand(3, 6) : 0.4;
      if (gap > 3 && chance(0.6)) prop(seg, 'covered_car', face + side * 4, y, -(d + w + gap / 2), 0, 1);
      d += w + gap;
    }
  }
  backRows(seg, B, W + 4.5, 40, 140, true);
}

// ───────────────────────────── ROOFTOPS ─────────────────────────────
function buildRoof(seg, B) {
  const y = seg.baseY;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  const launch = seg.prevBaseY < 0; // up the shaft from the subway / cell block
  const shaftEnd = launch ? seg.transStart + 16 : a;
  const roofStart = launch ? seg.transStart + seg.transLen + 4 : a;
  // Dropping out of Mirror City: a ramp of light carries you down to the roofs.
  if (seg.prevBaseY > seg.baseY) lightRamp(seg, B, a, seg.transStart + seg.transLen);

  // Street level far below.
  B.quad('concrete', 0, -0.05, -(shaftEnd + b) / 2, 260, b - shaftEnd, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
  B.quad('asphalt', 0, 0.01, -(shaftEnd + b) / 2, W * 2, b - shaftEnd, -Math.PI / 2, 0, 0, 0, 10.4);
  if (launch) {
    // Open vent shaft out of the subway, with the plaza around it.
    for (const side of [-1, 1]) {
      B.quad('concrete', side * (W + 65), -0.05, -(a + shaftEnd) / 2, 130, shaftEnd - a, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
      B.quad('tiles', side * W, -6, -(a + shaftEnd) / 2, shaftEnd - a, 12, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 6, 6);
    }
    B.box('glowV', 0, 0.2, -shaftEnd, W * 2, 0.15, 0.3, P.butter, 0, 0, 0, 3);
  }

  // Row of rooftops under the lanes. Some sit higher: steps you hop up onto.
  seg.steps = [];
  let d = roofStart;
  let first = true;
  while (d < b) {
    // The opening rooftop is one long slab so the story's ledge is solid.
    const d1 = Math.min(b, d + (seg.index === 0 && d < 0 ? 150 : rand(26, 46)));
    const len = d1 - d;
    const zc = -(d + d1) / 2;
    const col = pick(BRICK_COLS);
    const raised = !first && d1 < seg.length - CFG.turnWindow - 12 && chance(0.4);
    const h = raised ? pick([1.3, 2.2, 2.2]) : 0;
    if (raised) seg.steps.push({ d0: d, d1, h });
    const top = y + h;
    B.building('bldBrick', 0, 0, zc, W * 2 + 3, top, len, col);
    B.quad('roof', 0, top + 0.02, zc, W * 2 + 2.6, len, -Math.PI / 2, 0, 0, 0, 10.4);
    if (raised) B.box('glowV', 0, top - 0.05, -d - 0.02, W * 2 + 2.6, 0.1, 0.1, P.butter, 0, 0, 0, 2.5);
    for (const side of [-1, 1]) {
      PR.parapet(B, side * (W + 1.3), top, zc, len, 0xe8e0f0);
      for (let k = d + 5; k < d1 - 3; k += rand(7, 13)) {
        const r = Math.random();
        if (r < 0.35) PR.vent(B, side * (W + 0.3), top, -k);
        else if (r < 0.55) PR.antenna(B, side * (W + 0.5), top, -k, rand(4, 8));
        else if (r < 0.7) prop(seg, 'exterior_aircon_unit', side * (W + 0.55), top, -k, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.9);
        else if (r < 0.8) prop(seg, 'Barrel_01', side * (W + 0.6), top, -k, rand(0, 6), 1);
      }
    }
    first = false;
    d = d1 + (chance(0.35) ? 0 : rand(1.5, 4.5));
  }

  // Flanking city: low roofs you swing over and towers above you.
  for (const side of [-1, 1]) {
    const [ra, rb] = sideRange(seg, side, 8);
    let k = ra;
    while (k < rb) {
      const w = Math.min(rand(12, 26), rb - k);
      if (w < 5) break;
      const depth = rand(14, 30);
      const tower = chance(0.4);
      const h = tower ? y + rand(15, 90) : y - rand(4, 22);
      const x = side * (W + 8 + rand(0, 4) + depth / 2);
      const zc = -(k + w / 2);
      const glass = tower && chance(0.7);
      if (tower) {
        const hh = h;
        towerFn(B, glass ? 'bldGlass' : 'bldBrick', x, 0, zc, depth, hh, w, glass ? pick(GLASS_COLS) : pick(BRICK_COLS));
        seg.faces.push({ side, d0: k, d1: k + w, x: x - side * depth / 2, top: hh });
      } else B.building('bldBrick', x, 0, zc, depth, h, w, pick(BRICK_COLS));
      if (!tower) {
        if (chance(0.5)) {
          const wx = x + rand(-3, 3);
          PR.waterTower(B, wx, h, zc + rand(-3, 3), rand(0.9, 1.3));
          if (h + 8 > y + 5) seg.faces.push({ side, d0: k + w / 2 - 2, d1: k + w / 2 + 2, x: wx - side * 1.5, top: h + 8, pole: true });
        }
        if (chance(0.6)) {
          if (PROPS) prop(seg, 'exterior_aircon_unit', x - side * depth * 0.25, h, zc + rand(-4, 4), rand(0, 6), 1.2);
          else PR.acUnit(B, x - side * depth * 0.25, h, zc + rand(-4, 4));
        }
        if (chance(0.35)) {
          PR.billboard(B, `ad${Math.floor(Math.random() * 5)}`, x - side * depth * 0.3, h + 3.2, zc, Math.min(w * 0.8, 10), 5, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
      } else if (chance(0.5)) {
        PR.antenna(B, x, h, zc, rand(6, 14));
      }
      // Rooftop billboards/antennas on the parapet line are grabbable too.
      if (chance(0.3)) {
        const ad = k + w / 2;
        PR.antenna(B, side * (W + 1.3), y, -ad, 9);
        seg.faces.push({ side, d0: ad - 0.5, d1: ad + 0.5, x: side * (W + 1.3), top: y + 9, pole: true });
      }
      k += w + rand(0.5, 5);
    }
  }
  backRows(seg, B, W + 34, 25, 130);
}

// ───────────────────────────── SUBWAY ─────────────────────────────
function buildSubway(seg, B) {
  const y = seg.baseY;
  const top = y + 8;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  const ramp = seg.prevBaseY > seg.baseY; // down from street or park level
  const tunnelStart = ramp ? seg.transStart + seg.transLen : a;

  if (ramp) {
    slopedFloor(B, 'track', seg, a, tunnelStart, W, 8);
  }
  B.quad('track', 0, y, -(tunnelStart + b) / 2, W * 2, b - tunnelStart, -Math.PI / 2, 0, 0, 0, 8);
  // Rails for each lane.
  for (let lane = -1; lane <= 1; lane++) {
    for (const k of [-0.72, 0.72]) {
      B.box('metal', lane * LW + k, y + 0.1, -(tunnelStart + b) / 2, 0.12, 0.2, b - tunnelStart, 0xd0d6ea);
    }
  }

  // Tiled walls from the track bed up to street level.
  for (const side of [-1, 1]) {
    const wa = a;
    const wb = openSide(seg, side) ? seg.length - W : b;
    const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    B.quad('tiles', side * W, (y + 0) / 2, -(wa + wb) / 2, wb - wa, -y, 0, ry, 0, 6, 6);
    // Steel pillars.
    for (let d = Math.max(wa, tunnelStart) + 3; d < wb - 1; d += 7) {
      B.box('metal', side * (W - 0.2), (y + top) / 2, -d, 0.4, 8, 0.5, 0x3b3552);
    }
    // Station clutter against the walls.
    for (let d = Math.max(wa, tunnelStart) + 8; d < wb - 6; d += rand(14, 26)) {
      const r = Math.random();
      const x = side * (W - 0.6);
      if (r < 0.3) prop(seg, 'WetFloorSign_01', x, y, -d, rand(0, 6), 1.2);
      else if (r < 0.55) prop(seg, 'cardboard_box_01', x, y, -d, rand(0, 6), 1.3);
      else if (r < 0.75) prop(seg, 'trashbag', x, y, -d, rand(0, 6), 1);
      else prop(seg, 'old_tyre', x, y, -d, rand(0, 6), 1);
    }
    // Graffiti and station mosaics.
    for (let d = wa + 10; d < wb - 10; d += rand(22, 40)) {
      if (chance(0.6)) B.quad(`graf${Math.floor(Math.random() * 3)}`, side * (W - 0.03), y + rand(1.5, 3.5), -d, 7, 1.75, 0, ry, 0);
      else B.quad(`ad${Math.floor(Math.random() * 5)}`, side * (W - 0.03), y + 3.2, -d, 5, 2.5, 0, ry, 0);
    }
  }
  if (seg.turnEnd) {
    B.quad('tiles', 0, (y + 0) / 2, -b, W * 2, -y, 0, 0, 0, 6, 6);
  }

  // Ceiling + light strips over the tunnel section.
  B.quad('concrete', 0, top, -(tunnelStart + b) / 2, W * 2, b - tunnelStart, Math.PI / 2, 0, 0, 0, 0, 0x4b4466);
  for (let d = tunnelStart + 3; d < b - 2; d += 8) {
    for (const x of [-LW * 1.5, LW * 1.5]) B.box('glowV', x, top - 0.08, -d, 0.35, 0.1, 3.2, 0xf2fbff, 0, 0, 0, 2.6);
  }

  // Street level above the tunnel.
  B.quad('concrete', 0, 0.02, -(tunnelStart + b) / 2, 260, b - tunnelStart, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
  if (ramp) {
    for (const side of [-1, 1]) {
      const g0 = a - W * 2 - 20;
      B.quad('concrete', side * (W + 65), 0.02, -(g0 + tunnelStart) / 2, 130, tunnelStart - g0, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
    }
    B.box('glowV', 0, 0.3, -a, W * 2, 0.15, 0.3, P.butter, 0, 0, 0, 3);
  }
  for (const side of [-1, 1]) {
    const [ra, rb] = sideRange(seg, side, 12);
    let k = ra;
    while (k < rb) {
      const w = Math.min(rand(14, 28), rb - k);
      if (w < 5) break;
      const depth = rand(14, 24);
      B.building(chance(0.4) ? 'bldGlass' : 'bldBrick', side * (W + 12 + depth / 2), 0, -(k + w / 2), depth, rand(18, 70), w, pick(BRICK_COLS));
      k += w + rand(1, 5);
    }
  }
  backRows(seg, B, W + 12, 30, 110);
}

// ───────────────────────────── IRON ISLE LOCKUP (prison) ─────────────────────────────
// An underground cell block beneath the river: two tiers of cells, catwalks,
// alarm lights, and the inmates cheering (or jeering) as you blast through.
const PRISON_CEIL = 9;
function inmate(B, x, y, z, side) {
  const c = 0xff7a1a;
  B.box('solid', x, y + 0.5, z, 0.45, 1.0, 0.3, c);
  B.box('solid', x, y + 1.35, z, 0.55, 0.75, 0.32, c);
  B.box('solid', x, y + 1.95, z, 0.34, 0.36, 0.34, pick([0xe0ac86, 0x8a5a44, 0x6b4432, 0xf1c7a5]));
  for (const k of [-0.22, 0.22]) B.box('solid', x - side * 0.15, y + 1.7, z + k, 0.12, 0.12, 0.12, c); // hands on the bars
}
function cellRow(seg, B, side, y, a, b, withInmates) {
  const x0 = side * (W + 0.2);
  // Bars.
  for (let d = a; d < b; d += 0.45) B.box('metal', x0, y + 1.6, -d, 0.07, 3.2, 0.07, 0x5a5670);
  B.box('metal', x0, y + 3.25, -(a + b) / 2, 0.15, 0.15, b - a, 0x3b3552);
  // Cell dividers + bunks behind the bars.
  for (let d = a; d < b; d += 4) {
    B.box('concrete', side * (W + 2.2), y + 1.7, -d, 4, 3.4, 0.25, 0xb8b0c0);
    B.box('solid', side * (W + 3.6), y + 0.7, -(d + 2), 1, 0.25, 2.8, 0x9aa3c0);
    B.box('solid', side * (W + 3.6), y + 0.85, -(d + 2), 0.95, 0.12, 2.7, 0xf4f4f4);
    if (withInmates && chance(0.55)) inmate(B, side * (W + 0.8), y, -(d + 2 + rand(-0.8, 0.8)), side);
  }
  B.box('concrete', side * (W + 4.3), y + 1.7, -(a + b) / 2, 0.3, 3.4, b - a, 0x8a8298);
  B.quad('concrete', side * (W + 2.2), y + 0.01, -(a + b) / 2, 4.2, b - a, -Math.PI / 2, 0, 0, 0, 0, 0x6a6278);
}
function buildPrison(seg, B) {
  const y = seg.baseY;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  const zc = -(a + b) / 2;
  const len = b - a;
  B.quad('concrete', 0, y, zc, W * 2 + 0.4, len, -Math.PI / 2, 0, 0, 0, 0, 0x7a7488);
  B.box('glowV', 0, y + 0.01, zc, 0.15, 0.01, len, 0xffd84a, 0, 0, 0, 1.6);
  for (const side of [-1, 1]) {
    const [sa, sb] = [a, openSide(seg, side) ? seg.length - W : b];
    cellRow(seg, B, side, y, sa, sb, true);
    // Upper tier: catwalk + railing + more cells.
    B.box('metal', side * (W + 1.1), y + 4.4, -(sa + sb) / 2, 2.2, 0.15, sb - sa, 0x4a4660);
    B.box('metal', side * (W - 0.05), y + 5.4, -(sa + sb) / 2, 0.08, 0.08, sb - sa, 0xd0d6ea);
    for (let d = sa; d < sb; d += 3) B.box('metal', side * (W - 0.05), y + 4.9, -d, 0.08, 1.0, 0.08, 0xd0d6ea);
    cellRow(seg, B, side, y + 4.5, sa, sb, true);
    // Alarm lights.
    for (let d = sa + 8; d < sb - 4; d += 22) {
      B.box('solid', side * (W + 0.1), y + 7.8, -d, 0.35, 0.35, 0.35, 0x1b1030);
      B.box('glowV', side * (W - 0.1), y + 7.8, -d, 0.3, 0.3, 0.3, 0xff2030, 0, 0, 0, 4);
    }
    // Wanted posters / guard signs on the upper walls.
    for (let d = sa + 14; d < sb - 6; d += rand(26, 40)) B.quad(`graf${Math.floor(Math.random() * 3)}`, side * (W + 0.1), y + 7.2, -d, 5, 1.2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
  }
  B.quad('concrete', 0, y + PRISON_CEIL, zc, W * 2 + 10, len, Math.PI / 2, 0, 0, 0, 0, 0x3a3448);
  for (let d = a + 4; d < b - 2; d += 10) {
    B.box('metal', 0, y + PRISON_CEIL - 0.4, -d, 0.8, 0.5, 0.8, 0x2b2640);
    B.box('glowV', 0, y + PRISON_CEIL - 0.7, -d, 0.6, 0.1, 0.6, 0xfff0c0, 0, 0, 0, 3);
  }
  if (seg.turnEnd) B.quad('concrete', 0, y + PRISON_CEIL / 2, -b, W * 2 + 10, PRISON_CEIL, 0, 0, 0, 0, 0, 0x6a6278);
  // Street above.
  B.quad('concrete', 0, 0.02, zc, 260, len, -Math.PI / 2, 0, 0, 0, 0, 0x4a4470);
  backRows(seg, B, W + 20, 30, 110);
}

// ───────────────────────────── OFFICE FLOOR ─────────────────────────────
// Floor 20 of a glass tower: crash in through the window, run the open-plan
// office past startled workers, smash out the far side.
const OFFICE_CEIL = 6;
function worker(B, x, y, z, ry, col, surprised) {
  B.box('solid', x, y + 0.45, z, 0.5, 0.9, 0.5, 0x2b2640, 0, ry, 0); // chair
  B.box('solid', x, y + 1.1, z, 0.5, 0.7, 0.3, col, 0, ry, 0);
  B.box('solid', x, y + 1.62, z, 0.32, 0.34, 0.32, pick([0xe0ac86, 0x8a5a44, 0xf1c7a5, 0x4e3022]), 0, ry, 0);
  B.box('solid', x, y + 1.25, z + 0.02, 0.06, 0.4, 0.03, 0xd6203a, 0, ry, 0); // tie
  if (surprised) {
    for (const k of [-1, 1]) B.box('solid', x + Math.cos(ry) * k * 0.35, y + 1.75, z - Math.sin(ry) * k * 0.35, 0.12, 0.6, 0.12, col, 0, ry, k * 0.4);
  }
}
function desk(B, x, y, z, ry = 0) {
  B.box('solid', x, y + 0.72, z, 1.8, 0.08, 0.9, 0xe8d2b0, 0, ry, 0);
  B.box('solid', x - 0.8, y + 0.36, z, 0.08, 0.72, 0.8, 0x9aa3c0, 0, ry, 0);
  B.box('solid', x + 0.8, y + 0.36, z, 0.08, 0.72, 0.8, 0x9aa3c0, 0, ry, 0);
  B.box('solid', x, y + 1.02, z - 0.2, 0.6, 0.4, 0.05, 0x1b1030, 0, ry, 0);
  B.box('glowV', x, y + 1.02, z - 0.17, 0.52, 0.32, 0.02, pick([0x3fe0ff, 0xa8f03a, 0xff3fa4]), 0, ry, 0, 1.6);
}
function glassPane(seg, d, y, h = OFFICE_CEIL - 0.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 1, h), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.6 }));
  m.position.set(0, y + h / 2, -d);
  seg.group.add(m);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x1b1030 }));
  frame.position.set(0, y + h, -d);
  seg.group.add(frame);
  seg.glass = (seg.glass || []).concat({ d, mesh: m, frame, y });
}

function buildOffice(seg, B) {
  const y = seg.baseY;
  const enter = seg.prevZone && seg.prevZone !== 'office';
  const a = enter ? seg.transStart + seg.transLen : seg.floorStart;
  const b = seg.floorEnd;
  const zc = -(a + b) / 2;
  const len = b - a;
  // The tower around the floor (inside faces are culled, so it's invisible from within).
  if (len > 1) B.building('bldGlass', 0, 0, zc, W * 2 + 4, y + OFFICE_CEIL + rand(40, 90), len, pick(GLASS_COLS));
  B.quad('concrete', 0, y, zc, W * 2 + 1, len, -Math.PI / 2, 0, 0, 0, 0, 0x5a6a9a); // carpet
  for (let d = a + 2; d < b; d += 6) B.box('concrete', 0, y + 0.005, -d, W * 2, 0.01, 0.12, 0x4a5a88);
  B.quad('concrete', 0, y + OFFICE_CEIL, zc, W * 2 + 1, len, Math.PI / 2, 0, 0, 0, 0, 0xe8e4f0);
  for (let d = a + 3; d < b - 1; d += 6) {
    for (const x of [-LW, 0, LW]) B.box('glowV', x, y + OFFICE_CEIL - 0.06, -d, 1.6, 0.06, 1.2, 0xf4f8ff, 0, 0, 0, 2.2);
  }
  // Walls leave openings where the corridor turns (and both ways at a T).
  const wA = (side) => (seg.turnStart === side ? W + 0.6 : a);
  const wB = (side) => (seg.turnEnd && openSide(seg, side) ? seg.length - W - 0.6 : b);
  // Window wall (left) with mullions: the skyline shows through.
  const la = wA(-1), lb = wB(-1);
  for (let d = la; d < lb; d += 3.5) B.box('solid', -(W + 0.4), y + OFFICE_CEIL / 2, -d, 0.25, OFFICE_CEIL, 0.25, 0x1b1030);
  B.box('solid', -(W + 0.4), y + 0.5, -(la + lb) / 2, 0.3, 1, lb - la, 0x2b2640);
  B.box('solid', -(W + 0.4), y + OFFICE_CEIL - 0.15, -(la + lb) / 2, 0.3, 0.3, lb - la, 0x2b2640);
  // Interior wall (right): whiteboards, posters, plants, coolers.
  const ra = wA(1), rb = wB(1);
  B.box('concrete', W + 0.6, y + OFFICE_CEIL / 2, -(ra + rb) / 2, 0.3, OFFICE_CEIL, rb - ra, 0xf2e8dc);
  if (seg.turnEnd) B.box('concrete', 0, y + OFFICE_CEIL / 2, -(b + 0.3), W * 2 + 1.4, OFFICE_CEIL, 0.3, 0xf2e8dc);
  for (let d = ra + 6; d < rb - 4; d += rand(9, 15)) {
    const r = Math.random();
    if (r < 0.3) B.box('solid', W + 0.42, y + 2.2, -d, 0.05, 1.3, 2.4, 0xffffff);
    else if (r < 0.55) B.quad(`ad${Math.floor(Math.random() * 5)}`, W + 0.43, y + 2.4, -d, 2, 1.2, 0, -Math.PI / 2, 0);
    else if (r < 0.75) {
      B.cyl('solid', W - 0.2, y + 0.4, -d, 0.35, 0.8, 0xc8583f);
      B.box('solid', W - 0.2, y + 1.3, -d, 0.9, 1.1, 0.9, 0x3fbf5a);
    } else {
      B.box('solid', W - 0.2, y + 0.6, -d, 0.5, 1.2, 0.5, 0xf4f4f4);
      B.cyl('solid', W - 0.2, y + 1.45, -d, 0.22, 0.5, 0x7fc8ff);
    }
  }
  // Workers at desks along both walls, arms up as you blast past.
  for (const side of [-1, 1]) {
    for (let d = wA(side) + 5; d < wB(side) - 3; d += rand(5, 9)) {
      const x = side * (W - 0.6);
      desk(B, x, y, -d, Math.PI / 2);
      if (chance(0.75)) worker(B, x - side * 0.9, y, -d, side > 0 ? Math.PI / 2 : -Math.PI / 2, pick([0x3fc7ff, 0xf4f4f4, 0xffd84a, 0xff9a2e, 0x7b4dff, 0xa8f03a]), chance(0.6));
    }
  }
  if (enter) {
    glassPane(seg, a + 0.5, y);
    // Ledge you drop onto, outside the glass.
    B.box('solid', 0, y - 0.3, -(a - 3), W * 2 + 2, 0.6, 6, 0x2b2640);
  }
}

// ───────────────────────────── THE GREEN (park) ─────────────────────────────
const LEAF_COLS = [0x3fbf5a, 0x6fd24a, 0x2e9a5e, 0xa8f03a, 0x57c78a, 0xffb14a];

/** Chunky toy-like tree: trunk + stacked, slightly rotated leaf blocks. */
function tree(B, x, y, z, s = 1) {
  const h = rand(3.2, 5) * s;
  B.cyl('solid', x, y + h / 2, z, 0.28 * s, h, 0x6b4432);
  const c = pick(LEAF_COLS);
  const r = rand(2.2, 3.2) * s;
  B.box('solid', x, y + h + r * 0.35, z, r * 1.9, r * 1.1, r * 1.9, c, 0, rand(0, 1.5), 0);
  B.box('solid', x + rand(-0.4, 0.4), y + h + r * 1.1, z + rand(-0.4, 0.4), r * 1.35, r * 0.9, r * 1.35, c, 0, rand(0, 1.5), 0);
  if (chance(0.6)) B.box('solid', x, y + h + r * 1.7, z, r * 0.8, r * 0.6, r * 0.8, c, 0, rand(0, 1.5), 0);
}

function bench(B, x, y, z, ry = 0) {
  B.box('solid', x, y + 0.45, z, 2.2, 0.12, 0.6, 0xc8583f, 0, ry, 0);
  B.box('solid', x, y + 0.85, z, 2.2, 0.5, 0.1, 0xc8583f, 0, ry, 0);
  for (const k of [-0.9, 0.9]) B.box('metal', x + Math.cos(ry) * k, y + 0.22, z - Math.sin(ry) * k, 0.1, 0.45, 0.55, 0x2e2a4a, 0, ry, 0);
}

function hedge(B, x, y, z) {
  B.box('solid', x, y + 0.6, z, 2.1, 1.2, 0.9, 0x2e9a5e);
  B.box('solid', x, y + 1.25, z, 1.9, 0.15, 0.8, 0x6fd24a);
}

function foodCart(B, x, y, z) {
  B.box('solid', x, y + 1.2, z, 1.9, 1.6, 3.2, 0xf4f4f4);
  B.box('solid', x, y + 1.1, z, 1.95, 0.5, 3.25, 0xff3fa4);
  B.cyl('metal', x, y + 2.6, z, 0.06, 1.2, 0x2e2a4a);
  B.box('solid', x, y + 3.25, z, 2.6, 0.12, 2.6, 0xffd84a);
  for (const k of [-1.1, 1.1]) B.cyl('solid', x + 0.95, y + 0.4, z + k, 0.4, 0.2, 0x1b1030, 0, 0, Math.PI / 2);
}

function branch(B, x, y, z, bottom = 2.25) {
  B.box('solid', x, y + bottom + 0.35, z, 2.6, 0.5, 0.5, 0x6b4432, 0, 0, 0.08);
  B.box('solid', x, y + bottom + 0.95, z, 3.2, 0.9, 1.2, pick(LEAF_COLS));
  B.cyl('solid', x - 1.3, y + (bottom + 0.4) / 2, z, 0.2, bottom + 0.4, 0x6b4432);
}

function buildPark(seg, B) {
  const y = seg.baseY;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  // Paved promenade through a lawn, stone kerbs, lamp posts.
  B.quad('concrete', 0, y + 0.01, -(a + b) / 2, W * 2, b - a, -Math.PI / 2, 0, 0, 0, 0, 0xd8cfc0);
  for (let lane = -0.5; lane <= 0.5; lane += 1) B.box('solid', lane * LW * 2, y + 0.02, -(a + b) / 2, 0.08, 0.02, b - a, 0xb8ae9e);
  const ga = seg.turnStart ? a : a - 20;
  const gb = seg.turnEnd ? seg.length - W : b + 20;
  B.quad('concrete', 0, y - 0.04, -(ga + gb) / 2, 260, gb - ga, -Math.PI / 2, 0, 0, 0, 0, 0x4fa85a);
  for (const side of [-1, 1]) {
    const [sa, sb] = sideRange(seg, side, 0);
    B.box('concrete', side * (W + 0.2), y + 0.15, -(sa + sb) / 2, 0.4, 0.3, sb - sa, 0xcfc6b0);
    for (let d = sa + 10; d < sb - 4; d += 26) {
      PR.streetLight(B, side * (W + 1.4), y, -d, side);
      seg.faces.push({ side, d0: d - 0.5, d1: d + 0.5, x: side * (W - 0.1), top: y + 6.9, pole: true });
    }
    for (let d = sa + 18; d < sb - 6; d += rand(20, 34)) bench(B, side * (W + 2.2), y, -d, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    // Woods: rows of chunky trees, thinner near the path.
    for (let d = sa; d < sb; d += rand(6, 11)) {
      const tx = side * (W + rand(5, 10));
      tree(B, tx, y, -d, rand(0.9, 1.2));
      if (chance(0.5)) seg.faces.push({ side, d0: d - 1, d1: d + 1, x: tx - side * 1.5, top: y + 8.5, pole: true });
      if (chance(0.7)) tree(B, side * (W + rand(14, 30)), y, -d - rand(0, 5), rand(1.1, 1.6));
    }
    if (chance(0.5)) {
      // Pond with a little stone bridge edge and ducks' glow buoy.
      const pd = rand(sa + 30, Math.max(sa + 31, sb - 30));
      B.cyl('solid', side * (W + 22), y - 0.02, -pd, 12, 0.1, 0x3fa8d8, 0, 0, 0, true);
      B.cyl('concrete', side * (W + 22), y - 0.06, -pd, 12.8, 0.1, 0xcfc6b0, 0, 0, 0, true);
    }
    // The skyline wall at the park's edge: tall towers the line can reach.
    let k = sa;
    while (k < sb) {
      const w = Math.min(rand(14, 26), sb - k);
      if (w < 5) break;
      const depth = rand(16, 26);
      const face = side * (W + 42);
      const h = rand(90, 170);
      const glass = chance(0.6);
      tower(B, glass ? 'bldGlass' : 'bldBrick', face + side * depth / 2, y, -(k + w / 2), depth, y + h, w, glass ? pick(GLASS_COLS) : pick(BRICK_COLS));
      seg.faces.push({ side, d0: k, d1: k + w, x: face, top: y + h });
      k += w + rand(2, 6);
    }
  }
  // Landmarks: a tiered fountain, a stone arch bridge over the path, a carousel.
  const L = rand(0, 1);
  const ld = rand(40, Math.max(41, seg.length - 60));
  const ls = pick([-1, 1]);
  if (L < 0.4) {
    const fx = ls * (W + 16);
    B.cyl('concrete', fx, y + 0.4, -ld, 7, 0.8, 0xcfc6b0, 0, 0, 0, true);
    B.cyl('solid', fx, y + 0.82, -ld, 6.4, 0.1, 0x3fa8d8, 0, 0, 0, true);
    B.cyl('concrete', fx, y + 2, -ld, 0.6, 2.4, 0xcfc6b0);
    B.cyl('concrete', fx, y + 3.2, -ld, 2.4, 0.4, 0xcfc6b0, 0, 0, 0, true);
    B.cyl('glowV', fx, y + 3.45, -ld, 2.1, 0.1, 0x9fe3ff, 0, 0, 0, true, 1.6);
    B.cyl('concrete', fx, y + 4.5, -ld, 0.3, 2.2, 0xcfc6b0);
    B.box('solid', fx, y + 6, -ld, 0.8, 1.2, 0.5, 0xd8c890); // angel-ish statue block
    B.box('solid', fx, y + 6.4, -ld, 2.6, 0.3, 0.2, 0xd8c890);
  } else if (L < 0.75 && ld < seg.length - CFG.turnWindow - 20) {
    // Arch bridge spanning the path (decor + a great grapple point).
    for (const side of [-1, 1]) B.box('concrete', side * (W + 1.5), y + 3.5, -ld, 3, 7, 5, 0xb8ae9e);
    B.box('concrete', 0, y + 7.6, -ld, W * 2 + 6, 1.4, 5, 0xb8ae9e);
    B.box('concrete', 0, y + 8.5, -ld, W * 2 + 6, 0.5, 5.4, 0x9a907e);
    for (let x = -W - 2; x <= W + 2; x += 1.2) B.box('concrete', x, y + 9.2, -ld + 2.5, 0.25, 0.9, 0.25, 0xcfc6b0);
    seg.faces.push({ side: -1, d0: ld - 2, d1: ld + 2, x: -2, top: y + 8.3, pole: true });
    seg.faces.push({ side: 1, d0: ld - 2, d1: ld + 2, x: 2, top: y + 8.3, pole: true });
  } else {
    const cx = ls * (W + 14);
    B.cyl('solid', cx, y + 0.3, -ld, 5, 0.6, 0xf4f4f4, 0, 0, 0, true);
    B.cyl('solid', cx, y + 5.2, -ld, 5.4, 0.6, 0xff3fa4, 0, 0, 0, true);
    B.cyl('solid', cx, y + 6.4, -ld, 3.5, 1.8, 0xffd84a);
    B.cyl('metal', cx, y + 2.8, -ld, 0.4, 5, 0xffd84a);
    for (let i = 0; i < 8; i++) {
      const a2 = (i / 8) * Math.PI * 2;
      B.cyl('metal', cx + Math.cos(a2) * 3.8, y + 2.8, -ld + Math.sin(a2) * 3.8, 0.08, 5, 0xffd84a);
      B.box('solid', cx + Math.cos(a2) * 3.8, y + 1.6, -ld + Math.sin(a2) * 3.8, 0.5, 1.1, 1.6, pick([0xf4f4f4, 0x3fc7ff, 0xff9a2e, 0xb56bff]), 0, -a2, 0);
    }
    for (let i = 0; i < 12; i++) {
      const a2 = (i / 12) * Math.PI * 2;
      B.box('glowV', cx + Math.cos(a2) * 5.3, y + 4.95, -ld + Math.sin(a2) * 5.3, 0.3, 0.2, 0.3, 0xfff6a0, 0, 0, 0, 3);
    }
  }
  // Rowboats in the pond / horse carriage parked on the lawn.
  if (chance(0.5)) {
    const hx = ls * -1 * (W + 7);
    const hd = rand(30, seg.length - 30);
    B.box('solid', hx, y + 1.0, -hd, 1.6, 1.2, 2.6, 0x1b1030);
    B.box('solid', hx, y + 1.9, -hd - 0.3, 1.5, 0.8, 1.2, 0xd6203a);
    for (const k of [-1, 1]) B.cyl('solid', hx + k * 0.85, y + 0.6, -hd - 0.8, 0.6, 0.1, 0xffd84a, 0, 0, Math.PI / 2);
    B.box('solid', hx, y + 1.3, -hd + 2.8, 0.6, 1.0, 2.0, 0xf4f4f4); // the horse
    B.box('solid', hx, y + 2.1, -hd + 3.9, 0.4, 0.9, 0.5, 0xf4f4f4);
    for (const k of [-0.2, 0.2]) for (const z of [2.1, 3.5]) B.box('solid', hx + k, y + 0.4, -hd + z, 0.15, 0.8, 0.15, 0xf4f4f4);
  }
  backRows(seg, B, W + 60, 90, 190);
}

// ───────────────────────────── MIRROR CITY (rift) ─────────────────────────────
// An overlapping, upside-down copy of the city hanging in a violet sky; you run
// on floating glass slabs between them. Reached (and left) through rift portals.
export const RIFT_TIME = { value: 0 };
let portalMat = null;
let ringMat = null;
function portalMaterial() {
  if (portalMat) return portalMat;
  portalMat = new THREE.ShaderMaterial({
    uniforms: { time: RIFT_TIME },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float time; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
        float swirl = sin(a * 5.0 + r * 14.0 - time * 5.0) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.1, 1.6, 1.5), vec3(1.6, 0.3, 1.4), swirl);
        col += vec3(2.0) * smoothstep(0.25, 0.0, r);
        float alpha = smoothstep(1.0, 0.82, r) * (0.55 + 0.35 * swirl);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  return portalMat;
}

/** A standing rift portal spanning the lanes at distance d. */
function portal(seg, B, d) {
  const y = seg.floorY(d);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(W + 1.2, 48), portalMaterial());
  disc.position.set(0, y + W * 0.55, -d);
  disc.layers.set(LAYER_NO_OUTLINE);
  seg.group.add(disc);
  ringMat ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3fe0ff).multiplyScalar(3) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(W + 1.3, 0.45, 10, 48), ringMat);
  ring.position.copy(disc.position);
  ring.layers.set(LAYER_NO_OUTLINE);
  seg.group.add(ring);
  seg.portals = (seg.portals || []).concat({ d, disc, ring });
  for (const side of [-1, 1]) B.box('solid', side * (W + 1.6), y + 0.6, -d, 1.4, 1.2, 1.4, 0x1b1030);
}

/** Glowing ramp between two levels (rift entry / exit). */
function lightRamp(seg, B, d0, d1) {
  const step = 4;
  for (let d = d0; d < d1 - 0.01; d += step) {
    const e = Math.min(d1, d + step);
    const y0 = seg.floorY(d);
    const y1 = seg.floorY(e);
    const len = Math.hypot(e - d, y1 - y0);
    const rx = Math.atan2(-(e - d), y1 - y0);
    B.quad('concrete', 0, (y0 + y1) / 2 - 0.02, -(d + e) / 2, W * 2, len + 0.05, rx, 0, 0, 0, 0, 0x2a1a4a);
    for (const side of [-1, 1]) B.box('glowV', side * W, (y0 + y1) / 2 + 0.1, -(d + e) / 2, 0.15, 0.15, len, P.sky, rx + Math.PI / 2, 0, 0, 2.6);
  }
}

function buildRift(seg, B) {
  const y = seg.baseY;
  const a = seg.floorStart;
  const b = seg.floorEnd;
  const entering = seg.prevZone && seg.prevZone !== 'rift';
  const slabStart = entering ? seg.transStart + seg.transLen : a;
  if (entering) {
    lightRamp(seg, B, a, slabStart);
    portal(seg, B, a + 6);
  }
  if (seg.nextZone !== 'rift') portal(seg, B, seg.length - (seg.turnEnd ? CFG.turnWindow + 6 : 6));
  // Floating glass slabs with glowing seams (small gaps you run straight over).
  let d = slabStart;
  while (d < b) {
    const d1 = Math.min(b, d + rand(18, 34));
    const zc = -(d + d1) / 2;
    const len = d1 - d;
    B.box('solid', 0, y - 1.6, zc, W * 2 + 1, 3.2, len - 0.3, pick([0x2b2640, 0x3a2f66, 0x241d44]));
    B.quad('tiles', 0, y + 0.01, zc, W * 2 + 1, len - 0.3, -Math.PI / 2, 0, 0, 0, 6);
    B.box('glowV', 0, y + 0.03, -d - 0.1, W * 2 + 1, 0.06, 0.12, pick([P.sky, P.hotPink, P.lime]), 0, 0, 0, 3);
    // Rocky underside so it reads as floating.
    B.box('solid', 0, y - 5, zc, W * 1.3, 4, len * 0.6, 0x3a1a6a, 0, 0, 0.1);
    d = d1;
  }
  for (const side of [-1, 1]) {
    const [ra, rb] = sideRange(seg, side, 6);
    let k = ra;
    while (k < rb) {
      const w = Math.min(rand(12, 24), rb - k);
      if (w < 5) break;
      const depth = rand(14, 24);
      const glass = chance(0.6);
      const col = glass ? pick(GLASS_COLS) : pick(BRICK_COLS);
      const x = side * (W + 10 + depth / 2 + rand(0, 6));
      const zc = -(k + w / 2);
      // Upside-down towers hanging from the sky: the "other" New York.
      const hang = rand(40, 110);
      const bottom = y + rand(14, 26);
      B.building(glass ? 'bldGlass' : 'bldBrick', x, bottom, zc, depth, hang, w, col);
      B.box('glowV', x, bottom - 0.2, zc, depth * 0.9, 0.3, w * 0.9, pick([P.hotPink, P.sky, P.butter]), 0, 0, 0, 2.2);
      seg.faces.push({ side, d0: k, d1: k + w, x: x - side * depth / 2, top: bottom + hang });
      // Normal towers far below, broken off at the top.
      if (chance(0.7)) B.building(chance(0.5) ? 'bldGlass' : 'bldBrick', x + side * rand(4, 12), 0, zc + rand(-5, 5), depth * 0.8, y - rand(12, 30), w * 0.8, pick(BRICK_COLS));
      // Floating debris chunks.
      if (chance(0.5)) B.box('solid', side * (W + rand(3, 8)), y + rand(3, 12), zc + rand(-4, 4), rand(1, 2.5), rand(1, 2.5), rand(1, 2.5), 0x6f5fb0, rand(0, 1), rand(0, 1), rand(0, 1));
      k += w + rand(3, 8);
    }
  }
}

// ───────────────────────────── GAMEPLAY LAYOUT ─────────────────────────────

const OBSTACLES = {
  street: {
    low: [
      { build: PR.barrier, h: 1.3, hw: 1.05, hd: 0.45 },
      { build: PR.jersey, h: 1.25, hw: 1.05, hd: 0.5, model: 'barrier' },
      { build: PR.barrier, h: 1.3, hw: 1.05, hd: 0.5, model: 'crates' },
      { build: PR.taxi, h: 1.8, hw: 1.0, hd: 2.1, moving: [0, 8], standable: true },
    ],
    high: [
      { build: PR.scaffoldBeam, bottom: 2.25, top: 3.2, hw: 1.3, hd: 0.3, pole: true },
      { build: (B, x, y, z) => PR.hangingSign(B, `ad${Math.floor(Math.random() * 5)}`, x, y, z), bottom: 2.25, top: 4.7, hw: 1.15, hd: 0.2 },
    ],
    block: [{ build: PR.bus, h: 3.4, hw: 1.15, hd: 4.5, moving: [0, 7], standable: true }],
  },
  roof: {
    low: [
      { build: PR.acUnit, h: 1.4, hw: 0.95, hd: 0.7, model: 'aircon' },
      { build: PR.acUnit, h: 1.3, hw: 1.0, hd: 0.6, model: 'crates' },
      { build: (B, x, y, z) => { PR.vent(B, x - 0.6, y, z); PR.vent(B, x + 0.6, y, z); }, h: 1.35, hw: 1.0, hd: 0.4 },
    ],
    high: [
      { build: (B, x, y, z) => PR.hangingSign(B, `ad${Math.floor(Math.random() * 5)}`, x, y, z), bottom: 2.25, top: 4.7, hw: 1.15, hd: 0.2 },
    ],
    block: [
      { build: PR.waterTower, h: 6.5, hw: 1.4, hd: 1.4 },
      { build: PR.roofShed, h: 4.5, hw: 1.2, hd: 1.4, standable: true },
    ],
  },
  park: {
    low: [
      { build: hedge, h: 1.35, hw: 1.05, hd: 0.45 },
      { build: (B, x, y, z) => bench(B, x, y, z), h: 1.15, hw: 1.1, hd: 0.35 },
      { build: PR.barrier, h: 1.3, hw: 1.0, hd: 0.5, model: 'crates' },
    ],
    high: [{ build: branch, bottom: 2.25, top: 3.8, hw: 1.3, hd: 0.6 }],
    block: [
      { build: foodCart, h: 3.3, hw: 1.0, hd: 1.6, standable: true },
      { build: (B, x, y, z) => tree(B, x, y, z, 0.8), h: 6, hw: 1.2, hd: 1.2 },
    ],
  },
  prison: {
    low: [
      { build: (B, x, y, z) => { B.box('solid', x, y + 0.6, z, 1.6, 0.9, 1.0, 0x9aa3c0); B.box('solid', x, y + 1.1, z, 1.5, 0.3, 0.9, 0xf4f4f4); for (const k of [-0.6, 0.6]) B.cyl('solid', x + k, y + 0.12, z, 0.12, 0.2, 0x1b1030, 0, 0, Math.PI / 2); }, h: 1.3, hw: 1.0, hd: 0.55 },
      { build: PR.barrier, h: 1.3, hw: 1.0, hd: 0.5, model: 'crates' },
    ],
    high: [
      { build: (B, x, y, z) => { for (let k = -1.1; k <= 1.1; k += 0.3) B.box('metal', x + k, y + 3.6, z, 0.08, 2.6, 0.08, 0x5a5670); B.box('metal', x, y + 2.35, z, 2.5, 0.16, 0.16, 0x3b3552); B.box('glowV', x, y + 2.25, z + 0.1, 2.3, 0.06, 0.02, 0xff2030, 0, 0, 0, 3); }, bottom: 2.25, top: 4.9, hw: 1.25, hd: 0.2 },
    ],
    block: [
      { build: (B, x, y, z) => { B.box('solid', x, y + 1.1, z, 2.2, 2.2, 1.2, 0x2b2640); B.box('glowV', x, y + 2.25, z, 1.8, 0.1, 0.9, 0x3fe0ff, 0, 0, 0, 2); }, h: 2.3, hw: 1.1, hd: 0.6, standable: true, noRamp: true },
    ],
  },
  office: {
    low: [
      { build: (B, x, y, z) => desk(B, x, y, z), h: 1.25, hw: 1.0, hd: 0.5 },
      { build: (B, x, y, z) => { B.box('solid', x, y + 0.55, z, 1.2, 1.1, 0.8, 0xe8e4f0); B.box('glowV', x, y + 1.12, z, 0.8, 0.04, 0.5, 0xa8f03a, 0, 0, 0, 2); }, h: 1.2, hw: 1.0, hd: 0.45, model: 'crates' },
    ],
    high: [
      { build: (B, x, y, z) => { B.box('metal', x, y + 2.8, z, 2.4, 0.7, 0.5, 0x9aa7c7); B.box('metal', x, y + 4.3, z, 0.1, 2.4, 0.1, 0x3b3552); }, bottom: 2.25, top: 3.3, hw: 1.2, hd: 0.3 },
    ],
    block: [
      { build: (B, x, y, z) => { B.box('solid', x, y + 1.0, z, 2.2, 2.0, 0.9, 0x9aa3c0); B.box('solid', x, y + 2.05, z, 2.25, 0.1, 0.95, 0x2b2640); }, h: 2.1, hw: 1.1, hd: 0.5, standable: true, noRamp: true },
      { build: (B, x, y, z) => { B.box('metal', x, y + 1.6, z, 2.2, 3.2, 0.12, 0xbfe8ff); B.box('solid', x, y + 3.2, z, 2.3, 0.12, 0.2, 0x1b1030); }, h: 3.3, hw: 1.1, hd: 0.2, noRamp: true },
    ],
  },
  rift: {
    low: [
      { build: (B, x, y, z) => { B.box('glowV', x, y + 0.6, z, 1.9, 1.2, 0.5, P.sky, 0, 0, 0, 2); B.box('solid', x, y + 0.2, z, 2.1, 0.4, 0.7, 0x1b1030); }, h: 1.25, hw: 1.0, hd: 0.4 },
    ],
    high: [
      { build: (B, x, y, z) => { B.box('glowV', x, y + 2.75, z, 2.4, 0.6, 0.4, P.hotPink, 0, 0, 0, 2.4); B.box('solid', x, y + 3.6, z, 2.6, 1.0, 0.6, 0x2b2640); }, bottom: 2.25, top: 4.1, hw: 1.2, hd: 0.3 },
    ],
    block: [
      { build: (B, x, y, z) => { B.box('solid', x, y + 2, z, 2.1, 4, 2.1, 0x3a2f66, 0, 0.4, 0); B.box('glowV', x, y + 4.1, z, 1.2, 0.2, 1.2, P.lime, 0, 0.4, 0, 2.5); }, h: 4.2, hw: 1.1, hd: 1.1, standable: true },
    ],
  },
  subway: {
    low: [
      { build: PR.turnstile, h: 1.15, hw: 1.0, hd: 0.45 },
      { build: PR.bumper, h: 1.3, hw: 1.0, hd: 0.6, model: 'crates' },
      { build: PR.bumper, h: 1.2, hw: 1.0, hd: 0.4 },
    ],
    high: [
      { build: PR.signalGantry, bottom: 2.25, top: 2.95, hw: 1.2, hd: 0.25 },
      { build: (B, x, y, z) => PR.hangingSign(B, `ad${Math.floor(Math.random() * 5)}`, x, y, z), bottom: 2.25, top: 4.7, hw: 1.15, hd: 0.2 },
    ],
    block: [{ build: (B, x, y, z) => PR.trainCar(B, x, y, z, 16, pick(TRAIN_STRIPES)), h: 3.9, hw: 1.2, hd: 8, moving: [0, 0, 12, 16], standable: true }],
  },
};

/** Real-model obstacle groups from the prop library (null if unavailable). */
function modelObstacle(kind) {
  if (!PROPS) return null;
  const g = new THREE.Group();
  if (kind === 'barrier' && PROPS.has('concrete_road_barrier_02')) {
    g.add(PROPS.group('concrete_road_barrier_02', 1.25));
  } else if (kind === 'aircon' && PROPS.has('exterior_aircon_unit')) {
    g.add(PROPS.group('exterior_aircon_unit', 1.3));
  } else if (kind === 'crates' && PROPS.has('wooden_crate_01')) {
    // A stack that bursts into separate tumbling pieces when smashed.
    const pieces = [['wooden_crate_01', -0.5, 0, 0, 1.2], ['wooden_crate_01', 0.5, 0, 0.1, 1.2], ['cardboard_box_01', 0, 0.45, 0, 1.2], ['cardboard_box_01', 0.55, 0.45, -0.1, 1.1], ['Barrel_01', -0.6, 0.45, 0, 0.8]];
    for (const [name, x, y, z, sc] of pieces) {
      const pg = PROPS.group(name, sc);
      pg.position.set(x, y, z);
      pg.rotation.y = rand(-0.4, 0.4);
      g.add(pg);
    }
    g.userData.breakable = true;
  } else return null;
  return g;
}

function spawnObstacle(seg, mats, kind, def, lane, d, moving) {
  let group = def.model ? modelObstacle(def.model) : null;
  if (!group) {
    const B = new Buckets();
    def.build(B, 0, 0, 0);
    group = new THREE.Group();
    finish(B, mats, group);
  }
  const x = lane * LW;
  const step = seg.stepAt(d);
  group.position.set(x, seg.floorY(d) + step, -d);
  seg.group.add(group);
  const ob = {
    kind, lane, d, x, group, alive: true, moving: moving || 0,
    hw: def.hw, hd: def.hd, standable: !!def.standable,
    // High obstacles are solid from their underside up: dive, don't hop.
    yMin: step + (kind === 'high' ? def.bottom : 0),
    yMax: step + (kind === 'high' ? 6 : def.h),
  };
  seg.obstacles.push(ob);
  // Parked trains and buses get a boarding ramp in front, Subway-Surfers style.
  if (def.standable && !moving && def.h > 3 && !def.noRamp && chance(0.75)) addRamp(seg, mats, lane, d - def.hd - 3.6, 3.6, def.h, step);
  return ob;
}

function addRamp(seg, mats, lane, d, hd, h, step) {
  const B = new Buckets();
  const len = hd * 2;
  const ang = Math.atan2(h, len);
  const slope = Math.hypot(len, h);
  B.box('metal', 0, h / 2, 0, 2.2, 0.18, slope, 0x9aa3c0, ang, 0, 0);
  for (let k = -0.9; k <= 0.9; k += 0.3) B.box('glowV', 0, h / 2 + k * Math.sin(ang) * slope * 0.5 + 0.11, -k * Math.cos(ang) * slope * 0.5, 2.0, 0.04, 0.08, P.butter, ang, 0, 0, 2.2);
  for (const x of [-1, 1]) B.box('solid', x * 1.0, h * 0.25, -hd * 0.5, 0.15, h * 0.5, 0.15, 0x3b3552);
  const group = new THREE.Group();
  finish(B, mats, group);
  group.position.set(lane * LW, seg.floorY(d) + step, -d);
  seg.group.add(group);
  seg.obstacles.push({ kind: 'block', lane, d, x: lane * LW, group, alive: true, moving: 0, hw: 1.2, hd, yMin: step, yMax: step + h, standable: true, ramp: true, noFling: true });
  // Nothing may sit on the ramp itself.
  seg.obstacles = seg.obstacles.filter((o) => {
    if (o.ramp || o.lane !== lane || Math.abs(o.d - d) > hd + 1.5 || o.standable) return true;
    seg.group.remove(o.group);
    return false;
  });
  seg.tokens.push(...[0.2, 0.5, 0.8].map((t) => ({ d: d - hd + t * hd * 2, x: lane * LW, y: step + h * t + 1.4, alive: true, seg })));
}

function addTokenLine(seg, lane, d0, d1, yFn) {
  for (let d = d0; d <= d1; d += 2.6) {
    seg.tokens.push({ d, x: lane * LW, y: (yFn ? yFn(d) : 1.6) + seg.stepAt(d), alive: true, seg });
  }
}

/** Remove obstacles/tokens a vehicle would drive through in its lane. */
function clearLaneBefore(seg, lane, d0, d1) {
  seg.obstacles = seg.obstacles.filter((o) => {
    if (o.lane === lane && o.d >= d0 && o.d < d1) {
      seg.group.remove(o.group);
      o.group.traverse((m) => m.isMesh && !m.geometry.userData.shared && m.geometry.dispose());
      return false;
    }
    return true;
  });
  seg.tokens = seg.tokens.filter((t) => !(Math.abs(t.x - lane * LW) < 0.1 && t.d >= d0 && t.d < d1));
}

function layoutGameplay(seg, mats, difficulty) {
  const set = OBSTACLES[seg.zone];
  const start = Math.max(seg.floorStart, seg.transStart + (seg.transLen > 1 ? seg.transLen : 0)) + (seg.index === 0 ? 110 : 26);
  const end = seg.length - (seg.turnEnd ? CFG.turnWindow + 10 : 16);
  let d = start;
  let lastMoving = -999;
  let lastWall = -999;
  let pickupPlaced = seg.index === 0 || !chance(0.55);
  const nearEdge = (dd) => (seg.steps || []).some((st) => Math.abs(dd - st.d0) < 5 || Math.abs(dd - st.d1) < 5);
  while (d < end) {
    if (nearEdge(d)) {
      d += 6;
      continue;
    }
    const lanes = [-1, 0, 1];
    const kinds = {};
    const r = Math.random();
    // A vehicle driving at you must never meet a two-block wall it could close.
    const canMove = (seg.zone === 'street' || seg.zone === 'subway') && d - lastMoving > 90 && d - lastWall > 120;
    let movingLane = null;
    if (canMove && r < 0.18 + difficulty * 0.1) {
      movingLane = pick(lanes);
      kinds[movingLane] = 'block';
    } else {
      // Gentle opening: mostly single obstacles, ramping to doubles/triples.
      const count = r < 0.72 - difficulty * 0.45 ? 1 : r < 0.95 - difficulty * 0.2 ? 2 : 3;
      const order = lanes.slice().sort(() => Math.random() - 0.5);
      let blocks = 0;
      for (let i = 0; i < count; i++) {
        let k = pick(['low', 'low', 'high', 'block', 'block']);
        if (k === 'block' && blocks >= (count === 2 && d - lastMoving > 90 ? 2 : 1)) k = pick(['low', 'high']);
        if (k === 'block') blocks++;
        kinds[order[i]] = k;
      }
      if (blocks >= 2) lastWall = d;
    }
    if (movingLane !== null) clearLaneBefore(seg, movingLane, d - 130, d);
    for (const lane of lanes) {
      const k = kinds[lane];
      if (!k) continue;
      const def = pick(set[k]);
      let mv = 0;
      if (lane === movingLane && def.moving) mv = pick(def.moving.filter((v) => v > 0)) || 0;
      spawnObstacle(seg, mats, k, def, lane, d, mv);
      if (mv) lastMoving = d;
    }
    // Tokens: arc over a LOW, or a straight line in a clear lane after the row.
    const lowLane = lanes.find((l) => kinds[l] === 'low');
    if (lowLane !== undefined && chance(0.5)) {
      addTokenLine(seg, lowLane, d - 5.2, d + 5.2, (t) => 1.6 + 3.0 * Math.cos(((t - d) / 10.4) * Math.PI));
    }
    const gap = rand(20, 30) + (1 - difficulty) * 6;
    const free = lanes.filter((l) => l !== movingLane);
    const tokenLane = pick(free);
    if (chance(0.8)) addTokenLine(seg, tokenLane, d + 5, d + gap - 5);
    if (!pickupPlaced && d > start + 40 && chance(0.35)) {
      const pl = pick(free.filter((l) => l !== tokenLane)) ?? tokenLane;
      seg.pickups.push({ d: d + gap / 2, x: pl * LW, y: 1.7 + seg.stepAt(d + gap / 2), type: pick(['magnet', 'shield', 'turbo', 'focus', 'spring', 'double', 'mystery', 'mystery']), alive: true, seg });
      pickupPlaced = true;
    }
    d += gap;
  }
  // Token trail around the corner helps players read the turn.
  if (seg.turnEnd) addTokenLine(seg, 0, seg.length - CFG.turnWindow, seg.length - 8);
  // Raised rooftops are solid steps across all lanes: hop up, land, run on.
  for (const st of seg.steps || []) {
    for (const lane of [-1, 0, 1]) {
      seg.obstacles.push({
        kind: 'block', lane, d: (st.d0 + st.d1) / 2, x: lane * LW, group: new THREE.Group(), alive: true, moving: 0,
        hw: 1.35, hd: (st.d1 - st.d0) / 2, yMin: 0, yMax: st.h, standable: true, step: true, noFling: true,
      });
    }
  }
}

/** Canvas label for junction signs. */
function labelMesh(text, w = 5.4) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#1b1030';
  c.fillRect(0, 0, 512, 128);
  c.font = 'bold 64px Bangers, Impact, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffd84a';
  c.fillText(text, 256, 68, 480);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t }));
  m.layers.set(LAYER_NO_OUTLINE);
  return m;
}

function arrowMesh(mats, dir) {
  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0.7);
  shape.lineTo(0.6, 0.7);
  shape.lineTo(0.6, 1.8);
  shape.lineTo(2.6, 0);
  shape.lineTo(0.6, -1.8);
  shape.lineTo(0.6, -0.7);
  shape.lineTo(-2.2, -0.7);
  shape.closePath();
  const arrow = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), mats.sign);
  arrow.scale.x = dir;
  arrow.layers.set(LAYER_NO_OUTLINE);
  return arrow;
}

/** T-junction: a big two-way sign naming where each road goes. */
function forkSign(seg, mats) {
  const L = seg.length;
  const y = seg.floorY(L);
  const z = -(L + W - 0.6);
  const B = new Buckets();
  B.box('solid', 0, y + 6.6, z + 0.1, 12.6, 5.4, 0.3, P.ink);
  for (const x of [-5.6, 5.6]) B.box('metal', x, y + 2.2, z + 0.1, 0.3, 4.4, 0.3, 0x3b3552);
  finish(B, mats, seg.group);
  for (const side of [-1, 1]) {
    const ar = arrowMesh(mats, side);
    ar.scale.multiplyScalar(0.8);
    ar.scale.x = side * 0.8;
    ar.position.set(side * 3.1, y + 7.4, z + 0.3);
    seg.group.add(ar);
    const lab = labelMesh(CFG.zoneNames?.[seg.forkZones[side]] || seg.forkZones[side], 5.6);
    lab.position.set(side * 3.1, y + 5.2, z + 0.28);
    seg.group.add(lab);
  }
  seg.sign = null;
}

function turnSign(seg, mats) {
  if (!seg.turnEnd) return;
  if (seg.fork) return forkSign(seg, mats);
  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0.7);
  shape.lineTo(0.6, 0.7);
  shape.lineTo(0.6, 1.8);
  shape.lineTo(2.6, 0);
  shape.lineTo(0.6, -1.8);
  shape.lineTo(0.6, -0.7);
  shape.lineTo(-2.2, -0.7);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  const arrow = new THREE.Mesh(geo, mats.sign);
  arrow.scale.x = seg.turnEnd;
  const L = seg.length;
  const y = seg.floorY(L);
  arrow.position.set(0, y + 6.5, -(L + W - 0.8));
  arrow.layers.set(LAYER_NO_OUTLINE);
  seg.group.add(arrow);
  const B = new Buckets();
  B.box('solid', 0, y + 6.5, -(L + W - 0.5), 6.2, 4.6, 0.3, P.ink);
  for (const x of [-2.6, 2.6]) B.box('metal', x, y + 2.2, -(L + W - 0.5), 0.25, 4.4, 0.25, 0x3b3552);
  finish(B, mats, seg.group);
  seg.sign = arrow;
}

export function buildSegment(seg, ctx) {
  seg.faces = []; // building faces the swing line can grab: {side, d0, d1, x, top}
  seg.floorStart = seg.turnStart ? W : seg.index === 0 ? -70 : 0;
  seg.floorEnd = seg.length + (seg.turnEnd ? W : 0);
  const B = new Buckets();
  if (seg.zone === 'street') buildStreet(seg, B);
  else if (seg.zone === 'roof') buildRoof(seg, B);
  else if (seg.zone === 'park') buildPark(seg, B);
  else if (seg.zone === 'rift') buildRift(seg, B);
  else if (seg.zone === 'office') buildOffice(seg, B);
  else if (seg.zone === 'prison') buildPrison(seg, B);
  else buildSubway(seg, B);
  // Bursting out of the office: a window to smash on the way out.
  if (seg.prevZone === 'office' && seg.zone !== 'office') glassPane(seg, seg.floorStart + 3, seg.prevBaseY);
  finish(B, ctx.mats, seg.group);
  layoutGameplay(seg, ctx.mats, Math.min(1, seg.index / 14));
  PROPS?.flush(seg);
  turnSign(seg, ctx.mats);
  seg.group.updateMatrixWorld(true);
  ctx.scene.add(seg.group);
}

export function disposeSegment(seg, ctx) {
  ctx.scene.remove(seg.group);
  for (const gl of seg.glass || []) {
    gl.mesh.material.dispose();
  }
  seg.group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}

export { glow };

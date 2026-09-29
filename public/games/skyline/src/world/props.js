import { PALETTE as P } from '../render/materials.js';

// Prop builders. Coordinates are segment-local: +x right, +y up, and the
// player approaches from +z (so vehicle fronts face +z).
// Bucket keys: solid, metal, glowV, bldBrick, bldGlass, adN, grafN.

export function waterTower(B, x, y, z, s = 1) {
  const legH = 2.4 * s;
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    B.cyl('metal', x + lx * s, y + legH / 2, z + lz * s, 0.09 * s, legH, 0x5b4a6b, 0, 0, 0, true);
  }
  B.box('metal', x, y + legH * 0.55, z, 2.0 * s, 0.08 * s, 0.08 * s, 0x5b4a6b);
  B.box('metal', x, y + legH * 0.55, z, 0.08 * s, 0.08 * s, 2.0 * s, 0x5b4a6b);
  B.cyl('solid', x, y + legH + 1.3 * s, z, 1.35 * s, 2.6 * s, 0xa9744f);
  for (let i = 0; i < 3; i++) {
    B.cyl('metal', x, y + legH + (0.5 + i * 0.8) * s, z, 1.39 * s, 0.1 * s, 0x3b2d4a, 0, 0, 0, true);
  }
  B.add('solid', PRIM_CONE(), m(x, y + legH + 3.05 * s, z, 3.0 * s, 0.9 * s, 3.0 * s), 0x6a4a3a);
}

export function acUnit(B, x, y, z, s = 1) {
  B.box('metal', x, y + 0.65 * s, z, 1.8 * s, 1.3 * s, 1.4 * s, 0xc9cfe0);
  B.box('solid', x, y + 1.32 * s, z, 1.2 * s, 0.06 * s, 1.0 * s, 0x2a2440);
  B.cyl('metal', x, y + 1.36 * s, z, 0.45 * s, 0.05 * s, 0x7b86a8);
  B.box('solid', x, y + 0.6 * s, z + 0.71 * s, 1.5 * s, 0.8 * s, 0.02, 0x8a93b3);
}

export function vent(B, x, y, z) {
  B.cyl('metal', x, y + 0.5, z, 0.3, 1.0, 0xb8bfd6);
  B.add('metal', PRIM_CONE(), m(x, y + 1.15, z, 0.9, 0.35, 0.9), 0x8a93b3);
}

export function antenna(B, x, y, z, h = 6) {
  B.cyl('metal', x, y + h / 2, z, 0.06, h, 0x9aa7c7, 0, 0, 0, true);
  for (let i = 1; i < 4; i++) B.box('metal', x, y + h * (i / 4), z, 1.4 - i * 0.3, 0.05, 0.05, 0x9aa7c7);
  B.add('glowV', PRIM_SPHERE(), m(x, y + h + 0.1, z, 0.25, 0.25, 0.25), 0xff3040, 3);
}

export function parapet(B, x, y, z, len, color) {
  B.box('solid', x, y + 0.35, z, 0.35, 0.7, len, color);
}

export function streetLight(B, x, y, z, side) {
  B.cyl('metal', x, y + 3.5, z, 0.1, 7, 0x2e2a4a, 0, 0, 0, true);
  B.box('metal', x - side * 1.1, y + 6.95, z, 2.3, 0.12, 0.12, 0x2e2a4a);
  B.box('solid', x - side * 2.1, y + 6.8, z, 0.7, 0.2, 0.35, 0x2e2a4a);
  B.box('glowV', x - side * 2.1, y + 6.66, z, 0.55, 0.08, 0.28, 0xffd9a0, 0, 0, 0, 4);
}

export function trafficSignal(B, x, y, z, side) {
  B.cyl('metal', x, y + 3, z, 0.12, 6, 0xffc21a, 0, 0, 0, true);
  B.box('metal', x - side * 2.4, y + 5.9, z, 4.8, 0.14, 0.14, 0xffc21a);
  const hx = x - side * 3.8;
  B.box('solid', hx, y + 5.3, z, 0.5, 1.4, 0.4, 0x1b1030);
  B.box('glowV', hx, y + 5.75, z + 0.21, 0.28, 0.28, 0.02, 0xff3040, 0, 0, 0, 3);
  B.box('glowV', hx, y + 5.3, z + 0.21, 0.28, 0.28, 0.02, 0x3a2020, 0, 0, 0, 1);
  B.box('glowV', hx, y + 4.85, z + 0.21, 0.28, 0.28, 0.02, 0x203a20, 0, 0, 0, 1);
}

export function hydrant(B, x, y, z) {
  B.cyl('solid', x, y + 0.4, z, 0.2, 0.8, 0xff3040);
  B.add('solid', PRIM_SPHERE(), m(x, y + 0.82, z, 0.4, 0.3, 0.4), 0xff3040);
  B.cyl('solid', x, y + 0.5, z, 0.08, 0.6, 0xff3040, 0, 0, Math.PI / 2);
}

export function neonStrip(B, x, y, z, w, h, color, faceSide) {
  // Thin emissive sign mounted on a wall that faces the corridor.
  B.box('solid', x, y, z, 0.25, h + 0.3, w + 0.3, 0x1b1030);
  B.box('glowV', x - faceSide * 0.15, y, z, 0.06, h, w, color, 0, 0, 0, 3.2);
}

export function billboard(B, adKey, x, y, z, w, h, ry, posts = true) {
  // Frame + legs; the ad face itself goes into an adN bucket.
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  B.box('solid', x, y + h / 2, z, w + 0.4, h + 0.4, 0.3, 0x1b1030, 0, ry);
  B.quad(adKey, x + sin * 0.17, y + h / 2, z + cos * 0.17, w, h, 0, ry, 0);
  if (posts) {
    for (const k of [-0.35, 0.35]) {
      B.box('metal', x + cos * w * k, y - 1.5, z - sin * w * k, 0.2, 3, 0.2, 0x3b3552, 0, ry);
    }
  }
  // Spot lights along the bottom edge.
  B.box('glowV', x + sin * 0.5, y + 0.1, z + cos * 0.5, w * 0.9, 0.12, 0.12, 0xfff1d6, 0, ry, 0, 2.2);
}

// ── Obstacles (built into their own bucket per obstacle) ──

export function barrier(B, x, y, z) {
  for (const k of [-0.9, 0.9]) {
    B.box('solid', x + k, y + 0.5, z + 0.25, 0.1, 1.0, 0.1, 0xfff1d6, 0.3);
    B.box('solid', x + k, y + 0.5, z - 0.25, 0.1, 1.0, 0.1, 0xfff1d6, -0.3);
  }
  for (let i = 0; i < 5; i++) {
    B.box('solid', x - 0.8 + i * 0.4, y + 0.95, z, 0.4, 0.34, 0.08, i % 2 ? 0xff6b3d : 0xffffff);
  }
  B.box('solid', x, y + 0.55, z, 2.0, 0.12, 0.06, 0xfff1d6);
  B.add('glowV', PRIM_SPHERE(), m(x - 0.9, y + 1.25, z, 0.18, 0.18, 0.18), 0xff9a2e, 3);
  B.add('glowV', PRIM_SPHERE(), m(x + 0.9, y + 1.25, z, 0.18, 0.18, 0.18), 0xff9a2e, 3);
}

export function jersey(B, x, y, z) {
  B.box('solid', x, y + 0.35, z, 2.0, 0.7, 0.8, 0xd8d2e6);
  B.box('solid', x, y + 0.95, z, 2.0, 0.5, 0.35, 0xd8d2e6);
  B.box('solid', x, y + 0.75, z + 0.3, 2.02, 0.12, 0.2, 0xff6b3d, -0.6);
}

export function turnstile(B, x, y, z) {
  B.box('metal', x - 0.8, y + 0.55, z, 0.35, 1.1, 0.8, 0xb8bfd6);
  B.box('metal', x + 0.8, y + 0.55, z, 0.35, 1.1, 0.8, 0xb8bfd6);
  B.cyl('metal', x - 0.45, y + 0.85, z, 0.05, 0.9, 0x9aa7c7, 0, 0, Math.PI / 2);
  B.cyl('metal', x + 0.45, y + 0.85, z, 0.05, 0.9, 0x9aa7c7, 0, 0, Math.PI / 2);
  B.box('glowV', x - 0.8, y + 1.12, z + 0.2, 0.2, 0.05, 0.2, 0x3fe07a, 0, 0, 0, 3);
  B.box('glowV', x + 0.8, y + 1.12, z + 0.2, 0.2, 0.05, 0.2, 0x3fe07a, 0, 0, 0, 3);
}

export function bumper(B, x, y, z) {
  B.box('solid', x, y + 0.6, z, 2.0, 1.2, 0.7, 0x2a2440);
  for (let i = 0; i < 5; i++) {
    B.box('solid', x - 0.8 + i * 0.4, y + 0.6, z + 0.36, 0.38, 1.1, 0.02, i % 2 ? 0xffd84a : 0x1b1030);
  }
  B.box('glowV', x - 0.6, y + 1.05, z + 0.38, 0.25, 0.18, 0.04, 0xff3040, 0, 0, 0, 3);
  B.box('glowV', x + 0.6, y + 1.05, z + 0.38, 0.25, 0.18, 0.04, 0xff3040, 0, 0, 0, 3);
}

export function roofShed(B, x, y, z) {
  B.box('solid', x, y + 2.1, z, 2.1, 4.2, 2.6, 0xc8583f);
  B.box('solid', x, y + 4.3, z, 2.4, 0.25, 2.9, 0x6a4a3a);
  B.box('solid', x, y + 1.2, z + 1.31, 1.0, 2.2, 0.04, 0x3b2d4a);
  B.box('glowV', x, y + 2.6, z + 1.33, 0.5, 0.25, 0.03, 0x3fe07a, 0, 0, 0, 3);
}

/** Hanging sign across one lane: posts at lane edges + a panel you must dive under. */
export function hangingSign(B, adKey, x, y, z, bottom = 2.25) {
  const top = bottom + 2.4;
  for (const k of [-1.2, 1.2]) B.cyl('metal', x + k, y + (top + 0.3) / 2, z, 0.08, top + 0.3, 0x3b3552, 0, 0, 0, true);
  B.box('solid', x, y + (bottom + top) / 2, z, 2.3, top - bottom, 0.25, 0x1b1030);
  B.quad(adKey, x, y + (bottom + top) / 2, z + 0.14, 2.1, top - bottom - 0.2, 0, 0, 0);
  B.box('glowV', x, y + bottom - 0.05, z + 0.1, 2.2, 0.08, 0.08, 0xfff1d6, 0, 0, 0, 2.5);
}

export function scaffoldBeam(B, x, y, z, bottom = 2.25) {
  for (const k of [-1.2, 1.2]) B.cyl('metal', x + k, y + 3.2, z, 0.09, 6.4, 0xffc21a, 0, 0, 0, true);
  B.box('metal', x, y + bottom + 0.45, z, 2.6, 0.9, 0.5, 0xff9a2e);
  B.box('solid', x, y + bottom + 0.45, z + 0.26, 2.6, 0.3, 0.02, 0x1b1030);
  B.box('metal', x, y + 6.3, z, 2.6, 0.18, 0.18, 0xffc21a);
  B.box('glowV', x - 1.1, y + bottom + 0.2, z + 0.3, 0.15, 0.15, 0.05, 0xff3040, 0, 0, 0, 3.5);
  B.box('glowV', x + 1.1, y + bottom + 0.2, z + 0.3, 0.15, 0.15, 0.05, 0xff3040, 0, 0, 0, 3.5);
}

export function signalGantry(B, x, y, z, bottom = 2.25) {
  B.box('metal', x, y + bottom + 0.35, z, 2.4, 0.7, 0.4, 0x3b3552);
  B.cyl('metal', x, y + (bottom + 7.8) / 2, z, 0.07, 8 - bottom, 0x3b3552, 0, 0, 0, true);
  B.box('glowV', x - 0.6, y + bottom + 0.35, z + 0.21, 0.3, 0.3, 0.03, 0xff3040, 0, 0, 0, 3.5);
  B.box('glowV', x, y + bottom + 0.35, z + 0.21, 0.3, 0.3, 0.03, 0xffd84a, 0, 0, 0, 2);
  B.box('glowV', x + 0.6, y + bottom + 0.35, z + 0.21, 0.3, 0.3, 0.03, 0x3fe07a, 0, 0, 0, 2);
}

export function taxi(B, x, y, z) {
  B.box('solid', x, y + 0.6, z, 1.9, 0.7, 4.2, P.taxi);
  B.box('solid', x, y + 1.2, z - 0.2, 1.7, 0.6, 2.3, P.taxi);
  B.box('metal', x, y + 1.2, z + 0.97, 1.55, 0.5, 0.05, 0x3d4f86, -0.35);
  B.box('solid', x, y + 1.62, z - 0.2, 0.7, 0.22, 0.35, 0xfff1d6);
  B.box('solid', x, y + 0.66, z, 1.92, 0.12, 4.0, 0x1b1030);
  for (const [wx, wz] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
    B.cyl('solid', x + wx, y + 0.35, z + wz, 0.35, 0.3, 0x1b1030, 0, 0, Math.PI / 2);
  }
  B.box('glowV', x - 0.65, y + 0.65, z + 2.11, 0.35, 0.2, 0.03, 0xfff6d0, 0, 0, 0, 4);
  B.box('glowV', x + 0.65, y + 0.65, z + 2.11, 0.35, 0.2, 0.03, 0xfff6d0, 0, 0, 0, 4);
}

export function bus(B, x, y, z) {
  B.box('solid', x, y + 1.7, z, 2.3, 2.9, 9, 0x3fc7ff);
  B.box('solid', x, y + 0.45, z, 2.32, 0.5, 9.02, 0x1b1030);
  B.box('metal', x, y + 2.2, z + 4.51, 2.0, 1.3, 0.04, 0x3d4f86);
  B.box('solid', x, y + 3.25, z, 2.32, 0.2, 9.02, 0xfff1d6);
  B.box('metal', x - 1.16, y + 2.2, z, 0.04, 1.0, 7.5, 0x3d4f86);
  B.box('metal', x + 1.16, y + 2.2, z, 0.04, 1.0, 7.5, 0x3d4f86);
  B.box('glowV', x, y + 3.0, z + 4.52, 1.4, 0.25, 0.03, 0xffb020, 0, 0, 0, 3);
  B.box('glowV', x - 0.8, y + 0.8, z + 4.52, 0.35, 0.2, 0.03, 0xfff6d0, 0, 0, 0, 4);
  B.box('glowV', x + 0.8, y + 0.8, z + 4.52, 0.35, 0.2, 0.03, 0xfff6d0, 0, 0, 0, 4);
}

export function trainCar(B, x, y, z, len = 16, stripe = 0xff3fa4) {
  B.box('metal', x, y + 2.0, z, 2.4, 3.4, len, 0xc3cbe0);
  B.box('solid', x, y + 1.3, z, 2.42, 0.35, len + 0.02, stripe);
  B.box('solid', x, y + 3.75, z, 2.2, 0.2, len - 0.4, 0x8a93b3);
  // Lit windows down both sides.
  for (let i = -len / 2 + 1.5; i < len / 2 - 1; i += 2.2) {
    B.box('glowV', x - 1.215, y + 2.4, z + i, 0.02, 0.8, 1.4, 0xfff0c0, 0, 0, 0, 2.2);
    B.box('glowV', x + 1.215, y + 2.4, z + i, 0.02, 0.8, 1.4, 0xfff0c0, 0, 0, 0, 2.2);
  }
  const f = z + len / 2;
  B.box('solid', x, y + 2.0, f + 0.02, 2.3, 3.3, 0.04, 0x2a2440);
  B.box('metal', x, y + 2.6, f + 0.05, 1.8, 1.0, 0.03, 0x3d4f86);
  B.box('glowV', x - 0.75, y + 0.9, f + 0.06, 0.4, 0.3, 0.03, 0xffffff, 0, 0, 0, 5);
  B.box('glowV', x + 0.75, y + 0.9, f + 0.06, 0.4, 0.3, 0.03, 0xffffff, 0, 0, 0, 5);
  B.box('glowV', x, y + 3.45, f + 0.06, 0.8, 0.28, 0.03, 0xffd84a, 0, 0, 0, 3);
}

// Local geometry helpers (avoid circular import of PRIM at module top).
import { PRIM, mat4 } from './geo.js';
const PRIM_CONE = () => PRIM.cone;
const PRIM_SPHERE = () => PRIM.sphere;
const m = (x, y, z, sx, sy, sz) => mat4(x, y, z, sx, sy, sz);

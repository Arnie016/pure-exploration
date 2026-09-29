import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const cache = new Map();

/**
 * Physically based surface with bright colours. `rough`/`metal` give the touch
 * of realism; emissive options make neon and lit windows feed the bloom.
 */
export function surface(color, opts = {}) {
  const key = JSON.stringify([
    color, opts.rough, opts.metal, opts.emissive, opts.ei, opts.vc, opts.side,
    opts.map?.uuid, opts.emissiveMap?.uuid, opts.transparent, opts.opacity, opts.env,
  ]);
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.72,
    metalness: opts.metal ?? 0.0,
    vertexColors: !!opts.vc,
    side: opts.side ?? THREE.FrontSide,
    map: opts.map ?? null,
    envMapIntensity: opts.env ?? 1,
  });
  if (opts.emissive !== undefined || opts.emissiveMap) {
    m.emissive = new THREE.Color(opts.emissive ?? 0xffffff);
    m.emissiveIntensity = opts.ei ?? 1;
    m.emissiveMap = opts.emissiveMap ?? null;
  }
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 0.5;
    m.depthWrite = false;
  }
  cache.set(key, m);
  return m;
}

/** Unlit glowing material. Intensity > 1 pushes it past the bloom threshold. */
export function glow(color, intensity = 2.5, opts = {}) {
  const key = `glow|${color}|${intensity}|${opts.transparent ? opts.opacity : ''}|${opts.side ?? ''}|${opts.additive ? 1 : 0}`;
  let m = cache.get(key);
  if (m) return m;
  const c = new THREE.Color(color).multiplyScalar(intensity);
  m = new THREE.MeshBasicMaterial({ color: c, side: opts.side ?? THREE.FrontSide, fog: opts.fog ?? true });
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 0.6;
    m.depthWrite = false;
    m.blending = opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  }
  cache.set(key, m);
  return m;
}

/** Image-based lighting so metal, glass and wet asphalt pick up reflections. */
export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

// Bright, contrasting city palette.
export const PALETTE = {
  ink: 0x1b1030,
  coral: 0xff6b6b,
  hotPink: 0xff3fa4,
  magenta: 0xd63cff,
  violet: 0x7b4dff,
  sky: 0x3fc7ff,
  teal: 0x19d3b5,
  lime: 0xa8f03a,
  butter: 0xffd84a,
  orange: 0xff9a2e,
  cream: 0xfff1d6,
  slate: 0x4a4f78,
  navy: 0x232a5c,
  brick: 0xc8583f,
  sand: 0xe9c08c,
  mint: 0x9bf5d5,
  lilac: 0xc9a7ff,
  steel: 0x9aa7c7,
  concrete: 0xb9b2c6,
  taxi: 0xffc21a,
};

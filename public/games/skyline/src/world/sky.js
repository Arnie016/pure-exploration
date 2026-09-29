import * as THREE from 'three';
import { Buckets } from './geo.js';

// Per-zone atmosphere. The game lerps between these as zones change.
export const ATMOS = {
  roof: {
    top: 0x2c3fb8, horizon: 0xffa06b, bottom: 0xff7fae, fog: 0xf7a98f, fogNear: 150, fogFar: 700,
    hemiSky: 0xffe6f2, hemiGround: 0x5a4a9a, hemi: 1.15, sun: 0xffe0b0, sunI: 2.8, exposure: 1.0,
  },
  street: {
    top: 0x1e1a66, horizon: 0xff6fa8, bottom: 0xc05ad0, fog: 0xc873b4, fogNear: 110, fogFar: 520,
    hemiSky: 0xffd0ec, hemiGround: 0x3a3a8a, hemi: 1.0, sun: 0xffb89a, sunI: 2.1, exposure: 1.05,
  },
  prison: {
    top: 0x121018, horizon: 0x2a2436, bottom: 0x1a1622, fog: 0x2a2030, fogNear: 40, fogFar: 220,
    hemiSky: 0xf0f4ff, hemiGround: 0x4a3a5a, hemi: 0.95, sun: 0xfff0e0, sunI: 0.6, exposure: 0.95,
  },
  office: {
    top: 0x2a3fb8, horizon: 0xffb07a, bottom: 0xff9fc0, fog: 0xe8c8d8, fogNear: 60, fogFar: 320,
    hemiSky: 0xfff6ea, hemiGround: 0x8a7aa8, hemi: 1.35, sun: 0xffe0b0, sunI: 1.4, exposure: 1.02,
  },
  park: {
    top: 0x2a7ad8, horizon: 0xffe0a0, bottom: 0x9fe0a8, fog: 0xd8e8b8, fogNear: 140, fogFar: 640,
    hemiSky: 0xfff6d8, hemiGround: 0x3f7a4a, hemi: 1.2, sun: 0xfff0c0, sunI: 2.9, exposure: 1.02,
  },
  rift: {
    top: 0x08031c, horizon: 0x19d3b5, bottom: 0x7b4dff, fog: 0x3a1a6a, fogNear: 90, fogFar: 480,
    hemiSky: 0xb8fff0, hemiGround: 0x5a1a8a, hemi: 1.1, sun: 0xd0b0ff, sunI: 1.8, exposure: 1.05,
  },
  subway: {
    top: 0x14122e, horizon: 0x3a2f66, bottom: 0x241d44, fog: 0x2d2650, fogNear: 45, fogFar: 260,
    hemiSky: 0xe8f4ff, hemiGround: 0x2a5a66, hemi: 0.85, sun: 0xfff0e0, sunI: 0.7, exposure: 0.95,
  },
};

const SKY_VS = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const SKY_FS = /* glsl */ `
  uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
  uniform float time;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
    float sd = max(dot(d, normalize(sunDir)), 0.0);
    col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.45 + pow(sd, 3.0) * 0.12);
    // Painterly cloud streaks near the horizon.
    vec2 uv = vec2(atan(d.z, d.x) * 3.0, h * 14.0);
    float n = noise(uv * vec2(1.0, 1.0) + vec2(time * 0.01, 0.0)) * 0.6 + noise(uv * 2.7) * 0.4;
    float band = smoothstep(0.02, 0.1, h) * smoothstep(0.42, 0.14, h);
    float cloud = smoothstep(0.55, 0.78, n) * band;
    vec3 cloudCol = mix(vec3(1.0, 0.86, 0.9), sunColor * 1.2, pow(sd, 4.0));
    col = mix(col, cloudCol, cloud * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  constructor(scene) {
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0.55, 0.32, -0.62) },
      sunColor: { value: new THREE.Color(0xffe0b0) },
      time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.skyline = this.buildSkyline();
    scene.add(this.skyline);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshStandardMaterial({ color: 0x3e3860, roughness: 0.95 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -14.5; // below the subway so trenches stay open
    this.ground.receiveShadow = false;
    scene.add(this.ground);
  }

  /** Ring of distant towers that travels with the camera: an endless city. */
  buildSkyline() {
    const B = new Buckets();
    const cols = [0x6f5fb0, 0x8a6fc0, 0x5a58a8, 0x9a78c8, 0x7b6ab8];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + Math.random() * 0.05;
      const r = 430 + Math.random() * 180;
      const w = 18 + Math.random() * 30;
      const h = 60 + Math.random() * 190;
      B.building('bldGlass', Math.cos(a) * r, 0, Math.sin(a) * r, w, h, w * (0.7 + Math.random() * 0.6), cols[i % cols.length]);
      if (Math.random() < 0.3) B.cyl('metal', Math.cos(a) * r, h + 12, Math.sin(a) * r, 0.6, 24, 0x9aa7c7, 0, 0, 0, true);
    }
    const g = new THREE.Group();
    this.skylineBuckets = B;
    return g;
  }

  finishSkyline(mats) {
    this.skylineBuckets.build(mats, this.skyline);
    this.skylineBuckets = null;
  }

  apply(a) {
    this.uniforms.top.value.copy(a.top);
    this.uniforms.horizon.value.copy(a.horizon);
    this.uniforms.bottom.value.copy(a.bottom);
    this.uniforms.sunColor.value.copy(a.sun);
  }

  update(camera, dt) {
    this.uniforms.time.value += dt;
    this.dome.position.copy(camera.position);
    this.skyline.position.set(camera.position.x, 0, camera.position.z);
    this.ground.position.x = camera.position.x;
    this.ground.position.z = camera.position.z;
  }
}

/** Mutable atmosphere state that eases toward a zone preset. */
export class Atmosphere {
  constructor() {
    this.cur = this.fromPreset(ATMOS.roof);
  }
  fromPreset(p) {
    return {
      top: new THREE.Color(p.top), horizon: new THREE.Color(p.horizon), bottom: new THREE.Color(p.bottom),
      fog: new THREE.Color(p.fog), fogNear: p.fogNear, fogFar: p.fogFar,
      hemiSky: new THREE.Color(p.hemiSky), hemiGround: new THREE.Color(p.hemiGround), hemi: p.hemi,
      sun: new THREE.Color(p.sun), sunI: p.sunI, exposure: p.exposure,
    };
  }
  approach(zone, k) {
    const t = this.fromPreset(ATMOS[zone]);
    const c = this.cur;
    for (const key of ['top', 'horizon', 'bottom', 'fog', 'hemiSky', 'hemiGround', 'sun']) c[key].lerp(t[key], k);
    for (const key of ['fogNear', 'fogFar', 'hemi', 'sunI', 'exposure']) c[key] += (t[key] - c[key]) * k;
    return c;
  }
  snap(zone) {
    this.cur = this.fromPreset(ATMOS[zone]);
    return this.cur;
  }
}

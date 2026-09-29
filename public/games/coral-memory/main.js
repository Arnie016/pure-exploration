import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { escapeText, sanitizeStore } from "./reef-storage.mjs";

const $ = (id) => document.getElementById(id);
const vpEl = document.getElementById("viewport");
const T0 = 2019, T1 = 2026;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260821);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gauss = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (2 * w * w));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.55, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return v;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
} catch (e) {
  $("fallback").hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(vpEl.clientWidth, vpEl.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("scene").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color("#0c1c28"), 0.028);

const camera = new THREE.PerspectiveCamera(55, vpEl.clientWidth / vpEl.clientHeight, 0.1, 600);
camera.position.set(-30, 46, 42);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 70;
controls.maxPolarAngle = 1.44;
controls.minPolarAngle = 0.12;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.target.set(0, 2, 0);
controls.autoRotate = !RM;
controls.autoRotateSpeed = 0.32;

const hemi = new THREE.HemisphereLight(new THREE.Color("#3a7482"), new THREE.Color("#0c1a22"), 1.08);
scene.add(hemi);
const sun = new THREE.DirectionalLight(new THREE.Color("#d6e8da"), 1.7);
sun.position.set(14, 60, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -95;
sun.shadow.camera.right = 95;
sun.shadow.camera.top = 95;
sun.shadow.camera.bottom = -95;
sun.shadow.camera.near = 15;
sun.shadow.camera.far = 150;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);
const fillLight = new THREE.DirectionalLight(new THREE.Color("#6fa8a0"), 0.5);
fillLight.position.set(-18, 12, -22);
scene.add(fillLight);

const domeMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color("#1f5a66") },
    mid: { value: new THREE.Color("#12293a") },
    bot: { value: new THREE.Color("#0c1c28") }
  },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
    void main(){
      float h = normalize(vP).y;
      vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.9, h))
                        : mix(bot, mid, smoothstep(-0.32, 0.12, h));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), domeMat));

function causticTexture(seed) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 512);
  const r = mulberry32(seed);
  for (let i = 0; i < 130; i++) {
    const x = r() * 512, y = r() * 512, rad = 14 + r() * 52;
    const grad = g.createRadialGradient(x, y, rad * 0.15, x, y, rad);
    grad.addColorStop(0, "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const causticsA = causticTexture(7);
const causticsB = causticTexture(23);

function heightToNormal(heightCanvas, strength = 1) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const sd = heightCanvas.getContext("2d").getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d");
  const od = octx.createImageData(w, h);
  const hgt = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * strength;
      const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * strength;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * w + x) * 4;
      od.data[i] = (-dx * nz * 0.5 + 0.5) * 255;
      od.data[i + 1] = (-dy * nz * 0.5 + 0.5) * 255;
      od.data[i + 2] = nz * 255;
      od.data[i + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function sandMaps() {
  const h = document.createElement("canvas");
  h.width = h.height = 256;
  const g = h.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const y0 = (i / 26) * 256 + (rng() - 0.5) * 14;
    const amp = 2 + rng() * 5;
    const freq = 0.02 + rng() * 0.03;
    const ph = rng() * 9;
    g.strokeStyle = i % 2 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";
    g.lineWidth = 2.5 + rng() * 3;
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, y0 + Math.sin(x * freq + ph) * amp);
    g.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rng() < 0.5 ? "0,0,0" : "255,255,255"},${0.05 + rng() * 0.1})`;
    g.fillRect(rng() * 256, rng() * 256, 1 + rng() * 1.6, 1 + rng() * 1.6);
  }
  const color = document.createElement("canvas");
  color.width = color.height = 512;
  const cg = color.getContext("2d");
  cg.fillStyle = "#c4ae7e";
  cg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    const x = rng() * 512, y = rng() * 512, r = 24 + rng() * 70;
    const grad = cg.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(58,74,52,${0.10 + rng() * 0.14})`);
    grad.addColorStop(1, "rgba(58,74,52,0)");
    cg.fillStyle = grad;
    cg.beginPath(); cg.arc(x, y, r, 0, Math.PI * 2); cg.fill();
  }
  for (let i = 0; i < 9000; i++) {
    cg.fillStyle = rng() < 0.5 ? "rgba(60,48,30,0.09)" : "rgba(235,225,200,0.08)";
    cg.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2);
  }
  const colorTex = new THREE.CanvasTexture(color);
  colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(10, 10);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  const normalTex = heightToNormal(h, 1.4);
  normalTex.repeat.set(26, 26);
  return { colorTex, normalTex };
}

function polypNormal() {
  const h = document.createElement("canvas");
  h.width = h.height = 256;
  const g = h.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 950; i++) {
    const x = rng() * 256, y = rng() * 256, r = 1.6 + rng() * 3.4;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(175,175,175,0.9)");
    grad.addColorStop(0.7, "rgba(120,120,120,0.5)");
    grad.addColorStop(1, "rgba(128,128,128,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = heightToNormal(h, 1.8);
  t.repeat.set(3, 3);
  return t;
}

function mottleMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = rng() * 256, y = rng() * 256, r = 4 + rng() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() < 0.55;
    grad.addColorStop(0, dark ? "rgba(70,50,30,0.10)" : "rgba(255,245,225,0.10)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SAND = sandMaps();
const POLYP = polypNormal();
const MOTTLE = mottleMap();

function radialFadeCanvas(inner = 0.45) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 128 * inner, 128, 128, 128);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#000000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function terrainHeight(x, z) {
  const bowl = Math.exp(-(x * x + z * z) / 9000);
  return fbm(x * 0.02 + 9, z * 0.02 + 3, 4) * 7 * (0.35 + 0.65 * (1 - bowl)) - bowl * 2.2
    + (fbm(x * 0.11 + 41, z * 0.11 + 17, 2) - 0.5) * 0.5;
}

const glowUniform = { value: 0 };
let terrainMat = null;
{
  const geo = new THREE.PlaneGeometry(240, 240, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const sand = new THREE.Color("#77684a"), deepSand = new THREE.Color("#243a46"), tint = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = pos.getY(i);
    pos.setY(i, h);
    const d = clamp((-h + 4) / 12, 0, 1);
    tint.copy(sand).lerp(deepSand, d * d).multiplyScalar(0.78 + hash2(i, 3) * 0.22);
    colors.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0,
    map: SAND.colorTex,
    normalMap: SAND.normalTex,
    normalScale: new THREE.Vector2(0.9, 0.9),
    emissive: new THREE.Color("#a8dce8"), emissiveIntensity: 0.42
  });
  mat.emissiveMap = causticsA;
  terrainMat = mat;
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#31494f"), roughness: 1,
    normalMap: POLYP, normalScale: new THREE.Vector2(0.4, 0.4)
  });
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2, rad = 26 + rng() * 70;
    const rg = new THREE.IcosahedronGeometry(1.6 + rng() * 3.4, 1);
    const rp = rg.attributes.position;
    const rv = new THREE.Vector3();
    for (let vi = 0; vi < rp.count; vi++) {
      rv.fromBufferAttribute(rp, vi).multiplyScalar(0.82 + hash2(vi * 3.1, i) * 0.4);
      rp.setXYZ(vi, rv.x, rv.y * 0.72, rv.z);
    }
    rg.computeVertexNormals();
    const rock = new THREE.Mesh(rg, rockMat);
    rock.position.set(Math.cos(a) * rad, terrainHeight(Math.cos(a) * rad, Math.sin(a) * rad) + 0.3, Math.sin(a) * rad);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

const surface = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshBasicMaterial({ color: new THREE.Color("#1a4756"), transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false, alphaMap: radialFadeCanvas(0.35) })
);
surface.rotation.x = Math.PI / 2;
surface.position.y = 24;
scene.add(surface);

const shimmerTex = causticTexture(51);
shimmerTex.repeat.set(10, 10);
const shimmer = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshBasicMaterial({ map: shimmerTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, alphaMap: radialFadeCanvas(0.3) })
);
shimmer.rotation.x = Math.PI / 2;
shimmer.position.y = 23.6;
scene.add(shimmer);

const shimmer2Tex = causticTexture(77);
shimmer2Tex.repeat.set(8, 8);
const shimmer2 = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshBasicMaterial({ map: shimmer2Tex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, alphaMap: radialFadeCanvas(0.3) })
);
shimmer2.rotation.x = Math.PI / 2;
shimmer2.position.y = 23.2;
scene.add(shimmer2);

{
  const shaftCanvas = document.createElement("canvas");
  shaftCanvas.width = 64; shaftCanvas.height = 256;
  const sg = shaftCanvas.getContext("2d");
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(210,240,240,0.85)");
  grad.addColorStop(1, "rgba(210,240,240,0)");
  sg.fillStyle = grad;
  sg.fillRect(18, 0, 28, 256);
  const shaftTex = new THREE.CanvasTexture(shaftCanvas);
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  window.__shafts = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), shaftMat.clone());
    s.material.opacity = 0.035 + rng() * 0.04;
    s.userData.base = s.material.opacity;
    const a = i * 1.7 + 0.5;
    s.position.set(Math.cos(a) * 16, 16, Math.sin(a) * 16);
    s.rotation.z = 0.22;
    s.rotation.y = -a;
    scene.add(s);
    window.__shafts.push(s);
  }
}

const GENERA = [
  { name: "Acropora", hue: "#d29a55", suscept: 1.0 },
  { name: "Porites", hue: "#b3922f", suscept: 0.45 },
  { name: "Montipora", hue: "#d06e3a", suscept: 0.8 },
  { name: "Stylophora", hue: "#d9a887", suscept: 0.85 },
  { name: "Pocillopora", hue: "#c06a4e", suscept: 0.95 },
  { name: "Turbinaria", hue: "#a88f3e", suscept: 0.6 }
];

function makeBranching() {
  const geos = [];
  const trunkH = 0.7;
  const trunk = new THREE.CylinderGeometry(0.1, 0.16, trunkH, 8, 3);
  trunk.translate(0, trunkH / 2, 0);
  geos.push(trunk);
  function branch(origin, dir, len, rad, depth) {
    const end = origin.clone().add(dir.clone().multiplyScalar(len));
    const g = new THREE.CylinderGeometry(rad * 0.66, rad, len, 7, 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q);
    g.translate((origin.x + end.x) / 2, (origin.y + end.y) / 2, (origin.z + end.z) / 2);
    geos.push(g);
    if (depth <= 0) {
      const tip = new THREE.SphereGeometry(rad * 0.95, 7, 6);
      tip.translate(end.x, end.y, end.z);
      geos.push(tip);
      return;
    }
    const n = depth === 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const nd = dir.clone()
        .add(new THREE.Vector3(rng() - 0.5, rng() * 0.75 + 0.25, rng() - 0.5).multiplyScalar(0.85))
        .normalize();
      branch(end, nd, len * (0.62 + rng() * 0.16), rad * 0.62, depth - 1);
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    branch(
      new THREE.Vector3(0, trunkH * 0.75, 0),
      new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(),
      0.95, 0.15, 3
    );
  }
  return mergeGeometries(geos);
}

function makeMassive() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const lumps = fbm(v.x * 4.2 + 40, v.z * 4.2 + 11, 3);
    const warts = fbm(v.x * 11 + 7, v.y * 11 + 3, 2);
    const bump = 0.74 + lumps * 0.42 + (warts - 0.5) * 0.24;
    v.multiplyScalar(bump);
    p.setXYZ(i, v.x, Math.max(v.y * 0.75 + 0.14, -0.3), v.z);
  }
  g.computeVertexNormals();
  return g;
}

function makeTable() {
  const stem = new THREE.CylinderGeometry(0.11, 0.16, 0.9, 8, 2);
  stem.translate(0, 0.45, 0);
  const disc = new THREE.CylinderGeometry(1.25, 1.16, 0.1, 30, 1);
  disc.translate(0, 0.94, 0);
  const dp = disc.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i), z = dp.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    if (r > 0.2) {
      const a = Math.atan2(z, x);
      dp.setY(i, dp.getY(i) + Math.sin(a * 9) * 0.022 * r + Math.sin(a * 3 + 1) * 0.015 * r);
    }
  }
  disc.computeVertexNormals();
  const rim = new THREE.TorusGeometry(1.2, 0.06, 6, 34);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.95, 0);
  return mergeGeometries([stem, disc, rim]);
}

function makeFan() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5);
  trunk.translate(0, 0.25, 0);
  parts.push(trunk);
  const plane = new THREE.PlaneGeometry(1.5, 1.7, 14, 16);
  const p = plane.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(x * 7.5) * 0.055 + Math.sin(y * 5.2 + x * 2) * 0.04);
    p.setX(i, x * (0.35 + 0.65 * ((y + 0.85) / 1.7)));
  }
  plane.translate(0, 1.35, 0);
  parts.push(plane);
  return mergeGeometries(parts);
}

function makeEncruster() {
  const g = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.38, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(0.88 + fbm(v.x * 3 + 80, v.z * 3 + 21, 2) * 0.3);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const MORPHS = {
  branching: makeBranching(),
  massive: makeMassive(),
  table: makeTable(),
  fan: makeFan(),
  encruster: makeEncruster()
};

const colonies = [];
const meshGroups = {};
for (const key of Object.keys(MORPHS)) meshGroups[key] = [];

function pickSite(minR, maxR) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2;
    const r = minR + Math.pow(rng(), 1.5) * (maxR - minR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h > -3.4 && h < 2.6) return { x, z, h };
  }
  return null;
}

function addColony(morph, genusIdx, opts = {}) {
  const site = pickSite(opts.minR ?? 4, opts.maxR ?? 95);
  if (!site) return;
  const genus = GENERA[genusIdx];
  const baseColor = new THREE.Color(genus.hue).offsetHSL((rng() - 0.5) * 0.05, 0.05 + rng() * 0.1, 0.03 + rng() * 0.08);
  const outplant = !!opts.outplant;
  const born = outplant ? 2022.3 + rng() * 0.6 : 2019 - rng() * 8;
  const mature = opts.size ?? (morph === "fan" ? 1.3 + rng() * 0.9 : morph === "massive" ? 0.9 + rng() * 1.1 : 0.9 + rng() * 1.4);
  const westness = clamp((site.x + 90) / 180, 0, 1);
  const severity = genus.suscept * (0.6 + rng() * 0.8) * clamp(1.25 - (site.h + 3) / 6, 0.6, 1.25);
  const dies = !outplant && rng() < 0.22 * genus.suscept * clamp((3 - site.h) / 4, 0.4, 1.3);
  colonies.push({
    id: `WFS-${String(colonies.length + 101).padStart(3, "0")}`,
    meshKey: morph,
    groupIndex: meshGroups[morph].length,
    genusIdx,
    pos: new THREE.Vector3(site.x, site.h - 0.06, site.z),
    rotY: rng() * Math.PI * 2,
    tilt: (rng() - 0.5) * 0.24,
    baseColor,
    born,
    outplant,
    mature,
    severity,
    dies,
    deathYear: dies ? 2020.5 + rng() * 0.4 : Infinity,
    hit: westness > 0.62 ? (westness - 0.62) / 0.38 * (0.5 + rng() * 0.5) : 0,
    features: [genus.suscept / 1.0, mature / 1.8, genusIdx / GENERA.length]
  });
  meshGroups[morph].push(colonies.length - 1);
}

for (let i = 0; i < 130; i++) addColony("branching", rng() < 0.6 ? 0 : 4);
for (let i = 0; i < 130; i++) addColony("massive", 1);
for (let i = 0; i < 60; i++) addColony("table", rng() < 0.7 ? 2 : 5);
for (let i = 0; i < 50; i++) addColony("massive", 3, { size: 0.7 + rng() * 0.8 });
for (let i = 0; i < 45; i++) addColony("fan", 2, { size: 1.0 });
for (let i = 0; i < 84; i++) addColony("encruster", [0, 2, 3][Math.floor(rng() * 3)], { outplant: true, size: 0.5 + rng() * 0.5 });
for (let i = 0; i < 6; i++) {
  addColony(i % 2 ? "table" : "massive", [1, 2, 5][i % 3], { size: i % 2 ? 2.4 + rng() * 0.9 : 1.8 + rng() * 0.5, minR: 7, maxR: 18 });
}

const raycastMeshes = [];
const instancedMeshes = {};
for (const key of Object.keys(MORPHS)) {
  const list = meshGroups[key];
  if (!list.length) continue;
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.9, metalness: 0,
    map: MOTTLE, normalMap: POLYP,
    normalScale: new THREE.Vector2(0.55, 0.55)
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glowUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGlowColor;")
      .replace("#include <color_vertex>", "#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n\tvGlowColor = instanceColor;\n#else\n\tvGlowColor = vec3(0.0);\n#endif");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow;\nvarying vec3 vGlowColor;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vGlowColor * uGlow;");
  };
  const m = new THREE.InstancedMesh(MORPHS[key], mat, list.length);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = true;
  m.receiveShadow = true;
  const c = new THREE.Color();
  for (let i = 0; i < list.length; i++) m.setColorAt(i, c);
  m.userData.key = key;
  instancedMeshes[key] = m;
  raycastMeshes.push(m);
  scene.add(m);
}
colonies.forEach(c => { c.mesh = instancedMeshes[c.meshKey]; c.radius = c.mature * 0.9; });

const aoMesh = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#000000"), alphaMap: new THREE.CanvasTexture(c),
    transparent: true, opacity: 0.42, depthWrite: false
  });
  const m = new THREE.InstancedMesh(geo, mat, colonies.length);
  m.frustumCulled = false;
  m.renderOrder = 1;
  scene.add(m);
  return m;
})();
const aoM = new THREE.Matrix4(), aoQ = new THREE.Quaternion(), aoE = new THREE.Euler(), aoV = new THREE.Vector3(), aoS = new THREE.Vector3();
function updateAO(t) {
  for (let i = 0; i < colonies.length; i++) {
    const c = colonies[i];
    const s = sizeAt(c, t);
    if (s <= 0.01) {
      aoM.makeScale(0.0001, 0.0001, 0.0001);
      aoM.setPosition(c.pos);
    } else {
      aoE.set(0, c.rotY, 0);
      aoQ.setFromEuler(aoE);
      aoV.set(c.pos.x, c.pos.y + 0.05 + s * 0.035, c.pos.z);
      aoS.set(s * 2.1, 1, s * 2.1);
      aoM.compose(aoV, aoQ, aoS);
    }
    aoMesh.setMatrixAt(i, aoM);
  }
  aoMesh.instanceMatrix.needsUpdate = true;
}

{
  const pebGeo = new THREE.SphereGeometry(1, 8, 6);
  pebGeo.scale(1, 0.45, 1);
  const pebMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#8f8066"), roughness: 0.95 });
  const pebbles = new THREE.InstancedMesh(pebGeo, pebMat, 170);
  const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), pe = new THREE.Euler(), pv = new THREE.Vector3(), ps = new THREE.Vector3();
  const pc = new THREE.Color();
  for (let i = 0; i < 170; i++) {
    const a = rng() * Math.PI * 2;
    const r = 4 + Math.pow(rng(), 1.4) * 88;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pe.set(rng() * 3, rng() * 3, rng() * 3);
    pq.setFromEuler(pe);
    const s = 0.09 + rng() * 0.24;
    pv.set(x, terrainHeight(x, z) + 0.02, z);
    ps.set(s * (0.8 + rng() * 0.6), s, s * (0.8 + rng() * 0.6));
    pm.compose(pv, pq, ps);
    pebbles.setMatrixAt(i, pm);
    pebbles.setColorAt(i, pc.setHSL(0.09 + rng() * 0.03, 0.18 + rng() * 0.12, 0.42 + rng() * 0.2));
  }
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;
  scene.add(pebbles);
}

function sizeAt(c, t) {
  if (t < c.born) return 0;
  let s;
  const age = t - c.born;
  if (c.outplant) s = c.mature * (0.14 + 0.86 * (1 - Math.exp(-age * 0.95)));
  else s = c.mature * (1 - Math.exp(-(age + 4) * 0.5));
  if (t > 2023.9 && !c.outplant) s *= 1 - c.hit * 0.3;
  if (c.dies && t > c.deathYear) {
    const sd = sizeAt(c, c.deathYear);
    s = Math.min(s, sd);
  }
  return s;
}
function bleachedAt(c, t) {
  if (t < c.born || (c.dies && t > c.deathYear)) return c.dies && t > c.deathYear ? 1 : 0;
  const sev = clamp(c.severity, 0, 1.4) / 1.4;
  const acute = gauss(t, 2020.45, 0.3) * sev + gauss(t, 2024.85, 0.2) * sev * 0.62;
  const chronic = sev * 0.36 * Math.exp(-Math.max(0, t - 2020.75) / 1.1) * clamp((t - 2020.55) / 0.3, 0, 1);
  return clamp((acute + chronic) * 1.35 - 0.04, 0, 1);
}
function stateAt(c, t) {
  if (t < c.born) return "future";
  if (c.dies && t > c.deathYear) return "dead";
  const b = bleachedAt(c, t);
  if (b > 0.52) return "bleached";
  if (b > 0.2) return "stressed";
  if (t > 2021.2 && b > 0.08) return "recovering";
  return "healthy";
}
const COL_DEAD = new THREE.Color("#63654e");
const COL_BLEACH = new THREE.Color("#e9e2d2");
const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(),
  tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();

function colorFor(c, t, out) {
  const st = stateAt(c, t);
  out.copy(c.baseColor);
  if (st === "dead") out.lerp(COL_DEAD, 0.88);
  else if (st === "bleached") out.lerp(COL_BLEACH, 0.9);
  else if (st === "stressed") out.lerp(COL_BLEACH, bleachedAt(c, t) * 0.75);
  else if (st === "recovering") out.lerp(COL_BLEACH, bleachedAt(c, t));
  return out;
}

let lastApplied = -99;
function applyTime(t, force = false) {
  if (!force && Math.abs(t - lastApplied) < 0.002) return;
  lastApplied = t;
  for (const key of Object.keys(instancedMeshes)) {
    const m = instancedMeshes[key];
    const list = meshGroups[key];
    for (let i = 0; i < list.length; i++) {
      const c = colonies[list[i]];
      const s = sizeAt(c, t);
      if (s <= 0.001) {
        tmpM.makeScale(0.0001, 0.0001, 0.0001);
        tmpM.setPosition(c.pos);
        m.setMatrixAt(i, tmpM);
        continue;
      }
      tmpE.set(c.tilt, c.rotY, c.tilt * 0.7);
      tmpQ.setFromEuler(tmpE);
      tmpV.copy(c.pos);
      tmpS.setScalar(s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      m.setMatrixAt(i, tmpM);
      colorFor(c, t, tmpC);
      m.setColorAt(i, tmpC);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: new THREE.Color("#d8b477"), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
);
reticle.rotation.x = -Math.PI / 2;
reticle.visible = false;
scene.add(reticle);
const hoverRing = reticle.clone();
hoverRing.material = new THREE.MeshBasicMaterial({ color: new THREE.Color("#cfe4e4"), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
hoverRing.visible = false;
scene.add(hoverRing);

const pulses = [];
for (let i = 0; i < 8; i++) {
  const p = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#63d8bd"), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  p.rotation.x = -Math.PI / 2;
  p.visible = false;
  p.userData = { age: 0, active: false };
  scene.add(p);
  pulses.push(p);
}
function pulseAt(pos, delay) {
  setTimeout(() => {
    const p = pulses.find(x => !x.userData.active) || pulses[0];
    p.position.set(pos.x, pos.y + 0.15, pos.z);
    p.userData.active = true;
    p.userData.age = 0;
    p.visible = true;
  }, delay);
}

const fishGeoParts = [];
{
  const body = new THREE.SphereGeometry(0.5, 12, 9);
  body.scale(0.26, 0.4, 0.82);
  fishGeoParts.push(body);
  const tail = new THREE.ConeGeometry(0.2, 0.34, 3);
  tail.rotateX(-Math.PI / 2);
  tail.scale(0.4, 1, 1);
  tail.translate(0, 0, -0.5);
  fishGeoParts.push(tail);
  const dorsal = new THREE.ConeGeometry(0.1, 0.18, 3);
  dorsal.translate(0, 0.22, 0.02);
  fishGeoParts.push(dorsal);
}
const fishGeo = mergeGeometries(fishGeoParts);
const schools = [
  { count: 26, color: new THREE.Color("#5fae9e"), center: new THREE.Vector3(-14, 4.5, -8), radius: 13, speed: 0.14, fish: [] },
  { count: 22, color: new THREE.Color("#caa04a"), center: new THREE.Vector3(17, 3.2, 12), radius: 10, speed: -0.11, fish: [] },
  { count: 34, color: new THREE.Color("#aebfc0"), center: new THREE.Vector3(6, 3.4, 7), radius: 4.5, speed: 0.3, fish: [] }
];
const fishMeshes = schools.map(sc => {
  const m = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), sc.count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  scene.add(m);
  const fc = new THREE.Color();
  for (let i = 0; i < sc.count; i++) {
    sc.fish.push({
      orbR: 1.2 + rng() * 3.4,
      orbY: (rng() - 0.5) * 1.6,
      phase: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 0.7,
      scale: 0.5 + rng() * 0.6
    });
    m.setColorAt(i, fc.copy(sc.color).offsetHSL((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.16));
  }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
});
const fM = new THREE.Matrix4(), fQ = new THREE.Quaternion(), fFwd = new THREE.Vector3(0, 0, 1), fDir = new THREE.Vector3();
function updateFish(time) {
  schools.forEach((sc, si) => {
    const m = fishMeshes[si];
    const cx = sc.center.x + Math.cos(time * sc.speed) * sc.radius;
    const cz = sc.center.z + Math.sin(time * sc.speed) * sc.radius;
    for (let i = 0; i < sc.count; i++) {
      const f = sc.fish[i];
      const wob = time * f.speed + f.phase;
      const px = cx + Math.cos(wob) * f.orbR;
      const pz = cz + Math.sin(wob * 0.9) * f.orbR;
      const py = sc.center.y + f.orbY + Math.sin(time * 0.7 + f.phase) * 0.4;
      const nx = cx + Math.cos(wob + 0.12) * f.orbR;
      const nz = cz + Math.sin((wob + 0.12) * 0.9) * f.orbR;
      fQ.setFromUnitVectors(fFwd, fDir.set(nx - px, 0, nz - pz).normalize());
      fM.compose(fDir.set(px, py, pz), fQ, tmpS.setScalar(f.scale));
      m.setMatrixAt(i, fM);
    }
    m.instanceMatrix.needsUpdate = true;
  });
}

const snowCount = 650;
const snowPos = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i++) {
  snowPos[i * 3] = (rng() - 0.5) * 130;
  snowPos[i * 3 + 1] = rng() * 22;
  snowPos[i * 3 + 2] = (rng() - 0.5) * 130;
}
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
  color: new THREE.Color("#bcd8da"), size: 0.07, transparent: true, opacity: 0.45, depthWrite: false
}));
scene.add(snow);

const sparkleCount = 150;
const sparklePos = new Float32Array(sparkleCount * 3);
for (let i = 0; i < sparkleCount; i++) {
  sparklePos[i * 3] = (rng() - 0.5) * 110;
  sparklePos[i * 3 + 1] = 1 + rng() * 15;
  sparklePos[i * 3 + 2] = (rng() - 0.5) * 110;
}
const sparkleGeo = new THREE.BufferGeometry();
sparkleGeo.setAttribute("position", new THREE.BufferAttribute(sparklePos, 3));
const sparkleMat = new THREE.PointsMaterial({
  color: new THREE.Color("#8ff0e0"), size: 0.13, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false
});
const sparkle = new THREE.Points(sparkleGeo, sparkleMat);
sparkle.frustumCulled = false;
scene.add(sparkle);

const moonSprite = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(214,235,240,0.9)");
  grad.addColorStop(0.25, "rgba(160,200,215,0.28)");
  grad.addColorStop(1, "rgba(160,200,215,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  s.scale.set(30, 30, 1);
  s.position.set(12, 44, -20);
  scene.add(s);
  return s;
})();

const NIGHT = {
  fog: new THREE.Color("#04090f"),
  domeTop: new THREE.Color("#0d2433"),
  domeMid: new THREE.Color("#071522"),
  domeBot: new THREE.Color("#04090f"),
  snow: new THREE.Color("#7fe3d8")
};
const DAY = {
  fog: new THREE.Color("#0c1c28"),
  domeTop: new THREE.Color("#1f5a66"),
  domeMid: new THREE.Color("#12293a"),
  domeBot: new THREE.Color("#0c1c28"),
  snow: new THREE.Color("#bcd8da")
};
let nightMix = 0, nightTarget = 0;
function applyNightGrade() {
  hemi.intensity = lerp(1.08, 0.15, nightMix);
  sun.intensity = lerp(1.9, 0.06, nightMix);
  fillLight.intensity = lerp(0.5, 0.05, nightMix);
  renderer.toneMappingExposure = lerp(1.28, 1.06, nightMix);
  scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, nightMix);
  domeMat.uniforms.top.value.copy(DAY.domeTop).lerp(NIGHT.domeTop, nightMix);
  domeMat.uniforms.mid.value.copy(DAY.domeMid).lerp(NIGHT.domeMid, nightMix);
  domeMat.uniforms.bot.value.copy(DAY.domeBot).lerp(NIGHT.domeBot, nightMix);
  terrainMat.emissiveIntensity = lerp(0.42, 0.07, nightMix);
  glowUniform.value = nightMix * 0.75;
  snow.material.opacity = lerp(0.45, 0.8, nightMix);
  snow.material.size = lerp(0.07, 0.095, nightMix);
  snow.material.color.copy(DAY.snow).lerp(NIGHT.snow, nightMix);
  for (const s of window.__shafts) s.material.opacity = s.userData.base * (1 - nightMix);
  moonSprite.material.opacity = nightMix * 0.5;

}
function toggleNight(force) {
  nightTarget = force ?? (nightTarget < 0.5 ? 1 : 0);
  const on = nightTarget > 0.5;
  $("nightBtn").setAttribute("aria-pressed", String(on));
  if (on && !toggleNight.told) {
    toggleNight.told = true;
    showCaption("<strong>Night dive.</strong> The reef fluoresces — every glow you see is the coral's own light.");

  }
}
$("nightBtn").addEventListener("click", () => toggleNight());

$("railToggle").addEventListener("click", () => document.body.classList.toggle("rail-open"));

const state = {
  t: T1,
  playing: false,
  selected: null,
  hovered: null,
  similars: [],
  tags: {},
  notes: {},
  fly: null,
  soundOn: false
};

const STORE_KEY = "pure-exploration.reef-memory.v1";
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return sanitizeStore(JSON.parse(raw));
  } catch { return null; }
}
const saved = loadStore();
state.tags = saved?.tags || Object.create(null);
state.notes = saved?.notes || Object.create(null);

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ tags: state.tags, notes: state.notes }));
    return true;
  } catch { return false; }
}

const ERAS = [
  { from: T0, to: 2020.1, text: `<strong>2019</strong> — Baseline survey. ${colonies.length} colonies catalogued across the lagoon.` },
  { from: 2020.1, to: 2021.1, text: "<strong>Summer 2020</strong> — Marine heatwave. Degree-heating weeks pile up and the reef goes quiet." },
  { from: 2021.1, to: 2022.3, text: "<strong>2021–22</strong> — Aftermath. Survivors regrow from surviving tissue; the dead turn olive with turf algae." },
  { from: 2022.3, to: 2023.7, text: "<strong>Restoration season</strong> — Nursery-raised fragments go back onto the reef, one plug at a time." },
  { from: 2023.7, to: 2024.5, text: "<strong>Cyclone season</strong> — Swell funnels through the western channel and reworks the outer flat." },
  { from: 2024.5, to: 2025.4, text: "<strong>Late 2024</strong> — A second, milder warming pulse. This time it holds." },
  { from: 2025.4, to: T1 + 1, text: "<strong>Today</strong> — Cover is climbing again. The outplants from '22 now bloom like they were never gone." }
];
let captionTimer = null;
function showCaption(html) {
  $("captionText").innerHTML = html;
  $("caption").classList.add("show");
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => $("caption").classList.remove("show"), 5200);
}

const pinsEl = $("pins");
let pinMap = new Map();
function rebuildPins() {
  pinsEl.innerHTML = "";
  pinMap.clear();
  for (const [idStr, arr] of Object.entries(state.notes)) {
    const c = colonies.find(x => x.id === `WFS-${String(idStr).padStart(3, "0")}`);
    if (!c) continue;
    const id = Number(idStr);
    const note = arr[arr.length - 1];
    const tagId = state.tags[idStr];
    const label = note ? note.text : `${GENERA[tagId]?.name ?? ""} tagged`;
    const el = document.createElement("div");
    el.className = "pin";
    el.innerHTML = `<div class="pin-tag"><b>${escapeText(note ? note.by : "Field tag")}</b><br>${escapeText(label)}</div><div class="pin-stem"></div><div class="pin-dot"></div>`;
    el.addEventListener("click", () => selectColony(c, false));
    pinsEl.appendChild(el);
    pinMap.set(id, { c, el });
  }
}
rebuildPins();

const projV = new THREE.Vector3();
function projectToScreen(pos, el, offsetY = 0) {
  projV.copy(pos);
  projV.y += offsetY;
  projV.project(camera);
  if (projV.z > 1 || projV.z < -1) { el.style.display = "none"; return false; }
  const w = vpEl.clientWidth, h = vpEl.clientHeight;
  const x = (projV.x * 0.5 + 0.5) * w;
  const y = (-projV.y * 0.5 + 0.5) * h;
  el.style.display = "";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  return true;
}

function updateOverlays() {
  for (const [, pin] of pinMap) {
    const { c, el } = pin;
    const visible = projectToScreen(c.pos, el, sizeAt(c, state.t) * 1.1 + 0.35);
    if (visible && state.t < c.born) el.style.opacity = "0.3";
    else el.style.opacity = "";
  }
}

const track = $("track"), head = $("trackHead"), fill = $("trackFill"), yearLabel = $("yearLabel");
{
  const ticksEl = $("trackTicks");
  for (let y = T0; y <= T1; y++) {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = `${((y - T0) / (T1 - T0)) * 100}%`;
    tick.innerHTML = `<span>${y}</span>`;
    ticksEl.appendChild(tick);
  }
  const evs = [
    { t: 2020.45, cls: "", title: "Marine heatwave" },
    { t: 2022.55, cls: "resto", title: "Restoration outplants" },
    { t: 2023.9, cls: "cyclone", title: "Cyclone swell" },
    { t: 2024.85, cls: "", title: "Second warm pulse" }
  ];
  for (const e of evs) {
    const ev = document.createElement("div");
    ev.className = `ev ${e.cls}`;
    ev.title = e.title;
    ev.style.left = `${((e.t - T0) / (T1 - T0)) * 100}%`;
    $("trackEvents").appendChild(ev);
  }
}

function setT(t, opts = {}) {
  const prev = state.t;
  state.t = clamp(t, T0, T1);
  applyTime(state.t);
  updateAO(state.t);
  const frac = (state.t - T0) / (T1 - T0);
  fill.style.width = `${frac * 100}%`;
  head.style.left = `${frac * 100}%`;
  yearLabel.textContent = state.t.toFixed(1);
  $("roYear").textContent = state.t.toFixed(1);
  track.setAttribute("aria-valuenow", state.t.toFixed(1));
  updateReadouts();
  if (document.body.classList.contains("photo")) updatePhotoTag();
  if (state.selected) renderChart(state.selected);

}

let scrubbingTrack = false;
function trackFromEvent(e) {
  const rect = track.getBoundingClientRect();
  return T0 + clamp((e.clientX - rect.left) / rect.width, 0, 1) * (T1 - T0);
}
track.addEventListener("pointerdown", (e) => {
  scrubbingTrack = true;
  track.setPointerCapture(e.pointerId);
  stopPlay();
  setT(trackFromEvent(e));
});
track.addEventListener("pointermove", (e) => { if (scrubbingTrack) setT(trackFromEvent(e)); });
track.addEventListener("pointerup", () => { scrubbingTrack = false; });
track.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { stopPlay(); setT(state.t - 0.15); }
  if (e.key === "ArrowRight") { stopPlay(); setT(state.t + 0.15); }
});

const playBtn = $("playBtn");
function startPlay() {
  if (state.t >= T1 - 0.01) setT(T0);
  state.playing = true;
  playBtn.classList.add("playing");
  playBtn.setAttribute("aria-label", "Pause reef history");
  $("playRow").setAttribute("aria-pressed", "true");
}
function stopPlay() {
  state.playing = false;
  playBtn.classList.remove("playing");
  playBtn.setAttribute("aria-label", "Play reef history");
  $("playRow").setAttribute("aria-pressed", "false");
}
playBtn.addEventListener("click", () => (state.playing ? stopPlay() : startPlay()));
$("playRow").addEventListener("click", () => (state.playing ? stopPlay() : startPlay()));

function updateReadouts() {
  const t = state.t;
  let visible = 0, healthy = 0, bleachedish = 0, dead = 0;
  for (const c of colonies) {
    const st = stateAt(c, t);
    if (st === "future") continue;
    visible++;
    if (st === "dead") dead++;
    else if (st === "bleached") bleachedish++;
    else if (st === "healthy" || st === "recovering") healthy++;
  }
  const cover = visible ? Math.round((healthy / visible) * 100) : 0;
  const bl = visible ? Math.round((bleachedish / visible) * 100) : 0;
  const lost = Math.round((dead / colonies.filter(c => !c.outplant).length) * 100);
  const temp = 28.3 + 2.9 * gauss(t, 2020.45, 0.32) + 1.1 * gauss(t, 2024.85, 0.22) - 1.2 * gauss(t, 2023.9, 0.16) + 0.5 * ((t - T0) / (T1 - T0));
  const dhw = clamp(8.6 * gauss(t, 2020.55, 0.38) + 2.2 * gauss(t, 2024.95, 0.3), 0, 12);
  const roTemp = $("roTemp");
  roTemp.textContent = `${temp.toFixed(1)}°C`;
  roTemp.classList.toggle("hot", temp > 29.6);
  $("roDhw").textContent = dhw.toFixed(1);
  $("roDhw").classList.toggle("hot", dhw > 4);
  $("roCover").textContent = `${cover}%`;
  $("roCover").classList.toggle("good", cover >= 70);
  $("roCover").classList.toggle("hot", cover < 50 && t > 2020);
  $("roBleach").textContent = `${bl}%`;
  $("roDead").textContent = `${lost}%`;
}

const GENUS_CHIPS = [...GENERA.map(g => g.name)];
{
  const wrap = $("genusChips");
  GENUS_CHIPS.forEach((name, i) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.textContent = name;
    b.addEventListener("click", () => {
      if (!state.selected) return;
      const id = state.selected.id.replace("WFS-", "");
      if (state.tags[id] === i) delete state.tags[id];
      else state.tags[id] = i;
      saveStore();
      openDossier(state.selected);
      rebuildPins();

    });
    wrap.appendChild(b);
  });
}

const chart = $("dChart");
const chartCtx = chart.getContext("2d");
function renderChart(c) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = chart.clientWidth || 300, h = 150;
  chart.width = w * dpr;
  chart.height = h * dpr;
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  chartCtx.clearRect(0, 0, w, h);
  const padL = 8, padB = 22, padT = 10;
  const iw = w - padL - 8, ih = h - padB - padT;
  const X = (yr) => padL + ((yr - T0) / (T1 - T0)) * iw;

  chartCtx.fillStyle = "oklch(0.14 0.03 230)";
  chartCtx.fillRect(padL, padT, iw, ih);

  const stripH = 10;
  const steps = 90;
  for (let i = 0; i < steps; i++) {
    const yr = T0 + (i / steps) * (T1 - T0);
    const yr2 = T0 + ((i + 1) / steps) * (T1 - T0);
    if (yr2 < c.born) continue;
    colorFor(c, yr + 0.005, tmpC);
    chartCtx.fillStyle = `#${tmpC.getHexString()}`;
    chartCtx.globalAlpha = state.t >= yr && state.t < yr2 ? 1 : 0.5;
    chartCtx.fillRect(X(yr), padT + ih - stripH, iw / steps + 0.5, stripH);
  }
  chartCtx.globalAlpha = 1;

  chartCtx.strokeStyle = "oklch(0.86 0.02 195 / 0.12)";
  chartCtx.lineWidth = 1;
  for (const fy of [0.33, 0.66]) {
    chartCtx.beginPath();
    chartCtx.moveTo(padL, padT + ih - stripH - fy * (ih - stripH - 6));
    chartCtx.lineTo(padL + iw, padT + ih - stripH - fy * (ih - stripH - 6));
    chartCtx.stroke();
  }

  let peak = 0;
  const sizes = [];
  for (let i = 0; i <= steps; i++) {
    const yr = T0 + (i / steps) * (T1 - T0);
    const s = sizeAt(c, yr);
    sizes.push([yr, s]);
    peak = Math.max(peak, s);
  }
  if (peak < 0.01) peak = 1;
  chartCtx.beginPath();
  chartCtx.moveTo(X(sizes[0][0]), padT + ih - stripH);
  for (const [yr, s] of sizes) chartCtx.lineTo(X(yr), padT + ih - stripH - (s / peak) * (ih - stripH - 6));
  chartCtx.lineTo(X(sizes[sizes.length - 1][0]), padT + ih - stripH);
  chartCtx.closePath();
  chartCtx.fillStyle = "oklch(0.80 0.06 90 / 0.30)";
  chartCtx.fill();
  chartCtx.strokeStyle = "oklch(0.80 0.06 90 / 0.85)";
  chartCtx.lineWidth = 1.4;
  chartCtx.beginPath();
  for (let i = 0; i < sizes.length; i++) {
    const [yr, s] = sizes[i];
    const px = X(yr), py = padT + ih - stripH - (s / peak) * (ih - stripH - 6);
    i === 0 ? chartCtx.moveTo(px, py) : chartCtx.lineTo(px, py);
  }
  chartCtx.stroke();

  const px = X(clamp(state.t, T0, T1));
  chartCtx.strokeStyle = "oklch(0.82 0.125 175)";
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  chartCtx.moveTo(px, padT - 2);
  chartCtx.lineTo(px, padT + ih);
  chartCtx.stroke();

  chartCtx.fillStyle = "oklch(0.55 0.03 210)";
  chartCtx.font = "9px Chivo Mono";
  for (let y = T0; y <= T1; y += 1) {
    chartCtx.fillText(String(y), X(y) - 9, h - 8);
    chartCtx.fillRect(X(y), padT + ih + 3, 1, 3);
  }
}
let chartScrubbing = false;
chart.addEventListener("pointerdown", (e) => {
  chartScrubbing = true;
  chart.setPointerCapture(e.pointerId);
  stopPlay();
});
chart.addEventListener("pointermove", (e) => {
  if (!chartScrubbing || !state.selected) return;
  const rect = chart.getBoundingClientRect();
  setT(T0 + clamp((e.clientX - rect.left) / rect.width, 0, 1) * (T1 - T0));
});
chart.addEventListener("pointerup", () => { chartScrubbing = false; });

const STATUS_TEXT = { healthy: "healthy", stressed: "pale / stressed", bleached: "bleached", recovering: "recovering", dead: "lost", future: "not yet here" };

function historyFor(c) {
  const ev = [];
  const y = (yr, txt) => ev.push({ yr, txt });
  const geno = ["ALT-22", "MUS-07", "RHA-11", "POR-04"][Number(c.id.slice(3)) % 4];
  const sev = clamp(c.severity, 0, 1.4) / 1.4;
  if (c.outplant) y(c.born, `Outplanted by Dr. Ada Polyp — nursery fragment, genotype ${geno}`);
  else y(T0, `Already mature at the baseline survey — first logged ${T0}`);
  if (c.dies) y(2020.45, "Bleached white in the summer heatwave. Tissue never came back — turf algae moved in.");
  else if (sev > 0.6) y(2020.45, "Heavy bleaching in the heatwave — survived on a sliver of living tissue.");
  else if (sev > 0.3) y(2020.45, "Partially bleached; pigments returned by late 2021.");
  else y(2020.45, "Rode out the heatwave with minor paling only.");
  if (!c.outplant && c.hit > 0.25) y(2023.9, `Cyclone swell through the west channel tore ~${Math.round(c.hit * 30)}% of structure away.`);
  if (!c.dies && sev > 0.35) y(2024.85, "Held color through the second warm pulse — tougher than it looks.");
  if (!c.dies && c.outplant) y(2025.4, "Reached flowering size — now spawning with the wild colony upstream.");
  return ev;
}

function openDossier(c) {
  const isNew = state.selected !== c;
  state.selected = c;
  const t = state.t;
  const st = stateAt(c, t);
  const idNum = String(Number(c.id.replace("WFS-", "")));
  const tag = state.tags[idNum];
  $("colonyBody").hidden = false;
  $("colonyEmpty").hidden = true;
  $("colonyHint").textContent = `${c.id} · ${STATUS_TEXT[st]} — options below`;
  $("dName").textContent = c.id;
  $("dTaxon").textContent = tag != null ? `${GENERA[tag].name} sp. · field-tagged` : "unidentified · awaiting tag";
  $("dStatus").textContent = STATUS_TEXT[st];
  $("dStatus").className = `badge ${st}`;
  colorFor(c, t, tmpC);
  $("dSwatch").style.background = `#${tmpC.getHexString()}`;
  document.querySelectorAll("#genusChips .chip").forEach((el, i) => el.classList.toggle("on", tag === i));

  let peak = 0;
  for (let yr = T0; yr <= T1; yr += 0.1) peak = Math.max(peak, sizeAt(c, yr));
  $("dHeight").textContent = st === "future" ? "—" : `${Math.round(sizeAt(c, t) * 46)} cm`;
  $("dPeak").textContent = peak > 0.001 ? `${Math.round(peak * 46)} cm` : "—";
  $("dBorn").textContent = c.outplant ? `outplanted ${c.born.toFixed(1)}` : `pre-survey ${T0}`;

  const notesArr = state.notes[idNum] || [];
  $("dNoteCount").textContent = notesArr.length ? `· ${notesArr.length}` : "";
  const ul = $("dNotes");
  ul.innerHTML = "";
  for (const n of notesArr) {
    const li = document.createElement("li");
    li.className = "note";
    li.innerHTML = `${escapeText(n.text)}<span class="note-meta"><b>${escapeText(n.by)}</b> · ${escapeText(n.when)}</span>`;
    ul.appendChild(li);
  }

  const hul = $("dHistory");
  hul.innerHTML = "";
  for (const e of historyFor(c)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="h-yr mono">${e.yr.toFixed(1)}</span><span>${e.txt}</span>`;
    hul.appendChild(li);
  }

  $("similars").innerHTML = "";
  renderChart(c);
  reticle.visible = st !== "future";
  reticle.position.set(c.pos.x, c.pos.y + 0.06, c.pos.z);
  if (isNew && innerWidth > 900) $("secColony").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDossier() {
  $("colonyBody").hidden = true;
  $("colonyEmpty").hidden = false;
  $("colonyHint").textContent = "click any coral in the lagoon to open its file";
  state.selected = null;
  state.similars = [];
  reticle.visible = false;
}
$("dossierClose").addEventListener("click", closeDossier);

$("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("noteInput");
  const text = input.value.trim().slice(0, 800);
  if (!text || !state.selected) return;
  const idNum = state.selected.id.replace("WFS-", "");
  if ((state.notes[idNum]?.length || 0) >= 50) { showCaption("This colony has 50 notes. Keep exploring another colony."); return; }
  (state.notes[idNum] ||= []).push({
    by: "You",
    text,
    when: new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })
  });
  input.value = "";
  const stored = saveStore();
  openDossier(state.selected);
  rebuildPins();

  showCaption(stored ? "<strong>Note pinned.</strong> It stays at this exact spot in this browser — reload and it will still be here." : "<strong>Note pinned for this visit.</strong> Browser storage is unavailable, so copy it before leaving.");
});

function similarityScore(a, b) {
  const f1 = a.features, f2 = b.features;
  let d = 0;
  for (let i = 0; i < f1.length; i++) d += (f1[i] - f2[i]) ** 2;
  return Math.sqrt(d);
}
$("similarBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const c = state.selected;
  const ranked = colonies
    .filter(o => o !== c && state.t >= o.born)
    .map(o => ({ o, d: similarityScore(c, o) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  state.similars = ranked.map(r => r.o);
  const maxD = ranked[ranked.length - 1]?.d || 1;
  const ul = $("similars");
  ul.innerHTML = "";
  ranked.forEach((r, i) => {
    const pct = Math.round((1 - r.d / maxD) * 100);
    colorFor(r.o, state.t, tmpC);
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="similar-swatch" style="background:#${tmpC.getHexString()}"></span>
      <span>${r.o.id}</span><span class="dim">${GENERA[state.tags[r.o.id.replace("WFS-", "")]]?.name ?? "untagged"}</span>
      <span class="similar-score">${pct}% match</span>`;
    b.addEventListener("click", () => selectColony(r.o, true));
    li.appendChild(b);
    ul.appendChild(li);
    pulseAt(r.o.pos, i * 130);
  });
  showCaption("<strong>Similarity search.</strong> Matched by morphology, size class and palette — the way the selector works across every view of the reef.");
});

function selectColony(cOrObj, flyTo = false) {
  let c = typeof cOrObj === "number" ? colonies[cOrObj] : cOrObj;
  openDossier(c);
  if (flyTo) flyToColony(c);
}
function flyToColony(c) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = clamp(c.radius * 6 + 4, 5, 14);
  const dest = c.pos.clone().add(dir.multiplyScalar(dist));
  dest.y = Math.max(dest.y, c.pos.y + 2.2);
  flyToPos(dest, c.pos.clone(), 1.05);
}
function flyToPos(dest, target, dur = 1.6) {
  state.fly = {
    p0: camera.position.clone(), p1: dest,
    t0: controls.target.clone(), t1: target,
    dur: RM ? 0 : dur, age: 0
  };
  controls.autoRotate = false;
}

const TOUR = [
  { pick: () => colonies.find(c => c.meshKey === "table" && c.mature > 2.3), t: 2026, dist: 8,
    text: "<strong>The elders.</strong> Tables this size have seen every heatwave in the record. Slow growth, thick tissue, stubborn survival." },
  { pick: () => colonies.find(c => c.dies && c.severity > 0.9) || colonies.find(c => c.dies), t: 2021.1, dist: 6.5,
    text: "<strong>The graveyard.</strong> Whatever bleached white here in the summer of '20 never came back. Turf algae moved in within weeks." },
  { pick: () => colonies.find(c => c.outplant), t: 2023.1, dist: 5,
    text: "<strong>The nursery generation.</strong> Fragments raised on the station's tables, glued back onto the reef one plug at a time." },
  { pick: () => colonies.find(c => c.hit > 0.25), t: 2023.95, dist: 10,
    text: "<strong>The western channel.</strong> Cyclone swell funnels through here — sandblasted and reworked every big storm." },
  { wide: true, t: 2026,
    text: `<strong>Seven years, one reef.</strong> ${colonies.length} files. One heatwave, one cyclone, a new nursery. Leave a note before you surface.` }
];
let tourToken = 0;
function toggleTour() {
  if ($("tourBtn").getAttribute("aria-pressed") === "true") { cancelTour(); return; }
  stopPlay();
  closeDossier();
  const token = ++tourToken;
  $("tourBtn").setAttribute("aria-pressed", "true");
  let idx = -1;
  const step = () => {
    if (token !== tourToken) return;
    idx++;
    if (idx >= TOUR.length) {
      cancelTour();
      showCaption("<strong>Tour complete.</strong> The timeline is yours — drag it, scrub it, break it.");
      return;
    }
    const st = TOUR[idx];
    setT(st.t);
    showCaption(st.text);
    if (st.wide) {
      flyToPos(new THREE.Vector3(26, 13, 30), new THREE.Vector3(0, 2, 0), 2.2);
    } else {
      const c = st.pick();
      if (c) {
        const dir = camera.position.clone().sub(c.pos).setY(0);
        if (dir.lengthSq() < 0.01) dir.set(0.6, 0, 0.8);
        dir.normalize();
        const dest = c.pos.clone().add(dir.multiplyScalar(st.dist));
        dest.y = Math.max(c.pos.y + st.dist * 0.42, c.pos.y + 2.2);
        flyToPos(dest, c.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 1.9);
      }
    }
    setTimeout(step, 5600);
  };
  step();
}
function cancelTour() {
  tourToken++;
  $("tourBtn").setAttribute("aria-pressed", "false");
}
$("tourBtn").addEventListener("click", toggleTour);

function togglePhoto(force) {
  const on = force ?? !document.body.classList.contains("photo");
  document.body.classList.toggle("photo", on);
  $("photoBtn").setAttribute("aria-pressed", String(on));
  $("photoUI").setAttribute("aria-hidden", String(!on));
  if (on) updatePhotoTag();
}
function updatePhotoTag() {
  $("photoTag").textContent = `REEF/MEMORY · STATION SOUTH REEF · LAGOON 7 · ${state.t.toFixed(1)}`;
}
function savePhoto() {
  renderer.render(scene, camera);
  const a = document.createElement("a");
  a.href = renderer.domElement.toDataURL("image/png");
  a.download = `reef-memory-${state.t.toFixed(1)}.png`;
  a.click();
  const btn = $("photoSave");
  btn.textContent = "Saved";
  setTimeout(() => (btn.textContent = "Save PNG"), 1400);
}
$("photoBtn").addEventListener("click", () => togglePhoto());
$("photoSave").addEventListener("click", savePhoto);

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let downXY = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  downXY = { x: e.clientX, y: e.clientY, t: performance.now() };
  state.fly = null;
  cancelTour();
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downXY) return;
  const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
  const dt = performance.now() - downXY.t;
  downXY = null;
  if (moved > 6 || dt > 400) return;
  const hit = raycastAt(e.clientX, e.clientY);
  if (hit) selectColony(hit.colony, false);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  const now = performance.now();
  if (now - lastHoverCheck < 80) return;
  lastHoverCheck = now;
  const hit = raycastAt(e.clientX, e.clientY);
  state.hovered = hit ? hit.colony : null;
  renderer.domElement.style.cursor = hit ? "pointer" : "";
  if (hit) {
    hoverRing.visible = true;
    hoverRing.position.set(hit.colony.pos.x, hit.colony.pos.y + 0.05, hit.colony.pos.z);
    hoverRing.scale.setScalar(hit.colony.radius * 1.5);
  } else hoverRing.visible = false;
});
let lastHoverCheck = 0;
function raycastAt(cx, cy) {
  pointerNDC.set((cx / vpEl.clientWidth) * 2 - 1, -(cy / vpEl.clientHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(raycastMeshes, false);
  for (const h of hits) {
    const key = h.object.userData.key;
    const idx = meshGroups[key][h.instanceId];
    const col = colonies[idx];
    if (col && state.t >= col.born) return { colony: col, distance: h.distance };
  }
  return null;
}

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
  if (e.code === "Space") { e.preventDefault(); state.playing ? stopPlay() : startPlay(); }
  if (e.key === "ArrowRight") { stopPlay(); setT(state.t + 0.2); }
  if (e.key === "ArrowLeft") { stopPlay(); setT(state.t - 0.2); }
  if (e.key === "Escape") {
    closeDossier();
    $("helpPanel").hidden = true;
    $("helpBtn").setAttribute("aria-expanded", "false");
    cancelTour();
    togglePhoto(false);
  }
  if (e.code === "KeyP") togglePhoto();
  if (e.code === "KeyT") toggleTour();
  if (e.code === "KeyN") toggleNight();
  if (e.code === "KeyC" && document.body.classList.contains("photo")) savePhoto();
});

let audioCtx = null, audioNodes = null;
function buildAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const len = audioCtx.sampleRate * 3;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 340;
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  src.connect(lp);
  lp.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
  lfo.start();
  audioNodes = gain;
}
async function toggleSound(forceOn) {
  const want = forceOn ?? !state.soundOn;
  if (want && !audioCtx) buildAudio();
  if (!audioCtx) return;
  await audioCtx.resume();
  audioNodes.gain.linearRampToValueAtTime(want ? 0.055 : 0, audioCtx.currentTime + 0.8);
  state.soundOn = want;
  $("soundBtn").setAttribute("aria-pressed", String(want));
}
$("soundBtn").addEventListener("click", () => toggleSound());

$("helpBtn").addEventListener("click", () => {
  const panel = $("helpPanel");
  const open = panel.hidden;
  panel.hidden = !open;
  $("helpBtn").setAttribute("aria-expanded", String(open));
});
$("helpClose").addEventListener("click", () => {
  $("helpPanel").hidden = true;
  $("helpBtn").setAttribute("aria-expanded", "false");
});

{
}

let dove = false;
function dive() {
  if (dove) return;
  dove = true;
  $("intro").classList.add("gone");
  controls.autoRotate = false;
  if (saved && (Object.keys(saved.notes || {}).length || Object.keys(saved.tags || {}).length)) {

  }
  const dur = RM ? 0 : 3.4;
  const p0 = camera.position.clone();
  const p1 = new THREE.Vector3(15, 8.5, 24);
  const t0v = controls.target.clone();
  const t1v = new THREE.Vector3(0, 2.4, 0);
  const start = performance.now();
  (function descend() {
    const k = dur === 0 ? 1 : clamp((performance.now() - start) / (dur * 1000), 0, 1);
    const e = easeInOutCubic(k);
    camera.position.lerpVectors(p0, p1, e);
    controls.target.lerpVectors(t0v, t1v, e);
    if (k < 1) requestAnimationFrame(descend);
    else revealHUD();
  })();
  if (dur === 0) revealHUD();
}
$("diveBtn").addEventListener("click", dive);
if (new URLSearchParams(location.search).has("auto")) dive();
function revealHUD() {
  $("timeline").classList.add("reveal");
  setTimeout(() => $("timeline").classList.add("on"), 150);
  setTimeout(() => $("vpHint").classList.add("gone"), 9000);
  showCaption(ERAS[ERAS.length - 1].text);
  setTimeout(() => { if ($("tourBtn").getAttribute("aria-pressed") !== "true") showCaption("<strong>Try the timeline.</strong> Drag it back to 2020 and watch the heatwave arrive."); }, 8000);


}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (Math.abs(nightMix - nightTarget) > 0.0005) {
    nightMix += (nightTarget - nightMix) * Math.min(1, dt * 1.6);
    applyNightGrade();
  }
  sparkleMat.opacity = nightMix * (0.4 + Math.sin(time * 1.7) * 0.18);
  {
    const sp = sparkleGeo.attributes.position.array;
    for (let i = 0; i < sparkleCount; i++) {
      sp[i * 3 + 1] += dt * 0.14;
      if (sp[i * 3 + 1] > 17) sp[i * 3 + 1] = 1;
    }
    sparkleGeo.attributes.position.needsUpdate = true;
  }

  if (state.playing) {
    const next = state.t + dt * 0.4;
    setT(next, { silent: true });

    if (next >= T1) {
      stopPlay();
      showCaption("<strong>Seven years, four minutes.</strong> Every colony you see survived it — or didn't. Select any of them to read its file.");
    }
  }
  const era = ERAS.find(e => state.t >= e.from && state.t < e.to);
  if (era && state.playing) showCaption(era.text);

  applyTime(state.t);

  if (state.fly) {
    const f = state.fly;
    f.age += dt;
    const k = f.dur === 0 ? 1 : clamp(f.age / f.dur, 0, 1);
    const e = easeInOutCubic(k);
    camera.position.lerpVectors(f.p0, f.p1, e);
    controls.target.lerpVectors(f.t0, f.t1, e);
    if (k >= 1) state.fly = null;
  }
  controls.update();

  causticsA.offset.x = time * 0.008;
  causticsA.offset.y = time * 0.005;
  causticsB.offset.x = -time * 0.006;
  causticsB.offset.y = time * 0.007;
  shimmerTex.offset.x = time * 0.014;
  shimmerTex.offset.y = time * 0.009;
  shimmer2Tex.offset.x = -time * 0.011;
  shimmer2Tex.offset.y = time * 0.006;

  updateFish(time);



  const sp = snowGeo.attributes.position.array;
  for (let i = 0; i < snowCount; i++) {
    sp[i * 3 + 1] -= dt * 0.22;
    sp[i * 3] += Math.sin(time * 0.4 + i) * dt * 0.06;
    if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] = 22;
  }
  snowGeo.attributes.position.needsUpdate = true;

  const sel = state.selected;
  if (sel && reticle.visible) {
    const pulse = 1 + Math.sin(time * 2.4) * 0.07;
    reticle.scale.setScalar(sel.radius * 1.6 * pulse);
    reticle.material.opacity = 0.75 + Math.sin(time * 2.4) * 0.2;
  }
  hoverRing.rotation.z += dt * 0.4;

  for (const p of pulses) {
    if (!p.userData.active) continue;
    p.userData.age += dt;
    const k = p.userData.age / 1.5;
    if (k >= 1) { p.userData.active = false; p.visible = false; continue; }
    p.scale.setScalar(0.5 + easeOutQuint(k) * 2.2);
    p.material.opacity = (1 - k) * 0.8;
  }

  updateOverlays();
  renderer.render(scene, camera);
}
applyTime(state.t, true);
updateReadouts();
window.__reef = { colonyCount: colonies.length, setT, select: (i) => selectColony(colonies[i], true), scene, camera, controls, glowUniform, renderer };

animate();

addEventListener("resize", () => resizeViewport());
function resizeViewport() {
  const w = vpEl.clientWidth, h = vpEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (state.selected) renderChart(state.selected);
}
if (typeof ResizeObserver !== "undefined") new ResizeObserver(resizeViewport).observe(vpEl);
resizeViewport();

import * as THREE from '/games/universe-clash/vendor/three.module.js';
import { GLTFLoader } from '/games/universe-clash/vendor/loaders/GLTFLoader.js';
import { mergeGeometries } from '/games/universe-clash/vendor/utils/BufferGeometryUtils.js';
import { FORMS, STAGES } from './catalog.mjs';
import { normalizeLoadout } from './gear.mjs';
import { pickupCandidate } from './readability.mjs';
import { normalizePresentation, QUALITY, resolveViewAim } from './presentation.mjs';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const IDS = Object.keys(FORMS);
const AURA = Object.fromEntries(IDS.map((id) => [id, FORMS[id][0].aura]));
const KI = { goku: '#67e8ff', vegeta: '#b3a4ff', jiren: '#ff6451', frieza: '#d291ff', beerus: '#cc83ff', gohan: '#abd9ff', piccolo: '#ffd88a', trunks: '#87daff', android18: '#f7df91', cell: '#a6ed89', buu: '#ff96cc', hit: '#bba9ff', broly: '#baff6c', android17: '#91edbb', krillin: '#ffd77d', tien: '#a5efc7' };
const TECHNIQUE_DURATION = { goku: .7, vegeta: .72, jiren: .95, frieza: .62, beerus: .48, gohan: .72, piccolo: .74, trunks: .58, android18: .64, cell: .8, buu: .62, hit: .68, broly: .92, android17: .84, krillin: .60, tien: .88 };
const TECHNIQUE_WINDUP = { goku: .28, vegeta: .18, jiren: .16, frieza: .3, beerus: .12, gohan: .24, piccolo: .34, trunks: .18, android18: .16, cell: .2, buu: .24, hit: .26, broly: .36, android17: .18, krillin: .25, tien: .35 };
const headingOf = (f) => Number.isFinite(f?.heading) ? f.heading : f?.face === -1 ? -PI / 2 : PI / 2;
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const isAlive = (f) => f && f.alive !== false && f.action !== 'down' && f.hp !== 0;
const formAt = (id, index) => FORMS[id][clamp(Number.isInteger(index) ? index : 0, 0, FORMS[id].length - 1)];

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const noiseGLSL = `
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+3.7; a*=0.5; }
  return v;
}`;

export function createWorld(canvas, roster = []) {
  if (!canvas?.getContext) throw new Error('The arena needs an HTML canvas with WebGL support.');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    throw new Error(`The 3D arena could not start WebGL. Enable hardware acceleration and reload. ${error.message}`);
  }
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  let resourceOwner = null;
  const geometry = (g) => { if (!geometries.has(g)) resourceOwner?.geometries.add(g); geometries.add(g); return g; };
  const material = (m) => { if (!materials.has(m)) resourceOwner?.materials.add(m); materials.add(m); return m; };
  const texture = (t) => { if (!textures.has(t)) resourceOwner?.textures.add(t); textures.add(t); return t; };
  const rng = randomSource(77321);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06040d');
  scene.fog = new THREE.FogExp2('#160c27', 0.014);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 240);
  const cameraLook = new THREE.Vector3(0, 1, 0);
  const desiredLook = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const handPosition = new THREE.Vector3();
  const whiteColor = new THREE.Color('#ffffff');
  const dummy = new THREE.Object3D();
  let width = 1, height = 1, mobile = false, dpr = 1, time = 0;
  let presentation = normalizePresentation(), quality = QUALITY[presentation.quality];
  let disposed = false, lost = false, firstFrame = true, wasMenu = true;
  let lastEvent = 0, lastTick = -1, shake = 0, auraClock = 0, cameraAccent = 0;
  let lastPresentationState = null;
  let lastCalls = 0, lastTriangles = 0;
  let cameraMode = 2, localSlot = 0, targetSlot = -1, frameMs = 0;
  let shoulderAngle = .12, firstPerson = false, effectOwner = -1;
  const meshBounds = new THREE.Box3(), frameBounds = new THREE.Box3();
  const projectionPoint = new THREE.Vector3(), armDirection = new THREE.Vector3();
  const armRotation = new THREE.Quaternion(), downAxis = new THREE.Vector3(0, -1, 0);
  const legFrame = new THREE.Matrix4(), legHinge = new THREE.Vector3(), legUp = new THREE.Vector3(), legForward = new THREE.Vector3();
  let chaseHeading = 0, chasePitch = 0, targetCatchup = 0, groundClock = 0, impactCursor = 0, markCursor = 0;
  const lookInput = { yaw: 0, pitch: .2, manual: false };
  let previewViewport = null;
  let pitFloor = false;
  const PIT_RADIUS = 14 * Math.sqrt(10), FLOOR_RADIUS = 44.8;
  const arenaImpacts = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -10, 0));
  const viewBack = new THREE.Vector3(), viewRight = new THREE.Vector3(), viewUp = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0);
  const modelInfo = {};
  const portraitCache = new Map();
  const rosterColors = Object.fromEntries(roster.map((r) => [r.id, r.color]));

  const asset = { status: 'loading', source: 'Blender', url: '/games/universe-clash/assets/arena-gateway.glb', meshes: 0, instances: 0, error: null };
  const assetResources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const assetInstances = [];
  function releaseResources(owned) {
    const images = new Set();
    for (const key of ['geometries', 'materials', 'textures']) {
      const registry = { geometries, materials, textures }[key];
      for (const resource of owned[key]) {
        resource.dispose(); registry.delete(resource);
        if (key === 'textures') {
          const data = resource.source?.data;
          for (const image of Array.isArray(data) ? data : [data]) if (image?.close) images.add(image);
        }
      }
      owned[key].clear();
    }
    for (const image of images) image.close();
  }
  // One self-contained local GLB per world. Clones share only this asset's resources.
  // Existing procedural architecture remains available during loading or failure.
  new GLTFLoader().load(asset.url, gltf => {
    let root = gltf.scene;
    for (const stage of gltf.scenes) stage.traverse(node => {
      if (node.geometry) assetResources.geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
        assetResources.materials.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) assetResources.textures.add(value);
      }
    });
    if (disposed) { releaseResources(assetResources); asset.status = 'failed'; asset.error = 'World disposed before gateway load completed.'; return; }
    try {
      const sources = [...assetResources.geometries], buckets = new Map(), batched = new THREE.Group();
      root.updateMatrixWorld(true);
      root.traverse(node => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh || Array.isArray(node.material) || Object.keys(node.geometry.morphAttributes).length) throw new Error('Gateway must be static single-material meshes.');
        const key = `${node.material.id}:${!!node.geometry.index}:${Object.keys(node.geometry.attributes).sort().join(',')}`;
        if (!buckets.has(key)) buckets.set(key, { material: node.material, geometries: [] });
        const copy = node.geometry.clone().applyMatrix4(node.matrixWorld);
        assetResources.geometries.add(copy); buckets.get(key).geometries.push(copy);
      });
      asset.sourceMeshes = [...buckets.values()].reduce((n, bucket) => n + bucket.geometries.length, 0);
      for (const bucket of buckets.values()) {
        const merged = mergeGeometries(bucket.geometries);
        if (!merged) throw new Error('Gateway static geometry could not be batched.');
        assetResources.geometries.add(merged);
        batched.add(new THREE.Mesh(merged, bucket.material));
        for (const g of bucket.geometries) { g.dispose(); assetResources.geometries.delete(g); }
      }
      for (const g of sources) { g.dispose(); assetResources.geometries.delete(g); }
      root = batched;
      root.traverse(node => { if (node.isMesh) { asset.meshes++; node.castShadow = node.receiveShadow = true; } });
      if (!asset.meshes) throw new Error('Gateway asset contains no meshes.');
      const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
      // Reject a bad export rather than putting scenery into the authoritative arena.
      if (![size.x, size.y, size.z].every(Number.isFinite) || size.x > 18 || size.z > 8 || size.y > 22 || size.y < 4 || Math.abs(bounds.min.y) > .5) throw new Error('Gateway export dimensions/pivot are outside the perimeter contract.');
      asset.dimensions = size.toArray();
      // Tangential width cannot reduce this radial lower bound, unlike the loose
      // world-axis AABB of a diagonally placed arch.
      asset.minRadius = 52 - Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
      for (const angle of [0, TAU / 3, -TAU / 3]) {
        const instance = root.clone(true);
        instance.name = 'Blender perimeter gateway';
        instance.position.set(Math.sin(angle) * 52, 0, -Math.cos(angle) * 52);
        instance.rotation.y = -angle;
        scene.add(instance); instance.updateMatrixWorld(true); assetInstances.push(instance);
        asset.instances++;
      }
      asset.status = 'ready';
    } catch (error) {
      for (const instance of assetInstances) instance.removeFromParent(); assetInstances.length = 0;
      releaseResources(assetResources); asset.status = 'failed'; asset.error = error.message;
    }
  }, undefined, error => {
    if (!disposed) { asset.status = 'failed'; asset.error = error?.message || 'Gateway asset could not be loaded.'; }
  });

  const sphere = geometry(new THREE.SphereGeometry(1, 16, 10));
  const smallSphere = geometry(new THREE.SphereGeometry(1, 10, 7));
  const rockGeometry = geometry(new THREE.IcosahedronGeometry(1, 1));
  const plane = geometry(new THREE.PlaneGeometry(1, 1));
  const ringGeometry = geometry(new THREE.RingGeometry(0.89, 1, 64));
  const slashGeometry = geometry(new THREE.RingGeometry(.82, 1, 40, 1, 0, PI * 1.1));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 20, 1));
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cone = geometry(new THREE.ConeGeometry(1, 1, 7));
  const dome = geometry(new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, PI / 2));
  const standard = (color, roughness = 0.6, extra = {}) => {
    const mat = material(new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
    // Character-only light bands and a view-dependent ink edge retain the cloth
    // normals and PBR lighting without doubling every mesh for an outline pass.
    if (resourceOwner && resourceOwner !== assetResources) {
      mat.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float ucLuma = max(dot(outgoingLight, vec3(.2126,.7152,.0722)), .001);
          float ucBand = (floor(ucLuma * 5.) + .5) / 5.;
          outgoingLight *= mix(1., ucBand / ucLuma, .22);
          float ucEdge = smoothstep(.035, .24, abs(dot(normalize(normal), normalize(vViewPosition))));
          outgoingLight *= mix(.48, 1., ucEdge);
          #include <opaque_fragment>
        `);
      };
      mat.customProgramCacheKey = () => 'uc-character-ink-v1';
    }
    return mat;
  };
  const basic = (color, extra = {}) => material(new THREE.MeshBasicMaterial({ color, ...extra }));
  const billboard = (mat) => {
    const sprite = new THREE.Sprite(mat);
    // Own the quad instead of leaving Three's process-shared Sprite geometry on the GPU.
    sprite.geometry = plane;
    return sprite;
  };
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  function mesh(parent, geo, mat, position = [0, 0, 0], scale = [1, 1, 1], shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...position);
    m.scale.set(...scale);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }
  const ellipsoid = (parent, mat, position, scale, fine = true) => mesh(parent, fine ? sphere : smallSphere, mat, position, scale);
  function plate(parent, points, mat, depth = 0.035, position = [0, 0, 0]) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.closePath();
    return mesh(parent, geometry(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.009, bevelSegments: 1, steps: 1, curveSegments: 4 })), mat, position);
  }
  function lathe(rows, radial = 20) {
    const positions = [], uv = [], indices = [];
    for (let j = 0; j < rows.length; j++) {
      const [y, rx, rz, cx = 0, cz = 0] = rows[j];
      for (let i = 0; i <= radial; i++) {
        const a = i / radial * TAU;
        positions.push(cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz);
        uv.push(i / radial, j / (rows.length - 1));
        if (j && i) {
          const b = j * (radial + 1) + i;
          indices.push(b, b - 1, b - radial - 2, b, b - radial - 2, b - radial - 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return geometry(g);
  }
  function tube(parent, points, radius, mat, segments = 16, sides = 7) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(parent, geometry(new THREE.TubeGeometry(curve, segments, radius, sides, false)), mat);
  }
  function taper(parent, points, radii, mat, sides = 7, steps = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(steps, false);
    const positions = [], uv = [], indices = [];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const p = curve.getPointAt(t);
      const r = t * (radii.length - 1);
      const k = Math.min(radii.length - 2, Math.floor(r));
      const radius = mix(radii[k], radii[k + 1], r - k);
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU;
        scratch.copy(p).addScaledVector(frames.normals[j], Math.cos(a) * radius).addScaledVector(frames.binormals[j], Math.sin(a) * radius);
        positions.push(scratch.x, scratch.y, scratch.z);
        uv.push(i / sides, t);
        if (j && i) {
          const b = j * (sides + 1) + i;
          indices.push(b, b - 1, b - sides - 2, b, b - sides - 2, b - sides - 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return mesh(parent, geometry(g), mat);
  }
  function ribbon(parent, points, widths, mat) {
    const pos = [], idx = [], uv = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const w = widths[Math.min(i, widths.length - 1)] * 0.5;
      pos.push(p[0] - dy / len * w, p[1] + dx / len * w, p[2], p[0] + dy / len * w, p[1] - dx / len * w, p[2]);
      uv.push(0, i / points.length, 1, i / points.length);
      if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return mesh(parent, geometry(g), mat);
  }

  // Bake only rigid siblings, preserving every animated joint and hand switch.
  function batch(root) {
    for (const child of [...root.children]) if (child.isGroup) batch(child);
    const buckets = new Map();
    for (const child of root.children) {
      if (!child.isMesh || child.isInstancedMesh || Array.isArray(child.material)) continue;
      if (!buckets.has(child.material)) buckets.set(child.material, []);
      buckets.get(child.material).push(child);
    }
    for (const [mat, children] of buckets) {
      if (children.length < 2) continue;
      const positions = [], normals = [], uvs = [], indices = [];
      for (const child of children) {
        child.updateMatrix();
        const g = child.geometry.clone().applyMatrix4(child.matrix);
        const base = positions.length / 3;
        const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
        for (let i = 0; i < p.count; i++) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i));
          normals.push(n.getX(i), n.getY(i), n.getZ(i));
          uvs.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
        }
        if (g.index) for (const index of g.index.array) indices.push(base + index);
        else for (let i = 0; i < p.count; i++) indices.push(base + i);
        g.dispose();
        root.remove(child);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      mesh(root, geometry(g), mat, [0, 0, 0], [1, 1, 1], children.some((m) => m.castShadow));
    }
  }

  function canvasTexture(size, draw, color = true) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('The arena could not create its local procedural textures.');
    draw(ctx, size);
    const t = texture(new THREE.CanvasTexture(c));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const glow = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.13, '#ffffff');
    g.addColorStop(0.32, '#b0b0b0'); g.addColorStop(0.62, '#333333'); g.addColorStop(1, '#000000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const contactTexture = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 3, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.4, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const stone = canvasTexture(512, (ctx, s) => {
    const r = randomSource(813);
    const image = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const n = r() * 32 + Math.sin(x * 0.024 + Math.sin(y * 0.037) * 2) * 10 + Math.sin(y * 0.083 + x * 0.018) * 6;
      image.data[i] = 88 + n; image.data[i + 1] = 93 + n; image.data[i + 2] = 112 + n; image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    for (let i = 0; i < 2000; i++) {
      const x = r() * s, y = r() * s;
      ctx.fillStyle = r() > 0.5 ? 'rgba(230,230,255,.16)' : 'rgba(4,5,14,.28)';
      ctx.fillRect(x, y, 0.5 + r() * 2.5, 0.5 + r() * 2);
    }
    for (let i = 0; i < 35; i++) {
      let x = r() * s, y = r() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 9; j++) { x += (r() - 0.4) * 26; y += (r() - 0.5) * 20; ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(3,4,13,.7)'; ctx.lineWidth = 0.5 + r() * 1.5; ctx.stroke();
      ctx.translate(1, 1); ctx.strokeStyle = 'rgba(203,216,228,.17)'; ctx.lineWidth = 0.5; ctx.stroke(); ctx.translate(-1, -1);
    }
  });
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bump = texture(stone.clone());
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  const cloth = canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) {
      ctx.strokeStyle = i % 4 ? '#858585' : '#c3c3c3'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
  }, false);
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.repeat.set(3, 3);
  const carapace = canvasTexture(256, (ctx, s) => {
    const r = randomSource(1984);
    ctx.fillStyle = '#c5dcac'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 125; i++) {
      ctx.fillStyle = i % 3 ? '#314b3b' : '#526846';
      ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 2 + r() * 5, 3 + r() * 7, r() * PI, 0, TAU); ctx.fill();
    }
  });
  carapace.wrapS = carapace.wrapT = THREE.RepeatWrapping;

  const key = new THREE.DirectionalLight('#fff0d8', 3.6);
  key.position.set(-5, 11, 8);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 0.5, far: 65 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.026;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const ambient = new THREE.HemisphereLight('#c6d9ff', '#262039', 1.0); scene.add(ambient);
  const rim = new THREE.DirectionalLight('#73dfff', 3.8);
  rim.position.set(5, 6, -5); scene.add(rim);
  const front = new THREE.DirectionalLight('#e4d7ff', 1.05);
  front.position.set(4, 4, 12); scene.add(front);
  const goldLight = new THREE.PointLight('#ffb13b', 36, 26, 2);
  goldLight.position.set(-8, 3, -3); scene.add(goldLight);
  const cyanLight = new THREE.PointLight('#48d6ff', 48, 24, 2);
  cyanLight.position.set(9, 2, -7); scene.add(cyanLight);
  const chargeLight = new THREE.PointLight('#78ddff', 0, 7, 2);
  const impactLight = new THREE.PointLight('#78ddff', 0, 9, 2);
  scene.add(chargeLight, impactLight);
  let impactLightLife = 0;
  const shotHistory = new Map();

  const voidRoot = group(scene); voidRoot.name = 'stage:void';

  const skyMaterial = material(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `${noiseGLSL}
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 p=(vUv-vec2(.56,.54))*vec2(2.3,1.0);
        float radius=length(p), angle=atan(p.y,p.x);
        float spiral=sin(angle*3.0-radius*22.0+fbm(p*6.0)*4.0);
        float clouds=fbm(p*8.0+vec2(uTime*.004,0));
        float ribbon=pow(max(0.0,1.0-abs(p.y+sin(p.x*4.0)*.12)*3.6),4.0);
        float dust=pow(clouds,2.8)*ribbon;
        vec3 c=vec3(.008,.003,.023);
        c+=vec3(.19,.045,.31)*dust*2.2;
        c+=vec3(.1,.04,.18)*pow(max(0.0,spiral),5.0)*exp(-radius*4.5)*clouds;
        c+=vec3(.075,.17,.24)*pow(clouds,4.0)*ribbon*smoothstep(-.2,.6,p.x);
        c+=vec3(.18,.07,.022)*exp(-radius*9.0)*clouds;
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  mesh(voidRoot, plane, skyMaterial, [0, 20, -85], [210, 130, 1], false).renderOrder = -10;
  const starPositions = [], starColors = [];
  for (let i = 0; i < 1700; i++) {
    starPositions.push((rng() - 0.5) * 170, rng() * 90 - 20, -45 - rng() * 65);
    const c = new THREE.Color().setHSL(0.57 + rng() * 0.2, 0.16 + rng() * 0.35, 0.4 + rng() * 0.5);
    starColors.push(c.r, c.g, c.b);
  }
  const starsGeo = geometry(new THREE.BufferGeometry());
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starsGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starsGeo, material(new THREE.PointsMaterial({ size: 0.18, map: glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  voidRoot.add(stars);
  const celestial = group(voidRoot, 3, 16, -78);
  const eclipse = basic('#04030a');
  ellipsoid(celestial, eclipse, [0, 0, 0], [5.8, 5.8, 0.35]);
  const hotGold = standard('#cfa359', 0.32, { metalness: 0.76, emissive: '#ffaf30', emissiveIntensity: 1.1 });
  const dimGold = standard('#846140', 0.43, { metalness: 0.62, emissive: '#775129', emissiveIntensity: 0.15 });
  const blueInlay = standard('#6acbd1', 0.35, { metalness: 0.7, emissive: '#36ccf1', emissiveIntensity: 0.8 });
  mesh(celestial, geometry(new THREE.TorusGeometry(5.85, 0.045, 8, 144)), hotGold, [0, 0, 0.1], [1, 1, 1], false);
  const halo = billboard(material(new THREE.SpriteMaterial({ map: glow, color: '#ffbf63', transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  halo.position.z = -0.7; halo.scale.set(18, 18, 1); celestial.add(halo);
  const orbit = mesh(celestial, geometry(new THREE.TorusGeometry(8.2, 0.025, 6, 144, PI * 1.83)), blueInlay, [0, 0, 0], [1, 0.42, 1], false);
  orbit.rotation.set(0.25, -0.2, -0.42);
  const orbit2 = mesh(celestial, geometry(new THREE.TorusGeometry(6.55, 0.022, 6, 128, PI * 1.65)), dimGold, [0, 0, 0.2], [1, 1, 1], false);
  orbit2.rotation.z = 1.7;

  const arena = group(voidRoot);
  const stoneMats = ['#555568', '#646078', '#4b515f', '#736d78'].map((c) => standard(c, 0.91, { map: stone, bumpMap: bump, bumpScale: 0.06 }));
  const sideStone = standard('#393044', 0.96, { map: stone, bumpMap: bump, bumpScale: 0.09 });
  const polished = standard('#426678', 0.46, { map: stone, bumpMap: bump, bumpScale: 0.012, metalness: 0.25 });
  const spawnStone = standard('#81736b', 0.84, { map: stone, bumpMap: bump, bumpScale: 0.045 });
  const crackMat = basic('#0b0916');
  function slab(inner, outer, start, end, depth, mat) {
    const outline = [];
    const segments = Math.max(3, Math.ceil((end - start) * 10));
    for (let i = 0; i <= segments; i++) {
      const a = mix(start, end, i / segments);
      const r = outer + (i === 0 || i === segments ? -0.05 : (rng() - 0.5) * 0.045);
      outline.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = segments; i >= 0; i--) {
      const a = mix(start, end, i / segments);
      outline.push([Math.cos(a) * inner, Math.sin(a) * inner]);
    }
    const pos = [], uv = [], idx = [];
    for (const y of [0, -depth]) for (const p of outline) { pos.push(p[0], y, p[1]); uv.push(p[0] * 0.16, p[1] * 0.16); }
    const count = outline.length;
    for (let i = 0; i < segments; i++) {
      const j = count - 1 - i;
      idx.push(i, j, i + 1, i + 1, j, j - 1);
      idx.push(count + i, count + i + 1, count + j, count + i + 1, count + j - 1, count + j);
    }
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      idx.push(i, j, count + i, j, count + j, count + i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const flat = g.toNonIndexed(); g.dispose(); flat.computeVertexNormals();
    mesh(arena, geometry(flat), mat);
  }
  mesh(arena, cylinder, polished, [0, -0.16, 0], [1.65, 0.32, 1.65]);
  for (const [inner, outer, count] of [[1.7, 3.08, 9], [3.13, 5.38, 11], [5.46, 7.99, 15], [8.08, 15.4, 21]]) {
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU + (inner > 6 ? 0.11 : 0);
      slab(inner, outer, a + 0.004, a + TAU / count - 0.005, 0.38 + rng() * 0.4, inner === 3.13 ? spawnStone : stoneMats[i % stoneMats.length]);
    }
  }
  for (const [radius, mat, thickness] of [[1.67, blueInlay, 0.022], [3.1, dimGold, 0.017], [5.42, dimGold, 0.027], [8.03, dimGold, 0.022], [11.85, hotGold, 0.023], [12.7, dimGold, 0.04]]) {
    const m = mesh(arena, geometry(new THREE.TorusGeometry(radius, thickness, 6, 160)), mat, [0, 0.018, 0]);
    m.rotation.x = PI / 2;
  }
  for (let i = 0; i < 80; i++) {
    const a = i / 80 * TAU;
    const r = i % 5 ? 11.5 : 11.4;
    const line = tube(arena, [[Math.cos(a) * r, 0.016, Math.sin(a) * r], [Math.cos(a) * 11.7, 0.016, Math.sin(a) * 11.7]], 0.013, i % 5 ? dimGold : blueInlay, 1, 4);
    line.castShadow = false;
  }
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.5 + rng() * 6.7), z = (rng() - 0.5) * 6;
    tube(arena, [[x - 0.4, 0.009, z - 0.5], [x - 0.1, 0.01, z - 0.17], [x + 0.09, 0.011, z - 0.07], [x + 0.25, 0.01, z + 0.4]], 0.013 + rng() * 0.009, crackMat, 8, 3).castShadow = false;
  }
  for (let i = 0; i < 4; i++) {
    const r = 12.4 - i * 1.65;
    mesh(arena, geometry(new THREE.CylinderGeometry(r, r - 0.9, 0.65, 48)), sideStone, [0, -0.7 - i * 0.64, 0]);
    const band = mesh(arena, geometry(new THREE.TorusGeometry(r - 0.2, 0.04, 6, 96)), i === 0 ? dimGold : sideStone, [0, -0.75 - i * 0.64, 0]);
    band.rotation.x = PI / 2;
  }
  const foundation = new THREE.InstancedMesh(rockGeometry, sideStone, 85);
  for (let i = 0; i < 85; i++) {
    const a = rng() * TAU, r = 4 + rng() * 8;
    dummy.scale.set(0.8 + rng() * 1.6, 0.65 + rng() * 1.5, 0.9 + rng() * 1.5);
    dummy.position.set(Math.cos(a) * r, -0.8 - Math.max(dummy.scale.x, dummy.scale.y, dummy.scale.z), Math.sin(a) * r);
    dummy.rotation.set(rng() * PI, rng() * PI, rng() * PI);
    dummy.updateMatrix(); foundation.setMatrixAt(i, dummy.matrix);
  }
  foundation.castShadow = foundation.receiveShadow = true;
  arena.add(foundation);
  const rubble = new THREE.InstancedMesh(rockGeometry, stoneMats[1], 72);
  for (let i = 0; i < 72; i++) {
    const a = rng() * TAU, r = 8.7 + rng() * 3.8;
    const x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    if (Math.abs(z) < 0.85) z = Math.sign(z || 1) * 0.85;
    dummy.position.set(x, 0.06, z); dummy.rotation.set(rng(), rng() * TAU, rng());
    dummy.scale.set(0.08 + rng() * 0.23, 0.07 + rng() * 0.15, 0.1 + rng() * 0.23);
    dummy.updateMatrix(); rubble.setMatrixAt(i, dummy.matrix);
  }
  rubble.castShadow = rubble.receiveShadow = true; arena.add(rubble);
  const architecture = group(voidRoot);
  function column(x, z, h, scale = 1) {
    const root = group(architecture, x, 0, z); root.scale.setScalar(scale);
    mesh(root, cylinder, sideStone, [0, 0.16, 0], [0.8, 0.32, 0.8]);
    mesh(root, cylinder, stoneMats[1], [0, 0.43, 0], [0.64, 0.22, 0.64]);
    const shaft = lathe([[0.48, 0.47, 0.47], [0.62, 0.43, 0.43], [h - 0.3, 0.36, 0.36], [h, 0.42, 0.42]], 16);
    const p = shaft.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > h - 0.01) p.setY(i, p.getY(i) + p.getX(i) * 0.65 + Math.sin(i * 12) * 0.09);
      if (i % 2) { p.setX(i, p.getX(i) * 0.89); p.setZ(i, p.getZ(i) * 0.89); }
    }
    shaft.computeVertexNormals(); mesh(root, shaft, stoneMats[0]);
    for (const y of [0.6, h - 0.35]) {
      const r = mesh(root, geometry(new THREE.TorusGeometry(0.44, 0.032, 6, 24)), dimGold, [0, y, 0]); r.rotation.x = PI / 2;
    }
    tube(root, [[0.02, 0.6, 0.43], [0.02, h * 0.45, 0.41], [-0.04, h * 0.6, 0.42]], 0.018, blueInlay, 3, 4);
    const broken = mesh(root, rockGeometry, stoneMats[1], [0.45, h + 0.65, -0.3], [0.5, 0.38, 0.45]);
    broken.rotation.set(0.3, 0, -0.35);
  }
  column(-16, -10, 3.7); column(16, -10, 4.5);
  column(-8, -17, 3.1); column(8, -17, 3.6);
  for (const side of [-1, 1]) {
    const dais = group(architecture, side * 18, 2.4, -18);
    mesh(dais, geometry(new THREE.CylinderGeometry(5, 3.8, 1, 48)), sideStone, [0, 0, 0], [1, 1, 0.68]);
    mesh(dais, geometry(new THREE.CylinderGeometry(4.6, 4.8, 0.25, 48)), stoneMats[0], [0, 0.64, 0], [1, 1, 0.68]);
    const rail = mesh(dais, geometry(new THREE.TorusGeometry(4.75, 0.035, 6, 80)), hotGold, [0, 0.83, 0]); rail.rotation.x = PI / 2; rail.scale.y = 0.68;
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.95;
      mesh(dais, cylinder, stoneMats[2], [x, 1.1 + 0.12 * Math.abs(i - 3), -1.1], [0.16, 1.2 + 0.24 * Math.abs(i - 3), 0.16]);
      ellipsoid(dais, hotGold, [x, 1.75 + 0.24 * Math.abs(i - 3), -1.1], [0.09, 0.09, 0.09], false);
    }
  }
  for (const child of architecture.children) {
    const radius = Math.hypot(child.position.x, child.position.z);
    child.position.x *= 58 / radius; child.position.z *= 58 / radius;
  }
  batch(arena); batch(architecture);
  const floating = new THREE.InstancedMesh(rockGeometry, sideStone, 48);
  const floatingData = [];
  for (let i = 0; i < 48; i++) {
    const a = rng() * TAU, r = 15 + rng() * 26;
    floatingData.push({ x: Math.cos(a) * r, y: -5 + rng() * 13, z: -60 - rng() * 34, size: 0.25 + rng() * 1.1, phase: rng() * TAU });
  }
  floating.castShadow = false; voidRoot.add(floating);

  const stagePalettes = {
    void: ['#06040d', '#160c27', '#fff0d8', '#73dfff', '#b6befa', '#242030', 0.014, 1.08],
    namek: ['#213d49', '#638e7f', '#fff1ba', '#81fce0', '#c4e6ce', '#344c46', 0.008, 1.04],
    wasteland: ['#372940', '#b57662', '#ffd1a0', '#a5a6eb', '#cfb5bf', '#462e35', 0.009, 1.04],
    'cell-games': ['#59839e', '#acb4a1', '#fff4d7', '#c3e3ee', '#c3dbee', '#455246', 0.009, 1.02],
    glacier: ['#112b48', '#597f96', '#dbf4ff', '#70ffe5', '#b7d5f4', '#2a405c', 0.008, 1.02],
    'west-city': ['#110e2b', '#362346', '#f9d6cf', '#56e8ff', '#abb5e1', '#251b38', 0.009, 1.12],
    'beerus-world': ['#312249', '#8c7c9d', '#ffe7c4', '#dd9aff', '#d5c4ed', '#3a3c55', 0.007, 1.05],
    lookout: ['#71a5c0', '#ccdbe0', '#fff1c8', '#a3dfff', '#e5eced', '#696980', 0.007, 0.99],
    'time-chamber': ['#e8e6df', '#e8e6df', '#fff5dd', '#d5dcea', '#eef1fc', '#8d8b86', 0.019, 0.98],
    volcanic: ['#160f1b', '#552c32', '#ffd1b5', '#ff8345', '#b8a5c8', '#412328', 0.009, 1.08],
  };
  // Catalog-bounded caches: a stage is built once, hidden on switch, disposed with the world.
  const stageCache = new Map([['void', { root: voidRoot, uniforms: [], motion: [] }]]);
  let activeStageId = 'void', activeStage = stageCache.get('void');
  function expandStage(stage, id) {
    const colors = {
      void: ['#555568', '#846140'], namek: ['#a9c585', '#577c71'],
      wasteland: ['#bd8265', '#704856'], 'cell-games': ['#ddded5', '#859a76'],
      glacier: ['#92c6df', '#4a94ad'], 'west-city': ['#242535', '#74738c'],
      'beerus-world': ['#9ac3b9', '#8b71a6'], lookout: ['#ddded5', '#d7b978'],
      'time-chamber': ['#e2e0d7', '#c2a675'], volcanic: ['#292631', '#854a35'],
    }[id];
    const root = group(stage.root); root.name = 'pit-expansion';
    const floorMat = standard(colors[0], id === 'glacier' ? .38 : .88, { map: stone, bumpMap: bump, bumpScale: .016 });
    const structureMat = standard(colors[1], .65, { map: stone, emissive: colors[1], emissiveIntensity: .12 });
    const accent = standard(stagePalettes[id][3], .45, { emissive: stagePalettes[id][3], emissiveIntensity: .22 });
    // A single 96-sided solid covers the full circular collision boundary, including
    // the chord between vertices. Existing center tiles remain above this substrate.
    mesh(root, geometry(new THREE.CylinderGeometry(FLOOR_RADIUS, FLOOR_RADIUS, .8, 96)), floorMat, [0, -.415, 0]);
    for (const radius of [18, 28, 39, 44.5]) {
      const path = mesh(root, geometry(new THREE.RingGeometry(radius - (radius === 44.5 ? .16 : .7), radius, 96)), structureMat, [0, .003, 0], [1, 1, 1], false);
      path.rotation.x = -PI / 2;
    }
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * TAU;
      const line = mesh(root, cube, i % 4 ? structureMat : accent, [Math.sin(a) * 31, .008, Math.cos(a) * 31], [i % 4 ? .06 : .16, .012, 25], false);
      line.rotation.y = a;
    }
    batch(root);
    const structures = group(stage.root); structures.name = 'outer-monuments';
    const plinth = new THREE.Shape(); plinth.absarc(0,0,58,0,TAU,false);
    const hole = new THREE.Path(); hole.absarc(0,0,47,0,TAU,true); plinth.holes.push(hole);
    const terrace=mesh(structures,geometry(new THREE.ExtrudeGeometry(plinth,{depth:1,bevelEnabled:false,curveSegments:48})),structureMat,[0,-1.4,0]);terrace.rotation.x=-PI/2;
    const pillars = new THREE.InstancedMesh(cube, structureMat, 40);
    const capitals = new THREE.InstancedMesh(cube, structureMat, 80);
    const inlays = new THREE.InstancedMesh(cube, accent, 40);
    for (let i = 0; i < 40; i++) {
      // Leave each gateway opening clear rather than filling it with a column.
      const a = Math.floor(i/10)*PI/2+.2+(i%10)/9*(PI/2-.4), h = i % 4 ? 8 : 14;
      dummy.position.set(Math.sin(a) * 51, h / 2 - .4, Math.cos(a) * 51);
      dummy.rotation.set(0, a, 0); dummy.scale.set(1.3, h, 1.8);
      dummy.updateMatrix(); pillars.setMatrixAt(i, dummy.matrix);
      for(let j=0;j<2;j++){
        dummy.position.y=j?h-.55:-.15;dummy.scale.set(2.1,.5,2.5);
        dummy.updateMatrix();capitals.setMatrixAt(i*2+j,dummy.matrix);
      }
      dummy.position.set(Math.sin(a)*50.08,h*.56,Math.cos(a)*50.08);dummy.scale.set(.09,h*.63,.035);
      dummy.updateMatrix();inlays.setMatrixAt(i,dummy.matrix);
    }
    pillars.receiveShadow = capitals.receiveShadow = true; structures.add(pillars,capitals,inlays);
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2;
      const gate = group(structures, Math.sin(a) * 53, 0, Math.cos(a) * 53); gate.rotation.y = a;
      for (const side of [-1, 1]) {
        mesh(gate, cube, structureMat, [side * 6, 9, 0], [2.2, 18, 3]);
        mesh(gate, cube, accent, [side * 6, 11, -1.52], [.16, 12, .06], false);
      }
      tube(gate, [[-6, 17, 0], [-4, 21, 0], [0, 23, 0], [4, 21, 0], [6, 17, 0]], .95, structureMat, 24, 8);
    }
    // The two vaults cross above the entire flight volume; no supports in play.
    stage.vaults = [];
    for (const a of [0, PI / 2]) {
      const vault = group(structures); vault.rotation.y = a;
      stage.vaults.push(vault);
      tube(vault, [[-50, 14, 0], [-35, 24, 0], [0, 31, 0], [35, 24, 0], [50, 14, 0]], .65, structureMat, 40, 8);
      tube(vault, [[-50, 15, 0], [-35, 25, 0], [0, 32, 0], [35, 25, 0], [50, 15, 0]], .055, accent, 40, 5);
    }
    batch(structures);
    stage.expansion = root;
  }
  function makeStage(id) {
    const root = group(scene); root.name = `stage:${id}`;
    const r = randomSource(219 + STAGES.findIndex((s) => s.id === id) * 143);
    const uniforms = [], motion = [], palette = stagePalettes[id];
    const terrainMap = texture(stone.clone()); terrainMap.repeat.setScalar(id === 'namek' || id === 'beerus-world' ? 7 : 22); terrainMap.needsUpdate = true;
    const terrainBump = texture(terrainMap.clone()); terrainBump.colorSpace = THREE.NoColorSpace; terrainBump.needsUpdate = true;
    const rock = standard('#686779', 0.93, { map: stone, bumpMap: bump, bumpScale: 0.09 });
    const trim = standard('#d7b978', 0.36, { metalness: 0.55 });
    const marble = standard('#ddded5', 0.6, { bumpMap: bump, bumpScale: 0.014 });
    const foliage = standard('#486d6b', 0.89);
    const back = material(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color(palette[0]) }, uHorizon: { value: new THREE.Color(palette[1]) }, uCloud: { value: id === 'time-chamber' ? 0 : 1 } },
      depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `${noiseGLSL}
        varying vec2 vUv;uniform vec3 uTop,uHorizon;uniform float uTime,uCloud;
        void main(){float h=smoothstep(.25,.9,vUv.y);vec3 c=mix(uHorizon,uTop,h);
          float n=fbm(vUv*vec2(7.,15.)+vec2(uTime*.002,0.));
          c+=uCloud*pow(n,3.)*.12*smoothstep(.24,.6,vUv.y);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    uniforms.push(back.uniforms.uTime);
    mesh(root, plane, back, [0, 23, -94], [230, 140, 1], false).renderOrder = -10;
    const block = (parent, mat, x, y, z, sx, sy, sz) => mesh(parent, cube, mat, [x, y, z], [sx, sy, sz]);
    const disc = (parent, mat, x, y, z, radius, depth) => mesh(parent, cylinder, mat, [x, y, z], [radius, depth, radius]);
    function torus(parent, mat, x, y, z, radius, thickness = 0.055, horizontal = true) {
      const t = mesh(parent, geometry(new THREE.TorusGeometry(radius, thickness, 6, 64)), mat, [x, y, z], [1, 1, 1], false);
      if (horizontal) t.rotation.x = PI / 2;
      return t;
    }
    function sun(x, y, size, color) {
      ellipsoid(root, basic(color, { fog: false }), [x, y, -83], [size, size, 0.5], false);
      const glowMat = material(new THREE.SpriteMaterial({ map: glow, color, opacity: 0.24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const sprite = billboard(glowMat); sprite.position.set(x, y, -84); sprite.scale.setScalar(size * 6); root.add(sprite);
    }
    function liquid(color, hot = false) {
      const mat = material(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uHot: { value: hot ? 1 : 0 }, uImpacts: { value: arenaImpacts } },
        vertexShader: 'varying vec2 vUv;varying vec2 vGround;void main(){vUv=uv;vGround=(modelMatrix*vec4(position,1.0)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `${noiseGLSL}
          varying vec2 vUv,vGround;uniform float uTime,uHot;uniform vec3 uColor;uniform vec4 uImpacts[6];
          void main(){vec2 p=vUv*vec2(75.,100.);float n=fbm(p+vec2(uTime*.07,-uTime*.04));
            float ripple=pow(.5+.5*sin(p.y*17.+n*12.+uTime*.7),13.);
            float veins=pow(1.-abs(sin(n*19.+p.x*.15)),5.);
            vec3 water=uColor*(.52+n*.7)+vec3(.24,.32,.29)*ripple*.23;
            vec3 lava=mix(vec3(.035,.008,.012),uColor*1.7,smoothstep(.4,.87,n)*.72+veins*.34);
            float response=0.;
            for(int i=0;i<6;i++){float age=uTime-uImpacts[i].z;float dist=length(vGround-uImpacts[i].xy);
              float front=dist-age*14.;response+=uImpacts[i].w*exp(-front*front*.7)*exp(-max(age,0.)*.7)*step(0.,age);}
            gl_FragColor=vec4(mix(water,lava,uHot)+mix(vec3(.4,.65,.6),uColor,uHot)*response*.6,1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }));
      uniforms.push(mat.uniforms.uTime);
      const water = mesh(root, plane, mat, [0, -0.55, -28], [190, 180, 1], false); water.rotation.x = -PI / 2;
      return mat;
    }
    function motes(color, snow = false) {
      const positions = [];
      for (let i = 0; i < 100; i++) positions.push((r() - 0.5) * 85, r() * 26, -9 - r() * 55);
      const g = geometry(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const p = new THREE.Points(g, material(new THREE.PointsMaterial({ color, size: snow ? 0.09 : 0.07, map: glow, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
      root.add(p); motion.push({ node: p, type: 'motes', base: 0, speed: snow ? -0.23 : 0.16 });
    }
    function cloudSea() {
      const clouds = group(root);
      const mat = standard('#d5e0e7', 1);
      for (let i = 0; i < 48; i++) {
        ellipsoid(clouds, mat, [(r() - 0.5) * 145, -6 - r() * 3, -13 - r() * 70], [6 + r() * 11, 1.7 + r() * 2.7, 5 + r() * 9], false).castShadow = false;
      }
    }
    function mountains(color, count = 14) {
      rock.color.set(color);
      for (let i = 0; i < count; i++) {
        const h = 5 + r() * 11;
        const m = mesh(root, rockGeometry, rock, [(i - count / 2) * 7, h * 0.3 - 3, -35 - r() * 30], [5 + r() * 7, h, 5 + r() * 6], false);
        m.rotation.set(0, r() * TAU, r() * 0.5);
      }
    }
    if (id === 'namek') {
      liquid('#459e88');
      const ground = standard('#b5ce8f', 0.93, { map: terrainMap, bumpMap: terrainBump, bumpScale: 0.012 });
      disc(root, ground, 0, -0.35, 0, 16, 0.7);
      const shore = geometry(new THREE.CylinderGeometry(1, 1.08, .65, 36));
      const sp = shore.attributes.position;
      for (let j = 0; j < sp.count; j++) { const a = Math.atan2(sp.getZ(j), sp.getX(j)), wobble = 1 + Math.sin(a * 7) * .065 + Math.cos(a * 11) * .035; sp.setX(j, sp.getX(j) * wobble); sp.setZ(j, sp.getZ(j) * wobble); }
      shore.computeVertexNormals();
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 7, z = -12 - r() * 24;
        const radius = 2.9 + r() * 2.5; mesh(root, shore, ground, [x, -.18, z], [radius, 1, radius]);
        const tree = group(root, x, 0.1, z), h = 3.7 + r() * 3.6;
        taper(tree, [[0, 0, 0], [0.12, h * 0.5, 0], [0, h, 0]], [0.22, 0.14, 0.11], trim, 8, 8);
        ellipsoid(tree, foliage, [0, h, 0], [1.45, 0.95, 1.45], false);
        for (let j = 0; j < 7; j++) {
          const a = j / 7 * TAU;
          taper(tree, [[0, h + 0.2, 0], [Math.sin(a) * 0.95, h + 0.85, Math.cos(a) * 0.95], [Math.sin(a) * 1.75, h + 0.65, Math.cos(a) * 1.75]], [0.19, 0.12, 0.003], foliage, 5, 5);
        }
      }
      sun(-28, 13, 2.9, '#ffe7a6'); sun(0, 18, 1.6, '#e7ffe0'); sun(28, 15, 2.1, '#fff5d2');
      motes('#a9eab8');
    } else if (id === 'wasteland') {
      const sand = standard('#bd8265', 0.98, { map: terrainMap, bumpMap: terrainBump, bumpScale: 0.035 });
      block(root, sand, 0, -0.32, -16, 140, 0.64, 120);
      const layers = ['#694657', '#945766', '#c78269', '#d6a174'].map((c) => standard(c, 0.94, { map: stone }));
      for (let i = 0; i < 13; i++) {
        const x = (i - 6) * 7.5, z = -20 - r() * 28, h = 3.5 + r() * 8, w = 3 + r() * 3;
        for (let j = 0; j < 4; j++) {
          mesh(root, geometry(new THREE.CylinderGeometry(w * (1 - j * 0.14), w * (1.16 - j * 0.12), h / 4, 7)), layers[j], [x + j * 0.15, h * (j + 0.5) / 4 - 0.2, z], [1, 1, 0.72]);
        }
      }
      for (const s of [-1, 1]) {
        const ridge = mesh(root, rockGeometry, layers[0], [s * 18, 1.3, -4], [4, 3.4, 7]); ridge.rotation.z = s * 0.3;
      }
      sun(-25, 9, 5.7, '#ffcb96'); motes('#e1b8a1');
    } else if (id === 'cell-games') {
      const grass = standard('#859a76', 0.99, { map: terrainMap });
      block(root, grass, 0, -0.95, -25, 150, 0.6, 145);
      block(root, rock, 0, -0.44, 0, 32, 0.7, 32);
      block(root, trim, 0, -0.19, 0, 32.2, 0.055, 32.2);
      const tiles = new THREE.InstancedMesh(cube, marble, 32 * 32);
      for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) {
        dummy.position.set(x - 15.5, -0.045, z - 15.5); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.976, 0.09, 0.976); dummy.updateMatrix(); tiles.setMatrixAt(x * 32 + z, dummy.matrix);
      }
      tiles.receiveShadow = true; root.add(tiles);
      for (const x of [-16, 16]) for (const z of [-16, 16]) {
        disc(root, marble, x, 0.65, z, 0.21, 1.3); mesh(root, cone, trim, [x, 1.47, z], [0.36, 0.36, 0.36]);
      }
      mountains('#7d9292');
      for (let i = 0; i < 28; i++) {
        const x = (i - 14) * 2.8, z = -16 - r() * 14, h = 1 + r() * 2;
        mesh(root, cone, foliage, [x, h * 0.5, z], [0.6, h, 0.6], false);
      }
      sun(-34, 38, 3.6, '#fff2ca');
    } else if (id === 'glacier') {
      const ice = standard('#73b7d4', 0.25, { metalness: 0.34, bumpMap: bump, bumpScale: 0.05 });
      const snow = standard('#c3dbea', 0.87, { bumpMap: terrainBump, bumpScale: .018 });
      block(root, snow, 0, -0.53, -20, 150, 0.9, 140);
      disc(root, ice, 0, -0.12, 0, 14, 0.24);
      for (let i = 0; i < 22; i++) {
        const h = 3 + r() * 8, x = (i - 11) * 4.7, z = -18 - r() * 30;
        const iceberg = mesh(root, cone, ice, [x, h * 0.4 - 0.5, z], [1.4 + r() * 3, h, 1.2 + r() * 3]); iceberg.rotation.set(r() * 0.24, r() * PI, (r() - 0.5) * 0.4);
      }
      for (let i = 0; i < 9; i++) tube(root, [[-13 + i * 3, 0.008, -4], [-11 + i * 3, 0.009, -1.5], [-12 + i * 3, 0.009, 1.6], [-10 + i * 3, 0.008, 4.5]], 0.021, blueInlay, 3, 3).castShadow = false;
      const aurora = material(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*7.+uTime*.2)*.13;p.z+=sin(p.x*8.)*.1;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform float uTime;void main(){float wave=.42+sin(vUv.x*11.+uTime*.14)*.19;float a=exp(-abs(vUv.y-wave)*7.)*pow(sin(vUv.x*3.14159),.7);float rays=.7+.3*sin(vUv.x*270.+uTime*.2);gl_FragColor=vec4(mix(vec3(.15,.8,.6),vec3(.34,.23,.8),vUv.y),a*rays*.55);}',
      }));
      uniforms.push(aurora.uniforms.uTime);
      mesh(root, geometry(new THREE.PlaneGeometry(1, 1, 64, 8)), aurora, [0, 12, -66], [140, 19, 1], false);
      sun(33, 20, 2.5, '#d6f1f9'); motes('#c8edff', true);
    } else if (id === 'west-city') {
      const asphalt = standard('#242535', 0.36, { metalness: 0.28, bumpMap: terrainBump, bumpScale: 0.018 });
      const wall = standard('#666181', 0.47, { metalness: 0.25 });
      const neon = standard('#b8769f', 0.3, { emissive: '#ed70bf', emissiveIntensity: 1.6 });
      const windows = basic('#85bdca', { toneMapped: false });
      block(root, asphalt, 0, -0.35, -18, 140, 0.7, 130);
      for (const z of [-3.3, 3.3]) block(root, blueInlay, 0, 0.006, z, 28, 0.009, 0.05);
      for (let x = -24; x <= 24; x += 3) { block(root, marble, x, .005, -5.1, 1.3, .008, .07).castShadow = false; }
      for (let i = 0; i < 18; i++) {
        const x = (i - 8.5) * 5.4, z = -22 - r() * 23, h = 3.8 + r() * 6, w = 1.1 + r() * 1.1;
        const tower = group(root, x, 0, z);
        disc(tower, wall, 0, h / 2, 0, w, h);
        mesh(tower, dome, marble, [0, h, 0], [w, w * .8, w]);
        torus(tower, i % 2 ? neon : blueInlay, 0, h - 0.3, 0, w * 1.035, 0.045);
        for (let j = 0; j < Math.floor(h / 1.15); j++) for (let k = 0; k < 5; k++) {
          const a = (k - 2) * 0.44;
          const window = block(tower, windows, Math.sin(a) * (w + 0.01), 1 + j * 1.1, Math.cos(a) * (w + 0.01), 0.25, 0.48, 0.025); window.rotation.y = a; window.castShadow = false;
        }
      }
      block(root, wall, 0, 3.8, -31, 100, 0.55, 2.7); block(root, neon, 0, 4.08, -29.6, 100, 0.04, 0.05);
      for (let x = -40; x <= 40; x += 12) block(root, wall, x, 1.7, -31, 0.7, 3.4, 1.2);
      const shuttle = group(root, 0, 4.9, -31);
      ellipsoid(shuttle, marble, [0, 0, 0], [3.8, 0.6, 0.8], false); block(shuttle, blueInlay, 0, 0.1, 0.77, 4.5, 0.2, 0.03);
      motion.push({ node: shuttle, type: 'shuttle', base: 0, speed: 0.13 });
      sun(-31, 18, 3.3, '#9faecf');
    } else if (id === 'beerus-world') {
      liquid('#827aa0');
      const lawn = standard('#9ac3b9', 0.93, { map: terrainMap, bumpMap: terrainBump, bumpScale: .012 }), bark = standard('#655476', 0.87, { bumpMap: bump, bumpScale: 0.08 });
      foliage.color.set('#8b71a6');
      disc(root, lawn, 0, -0.35, 0, 16, 0.7); torus(root, trim, 0, 0.015, 0, 12.5, 0.025);
      const tree = group(root, 2, -0.1, -43); tree.scale.setScalar(.47);
      mesh(tree, lathe([[0, 8, 6], [1.5, 4, 3], [7, 2.7, 2.6], [14, 2.1, 1.8], [21, 1, 1]], 18), bark);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU, x = Math.sin(a), z = Math.cos(a);
        taper(tree, [[x * 0.8, 10, z], [x * 5, 18, z * 4], [x * 11, 22 + r() * 3, z * 8]], [1.8, 1.2, 0.3, 0.03], bark, 8, 12);
        ellipsoid(tree, foliage, [x * 8.5, 23 + r() * 2, z * 7], [6.5, 3.3, 5.5], false);
        taper(tree, [[0, 0.8, 0], [x * 5, 0.4, z * 5], [x * 10, -0.1, z * 9]], [1.3, 0.5, 0.01], bark, 8, 8);
      }
      ellipsoid(tree, foliage, [0, 26, 0], [8, 3, 7], false);
      plate(tree, [[-1.3, 0], [-1.3, 4.2], [0, 5.2], [1.3, 4.2], [1.3, 0]], trim, 0.07, [0, 0, 3.5]);
      plate(tree, [[-0.95, 0], [-0.95, 3.8], [0, 4.5], [0.95, 3.8], [0.95, 0]], basic('#292039'), 0.03, [0, 0, 3.59]);
      const temple = group(root, -14, 2, -16);
      for (let j = 0; j < 4; j++) disc(temple, marble, 0, -j * 0.35, 0, 3.6 - j * 0.35, 0.32);
      for (const x of [-1.9, 1.9]) { disc(temple, trim, x, 1.6, 0, 0.16, 3.2); }
      mesh(temple, cone, trim, [0, 3.9, 0], [3.8, 1.3, 2.6]);
      motion.push({ node: temple, type: 'float', base: 2, speed: 0.45 }); motes('#d7baff'); sun(-28, 18, 4.5, '#debddc');
    } else if (id === 'lookout') {
      cloudSea(); disc(root, marble, 0, -0.35, 0, 17, 0.7);
      ellipsoid(root, marble, [0, -3.3, 0], [16, 3.2, 16], false);
      // The underbelly sits entirely below the common y=0 fighting surface.
      torus(root, trim, 0, 0.02, 0, 16.65, 0.08);
      const grout = standard('#aeb6b3', .83);
      for (let j = 0; j < 32; j++) {
        const a = j / 32 * TAU;
        tube(root, [[Math.cos(a) * 3, .004, Math.sin(a) * 3], [Math.cos(a) * 16.1, .004, Math.sin(a) * 16.1]], .009, grout, 1, 3).castShadow = false;
      }
      for (const radius of [3, 6, 9, 12, 15]) torus(root, grout, 0, .006, 0, radius, .008);
      for (const x of [-6, 0, 6]) {
        const palace = group(root, x, 0, -13);
        block(palace, marble, 0, 2, 0, x ? 4.5 : 5.7, 4, 4.5);
        mesh(palace, dome, trim, [0, 4.2, 0], [x ? 2.5 : 3.15, x ? 1.7 : 2.4, 2.5]);
        block(palace, trim, 0, 4.05, 0, x ? 4.7 : 5.9, .15, 4.7);
        disc(palace, trim, 0, x ? 6 : 6.8, 0, 0.065, 0.9);
        const door = plate(palace, [[-0.65, 0], [-0.65, 2.5], [0, 3.15], [0.65, 2.5], [0.65, 0]], basic('#48738b'), 0.025, [0, 0, 2.29]); door.castShadow = false;
        for (const s of [-1, 1]) { disc(palace, marble, s * 1.65, 1.7, 2.65, 0.15, 3.4); torus(palace, trim, s * 1.65, 3.25, 2.65, 0.18, 0.04); disc(palace, trim, s * 1.65, .13, 2.65, .23, .26); }
      }
      for (const s of [-1, 1]) {
        const palm = group(root, s * 13, 0, -6);
        taper(palm, [[0, 0, 0], [s * 0.3, 2.6, 0], [s * 0.5, 5.3, 0]], [0.25, 0.18, 0.12], trim, 8, 10);
        for (let j = 0; j < 9; j++) {
          const a = j / 9 * TAU;
          taper(palm, [[s * 0.5, 5.3, 0], [Math.sin(a) * 1.5, 5.9, Math.cos(a) * 1.5], [Math.sin(a) * 3, 4.6, Math.cos(a) * 3]], [0.06, 0.26, 0.17, 0.003], foliage, 5, 8);
        }
      }
      sun(-34, 34, 4, '#fff4d5');
    } else if (id === 'time-chamber') {
      block(root, marble, 0, -0.1, -30, 200, 0.2, 200);
      const glass = standard('#bbd2dd', 0.12, { transparent: true, opacity: 0.16, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
      const sand = standard('#dfb96e', 0.72, { emissive: '#a98143', emissiveIntensity: 0.13 });
      for (const s of [-1, 1]) {
        const clock = group(root, s * 9.5, 0, -16); clock.scale.setScalar(.76);
        for (const y of [0.3, 9.3]) {
          disc(clock, trim, 0, y, 0, 2.35, 0.35); torus(clock, marble, 0, y + 0.25, 0, 2.25, 0.1);
        }
        for (let j = 0; j < 4; j++) { const a = j / 4 * TAU + PI / 4; disc(clock, trim, Math.sin(a) * 2.15, 4.8, Math.cos(a) * 2.15, 0.09, 8.6); }
        mesh(clock, lathe([[0.6, 1.8, 1.8], [1.4, 1.72, 1.72], [3.7, 0.5, 0.5], [4.7, 0.08, 0.08], [5.7, 0.5, 0.5], [8.1, 1.72, 1.72], [9, 1.8, 1.8]], 24), glass).castShadow = false;
        mesh(clock, cone, sand, [0, 1.5, 0], [1.65, 1.8, 1.65]);
        mesh(clock, geometry(new THREE.ConeGeometry(1, 1, 24)), sand, [0, 7.7, 0], [1.52, 2.1, 1.52]).rotation.z = PI;
        disc(clock, sand, 0, 4.6, 0, 0.028, 4.5);
      }
      for (let j = 0; j < 4; j++) block(root, marble, 0, j * 0.15, -22 - j * 0.7, 10 - j, 0.3, 2.4);
      block(root, trim, 0, 3.4, -25, 6.6, 6.8, 1.1);
      block(root, marble, 0, 3.4, -24.35, 6.1, 6.5, 0.2);
      plate(root, [[-1.8, 0], [-1.8, 4.8], [0, 5.7], [1.8, 4.8], [1.8, 0]], basic('#373b50'), 0.04, [0, 0.7, -24.19]);
    } else if (id === 'volcanic') {
      const lava = liquid('#ff7226', true);
      const basalt = standard('#24232e', 0.85, { map: terrainMap, bumpMap: terrainBump, bumpScale: 0.045 });
      disc(root, basalt, 0, -.38, 0, 15.6, .76);
      for (const s of [-1, 1]) for (let i = 0; i < 10; i++) {
        const x = (i - 5) * 4.5, z = s * (5.6 + r() * 2.2);
        disc(root, basalt, x, -0.4, z, 2.15, 0.8);
        if (s < 0 && i % 2) mesh(root, cone, basalt, [x, 2, z - 2], [1.6, 5 + r() * 3, 1.6]).rotation.z = (r() - 0.5) * 0.4;
      }
      const volcanicGlow = standard('#fcb26b', 0.45, { emissive: '#ff571e', emissiveIntensity: 2 });
      for (const s of [-1, 1]) tube(root, [[-16, 0.012, s * 2.3], [-8, 0.013, s * 3.1], [1, 0.013, s * 2.35], [8, 0.014, s * 3.3], [17, 0.013, s * 2.7]], 0.09, volcanicGlow, 24, 5).castShadow = false;
      const volcano = group(root, 5, -0.3, -43);
      mesh(volcano, lathe([[0, 17, 13], [3, 12, 10], [7, 8, 7], [12, 5, 4.6], [12.2, 3.8, 3.4], [9.5, 2.5, 2.3]], 16), basalt);
      torus(volcano, volcanicGlow, 0, 12.1, 0, 4.1, 0.25);
      for (const s of [-1, 1]) tube(volcano, [[s * 2, 12.1, 3.5], [s * 3, 9.4, 6], [s * 5, 6, 8], [s * 7, 1, 12]], 0.27, volcanicGlow, 12, 6);
      const smoke = standard('#4d3542', 1, { transparent: true, opacity: 0.53, depthWrite: false });
      for (let j = 0; j < 8; j++) ellipsoid(volcano, smoke, [j * 0.6, 14 + j * 2.7, -1], [2 + j * 0.65, 3.2, 2.2 + j * 0.5], false).castShadow = false;
      lava.uniforms.uColor.value.set('#ff7226'); motes('#ffad65');
    }
    // Relocate whole rigid objects before batching. Bounding extents, not just
    // centers, must clear the pit: scenery has no authoritative collision shapes.
    for(const child of root.children){
      if (child.isPoints || child.isSprite || child.material?.isShaderMaterial) continue;
      const box=new THREE.Box3().setFromObject(child),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const radius=Math.hypot(center.x,center.z);
      const clearance=48+Math.hypot(size.x,size.z)/2;
      if(box.max.y>.16&&box.min.y<14&&size.y>.2&&radius>1&&radius<clearance){child.position.x+=center.x*(clearance/radius-1);child.position.z+=center.z*(clearance/radius-1);}
    }
    batch(root);
    return { root, uniforms, motion };
  }
  function selectStage(requested) {
    const id = STAGES.some((s) => s.id === requested) ? requested : 'void';
    if (id === activeStageId) return;
    activeStage.root.visible = false;
    if (!stageCache.has(id)) stageCache.set(id, makeStage(id));
    activeStage = stageCache.get(id); activeStage.root.visible = true; activeStageId = id;
    const p = stagePalettes[id];
    scene.background.set(p[0]); scene.fog.color.set(p[1]); scene.fog.density = p[6]; renderer.toneMappingExposure = p[7];
    key.color.set(p[2]); key.intensity = id === 'time-chamber' ? 2.6 : 3.6;
    rim.color.set(p[3]); rim.intensity = id === 'time-chamber' ? 1.8 : 3.8;
    ambient.color.set(p[4]); ambient.groundColor.set(p[5]); ambient.intensity = id === 'time-chamber' ? 1.8 : 1.25;
    goldLight.intensity = id === 'void' ? 36 : id === 'volcanic' ? 45 : 0;
    cyanLight.intensity = id === 'void' ? 48 : id === 'west-city' ? 30 : 0;
  }

  function makeCharacter(id) {
    const resources = { geometries: new Set(), materials: new Set(), textures: new Set() }, previousOwner = resourceOwner;
    resourceOwner = resources;
    try {
    const isG = id === 'goku', isV = id === 'vegeta', isJ = id === 'jiren', isF = id === 'frieza';
    const isB = id === 'beerus', isH = id === 'gohan', isP = id === 'piccolo', isT = id === 'trunks', isA = id === 'android18';
    const is17 = id === 'android17', isK = id === 'krillin', isTien = id === 'tien';
    const isC = id === 'cell', isU = id === 'buu', isHit = id === 'hit', isR = id === 'broly', gi = isG || isH || isP || isK || isTien;
    const root = new THREE.Group(); root.name = `${id}-articulated-fighter`;
    const proportions = {
      goku: [1.47, .49, .79, 1.24, .45, .23, .17, .19], vegeta: [1.38, .48, .79, 1.24, .44, .23, .17, .17],
      jiren: [1.33, .64, 1.02, 1.52, .59, .32, .245, .23], frieza: [1.26, .4, .87, 1.36, .39, .245, .14, .157],
      beerus: [1.47, .335, .8, 1.18, .295, .19, .11, .265], gohan: [1.5, .49, .82, 1.23, .45, .235, .17, .19],
      piccolo: [1.58, .51, .92, 1.42, .47, .265, .2, .225], trunks: [1.46, .44, .78, 1.2, .39, .22, .15, .18],
      android18: [1.46, .35, .72, 1.14, .335, .21, .12, .18], cell: [1.43, .515, .92, 1.42, .47, .25, .19, .19],
      buu: [1.12, .62, .67, 1.11, .61, .41, .205, .31], hit: [1.39, .46, .9, 1.37, .42, .245, .168, .19],
      broly: [1.48, .7, 1.02, 1.5, .645, .355, .25, .26],
      android17: [1.45, .42, .78, 1.2, .38, .225, .15, .18],
      krillin: [1.16, .43, .7, 1.22, .39, .225, .15, .18],
      tien: [1.55, .56, .88, 1.32, .49, .26, .21, .22],
    };
    const [hipsHeight, shoulder, shoulderY, headY, chestWidth, chestDepth, muscle, legWidth] = proportions[id];
    const body = group(root, 0, hipsHeight, 0);
    const torso = group(body);
    const skinBase = isJ ? '#a9a8ba' : isF ? '#e8e5fa' : isB ? '#a28bbb' : isP ? '#83b15c' : isC ? '#bec4a7' : isU ? '#ef9ac1' : isHit ? '#92869f' : isA ? '#f5c7ad' : isR ? '#d5a280' : '#efb28a';
    const shadowBase = isJ ? '#686578' : isF ? '#b8a3d0' : isB ? '#735887' : isP ? '#467944' : isC ? '#716784' : isU ? '#bd608d' : isHit ? '#514961' : '#b96f55';
    const skin = standard(skinBase, isF ? 0.53 : 0.91);
    const skinShadow = standard(shadowBase, 0.68);
    const ink = standard('#151421', 0.65);
    const mouth = standard(isF ? '#74556e' : isJ ? '#62566b' : '#805046', 0.68);
    const white = standard('#e8e5e1', 0.85);
    const blue = standard(isV ? '#193da2' : isB ? '#3779a9' : '#12366e', 0.75, { bumpMap: cloth, bumpScale: 0.012 });
    const blueLight = standard('#3358bd', 0.69, { bumpMap: cloth, bumpScale: 0.01 });
    const orange = standard(isTien ? '#247452' : isH || isP ? '#56407c' : '#e47423', 0.94, { bumpMap: cloth, bumpScale: 0.016 });
    const fold = standard(isTien ? '#174a35' : isH || isP ? '#322546' : '#a64213', 0.96);
    const red = standard('#bc1536', 0.89, { bumpMap: cloth, bumpScale: 0.009 });
    const redLight = standard('#cf2440', 0.91);
    const ranger = standard('#37835e', .94, { bumpMap: cloth, bumpScale: .012 });
    const gold = standard('#f6c943', 0.35, { metalness: 0.32, flatShading: true });
    const goldShade = standard('#d79426', 0.44, { metalness: 0.27, flatShading: true });
    const goldLightMat = standard('#ffe58b', 0.32, { metalness: 0.3, flatShading: true });
    const armorGold = standard('#d9ae52', 0.47, { metalness: 0.35 });
    const armorShade = standard('#977338', 0.58, { metalness: 0.25 });
    const purple = standard('#7042a0', 0.2, { metalness: 0.42 });
    const lilac = standard('#c7b0df', 0.48);
    const denim = standard(isA ? '#4c6fa5' : '#46739a', 0.84, { bumpMap: cloth, bumpScale: 0.017 });
    const coat = standard('#494359', 0.66, { metalness: 0.08, bumpMap: cloth, bumpScale: 0.008 });
    const shell = standard('#81b64e', 0.54, { map: carapace, bumpMap: cloth, bumpScale: 0.01 });
    const pelt = standard('#749646', 0.93);
    const bootLeather = standard('#87603d', 0.62);
    const pink = standard('#c99493', 0.73);
    const iris = standard(isF || isHit ? '#b22a44' : isB ? '#e5d059' : isP ? '#141b14' : isC ? '#d24e83' : '#203943', 0.4);
    const torsoMat = gi ? orange : is17 ? white : isV ? blue : isHit ? coat : isJ || isT || isA || isC ? ink : skin;
    const waist = isU ? 0.48 : isR ? 0.35 : isB || isA ? 0.215 : isJ ? 0.34 : 0.26;
    mesh(torso, lathe([
      [-0.13, 0.06, 0.08], [-0.07, waist, isU ? 0.34 : 0.21], [0.12, waist * 0.92, isU ? 0.37 : 0.19],
      [0.33, waist * 1.05, isU ? 0.4 : chestDepth * 0.84], [shoulderY - 0.15, chestWidth, chestDepth],
      [shoulderY + 0.04, chestWidth * 0.93, chestDepth * 0.85], [shoulderY + 0.17, 0.16, 0.14],
      [shoulderY + 0.18, 0.01, 0.01],
    ], 24), torsoMat);
    if (isJ) mesh(torso, lathe([[0.47, 0.33, 0.23], [0.59, 0.43, 0.3], [0.84, 0.59, 0.325], [1.04, 0.57, 0.285], [1.16, 0.25, 0.15], [1.2, 0.01, 0.01]], 24), red);
    ellipsoid(torso, isJ ? ink : torsoMat, [0, -0.03, 0], [waist + 0.03, 0.23, isU ? 0.34 : 0.22]);
    ellipsoid(torso, skin, [0, shoulderY + 0.21, 0], [isJ || isR ? 0.22 : isB ? 0.11 : 0.135, isJ || isP ? 0.24 : 0.17, 0.13]);
    for (const s of [-1, 1]) {
      if (gi) {
        ellipsoid(torso, orange, [s * 0.22, 0.69, 0.055], [0.23, 0.22, 0.16]);
        ribbon(torso, [[s * 0.28, 0.88, 0.09], [s * 0.2, 0.74, 0.275], [s * 0.09, 0.48, 0.277], [-s * 0.07, 0.34, 0.22]], [0.12, 0.13, 0.115, 0.1], orange);
        tube(torso, [[s * 0.27, 0.82, 0.2], [s * 0.17, 0.61, 0.3], [0, 0.38, 0.25]], 0.016, fold, 10, 5);
        for (let i = 0; i < 3; i++) tube(torso, [[s * 0.32, 0.2 + i * 0.085, 0.105], [s * 0.16, 0.15 + i * 0.1, 0.21], [s * 0.05, 0.14 + i * 0.08, 0.23]], 0.012, fold, 6, 4);
      }
      if (isJ) {
        ellipsoid(torso, redLight, [s * 0.255, 0.84, 0.226], [0.315, 0.185, 0.145]);
        ellipsoid(torso, red, [s * 0.32, 1.07, -0.05], [0.25, 0.13, 0.22]);
        ellipsoid(torso, ink, [s * 0.28, 0.33, 0.01], [0.13, 0.3, 0.205]);
      }
      if (isF) {
        ellipsoid(torso, skin, [s * 0.18, 0.71, 0.182], [0.205, 0.16, 0.102]);
        ellipsoid(torso, lilac, [s * 0.24, 0.37, 0], [0.08, 0.2, 0.18]);
      }
    }
    if (gi) {
      ribbon(torso, [[-0.24, 0.84, 0.208], [0, 0.91, 0.18], [0.24, 0.84, 0.208]], [0.14, 0.17, 0.14], blue);
      const undershirt = new THREE.Shape();
      undershirt.moveTo(-0.21, 0.83); undershirt.lineTo(0.21, 0.83); undershirt.lineTo(0, 0.46); undershirt.closePath();
      mesh(torso, geometry(new THREE.ShapeGeometry(undershirt)), blue, [0, 0, 0.29]);
      mesh(torso, lathe([[-0.03, 0.285, 0.225], [0.045, 0.3, 0.23], [0.095, 0.28, 0.218]], 24), blue);
      ellipsoid(torso, blue, [0.08, 0.035, 0.245], [0.09, 0.065, 0.055]);
      ribbon(torso, [[0.06, 0.045, 0.258], [0.18, -0.14, 0.29], [0.29, -0.31, 0.25]], [0.1, 0.09, 0.065], blue);
      ribbon(torso, [[0.03, 0.03, 0.259], [-0.08, -0.18, 0.27], [-0.05, -0.39, 0.24]], [0.1, 0.08, 0.065], blue);
    }
    if (isV) {
      const armor = new THREE.Shape();
      armor.moveTo(-0.34, 0.55); armor.quadraticCurveTo(-0.41, 0.7, -0.35, 0.83);
      armor.lineTo(-0.24, 0.91); armor.quadraticCurveTo(0, 0.78, 0.24, 0.91);
      armor.lineTo(0.35, 0.83); armor.quadraticCurveTo(0.41, 0.7, 0.34, 0.55);
      armor.quadraticCurveTo(0, 0.47, -0.34, 0.55);
      mesh(torso, geometry(new THREE.ExtrudeGeometry(armor, { depth: 0.075, bevelEnabled: true, bevelSize: 0.027, bevelThickness: 0.025, bevelSegments: 2, steps: 1, curveSegments: 8 })), white, [0, 0, 0.23]);
      ellipsoid(torso, white, [0, 0.7, -0.16], [0.35, 0.24, 0.115]);
      ellipsoid(torso, armorGold, [0, 0.38, 0.207], [0.28, 0.21, 0.095]);
      for (let i = 0; i < 4; i++) tube(torso, [[-0.24, 0.25 + i * 0.08, 0.25], [0, 0.25 + i * 0.08, 0.306], [0.24, 0.25 + i * 0.08, 0.25]], 0.012, armorShade, 10, 5);
      for (const s of [-1, 1]) ribbon(torso, [[s * 0.34, 0.58, 0.23], [s * 0.32, 0.88, 0.23], [s * 0.25, 0.99, 0], [s * 0.25, 0.84, -0.22]], [0.095, 0.11, 0.13, 0.09], white);
    }
    if (isJ || isF) for (let i = 0; i < 3; i++) {
      ellipsoid(torso, isJ ? ink : skin, [0, 0.13 + i * 0.15, isJ ? 0.155 : 0.165], [isJ ? 0.245 : 0.185, 0.105, isJ ? 0.085 : 0.07]);
    }
    if (isF) ellipsoid(torso, purple, [0, 0.76, 0.273], [0.105, 0.13, 0.057]);

    const clothParts = [];
    if (is17) {
      mesh(torso, lathe([[.05,.275,.224],[.38,.3,.23],[.64,.38,.237],[.76,.365,.225]], 20), ranger);
      plate(torso, [[-.23,.75],[.23,.75],[.23,.47],[-.23,.47]], white, .012, [0,0,.24]);
      for (const s of [-1,1]) tube(torso, [[s*.25,.43,.225],[s*.27,.2,.225],[s*.22,.08,.222]], .009, ranger, 3, 4);
    }
    let sword = null, scabbardHilt = null;
    function drape(parent, mat, y, length, width, z) {
      const pivot = group(parent, 0, y, z), positions = [], uv = [], indices = [];
      for (let row = 0; row <= 6; row++) for (let col = 0; col <= 10; col++) {
        const t = row / 6, u = col / 10;
        positions.push((u - 0.5) * width * (0.79 + t * 0.21), -t * length + Math.sin(u * PI) * t * 0.045, -t * 0.3 + Math.cos(u * TAU * 3) * (0.025 + t * 0.04)); uv.push(u, t);
        if (row && col) { const b = row * 11 + col; indices.push(b, b - 1, b - 12, b, b - 12, b - 11); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
      mesh(pivot, geometry(g), mat); mat.side = THREE.DoubleSide;
      clothParts.push({ node: pivot, amount: 0.06, phase: clothParts.length * 1.7 });
      return pivot;
    }
    if (isB) {
      mesh(torso, lathe([[0.55, .3, .21], [.78, .44, .29], [.9, .41, .28], [.97, .15, .13]], 24), armorGold);
      mesh(torso, lathe([[.56, .295, .222], [.77, .448, .297], [.82, .44, .29]], 24), blue);
      plate(torso, [[-.24, .68], [.24, .68], [.2, .25], [0, .07], [-.2, .25]], ink, .02, [0, 0, .245]);
      for (let j = 0; j < 3; j++) plate(torso, [[0, .52 - j * .13], [.052, .455 - j * .13], [0, .39 - j * .13], [-.052, .455 - j * .13]], j % 2 ? blueLight : armorGold, .009, [0, 0, .273]);
      mesh(torso, lathe([[-.12, .28, .23], [0, .3, .24], [.09, .245, .22]], 24), blue);
      tube(torso, [[-.25, .035, .18], [0, .01, .252], [.25, .035, .18]], .03, armorGold, 10, 6);
    }
    if (isP) {
      const cape = drape(torso, white, 1.02, 1.93, 1.64, -.24);
      cape.name = 'weighted-pleated-cape';
      for (const s of [-1, 1]) {
        ellipsoid(torso, white, [s * .38, 1.03, -.025], [.39, .17, .36]);
        for (let j = 0; j < 3; j++) tube(torso, [[s * .16, 1.12 - j * .045, .15], [s * .4, 1.15 - j * .035, .27], [s * .65, 1.02 - j * .035, .1]], .023, lilac, 10, 5);
      }
    }
    if (isT || isA) {
      for (const s of [-1, 1]) {
        plate(torso, [[s * .06, .77], [s * .29, .86], [s * .4, .65], [s * .29, .04], [s * .085, .05]], denim, .04, [0, 0, .16]);
        ribbon(torso, [[s * .17, .84, .23], [s * .08, .62, .283], [s * .22, .47, .252]], [.14, .13, .07], blueLight);
        tube(torso, [[s * .29, .17, .226], [s * .13, .17, .262], [s * .12, .33, .27], [s * .28, .33, .235]], .0065, armorGold, 3, 4);
        ellipsoid(torso, armorGold, [s * .11, .38, .28], [.011, .011, .006], false);
      }
      ellipsoid(torso, denim, [0, .47, -.095], [.35, .39, .155]);
      if (isT) {
        mesh(torso, lathe([[.78, .21, .21], [.93, .2, .18], [1.01, .13, .14]], 20), red);
        plate(torso, [[-.2, .88], [.24, .85], [.13, .51], [-.13, .61]], red, .025, [0, 0, .23]);
        const scarf = drape(torso, red, .9, .6, .3, -.2); scarf.rotation.z = -.5;
        ribbon(torso, [[-.28, .78, .255], [0, .41, .294], [.24, .07, .25]], [.07, .075, .07], bootLeather);
        const sheath = group(torso, .02, .11, -.32); sheath.rotation.z = -.48;
        mesh(sheath, cube, blue, [0, .23, 0], [.15, 1.5, .11]);
        mesh(sheath, cube, armorGold, [0, -.52, 0], [.155, .08, .12]);
        scabbardHilt = group(sheath, 0, 1.05, 0);
        mesh(scabbardHilt, cube, armorGold, [0, 0, 0], [.43, .06, .13]);
        mesh(scabbardHilt, cylinder, bootLeather, [0, .22, 0], [.065, .4, .065]);
        for (let j = 0; j < 6; j++) mesh(scabbardHilt, cylinder, armorGold, [0, .06 + j * .062, 0], [.069, .018, .069]);
      } else {
        mesh(torso, lathe([[-.34, .37, .23], [-.29, .38, .24], [-.06, .33, .225], [.06, .28, .22]], 24), denim);
        mesh(torso, lathe([[.035, .288, .225], [.1, .278, .22]], 24), bootLeather);
        mesh(torso, cube, armorGold, [.04, .07, .238], [.095, .055, .025]);
      }
    }
    if (isC) {
      for (const s of [-1, 1]) {
        ellipsoid(torso, shell, [s * .27, .91, -.015], [.31, .23, .28]);
        plate(torso, [[s * .12, .41], [s * .28, .47], [s * .46, .06], [s * .38, -.26], [s * .18, -.02]], shell, .11, [0, 0, .01]);
        const wing = group(torso, s * .27, .92, -.24);
        plate(wing, [[0, 0], [s * .17, .18], [s * .41, .02], [s * .64, -1.64], [s * .35, -1.48], [s * .02, -.55]], ink, .065);
        tube(wing, [[s * .1, .1, .08], [s * .36, -.15, .08], [s * .57, -1.47, .08]], .029, shell, 12, 6);
        clothParts.push({ node: wing, amount: .023, phase: s });
      }
      for (let i = 0; i < 4; i++) ellipsoid(torso, coat, [0, .13 + i * .13, .2], [.21, .08, .085]);
      ellipsoid(torso, purple, [0, .67, .254], [.09, .1, .024]);
    }
    if (isU) {
      ellipsoid(torso, skin, [0, .25, .06], [.63, .58, .46]);
      for (const s of [-1, 1]) {
        ribbon(torso, [[s * .2, .84, .12], [s * .46, .73, .25], [s * .44, .49, .35]], [.23, .25, .2], ink);
        tube(torso, [[s * .15, .84, .25], [s * .31, .67, .39], [s * .4, .5, .4]], .027, armorGold, 10, 6);
      }
      drape(torso, purple, .78, 1.47, 1.65, -.38);
      mesh(torso, lathe([[-.2, .53, .37], [-.06, .6, .43], [.02, .57, .415]], 24), ink);
      ellipsoid(torso, armorGold, [0, -.09, .449], [.17, .13, .027]);
      tube(torso, [[-.09, -.145, .481], [-.08, -.037, .482], [0, -.12, .484], [.08, -.037, .482], [.09, -.145, .481]], .014, ink, 4, 5);
      ellipsoid(torso, skinShadow, [0, .19, .513], [.018, .013, .009], false);
    }
    if (isHit) {
      for (const s of [-1, 1]) {
        plate(torso, [[s * .05, 1.18], [s * .28, 1.25], [s * .44, .78], [s * .25, .35], [s * .04, .42]], coat, .07, [0, 0, .16]);
        const skirt = plate(torso, [[s * .04, .15], [s * .3, .15], [s * .54, -.96], [s * .15, -.92]], coat, .08, [0, 0, .08]); skirt.rotation.y = s * .2;
        tube(torso, [[s * .29, .09, .255], [s * .47, -.76, .185]], .014, ink, 1, 4);
      }
      for (let j = 0; j < 3; j++) ellipsoid(torso, coat, [0, .22 + j * .14, .216], [.29, .085, .076]);
      mesh(torso, lathe([[-.05, .29, .245], [.07, .295, .25]], 24), blue);
      drape(torso, coat, .09, 1.02, .9, -.22);
    }
    if (isR) {
      for (const s of [-1, 1]) {
        ellipsoid(torso, skin, [s * .285, .79, .24], [.32, .24, .18]);
        ellipsoid(torso, skin, [s * .39, .43, .01], [.18, .29, .26]);
        for (let j = 0; j < 3; j++) ellipsoid(torso, skin, [s * .13, .18 + j * .16, .245], [.135, .095, .083]);
      }
      tube(torso, [[-.34, .88, .392], [-.18, .71, .416], [-.03, .66, .344]], .009, skinShadow, 7, 4);
      mesh(torso, lathe([[-.25, .5, .32], [-.08, .49, .33], [.075, .4, .29]], 24), pelt);
      for (let j = 0; j < 19; j++) {
        const a = j / 19 * TAU, x = Math.sin(a), z = Math.cos(a);
        taper(torso, [[x * .43, -.06, z * .28], [x * .52, -.33, z * .35], [x * .48, -.55 - (j % 3) * .065, z * .34]], [.095, .12, .001], pelt, 5, 6);
      }
      mesh(torso, lathe([[.04, .405, .3], [.13, .395, .295]], 24), bootLeather);
    }

    function makeHand(parent, mat, sign) {
      const hand = group(parent, 0, -0.52, 0);
      const fist = group(hand), open = group(hand), point = group(hand), low = group(hand);
      ellipsoid(low,mat,[0,-.09,.01],[.112,.18,.088],false);low.visible=false;
      for (const [target, opened] of [[fist, false], [open, true]]) {
        ellipsoid(target, mat, [0, -0.075, 0], [0.115, 0.14, 0.079]);
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * 0.048;
          const length = 0.11 + (1 - Math.abs(i - 1.5) / 2) * 0.045;
          if (opened) {
            taper(target, [[x, -0.12, 0], [x * 1.2, -0.2, 0.015], [x * 1.4, -0.16 - length, 0.035]], [0.027, 0.025, 0.015], mat, 6, 6);
          } else {
            tube(target, [[x, -0.14, -0.005], [x, -0.19, 0.054], [x, -0.14, 0.09], [x, -0.1, 0.066]], 0.027, mat, 7, 6);
            ellipsoid(target, mat, [x, -0.16, 0.072], [0.028, 0.035, 0.028], false);
          }
        }
        taper(target, [[-sign * 0.08, -0.04, 0.028], [-sign * (opened ? 0.16 : 0.1), -0.1, 0.07], [-sign * (opened ? 0.18 : 0.055), -0.15, 0.08]], [0.039, 0.032, 0.02], mat, 7, 7);
      }
      ellipsoid(point, mat, [0, -.08, 0], [.104, .13, .075]);
      for (let j = 0; j < 4; j++) {
        const x = (j - 1.5) * .046, extended = j === 0 || (isP && j === 1);
        taper(point, [[x, -.11, .01], [x, extended ? -.24 : -.19, extended ? .01 : .07], [x, extended ? -.36 : -.12, extended ? .035 : .09]], [.026, .025, .012], mat, 6, 5);
      }
      open.visible = point.visible = false;
      return { joint: hand, fist, open, point, low };
    }
    const arms = [], legs = [];
    for (const s of [-1, 1]) {
      const upper = group(torso, s * shoulder, shoulderY, 0);
      upper.rotation.order='YXZ';
      const upperMat = is17 ? white : isV ? blue : isJ ? red : isT ? denim : isA ? white : isC ? shell : isHit ? coat : skin;
      if(!gi)ellipsoid(upper, upperMat, [-s * .018, -.10, 0], [muscle * 1.02, muscle * 1.25, muscle * .98]);
      mesh(upper, lathe([[-0.54, 0.105, 0.11], [-0.4, muscle * 0.84, muscle * 0.87], [-0.22, muscle, muscle], [-0.08, muscle * 0.8, muscle * 0.92], [0.04, 0.055, 0.06]], 16), upperMat);
      ellipsoid(upper, upperMat, [0, -0.27, 0.025], [muscle * 0.74, 0.205, muscle * 0.77]);
      if (isG || isH || isK || isTien) {
        mesh(upper, lathe([[-0.22, 0.2, 0.195], [-0.14, 0.215, 0.2], [-0.015, 0.21, 0.205], [0.12, 0.09, 0.085]], 18), orange);
        tube(upper, [[-0.17, -0.17, 0.11], [0, -0.2, 0.2], [0.17, -0.17, 0.11]], 0.013, fold, 8, 5);
      }
      if (isF) ellipsoid(upper, purple, [s * 0.03, 0.02, 0.02], [0.16, 0.11, 0.155]);
      if (isC) ellipsoid(upper, shell, [s * .06, .02, -.015], [.265, .19, .23]);
      if (isHit) ellipsoid(upper, coat, [s * .035, -.005, 0], [.24, .17, .19]);
      if (isP) {
        ellipsoid(upper, pink, [s * .08, -.26, .105], [.12, .185, .095]);
        for (let j = 0; j < 5; j++) tube(upper, [[s * .01, -.13 - j * .064, .181], [s * .1, -.14 - j * .064, .205], [s * .17, -.15 - j * .064, .148]], .009, skinShadow, 4, 4);
      }
      if (isA) for (let j = 0; j < 5; j++) mesh(upper, lathe([[-.43 + j * .072, .125, .128], [-.403 + j * .072, .126, .128]], 16), ink);
      if (is17 && s < 0) mesh(upper, lathe([[-.32,.165,.165],[-.19,.172,.17]],16), orange);
      if (isT && s > 0) {
        ellipsoid(upper, white, [.157, -.11, .047], [.018, .072, .066], false);
        ellipsoid(upper, ink, [.175, -.11, .05], [.006, .046, .039], false);
      }
      const lower = group(upper, 0, -0.51, 0);
      ellipsoid(lower, isF ? lilac : upperMat, [0, 0, 0], [muscle * 0.6, 0.10, muscle * 0.63]);
      const foreMat = is17 ? white : isV ? blue : isJ ? ink : isT ? denim : isA ? white : isC ? shell : isHit ? coat : skin;
      mesh(lower, lathe([[-0.5, 0.077, 0.078], [-0.38, 0.09, 0.092], [-0.18, muscle * 0.85, muscle * 0.82], [-0.05, muscle * 0.7, muscle * 0.7], [0.03, 0.025, 0.025]], 16), foreMat);
      if (gi || isV || isJ || isB || isU || isR) mesh(lower, lathe([[-0.51, 0.09, 0.095], [-0.46, 0.104, 0.104], [gi ? -0.31 : -0.2, isJ || isU ? 0.145 : 0.12, 0.125], [gi ? -0.29 : -0.19, isJ || isU ? 0.14 : 0.118, 0.123]], 16), gi ? blue : isB || isU ? armorGold : isR ? purple : white);
      if (isF) ellipsoid(lower, purple, [0, -0.19, 0.075], [0.082, 0.155, 0.058]);
      if (isP) {
        ellipsoid(lower, pink, [0, -.14, .1], [.094, .12, .048], false);
        for (let j = 0; j < 4; j++) tube(lower, [[-.077, -.07 - j * .05, .105], [0, -.07 - j * .05, .157], [.077, -.07 - j * .05, .105]], .008, skinShadow, 4, 4);
      }
      if (isA) for (let j = 0; j < 5; j++) mesh(lower, lathe([[-.41 + j * .073, .107, .11], [-.385 + j * .073, .11, .113]], 16), ink);
      const hand = makeHand(lower, isV || isJ ? white : isU ? armorGold : skin, s);
      if (isT && s > 0) {
        sword = group(hand.joint, 0, -.15, 0);
        mesh(sword, cylinder, bootLeather, [0, 0, 0], [.048, .22, .048]);
        mesh(sword, cube, armorGold, [0, -.13, 0], [.36, .06, .1]);
        plate(sword, [[-.05, -.17], [.05, -.17], [.065, -1.25], [0, -1.55], [-.065, -1.25]], white, .035, [0, 0, -.017]);
        tube(sword, [[0, -.2, .025], [0, -1.42, .025]], .008, blueLight, 1, 4);
        sword.visible = false;
      }
      arms.push({ upper, lower, hand, sign: s, rest: upper.position.clone() });

      const thighLength = isK ? .54 : isJ || isR || isP || isC ? 0.7 : isU ? .46 : .69;
      const shinLength = hipsHeight - thighLength - 0.11;
      const leg = group(body, s * (isU ? .3 : isR ? .3 : isJ || isTien ? .27 : .215), -0.035, s > 0 ? -.15 : .16);
      const pants = gi ? orange : is17 ? denim : isV || isB ? blue : isJ || isT || isA || isC ? ink : isU ? white : isHit ? coat : isR ? purple : skin;
      mesh(leg, lathe([[-thighLength, legWidth * 0.67, legWidth * 0.7], [-thighLength * 0.8, legWidth * 0.88, legWidth], [-0.25, legWidth, legWidth * 1.08], [-0.06, legWidth * 0.9, legWidth * 0.94], [0.09, 0.035, 0.05]], 18), pants);
      if (gi || isU || isB) for (let i = 0; i < 3; i++) tube(leg, [[s * legWidth * .7, -0.17 - i * 0.1, 0.09], [0, -0.22 - i * 0.1, legWidth * 1.06], [-s * legWidth * .55, -0.25 - i * 0.1, 0.13]], 0.01, isU ? lilac : gi ? fold : blueLight, 8, 4);
      if (isV) ellipsoid(leg, blueLight, [s * 0.025, -0.26, 0.07], [0.14, 0.245, 0.13]);
      if (isC) ellipsoid(leg, shell, [s * .035, -.28, -.035], [.2, .3, .15]);
      const shin = group(leg, 0, -thighLength, 0);
      ellipsoid(shin, pants, [0, 0, 0.01], [legWidth * 0.64, 0.10, legWidth * 0.66]);
      const bootMat = isP || isT || isA ? bootLeather : gi || isB ? blue : isF ? skin : isC ? shell : isU ? armorGold : isHit ? ink : isR ? pelt : white;
      mesh(shin, lathe([[-shinLength, 0.085, 0.11], [-shinLength + 0.12, 0.105, 0.125], [-0.19, isG ? 0.145 : 0.13, 0.14], [-0.035, isG ? 0.13 : 0.15, 0.15], [0.005, 0.11, 0.12]], 18), bootMat);
      const foot = group(shin, 0, -shinLength + 0.02, 0);
      ellipsoid(foot, bootMat, [0, 0, 0.085], [isF ? 0.12 : 0.14, 0.105, isF ? 0.2 : 0.255]);
      if (isG || isH) {
        tube(shin, [[-0.13, -0.08, 0.06], [0, -0.07, 0.151], [0.13, -0.08, 0.06]], 0.023, orange, 9, 5);
        tube(shin, [[0, -0.12, 0.15], [0.005, -shinLength + 0.13, 0.133], [0, -shinLength + 0.07, 0.2]], 0.018, orange, 8, 5);
        ellipsoid(foot, ink, [0, -0.07, 0.1], [0.143, 0.037, 0.26]);
      }
      if (isV) {
        ellipsoid(foot, armorGold, [0, 0.025, 0.235], [0.125, 0.073, 0.115]);
        for (let i = 0; i < 3; i++) tube(foot, [[-0.095, 0.08 - i * 0.009, 0.18 + i * 0.045], [0, 0.09 - i * 0.01, 0.18 + i * 0.045], [0.095, 0.08 - i * 0.009, 0.18 + i * 0.045]], 0.006, armorShade, 5, 4);
      }
      if (isB || isR) mesh(shin, lathe([[-.045, .16, .16], [-.14, .16, .16]], 18), isB ? armorGold : white);
      if (isT || isA || isHit) {
        ellipsoid(foot, ink, [0, -.07, .1], [.143, .037, .26], false);
        for (let j = 0; j < 2; j++) mesh(shin, cube, isHit ? coat : armorGold, [0, -.19 - j * .11, .138], [.19, .035, .035]);
      }
      if (isC) taper(foot, [[0, .005, .13], [0, .015, .27], [0, -.015, .42]], [.1, .08, .001], shell, 7, 6);
      if (isF) for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.105;
        taper(foot, [[x * 0.6, 0, 0.09], [x, -0.025, 0.25], [x * 1.25, -0.025, 0.37]], [0.055, 0.045, 0.025], skin, 8, 7);
        taper(foot, [[x * 1.2, -0.005, 0.3], [x * 1.25, 0.008, 0.36], [x * 1.25, -0.025, 0.43]], [0.032, 0.022, 0.001], purple, 7, 6);
      }
      legs.push({ upper: leg, lower: shin, foot, sign: s, thighLength, shinLength, rest: leg.position.clone() });
    }

    const head = group(torso, 0, headY, 0);
    head.scale.setScalar(isG || isV || isH || isT || isA || is17 || isK || isTien || isR ? .82 : isP || isHit ? .93 : 1);
    if (isJ) ellipsoid(head, skin, [0, 0.055, -0.02], [0.365, 0.425, 0.335]);
    else if (isF) ellipsoid(head, skin, [0, 0.035, -0.01], [0.305, 0.365, 0.29]);
    else if (isU) ellipsoid(head, skin, [0, 0, -.025], [.39, .37, .345]);
    else if (isB) mesh(head, lathe([[-.31, .1, .12], [-.2, .18, .2], [.02, .24, .235], [.21, .245, .205], [.32, .1, .11], [.34, .001, .001]], 24), skin);
    else if (isHit) mesh(head, lathe([[-.34, .11, .12], [-.2, .21, .2], [.03, .28, .25], [.3, .27, .235], [.45, .15, .13], [.48, .001, .001]], 24), skin);
    else mesh(head, lathe([[-0.32, 0.07, 0.095, 0, 0.04], [-0.245, isA ? .143 : .175, 0.17, 0, 0.02], [-0.1, isA ? .229 : .255, 0.235], [0.08, isA ? .262 : .285, 0.255], [0.235, 0.24, 0.22], [0.315, 0.12, 0.13], [0.34, 0.005, 0.005]], 24), skin);
    const faceZ = isJ ? 0.305 : isF ? 0.264 : isU ? .317 : isB ? .23 : 0.235;
    const brows = group(head); brows.name = 'eyebrows';
    if (isK) for (let row=0; row<2; row++) for (let col=0; col<3; col++) ellipsoid(head, skinShadow, [(col-1)*.072,.14+row*.065,.23-row*.025], [.019,.021,.009], false);
    if (isTien) {
      ellipsoid(head, ink, [0,.178,.229], [.053,.079,.018]);
      ellipsoid(head, white, [0,.178,.245], [.039,.061,.01]);
      ellipsoid(head, ink, [0,.18,.256], [.015,.025,.006], false);
    }
    function almond(parent, mat, x, y, z, w, h, tilt) {
      const shape = new THREE.Shape();
      shape.moveTo(-w, 0);
      shape.bezierCurveTo(-w * 0.45, h, w * 0.42, h * 0.85, w, 0);
      shape.bezierCurveTo(w * 0.4, -h * 0.8, -w * 0.4, -h * 0.7, -w, 0);
      const eye = mesh(parent, geometry(new THREE.ShapeGeometry(shape, 10)), mat, [x, y, z]);
      eye.rotation.z = tilt; eye.rotation.y = Math.sign(x) * 0.23;
      return eye;
    }
    for (const s of [-1, 1]) {
      const eyeX = isJ ? 0.17 : isF || isU ? 0.135 : isB ? .111 : 0.122;
      const eyeY = isJ ? 0.005 : -0.015;
      const w = isJ ? 0.155 : isB ? .089 : isA ? .097 : 0.105, h = isJ ? 0.127 : isF ? 0.063 : isHit ? .034 : 0.056;
      if (!isU) almond(head, ink, s * eyeX, eyeY, faceZ, w + 0.011, h + 0.012, s * (isJ ? 0.27 : 0.17));
      if (!isJ && !isU) {
        almond(head, white, s * eyeX, eyeY, faceZ + 0.009, w, h, s * 0.17);
        ellipsoid(head, iris, [s * (eyeX - 0.022), eyeY - 0.001, faceZ + 0.016], [isB ? .033 : 0.025, 0.035, 0.009], false);
        ellipsoid(head, ink, [s * (eyeX - 0.022), eyeY, faceZ + 0.025], [isB ? .005 : 0.01, 0.025, 0.006], false);
        ellipsoid(head, white, [s * (eyeX - .027), eyeY + .018, faceZ + .033], [.006, .006, .003], false);
        ribbon(brows, [[s * 0.03, 0.036, faceZ + 0.023], [s * 0.13, 0.08, faceZ + 0.016], [s * 0.222, 0.068, faceZ - 0.02]], [isA ? .018 : 0.035, isA ? .021 : 0.034, 0.011], isG || isV || isH || isT || isR ? goldShade : ink);
        tube(head, [[s * .06, -.081, faceZ + .006], [s * .16, -.085, faceZ - .003], [s * .215, -.06, faceZ - .029]], .006, skinShadow, 6, 4);
      } else if (isJ) {
        almond(head, basic('#090911'), s * eyeX, eyeY, faceZ + 0.007, w * 0.94, h * 0.94, s * 0.27);
        ellipsoid(head, white, [s * (eyeX - 0.03), 0.043, faceZ + 0.014], [0.018, 0.012, 0.005], false);
        tube(head, [[s * 0.042, 0.112, 0.312], [s * 0.17, 0.164, 0.303], [s * 0.285, 0.107, 0.233]], 0.028, skinShadow, 8, 7);
      } else {
        tube(head, [[s * .059, .009, faceZ + .021], [s * .133, -.031, faceZ + .018], [s * .215, .005, faceZ - .035]], .014, ink, 8, 5);
      }
      if (!isF && !isB && !isP && !isC) {
        ellipsoid(head, skin, [s * (isJ ? 0.353 : 0.28), -0.055, -0.008], [0.06, isJ ? 0.1 : 0.092, 0.065]);
        ellipsoid(head, skinShadow, [s * (isJ ? 0.382 : 0.31), -0.055, 0.032], [0.027, 0.057, 0.021], false);
      }
      if (isF) {
        tube(head, [[s * 0.24, -0.035, 0.23], [s * 0.205, -0.14, 0.237], [s * 0.125, -0.235, 0.19]], 0.022, lilac, 10, 6);
        for (let i = 0; i < 3; i++) tube(head, [[s * (0.237 - i * 0.015), -0.07 - i * 0.047, 0.244], [s * (0.285 - i * 0.019), -0.08 - i * 0.047, 0.18]], 0.007, mouth, 2, 4);
      }
      if (isP) {
        plate(head, [[s * .24, -.11], [s * .59, .12], [s * .43, -.2], [s * .26, -.19]], skin, .055, [0, 0, -.035]);
        tube(head, [[s * .29, -.12, .035], [s * .47, -.026, .027], [s * .37, -.148, .03]], .013, skinShadow, 5, 5);
        taper(head, [[s * .13, .19, .16], [s * .19, .5, .27], [s * .24, .53, .44]], [.024, .02, .009], skin, 8, 12);
        for (let j = 0; j < 2; j++) tube(head, [[s * .2, -.14 - j * .045, .227], [s * .15, -.19 - j * .04, .203]], .01, skinShadow, 2, 4);
      }
      if (isB) {
        plate(head, [[s * .075, .2], [s * .1, .91], [s * .25, 1.01], [s * .31, .63], [s * .24, .17]], skin, .08, [0, 0, -.06]);
        plate(head, [[s * .145, .36], [s * .175, .84], [s * .22, .9], [s * .26, .55]], skinShadow, .015, [0, 0, .035]);
        ellipsoid(head, lilac, [s * .078, -.17, .255], [.105, .075, .09], false);
      }
      if (isC) {
        plate(head, [[s * .2, -.26], [s * .35, -.05], [s * .37, .34], [s * .22, .2]], purple, .04, [0, 0, .075]);
        plate(head, [[s * .18, .13], [s * .19, .86], [s * .38, .78], [s * .43, .19], [s * .31, -.045]], shell, .21, [0, 0, -.15]);
        tube(head, [[s * .21, .26, .073], [s * .235, .77, .068], [s * .35, .72, .079]], .024, ink, 4, 5);
      }
      if (isA) { const earring = mesh(head, geometry(new THREE.TorusGeometry(.026, .007, 5, 12)), armorGold, [s * .291, -.165, .034]); earring.rotation.y = s * .35; }
      if (isU) for (let j = 0; j < 3; j++) ellipsoid(head, skinShadow, [s * (.28 + j * .014), .08 + j * .07, .12], [.013, .013, .009], false);
    }
    const nosePos = [0, -0.035, faceZ + 0.005, -0.038, -0.125, faceZ + 0.019, 0.035, -0.125, faceZ + 0.019, 0, -0.102, faceZ + (isJ ? 0.059 : 0.079)];
    const noseGeo = new THREE.BufferGeometry();
    noseGeo.setAttribute('position', new THREE.Float32BufferAttribute(nosePos, 3));
    noseGeo.setIndex([0, 1, 3, 0, 3, 2, 1, 2, 3]); noseGeo.computeVertexNormals();
    if (!isU) mesh(head, geometry(noseGeo), isB ? skinShadow : skin); else noseGeo.dispose();
    tube(head, [[isU ? -.14 : -0.065, -0.2, faceZ - 0.022], [0, isU ? -.25 : -0.19, faceZ - 0.005], [isU ? .14 : 0.065, -0.199, faceZ - 0.022]], isJ || isU ? 0.009 : 0.0065, mouth, 10, 5);
    ellipsoid(head, skin, [0, -0.221, faceZ - 0.036], [0.063, 0.014, 0.018], false);
    if (isF) ellipsoid(head, purple, [0, 0.18, -0.025], [0.267, 0.25, 0.267]);
    if (isC) ellipsoid(head, shell, [0, .26, -.05], [.28, .14, .24]);
    if (isHit) {
      for (const s of [-1, 0, 1]) tube(head, [[s * .145, -.27, .15], [s * .17, .12, .26], [s * .13, .37, .195], [s * .07, .465, .02]], .016, skinShadow, 12, 5);
      for (const s of [-1, 1]) tube(head, [[s * .17, -.22, .204], [s * .25, -.17, .17], [s * .276, .07, .1]], .019, coat, 10, 5);
    }
    if (isR) tube(head, [[-.06, -.12, .273], [-.025, -.17, .264], [.055, -.215, .204]], .009, skinShadow, 6, 4);
    let headAppendage = null;
    if (isU) {
      headAppendage = group(head, 0, .24, -.05);
      taper(headAppendage, [[0, 0, 0], [.07, .3, -.05], [.32, .41, -.22], [.52, .34, -.32], [.6, .19, -.28]], [.125, .1, .063, .028, .001], skin, 10, 22);
    }
    const hairGroups = new Map();
    function makeHair(style) {
      const hair = group(head); hair.name = `hair:${style}`;
      mesh(hair, lathe([[.105, .27, .244], [.2, .294, .26], [.31, .245, .225], [.39, .08, .07], [.4, .004, .004]], 20), goldShade);
      const hr = randomSource(isV ? 812 : isH ? 440 : 241), base = style === 'base', bob = (isT && base) || isA || is17;
      if (bob) {
        for (const s of [-1, 1]) {
          plate(hair, [[s * .2, .3], [s * .335, .23], [s * .385, -.32], [s * .26, -.34], [s * .23, -.04]], gold, .16, [0, 0, -.075]);
          tube(hair, [[s * .26, .25, .14], [s * .32, -.04, .1], [s * .337, -.29, .08]], .008, goldLightMat, 7, 4);
        }
        ellipsoid(hair, goldShade, [0, .0, -.16], [.31, .34, .135]);
        if (isA) {
          taper(hair, [[-.13, .31, .19], [.16, .22, .275], [.28, -.12, .19]], [.14, .13, .08, .006], gold, 5, 9);
          taper(hair, [[-.17, .28, .19], [-.28, .17, .19], [-.3, -.17, .1]], [.09, .065, .002], goldLightMat, 5, 7);
        } else for (const s of [-1, 1]) {
          taper(hair, [[s * .025, .29, .21], [s * .13, .15, .285], [s * .25, -.12, .23]], [.12, .1, .065, .001], gold, 5, 9);
          taper(hair, [[s * .115, .31, .18], [s * .25, .15, .24], [s * .3, -.15, .13]], [.08, .065, .001], goldLightMat, 5, 7);
        }
      } else if (style === 'long') {
        for (let j = 0; j < 15; j++) {
          const x = (j - 7) / 7;
          taper(hair, [[x * .21, .27, -.09], [x * .5, .2, -.34], [x * .64, -.65, -.55], [x * .51, -1.51 + Math.abs(x) * .44 + (j % 3) * .07, -.66 - (j % 2) * .07]], [.15, .2, .16, .09, .001], j % 3 ? gold : goldLightMat, 6, 13);
        }
        for (let j = 0; j < 11; j++) {
          const a = j / 11 * TAU, x = Math.sin(a), z = Math.cos(a);
          taper(hair, [[x * .22, .18, z * .18], [x * .34, .4, z * .24 - .05], [x * .41, .44 + (1 - Math.abs(x)) * .37, z * .18 - .25]], [.12, .1, .001], j % 3 ? gold : goldLightMat, 5, 7);
        }
      } else {
        const count = isR ? 17 : isH ? 12 : 17;
        for (let i = 0; i < count; i++) {
          const a = i / count * TAU, x = Math.sin(a), z = Math.cos(a), rootY = .14 + hr() * .11;
          const spread = isV ? .36 : isH ? .4 : isT ? .38 : isR ? .67 : base ? .62 : .54;
          const tall = style === 'beast' ? 1.5 : isV ? .96 : isH ? .85 : isR ? .87 : base ? .64 : .78;
          const top = .32 + (1 - Math.abs(x) * .72) * (tall - .32) + hr() * .075;
          taper(hair, [[x * .21, rootY, z * .19], [x * spread * .83, rootY + (style === 'beast' ? .48 : .23), z * .26 - .035], [x * spread, top, z * .25 - (isV ? .33 : .19)]], [.145, style === 'beast' ? .17 : .12, .065, .001], i % 4 === 0 ? goldLightMat : i % 3 === 0 ? goldShade : gold, 5, style === 'beast' ? 10 : 7);
        }
        if (isG || isR) {
          for (const s of [-1, 1]) taper(hair, [[s * .2, .18, .11], [s * .43, .19, .1], [s * (isR ? .68 : .6), .31, -.02]], [.14, .11, .001], gold, 5, 7);
          for (let i = 0; i < (isR ? 4 : 5); i++) {
            const x = (i - 2) * .087;
            taper(hair, [[x, .24, .2], [x - .065, .15, .29], [x - .1, -.04 + Math.abs(i - 2) * .03, .3]], [.093, .071, .001], i % 2 ? goldLightMat : gold, 5, 6);
          }
          if (isR) for (let i = 0; i < 9; i++) {
            const a = i / 8 * PI, x = Math.cos(a), z = -Math.sin(a);
            taper(hair, [[x * .2, .06, z * .2], [x * .36, -.13, z * .37], [x * .44, -.42, z * .5]], [.12, .14, .001], gold, 5, 6);
          }
        } else if (isH) {
          taper(hair, [[-.11, .36, .2], [-.04, .16, .32], [.08, -.09, .29]], [.14, .11, .001], gold, 5, 8);
        } else if (isT) {
          for (const s of [-1, 1]) taper(hair, [[s * .04, .31, .2], [s * .1, .19, .28], [s * .22, -.05, .26]], [.12, .085, .001], gold, 5, 7);
        } else {
          taper(hair, [[0, .28, .21], [0, .14, .288], [0, .065, .283]], [.14, .09, .001], goldShade, 5, 6);
          for (const s of [-1, 1]) taper(hair, [[s * .24, .25, .04], [s * .275, .12, .085], [s * .268, -.075, .075]], [.081, .045, .001], gold, 5, 6);
        }
      }
      batch(hair); hairGroups.set(style, hair); return hair;
    }
    let tail = null;
    if (isF) {
      tail = group(body, 0, -0.03, -0.17);
      taper(tail, [[0, 0, 0], [0.12, -0.2, -0.55], [0.52, -0.44, -1.1], [1.05, -0.36, -1.34], [1.23, 0.04, -1.26], [0.99, 0.46, -1.18]], [0.16, 0.14, 0.1, 0.069, 0.021], skin, 12, 36);
      taper(tail, [[1.12, 0.32, -1.22], [0.99, 0.46, -1.18], [0.88, 0.52, -1.12]], [0.05, 0.028, 0.001], purple, 10, 9);
    }
    if (isB) {
      tail = group(body, 0, -.08, -.18);
      taper(tail, [[0, 0, 0], [.12, -.34, -.47], [.53, -.71, -.83], [1.02, -.58, -.92], [1.15, -.08, -.83], [.98, .23, -.76]], [.071, .064, .055, .044, .032, .015], skin, 9, 28);
    }
    batch(root);
    // Very small clothing ribbons need two-sided shading, not duplicate geometry.
    for (const mat of [orange, fold, blue, white, ink]) mat.side = THREE.DoubleSide;
    const model = { id, resources, root, body, torso, head, arms, legs, tail, headAppendage, hipsHeight, shoulderY, headY, shoulder, waist, chestDepth, brows, sword, scabbardHilt, clothParts, hairGroups, makeHair,
      eyeLocal: new THREE.Vector3(0, isJ ? .005 : -.015, faceZ + .016), eye: new THREE.Vector3(), chest: new THREE.Vector3(), releaseStyle: null, clash: null,
      gear: new Map(), loadout: [], tint: '#ffc45b', stride: 0, inverseBody: new THREE.Matrix4(), footTarget: new THREE.Vector3(), bounds: new THREE.Box3(), boundsPoints: [], boundsPointCount: 0, headPoints: [], headPointCount: 0,
      palette: { skin, skinShadow, skinBase, shadowBase, gold, goldShade, goldLightMat, purple, lilac, iris, shell, red, redLight }, formIndex: -1, phase: rng() * TAU };
    applyForm(model, 0);
    pose(model, { action: 'idle', actionTime: 0, combo: 0, vx: 0, y: 0 }, 0, 1, true, false);
    root.updateMatrixWorld(true);
    if (!modelInfo[id]) {
      let meshes = 0, triangles = 0;
      root.traverse((o) => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
      const bounds = new THREE.Box3().setFromObject(root);
      modelInfo[id] = { meshes, triangles, height: Number((bounds.max.y - bounds.min.y).toFixed(2)), joints: 15 + Number(!!tail), color: rosterColors[id] || AURA[id] };
    }
    return model;
    } catch (error) { releaseResources(resources); throw error; }
    finally { resourceOwner = previousOwner; }
  }

  function applyForm(m, index) {
    const form = formAt(m.id, index), formIndex = FORMS[m.id].indexOf(form);
    if (m.formIndex === formIndex) return;
    const previousOwner = resourceOwner; resourceOwner = m.resources;
    try {
    m.form = form; m.formIndex = formIndex;
    const p = m.palette, id = form.id, powered = /^(ss[12]|blue|blue-evolved|rage|full-power)$/.test(id);
    m.hairStyle = form.hair ? id === 'ss3' ? 'long' : id === 'beast' ? 'beast' : powered ? 'power' : 'base' : null;
    for (const hair of m.hairGroups.values()) hair.visible = false;
    if (m.hairStyle) {
      const hair = m.hairGroups.get(m.hairStyle) || m.makeHair(m.hairStyle); hair.visible = true;
      p.gold.color.set(form.hair); p.goldShade.color.copy(p.gold.color).multiplyScalar(.57);
      const darkHair = p.gold.color.r + p.gold.color.g + p.gold.color.b < .08;
      p.goldLightMat.color.copy(p.gold.color).lerp(whiteColor, darkHair ? .018 : .12);
      for (const mat of [p.gold, p.goldShade, p.goldLightMat]) { mat.metalness = formIndex ? .22 : .06; mat.roughness = formIndex ? .38 : .53; }
    }
    m.brows.visible = id !== 'ss3';
    p.skin.color.set(p.skinBase); p.skinShadow.color.set(p.shadowBase);
    if (m.id === 'frieza') {
      const golden = id === 'golden';
      p.skin.color.set(golden ? '#e8b43c' : p.skinBase); p.skin.metalness = golden ? .56 : .07;
      p.skinShadow.color.set(golden ? '#ab632f' : p.shadowBase);
      p.lilac.color.set(golden ? '#c07b28' : '#c7b0df'); p.purple.color.set(golden ? '#74249b' : '#7042a0');
    }
    if (m.id === 'piccolo') {
      p.skin.color.set(id === 'orange' ? '#e3a047' : id === 'unleashed' ? '#a7bc68' : p.skinBase);
      p.skinShadow.color.set(id === 'orange' ? '#ad6134' : id === 'unleashed' ? '#6b8146' : p.shadowBase);
    }
    if (m.id === 'buu') p.skin.color.set(id === 'angry' ? '#e778a8' : p.skinBase);
    if (m.id === 'cell') p.shell.color.set(formIndex ? '#9dc05b' : '#81b64e');
    if (m.id === 'jiren') { p.red.color.set(id === 'limit-break' ? '#ae2838' : '#bc1536'); p.redLight.color.set(id === 'limit-break' ? '#e37671' : '#cf2440'); }
    if (m.id === 'gohan') p.iris.color.set(id === 'beast' ? '#c43254' : powered ? '#359e96' : '#203943');
    else if (m.id === 'goku' || m.id === 'vegeta') p.iris.color.set(id === 'god' ? '#b8344d' : id === 'ui' ? '#b8c7d5' : formIndex ? '#359e96' : '#203943');
    else if (m.id === 'broly') p.iris.color.set(id === 'wrathful' ? '#ecce51' : formIndex > 1 ? '#e1eee0' : '#26322a');
    else if (m.id === 'trunks' || m.id === 'android18') p.iris.color.set('#4894a6');
    const scale = form.scale || 1;
    m.root.scale.set(scale * (id === 'orange' ? 1.07 : 1), scale, scale);
    const top = m.id === 'beerus' ? 1.04 : m.id === 'cell' ? .9 : m.id === 'piccolo' ? .57 : m.id === 'buu' ? .74 : m.id === 'hit' ? .49 : m.id === 'jiren' ? .49 : m.id === 'frieza' ? .46 : m.hairStyle === 'beast' ? 1.56 : m.hairStyle === 'long' ? .84 : m.id === 'vegeta' ? 1.02 : m.id === 'android18' || (m.id === 'trunks' && !formIndex) ? .41 : .91;
    m.visualHeight = (m.hipsHeight + m.headY + (m.id === 'krillin' || m.id === 'tien' ? .36 : m.id === 'android17' ? .41 : top) * m.head.scale.y) * scale;
    m.sparks = ['ss2', 'blue-evolved', 'beast', 'rage', 'super-perfect', 'limit-break', 'awakened'].includes(id);
    } finally { resourceOwner = previousOwner; }
  }

  function applyGear(m, value, tint) {
    const previousOwner = resourceOwner; resourceOwner = m.resources;
    try {
    const ids = normalizeLoadout(value);
    m.loadout = ids;
    m.tint = /^#[0-9a-f]{6}$/i.test(tint) ? tint : '#ffc45b';
    if (ids.length && !m.gearPalette) m.gearPalette = {
      cloth: standard(m.tint, .96, { side: THREE.DoubleSide, bumpMap: cloth, bumpScale: .014 }),
      metal: standard(m.tint, .56, { metalness: .25 }),
      light: basic(m.tint, { toneMapped: false }),
      lens: basic(m.tint, { transparent: true, opacity: .72, side: THREE.DoubleSide }),
    };
    if (m.gearPalette) for (const mat of Object.values(m.gearPalette)) mat.color.set(m.tint);
    for (const [id, item] of m.gear) for (const node of item.nodes) node.visible = ids.includes(id);
    for (const id of ids) {
      if (!m.gear.has(id)) {
        const p = m.gearPalette, nodes = [], moving = [];
        const anchor = (parent, x=0, y=0, z=0) => {
          const g = group(parent,x,y,z); g.name = `gear:${id}`; nodes.push(g); return g;
        };
        if (id === 'head-scouter') {
          const g = anchor(m.head);
          mesh(g,cube,p.metal,[-.32,0,0],[.09,.19,.17]);
          mesh(g,cube,p.lens,[-.13,-.008,.3],[.27,.15,.025],false);
          tube(g,[[-.33,.08,.02],[-.29,.09,.25],[-.025,.08,.31]],.02,p.metal,3,5);
        } else if (id === 'head-halo') {
          const g = anchor(m.head); g.userData.halo = true;
          mesh(g,geometry(new THREE.TorusGeometry(.39,.025,6,36)),p.light).rotation.x = PI/2;
        } else if (id === 'shoulder-cape') {
          const g = anchor(m.torso,0,m.shoulderY+.12,-m.chestDepth-.06);
          const vertices=[],indices=[];
          for(let row=0;row<=6;row++)for(let col=0;col<=8;col++){
            const v=row/6,u=col/8;
            vertices.push((u-.5)*m.shoulder*(2.2+v*.6),-v*1.48+Math.sin(u*PI)*v*.08,-v*.4+Math.cos(u*TAU*3)*(.025+v*.07));
            if(row&&col){const b=row*9+col;indices.push(b,b-1,b-10,b,b-10,b-9);}
          }
          const cape=geometry(new THREE.BufferGeometry());cape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cape.setIndex(indices);cape.computeVertexNormals();mesh(g,cape,p.cloth);
          for (const s of [-1,1]) ellipsoid(g,p.metal,[s*m.shoulder*.75,-.015,.17],[.09,.055,.07],false);
          moving.push(g);
        } else if (id === 'shoulder-weights') {
          for (const s of [-1,1]) {
            const g=anchor(m.torso,s*m.shoulder,m.shoulderY+.06,0);
            mesh(g,cube,p.metal,[0,0,0],[.32,.18,.46]);
            for (const z of [-.15,.15]) mesh(g,cube,p.cloth,[0,.025,z],[.35,.2,.045]);
          }
        } else if (id === 'arm-wraps' || id === 'arm-bracers') {
          for (const arm of m.arms) {
            const g=anchor(arm.lower);
            if (id === 'arm-wraps') for (let j=0;j<5;j++) mesh(g,cylinder,p.cloth,[0,-.23-j*.052,0],[.145-j*.006,.039,.15-j*.006]);
            else {
              mesh(g,cylinder,p.metal,[0,-.3,0],[.15,.33,.158]);
              mesh(g,cube,p.light,[0,-.29,.159],[.047,.23,.012],false);
            }
          }
        } else if (id === 'waist-sash' || id === 'waist-belt') {
          const g=anchor(m.torso,0,.04,0);
          mesh(g,cylinder,id==='waist-sash'?p.cloth:p.metal,[0,0,0],[m.waist+.065,.16,m.id==='buu'?.45:.255]);
          if (id === 'waist-belt') mesh(g,cube,p.light,[0,0,m.id==='buu'?.46:.27],[.16,.12,.035],false);
          else {
            const tail=group(g,m.waist*.7,0,.27);
            ribbon(tail,[[0,0,0],[.11,-.38,.09],[.21,-.79,.02]],[.14,.14,.08],p.cloth); moving.push(tail);
          }
        } else {
          const g=anchor(m.body,0,.15,0); moving.push(g);
          for (let j=0;j<6;j++) {
            const a=j/6*TAU;
            if (id === 'aura-sparks') tube(g,[[Math.sin(a)*.8,j*.24-.4,Math.cos(a)*.8],[Math.sin(a+.12)*.95,j*.24-.23,Math.cos(a+.12)*.95],[Math.sin(a)*.84,j*.24-.13,Math.cos(a)*.84]],.016,p.light,2,4);
            else ellipsoid(g,p.light,[Math.sin(a)*.83,Math.sin(a*2)*.3,Math.cos(a)*.83],[.055,.08,.055],false);
          }
        }
        for (const node of nodes) { batch(node); node.traverse(o=>{o.castShadow=false;}); }
        m.gear.set(id,{nodes,moving});
      }
      const item=m.gear.get(id);
      for (const node of item.nodes) {
        node.visible=true;
        if (node.userData.halo) node.position.y=(m.visualHeight/m.root.scale.y-m.hipsHeight-m.headY)/m.head.scale.y+.25;
      }
    }
    } finally { resourceOwner = previousOwner; }
  }

  function pose(m, f, t, blend, menu, reduced) {
    // Restore structural transforms on every snapshot, including interruptions,
    // pooled-rig reuse and portrait clones. Never infer limb state from old poses.
    for (let i = 0; i < 2; i++) {
      const arm = m.arms[i], leg = m.legs[i];
      arm.upper.visible = arm.lower.visible = arm.hand.joint.visible = true;
      arm.upper.position.copy(arm.rest); arm.lower.position.set(0, -.51, 0); arm.hand.joint.position.set(0, -.52, 0);
      for (const node of [arm.upper, arm.lower, arm.hand.joint, leg.upper, leg.lower, leg.foot]) node.scale.setScalar(1);
      arm.lower.rotation.y = arm.lower.rotation.z = 0;
      arm.hand.joint.rotation.set(0, 0, 0);
      leg.lower.rotation.y = leg.lower.rotation.z = 0;
    }
    m.armExtension = 1;
    m.regeneration = !menu && m.id === 'cell' && f.missingArm && f.action === 'regenerate' ? clamp(finite(f.regeneration), 0, 1) : 0;
    m.missingArm = !menu && m.id === 'cell' && f.missingArm === true;
    const a = f.alive === false || f.hp === 0 ? 'down' : f.dodgeTime > 0 ? 'dodge' : !menu && m.clash ? 'beam' : f.action || 'idle';
    const locomotion = a === 'run' || a === 'walk';
    const duration = a === 'light' ? (f.combo === 3 ? 0.45 : f.combo === 2 ? 0.32 : 0.3) : a === 'special' ? TECHNIQUE_DURATION[m.id] : ({ heavy: 0.66, blast: 0.29, beam: 0.94, ultimate: 1.5, dash: 0.19, transform: 1, lift: 2, throw: .3 }[a] || 1);
    const progress = clamp(1 - (f.actionTime || 0) / duration, 0, 1);
    const breathing = reduced ? 0 : Math.sin(t * 2.3 + m.phase) * 0.017;
    const shotPitch = -Math.acos(clamp((m.hipsHeight + m.shoulderY - 1.5 / m.root.scale.y) / 1.17, -0.1, 0.94));
    let bodyX = .07, bodyY = -.1, bodyZ = 0, torsoY = .2, bob = -.085, shift = 0;
    let lArm = [-.56, -.12, -.22, -1.48], rArm = [-.78, .1, .22, -1.4];
    let lLeg = [-.2, -.08, -.13, .35], rLeg = [.18, .12, .13, .24];
    let handsOpen = false, pointHand = -1;
    if (menu && a === 'idle') {
      lArm = [-0.33, -0.17, -0.22, -1.17]; rArm = [-0.63, 0.2, 0.28, -1.48];
      torsoY = -0.1;
      if (m.id === 'jiren') { lArm = [-0.58, -0.3, -0.25, -1.8]; rArm = [-0.72, 0.32, 0.25, -1.8]; }
      if (m.id === 'frieza') { lArm = [-0.18, 0, -0.35, -0.43]; rArm = [-0.85, 0.1, 0.44, -1.52]; handsOpen = true; }
      if (m.id === 'beerus') { lArm = [.17, -.2, -.06, -.2]; rArm = [-.7, .2, .31, -1.5]; pointHand = 1; }
      if (m.id === 'piccolo') { lArm = [-.67, -.62, -.11, -1.87]; rArm = [-.62, .64, .13, -1.89]; }
      if (m.id === 'gohan') { lArm = [-.5, -.12, -.25, -1.5]; rArm = [-.7, .21, .33, -1.1]; bodyX = .015; }
      if (m.id === 'trunks') { lArm = [-.28, -.1, -.22, -.8]; rArm = [-.5, .25, .35, -1.5]; }
      if (m.id === 'android18') { lArm = [.04, .1, -.3, -.7]; rArm = [.19, -.25, .48, -1.13]; rLeg = [.14, .06, .13, .14]; torsoY = -.16; }
      if (m.id === 'cell') { lArm = [.02, -.15, -.25, -.65]; rArm = [-.22, .1, .37, -1]; }
      if (m.id === 'buu') { lArm = [.12, -.18, -.55, -.58]; rArm = [-.1, .1, .55, -.78]; bodyX = -.045; }
      if (m.id === 'hit') { lArm = [.1, .25, -.09, -.48]; rArm = [.12, -.25, .09, -.48]; }
      if (m.id === 'broly') { lArm = [.08, -.17, -.42, -.5]; rArm = [-.1, .14, .4, -.54]; lLeg[2] = -.15; rLeg[2] = .15; }
    } else if (menu && (a === 'wave' || a === 'power-pose')) {
      // Preview time is elapsed seconds for these two authored, non-engine gestures.
      const elapsed = Math.max(0, finite(f.actionTime)), enter = clamp(elapsed / .3, 0, 1);
      if (a === 'wave') {
        rArm = [-.65 - enter * 1.55, .1, .4 + enter * .25, -1.15];
        lArm = [.08, -.1, -.23, -.65]; handsOpen = true;
        bodyZ = -.045 * enter; torsoY = -.12; bob = -.07;
        m.head.rotation.z = reduced ? -.04 : -.04 * enter;
        rArm[2] += reduced ? 0 : Math.sin(Math.max(0, elapsed - .3) * 9) * .16 * enter;
      } else {
        lArm = [-.3 - enter * .3, -.15, -.52 - enter * .42, -1.65];
        rArm = [-.3 - enter * .3, .15, .52 + enter * .42, -1.65];
        bodyX = -.055 * enter; torsoY = -.1; bob = -.1;
      }
    } else if (locomotion) {
      const { forward, side, drive, run, steps } = m.gait;
      const counter = (steps[0].travel - steps[1].travel) * .5;
      bodyX = mix(.07,.19,run)*forward*drive; bodyZ=-.12*side*drive;
      bob = -.12 - .08*run + Math.abs(counter)*mix(.008,.02,run)*drive;
      bodyY=counter*.075*forward*drive; torsoY=-counter*.17*forward*drive;
      const swing = mix(.25,.72,run)*drive, elbow = mix(.45,1.18,run);
      lArm = [steps[0].travel*swing*forward, -.05, -.2+steps[0].travel*.2*side*drive, -elbow-.12*steps[0].lift];
      rArm = [steps[1].travel*swing*forward, .05, .2+steps[1].travel*.2*side*drive, -elbow-.12*steps[1].lift];
    } else if (a === 'lift' || a === 'throw') {
      const release = a === 'throw' ? Math.exp(-progress * 4) : 0;
      const lift = a === 'lift' ? clamp(progress * 8, 0, 1) : 1;
      bodyX = -.1 * lift + release * .32; bodyY = -.18 + release * .4;
      torsoY = -.22 + release * .65; bob = -.15 + lift * .06;
      shift = release * .16;
      lArm = [-.8 - lift * .45, -.2, -.42, -1.2];
      rArm = [-1.05 - lift * 1.2 + release * .65, .15, .5 * (1 - release), -.65 * (1 - release)];
      handsOpen = true;
    } else if (a === 'guard') {
      bodyX = 0.1; bob = -0.085;
      lArm = [-0.87, -0.2, 0.1, -1.86]; rArm = [-0.89, 0.2, -0.1, -1.86];
      lLeg = [-0.18, 0, -0.13, 0.36]; rLeg = [0.2, 0, 0.13, 0.28];
    } else if (a === 'jump') {
      bodyX = -0.08;
      lArm = [-0.25, 0, -0.6, -1.3]; rArm = [-0.9, 0, 0.55, -1.1];
      lLeg = [-0.9, 0, -0.15, 1.3]; rLeg = [0.24, 0, 0.2, 0.9];
    } else if (a === 'light') {
      const windup = f.combo === 3 ? 0.17 / 0.45 : f.combo === 2 ? 0.12 / 0.32 : 0.1 / 0.3;
      const coil = progress < windup ? Math.sin(progress/windup*PI) : 0;
      const strike = progress < windup ? clamp((progress/windup-.55)/.45,0,1)**2 : 1-clamp((progress-windup-.10)/(1-windup-.10),0,1);
      if (f.combo === 3) {
        bodyX = -0.17 * strike; torsoY = 0.28 * strike;
        rLeg = [-1.57 * strike, 0.12, 0.12, 0.12 + 0.85 * (1 - strike)];
        lArm = [-0.4, 0, -0.45, -1.3]; rArm = [0.3, 0, 0.5, -0.85];
      } else {
        const sign=f.combo===2?-1:1;
        bodyY=sign*(-.25*coil+.36*strike); torsoY=sign*(-.4*coil+.55*strike);
        const punch = [-.48 + coil*.42 - strike*1.2, sign*.16*coil, sign*.12*(1-strike), -1.55*(1-strike)];
        if (f.combo === 2) rArm = punch; else lArm = punch;
        bodyX = .03 + .2*strike; bob=-.09-.055*coil;
        shift=.18*strike-.07*coil;
      }
    } else if (a === 'heavy') {
      const windup = (f.combo===3?.20:.27) / 0.66;
      const hit = progress < windup ? clamp((progress / windup - 0.6) / 0.4, 0, 1) ** 2 : Math.exp(-(progress - windup) * 5);
      const coil = progress < windup ? Math.sin(progress / windup * PI / 2) * (1 - hit) : 0;
      bodyY=-.35*coil+.48*hit; torsoY = -.62 * coil + hit * .75;
      bodyX = -0.09 * coil + hit * 0.22;
      rArm = [0.52 * coil - 1.64 * hit, -0.15, 0.35 * coil, -1.35 * coil - 0.12];
      if(f.combo===3){rArm=[.7*coil-2.45*hit,-.2,.3*coil,-.2-.9*coil];bob=-.21*coil+.04*hit;bodyX=.15*coil-.1*hit;}
      shift=.23*hit-.08*coil;
      lArm = [-0.7, 0, -0.3, -1.2];
    } else if (a === 'blast') {
      lArm = [shotPitch, 0.1, 0.05, -0.08]; rArm = [-0.35, 0, 0.2, -1.35]; handsOpen = true;
      torsoY = 0.15;
    } else if (a === 'beam') {
      const launch = !!m.clash || progress >= 0.48 / 0.94;
      if (launch) { lArm = [shotPitch, -0.16, 0.12, -0.05]; rArm = [shotPitch, 0.16, -0.12, -0.05]; bodyX = 0.04; }
      else { lArm = [-0.78, -0.8, -0.25, -0.9]; rArm = [-0.4, -0.1, 0.65, -1.4]; torsoY = -0.3; bodyX = -0.07; }
      handsOpen = true; bob = -0.06;
      lLeg = [-0.24, 0, -0.1, 0.28]; rLeg = [0.28, 0, 0.11, 0.25];
      if (m.id === 'vegeta' && !launch) { lArm = [-.75, -.4, -1.05, -.1]; rArm = [-.75, .4, 1.05, -.1]; }
      if (m.id === 'frieza' || m.id === 'piccolo' || m.id === 'hit') {
        lArm = launch ? [shotPitch, .02, .02, -.03] : [-1.05, -.18, -.15, -1.85];
        rArm = [.14, .05, .32, -.58]; pointHand = m.id === 'hit' ? -1 : 0; handsOpen = m.id !== 'hit';
      }
      if (m.id === 'beerus' || m.id === 'android18') { lArm = launch ? [shotPitch, .04, -.1, -.04] : [-2.5, -.14, -.24, -.3]; rArm = [.12, .12, .2, -.64]; }
      if (m.id === 'broly' || m.id === 'buu') { lArm = [.17, -.1, -.6, -.45]; rArm = [.17, .1, .6, -.45]; bodyX = launch ? .24 : -.18; }
      if (m.id === 'jiren') { lArm = [shotPitch, -.12, -.07, launch ? -.04 : -1.7]; rArm = [-.32, .15, .4, -1]; handsOpen = false; }
    } else if (a === 'ultimate') {
      const launch = progress >= 0.6;
      lArm = launch ? [shotPitch, -0.13, 0.13, -0.08] : [-2.85, 0, -0.4, -0.14];
      rArm = launch ? [shotPitch, 0.13, -0.13, -0.08] : [-2.85, 0, 0.4, -0.14];
      handsOpen = true; bodyX = launch ? 0.04 : -0.08;
      bob = launch ? -0.08 : 0.07;
      if (m.id === 'vegeta' || m.id === 'buu' || m.id === 'jiren') { lArm = [-.26, -.2, -1.25, -.2]; rArm = [-.26, .2, 1.25, -.2]; bob = -.07; }
      if (m.id === 'frieza' || m.id === 'beerus') { lArm = launch ? [shotPitch, 0, 0, -.04] : [-2.98, 0, -.17, -.03]; rArm = [.13, 0, .24, -.5]; pointHand = m.id === 'frieza' ? 0 : -1; }
      if (m.id === 'gohan') { lArm = launch ? [shotPitch, 0, 0, -.04] : [-1.02, -.2, -.12, -1.87]; rArm = [-.24, .1, .27, -1.2]; pointHand = 0; }
      if (m.id === 'piccolo' || m.id === 'cell') { lArm = launch ? [shotPitch, -.16, .12, -.02] : [-.92, -.6, -.21, -1.45]; rArm = launch ? [shotPitch, .16, -.12, -.02] : [-.92, .6, .21, -1.45]; }
      if (m.id === 'hit') { lArm = [-.84, -.2, -.15, -1.48]; rArm = [launch ? shotPitch : -.3, 0, .12, launch ? -.05 : -1.5]; handsOpen = false; }
      if (m.id === 'trunks') { rArm = [-2.85, .06, .18, -.2]; lArm = [-1.1, -.1, -.4, -1.1]; handsOpen = false; }
    } else if (a === 'transform') {
      const release = clamp((progress - .65) / .35, 0, 1);
      lArm = [.15 - release * .35, -.12, -.32 - release * .3, -1.05 + release * .65];
      rArm = [.15 - release * .35, .12, .32 + release * .3, -1.05 + release * .65];
      lLeg = [-.19, 0, -.15, .28]; rLeg = [-.14, 0, .15, .25];
      bob = -.105 + release * .075; bodyX = .16 - release * .29;
      if (!reduced) bodyZ = Math.sin(t * 44) * .008 * progress;
    } else if (a === 'special') {
      const impact = TECHNIQUE_WINDUP[m.id] / duration;
      const strike = progress < impact ? (progress / impact) ** 2 : Math.exp(-(progress - impact) * 4.5), coil = 1 - strike;
      bob = -.06; bodyX = .12; lLeg = [-.2, 0, -.12, .3]; rLeg = [.24, 0, .16, .22];
      if (m.id === 'goku') { lArm = [-.5 - strike * 1.12, -.05, -.14, -coil * 1.4]; rArm = [.5, .1, .4, -1.25]; torsoY = strike * .45; bodyX = .24 * strike; }
      else if (m.id === 'gohan') { rArm = [-.4 - strike * 2.2, .04, .2, -.15 - coil * 1.3]; lArm = [-.62, -.1, -.3, -1.4]; torsoY = -.38 * strike; }
      else if (m.id === 'trunks') { rArm = [-2.7 + strike * 2.4, -.2, .35 - strike * .9, -.17]; lArm = [-1.15, -.1, -.32, -1.17]; torsoY = -.7 + strike * 1.3; }
      else if (m.id === 'android18') { rLeg = [-1.56 * strike, -.5 * strike, .22, .12]; lArm = [-.5, -.2, -.6, -.7]; rArm = [.35, .2, .5, -.83]; bodyX = -.22 * strike; torsoY = -.6 * strike; }
      else if (m.id === 'vegeta') { const volley = Math.sin(progress * PI * 6); lArm = [shotPitch, -.2, -.13, -.08 - Math.max(0, volley) * 1.1]; rArm = [shotPitch, .2, .13, -.08 - Math.max(0, -volley) * 1.1]; handsOpen = true; }
      else if (m.id === 'jiren' || m.id === 'cell') { lArm = [-.5, -.5, -.18 - strike * .9, -1.9 * coil - .1]; rArm = [-.5, .5, .18 + strike * .9, -1.9 * coil - .1]; handsOpen = strike > .2; bodyX = -.06; }
      else if (m.id === 'beerus') { lArm = [shotPitch, 0, -.08, -.06 - coil * .5]; rArm = [.1, .12, .14, -.4]; pointHand = 0; bodyX = -.015; }
      else if (m.id === 'frieza') { lArm = [-2.45 + strike * .9, -.1, -.26, -.07]; rArm = [.15, .1, .35, -.6]; handsOpen = true; }
      else if (m.id === 'piccolo') { lArm = [shotPitch, -.15, -.25, -.1]; rArm = [-.6, .3, .4, -1.4]; handsOpen = true; torsoY = -.2; }
      else if (m.id === 'buu') { lArm = [.15, -.1, -.67, -.35]; rArm = [.15, .1, .67, -.35]; bodyX = .22 * strike; handsOpen = true; }
      else if (m.id === 'hit') { rArm = [-.5 - strike * 1.05, 0, .09, -.05 - coil * 1.1]; lArm = [.16, -.12, -.15, -.55]; torsoY = -.28 * strike; bodyX = .05; }
      else if (m.id === 'broly') { lArm = [-2.7 + strike * 3.5, -.1, -.48, -.18]; rArm = [-2.7 + strike * 3.5, .1, .48, -.18]; bodyX = -.17 + strike * .55; bob = -.13 * strike; }
      else if (m.id === 'android17') { lArm=[-1.2,-.4,-.15,-.15];rArm=[-1.2,.4,.15,-.15];handsOpen=true;bodyY=-.2; }
      else if (m.id === 'krillin') { lArm=[-2.3+strike*.75,0,-.3,-.1];rArm=[-.4,.2,.4,-1.3];handsOpen=true; }
      else if (m.id === 'tien') { lArm=[shotPitch,-.45,.18,-.2];rArm=[shotPitch,.45,-.18,-.2];handsOpen=true;bodyX=.2*strike; }
    } else if (a === 'regenerate' && m.id === 'cell') {
      // The intact right hand braces the left shoulder; this is not a transform.
      bodyX = .12; bodyY = .08; torsoY = -.12; bob = -.13;
      lArm = [-.45, -.1, -.38, -.12]; rArm = [-1.05, -.65, -.65, -1.8];
      handsOpen = true; lLeg = [-.2, 0, -.17, .35]; rLeg = [.2, 0, .17, .35];
    } else if (a === 'charge') {
      lArm = [0.12, 0, -0.48, -0.48]; rArm = [0.12, 0, 0.48, -0.48];
      lLeg = [-0.22, 0, -0.19, 0.3]; rLeg = [-0.18, 0, 0.19, 0.3];
      bob = -0.065 + breathing * 0.5; bodyX = -0.045;
    } else if (a === 'dash' || a === 'dodge') {
      const heading=headingOf(f), speed=Math.max(.001,Math.hypot(finite(f.vx),finite(f.vy),finite(f.vz)));
      const dx=finite(f.dodgeX,finite(f.vx)/speed), dz=finite(f.dodgeZ,finite(f.vz)/speed);
      const side=dx*Math.cos(heading)-dz*Math.sin(heading), forward=dx*Math.sin(heading)+dz*Math.cos(heading);
      const upward=finite(f.dodgeY,finite(f.vy)/speed), entry=clamp((.18-finite(f.dodgeTime))/.055,0,1);
      bodyX=forward*.4-upward*.26;bodyZ=-side*.42;bodyY=-side*.2;torsoY=side*.3;
      bob=-.18-.10*Math.sin(entry*PI); shift=-forward*.07*(1-entry);
      lArm=[-.55+forward*.4,-.1,-.42-side*.12,-1.25];rArm=[-.75-forward*.25,.1,.42-side*.12,-1.35];
      lLeg=[-.35*forward,0,-.2-side*.15,.65];rLeg=[.35*forward,0,.2-side*.15,.6];
    } else if (a === 'hurt') {
      const recoil = clamp((f.actionTime || 0) * 3, 0.25, 1);
      bodyX = -0.32 * recoil; torsoY = 0.22 * recoil;
      lArm = [0.3, 0, -0.58, -0.5]; rArm = [0.5, 0, 0.65, -0.7];
      lLeg = [0.15, 0, -0.1, 0.3]; rLeg = [-0.18, 0, 0.1, 0.4];
    } else if (a === 'down') {
      bodyX = -PI / 2 + 0.06; bodyZ = -0.08; bob = -m.hipsHeight + 0.3;
      lArm = [-0.1, 0, -0.5, -0.2]; rArm = [0.1, 0, 0.7, -0.32];
      lLeg = [0.04, 0, -0.15, 0.08]; rLeg = [0.12, 0, 0.15, 0.2];
    }
    const releasing = !menu && !!m.clash || a === 'beam' && progress >= .48/.94 || a === 'ultimate' && progress >= .6;
    m.releaseStyle = releasing ? ['goku','gohan','cell'].includes(m.id) ? 'cupped' : m.id === 'vegeta' ? 'broad' : 'focused' : null;
    if (releasing) {
      handsOpen = true; pointHand = ['frieza','piccolo'].includes(m.id) ? 0 : -1;
      bodyX = .09; bodyY = -.08; torsoY = .08; bob = -.12;
      lArm = [shotPitch, -.1, .1, -.12]; rArm = [shotPitch, .1, -.1, -.12];
      if (m.releaseStyle === 'focused') rArm = [-.4,.1,.32,-1.3];
    }
    m.emotion = !menu && ['pressured','desperate','shocked'].includes(f.emotion) ? f.emotion : 'calm';
    m.adrenaline = !menu && isAlive(f) ? clamp(finite(f.adrenaline),0,6) : 0;
    if (!menu && ['idle','guard','charge'].includes(a)) {
      if (m.emotion === 'shocked') { bodyX=-.16; torsoY=-.12; lArm=[-.9,-.2,-.42,-1.3]; rArm=[-.7,.2,.42,-1.5]; handsOpen=true; }
      else if (m.emotion !== 'calm') { bodyX+=.08; bob-=.04; lArm[0]-=.12; rArm[0]-=.12; }
    }
    const airborne = (finite(f.y)>.08 || f.flight) && a!=='down';
    if (airborne) {
      if(!['dodge','dash'].includes(a)){lLeg=[.2,0,-.17,.6];rLeg=[-.38,0,.19,.85];}
      if (['idle','run','walk','jump','flight'].includes(a)) {
        const heading=headingOf(f), forward=finite(f.vx)*Math.sin(heading)+finite(f.vz)*Math.cos(heading);
        const sideways=finite(f.vx)*Math.cos(heading)-finite(f.vz)*Math.sin(heading);
        bodyX=clamp(forward*.075-finite(f.vy)*.035,-.48,.65);
        bodyZ=clamp(-sideways*.065,-.42,.42);bodyY=0;torsoY=.09;
        lArm=[f.flight?.38:-.7,-.1,-.37,-.65];rArm=[f.flight?.28:-.5,.1,.32,-.9];
      }
      bob=0;
    } else if (f.surgeCharge>0 && ['idle','charge','run','surge'].includes(a)) {
      bob=-.2;bodyX=.17;bodyY=-.25;torsoY=.4;
      lArm=[-.6,-.25,-.28,-1.7];rArm=[.24,.1,.5,-1.4];
    }
    // Fast contact/interruption blends never queue a visual action behind gameplay.
    if (a==='hurt'||a==='dodge'||a==='down') blend=1-Math.pow(1-blend,1.3);
    m.posePhase=m.clash?'clash':releasing?'release':['light','heavy','special'].includes(a)?progress<.3?'anticipation':progress<.55?'contact':'recovery':['dodge','dash'].includes(a)?'dodge':airborne?'flight':a;
    m.body.position.y = mix(m.body.position.y, m.hipsHeight + bob, blend);
    m.body.position.z = mix(m.body.position.z,shift,blend);
    m.body.rotation.x = mix(m.body.rotation.x, bodyX, blend);
    m.body.rotation.y = mix(m.body.rotation.y, bodyY, blend);
    m.body.rotation.z = mix(m.body.rotation.z, bodyZ, blend);
    m.torso.rotation.y = mix(m.torso.rotation.y, torsoY, blend);
    const headPitch = a === 'transform' ? .14 - progress * .36 : a === 'beam' && (m.id === 'broly' || m.id === 'buu') ? -.16 : a === 'charge' ? -.08 : a === 'hurt' ? -.15 : -.025;
    m.head.rotation.x = mix(m.head.rotation.x, headPitch, blend);
    if (!(menu && a === 'wave')) m.head.rotation.z = mix(m.head.rotation.z, 0, blend);
    m.head.rotation.y = mix(m.head.rotation.y, menu ? 0.09 : -torsoY * 0.5, blend);
    m.body.updateMatrix();m.inverseBody.copy(m.body.matrix).invert();
    for (let i = 0; i < 2; i++) {
      const arm = m.arms[i], av = i ? rArm : lArm, leg = m.legs[i], lv = i ? rLeg : lLeg;
      arm.upper.rotation.x = mix(arm.upper.rotation.x, av[0] + breathing, blend);
      const punching=(a==='light'&&f.combo!==3&&i===(f.combo===2?1:0))||(a==='heavy'&&i===1);
      arm.upper.rotation.y = mix(arm.upper.rotation.y, av[1]-(punching?bodyY+torsoY:0), blend);
      arm.upper.rotation.z = mix(arm.upper.rotation.z, av[2], blend);
      arm.lower.rotation.x = mix(arm.lower.rotation.x, av[3], blend);
      arm.hand.joint.rotation.x = handsOpen ? -0.15 : 0.13;
      arm.hand.fist.visible = !handsOpen && pointHand !== i; arm.hand.open.visible = handsOpen && pointHand !== i; arm.hand.point.visible = pointHand === i;
      arm.hand.low.visible=m.detailed===false;
      if(m.detailed===false)arm.hand.fist.visible=arm.hand.open.visible=arm.hand.point.visible=false;
      leg.upper.rotation.x = mix(leg.upper.rotation.x, lv[0], blend);
      leg.upper.rotation.y = mix(leg.upper.rotation.y, lv[1], blend);
      leg.upper.rotation.z = mix(leg.upper.rotation.z, lv[2], blend);
      leg.lower.rotation.x = mix(leg.lower.rotation.x, lv[3], blend);
      leg.foot.rotation.x = mix(leg.foot.rotation.x, -lv[0] * 0.4 - lv[3] * 0.25, blend);
      // Two-link leg IK keeps support soles on the floor while the hips turn and recoil.
      const kick=(a==='light'&&f.combo===3&&i===1)||(a==='special'&&m.id==='android18'&&i===1);
      if (!airborne && a!=='down' && !kick) {
        let stride=0,lift=0,sideStep=0;
        if (locomotion) {
          // Linear support travel cancels root distance; only the returning foot
          // eases forward. Sideways steps have a shorter, non-crossing stride.
          const travel=m.gait.amplitude*m.gait.steps[i].travel;
          stride=travel*m.gait.forward;sideStep=travel*m.gait.side;
          lift=m.gait.steps[i].lift*mix(.065,.16,m.gait.run)*m.gait.drive;
        }
        if(a==='dodge') {
          const heading=headingOf(f), side=finite(f.dodgeX)*Math.cos(heading)-finite(f.dodgeZ)*Math.sin(heading);
          const forward=finite(f.dodgeX)*Math.sin(heading)+finite(f.dodgeZ)*Math.cos(heading);
          const step=Math.sin(clamp((.18-finite(f.dodgeTime))/.18,0,1)*PI);
          sideStep=side*step*.22;stride=forward*step*.25;lift=i===(side<0?0:1)?step*.12:0;
        }
        const spread=a==='dodge'?.46:menu?.32:locomotion?.34:releasing?.46:.39;
        m.footTarget.set(leg.sign*spread+sideStep,.10+lift,locomotion?stride:(leg.sign>0?-.28:.3)+stride).applyMatrix4(m.inverseBody).sub(leg.rest);
        const q=m.footTarget,L=leg.thighLength,S=leg.shinLength-.02;
        const distance=clamp(q.length(),Math.abs(L-S)+.01,L+S-.005);
        const hipAngle=Math.acos(clamp((L*L+distance*distance-S*S)/(2*L*distance),-1,1));
        const knee=PI-Math.acos(clamp((L*L+S*S-distance*distance)/(2*L*S),-1,1));
        // Build the knee plane in 3D. Independent Euler hip/roll solves lifted
        // the support foot during sideways travel and torso counter-rotation.
        armDirection.copy(q).normalize();
        scratch.set(0,0,1).addScaledVector(armDirection,-armDirection.z).normalize();
        legHinge.crossVectors(scratch,armDirection).normalize();
        legUp.copy(armDirection).multiplyScalar(-Math.cos(hipAngle)).addScaledVector(scratch,-Math.sin(hipAngle));
        legForward.crossVectors(legHinge,legUp).normalize();
        legFrame.makeBasis(legHinge,legUp,legForward);
        leg.upper.quaternion.setFromRotationMatrix(legFrame);leg.lower.rotation.x=knee;
        leg.foot.quaternion.copy(m.body.quaternion).multiply(leg.upper.quaternion).multiply(leg.lower.quaternion).invert();
      }
    }
    if (m.tail) { m.tail.rotation.y = reduced ? 0 : Math.sin(t * 1.9 + m.phase) * .18; m.tail.rotation.z = reduced ? 0 : Math.sin(t * 1.5) * .06; }
    if (m.headAppendage) m.headAppendage.rotation.x = a === 'special' ? -.65 * Math.sin(progress * PI) : reduced ? 0 : Math.sin(t * 2) * .045;
    for (const part of m.clothParts) part.node.rotation.x = (reduced ? 0 : Math.sin(t * 2.1 + part.phase) * part.amount) + (airborne ? -.22 : a === 'dash' || a==='dodge' ? -.4 : a === 'transform' ? -.12 : 0);
    for (const [id,item] of m.gear) for (const node of item.moving) {
      if (id.startsWith('aura-')) node.rotation.y=reduced?0:t*(id==='aura-orbit'?.65:.2);
      else node.rotation.x=reduced?0:-.12-Math.min(.4,Math.hypot(finite(f.vx),finite(f.vz))*.045)+Math.sin(t*3+m.phase)*.055;
    }
    const mane = m.hairGroups.get('long'); if (mane) mane.rotation.x = reduced ? 0 : Math.sin(t * 2.2) * .033;
    if (m.sword) { m.sword.visible = a === 'special' || a === 'ultimate'; m.scabbardHilt.visible = !m.sword.visible; }
    if (!menu && m.id === 'buu' && a === 'heavy') {
      const elapsed = .66 - clamp(finite(f.actionTime), 0, .66), contact = f.combo === 3 ? .20 : .27;
      // Public actionTime precedes the engine's same-tick contact integration.
      const out = clamp((elapsed - contact * .45) / (contact * .55 - 1 / 60), 0, 1);
      const back = clamp((elapsed - contact - .05) / (.62 - contact - .05), 0, 1);
      const extension = out * out * (3 - 2 * out) * (1 - back * back * (3 - 2 * back));
      const arm = m.arms[0], heading = headingOf(f);
      m.root.updateMatrixWorld(true);
      armDirection.set(finite(f.x) + Math.sin(heading) * 5, finite(f.y) + 1.5, finite(f.z) + Math.cos(heading) * 5);
      m.torso.worldToLocal(armDirection).sub(arm.rest);
      const length = armDirection.length();
      armRotation.setFromUnitVectors(downAxis, armDirection.normalize());
      arm.upper.quaternion.slerp(armRotation, extension);
      arm.lower.rotation.x *= 1 - extension;
      m.armExtension = mix(1, clamp(length / 1.03, 1, 5.5), extension);
      // Both segments inherit the longitudinal stretch, but the fist stays solid.
      arm.upper.scale.y = m.armExtension;
      arm.hand.joint.scale.y = 1 / m.armExtension;
    }
    if (releasing && !menu) {
      // Aim the articulated arms, not the projectile: authority still owns shots.
      // Cupped hands converge; Vegeta keeps a broad, symmetric palm release.
      m.root.updateMatrixWorld(true);
      const target = m.clash || m.aimTarget;
      for (let i=0;i<(m.releaseStyle==='focused'?1:2);i++) {
        const arm=m.arms[i], sign=i?1:-1;
        arm.upper.getWorldPosition(handPosition);
        armDirection.set(finite(target?.x,finite(f.x)+Math.sin(headingOf(f))*8),finite(target?.y,finite(f.y)+1.5),finite(target?.z,finite(f.z)+Math.cos(headingOf(f))*8)).sub(handPosition).normalize();
        scratch.copy(handPosition).addScaledVector(armDirection,.94*m.root.scale.y);
        const inward=m.releaseStyle==='cupped'?.36:m.releaseStyle==='broad'?.04:0;
        scratch.x-=sign*Math.cos(m.root.rotation.y)*inward*m.root.scale.y;
        scratch.z+=sign*Math.sin(m.root.rotation.y)*inward*m.root.scale.y;
        m.torso.worldToLocal(scratch).sub(arm.rest).normalize();
        armRotation.setFromUnitVectors(downAxis,scratch);
        arm.upper.quaternion.slerp(armRotation,blend);
        arm.lower.rotation.x=mix(arm.lower.rotation.x,-.10,blend);
        arm.hand.joint.rotation.z=sign*(m.releaseStyle==='cupped'?.55:.12);
      }
    }
    if (m.missingArm) {
      m.arms[0].upper.visible = m.regeneration > 0;
      m.arms[0].upper.scale.setScalar(Math.max(.001, m.regeneration));
    }
  }

  // Keep catalog/portrait and mirror caches; occurrences 2..11 belong only to
  // active actor slots, never to a growing character-by-occurrence matrix.
  const models = [new Map(), new Map()];
  const extraModels = new Map();
  function releaseExtra(slot) {
    const m = extraModels.get(slot);
    if (!m) return;
    m.root.removeFromParent(); m.root.clear();
    releaseResources(m.resources);
    for (const fx of stageEffects) if (fx.owner === m) fx.owner = null;
    extraModels.delete(slot);
    renderer.renderLists.dispose();
  }
  function getModel(occurrence, id, slot) {
    if (occurrence < 0 || occurrence >= 12) throw new RangeError('Renderer supports up to twelve occurrences per fighter.');
    if (occurrence >= 2) {
      if (extraModels.get(slot)?.id !== id) releaseExtra(slot);
      if (!extraModels.has(slot)) {
        const m = makeCharacter(id); m.root.visible = false; scene.add(m.root); extraModels.set(slot, m);
      }
      return extraModels.get(slot);
    }
    if (!models[occurrence].has(id)) {
      const m = makeCharacter(id); m.root.visible = false; scene.add(m.root); models[occurrence].set(id, m);
    }
    return models[occurrence].get(id);
  }
  const auraMaterial = (color) => material(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uLevel: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `${noiseGLSL}
      varying vec2 vUv; uniform float uTime,uLevel; uniform vec3 uColor;
      void main(){
        vec2 p=vUv*2.0-1.0;
        float n=fbm(vec2(p.x*5.0,p.y*4.0-uTime*2.6));
        float width=.49*(1.0-pow(max(0.0,p.y),1.5))+.07;
        float edge=abs(p.x)+(n-.5)*.16-width;
        float flame=exp(-abs(edge)*30.0)*(0.3+n);
        float inner=exp(-abs(p.x)*4.5)*.13;
        float alpha=(flame+inner)*smoothstep(-1.0,-.65,p.y)*(1.0-smoothstep(.67,1.0,p.y));
        alpha*=1.0-smoothstep(.8,1.0,abs(p.x));
        gl_FragColor=vec4(uColor,alpha*uLevel);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const warningTexture=canvasTexture(64,(ctx,s)=>{
    ctx.clearRect(0,0,s,s);ctx.fillStyle='#ffb442';ctx.beginPath();ctx.moveTo(32,3);ctx.lineTo(62,57);ctx.lineTo(2,57);ctx.closePath();ctx.fill();
    ctx.fillStyle='#24180e';ctx.fillRect(29,20,6,20);ctx.fillRect(29,45,6,6);
  });
  const telegraphGeometry=geometry(new THREE.RingGeometry(.65,2.05,24,1,-PI*.22,PI*.44));
  const stageEffects = Array.from({length:12},() => {
    const aura = mesh(scene, plane, auraMaterial('#ffd45d'), [0, 2, 0], [3.3, 4.7, 1], false);
    const shadow = mesh(scene, plane, basic('#000000', { map: contactTexture, transparent: true, opacity: 0.7, depthWrite: false }), [0, 0.025, 0], [2.2, 1.45, 1], false);
    shadow.rotation.x = -PI / 2;
    const orbMat = basic('#bdf5ff', { toneMapped: false });
    const orb = mesh(scene, sphere, orbMat, [0, 1.6, 0], [0.12, 0.12, 0.12], false);
    const flare = billboard(material(new THREE.SpriteMaterial({ map: glow, color: '#7ceaff', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false })));
    scene.add(flare);
    const boltPositions = new Float32Array(6 * 8 * 6);
    const boltGeometry = geometry(new THREE.BufferGeometry()); boltGeometry.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const bolts = new THREE.LineSegments(boltGeometry, material(new THREE.LineBasicMaterial({ color: '#c6ebff', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })));
    bolts.frustumCulled = false; bolts.visible = false; scene.add(bolts);
    const field = mesh(scene, sphere, material(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#acd9ff') }, uOpacity: { value: .3 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vNormal,vView;varying vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader: `varying vec3 vNormal,vView;varying vec2 vUv;uniform vec3 uColor;uniform float uTime,uOpacity;
        void main(){float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.4);float bands=pow(.5+.5*sin(vUv.y*65.-uTime*2.),16.);gl_FragColor=vec4(uColor,(edge*.7+bands*.12)*uOpacity);}`,
    })), [0, 1.5, 0], [1.5, 1.75, 1.25], false);
    field.visible = false;
    const slash = mesh(scene, slashGeometry, basic('#b9eaff', { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 0, 0], [1, 1, 1], false);
    slash.visible = false;
    const marker=mesh(scene,ringGeometry,basic('#74ddff',{transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}),[0,.045,0],[.64,.64,1],false);marker.rotation.x=-PI/2;
    const telegraph=mesh(scene,telegraphGeometry,basic('#ff8055',{transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}),[0,.055,0],[1,1,1],false);
    const warning=billboard(material(new THREE.SpriteMaterial({map:warningTexture,transparent:true,depthWrite:false,toneMapped:false})));scene.add(warning);warning.scale.set(.55,.55,1);
    const trailPositions=new Float32Array(24), trailGeometry=geometry(new THREE.BufferGeometry());
    trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3).setUsage(THREE.DynamicDrawUsage));trailGeometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6]);
    const trail=mesh(scene,trailGeometry,basic('#a7efff',{transparent:true,opacity:.33,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),[0,0,0],[1,1,1],false);trail.frustumCulled=false;
    // A small frozen silhouette, not a cloned rig/material tree. Original fighter
    // materials never become transparent, including mirror/portrait/extra slots.
    const ghost=group(scene), ghostMat=basic('#b6edff',{transparent:true,opacity:.2,depthWrite:false});
    ghost.name='vanish-afterimage';
    for(let i=0;i<6;i++)mesh(ghost,smallSphere,ghostMat,[0,0,0],[1,1,1],false);
    const visuals=[aura,shadow,orb,flare,bolts,field,slash,marker,telegraph,warning,trail,ghost];for(const node of visuals)node.visible=false;
    return { aura, shadow, orb, flare, bolts, boltPositions, field, slash, marker,telegraph,warning,trail,trailPositions,trailActive:false,ghost,ghostMat,vanishing:false,vanishTime:0,lastPosition:new THREE.Vector3(),hasPrevious:false,meteorTarget:null,meteorLife:0,visuals,releaseLife: 0, pulse: 0, perfectLife:0, owner:null };
  });

  const boundaryGeometry=geometry(new THREE.RingGeometry(.985,1,96));
  const clashVisuals=Array.from({length:6},()=>{
    const root=group(scene);root.name='clash-center';root.visible=false;
    const center=mesh(root,sphere,basic('#fff1ce',{toneMapped:false}),[0,0,0],[.22,.22,.22],false);
    const ring=mesh(root,ringGeometry,basic('#ffc45b',{transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}),[0,0,0],[.8,.8,.8],false);
    const sides=Array.from({length:2},()=>{
      const shaft=group(scene);shaft.name='hand-to-clash';shaft.visible=false;
      const shell=mesh(shaft,cylinder,basic('#67e8ff',{transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}),[0,0,0],[1,1,1],false);
      const core=mesh(shaft,cylinder,basic('#e8fdff',{toneMapped:false}),[0,0,0],[1,1,1],false);
      return {shaft,shell,core,start:new THREE.Vector3(),end:new THREE.Vector3(),slot:-1};
    });
    return {root,center,ring,sides,id:-1,progress:0,cue:false};
  });
  const meteorWarnings=Array.from({length:12},()=>{
    const ring=mesh(scene,boundaryGeometry,basic('#ffc45b',{transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}),[0,0,0],[1,1,1],false);ring.rotation.x=-PI/2;ring.visible=false;
    const inner=mesh(scene,ringGeometry,basic('#ffc45b',{transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}),[0,0,0],[1,1,1],false);inner.rotation.x=-PI/2;inner.visible=false;
    const warning=billboard(material(new THREE.SpriteMaterial({map:warningTexture,transparent:true,depthWrite:false,toneMapped:false})));scene.add(warning);warning.visible=false;warning.scale.setScalar(.55);
    return {ring,inner,warning,radius:0};
  });
  const splashes=Array.from({length:12},()=>{
    const shell=mesh(scene,sphere,basic('#ffc45b',{transparent:true,opacity:0,depthWrite:false,wireframe:true}),[0,0,0],[1,1,1],false);shell.visible=false;
    return {shell,life:0,radius:0,eventId:0};
  });
  let splashCursor=0;
  const propMaterial=standard('#aaa899',.88,{map:stone,bumpMap:bump,bumpScale:.075});
  const meteorMaterial=standard('#504052',.92,{map:stone,bumpMap:bump,bumpScale:.12,emissive:'#b87831',emissiveIntensity:.24});
  const propVisuals=Array.from({length:8},(_,id)=>{
    const root=group(scene);root.name=`engine-cover-${id}`;root.visible=false;
    const block=id%2===1, geo=block?cube:rockGeometry;
    const body=mesh(root,geo,propMaterial);
    const outline=mesh(root,geo,basic('#81e5ff',{side:THREE.BackSide,transparent:true,opacity:.75,depthWrite:false,toneMapped:false}),[0,0,0],[1.065,1.065,1.065],false);
    const marker=mesh(scene,boundaryGeometry,basic('#d6d0b8',{transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide}),[0,.034,0],[1,1,1],false);
    marker.rotation.x=-PI/2;marker.visible=false;
    return {id,root,body,outline,marker,heldBy:-1,hp:0,radius:0};
  });
  const hazardGeometry=geometry(new THREE.CircleGeometry(1,64));
  const hazardVisuals=Array.from({length:2},()=>{
    const mat=material(new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uFire:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uTime,uFire;
        void main(){vec2 p=vUv*2.-1.;float r=length(p);float edge=1.-smoothstep(.96,1.,r);
          float rip=pow(.5+.5*sin(r*36.-uTime*2.),8.);
          float crack=exp(-abs(p.x+.12*sin(p.y*15.)+.06*sin(p.y*37.))*55.);
          crack+=.6*exp(-abs(p.y-.24*sin(p.x*12.))*70.);
          vec3 water=mix(vec3(.045,.22,.38),vec3(.32,.69,.81),rip*.5);
          vec3 fire=mix(vec3(.12,.045,.025),vec3(1.,.29,.035),min(1.,crack));
          gl_FragColor=vec4(mix(water,fire,uFire),edge*mix(.58,.87,uFire));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    const node=mesh(scene,hazardGeometry,mat,[0,.038,0],[1,1,1],false);node.rotation.x=-PI/2;node.visible=false;
    const boundary=mesh(scene,boundaryGeometry,basic('#8cddff',{transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}),[0,.042,0],[1,1,1],false);boundary.rotation.x=-PI/2;boundary.visible=false;
    const warning=mesh(scene,plane,basic('#ffffff',{map:warningTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide}),[0,.045,0],[.65,.65,1],false);warning.rotation.x=-PI/2;warning.visible=false;
    return {node,boundary,warning,kind:null,radius:0};
  });
  const hazardMotes=new THREE.InstancedMesh(smallSphere,basic('#ffb565',{toneMapped:false}),16);
  hazardMotes.name='bounded-fire-embers';hazardMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);hazardMotes.frustumCulled=false;hazardMotes.visible=false;scene.add(hazardMotes);
  const zoneShell=mesh(scene,geometry(new THREE.CylinderGeometry(1,1,1,96,1,true)),material(new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){float grid=pow(.5+.5*cos(vUv.x*603.1858),36.)*.035;float foot=exp(-vUv.y*12.)*.14;gl_FragColor=vec4(.76,.38,.21,(.025+grid+foot)*(1.-smoothstep(.65,1.,vUv.y)));}',
  })),[0,5,0],[1,10,1],false);
  zoneShell.name='actual-safe-zone';zoneShell.visible=false;
  const zoneBoundary=mesh(scene,boundaryGeometry,basic('#ffac6c',{transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}),[0,.052,0],[1,1,1],false);zoneBoundary.rotation.x=-PI/2;zoneBoundary.visible=false;
  const finale=mesh(scene,plane,material(new THREE.ShaderMaterial({
    uniforms:{uStrength:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uStrength;
      void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>.98)discard;
        float cell=floor(p.y*19.);float jag=mix(sin(cell*7.13),sin((cell+1.)*7.13),fract(p.y*19.));
        float path=p.x-jag*.021;
        float width=mix(.0005,.009,uStrength);float cut=1.-smoothstep(width,width+.002,abs(path));
        float lip=exp(-abs(abs(path)-width-.004)*240.);
        float branch=exp(-abs(p.y+.16-.32*abs(p.x)-.016*sin(p.x*65.))*450.)*smoothstep(.03,.12,abs(p.x))*(1.-smoothstep(.12,.48,abs(p.x)));
        vec3 color=mix(vec3(.018,.013,.024),vec3(.45,.17,.07),lip*.65);
        float alpha=max(cut*.92,max(lip*.55,branch*.65))*uStrength*(1.-smoothstep(.87,.98,r));
        gl_FragColor=vec4(color,alpha);}`,
  })),[0,.049,0],[1,1,1],false);
  finale.name='visual-only-finale-fissure';finale.rotation.x=-PI/2;finale.visible=false;
  let finaleEase=0, zoneRadius=0, zoneProgress=0;

  function updateArenaState(state,menu,reduced,dt) {
    const candidate = menu || state?.fighters?.[localSlot]?.heldProp >= 0 ? null : pickupCandidate(state?.fighters?.[localSlot], state?.props, aimDirection());
    for(let i=0;i<propVisuals.length;i++) {
      const v=propVisuals[i],p=menu?null:state?.props?.[i];
      v.root.visible=!!p&&finite(p.hp)>0&&finite(p.respawn)<=0;
      v.marker.visible=v.root.visible;v.outline.visible=false;v.heldBy=-1;
      if(!v.root.visible)continue;
      v.id=p.id;v.hp=p.hp;v.radius=Math.max(.01,finite(p.radius,.9));v.heldBy=Number.isInteger(p.heldBy)?p.heldBy:-1;
      v.root.position.set(finite(p.x),finite(p.y,.9),finite(p.z));
      // An inscribed block/stone at the exact engine center. Never bob its collision proxy.
      v.root.scale.setScalar(v.radius*(i%2?1.1547:1));v.root.rotation.set(0,i*.71,0);
      const held=v.heldBy>=0,owner=state.fighters?.[v.heldBy];
      v.outline.visible=held || p.id===candidate?.id;v.outline.material.color.set(owner?formAt(IDS.includes(owner.char)?owner.char:'goku',owner.form).aura:'#ffce67');
      v.marker.visible=!held;v.marker.position.set(p.x,.034,p.z);v.marker.scale.setScalar(v.radius*1.15);
      // Eye view omits only the carried object's draw, not its authoritative position.
      if(firstPerson&&v.heldBy===localSlot)v.root.visible=false;
    }
    let embers=false;
    for(let i=0;i<hazardVisuals.length;i++) {
      const v=hazardVisuals[i],h=menu?null:state?.hazards?.[i];
      v.node.visible=v.boundary.visible=!!h&&['water','fire'].includes(h.kind)&&finite(h.radius)>0;
      v.warning.visible=false;v.kind=v.node.visible?h.kind:null;v.radius=v.node.visible?h.radius:0;
      if(v.node.visible) {
        v.node.position.set(finite(h.x),.038,finite(h.z));v.boundary.position.set(finite(h.x),.042,finite(h.z));
        v.node.scale.setScalar(h.radius);v.boundary.scale.setScalar(h.radius);
        v.node.material.uniforms.uFire.value=h.kind==='fire'?1:0;v.node.material.uniforms.uTime.value=reduced?0:time;
        v.boundary.material.color.set(h.kind==='fire'?'#ff944b':'#99e7ef');
        v.warning.visible=h.kind==='fire';v.warning.position.set(h.x,.045,h.z);
      }
      for(let j=0;j<8;j++) {
        const on=v.node.visible&&h.kind==='fire'&&!reduced;
        const a=j*2.39996,phase=(time*.35+j*.127)%1,r=(.15+(j%3)*.23)*(h?.radius||1);
        dummy.position.set(finite(h?.x)+Math.cos(a)*r,.08+phase*.65,finite(h?.z)+Math.sin(a)*r);
        dummy.rotation.set(0,0,0);dummy.scale.setScalar(on?.022*Math.sin(phase*PI):0);dummy.updateMatrix();hazardMotes.setMatrixAt(i*8+j,dummy.matrix);embers ||= on;
      }
    }
    hazardMotes.visible=embers;hazardMotes.instanceMatrix.needsUpdate=true;
    const zone=menu?null:state?.zone;
    zoneRadius=Math.max(0,finite(zone?.radius));zoneProgress=clamp(finite(zone?.progress),0,1);
    zoneShell.visible=zoneBoundary.visible=!!zone?.active&&zoneRadius>0;
    zoneShell.scale.set(zoneRadius,10,zoneRadius);zoneBoundary.scale.setScalar(zoneRadius);
    finaleEase=state?.phase==='matchOver'&&zone?.active?Math.min(1,finaleEase+dt*.45):0;
    const severity=clamp((zoneProgress-.28)/.72,0,1),strength=severity*(.78+.22*finaleEase);
    finale.visible=zoneShell.visible&&strength>0;finale.material.uniforms.uStrength.value=strength;
    finale.scale.setScalar(Math.max(1,finite(state?.arenaRadius,14))*2);
  }

  const MAX_PARTICLES = 480;
  const particlePositions = new Float32Array(MAX_PARTICLES * 3);
  const particleColors = new Float32Array(MAX_PARTICLES * 3);
  const particleSizes = new Float32Array(MAX_PARTICLES);
  const particleLife = new Float32Array(MAX_PARTICLES);
  const particleData = Array.from({ length: MAX_PARTICLES }, () => ({ vx: 0, vy: 0, vz: 0, life: 0, max: 1, gravity: 0 }));
  let particleCursor = 0, ringCursor = 0, flashCursor = 0, debrisCursor = 0;
  const pg = geometry(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('color', new THREE.BufferAttribute(particleColors, 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aLife', new THREE.BufferAttribute(particleLife, 1).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial = material(new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize,aLife; varying vec3 vColor; varying float vLife; uniform float uScale;
      void main(){vColor=color;vLife=aLife;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*uScale/max(1.0,-p.z),1.0,72.0);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 vColor; varying float vLife;
      void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0||vLife<=0.0)discard;
        gl_FragColor=vec4(vColor,(exp(-r*r*5.0)-.0067)*vLife);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`, vertexColors: true,
  }));
  const particles = new THREE.Points(pg, particleMaterial); particles.frustumCulled = false; scene.add(particles);
  const shockwaves = Array.from({ length: 10 }, () => {
    const m = mesh(scene, ringGeometry, basic('#ffe5ad', { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 0, 0], [1, 1, 1], false);
    m.visible = false; return { mesh: m, life: 0, max: 1, size: 1, ground: false };
  });
  const flashes = Array.from({ length: 8 }, () => {
    const s = billboard(material(new THREE.SpriteMaterial({ map: glow, color: '#ffedbd', blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false })));
    scene.add(s); s.visible = false; return { sprite: s, life: 0, size: 1 };
  });
  const debrisMesh = new THREE.InstancedMesh(rockGeometry, stoneMats[1], 36);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debrisMesh.frustumCulled = false; scene.add(debrisMesh);
  const debris = Array.from({ length: 36 }, () => ({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 0, spin: 0 }));
  const effectColor = new THREE.Color();
  const groundColor = () => ({ namek:'#bdce94', glacier:'#cfebf1', volcanic:'#736574', 'time-chamber':'#d4d4c5', 'beerus-world':'#ba9aaa' }[activeStageId] || '#b9ae9d');
  const scarMap = canvasTexture(256, (ctx, size) => {
    const r = randomSource(751), center = size/2;
    const fade = ctx.createRadialGradient(center,center,8,center,center,center);
    fade.addColorStop(0,'rgba(30,24,30,.68)');fade.addColorStop(.48,'rgba(35,28,31,.5)');fade.addColorStop(1,'rgba(35,28,31,0)');
    ctx.fillStyle=fade;ctx.fillRect(0,0,size,size);ctx.strokeStyle='rgba(24,20,25,.72)';
    for(let i=0;i<13;i++){
      let x=center,y=center;const a=i/13*TAU;ctx.beginPath();ctx.moveTo(x,y);ctx.lineWidth=1+r()*2;
      for(let j=0;j<5;j++){x+=Math.cos(a+(r()-.5)*.7)*(9+r()*12);y+=Math.sin(a+(r()-.5)*.7)*(9+r()*12);ctx.lineTo(x,y);}ctx.stroke();
    }
  });
  const groundMarks = Array.from({length:18},()=>{
    const node=mesh(scene,plane,basic('#ffffff',{map:scarMap,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),[0,.018,0],[1,1,1],false);
    node.rotation.x=-PI/2;node.visible=false;return {node,life:0};
  });
  let dustCursor=0;
  const dustMap=canvasTexture(64,(ctx,size)=>{
    const fade=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    fade.addColorStop(0,'rgba(255,255,255,.8)');fade.addColorStop(.45,'rgba(255,255,255,.35)');fade.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=fade;ctx.fillRect(0,0,size,size);
  });
  const dustClouds=Array.from({length:16},()=>{
    const node=billboard(material(new THREE.SpriteMaterial({map:dustMap,color:'#c0b49b',transparent:true,opacity:0,depthWrite:false})));
    scene.add(node);node.visible=false;return {node,life:0,vx:0,vz:0,size:1};
  });
  // A fixed pool of loose fragments reacts locally, without altering authoritative
  // collision geometry or growing the scene every time an attack lands.
  const groundFragments=Array.from({length:40},(_,i)=>{
    const a=i*2.39996,r=3+(i%9)*1.18;
    return {homeX:Math.cos(a)*r,homeZ:Math.sin(a)*r,x:Math.cos(a)*r,z:Math.sin(a)*r,y:.09,vx:0,vy:0,vz:0,spin:i*.81,size:.06+(i%5)*.023};
  });
  const fragmentMat=standard('#a5a196',.95);
  const fragments=new THREE.InstancedMesh(rockGeometry,fragmentMat,groundFragments.length);
  fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fragments.frustumCulled=false;scene.add(fragments);

  // Visual surface breakup only. The original floor and y=0 collision stay intact.
  // All geometry, instances and contact shadows are allocated once, never per hit.
  const fracturePalettes = {
    void: ['stone','#858398','#262432'], namek: ['soil','#b0c58b','#3e4937'],
    wasteland: ['soil','#d19974','#573b35'], 'cell-games': ['stone','#c6c7bc','#45463f'],
    glacier: ['ice','#a6dce9','#264956'], 'west-city': ['stone','#71768c','#242532'],
    'beerus-world': ['soil','#a7c2b2','#414550'], lookout: ['stone','#d9d4bd','#54504a'],
    'time-chamber': ['stone','#d0cec2','#55554e'], volcanic: ['stone','#777080','#2c222b'],
  };
  const fractureMat = standard('#ffffff', .92, { map:stone, vertexColors:true });
  const fractureBedMat = standard('#ffffff', 1, { map:dustMap, transparent:true, opacity:.42, depthWrite:false });
  const fractureShadowMat = basic('#ffffff', { map:contactTexture, transparent:true, opacity:.32, depthWrite:false });
  const fractureOutline = [[-.52,-.16],[-.12,-.39],[.43,-.43],[.58,-.12],[.38,.4],[-.2,.31]];
  const slabPositions=[],slabColors=[],slabUVs=[];
  function fractureTriangle(a,b,c,shade) {
    for(const v of [a,b,c]) {slabPositions.push(...v);slabColors.push(shade,shade,shade);slabUVs.push(v[0]*.7+.5,v[2]*.7+.5);}
  }
  for(let i=0;i<fractureOutline.length;i++) {
    const a=fractureOutline[i],b=fractureOutline[(i+1)%fractureOutline.length];
    fractureTriangle([0,.5,0],[b[0],.5,b[1]],[a[0],.5,a[1]],1);
    fractureTriangle([0,-.5,0],[a[0],-.5,a[1]],[b[0],-.5,b[1]],.45);
    fractureTriangle([a[0],.5,a[1]],[b[0],.5,b[1]],[a[0],-.5,a[1]],.52+i*.035);
    fractureTriangle([b[0],.5,b[1]],[b[0],-.5,b[1]],[a[0],-.5,a[1]],.52+i*.035);
  }
  const fractureGeometry = geometry(new THREE.BufferGeometry());
  fractureGeometry.setAttribute('position',new THREE.Float32BufferAttribute(slabPositions,3));
  fractureGeometry.setAttribute('color',new THREE.Float32BufferAttribute(slabColors,3));
  fractureGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(slabUVs,2));
  fractureGeometry.computeVertexNormals();
  const fractureSlabs = new THREE.InstancedMesh(fractureGeometry,fractureMat,64);
  const fractureChunks = new THREE.InstancedMesh(rockGeometry,fractureMat,32);
  // rockGeometry has no vertex colors: use its own shared material, not a new one per patch.
  const fractureChunkMat = standard('#ffffff',.94,{map:stone});
  fractureChunks.material=fractureChunkMat;
  const fractureBeds = new THREE.InstancedMesh(geometry(new THREE.CircleGeometry(1,13).rotateX(-PI/2)),fractureBedMat,8);
  const fractureShadows = new THREE.InstancedMesh(plane,fractureShadowMat,8);
  const fractureMeshes=[fractureSlabs,fractureChunks,fractureBeds,fractureShadows];
  fractureMeshes.forEach((node,i)=>{
    node.name=`surface-breakup-${['slabs','chunks','beds','shadows'][i]}`;
    node.instanceMatrix.setUsage(THREE.DynamicDrawUsage);node.frustumCulled=false;node.visible=false;
    node.castShadow=i<2;node.receiveShadow=i<3;scene.add(node);
    for(let j=0;j<node.count;j++)node.setColorAt(j,whiteColor);
  });
  const fracturePatches=Array.from({length:8},()=>({
    active:false,eventId:0,x:0,z:0,radius:0,age:0,angle:0,lift:0,kind:'',static:false,
    slabs:Array.from({length:8},()=>({x:0,z:0,y:0,yaw:0,tilt:0,roll:0,sx:0,sy:0,sz:0,span:0})),
    chunks:Array.from({length:4},()=>({x:0,z:0,y:0,spin:0,size:0,height:0,duration:1})),
  }));
  let fractureCursor=0;
  function fractureGround(e,x,z,strength,height,reduced) {
    if(![x,z,strength,height].every(Number.isFinite)||height>1.25||height<0)return;
    strength=clamp(strength*Math.exp(-height*.8),0,3);
    if(strength<.65)return;
    const radius=Math.min(.8+strength*.7,((pitFloor?FLOOR_RADIUS:15.4)-Math.hypot(x,z)-.12)/1.25);
    if(radius<.45)return;
    const index=fractureCursor++%fracturePatches.length,p=fracturePatches[index];
    // A separate event/position seed makes settled geometry independent of render FPS,
    // peripheral/reduced effects and unrelated particles consumed before the hit.
    const r=randomSource((e.id^Math.imul(Math.round(x*100),73856093)^Math.imul(Math.round(z*100),19349663))>>>0);
    p.active=true;p.eventId=e.id;p.x=x;p.z=z;p.radius=radius;p.age=0;p.angle=r()*TAU;p.kind=e.type==='land'?'land':e.kind;p.static=reduced;
    p.lift=.08+strength*.09;
    const palette=fracturePalettes[activeStageId];
    fractureMat.roughness=fractureChunkMat.roughness=palette[0]==='ice'?.38:.92;
    fractureBedMat.color.set(palette[2]);
    let totalSpan=0,angle=p.angle;
    for(const s of p.slabs){s.span=.4+r()*1.5;totalSpan+=s.span;}
    for(let j=0;j<8;j++) {
      const s=p.slabs[j],span=s.span/totalSpan*TAU,a=angle+span*.5,d=radius*(.38+r()*.34);
      angle+=span;
      s.x=Math.cos(a)*d;s.z=Math.sin(a)*d;s.yaw=-a+(r()-.5)*.75;
      s.sx=radius*(.38+r()*.62);s.sz=radius*span*(.45+r()*.35);s.sy=.045+r()*.055;
      // Thin plates rest just above the intact floor, not on a raised circular plinth.
      s.tilt=(r()-.5)*.09/Math.max(1,radius);s.roll=(r()-.5)*.17/Math.max(1,radius);
      s.y=.012+s.sy*.5+Math.abs(s.roll)*s.sx*.58+Math.abs(s.tilt)*s.sz*.43;
      effectColor.set(palette[1]).multiplyScalar(.8+r()*.3);fractureSlabs.setColorAt(index*8+j,effectColor);
    }
    for(let j=0;j<4;j++) {
      const c=p.chunks[j],a=p.angle+(j+.15+r()*.7)*TAU/4,d=radius*(.65+r()*.45);
      c.x=Math.cos(a)*d;c.z=Math.sin(a)*d;c.size=Math.min(.22,radius*(.065+r()*.06));c.y=.018+c.size*.5;
      c.spin=r()*TAU;c.height=.35+strength*(.25+r()*.25);c.duration=.38+r()*.22;
      effectColor.set(palette[1]).multiplyScalar(.62+r()*.26);fractureChunks.setColorAt(index*4+j,effectColor);
    }
    fractureSlabs.instanceColor.needsUpdate=fractureChunks.instanceColor.needsUpdate=true;
  }
  function updateFractures(dt,menu,reduced) {
    let active=false;
    for(let i=0;i<fracturePatches.length;i++) {
      const p=fracturePatches[i];active ||= p.active;
      p.age=Math.min(2,p.age+dt);if(reduced)p.static=true;
      dummy.position.set(p.x,.03+i*.0002,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.radius*.82,1,p.radius*.65);
      if(!p.active)dummy.scale.setScalar(0);
      dummy.updateMatrix();fractureBeds.setMatrixAt(i,dummy.matrix);
      dummy.position.y=.023+i*.0002;dummy.rotation.set(-PI/2,0,p.angle);dummy.scale.setScalar(p.active?p.radius*2.1:0);
      dummy.updateMatrix();fractureShadows.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<8;j++) {
        const s=p.slabs[j],kick=p.static?0:Math.max(0,1-p.age/.32)**2;
        dummy.position.set(p.x+s.x,s.y+kick*p.lift,p.z+s.z);dummy.rotation.set(s.tilt,s.yaw,s.roll+kick*.12,'YXZ');
        dummy.scale.set(s.sx,s.sy,s.sz);if(!p.active)dummy.scale.setScalar(0);
        dummy.updateMatrix();fractureSlabs.setMatrixAt(i*8+j,dummy.matrix);
      }
      for(let j=0;j<4;j++) {
        const c=p.chunks[j],t=p.static?1:Math.min(1,p.age/c.duration),spread=.23+.77*t;
        // Finite ballistic arc with an exact terminal pose; no accumulated integration drift.
        dummy.position.set(p.x+c.x*spread,c.y+4*c.height*t*(1-t),p.z+c.z*spread);
        dummy.rotation.set(.1+(1-t)*3,c.spin,.1+(1-t)*2);
        dummy.scale.set(c.size,c.size*.45,c.size*.8);if(!p.active)dummy.scale.setScalar(0);
        dummy.updateMatrix();fractureChunks.setMatrixAt(i*4+j,dummy.matrix);
      }
    }
    for(const node of fractureMeshes){node.visible=active&&!menu;node.instanceMatrix.needsUpdate=true;}
    dummy.rotation.order='XYZ';
  }
  function disturbGround(x,z,strength,reduced=false,height=0,scar=false){
    if(![x,z,strength,height].every(Number.isFinite)||height>3)return;
    strength=clamp(strength*Math.exp(-Math.max(0,height)*.8),0,3);
    if(strength<.06)return;
    if(!reduced&&strength>=1)arenaImpacts[impactCursor++%arenaImpacts.length].set(x,z,time,strength);
    if(!reduced)for(let i=0;i<2;i++){
      const cloud=dustClouds[dustCursor++%dustClouds.length],a=rng()*TAU;
      cloud.life=.8;cloud.size=.5+strength;cloud.vx=Math.cos(a)*(1+strength);cloud.vz=Math.sin(a)*(1+strength);
      cloud.node.position.set(x,.1,z);cloud.node.material.color.set(groundColor());
    }
    for(const p of groundFragments){
      const dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz),force=Math.max(0,1-d/(3+strength*3))*strength;
      if(force<=0||reduced)continue;
      p.vx=clamp(p.vx+dx/(d||1)*force*3,-8,8);p.vz=clamp(p.vz+dz/(d||1)*force*3,-8,8);p.vy=Math.min(5,p.vy+force*2);
    }
    if(scar&&height<2.5){
      const mark=groundMarks[markCursor++%groundMarks.length];mark.life=14;
      mark.node.position.set(x,.018,z);mark.node.rotation.z=rng()*TAU;mark.node.scale.setScalar(.9+strength*1.8);
    }
    if(!reduced)emit(x,.08,z,groundColor(),Math.ceil(strength*6),1.4+strength,3);
  }
  function emit(x, y, z, color, count, speed = 3, gravity = 5) {
    effectColor.set(color);
    count = Math.max(1, Math.round(count * quality.particles));
    for (let j = 0; j < count; j++) {
      const i = particleCursor++ % MAX_PARTICLES, d = particleData[i], k = i * 3;
      const a = rng() * TAU, r = 0.2 + rng();
      particlePositions[k] = x; particlePositions[k + 1] = y; particlePositions[k + 2] = z;
      particleColors[k] = effectColor.r; particleColors[k + 1] = effectColor.g; particleColors[k + 2] = effectColor.b;
      d.vx = Math.cos(a) * speed * r; d.vy = (rng() - 0.2) * speed; d.vz = Math.sin(a) * speed * r * 0.55;
      d.life = d.max = 0.25 + rng() * 0.6; d.gravity = gravity; d.owner = effectOwner;
      particleSizes[i] = 0.05 + rng() * 0.13;
    }
  }
  function shock(x, y, color, size, ground, z = 0) {
    const r = shockwaves[ringCursor++ % shockwaves.length];
    r.life = r.max = ground ? 0.65 : 0.38; r.size = size; r.ground = ground; r.owner = effectOwner;
    r.mesh.position.set(x, ground ? 0.06 : y, z);
    r.mesh.material.color.set(color); r.mesh.visible = true;
    if (ground) r.mesh.rotation.set(-PI / 2, 0, 0); else r.mesh.quaternion.copy(camera.quaternion);
  }
  function flash(x, y, color, size, z = 0) {
    const f = flashes[flashCursor++ % flashes.length];
    f.life = 0.19; f.size = size; f.owner = effectOwner; f.sprite.position.set(x, y, z); f.sprite.material.color.set(color); f.sprite.visible = true;
  }
  function chips(x, count, z = 0, y = .1) {
    for (let i = 0; i < count; i++) {
      const d = debris[debrisCursor++ % debris.length];
      d.x = x; d.y = y; d.z = z + (rng() - 0.5) * 0.5;
      d.vx = (rng() - 0.5) * 5; d.vy = 2 + rng() * 3; d.vz = (rng() - 0.5) * 3;
      d.life = 0.8 + rng() * 0.4; d.size = 0.045 + rng() * 0.1; d.spin = rng() * TAU;
    }
  }
  function clearEffects() {
    finaleEase=0;targetCatchup=0;
    shotHistory.clear(); impactLightLife = 0; chargeLight.intensity = impactLight.intensity = 0;
    for (const p of particleData) p.life = 0;
    for (const r of shockwaves) r.life = 0;
    for (const f of flashes) f.life = 0;
    for (const d of debris) d.life = 0;
    for (const mark of groundMarks) {mark.life=0;mark.node.visible=false;}
    for (const cloud of dustClouds) {cloud.life=0;cloud.node.visible=false;}
    for (const p of groundFragments) Object.assign(p,{x:p.homeX,z:p.homeZ,y:.09,vx:0,vy:0,vz:0});
    fractureCursor=0;
    for(const p of fracturePatches){p.active=false;p.age=0;}
    for(const node of fractureMeshes)node.visible=false;
    for (const impact of arenaImpacts) impact.w=0;
    for (const e of beamEchoes) { e.life = 0; e.root.visible = false; }
    for (const fx of stageEffects) { fx.releaseLife = fx.pulse = fx.perfectLife = 0; fx.trailActive=false;fx.vanishing=false;fx.vanishTime=0;fx.ghost.visible=false;fx.hasPrevious=false;fx.meteorTarget=null;fx.meteorLife=0; }
    for(const fx of clashVisuals){fx.root.visible=false;for(const side of fx.sides)side.shaft.visible=false;}
    for(const fx of meteorWarnings)fx.ring.visible=fx.inner.visible=fx.warning.visible=false;
    for(const fx of splashes){fx.life=0;fx.shell.visible=false;}
    shake = cameraAccent = 0;
  }
  function receiveEvent(e, state, reduced) {
    if (!Number.isFinite(e.id) || e.id <= lastEvent) return;
    lastEvent = e.id;
    const fighter = state.fighters?.[e.owner];
    if(e.type==='attack'&&e.kind==='ultimate'&&!e.meteor&&stageEffects[e.owner]){stageEffects[e.owner].meteorTarget=null;stageEffects[e.owner].meteorLife=0;}
    if(e.type==='prop'||e.prop===true) {
      const p=state.props?.find(p=>p.id===e.propId);
      const x=finite(e.x,finite(p?.x)),y=finite(e.y,finite(p?.y,.9)),z=finite(e.z,finite(p?.z));
      effectOwner=-1;
      if(e.kind==='break'||e.kind==='drop'||e.type==='hit'||e.type==='block') {
        if(!reduced)chips(x,8,z,y);
        if(y<2.8)disturbGround(x,z,.65,reduced,Math.max(0,y-1),true);
      } else if(e.kind==='respawn') {
        // Respawns have no fighter owner. The mesh's visibility comes from props,
        // not this optional event, so old clips/seeks never leave a stone missing.
        if(!reduced)emit(x,.15,z,groundColor(),5,.65,2);
      } else if(e.kind==='lift'&&!reduced)emit(x,y,z,'#bdd9df',5,.5,1);
      return;
    }
    if (!fighter || !IDS.includes(fighter.char)) return;
    const char = fighter.char;
    const color = e.type === 'block' ? '#a7efff' : KI[char] || '#ffe09a';
    const focus=state.fighters[e.target]||fighter;
    const x = finite(e.x,finite(focus.x)), y = finite(e.y,finite(focus.y)+1.5), z=finite(e.z,finite(focus.z));
    const peripheral=state.fighters.length>2 && e.owner!==localSlot && e.target!==localSlot && e.owner!==targetSlot && e.target!==targetSlot;
    reduced = reduced || peripheral;
    effectOwner = ['hit', 'block'].includes(e.type) ? -1 : e.owner;
    if(e.type==='attack'&&e.meteor===true&&['targetX','targetY','targetZ'].every(k=>Number.isFinite(e[k]))) {
      const fx=stageEffects[e.owner];
      fx.meteorTarget={x:e.targetX,y:e.targetY,z:e.targetZ,radius:clamp(finite(e.radius,6),.1,6)};fx.meteorLife=3;
    } else if(e.type==='explosion') {
      effectOwner=-1;
      const radius=clamp(finite(e.radius),0,6),fx=splashes[splashCursor++%splashes.length];
      fx.life=.55;fx.radius=radius;fx.eventId=e.id;fx.shell.position.set(x,y,z);fx.shell.material.color.set(color);
      shock(x,y,color,Math.min(radius,3),false,z);
      if(!reduced){emit(x,y,z,color,24,Math.min(7,radius*2),4);flash(x,y,color,Math.min(3,radius),z);chips(x,8,z,y);}
      if(y<radius){disturbGround(x,z,Math.min(2.8,radius),reduced,Math.max(0,y-1.5),true);}
    } else if(e.type==='clash') {
      const c=state.clashes?.find(c=>c.id===e.clashId),cx=finite(c?.x,x),cy=finite(c?.y,y),cz=finite(c?.z,z);
      effectOwner=-1;shock(cx,cy,'#ffc45b',e.kind==='win'?2:.85,false,cz);
      if(!reduced&&['start','boost','win'].includes(e.kind))emit(cx,cy,cz,color,12,2,0);
    } else if(e.type==='emotion') {
      const m=activeModels[e.owner];
      shock(finite(fighter.x),m.chest.y,'#ffc45b',e.kind==='shocked'?1.4:.85,false,finite(fighter.z));
    } else if(e.type==='ricochet') {
      shock(x,y,'#ffc45b',.55,false,z);if(!reduced)emit(x,y,z,color,6,1.8,1);
    } else if(e.type==='ki'&&e.power>0&&['guard','evade'].includes(e.kind)) {
      const fx=stageEffects[e.owner];if(fx)fx.perfectLife=.4;
      shock(x,y,'#a8e9ee',.65,false,z);
    } else if(e.type==='environment') {
      if(!reduced&&e.owner===localSlot&&e.power>0)emit(x,finite(fighter.y)+.12,z,e.kind==='fire'?'#ffad65':'#ebb78f',3,.4,0);
    } else if (e.type === 'hit' || e.type === 'block') {
      const energyHit=['blast','beam','ultimate'].includes(e.kind);
      emit(x, y, z, color, reduced ? 5 : e.type === 'block' ? 14 : energyHit ? 36 : 26, e.kind === 'ultimate' ? 7 : 4, 4);
      shock(x, y, color, e.type === 'block' ? .85 : e.kind === 'ultimate' ? (reduced?1.6:3.4) : e.kind==='beam'?1.9:e.kind==='blast'?1.5:1.3, false,z);
      if (!reduced) { flash(x, y, color, e.kind === 'ultimate' ? 3 : 1.6,z); shake = Math.max(shake, Math.min(0.12, (e.power || 30) * 0.0004)); }
      if (energyHit && !reduced) {
        impactLightLife=.24;impactLight.position.set(x,y,z);impactLight.color.set(color);
        if(y<3)shock(x,0,color,e.kind==='ultimate'?4.4:e.kind==='beam'?2.6:1.7,true,z);
      }
      if (!reduced && y<3 && (e.kind === 'heavy' || e.kind === 'ultimate' || e.kind==='launcher')) chips(x,7,z);
      if(e.type==='hit'&&['heavy','beam','ultimate'].includes(e.kind)) {
        const strength=e.kind==='ultimate'?2.8:e.kind==='beam'?1.7:1.2,height=Math.max(0,y-1.5);
        disturbGround(x,z,strength,reduced,height,true);
        fractureGround(e,x,z,strength,height,reduced);
      }
      // Meteor hit events intentionally carry only kind:'ultimate'. Retain the
      // bounded attack telegraph evidence so direct/radial hits never draw a
      // fictitious horizontal beam from Beerus to the falling impact.
      if ((e.kind === 'beam' || e.kind === 'ultimate') && !(e.kind==='ultimate'&&stageEffects[e.owner]?.meteorLife>0&&stageEffects[e.owner]?.meteorTarget)) {
        const fx = beamEchoes[echoCursor++ % beamEchoes.length];
        fx.life = fx.max = .32; fx.root.visible = true;
        let shot=null,nearest=Infinity;
        for(const sample of shotHistory.values())if(sample.owner===e.owner&&sample.kind===e.kind){
          const distance=sample.position.distanceToSquared(handPosition.set(x,y,z));
          if(distance<nearest){nearest=distance;shot=sample;}
        }
        handPosition.set(x,y,z);
        if(shot)scratch.copy(shot.direction);
        else scratch.set(x-finite(fighter.x),y-finite(fighter.y)-1.5,z-finite(fighter.z)).normalize();
        if(scratch.lengthSq()<.001)scratch.copy(xAxis);
        const length=clamp(shot?handPosition.distanceTo(shot.origin):Math.hypot(x-finite(fighter.x),y-finite(fighter.y)-1.5,z-finite(fighter.z)),.2,64);
        fx.root.position.copy(handPosition).addScaledVector(scratch,-length*.5);fx.root.quaternion.setFromUnitVectors(xAxis,scratch);
        const radius = e.kind === 'ultimate' ? .52 : char === 'frieza' ? .09 : .25;
        fx.shell.scale.set(radius, length, radius); fx.core.scale.set(radius * .3, length, radius * .3);
        fx.shell.material.color.set(color); fx.core.material.color.set(color).lerp(whiteColor, .8);
      }
    } else if (char === 'cell' && (e.type === 'limb' || e.type === 'regeneration')) {
      const m = activeModels[e.owner];
      m.arms[0].upper.getWorldPosition(handPosition);
      const organic = e.kind === 'interrupted' ? '#d6b55c' : e.kind === 'regrown' ? '#b2ffe0' : '#94ef62';
      emit(handPosition.x, handPosition.y, handPosition.z, organic, reduced ? 3 : e.kind === 'regrown' ? 18 : 10, e.kind === 'lost' ? 1.8 : .8, -1);
      shock(handPosition.x, handPosition.y, organic, e.kind === 'regrown' ? .9 : .55, false, handPosition.z);
    } else if (e.type === 'land' || e.type === 'jump') {
      emit(x, 0.08, z, e.kind === 'polished inlay' ? '#9bcfe1' : '#b8a893', reduced ? 4 : 14, 2, 3);
      shock(x, 0, '#c6bca8', e.type === 'land' ? 1.25 : 0.85, true,z);
      if (!reduced && e.type === 'land' && e.kind === 'rubble') chips(x,5,z);
      disturbGround(x,z,e.type==='land'?clamp(finite(e.power,8)*.09,.25,2):.6,reduced,0,e.type==='land'&&e.power>9);
      if(e.type==='land'&&e.power>9)fractureGround(e,x,z,clamp(finite(e.power)*.09,.9,2.6),Math.max(0,y),reduced);
    } else if (e.type==='boundary') {
      disturbGround(x,z,Math.min(2,e.power*.12),reduced,y,true);
      shock(x,y+.4,groundColor(),1.7,false,z);
    } else if (e.type==='flight' && e.kind==='on') {
      disturbGround(x,z,1.25,reduced,y);shock(x,0,groundColor(),2.3,true,z);
    } else if (e.type === 'attack' && ['dash','dodge'].includes(e.kind)) {
      emit(x, y, z, AURA[char], reduced ? 5 : 22, 2.8, 0);
      disturbGround(x,z,.9,reduced,finite(fighter.y));
    } else if ((e.type==='dodge' && e.kind==='perfect') || e.type==='counter') {
      const fx=stageEffects[e.owner];if(fx)fx.perfectLife=e.type==='counter'?.6:.9;
      shock(x,y,'#affff1',e.type==='counter'?1.8:1.3,false,z);
      if(!reduced)flash(x,y,'#affff1',2,z);
    } else if (e.type === 'transform') {
      const form = FORMS[char].find((f) => f.id === e.kind) || formAt(char, fighter?.form);
      const fx = stageEffects[e.owner];
      if (fx) { fx.releaseLife = 1.05; fx.pulse = reduced ? 0 : .17; }
      shock(x, 0, form.aura, reduced ? 2.5 : 5.3, true,z);
      emit(x, finite(fighter.y)+.25, z, form.aura, reduced ? 7 : 50, reduced ? 1.3 : 5, -1.6);
      if (!reduced) { chips(x, 10,z); shock(x, finite(fighter.y) + 1.6, form.aura, 3.5, false,z); shake = Math.max(shake, .10); }
      disturbGround(x,z,3,reduced,finite(fighter.y));
    } else if (e.type === 'attack' && e.kind === 'special') {
      if (char === 'trunks' || char === 'broly' || char === 'hit') {
        shock(x, y, KI[char], char === 'broly' ? 2.6 : 1.5, char === 'broly',z);
        emit(x, y, z, KI[char], reduced ? 4 : 20, 2.8, char === 'broly' ? -1 : 0);
      }
    } else if (e.type === 'round' || e.type === 'match' || e.type==='elimination') {
      shock(x, 0, AURA[char], 4, true,z);
    }
    effectOwner = -1;
  }

  const projectiles = [];
  function makeProjectile() {
    const root = group(scene);
    const coreMat = basic('#e8fdff', { toneMapped: false });
    const shellMat = basic('#70d9ff', { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = mesh(root, sphere, coreMat, [0, 0, 0], [1, 1, 1], false);
    const shell = mesh(root, sphere, shellMat, [0, 0, 0], [1, 1, 1], false);
    const shaft = mesh(root, cylinder, shellMat, [0, 0, 0], [1, 1, 1], false); shaft.rotation.z = PI / 2;
    const inner = mesh(root, cylinder, coreMat, [0, 0, 0], [1, 1, 1], false); inner.rotation.z = PI / 2;
    const coil = mesh(root, cylinder, material(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffe5a9') } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float uTime;uniform vec3 uColor;void main(){float helix=pow(.5+.5*cos(vUv.x*6.28318-vUv.y*55.-uTime*3.),18.);gl_FragColor=vec4(uColor,helix*.7);}',
    })), [0, 0, 0], [1, 1, 1], false); coil.rotation.z = PI / 2; coil.visible = false;
    const sprite = billboard(material(new THREE.SpriteMaterial({ map: glow, color: '#75d9ff', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.65, depthWrite: false })));
    const rock=mesh(root,rockGeometry,propMaterial,[0,0,0],[1,1,1],true);rock.visible=false;
    root.add(sprite); root.visible = false;
    return { root, core, shell, shaft, inner, coil, sprite, shellMat, rock };
  }
  let echoCursor = 0;
  const beamEchoes = Array.from({ length: 6 }, () => {
    const root = group(scene); root.visible = false;
    const shell = mesh(root, cylinder, basic('#77e5ff', { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), [0, 0, 0], [1, 1, 1], false);
    const core = mesh(root, cylinder, basic('#e4fbff', { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [0, 0, 0], [1, 1, 1], false);
    shell.rotation.z = core.rotation.z = PI / 2;
    return { root, shell, core, life: 0, max: .32 };
  });

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || canvas.clientWidth || window.innerWidth));
    height = Math.max(1, Math.round(rect.height || canvas.clientHeight || window.innerHeight));
    mobile = width < 700;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? quality.mobileDpr : quality.dpr);
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    particleMaterial.uniforms.uScale.value = height * dpr;
    const shadowSize = quality.shadow;
    if (renderer.shadowMap.enabled !== !!shadowSize) {
      renderer.shadowMap.enabled = !!shadowSize;
      for (const mat of materials) mat.needsUpdate = true;
    }
    if (!shadowSize || key.shadow.mapSize.x !== shadowSize) {
      if (shadowSize) key.shadow.mapSize.set(shadowSize, shadowSize);
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    }
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas); window.addEventListener('resize', resize);
  const onLost = (event) => { event.preventDefault(); lost = true; };
  const onRestored = () => { lost = false; resize(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  resize();
  const menuStates = [0, 1].map(() => ({ char: 'goku', form: 0, x: 0, y: 0, vx: 0, vy: 0, face: 1, action: 'idle', actionTime: 0, combo: 0, energy: 60 }));
  const activeModels = [];

  function fitView(slots, look, back, minimum) {
    viewRight.crossVectors(yAxis,back).normalize();viewUp.crossVectors(back,viewRight).normalize();
    const tangent=Math.tan(camera.fov*PI/360);
    let distance=minimum;
    for(const slot of slots) {
      const m=activeModels[slot];
      for(let i=0;i<m.boundsPointCount;i++) {
        scratch.copy(m.boundsPoints[i]).sub(look);
        const depth=scratch.dot(back);
        distance=Math.max(distance,depth+Math.abs(scratch.dot(viewRight))/(tangent*camera.aspect*.86*(previewViewport?.width||1)),depth+Math.abs(scratch.dot(viewUp))/(tangent*.80*(previewViewport?.height||1)));
      }
    }
    return distance;
  }

  function projectedModel(m, view = camera, headOnly = false) {
    const box = m.bounds;
    const points=headOnly?m.headPoints:m.boundsPoints, count=headOnly?m.headPointCount:m.boundsPointCount;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, inFront = true;
    for (let i=0;i<count;i++) {
      projectionPoint.copy(points[i]).project(view);
      const px = (projectionPoint.x + 1) / 2, py = (1 - projectionPoint.y) / 2;
      left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      inFront &&= projectionPoint.z >= -1 && projectionPoint.z <= 1;
    }
    if(headOnly)m.head.getWorldPosition(projectionPoint);else box.getCenter(projectionPoint);
    projectionPoint.project(view);
    return { center: [(projectionPoint.x + 1) / 2, (1 - projectionPoint.y) / 2], bounds: [left, top, right, bottom], inFront,
      inFrame: inFront && left >= .035 && right <= .965 && top >= .035 && bottom <= .965 };
  }

  function pairFraming(view = camera) {
    if (targetSlot < 0) return null;
    const local = projectedModel(activeModels[localSlot], view), target = projectedModel(activeModels[targetSlot], view);
    const [l, t, r, b] = local.bounds, [tl, tt, tr, tb] = target.bounds;
    const overlap = Math.max(0, Math.min(r, tr) - Math.max(l, tl)) * Math.max(0, Math.min(b, tb) - Math.max(t, tt));
    const targetOverlap = overlap / Math.max(.000001, (tr - tl) * (tb - tt));
    const targetHead=projectedModel(activeModels[targetSlot],view,true);
    const [hl,ht,hr,hb]=targetHead.bounds;
    const headOverlap=Math.max(0,Math.min(r,hr)-Math.max(l,hl))*Math.max(0,Math.min(b,hb)-Math.max(t,ht))/Math.max(.000001,(hr-hl)*(hb-ht));
    const centerClear = target.center[0] < l - .012 || target.center[0] > r + .012 || target.center[1] < t - .012 || target.center[1] > b + .012;
    // Contacting fists/capes may overlap; the opponent's head and center may not.
    return { local, target, targetHead, targetOverlap, headOverlap, centerClear, gapPixels: Math.max(tl - r, l - tr) * width,
      readable: local.inFrame && target.inFrame && centerClear && targetOverlap <= .18 && headOverlap <= .02 };
  }

  function update(state, dt = 0, options = {}) {
    if (disposed) return;
    if (lost) throw new Error('The arena lost its WebGL context. Close GPU-heavy tabs or reload to reconnect.');
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const began=performance.now();
    const menu = options.menu !== false;
    const reduced = !!options.reduced;
    const region = options.previewViewport;
    previewViewport = !menu && region && ['left','top','width','height'].every(k=>Number.isFinite(region[k]))
      && region.left>=0 && region.top>=0 && region.width>.1 && region.height>.1
      && region.left+region.width<=1 && region.top+region.height<=1 ? region : null;
    if(previewViewport){
      // Keep a full-bleed environment while fitting demo actors into the UI's open area.
      camera.setViewOffset(width,height,width*(.5-region.left-region.width/2),height*(.5-region.top-region.height/2),width,height);
    } else if(camera.view?.enabled) camera.clearViewOffset();
    if (reduced) {shake = cameraAccent = 0;for(const impact of arenaImpacts)impact.w=0;for(const f of flashes){f.life=0;f.sprite.visible=false;}}
    impactLightLife=Math.max(0,impactLightLife-dt);
    impactLight.intensity=reduced?0:32*(impactLightLife/.24)**2;
    chargeLight.intensity=0;
    const oldStage = activeStageId;
    selectStage(menu ? options.stage : state?.stage ?? options.stage);
    if (!activeStage.expansion) expandStage(activeStage, activeStageId);
    pitFloor = !menu && (state?.kind === 'pit' || finite(state?.arenaRadius) > 16);
    activeStage.expansion.visible = pitFloor;
    if (oldStage !== activeStageId) clearEffects();
    time += dt;
    const damping = 1 - Math.exp(-dt * 6);
    let eventCeiling=0;
    for(const e of state?.events||[])if(Number.isFinite(e.id))eventCeiling=Math.max(eventCeiling,e.id);
    // Replay display IDs can restart even when ticks do not. A paused replay may
    // supply fresh empty snapshots at the same tick; only a new countdown clears those.
    const matchReset = !menu && state && (state.tick < lastTick || (eventCeiling>0&&eventCeiling<lastEvent)
      || (state!==lastPresentationState&&state.phase==='countdown'&&state.tick<=lastTick&&eventCeiling===0&&lastEvent>0));
    if ((menu && !wasMenu) || matchReset) { lastEvent = 0; lastTick = -1; clearEffects(); }
    const menuChanged=wasMenu!==menu;wasMenu = menu;
    if (!menu && state) lastTick = state.tick;
    lastPresentationState=state;
    // Additive V8 contract only. Old clips need no fake commitments or defaults
    // on authority; invalid slots/centers cannot allocate or poison transforms.
    const committed=new Set();
    const liveClashes=(menu||!Array.isArray(state?.clashes)?[]:state.clashes.slice(0,6)).filter(c=>{
      if(!c||!Number.isInteger(c.id)||!Number.isInteger(c.a)||!Number.isInteger(c.b)||c.a===c.b||committed.has(c.a)||committed.has(c.b)
        ||!isAlive(state.fighters?.[c.a])||!isAlive(state.fighters?.[c.b])||!['x','y','z','remaining'].every(k=>Number.isFinite(c[k]))||c.remaining<=0)return false;
      committed.add(c.a);committed.add(c.b);return true;
    });
    const requestedCamera=[1,2,3,4].includes(Number(options.cameraMode))?Number(options.cameraMode):2;
    const cameraCut=firstFrame||requestedCamera!==cameraMode||menuChanged||matchReset;
    cameraMode=requestedCamera;
    lookInput.yaw = finite(options.cameraLook?.yaw);
    lookInput.pitch = clamp(finite(options.cameraLook?.pitch, .2), -.75, .85);
    lookInput.manual = !menu && options.cameraLook?.manual === true;
    firstPerson = !menu && cameraMode === 4;
    let fighterStates;
    if (menu) {
      menuStates[0].char = IDS.includes(options.selected) ? options.selected : 'goku';
      menuStates[1].char = IDS.includes(options.opponent) ? options.opponent : 'jiren';
      menuStates[0].form = options.previewForm ?? 0; menuStates[1].form = options.opponentForm ?? 0;
      menuStates[0].action = options.previewAction || 'idle'; menuStates[0].actionTime = Number.isFinite(options.previewActionTime) ? options.previewActionTime : 0;
      menuStates[0].loadout=options.loadout;menuStates[0].tint=options.tint;
      menuStates[1].loadout=options.opponentLoadout;menuStates[1].tint=options.opponentTint;
      const hero = getModel(0, menuStates[0].char), rival = getModel(menuStates[0].char===menuStates[1].char?1:0, menuStates[1].char);
      applyForm(hero, menuStates[0].form); applyForm(rival, menuStates[1].form);
      const displayHeight = Math.max(3.35, hero.visualHeight, rival.visualHeight);
      const studio = options.studio?.open === true;
      const heroHeight = studio ? height * (mobile ? .37 : .67) : height <= 500 ? clamp(height * .55, 160, 240) : mobile ? clamp(height * 0.32, 205, 270) : clamp(height * 0.48, 300, 510);
      const visibleHeight = displayHeight * height / heroHeight;
      const stageCenter = studio ? height * (mobile ? .39 : .49) : height <= 500 ? height * .5 : mobile ? clamp(height * 0.39, 275, 355) : (height - 190) * 0.5;
      const targetY = displayHeight * .47 - (0.5 - stageCenter / height) * visibleHeight;
      const distance = visibleHeight / (2 * Math.tan(34 * PI / 360));
      desiredLook.set(0, targetY, 0);
      desiredCamera.set(0, targetY + (studio ? .6 : activeStageId === 'void' ? 1.5 : 1.0), distance);
      const visibleWidth = visibleHeight * camera.aspect;
      menuStates[0].x = visibleWidth * (studio ? (mobile ? 0 : -.02) : mobile ? -0.215 : 0.117);
      menuStates[1].x = visibleWidth * (mobile ? 0.215 : 0.315);
      fighterStates = studio ? menuStates.slice(0,1) : menuStates;
      camera.fov = mix(camera.fov, 34, firstFrame ? 1 : damping);
    } else fighterStates = [2,12].includes(state?.fighters?.length) ? state.fighters : menuStates;
    const previousLocal=localSlot,previousTarget=targetSlot;
    localSlot=Number.isInteger(options.localSlot)?clamp(options.localSlot,0,fighterStates.length-1):0;
    const local=fighterStates[localSlot];
    targetSlot=Number.isInteger(local.target)&&local.target!==localSlot&&isAlive(fighterStates[local.target])?local.target:-1;
    if(targetSlot<0) {
      let nearest=Infinity;
      fighterStates.forEach((f,i)=>{const d=Math.hypot(finite(f.x)-finite(local.x),finite(f.z)-finite(local.z));if(i!==localSlot&&isAlive(f)&&d<nearest){nearest=d;targetSlot=i;}});
    }
    targetCatchup=Math.max(0,targetCatchup-dt);
    if(!menu&&!lookInput.manual&&previousTarget!==targetSlot)targetCatchup=.45;
    for (const m of activeModels) if(m)m.root.visible=false;
    activeModels.length=fighterStates.length;
    const occurrences=new Map();
    const usedExtras=new Set();
    for(let slot=0;slot<fighterStates.length;slot++) {
      const f=fighterStates[slot],id=IDS.includes(f.char)?f.char:IDS[0],occurrence=occurrences.get(id)||0;
      occurrences.set(id,occurrence+1);
      if(occurrence>=2)usedExtras.add(slot);
      const m=getModel(occurrence,id,slot);applyForm(m,f.form);applyGear(m,f.loadout,f.tint);
      activeModels[slot]=m;m.root.visible=true;
      const fx=stageEffects[slot];
      if(fx.owner!==m){fx.owner=m;fx.releaseLife=fx.perfectLife=0;fx.trailActive=false;fx.vanishing=false;fx.vanishTime=0;fx.hasPrevious=false;fx.meteorTarget=null;fx.meteorLife=0;}
      const detailed=menu||slot===localSlot||slot===targetSlot||fighterStates.length===2;
      if(m.detailed!==detailed){m.detailed=detailed;m.root.traverse(o=>{if(o.isMesh){o.castShadow=detailed;o.receiveShadow=detailed;}});}
      m.root.position.set(finite(f.x), finite(f.y), menu ? (slot ? -.15 : .6) : finite(f.z));
      const angle=menu?(options.studio?.open ? finite(options.studio.rotation,.4) : slot?-.38:.4):headingOf(f);
      const delta=Math.atan2(Math.sin(angle-m.root.rotation.y),Math.cos(angle-m.root.rotation.y));
      m.root.rotation.y+=delta*(cameraCut||id==='buu'&&f.action==='heavy'?1:1-Math.exp(-dt*18));
      const speed=Math.hypot(finite(f.vx),finite(f.vz));
      const forward=(finite(f.vx)*Math.sin(m.root.rotation.y)+finite(f.vz)*Math.cos(m.root.rotation.y))/Math.max(speed,.001);
      const side=(finite(f.vx)*Math.cos(m.root.rotation.y)-finite(f.vz)*Math.sin(m.root.rotation.y))/Math.max(speed,.001);
      const run=clamp((speed-2)/4,0,1),drive=clamp(speed/.8,0,1);
      const amplitude=mix(.23,.38,run)*mix(1,.58,Math.abs(side));
      m.gait={forward,side,speed,amplitude,run,drive};
      if(['run','walk'].includes(f.action)&&!f.flight&&finite(f.y)<.08)m.stride=(m.stride+speed*dt*TAU/(2*amplitude/.6*m.root.scale.y))%TAU;
      m.gait.steps=[0,1].map(i=>{const phase=((m.stride/TAU+i*.5)%1+1)%1,swing=clamp((phase-.6)/.4,0,1);return {travel:phase<.6?1-2*phase/.6:-Math.cos(swing*PI),lift:Math.sin(swing*PI),support:phase<.6};});
      m.clash = !menu ? liveClashes.find(c=>c.a===slot||c.b===slot) || null : null;
      const aim=fighterStates[f.target];
      m.aimTarget=aim?{x:finite(aim.x),y:finite(aim.y)+1.5,z:finite(aim.z)}:null;
      pose(m,f,time,cameraCut?1:1-Math.exp(-dt*(f.action==='light'?55:32)),menu,reduced);
      if(!menu&&slot===localSlot&&lookInput.manual){
        const headYaw=Math.atan2(Math.sin(chaseHeading+lookInput.yaw-angle),Math.cos(chaseHeading+lookInput.yaw-angle));
        m.head.rotation.y=mix(m.head.rotation.y,clamp(headYaw,-.65,.65),1-Math.exp(-dt*16));
      }
      m.root.updateMatrixWorld(true);
      m.eye.copy(m.eyeLocal).applyMatrix4(m.head.matrixWorld);
      m.chest.set(0,m.shoulderY+.12,0).applyMatrix4(m.torso.matrixWorld);
      m.bounds.makeEmpty();m.boundsPointCount=0;m.headPointCount=0;
      m.root.traverseVisible(node=>{
        if(!node.isMesh)return;
        if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
        meshBounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);m.bounds.union(meshBounds);
        const b=node.geometry.boundingBox;
        let ancestor=node;while(ancestor&&ancestor!==m.head&&ancestor!==m.root)ancestor=ancestor.parent;
        const headMesh=ancestor===m.head;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
          const i=m.boundsPointCount++;
          if(!m.boundsPoints[i])m.boundsPoints[i]=new THREE.Vector3();
          m.boundsPoints[i].set(x,y,z).applyMatrix4(node.matrixWorld);
          if(headMesh)m.headPoints[m.headPointCount++]=m.boundsPoints[i];
        }
      });
    }
    for(const slot of extraModels.keys())if(!usedExtras.has(slot))releaseExtra(slot);
    for(let slot=fighterStates.length;slot<stageEffects.length;slot++)for(const node of stageEffects[slot].visuals)node.visible=false;
    const living=fighterStates.map((f,i)=>isAlive(f)?i:-1).filter(i=>i>=0);
    // A player-follow camera frames the player. Arena and Tactical retain group framing.
    const playerFollow=cameraMode===2;
    const fitSlots=playerFollow||cameraMode===4?[localSlot]:living.length?living:fighterStates.map((f,i)=>i);
    if(!menu) {
      const targetFov=firstPerson?Math.min(95,presentation.fov+14):cameraMode===2?presentation.fov:cameraMode===3?46:38;
      camera.fov=mix(camera.fov,targetFov,cameraCut?1:1-Math.exp(-dt*8));
      frameBounds.makeEmpty();for(const slot of fitSlots)frameBounds.union(activeModels[slot].bounds);
      frameBounds.getCenter(desiredLook);
      if(cameraMode===2||firstPerson){
        const target=targetSlot>=0?fighterStates[targetSlot]:null;
        const dx=(firstPerson&&target?activeModels[targetSlot].chest.x:finite(target?.x))-finite(local.x),dz=(firstPerson&&target?activeModels[targetSlot].chest.z:finite(target?.z))-finite(local.z);
        const heading=target&&Math.hypot(dx,dz)>.05?Math.atan2(dx,dz):headingOf(local);
        const turn=Math.atan2(Math.sin(heading-chaseHeading),Math.cos(heading-chaseHeading));
        if(firstFrame||matchReset||menuChanged||previousLocal!==localSlot)chaseHeading=heading;
        else if(!lookInput.manual)chaseHeading+=clamp(turn*(1-Math.exp(-dt*(targetCatchup>0?9:5))),-dt*2.6,dt*2.6);
        if(cameraCut)shoulderAngle=.12;
        const own=activeModels[localSlot],other=activeModels[targetSlot];
        const origin=firstPerson?own.eye:own.chest;
        const wanted=other?-Math.atan2(other.chest.y-origin.y,Math.max(.05,Math.hypot(other.chest.x-(firstPerson?finite(local.x):origin.x),other.chest.z-(firstPerson?finite(local.z):origin.z)))):0;
        if(!lookInput.manual)chasePitch=cameraCut?clamp(wanted,-1.4,1.4):chasePitch+clamp((clamp(wanted,-1.4,1.4)-chasePitch)*(1-Math.exp(-dt*7)),-dt*2,dt*2);
        const yaw=chaseHeading+lookInput.yaw+(firstPerson?0:shoulderAngle),pitch=firstPerson?(lookInput.manual?clamp(lookInput.pitch-.2,-.75,.65):chasePitch):lookInput.manual?clamp(.1+lookInput.pitch,-.55,.95):clamp(.1+lookInput.pitch+chasePitch,-.9,1.3);
        viewBack.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
        if(playerFollow) {
          desiredLook.set(finite(local.x),finite(local.y)+activeModels[localSlot].visualHeight*.86,finite(local.z));
          // Keep the fighter near horizontal centre, with the reticle above the
          // hairline and a clear sightline into the arena instead of into the back.
          desiredLook.x += Math.sin(yaw)*2.4 + Math.cos(yaw)*.55;
          desiredLook.z += Math.cos(yaw)*2.4 - Math.sin(yaw)*.55;
        }
      }else {
        const pitch=clamp((cameraMode===3?1.13:.26)+lookInput.pitch,.12,1.42);
        viewBack.set(Math.sin(lookInput.yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(lookInput.yaw)*Math.cos(pitch));
      }
      const followDistance=Math.max(presentation.distance,activeModels[localSlot].visualHeight/(Math.tan(camera.fov*PI/360)*Math.min(1,camera.aspect)*.95));
      const distance=fitView(fitSlots,desiredLook,viewBack,playerFollow?followDistance:cameraMode===3?19:10.8);
      desiredCamera.copy(desiredLook).addScaledVector(viewBack,distance);
      if(firstPerson){
        const m=activeModels[localSlot];
        // Actual eye height excludes horns/hair/gear; x/z stay on authority so
        // torso sway cannot steer a held movement gesture or orbit the head.
        desiredCamera.set(finite(local.x),Math.max(.45,m.eye.y),finite(local.z));
        desiredLook.copy(desiredCamera).addScaledVector(viewBack,-8);
      }
      desiredCamera.y=Math.max(1.15,desiredCamera.y);
      if(state?.events)for(const e of state.events)receiveEvent(e,state,reduced);
    }
    const cameraBlend=targetCatchup>0&&!lookInput.manual?1-Math.exp(-dt*9):damping;
    cameraLook.lerp(desiredLook, cameraCut || firstPerson ? 1 : cameraBlend);
    camera.position.lerp(desiredCamera, cameraCut || firstPerson ? 1 : cameraBlend);
    if(!menu&&!playerFollow&&!firstPerson){
      // Solve against the *smoothed* basis as well: aspect changes, flight and target
      // switches may pull back immediately, but never crop while tracking catches up.
      viewBack.copy(camera.position).sub(cameraLook).normalize();
      const safe=fitView(fitSlots,cameraLook,viewBack,0);
      if(camera.position.distanceTo(cameraLook)<safe)camera.position.copy(cameraLook).addScaledVector(viewBack,safe);
    }
    camera.position.y=Math.max(1.15,camera.position.y);
    shake *= Math.exp(-dt * 13);
    scratch.copy(cameraLook);
    if (!reduced && !menu && !firstPerson && !lookInput.manual && shake > 0.001) { scratch.x += Math.sin(time * 91) * shake; scratch.y += Math.cos(time * 117) * shake * 0.6; }
    camera.lookAt(scratch); camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // Overhead decoration must not roof over a high tactical camera. Hide only
    // static scenery; keep fighter shaders, lighting and the floor unchanged.
    for (const vault of activeStage.vaults || []) vault.visible = menu || camera.position.y < 13.35;
    for (const instance of assetInstances) {
      const radial = (camera.position.x * instance.position.x + camera.position.z * instance.position.z) / 52;
      instance.visible = menu || radial < asset.minRadius - 1;
    }
    for (let slot = 0; slot < fighterStates.length; slot++) {
      const f = fighterStates[slot], id = IDS.includes(f.char) ? f.char : 'goku';
      const m = activeModels[slot], fx = stageEffects[slot];
      const focus=menu||slot===localSlot||slot===targetSlot,alive=isAlive(f);
      const detailed=focus||fighterStates.length===2;
      const angle = menu ? (slot ? -0.38 : 0.4) : headingOf(f);
      effectOwner=slot;
      fx.shadow.position.set(f.x, 0.027, m.root.position.z);
      fx.shadow.visible=true;
      fx.shadow.material.opacity = Math.max(0.12, 0.64 - (f.y || 0) * 0.12);
      fx.shadow.scale.set(2 * m.root.scale.x + (f.y || 0) * 0.2, 1.35 * m.root.scale.z + (f.y || 0) * 0.13, 1);
      fx.aura.position.set(f.x, (f.y || 0) + m.visualHeight * .5, m.root.position.z - 0.25);
      fx.aura.scale.set(3.3 * m.root.scale.x, m.visualHeight * 1.44, 1);
      fx.aura.quaternion.copy(camera.quaternion);
      fx.releaseLife = Math.max(0, fx.releaseLife - dt);
      if (fx.pulse > 0) { fx.pulse -= dt; if (fx.pulse <= 0 && !reduced) shock(f.x, 0, m.form.aura, 7, true,finite(f.z)); }
      const windupLevel = f.action === 'transform' ? clamp(1 - (f.actionTime || 0), 0, 1) : 0;
      const level = Math.max(fx.releaseLife, m.adrenaline>0?.35:0, m.clash?.55:0, f.action === 'transform' ? .35 + windupLevel * .7 : f.action === 'ultimate' ? 1 : f.action === 'special' ? .57 : f.action === 'charge' ? .84 : f.action === 'beam' ? .5 : f.action === 'dash' ? .4 : menu ? (m.formIndex ? .23 : .08) : m.formIndex ? .14 : .025);
      fx.aura.visible = alive && (detailed||f.action==='transform'||fx.releaseLife>0);
      fx.aura.material.uniforms.uColor.value.set(m.adrenaline>0?'#ffc45b':m.form.aura);
      if (f.action === 'transform') fx.aura.material.uniforms.uColor.value.lerp(effectColor.set(formAt(id, m.formIndex + 1).aura), windupLevel);
      fx.aura.material.uniforms.uTime.value = reduced ? 1.4 : time;
      fx.aura.material.uniforms.uLevel.value = level * (reduced ? 0.55 : 1);
      fx.bolts.visible = !reduced && detailed && alive && (m.sparks || windupLevel > .45 || fx.releaseLife > .2);
      if (fx.bolts.visible) {
        fx.bolts.position.set(f.x, f.y || 0, m.root.position.z); fx.bolts.scale.copy(m.root.scale);
        fx.bolts.material.color.set(m.form.id === 'ss2' ? '#c8e4ff' : m.form.aura);
        const phase = Math.floor(time * 11) * .71;
        for (let path = 0; path < 6; path++) for (let segment = 0; segment < 8; segment++) for (let endpoint = 0; endpoint < 2; endpoint++) {
          const j = segment + endpoint, a = path / 6 * TAU + phase * .16, k = (path * 16 + segment * 2 + endpoint) * 3;
          const radius = .57 + Math.sin(j * 2.8 + phase + path) * .16;
          fx.boltPositions[k] = Math.sin(a) * radius; fx.boltPositions[k + 1] = .15 + j * .37;
          fx.boltPositions[k + 2] = Math.cos(a) * radius;
        }
        fx.bolts.geometry.attributes.position.needsUpdate = true;
      }
      fx.field.visible = alive && detailed && ((f.action === 'special' && ['cell', 'jiren', 'hit','android17'].includes(id)) || (f.action === 'ultimate' && ['hit', 'beerus', 'buu', 'vegeta'].includes(id)));
      if (fx.field.visible) {
        fx.field.position.set(f.x, (f.y || 0) + m.visualHeight * .43, m.root.position.z);
        fx.field.scale.set(1.42 * m.root.scale.x, m.visualHeight * .59, 1.25);
        fx.field.material.uniforms.uColor.value.set(KI[id]); fx.field.material.uniforms.uTime.value = reduced ? 0 : time;
        fx.field.material.uniforms.uOpacity.value = reduced ? .22 : .55;
      }
      fx.slash.visible = alive && detailed && f.action === 'special' && ['android18', 'gohan'].includes(id);
      if (fx.slash.visible) {
        const progress = clamp(1 - f.actionTime / TECHNIQUE_DURATION[id], 0, 1);
        fx.slash.position.set(f.x + Math.sin(angle) * .6, (f.y || 0) + 1.65, m.root.position.z + Math.cos(angle)*.6);
        fx.slash.quaternion.copy(camera.quaternion); fx.slash.rotateZ((f.face || 1) * (-2.4 + progress * 3.4));
        fx.slash.scale.setScalar(id === 'trunks' ? 1.6 : 1.25);
        fx.slash.material.color.set(KI[id]); fx.slash.material.opacity = Math.sin(progress * PI) * (reduced ? .16 : .45);
      }
      const meteorFlying=!menu&&state?.projectiles?.some(p=>p.owner===slot&&p.meteor===true&&p.life>0);
      const windup = !m.clash && !meteorFlying && ((f.action === 'blast' && f.actionTime > .17) || (f.action === 'beam' && f.actionTime > 0.46) || (f.action === 'ultimate' && f.actionTime > 0.6));
      fx.orb.visible = fx.flare.visible = alive && windup;
      if (windup) {
        m.arms[0].hand.joint.getWorldPosition(handPosition);
        if (f.action!=='blast' && !['frieza', 'piccolo', 'beerus', 'android18', 'hit', 'jiren'].includes(id) && !(id === 'gohan' && f.action === 'ultimate')) {
          m.arms[1].hand.joint.getWorldPosition(scratch); handPosition.add(scratch).multiplyScalar(0.5);
        }
        if ((id === 'broly' || id === 'buu') && f.action === 'beam') { handPosition.set(0, -.14, .37); m.head.localToWorld(handPosition); }
        else if (f.action === 'ultimate' && id === 'trunks') { handPosition.set(0, -1.55, 0); m.sword.localToWorld(handPosition); }
        else if (f.action === 'ultimate' && ['goku', 'frieza', 'beerus'].includes(id)) handPosition.y += .4;
        fx.orb.position.copy(handPosition); fx.flare.position.copy(handPosition);
        const size = f.action === 'ultimate' ? .4 + (1.5 - f.actionTime) * .65 : f.action==='blast'?.13+clamp(.29-f.actionTime,0,.12):.17+(.94-f.actionTime)*.55;
        fx.orb.scale.setScalar(size); fx.flare.scale.setScalar(size * (reduced?3:7));
        fx.flare.material.opacity=reduced?.2:.5;
        fx.flare.material.color.set(KI[id]); fx.orb.material.color.set(KI[id]).lerp(whiteColor, 0.72);
        if(slot===localSlot&&!reduced){chargeLight.position.copy(handPosition);chargeLight.color.set(KI[id]);chargeLight.intensity=size*15;}
      }
      if(alive&&m.regeneration>0){
        m.arms[0].hand.joint.getWorldPosition(handPosition);
        fx.orb.visible=true;fx.flare.visible=!reduced;
        fx.orb.position.copy(handPosition);fx.flare.position.copy(handPosition);
        const pulse=reduced?1:.85+.15*Math.sin(m.regeneration*TAU*5);
        fx.orb.scale.setScalar(.09*pulse);fx.flare.scale.setScalar(.48*pulse);
        fx.orb.material.color.set('#c2ff91');fx.flare.material.color.set('#79edab');fx.flare.material.opacity=.28;
      }
      fx.perfectLife=Math.max(0,fx.perfectLife-dt);
      const counter=alive&&(f.counterWindow>0||fx.perfectLife>0);
      const surge=alive&&f.surgeCharge>0;
      const duration=f.action==='special'?TECHNIQUE_DURATION[id]:({light:f.combo===3?.45:f.combo===2?.32:.3,heavy:.66,blast:.29,beam:.94,ultimate:1.5}[f.action]||0);
      const attackWindup=f.action==='special'?TECHNIQUE_WINDUP[id]:({light:f.combo===3?.17:f.combo===2?.12:.1,heavy:f.combo===3?.20:.27,blast:.12,beam:.48,ultimate:.9}[f.action]||0);
      const anticipating=alive&&duration>0&&f.actionTime>duration-attackWindup;
      const emotional=m.emotion!=='calm'||m.adrenaline>0;
      const cueColor=counter?'#b6fff2':surge||emotional?'#ffc45b':f.action==='transform'?m.form.aura:slot===localSlot?'#76dfff':slot===targetSlot?'#ff956e':'#afb5cb';
      fx.marker.visible=!menu&&alive;
      fx.marker.position.set(f.x,.048,finite(f.z));fx.marker.material.color.set(cueColor);
      fx.marker.material.opacity=focus||counter||surge?.84:.28;
      fx.marker.scale.setScalar(surge?1.1:counter?.95:focus?.76:.46);
      const danger=!menu&&alive&&(state?.zone?.active&&Math.hypot(finite(f.x),finite(f.z))>state.zone.radius
        || finite(f.y)<.8&&state?.hazards?.some(h=>h.kind==='fire'&&Math.hypot(finite(f.x)-h.x,finite(f.z)-h.z)<h.radius));
      fx.warning.visible=!menu&&alive&&(surge||danger&&focus||m.emotion==='shocked');
      fx.warning.position.set(f.x,finite(f.y)+m.visualHeight+.55,finite(f.z));
      fx.telegraph.visible=!menu&&!m.clash&&(anticipating||surge);
      fx.telegraph.position.set(f.x,finite(f.y)+.065,finite(f.z));fx.telegraph.rotation.set(-PI/2,0,angle-PI/2);
      fx.telegraph.material.color.set(surge?'#ffb442':slot===localSlot?'#74dfff':'#ff744f');
      fx.telegraph.material.opacity=reduced?.30:.36+clamp(finite(f.actionTime)/Math.max(duration,.1),0,1)*.2;
      fx.telegraph.scale.setScalar(surge?1.2:f.action==='ultimate'?1.6:1);
      m.palette.skin.emissive.set(m.regeneration>0?'#79edab':counter?'#79ffd9':'#fff1ce');
      m.palette.skin.emissiveIntensity=m.regeneration>0?.12:counter?.17:clamp(finite(f.hitFlash)*2,0,.32);
      m.palette.shell.emissive.set('#94ef62');m.palette.shell.emissiveIntensity=m.regeneration>0?.16:0;
      const weapon=alive&&m.sword?.visible&&f.actionTime<duration-attackWindup&&f.actionTime>.04;
      const dodge=alive&&(f.dodgeTime>0||f.action==='dodge'||f.action==='dash');
      const slipstream=f.flight&&Math.hypot(finite(f.vx),finite(f.vy),finite(f.vz))>3;
      const trailOn=!reduced&&detailed&&(weapon||dodge||slipstream);
      fx.trail.visible=trailOn;
      if(trailOn){
        const pos=fx.trailPositions;
        pos.copyWithin(6,0,18);
        if(weapon){handPosition.set(0,-1.53,0);m.sword.localToWorld(handPosition);scratch.set(0,-.22,0);m.sword.localToWorld(scratch);}
        else {handPosition.set(f.x,finite(f.y)+.35,finite(f.z));scratch.set(f.x,finite(f.y)+2.4,finite(f.z));}
        handPosition.toArray(pos,0);scratch.toArray(pos,3);
        if(!fx.trailActive)for(let j=1;j<4;j++)pos.copyWithin(j*6,0,6);
        fx.trail.geometry.attributes.position.needsUpdate=true;fx.trail.material.color.set(counter?'#b6fff2':KI[id]);
        fx.trail.material.opacity=weapon?.48:dodge?.25:.09;
      }
      fx.trailActive=trailOn;
      const vanish=!menu&&alive&&clamp(finite(f.vanishTime),0,.18)>0;
      if(vanish&&(!fx.vanishing||f.vanishTime>fx.vanishTime+1e-6)) {
        fx.ghost.position.set(0,0,0);
        if(fx.hasPrevious)fx.ghost.position.copy(fx.lastPosition).sub(m.root.position);
        const parts=fx.ghost.children,scale=m.root.scale.y;
        m.head.getWorldPosition(parts[0].position);parts[0].scale.set(.27*scale,.33*scale,.27*scale);
        parts[0].quaternion.copy(m.root.quaternion);
        // Torso and four limbs freeze once at entry, from the actual articulated joints.
        for(let j=1;j<6;j++) {
          const start=j===1?m.body:j<4?m.arms[j-2].upper:m.legs[j-4].upper;
          const end=j===1?m.head:j<4?m.arms[j-2].hand.joint:m.legs[j-4].foot;
          start.getWorldPosition(handPosition);end.getWorldPosition(scratch);
          const length=handPosition.distanceTo(scratch),node=parts[j];
          node.position.copy(handPosition).add(scratch).multiplyScalar(.5);
          scratch.sub(handPosition).normalize();node.quaternion.setFromUnitVectors(yAxis,scratch.lengthSq()>.01?scratch:yAxis);
          node.scale.set((j===1?.33:.13)*scale,length*.52,(j===1?.22:.13)*scale);
        }
        fx.ghostMat.color.set(m.form.aura);
      }
      fx.vanishing=vanish;fx.vanishTime=vanish?f.vanishTime:0;
      fx.ghost.visible=vanish;fx.ghostMat.opacity=reduced?.18:.08+.18*clamp(finite(f.vanishTime)/.18,0,1);
      if(vanish){m.root.visible=false;for(const node of fx.visuals)if(node!==fx.ghost)node.visible=false;}
      if(firstPerson&&slot===localSlot){m.root.visible=false;for(const node of fx.visuals)node.visible=false;chargeLight.intensity=0;}
      fx.lastPosition.copy(m.root.position);fx.hasPrevious=true;
    }
    for(let i=0;i<clashVisuals.length;i++) {
      const fx=clashVisuals[i],c=liveClashes[i];fx.root.visible=!!c;
      for(const side of fx.sides)side.shaft.visible=!!c;
      if(!c)continue;
      fx.id=c.id;fx.progress=clamp(finite(c.progress),-1,1);fx.cue=c.cue===true;
      fx.root.position.set(c.x,c.y,c.z);fx.ring.quaternion.copy(camera.quaternion);
      fx.center.scale.setScalar(.24+(reduced?0:.035*Math.sin(time*13)));
      fx.ring.scale.setScalar(fx.cue?1.1:.7);fx.ring.material.opacity=fx.cue?1:.5;
      for(let j=0;j<2;j++) {
        const side=fx.sides[j],slot=j?c.b:c.a,m=activeModels[slot];side.slot=slot;
        m.arms[0].hand.joint.getWorldPosition(side.start);
        if(m.releaseStyle!=='focused'){m.arms[1].hand.joint.getWorldPosition(scratch);side.start.add(scratch).multiplyScalar(.5);}
        side.end.set(c.x,c.y,c.z);scratch.copy(side.end).sub(side.start);
        const length=scratch.length();side.shaft.position.copy(side.start).add(side.end).multiplyScalar(.5);
        side.shaft.quaternion.setFromUnitVectors(yAxis,length>.001?scratch.normalize():yAxis);
        const pressure=fx.progress*(j?-1:1),radius=.15+(.5+.5*pressure)*.12;
        side.shell.scale.set(radius,length,radius);side.core.scale.set(radius*.32,length,radius*.32);
        side.shell.material.color.set(KI[m.id]);side.core.material.color.set(KI[m.id]).lerp(whiteColor,.8);
        side.shell.material.opacity=reduced?.2:fx.cue?.42:.3;
      }
    }
    for(let slot=0;slot<meteorWarnings.length;slot++) {
      const fx=stageEffects[slot],v=meteorWarnings[slot],f=fighterStates[slot];
      fx.meteorLife=Math.max(0,fx.meteorLife-dt);
      const p=!menu&&(state?.projectiles||[]).slice(0,96).find(p=>p.owner===slot&&p.meteor===true&&p.life>0&&!p.prop);
      if(!p&&(!f||f.action!=='ultimate'||!isAlive(f)||fx.meteorLife<=0))fx.meteorTarget=null;
      const target=p&&['targetX','targetY','targetZ'].every(k=>Number.isFinite(p[k]))?{x:p.targetX,y:p.targetY,z:p.targetZ,radius:clamp(finite(p.splashRadius,6),.1,6)}:!menu&&f?.action==='ultimate'&&f.actionTime>.6&&fx.meteorLife>0?fx.meteorTarget:null;
      v.ring.visible=v.inner.visible=v.warning.visible=!!target;
      if(target){v.radius=target.radius;v.ring.position.set(target.x,Math.max(.07,target.y),target.z);v.ring.scale.setScalar(v.radius);v.inner.position.copy(v.ring.position);v.inner.scale.setScalar(v.radius*(reduced?.65:.55+.12*Math.sin(time*5)));v.warning.position.set(target.x,Math.max(.07,target.y)+.7,target.z);}
    }
    for(const fx of splashes){fx.life=Math.max(0,fx.life-dt);fx.shell.visible=!menu&&fx.life>0;fx.shell.scale.setScalar(fx.radius*(reduced?1:1-fx.life/.55));fx.shell.material.opacity=(fx.life/.55)*(reduced?.14:.24);}
    updateArenaState(state,menu,reduced,dt);
    effectOwner=-1;
    groundClock+=dt;
    if(!menu&&groundClock>.14){
      groundClock=0;
      for(const slot of new Set([localSlot,targetSlot])){
        const f=fighterStates[slot];if(!f||!isAlive(f))continue;
        const speed=Math.hypot(finite(f.vx),finite(f.vz));
        if((speed>3&&f.y<1.8)||(['charge','transform'].includes(f.action)&&f.y<.4))disturbGround(f.x,finite(f.z),.32,reduced,f.y);
      }
      for(const p of (state?.projectiles||[]).filter(p=>['beam','ultimate'].includes(p.kind)&&p.y<2.8).slice(0,3))disturbGround(p.x,finite(p.z),.45,reduced,Math.max(0,p.y-1.5));
    }
    auraClock += dt;
    if (auraClock > (reduced ? 0.2 : 0.065)) {
      auraClock = 0;
      for (let slot = 0; slot < fighterStates.length; slot++) {
        const f = fighterStates[slot];
        if(!isAlive(f)||(!menu&&slot!==localSlot&&slot!==targetSlot))continue;
        effectOwner=slot;
        if(activeModels[slot].regeneration>0&&!reduced){
          activeModels[slot].arms[0].hand.joint.getWorldPosition(handPosition);
          emit(handPosition.x,handPosition.y,handPosition.z,'#94ef62',2,.55,-.8);
        }
        if ((menu && !reduced) || f.action === 'charge' || f.action === 'ultimate' || f.action === 'transform' || stageEffects[slot].releaseLife > .1) {
          emit(f.x + (rng() - 0.5) * 1.3, (f.y || 0) + rng() * 0.35, finite(f.z)+(rng() - 0.5) * 0.5, activeModels[slot].form.aura, reduced ? 1 : f.action === 'transform' ? 6 : 2, 0.65, -2.3);
        }
      }
    }
    effectOwner=-1;
    // A pit may have more than the old duel's 24 shots. Grow only on demand, with
    // a fixed ceiling above normal twelve-fighter firing-rate/lifetime bounds.
    const shotCount=menu?0:Math.min(96,state?.projectiles?.length||0);
    while(projectiles.length<shotCount)projectiles.push(makeProjectile());
    for (let i = 0; i < projectiles.length; i++) {
      const p = menu ? null : state?.projectiles?.[i], fx = projectiles[i];
      fx.root.visible = !!p && p.life > 0;
      if (!fx.root.visible) continue;
      const kind = p.kind, char = fighterStates[p.owner]?.char || 'goku';
      // Every pooled child is reset before choosing a path: rock -> beam -> disc
      // must not keep a shaft, hidden core, glow sprite or Piccolo coil behind.
      fx.meteor=p.meteor===true&&p.prop!==true;
      fx.rock.visible=p.prop===true||fx.meteor;
      fx.rock.material=fx.meteor?meteorMaterial:propMaterial;
      fx.core.visible=fx.shell.visible=fx.sprite.visible=p.prop!==true;
      fx.shaft.visible=fx.inner.visible=fx.coil.visible=false;
      if(fx.meteor) {
        shotHistory.delete(p.id);
        const radius=clamp(finite(p.radius,1.4),.2,3);
        fx.root.position.set(finite(p.x),finite(p.y),finite(p.z));fx.root.quaternion.identity();
        fx.rock.geometry=rockGeometry;fx.rock.scale.setScalar(radius);fx.rock.rotation.set(reduced?0:time*.8,finite(p.id)*.7,reduced?0:time*.4);
        fx.core.visible=false;fx.shell.scale.setScalar(radius*1.08);fx.shell.material.color.set(KI[char]);fx.shell.material.opacity=reduced?.12:.2;
        fx.sprite.material.color.set('#ffc45b');fx.sprite.material.opacity=reduced?.12:.26;fx.sprite.scale.setScalar(radius*3.4);
        continue;
      }
      if(p.prop===true) {
        shotHistory.delete(p.id);
        fx.root.position.set(finite(p.x),finite(p.y),finite(p.z));fx.root.quaternion.identity();
        fx.rock.geometry=Number.isInteger(p.propId)&&p.propId%2===1?cube:rockGeometry;
        fx.rock.scale.setScalar(Math.max(.01,finite(p.radius,.65))*(fx.rock.geometry===cube?1.1547:1));
        const spin=reduced?0:(2-clamp(finite(p.life),0,2))*5;
        fx.rock.rotation.set(spin,finite(p.propId)*.71+spin*.6,spin*.3);
        continue;
      }
      const speed=Math.hypot(finite(p.vx),finite(p.vy),finite(p.vz));
      const discShot = (char === 'frieza' && kind === 'special') || (char === 'android18' && kind === 'beam') || (char==='krillin'&&(kind==='beam'||kind==='special'));
      const radius = kind === 'ultimate' ? .8 : discShot ? .38 : kind === 'beam' ? (char === 'frieza' ? .10 : .32) : kind === 'special' && char === 'buu' ? .35 : .21;
      let sample=shotHistory.get(p.id);
      if(!sample){
        sample={owner:p.owner,kind,origin:new THREE.Vector3(finite(p.x),finite(p.y),finite(p.z)),position:new THREE.Vector3(),direction:new THREE.Vector3(),age:0};
        if(shotHistory.size>=96)shotHistory.delete(shotHistory.keys().next().value);
        shotHistory.set(p.id,sample);
        if(p.owner===localSlot||p.owner===targetSlot){shock(p.x,p.y,KI[char],reduced?.4:kind==='blast'?.7:1.3,false,finite(p.z));if(!reduced)emit(p.x,p.y,finite(p.z),KI[char],kind==='blast'?5:12,1.5,0);}
      }
      sample.age+=dt;sample.position.set(finite(p.x),finite(p.y),finite(p.z));sample.direction.set(finite(p.vx,1),finite(p.vy),finite(p.vz)).normalize();
      const length = kind === 'blast' ? .9 : clamp(sample.age * speed, .4, kind === 'beam' ? 14 : kind === 'special' ? 1.5 : 7);
      fx.root.position.set(finite(p.x), finite(p.y), finite(p.z));
      scratch.set(finite(p.vx,1),finite(p.vy),finite(p.vz));if(scratch.lengthSq()<.001)scratch.copy(xAxis);
      fx.root.quaternion.setFromUnitVectors(xAxis,scratch.normalize());
      fx.core.scale.set(radius * 1.1, radius, radius);
      fx.shell.scale.set(radius * 1.7, radius * 1.6, radius * 1.6);
      if (discShot) { fx.core.scale.set(radius, .035, radius); fx.shell.scale.set(radius * 1.5, .065, radius * 1.5); }
      fx.shellMat.color.set(KI[char]); fx.sprite.material.color.set(KI[char]);
      fx.core.material.color.set(KI[char]).lerp(whiteColor, .78);
      fx.shellMat.opacity = reduced ? 0.2 : 0.3 + Math.sin(time * 31 + i) * 0.035;
      fx.shaft.position.x = fx.inner.position.x = -length * 0.5;
      fx.shaft.visible = fx.inner.visible = !discShot;
      fx.shaft.scale.set(radius * 0.95, length, radius * 0.95);
      fx.inner.scale.set(radius * 0.4, length, radius * 0.4);
      fx.coil.visible = (char === 'piccolo' && kind === 'beam') || (char === 'gohan' && kind === 'ultimate');
      if (fx.coil.visible) {
        fx.coil.position.x = -length * .5; fx.coil.scale.set(radius * 1.65, length, radius * 1.65);
        fx.coil.material.uniforms.uTime.value = reduced ? 0 : time; fx.coil.material.uniforms.uColor.value.set('#ffe19c');
      }
      fx.sprite.scale.set(radius * 9 + length * 0.25, radius * 7, 1);
      fx.sprite.material.opacity=reduced?.24:.55;
    }
    const liveShots=new Set((state?.projectiles||[]).slice(0,96).map(p=>p.id));
    for(const id of shotHistory.keys())if(!liveShots.has(id))shotHistory.delete(id);
    for (const fx of beamEchoes) {
      fx.life = Math.max(0, fx.life - dt); fx.root.visible = fx.life > 0;
      const fade = fx.life / fx.max;
      fx.shell.material.opacity = fade * fade * (reduced ? .18 : .44);
      fx.core.material.opacity = fade * fade * (reduced ? .3 : .8);
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const d = particleData[i]; d.life = Math.max(0, d.life - dt);
      particleLife[i] = firstPerson && d.owner === localSlot ? 0 : d.life / d.max;
      if (!d.life) continue;
      const k = i * 3;
      d.vy -= dt * d.gravity;
      particlePositions[k] += d.vx * dt; particlePositions[k + 1] += d.vy * dt; particlePositions[k + 2] += d.vz * dt;
    }
    for (const attr of Object.values(pg.attributes)) attr.needsUpdate = true;
    for (const r of shockwaves) {
      r.life = Math.max(0, r.life - dt); r.mesh.visible = r.life > 0 && !(firstPerson && r.owner === localSlot);
      if (!r.life) continue;
      const progress = 1 - r.life / r.max;
      r.mesh.scale.setScalar((0.15 + progress * 1.1) * r.size);
      r.mesh.material.opacity = (1 - progress) ** 2 * (reduced ? 0.22 : 0.75);
      if (!r.ground) r.mesh.quaternion.copy(camera.quaternion);
    }
    for (const f of flashes) {
      f.life = Math.max(0, f.life - dt); f.sprite.visible = !reduced && f.life > 0 && !(firstPerson && f.owner === localSlot);
      f.sprite.material.opacity = Math.max(0, f.life / 0.19) * 0.8;
      f.sprite.scale.setScalar(f.size * (1.2 - f.life));
    }
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i]; d.life = Math.max(0, d.life - dt);
      if (d.life > 0) {
        d.vy -= dt * 10; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < 0.04) { d.y = 0.04; d.vy = Math.abs(d.vy) * 0.24; d.vx *= 0.7; }
        dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.spin + time * 4, time * 3, d.spin);
        dummy.scale.setScalar(d.size * Math.min(1, d.life * 4));
      } else { dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); }
      dummy.updateMatrix(); debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    debrisMesh.instanceMatrix.needsUpdate = true;debrisMesh.visible=!menu&&!reduced;
    updateFractures(dt,menu,reduced);
    for(const mark of groundMarks){
      mark.life=Math.max(0,mark.life-dt);mark.node.visible=!menu&&mark.life>0;
      mark.node.material.opacity=Math.min(.68,mark.life*.16);
    }
    for(const cloud of dustClouds){
      cloud.life=Math.max(0,cloud.life-dt);cloud.node.visible=!menu&&!reduced&&cloud.life>0;
      cloud.node.position.x+=cloud.vx*dt;cloud.node.position.z+=cloud.vz*dt;cloud.node.position.y+=dt*.35;
      cloud.node.material.opacity=Math.sin(cloud.life/.8*PI)*.38;
      const size=cloud.size*(1.2-cloud.life);cloud.node.scale.set(size*2,size*.85,1);
    }
    fragments.visible=!menu;fragmentMat.color.set(({namek:'#859478',glacier:'#a0bec9',volcanic:'#47414b','time-chamber':'#aaa9a2'}[activeStageId]||'#666b80'));
    for(let i=0;i<groundFragments.length;i++){
      const p=groundFragments[i];
      if(reduced){p.y=.09;p.vx=p.vy=p.vz=0;}
      if(!menu&&!reduced){
        p.vy-=dt*12;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
        if(p.y<.09){p.y=.09;p.vy=Math.abs(p.vy)>.7?Math.abs(p.vy)*.24:0;}
        const drag=Math.exp(-dt*(p.y<=.09?7:.7));p.vx*=drag;p.vz*=drag;
        const radius=Math.hypot(p.x,p.z);if(radius>13.5){p.x*=13.5/radius;p.z*=13.5/radius;p.vx*=-.2;p.vz*=-.2;}
        p.spin+=Math.hypot(p.vx,p.vz)*dt;
      }
      dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.spin,p.spin*.6,0);dummy.scale.setScalar(p.size);dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);
    }
    fragments.instanceMatrix.needsUpdate=true;
    for (let i = 0; activeStageId === 'void' && i < floatingData.length; i++) {
      const d = floatingData[i], t = reduced ? 0 : time;
      dummy.position.set(d.x, d.y + Math.sin(t * 0.23 + d.phase) * 0.32, d.z);
      dummy.rotation.set(d.phase + t * 0.018, d.phase * 2 + t * 0.03, d.phase);
      dummy.scale.set(d.size, d.size * 0.74, d.size * 0.91); dummy.updateMatrix(); floating.setMatrixAt(i, dummy.matrix);
    }
    if (activeStageId === 'void') floating.instanceMatrix.needsUpdate = true;
    for (const uniform of activeStage.uniforms) uniform.value = reduced ? 0 : time;
    for (const m of activeStage.motion) {
      const t = reduced ? 0 : time;
      if (m.type === 'shuttle') m.node.position.x = Math.sin(t * m.speed) * 32;
      else m.node.position.y = m.base + Math.sin(t * m.speed) * (m.type === 'motes' ? 3 : .28);
    }
    skyMaterial.uniforms.uTime.value = reduced ? 0 : time;
    stars.rotation.z = reduced ? 0 : Math.sin(time * 0.015) * 0.008;
    renderer.render(scene, camera);
    lastCalls = renderer.info.render.calls; lastTriangles = renderer.info.render.triangles;
    frameMs=mix(frameMs,performance.now()-began,.08);
    firstFrame = false;
  }

  let portraitRenderer = null;
  function portrait(char) {
    const id = typeof char === 'string' ? char : char?.id;
    if (!IDS.includes(id)) throw new Error(`Unknown portrait fighter: ${String(id)}`);
    if (disposed) throw new Error('The arena has already been disposed.');
    if (portraitCache.has(id)) return portraitCache.get(id);
    if (!portraitRenderer) {
      try {
        portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        portraitRenderer.setPixelRatio(1); portraitRenderer.setSize(256, 320, false);
        portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
        portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        portraitRenderer.toneMappingExposure = 1.13;
        portraitRenderer.shadowMap.enabled = false;
      } catch (error) { throw new Error(`Could not render fighter portraits: ${error.message}`); }
    }
    const stage = new THREE.Scene(); stage.background = new THREE.Color('#100f1c');
    stage.add(new THREE.HemisphereLight('#d4d4ff', '#292039', 1.7));
    const light = new THREE.DirectionalLight('#fff2da', 3.8); light.position.set(-3, 5, 5); stage.add(light);
    const edge = new THREE.DirectionalLight(KI[id], 3.6); edge.position.set(3, 3, -3); stage.add(edge);
    const original = getModel(0, id), savedForm = original.formIndex;
    // Render a neutral base pose synchronously, restoring shared form materials before returning.
    applyForm(original, 0);
    const portraitModel = original.root.clone(true);
    portraitModel.visible = true; portraitModel.position.set(0, 0, 0); portraitModel.rotation.set(0, -0.22, 0);
    // Clone current meshes, but reset the cloned rig so combat cannot contaminate a cached portrait.
    const nodes = new Map();
    const pair = (a, b) => { nodes.set(a, b); for (let i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]); };
    pair(original.root, portraitModel);
    const copy = { ...original, root: portraitModel, body: nodes.get(original.body), torso: nodes.get(original.torso), head: nodes.get(original.head), tail: nodes.get(original.tail),
      gear:new Map(), inverseBody:new THREE.Matrix4(), footTarget:new THREE.Vector3(),detailed:true,clash:null,
      headAppendage: nodes.get(original.headAppendage), sword: nodes.get(original.sword), scabbardHilt: nodes.get(original.scabbardHilt), brows: nodes.get(original.brows),
      clothParts: original.clothParts.map((p) => ({ ...p, node: nodes.get(p.node) })), hairGroups: new Map([...original.hairGroups].map(([name, node]) => [name, nodes.get(node)])),
      arms: original.arms.map((a) => ({ ...a, upper: nodes.get(a.upper), lower: nodes.get(a.lower), hand: { joint: nodes.get(a.hand.joint), fist: nodes.get(a.hand.fist), open: nodes.get(a.hand.open), point: nodes.get(a.hand.point),low:nodes.get(a.hand.low) } })),
      legs: original.legs.map((l) => ({ ...l, upper: nodes.get(l.upper), lower: nodes.get(l.lower), foot: nodes.get(l.foot) })) };
    for(const item of original.gear.values())for(const node of item.nodes)nodes.get(node).visible=false;
    pose(copy, { action: 'idle', actionTime: 0, combo: 0, y: 0 }, 0, 1, true, true);
    stage.add(portraitModel);
    const bgMaterial = new THREE.SpriteMaterial({ map: glow, color: AURA[id], blending: THREE.AdditiveBlending, transparent: true, opacity: 0.29, depthWrite: false });
    const bg = billboard(bgMaterial); bg.position.set(0, 2.25, -1.1); bg.scale.set(4.6, 4.6, 1); stage.add(bg);
    const cam = new THREE.PerspectiveCamera(32, 256 / 320, 0.1, 25);
    const top = original.visualHeight + .12, bottom = Math.max(.45, original.hipsHeight - .38), center = (top + bottom) / 2;
    cam.position.set(0, center + .12, (top - bottom) / (2 * Math.tan(16 * PI / 180)) * 1.1); cam.lookAt(0, center, 0);
    try {
      portraitRenderer.render(stage, cam);
      const url = portraitRenderer.domElement.toDataURL('image/png');
      portraitCache.set(id, url);
      return url;
    } finally {
      applyForm(original, savedForm);
      bgMaterial.dispose();
      // All cloned model resources remain owned by the main world.
      stage.clear(); portraitRenderer.renderLists.dispose();
    }
  }

  function stats() {
    return { drawCalls: lastCalls, triangles: lastTriangles, models: Object.fromEntries(IDS.map((id) => [id, { ...modelInfo[id], loaded: !disposed && !!modelInfo[id] }])),
      stage: activeStageId, stagesCached: stageCache.size, modelsCached: models[0].size + models[1].size + extraModels.size,
      duplicatePool: { active: extraModels.size, capacity: 10, slots: [...extraModels.keys()] },
      asset: { ...asset, visibleInstances: assetInstances.filter(root => root.visible).length, renderedMeshes: asset.meshes * assetInstances.filter(root => root.visible).length, resources: Object.fromEntries(Object.entries(assetResources).map(([key, set]) => [key, set.size])) },
      activeModels: activeModels.filter((m) => m?.root.visible).length,
      activeFighters: activeModels.length, cameraMode,
      motion:activeModels.map((m,slot)=>({slot,body:m.body.rotation.toArray().slice(0,3),hips:m.body.position.toArray(),arms:m.arms.map(a=>a.upper.rotation.toArray().slice(0,3)),vanishing:stageEffects[slot].vanishing,afterimage:stageEffects[slot].ghost.visible,ghostHead:stageEffects[slot].ghost.children[0].getWorldPosition(new THREE.Vector3()).toArray(),releaseStyle:m.releaseStyle,emotion:m.emotion,adrenaline:m.adrenaline,eye:m.eye.toArray(),chest:m.chest.toArray()})),
      props:{capacity:8,items:propVisuals.filter(v=>v.root.visible).map(v=>({id:v.id,position:v.root.position.toArray(),radius:v.radius,hp:v.hp,heldBy:v.heldBy,outline:v.outline.visible,pbr:v.body.material.isMeshStandardMaterial,geometry:v.body.geometry.type})),eyeHidden:propVisuals.filter(v=>firstPerson&&v.heldBy===localSlot).length},
      hazards:{capacity:2,motes:hazardMotes.visible?16:0,items:hazardVisuals.filter(v=>v.node.visible).map(v=>({kind:v.kind,position:v.node.position.toArray(),radius:v.radius,danger:v.warning.visible,time:v.node.material.uniforms.uTime.value}))},
      zone:{visible:zoneShell.visible,radius:zoneRadius,progress:zoneProgress,boundaryRadius:zoneBoundary.scale.x,finale:finale.visible,strength:finale.material.uniforms.uStrength.value,label:'Visual fissure stamp only; intact ground and collision, no physical halves or holes'},
      activeLoadouts: activeModels.map(m=>m?[...m.loadout]:[]), activeTints:activeModels.map(m=>m?.tint),
      actors:activeModels.map((m,slot)=>({slot,rig:m.root.id,char:m.id,palette:{skin:m.palette.skin.color.getHexString(),hair:m.palette.gold.color.getHexString(),skinMaterial:m.palette.skin.id,hairMaterial:m.palette.gold.id,gearMaterial:m.gearPalette?.cloth.id,gearTint:m.gearPalette?.cloth.color.getHexString()},position:m.root.position.toArray(),heading:m.root.rotation.y,pose:m.posePhase,gait:{...m.gait,phase:m.stride},detailed:m.detailed,visible:m.root.visible,missingArm:m.missingArm,regeneration:m.regeneration,armExtension:m.armExtension,arms:m.arms.map(a=>({visible:a.upper.visible,scale:a.upper.scale.toArray(),lowerScale:a.lower.scale.toArray()})),projected:projectedModel(m),bounds:{min:m.bounds.min.toArray(),max:m.bounds.max.toArray()},gear:[...m.gear].filter(([,item])=>item.nodes.some(n=>n.visible)).map(([id])=>id),hands:m.arms.map(a=>a.hand.joint.getWorldPosition(new THREE.Vector3()).toArray()),feet:m.legs.map(l=>l.foot.getWorldPosition(new THREE.Vector3()).toArray())})),
       camera:{position:camera.position.toArray(),look:cameraLook.toArray(),fov:camera.fov,aspect:camera.aspect,localSlot,targetSlot,chaseHeading,chasePitch,shoulderAngle,firstPerson,previewViewport:previewViewport?{...previewViewport}:null,projectionUnits:'viewport 0..1, origin top-left; union of projected visible-mesh bounding boxes',framing:activeModels.length?pairFraming():null,cameraLook:{...lookInput},...lookInput,movement:movementBasis()},
       arena:{pit:pitFloor,playRadius:pitFloor?PIT_RADIUS:10,floorRadius:pitFloor?FLOOR_RADIUS:15.4,expansionVisible:!!activeStage.expansion?.visible,structureMinRadius:48,vaultMinHeight:13.35,visibleVaults:activeStage.vaults?.filter(v=>v.visible).length||0},
      renderCpuMs:Number(frameMs.toFixed(2)),
      renderedFrames:renderer.info.render.frame,
      presentation:{...presentation,dpr,shadowSize:quality.shadow},
      activeForms: activeModels.map((m) => m ? { char: m.id, index: m.formIndex, id: m.form.id, label: m.form.label, hair: m.form.hair, aura: m.form.aura, scale: m.root.scale.y, hairStyle: m.hairStyle, eyebrows: m.brows.visible, height: Number(m.visualHeight.toFixed(2)) } : null),
      resources: { geometries: geometries.size, materials: materials.size, textures: textures.size, geometryBytes: [...geometries].reduce((sum,g)=>sum+(g.index?.array.byteLength||0)+Object.values(g.attributes).reduce((n,a)=>n+(a.array||a.data.array).byteLength,0),0), gpuGeometries: renderer.info.memory.geometries, gpuTextures: renderer.info.memory.textures, framingPoints: [...models[0].values(),...models[1].values(),...extraModels.values()].reduce((sum,m)=>sum+m.boundsPoints.length,0) },
       effects: { particles: particleData.filter((p) => p.life > 0).length, shockwaves: shockwaves.filter((s) => s.life > 0).length, beamTrails: beamEchoes.filter((e) => e.life > 0).length, transformations: stageEffects.filter((fx) => fx.releaseLife > 0).length, sparks: stageEffects.filter((fx) => fx.bolts.visible).length,
          clashes:{capacity:6,items:clashVisuals.filter(fx=>fx.root.visible).map(fx=>({id:fx.id,center:fx.root.position.toArray(),progress:fx.progress,cue:fx.cue,ring:fx.ring.scale.x,sides:fx.sides.map(s=>({slot:s.slot,start:s.start.toArray(),end:s.end.toArray(),length:s.shell.scale.y,radius:s.shell.scale.x,position:s.shaft.position.toArray(),direction:yAxis.clone().applyQuaternion(s.shaft.quaternion).toArray()}))}))},
          meteors:{capacity:12,items:meteorWarnings.flatMap((fx,slot)=>fx.ring.visible?[{slot,position:fx.ring.position.toArray(),radius:fx.radius,warning:fx.warning.visible}]:[])},
          splashes:{capacity:12,items:splashes.filter(fx=>fx.shell.visible).map(fx=>({eventId:fx.eventId,position:fx.shell.position.toArray(),radius:fx.radius,scale:fx.shell.scale.x}))},
          afterimages:{capacity:12,count:stageEffects.filter(fx=>fx.ghost.visible).length},
          groundMarks:groundMarks.filter(m=>m.node.visible).length,dustClouds:dustClouds.filter(c=>c.node.visible).length,
          groundFragments:groundFragments.length,displacedFragments:groundFragments.filter(p=>Math.hypot(p.x-p.homeX,p.z-p.homeZ)>.1||p.y>.2).length,
          fractures:{label:'Visual surface breakup; ground collision unchanged',count:fracturePatches.filter(p=>p.active).length,
            capacity:{patches:8,slabs:64,chunks:32,beds:8,shadows:8},slabsActive:fracturePatches.filter(p=>p.active).length*8,
            chunksActive:fracturePatches.filter(p=>p.active).length*4,palette:[...fracturePalettes[activeStageId]],
            flyingChunks:fracturePatches.reduce((n,p)=>n+(p.active&&!p.static?p.chunks.filter(c=>p.age<c.duration).length:0),0),
            patches:fracturePatches.flatMap((p,slot)=>p.active?[{slot,eventId:p.eventId,kind:p.kind,position:[p.x,.03,p.z],radius:p.radius,slabsActive:8,chunksActive:4,static:p.static,settled:p.static||p.age>=.6}]:[])},
         waterImpacts:arenaImpacts.filter(p=>p.w>0&&time-p.z<3).length,
         localVisualsVisible:stageEffects[localSlot].visuals.filter(node=>node.visible).length,
         localParticlesVisible:particleData.filter((p,i)=>p.owner===localSlot&&particleLife[i]>0).length,
         warnings:stageEffects.flatMap((fx,slot)=>fx.warning.visible?[slot]:[]),telegraphs:stageEffects.flatMap((fx,slot)=>fx.telegraph.visible?[slot]:[]),
        trails:stageEffects.filter(fx=>fx.trail.visible).length,impacts:shockwaves.filter(s=>s.life>0).map(s=>s.mesh.position.toArray()),
          debris:debris.filter(d=>d.life>0).length,debrisCapacity:debris.length,
          projectiles:projectiles.filter(p=>p.root.visible).map(p=>({position:p.root.position.toArray(),direction:xAxis.clone().applyQuaternion(p.root.quaternion).toArray(),prop:p.rock.visible&&!p.meteor,meteor:!!p.meteor,energy:p.core.visible,shaft:p.shaft.visible,coil:p.coil.visible,sprite:p.sprite.visible,geometry:p.rock.geometry.type})),
         beamEchoes:beamEchoes.filter(p=>p.root.visible).map(p=>({position:p.root.position.toArray(),direction:xAxis.clone().applyQuaternion(p.root.quaternion).toArray()})),
         shotHistory:shotHistory.size,chargeLight:chargeLight.intensity,impactLight:impactLight.intensity,cameraAccent }, disposed };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    releaseResources(assetResources);
    clearEffects();
    observer?.disconnect(); window.removeEventListener('resize', resize);
    canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
    scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    key.shadow.map?.dispose();
    portraitRenderer?.dispose(); portraitRenderer?.forceContextLoss();
    renderer.dispose(); renderer.forceContextLoss();
    scene.clear(); portraitCache.clear(); stageCache.clear(); models.forEach((cache) => cache.clear()); extraModels.clear(); activeModels.length=0;
    for (const fx of stageEffects) fx.owner = null;
    assetInstances.length = 0;
    geometries.clear(); materials.clear(); textures.clear();
    lastPresentationState=null;
  }
  function movementBasis(){
    camera.getWorldDirection(scratch);
    const x=scratch.x,z=scratch.z,length=Math.hypot(x,z)||1;
    return {x:x/length,z:z/length};
  }
  function aimDirection(fighter){
    camera.getWorldDirection(scratch);
    const ray={x:scratch.x,y:scratch.y,z:scratch.z};
    return fighter ? resolveViewAim(fighter,camera.position,ray,lastPresentationState?.fighters?.filter((_,slot)=>slot!==localSlot),lastPresentationState?.props) || ray : ray;
  }
  function targetCue(fighter) {
    if (!fighter?.alive) return null;
    projectionPoint.set(fighter.x,fighter.y+1.5,fighter.z).applyMatrix4(camera.matrixWorldInverse);
    const behind=projectionPoint.z>=0;
    if (!behind) projectionPoint.applyMatrix4(camera.projectionMatrix);
    const x=projectionPoint.x, y=projectionPoint.y;
    const onScreen=!behind && Math.abs(x)<.9 && Math.abs(y)<.7;
    const dx=Math.abs(x)+Math.abs(y)<.001?0:x, dy=Math.abs(x)+Math.abs(y)<.001?-1:y;
    const edgeX=Math.min(.4,Math.max(.2,.5-80/width));
    const scale=Math.min(edgeX/Math.max(.001,Math.abs(dx)),.25/Math.max(.001,Math.abs(dy)));
    return {onScreen,x:.5+dx*scale,y:.43-dy*scale,angle:Math.atan2(-dy,dx)*180/PI};
  }
  function configure(value) {
    const next=normalizePresentation(value), changed=next.quality!==presentation.quality;
    presentation=next; quality=QUALITY[next.quality];
    if (changed) resize();
    return {...presentation};
  }
  return { update, portrait, dispose, stats, movementBasis, aimDirection, targetCue, configure };
}

import * as THREE from '../vendor/three.module.js';

const SUN_VERTEX = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  varying vec3 vNormal;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
  }
  void main() {
    vec2 flow = vUv * vec2(14.0, 8.0) + vec2(uTime * .018, -uTime * .011);
    float cells = noise(flow) * .50 + noise(flow * 2.7) * .29 + noise(flow * 7.4) * .21;
    float granules = noise(flow * 15.0 + noise(flow * 2.0)) * .64 + noise(flow * 37.0 - uTime * .01) * .36;
    float magneticLane = abs(sin((vUv.x + noise(flow * .7) * .08) * 42.0 + uTime * .006));
    float spotSeed = noise(vUv * vec2(5.0, 3.0) + vec2(uTime * .001, 0.0));
    float noisySpot = smoothstep(.66, .82, spotSeed) * smoothstep(.22, .42, vUv.y) * (1.0 - smoothstep(.58, .78, vUv.y));
    float spotA = 1.0 - smoothstep(.016, .060, length(vec2((vUv.x - .31) * 1.55, vUv.y - .47)));
    float spotB = 1.0 - smoothstep(.012, .046, length(vec2((vUv.x - .69) * 1.70, vUv.y - .55)));
    float limb = pow(max(vNormal.z, 0.0), .46);
    float sunspot = max(noisySpot * .62, max(spotA, spotB)) * smoothstep(.22, .56, limb);
    float cellContrast = smoothstep(.22, .78, cells);
    float brightLane = smoothstep(.70, .97, cells + magneticLane * .14);
    float convection = clamp(cellContrast * .76 + granules * .24, 0.0, 1.0);
    vec3 color = mix(uEdge, uCore, .16 + convection * .78);
    color *= .49 + limb * .44 + (granules - .5) * .22;
    color += mix(vec3(.72, .16, .018), uCore, .32) * brightLane * .16;
    color *= 1.0 - sunspot * .68;
    color += vec3(.34, .055, .006) * sunspot * .18;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const ACCRETION_VERTEX = `
  varying vec3 vLocalPosition;
  void main() {
    vLocalPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ACCRETION_FRAGMENT = `
  uniform float uTime;
  varying vec3 vLocalPosition;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(91.7, 257.3))) * 43758.5453); }
  void main() {
    float radius = length(vLocalPosition.xy);
    float radial = clamp((radius - 1.75) / 3.55, 0.0, 1.0);
    float angle = atan(vLocalPosition.y, vLocalPosition.x);
    float shear = sin(angle * 7.0 - radial * 39.0 + sin(angle * 3.0 + uTime * .14) * 1.4 + uTime * .58) * .5 + .5;
    float grain = hash(floor(vLocalPosition.xy * 11.0) + floor(uTime * .06));
    float band = smoothstep(.28, .84, shear * .82 + grain * .18);
    float hot = pow(1.0 - radial, 2.45);
    vec3 outerColor = vec3(.16, .018, .006);
    vec3 innerColor = vec3(1.0, .64, .13);
    vec3 color = mix(outerColor, innerColor, hot) + vec3(.88, .17, .018) * band * .26;
    float edge = smoothstep(0.0, .055, radial) * (1.0 - smoothstep(.88, 1.0, radial));
    gl_FragColor = vec4(color, edge * (.24 + hot * .62));
  }
`;

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.2);
    gl_FragColor = vec4(uColor * (rim * (1.2 + uStrength)), rim * uStrength);
  }
`;

const SEASON_LIGHT_VERTEX = `
  varying vec3 vWorldNormal;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SEASON_LIGHT_FRAGMENT = `
  uniform vec3 uSunDirection;
  varying vec3 vWorldNormal;
  void main() {
    float incidence = dot(normalize(vWorldNormal), normalize(uSunDirection));
    float daylight = smoothstep(-0.03, 0.24, incidence);
    float terminator = 1.0 - smoothstep(0.02, 0.16, abs(incidence));
    vec3 nightEdge = vec3(0.16, 0.62, 1.0);
    vec3 directLight = vec3(1.0, 0.61, 0.16);
    vec3 color = mix(nightEdge, directLight, clamp(daylight + incidence * 0.18, 0.0, 1.0));
    float alpha = daylight * (0.10 + max(incidence, 0.0) * 0.20) + terminator * 0.48;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.52));
  }
`;

const GPU_COLLISION_VERTEX = `
  attribute vec3 aDirection;
  attribute float aSeed;
  attribute float aSize;
  uniform float uProgress;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uMotionScale;
  varying float vSeed;
  varying float vLife;
  void main() {
    float launch = pow(clamp(uProgress, 0.0, 1.0), 0.68);
    vec3 tangent = normalize(vec3(-aDirection.y, aDirection.x, aDirection.z * 0.18 + 0.001));
    float curl = sin(aSeed * 31.7 + launch * 8.0) * 0.16 * launch;
    vec3 displaced = aDirection * (0.10 + launch * (0.72 + aSeed * 1.55) * uEnergy * uMotionScale)
      + tangent * curl * uMotionScale;
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(118.0 / max(1.0, -viewPosition.z), 0.55, 4.0);
    gl_PointSize = aSize * uPixelRatio * perspective * mix(1.75, 0.62, launch);
    vSeed = aSeed;
    vLife = 1.0 - smoothstep(0.34 + aSeed * 0.28, 1.0, uProgress);
  }
`;

const GPU_COLLISION_FRAGMENT = `
  varying float vSeed;
  varying float vLife;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float radius = length(centered) * 2.0;
    float core = 1.0 - smoothstep(0.05, 0.45, radius);
    float ember = 1.0 - smoothstep(0.34, 1.0, radius);
    vec3 hot = vec3(1.0, 0.92, 0.62);
    vec3 cool = vec3(1.0, 0.17 + vSeed * 0.18, 0.035);
    vec3 color = mix(cool, hot, core);
    float alpha = (core * 0.84 + ember * 0.58) * vLife;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

const GPU_COLLISION_SHELL_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const GPU_COLLISION_SHELL_FRAGMENT = `
  uniform float uOpacity;
  uniform float uHeat;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.25);
    float membrane = pow(max(dot(vNormal, vView), 0.0), 10.0) * 0.18;
    vec3 color = mix(vec3(1.0, 0.16, 0.025), vec3(1.0, 0.82, 0.38), uHeat);
    gl_FragColor = vec4(color, (rim * 0.92 + membrane) * uOpacity);
  }
`;

const GPU_COLLISION_SHARD_VERTEX = `
  attribute vec3 aDirection;
  attribute float aSeed;
  attribute float aSize;
  uniform float uProgress;
  uniform float uEnergy;
  uniform float uMotionScale;
  varying float vSeed;
  varying float vLife;
  void main() {
    float launch = pow(clamp(uProgress, 0.0, 1.0), 0.64);
    vec3 forward = normalize(aDirection);
    vec3 helper = abs(forward.z) > 0.82 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(helper, forward));
    vec3 up = normalize(cross(forward, right));
    float spin = aSeed * 23.0 + launch * (7.0 + aSeed * 19.0);
    vec2 local = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * position.xy;
    float size = aSize * mix(1.0, 0.58, launch);
    vec3 shard = (right * local.x + up * local.y) * size;
    vec3 displaced = forward * (0.14 + launch * (0.88 + aSeed * 2.15) * uEnergy * uMotionScale);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced + shard, 1.0);
    vSeed = aSeed;
    vLife = 1.0 - smoothstep(0.42 + aSeed * 0.22, 1.0, uProgress);
  }
`;

const GPU_COLLISION_SHARD_FRAGMENT = `
  varying float vSeed;
  varying float vLife;
  void main() {
    vec3 ember = mix(vec3(1.0, 0.11, 0.015), vec3(1.0, 0.78, 0.28), vSeed);
    gl_FragColor = vec4(ember, vLife * (0.48 + vSeed * 0.46));
  }
`;

const SPACETIME_RIPPLE_VERTEX = `
  uniform float uTime;
  uniform vec2 uBodyA;
  uniform vec2 uBodyB;
  uniform float uStrength;
  varying float vAmplitude;
  varying float vRadius;
  void main() {
    vec3 displaced = position;
    float distanceA = length(position.xy - uBodyA);
    float distanceB = length(position.xy - uBodyB);
    float radial = length(position.xy);
    float angle = atan(position.y, position.x);
    float wells = -uStrength * (0.23 / (0.18 + distanceA) + 0.23 / (0.18 + distanceB));
    float envelope = exp(-radial * 0.38);
    float waveA = sin(radial * 12.0 - uTime * 3.4 + angle * 2.0);
    float waveB = sin(radial * 18.0 - uTime * 4.8 - angle * 2.0) * 0.32;
    float wave = (waveA + waveB) * envelope * uStrength * 0.115;
    displaced.z += wells + wave;
    vAmplitude = clamp(abs(wave) * 6.0 + abs(wells) * 0.72, 0.0, 1.0);
    vRadius = radial;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const SPACETIME_RIPPLE_FRAGMENT = `
  uniform float uOpacity;
  varying float vAmplitude;
  varying float vRadius;
  void main() {
    vec3 quiet = vec3(0.10, 0.37, 0.58);
    vec3 crest = vec3(0.46, 0.91, 1.0);
    vec3 color = mix(quiet, crest, smoothstep(0.04, 0.62, vAmplitude));
    float edgeFade = 1.0 - smoothstep(2.9, 4.0, vRadius);
    gl_FragColor = vec4(color, uOpacity * edgeFade * (0.32 + vAmplitude * 0.68));
  }
`;

const RENDER_QUALITY_PROFILES = Object.freeze({
  efficient: { pixelRatio: 1, collisionParticles: 96, collisionShards: 36, shellSegments: 20, rippleSegments: 24 },
  balanced: { pixelRatio: 1.5, collisionParticles: 288, collisionShards: 112, shellSegments: 32, rippleSegments: 42 },
  cinematic: { pixelRatio: 2.5, collisionParticles: 896, collisionShards: 320, shellSegments: 48, rippleSegments: 72 }
});

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,246,207,1)');
  gradient.addColorStop(.16, 'rgba(255,199,91,.7)');
  gradient.addColorStop(.5, 'rgba(255,133,37,.16)');
  gradient.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function starPointTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.96)');
  gradient.addColorStop(.48, 'rgba(255,255,255,.34)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

function bodyMaterial(body, textures) {
  if (body.id === 'earth') {
    return new THREE.MeshStandardMaterial({
      map: textures.earth,
      roughness: .78,
      metalness: 0,
      emissive: new THREE.Color(0x061323),
      emissiveIntensity: .24
    });
  }
  if (body.flags?.includes('preset:earth-analogue')) {
    return new THREE.MeshStandardMaterial({
      map: textures.earthAnalogue,
      bumpMap: textures.earthAnalogue,
      bumpScale: .022,
      color: 0xffffff,
      roughness: .76,
      metalness: 0,
      emissive: new THREE.Color(0x04111c),
      emissiveIntensity: .16
    });
  }
  if (body.id === 'moon') {
    return new THREE.MeshStandardMaterial({
      map: textures.moonColor,
      bumpMap: textures.moonElevation,
      bumpScale: .045,
      color: 0xd8d2c8,
      roughness: .96,
      metalness: 0
    });
  }
  if (body.id === 'mars' || body.flags?.includes('preset:mars-like')) {
    return new THREE.MeshStandardMaterial({
      map: textures.marsLike,
      color: 0xffffff,
      roughness: .94,
      metalness: 0
    });
  }
  if (body.id === 'jupiter' || body.id === 'saturn' || body.id === 'hot-jupiter' || body.flags?.includes('preset:gas-giant')) {
    return new THREE.MeshStandardMaterial({ map: textures.gasGiant, color: 0xffffff, roughness: .9, metalness: 0 });
  }
  if (body.id === 'uranus' || body.id === 'neptune' || body.flags?.includes('preset:ice-giant')) {
    return new THREE.MeshStandardMaterial({ map: textures.iceGiant, color: 0xffffff, roughness: .84, metalness: 0 });
  }
  if (body.id === 'mercury' || body.type === 'moon') {
    return new THREE.MeshStandardMaterial({
      map: textures.rockyMoon,
      bumpMap: textures.rockyMoon,
      bumpScale: .035,
      color: body.id === 'mercury' ? 0xb9aca0 : 0xffffff,
      roughness: .98,
      metalness: 0
    });
  }
  if (body.id === 'venus') {
    return new THREE.MeshStandardMaterial({ map: textures.gasGiant, color: 0xd6a873, roughness: .92, metalness: 0 });
  }
  if (body.flags?.includes('preset:super-earth') || body.type === 'planet') {
    return new THREE.MeshStandardMaterial({
      map: textures.superEarth,
      bumpMap: textures.superEarth,
      bumpScale: .018,
      color: 0xffffff,
      roughness: .82,
      metalness: 0
    });
  }
  if (body.type === 'moon') {
    return new THREE.MeshStandardMaterial({ color: body.color, roughness: 1, metalness: 0 });
  }
  return new THREE.MeshStandardMaterial({ color: body.color, roughness: .88, metalness: .02 });
}

function isBlackHole(body) {
  return body.flags?.includes('black-hole') || body.flags?.includes('preset:black-hole');
}

function starMaterial(body) {
  const base = new THREE.Color(body.color || 0xffd08a);
  const core = base.clone().lerp(new THREE.Color(0xffffff), body.flags?.includes('preset:white-dwarf') ? .70 : .24);
  const edge = base.clone().multiplyScalar(body.flags?.includes('preset:red-dwarf') ? .30 : .38);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: core },
      uEdge: { value: edge }
    },
    vertexShader: SUN_VERTEX,
    fragmentShader: SUN_FRAGMENT
  });
}

function accretionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: ACCRETION_VERTEX,
    fragmentShader: ACCRETION_FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function atmosphereProfile(body) {
  if (body.id === 'earth' || body.flags?.includes('preset:earth-analogue')) return { color: 0x2f9dff, strength: .56, scale: 1.075 };
  if (body.id === 'venus') return { color: 0xe0a45d, strength: .44, scale: 1.055 };
  if (body.id === 'mars' || body.flags?.includes('preset:mars-like')) return { color: 0xd86e42, strength: .20, scale: 1.035 };
  if (body.id === 'jupiter' || body.id === 'saturn' || body.id === 'hot-jupiter' || body.flags?.includes('preset:gas-giant')) return { color: 0xf1c27a, strength: .32, scale: 1.035 };
  if (body.id === 'uranus' || body.id === 'neptune' || body.flags?.includes('preset:ice-giant')) return { color: 0x49bde8, strength: .42, scale: 1.045 };
  if (body.flags?.includes('preset:super-earth')) return { color: 0x63d8cf, strength: .38, scale: 1.06 };
  return null;
}

function atmosphereMaterial({ color, strength }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength }
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide
  });
}

export function createSolarRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let requestedRenderQuality = 'auto';
  let resolvedRenderQuality = 'balanced';
  function autoRenderQuality() {
    const cores = Number(navigator.hardwareConcurrency || 4);
    const memory = Number(navigator.deviceMemory || (cores >= 10 ? 8 : 4));
    if (cores >= 10 && memory >= 8) return 'cinematic';
    if (cores >= 6 && memory >= 4) return 'balanced';
    return 'efficient';
  }
  function activeQualityProfile() {
    return RENDER_QUALITY_PROFILES[resolvedRenderQuality];
  }
  function applyRendererQuality() {
    resolvedRenderQuality = requestedRenderQuality === 'auto' ? autoRenderQuality() : requestedRenderQuality;
    const profile = activeQualityProfile();
    renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatio));
    canvas.dataset.renderQualityRequested = requestedRenderQuality;
    canvas.dataset.renderQuality = resolvedRenderQuality;
    canvas.dataset.collisionParticles = String(profile.collisionParticles);
    canvas.dataset.collisionShards = String(profile.collisionShards);
    canvas.dataset.rippleTriangles = String(profile.rippleSegments * profile.rippleSegments * 2);
    canvas.dataset.renderBackend = renderer.capabilities.isWebGL2 ? 'webgl2-glsl' : 'webgl1-glsl';
    canvas.dataset.webgpuAvailable = String(Boolean(navigator.gpu));
  }
  applyRendererQuality();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010207);
  canvas.dataset.skyCatalog = 'loading';
  canvas.dataset.skyConstellations = 'loading';
  const camera = new THREE.PerspectiveCamera(47, 1, .01, 2_000);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  let viewportWidth = 1;
  let viewportHeight = 1;
  let viewportAspect = 1;
  let lastView = null;

  scene.add(new THREE.HemisphereLight(0x52657b, 0x020306, .38));
  const keyLight = new THREE.DirectionalLight(0xfff0ce, 4.6);
  keyLight.position.set(-6, 2, 8);
  scene.add(keyLight);
  const coolRim = new THREE.DirectionalLight(0x4477aa, .85);
  coolRim.position.set(5, -4, 3);
  scene.add(coolRim);

  const referenceGrid = new THREE.GridHelper(24, 24, 0x54718a, 0x243746);
  referenceGrid.rotation.x = Math.PI * .5;
  referenceGrid.material.transparent = true;
  referenceGrid.material.opacity = .30;
  referenceGrid.material.depthWrite = false;
  scene.add(referenceGrid);

  const axisGeometry = new THREE.BufferGeometry();
  axisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 3.5, 0, 0,
    0, 0, 0, 0, 3.5, 0,
    0, 0, 0, 0, 0, 3.5
  ], 3));
  axisGeometry.setAttribute('color', new THREE.Float32BufferAttribute([
    .9, .3, .25, .9, .3, .25,
    .35, .8, .55, .35, .8, .55,
    .35, .62, .95, .35, .62, .95
  ], 3));
  const referenceAxes = new THREE.LineSegments(axisGeometry, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: .55, depthWrite: false
  }));
  scene.add(referenceAxes);
  let constellationOpacity = .08;
  let constellationMaterial = null;

  const skyPoint = starPointTexture();
  function addSkyLayer(positions, colors, { size, opacity }) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      map: skyPoint,
      alphaTest: .015,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false
    }));
    points.renderOrder = -20;
    scene.add(points);
  }

  function starColorFromBV(bMinusV) {
    if (!Number.isFinite(bMinusV)) return new THREE.Color(0xdde8f2);
    const normalized = THREE.MathUtils.clamp((bMinusV + .4) / 2.4, 0, 1);
    if (normalized < .46) {
      return new THREE.Color(0x91b8ff).lerp(new THREE.Color(0xf2f5ff), normalized / .46);
    }
    return new THREE.Color(0xf2f5ff).lerp(new THREE.Color(0xffad73), (normalized - .46) / .54);
  }

  const magnitudeBuckets = [
    { limit: 1.5, size: 5.2, opacity: 1, positions: [], colors: [] },
    { limit: 3, size: 3.8, opacity: .98, positions: [], colors: [] },
    { limit: 4.5, size: 2.6, opacity: .9, positions: [], colors: [] },
    { limit: 6, size: 1.55, opacity: .78, positions: [], colors: [] }
  ];
  const obliquity = 23.43928 * Math.PI / 180;
  const cosObliquity = Math.cos(obliquity);
  const sinObliquity = Math.sin(obliquity);
  function eclipticDirection(rightAscension, declination, radius = 900) {
    const cosDec = Math.cos(declination);
    const equatorialX = Math.cos(rightAscension) * cosDec;
    const equatorialY = Math.sin(rightAscension) * cosDec;
    const equatorialZ = Math.sin(declination);
    return [
      equatorialX * radius,
      (equatorialY * cosObliquity + equatorialZ * sinObliquity) * radius,
      (-equatorialY * sinObliquity + equatorialZ * cosObliquity) * radius
    ];
  }
  fetch('./assets/data/bsc5-bright-stars.json')
    .then((response) => {
      if (!response.ok) throw new Error(`BSC5 sky asset returned ${response.status}.`);
      return response.json();
    })
    .then((catalog) => {
      if (catalog.coordinateFrame !== 'J2000 equatorial' || catalog.count !== catalog.stars?.length) {
        throw new Error('BSC5 sky asset failed its coordinate/count contract.');
      }
      for (const [rightAscension, declination, visualMagnitude, bMinusV] of catalog.stars) {
        const [eclipticX, eclipticY, eclipticZ] = eclipticDirection(rightAscension, declination);
        const bucket = magnitudeBuckets.find((candidate) => visualMagnitude <= candidate.limit) || magnitudeBuckets.at(-1);
        bucket.positions.push(eclipticX, eclipticY, eclipticZ);
        const color = starColorFromBV(bMinusV);
        bucket.colors.push(color.r, color.g, color.b);
      }
      for (const bucket of magnitudeBuckets) addSkyLayer(bucket.positions, bucket.colors, bucket);
      canvas.dataset.skyCatalog = 'BSC5 V/50';
      canvas.dataset.skyFrame = 'J2000 ecliptic';
      canvas.dataset.skyStars = String(catalog.count);
    })
    .catch((error) => {
      canvas.dataset.skyCatalog = 'procedural fallback';
      canvas.dataset.skyError = error.message;
    });

  fetch('./assets/data/bsc5-constellation-lines.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Constellation line asset returned ${response.status}.`);
      return response.json();
    })
    .then((figures) => {
      if (figures.coordinateFrame !== 'J2000 equatorial' || figures.constellationCount !== 88 || figures.polylineCount !== figures.polylines?.length) {
        throw new Error('Constellation line asset failed its coordinate/count contract.');
      }
      const positions = [];
      for (const [, vertices] of figures.polylines) {
        for (let index = 1; index < vertices.length; index += 1) {
          positions.push(
            ...eclipticDirection(vertices[index - 1][0], vertices[index - 1][1], 885),
            ...eclipticDirection(vertices[index][0], vertices[index][1], 885)
          );
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      constellationMaterial = new THREE.LineBasicMaterial({
        color: 0x7892aa,
        transparent: true,
        opacity: constellationOpacity,
        depthTest: false,
        depthWrite: false
      });
      const lineFigures = new THREE.LineSegments(geometry, constellationMaterial);
      lineFigures.renderOrder = -19;
      scene.add(lineFigures);
      canvas.dataset.skyConstellations = 'BSC5 western figures';
      canvas.dataset.skyConstellationCount = String(figures.constellationCount);
      canvas.dataset.skyConstellationLicense = figures.sources.lineFiguresLicense;
    })
    .catch((error) => {
      canvas.dataset.skyConstellations = 'unavailable';
      canvas.dataset.skyConstellationError = error.message;
    });

  const textureLoader = new THREE.TextureLoader();
  const textures = {
    earth: textureLoader.load('./assets/textures/earth-blue-marble-2048.png'),
    earthAnalogue: textureLoader.load('./assets/textures/earth-analogue-albedo-generated-v1.png'),
    moonColor: textureLoader.load('./assets/textures/moon-lroc-color-2048.jpg'),
    moonElevation: textureLoader.load('./assets/textures/moon-lola-elevation-1024.jpg'),
    marsLike: textureLoader.load('./assets/textures/mars-like-albedo-gpt-image-2.png'),
    gasGiant: textureLoader.load('./assets/textures/gas-giant-albedo-generated-v1.png'),
    iceGiant: textureLoader.load('./assets/textures/ice-giant-albedo-generated-v1.png'),
    superEarth: textureLoader.load('./assets/textures/super-earth-albedo-generated-v1.png'),
    rockyMoon: textureLoader.load('./assets/textures/rocky-moon-albedo-generated-v1.png')
  };
  textures.earth.colorSpace = THREE.SRGBColorSpace;
  textures.earthAnalogue.colorSpace = THREE.SRGBColorSpace;
  textures.moonColor.colorSpace = THREE.SRGBColorSpace;
  textures.marsLike.colorSpace = THREE.SRGBColorSpace;
  textures.gasGiant.colorSpace = THREE.SRGBColorSpace;
  textures.iceGiant.colorSpace = THREE.SRGBColorSpace;
  textures.superEarth.colorSpace = THREE.SRGBColorSpace;
  textures.rockyMoon.colorSpace = THREE.SRGBColorSpace;
  for (const texture of Object.values(textures)) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = THREE.RepeatWrapping;
  }

  const seasonLightMaterial = new THREE.ShaderMaterial({
    uniforms: { uSunDirection: { value: new THREE.Vector3(-1, 0, 0) } },
    vertexShader: SEASON_LIGHT_VERTEX,
    fragmentShader: SEASON_LIGHT_FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  const glow = glowTexture();
  const groupById = new Map();
  const orbitById = new Map();
  const collisionGroupByKey = new Map();
  const completedCollisionKeys = new Set();
  let spacetimeRipple = null;
  const raycaster = new THREE.Raycaster();
  const PHYSICS_G = 6.67430e-11;

  function collisionSeed(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function collisionRandom(seedState) {
    let state = seedState >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function disposeCollisionGroup(group) {
    scene.remove(group);
    group.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material?.dispose?.();
    });
  }

  function clearCollisionGroups() {
    for (const group of collisionGroupByKey.values()) disposeCollisionGroup(group);
    collisionGroupByKey.clear();
  }

  function createCollisionGroup(effect) {
    const profile = activeQualityProfile();
    const count = reducedMotion
      ? Math.min(72, profile.collisionParticles)
      : profile.collisionParticles;
    const random = collisionRandom(collisionSeed(effect.key));
    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const azimuth = random() * Math.PI * 2;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      directions[index * 3] = Math.cos(azimuth) * planar;
      directions[index * 3 + 1] = Math.sin(azimuth) * planar;
      directions[index * 3 + 2] = z * (0.44 + random() * 0.56);
      seeds[index] = random();
      sizes[index] = 1.4 + Math.pow(random(), 2.1) * 5.4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uEnergy: { value: 1 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uMotionScale: { value: reducedMotion ? .24 : 1 }
      },
      vertexShader: GPU_COLLISION_VERTEX,
      fragmentShader: GPU_COLLISION_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, particleMaterial);
    points.frustumCulled = false;
    points.renderOrder = 12;

    const shardCount = reducedMotion
      ? Math.min(24, profile.collisionShards)
      : profile.collisionShards;
    const shardGeometry = new THREE.InstancedBufferGeometry();
    shardGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -.72, -.38, 0,
      .82, 0, 0,
      -.72, .38, 0
    ]), 3));
    const shardDirections = new Float32Array(shardCount * 3);
    const shardSeeds = new Float32Array(shardCount);
    const shardSizes = new Float32Array(shardCount);
    const impactAxis = new THREE.Vector3().fromArray(effect.impactNormal || [1, 0, 0]).normalize();
    for (let index = 0; index < shardCount; index += 1) {
      const azimuth = random() * Math.PI * 2;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const direction = new THREE.Vector3(Math.cos(azimuth) * planar, Math.sin(azimuth) * planar, z);
      const lobe = random() < .5 ? -1 : 1;
      direction.addScaledVector(impactAxis, lobe * (.38 + random() * .82)).normalize();
      direction.toArray(shardDirections, index * 3);
      shardSeeds[index] = random();
      shardSizes[index] = .065 + Math.pow(random(), 1.8) * .18;
    }
    shardGeometry.setAttribute('aDirection', new THREE.InstancedBufferAttribute(shardDirections, 3));
    shardGeometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(shardSeeds, 1));
    shardGeometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(shardSizes, 1));
    shardGeometry.instanceCount = shardCount;
    const shardMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uEnergy: { value: 1 },
        uMotionScale: { value: reducedMotion ? .2 : 1 }
      },
      vertexShader: GPU_COLLISION_SHARD_VERTEX,
      fragmentShader: GPU_COLLISION_SHARD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const shards = new THREE.Mesh(shardGeometry, shardMaterial);
    shards.frustumCulled = false;
    shards.renderOrder = 12;

    const shellMaterial = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uHeat: { value: 1 } },
      vertexShader: GPU_COLLISION_SHELL_VERTEX,
      fragmentShader: GPU_COLLISION_SHELL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, profile.shellSegments, Math.max(12, Math.round(profile.shellSegments * .66))),
      shellMaterial
    );
    shell.renderOrder = 11;

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xffb057,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    core.renderOrder = 13;

    const group = new THREE.Group();
    group.add(shell, points, shards, core);
    group.userData = { particleMaterial, shardMaterial, shell, shellMaterial, core };
    scene.add(group);
    collisionGroupByKey.set(effect.key, group);
    return group;
  }

  function updateCollisionEffects(effects, nowMs, centerM, sceneScale) {
    const durationMs = reducedMotion ? 2_600 : 5_200;
    const sourceKeys = new Set((effects || []).map((effect) => effect.key));
    for (const key of completedCollisionKeys) {
      if (!sourceKeys.has(key)) completedCollisionKeys.delete(key);
    }
    const activeKeys = new Set();
    let latestProgress = null;
    for (const effect of effects || []) {
      if (completedCollisionKeys.has(effect.key)) continue;
      const group = collisionGroupByKey.get(effect.key) || createCollisionGroup(effect);
      if (!Number.isFinite(group.userData.lastNowMs)) group.userData.lastNowMs = nowMs;
      const frameDeltaMs = THREE.MathUtils.clamp(nowMs - group.userData.lastNowMs, 0, 80);
      group.userData.lastNowMs = nowMs;
      group.userData.visualElapsedMs = (group.userData.visualElapsedMs || 0) + frameDeltaMs;
      activeKeys.add(effect.key);
      const progress = THREE.MathUtils.clamp(group.userData.visualElapsedMs / durationMs, 0, 1);
      latestProgress = progress;
      const speedScale = THREE.MathUtils.clamp((effect.relativeSpeedMps || 24_000) / 24_000, .72, 1.65);
      const energyScale = Number.isFinite(effect.impactEnergyJ) && effect.impactEnergyJ > 0
        ? THREE.MathUtils.clamp(Math.log10(effect.impactEnergyJ) / 32, .78, 1.35)
        : 1;
      const energy = speedScale * energyScale;
      group.position.set(
        (effect.impactPositionM[0] - centerM[0]) * sceneScale,
        (effect.impactPositionM[1] - centerM[1]) * sceneScale,
        ((effect.impactPositionM[2] || 0) - (centerM[2] || 0)) * sceneScale
      );
      const { particleMaterial, shardMaterial, shell, shellMaterial, core } = group.userData;
      particleMaterial.uniforms.uProgress.value = progress;
      particleMaterial.uniforms.uEnergy.value = energy;
      particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      shardMaterial.uniforms.uProgress.value = progress;
      shardMaterial.uniforms.uEnergy.value = energy;
      shell.scale.setScalar((.12 + Math.pow(progress, .72) * 1.68 * energy) * (reducedMotion ? .45 : 1));
      shellMaterial.uniforms.uOpacity.value = Math.pow(1 - progress, 1.35) * .72;
      shellMaterial.uniforms.uHeat.value = Math.max(0, 1 - progress * 1.35);
      core.scale.setScalar(.18 + Math.sin(Math.min(1, progress * 1.25) * Math.PI) * .86 * energy);
      core.material.opacity = Math.pow(1 - progress, 2.6) * .86;
      if (progress >= 1) {
        activeKeys.delete(effect.key);
        completedCollisionKeys.add(effect.key);
      }
    }
    for (const [key, group] of collisionGroupByKey) {
      if (activeKeys.has(key)) continue;
      disposeCollisionGroup(group);
      collisionGroupByKey.delete(key);
    }
    canvas.dataset.activeCollisionEffects = String(activeKeys.size);
    if (latestProgress === null) delete canvas.dataset.collisionProgress;
    else canvas.dataset.collisionProgress = latestProgress.toFixed(3);
  }

  function disposeSpacetimeRipple() {
    if (!spacetimeRipple) return;
    scene.remove(spacetimeRipple);
    spacetimeRipple.geometry.dispose();
    spacetimeRipple.material.dispose();
    spacetimeRipple = null;
  }

  function createSpacetimeRipple() {
    const segments = reducedMotion
      ? Math.min(24, activeQualityProfile().rippleSegments)
      : activeQualityProfile().rippleSegments;
    const geometry = new THREE.PlaneGeometry(8, 8, segments, segments);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBodyA: { value: new THREE.Vector2(-.5, 0) },
        uBodyB: { value: new THREE.Vector2(.5, 0) },
        uStrength: { value: .8 },
        uOpacity: { value: reducedMotion ? .22 : .52 }
      },
      vertexShader: SPACETIME_RIPPLE_VERTEX,
      fragmentShader: SPACETIME_RIPPLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    spacetimeRipple = new THREE.Mesh(geometry, material);
    spacetimeRipple.frustumCulled = false;
    spacetimeRipple.renderOrder = 2;
    scene.add(spacetimeRipple);
    return spacetimeRipple;
  }

  function updateSpacetimeRipple(bodies, activeExperiment, nowMs, centerM, sceneScale) {
    const compactBodies = bodies.filter((body) => body.flags?.includes('compact-binary-proxy'));
    const visible = activeExperiment === 'light' && compactBodies.length >= 2;
    if (!visible) {
      if (spacetimeRipple) spacetimeRipple.visible = false;
      canvas.dataset.spacetimeRipple = 'inactive';
      return;
    }
    const mesh = spacetimeRipple || createSpacetimeRipple();
    mesh.visible = true;
    const [a, b] = compactBodies;
    const midpointM = a.positionM.map((value, axis) => (value + b.positionM[axis]) * .5);
    mesh.position.set(
      (midpointM[0] - centerM[0]) * sceneScale,
      (midpointM[1] - centerM[1]) * sceneScale,
      (midpointM[2] - (centerM[2] || 0)) * sceneScale - .08
    );
    const localA = new THREE.Vector2((a.positionM[0] - midpointM[0]) * sceneScale, (a.positionM[1] - midpointM[1]) * sceneScale);
    const localB = new THREE.Vector2((b.positionM[0] - midpointM[0]) * sceneScale, (b.positionM[1] - midpointM[1]) * sceneScale);
    mesh.material.uniforms.uBodyA.value.copy(localA);
    mesh.material.uniforms.uBodyB.value.copy(localB);
    mesh.material.uniforms.uTime.value = nowMs * .001;
    mesh.material.uniforms.uStrength.value = THREE.MathUtils.clamp(.72 + localA.distanceTo(localB) * .18, .72, 1.25);
    canvas.dataset.spacetimeRipple = 'active';
    canvas.dataset.spacetimeRippleModel = 'illustrative-quadrupole-sheet';
  }

  function orbitLine(body) {
    let line = orbitById.get(body.id);
    if (line) return line;
    line = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: body.color,
        transparent: true,
        opacity: .34,
        depthWrite: false
      })
    );
    line.frustumCulled = false;
    line.renderOrder = -1;
    scene.add(line);
    orbitById.set(body.id, line);
    return line;
  }

  function updateOsculatingOrbit(body, sun, centerM, sceneScale, visible) {
    const line = orbitLine(body);
    line.visible = visible;
    if (!visible) return;
    const r = new THREE.Vector3(
      body.positionM[0] - sun.positionM[0],
      body.positionM[1] - sun.positionM[1],
      body.positionM[2] - sun.positionM[2]
    );
    const v = new THREE.Vector3(
      body.velocityMps[0] - sun.velocityMps[0],
      body.velocityMps[1] - sun.velocityMps[1],
      body.velocityMps[2] - sun.velocityMps[2]
    );
    const mu = PHYSICS_G * (sun.massKg + body.massKg);
    const h = new THREE.Vector3().crossVectors(r, v);
    const hSquared = h.lengthSq();
    if (!(mu > 0) || !(hSquared > 0)) {
      line.visible = false;
      return;
    }
    const eccentricityVector = new THREE.Vector3().crossVectors(v, h).multiplyScalar(1 / mu)
      .sub(r.clone().normalize());
    const eccentricity = eccentricityVector.length();
    if (!Number.isFinite(eccentricity) || eccentricity >= .98) {
      line.visible = false;
      return;
    }
    const periapsis = eccentricity > 1e-6 ? eccentricityVector.normalize() : r.clone().normalize();
    const normal = h.clone().normalize();
    const transverse = new THREE.Vector3().crossVectors(normal, periapsis).normalize();
    const semiLatusRectumM = hSquared / mu;
    let positions = line.geometry.getAttribute('position');
    if (!positions || positions.count !== 192) {
      positions = new THREE.BufferAttribute(new Float32Array(192 * 3), 3);
      line.geometry.setAttribute('position', positions);
    }
    for (let index = 0; index < 192; index += 1) {
      const anomaly = index / 192 * Math.PI * 2;
      const distanceM = semiLatusRectumM / (1 + eccentricity * Math.cos(anomaly));
      const relative = periapsis.clone().multiplyScalar(Math.cos(anomaly) * distanceM)
        .addScaledVector(transverse, Math.sin(anomaly) * distanceM);
      positions.setXYZ(index,
        (sun.positionM[0] + relative.x - centerM[0]) * sceneScale,
        (sun.positionM[1] + relative.y - centerM[1]) * sceneScale,
        (sun.positionM[2] + relative.z - (centerM[2] || 0)) * sceneScale
      );
    }
    positions.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function createBody(body) {
    const group = new THREE.Group();
    let material;
    if (isBlackHole(body)) material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    else if (body.type === 'star') material = starMaterial(body);
    else material = bodyMaterial(body, textures);
    const isEarthLike = body.id === 'earth' || body.flags?.includes('preset:earth-analogue');
    const isHeroBody = body.type !== 'tracer';
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, isHeroBody ? 64 : 36, isHeroBody ? 48 : 28), material);
    sphere.rotation.y = Math.PI;
    group.add(sphere);
    group.userData.sphere = sphere;
    if (body.type === 'star' && !isBlackHole(body)) group.userData.starMaterial = material;

    if (body.type === 'star' && !isBlackHole(body)) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow,
        color: body.id === 'sun' ? 0xffb14f : body.color,
        transparent: true,
        opacity: .86,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      halo.scale.setScalar(7.5);
      group.add(halo);
      group.userData.halo = halo;
    }

    if (isBlackHole(body)) {
      sphere.scale.setScalar(1.55);
      const diskMaterial = accretionMaterial();
      const disk = new THREE.Mesh(new THREE.RingGeometry(1.75, 5.3, 192, 12), diskMaterial);
      disk.rotation.x = 1.16;
      disk.rotation.z = .18;
      disk.renderOrder = 2;
      group.add(disk);
      group.userData.accretionMaterial = diskMaterial;

      const photonRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.68, .035, 14, 192),
        new THREE.MeshBasicMaterial({
          color: 0xffc96d,
          transparent: true,
          opacity: .68,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      photonRing.rotation.x = .02;
      photonRing.renderOrder = 3;
      group.add(photonRing);

      const lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow,
        color: 0xff7a2c,
        transparent: true,
        opacity: .28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      lensGlow.scale.setScalar(8.5);
      group.add(lensGlow);
      group.userData.blackHolePresentation = true;
    }

    const atmosphereDefinition = atmosphereProfile(body);
    if (atmosphereDefinition) {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(atmosphereDefinition.scale, 64, 48),
        atmosphereMaterial(atmosphereDefinition)
      );
      atmosphere.renderOrder = 2;
      group.add(atmosphere);
      group.userData.atmosphere = atmosphere;
    }
    if (body.id === 'earth') {
      const seasonShell = new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 48), seasonLightMaterial);
      seasonShell.visible = false;
      seasonShell.renderOrder = 3;
      group.add(seasonShell);
      group.userData.seasonShell = seasonShell;
    }

    if (body.id === 'saturn') {
      const saturnRing = new THREE.Mesh(
        new THREE.RingGeometry(1.28, 2.18, 96),
        new THREE.MeshStandardMaterial({
          color: 0xcdbb8b,
          transparent: true,
          opacity: .66,
          roughness: .9,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      saturnRing.rotation.x = Math.PI * .5;
      group.add(saturnRing);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.34, 1.38, 64),
      new THREE.MeshBasicMaterial({ color: 0xefc47f, transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.visible = false;
    group.add(ring);
    group.userData.ring = ring;
    scene.add(group);
    groupById.set(body.id, group);
    return group;
  }

  function bodyRadius(body, scaleMode, visualRadiusMode, largestRadiusM) {
    if (body.type === 'tracer') return .009;
    if (visualRadiusMode === 'physical-ratio') {
      const anchor = scaleMode === 'system' ? .075 : scaleMode === 'lunar' ? .22 : .18;
      return Math.max(.0012, anchor * body.radiusM / Math.max(largestRadiusM, 1));
    }
    const earthRadiusM = 6_371_008.4;
    const earthRadiusScene = scaleMode === 'system' ? .013 : scaleMode === 'lunar' ? .22 : .035;
    const compressed = earthRadiusScene * Math.pow(Math.max(body.radiusM, 1) / earthRadiusM, .36);
    return THREE.MathUtils.clamp(compressed, .009, scaleMode === 'lunar' ? .42 : .20);
  }

  function applyCamera({ yaw = 0, tilt = 0, zoom = 1 } = {}) {
    const safeTilt = THREE.MathUtils.clamp(tilt, 0.01, Math.PI * .485);
    const safeZoom = THREE.MathUtils.clamp(zoom, .04, 80);
    const radius = 12 / safeZoom;
    const planar = Math.sin(safeTilt) * radius;
    camera.position.set(
      Math.sin(yaw) * planar,
      -Math.cos(yaw) * planar,
      Math.cos(safeTilt) * radius
    );
    camera.up.set(0, 0, 1);
    if (safeTilt < .08) camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  function update({ bodies, centerM, widthM, scaleMode, visualRadiusMode = 'readable', guided = false, selectedId, elapsedSeconds, cameraState, activeExperiment, seasonPhaseRad, collisionEffects = [], nowMs = performance.now() }) {
    const bodyIds = new Set(bodies.map((body) => body.id));
    for (const [id, group] of groupById) {
      if (!bodyIds.has(id)) {
        scene.remove(group);
        groupById.delete(id);
      }
    }
    for (const [id, line] of orbitById) {
      if (!bodyIds.has(id)) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        orbitById.delete(id);
      }
    }
    const sceneScale = 10 / widthM;
    const largestRadiusM = scaleMode === 'lunar' && bodies.some((body) => body.id === 'earth')
      ? bodies.find((body) => body.id === 'earth').radiusM
      : Math.max(...bodies.map((body) => body.radiusM || 1), 1);
    lastView = { centerM: [...centerM], sceneScale };
    referenceGrid.visible = scaleMode !== 'body' && scaleMode !== 'light';
    referenceAxes.visible = referenceGrid.visible;
    referenceGrid.position.set(-centerM[0] * sceneScale, -centerM[1] * sceneScale, -(centerM[2] || 0) * sceneScale);
    referenceAxes.position.copy(referenceGrid.position);
    const sun = bodies.find((body) => body.id === 'sun');
    if (sun) {
      for (const body of bodies) {
        if (body.type === 'planet') {
          updateOsculatingOrbit(body, sun, centerM, sceneScale, scaleMode === 'system' || scaleMode === 'solar');
        }
      }
    }
    for (const body of bodies) {
      const group = groupById.get(body.id) || createBody(body);
      group.visible = true;
      group.position.set(
        (body.positionM[0] - centerM[0]) * sceneScale,
        (body.positionM[1] - centerM[1]) * sceneScale,
        (body.positionM[2] - (centerM[2] || 0)) * sceneScale
      );
      const radius = scaleMode === 'body' || scaleMode === 'light'
        ? Math.max(body.radiusM * sceneScale, body.id === selectedId ? .018 : .004)
        : bodyRadius(body, scaleMode, visualRadiusMode, largestRadiusM);
      const selectedCloseUp = body.id === selectedId && scaleMode === 'lunar' && (body.id === 'earth' || body.id === 'moon');
      const lessonMagnification = guided && (scaleMode === 'solar' || scaleMode === 'system') && visualRadiusMode === 'readable'
        ? body.type === 'star' ? 1.5 : 4 : 1;
      group.scale.setScalar(radius * (selectedCloseUp ? 1.75 : 1) * lessonMagnification);
      group.rotation.z = body.axialTiltRad || 0;
      group.userData.sphere.rotation.y = Math.PI + elapsedSeconds / (body.id === 'earth' ? 86_164 : 2_000_000);
      group.userData.ring.visible = body.id === selectedId && scaleMode !== 'body' && scaleMode !== 'light';
      if (body.id === 'earth' && group.userData.seasonShell) {
        group.userData.seasonShell.visible = activeExperiment === 'seasons' && scaleMode === 'body';
      }
    }
    if (activeExperiment === 'seasons' && Number.isFinite(seasonPhaseRad)) {
      seasonLightMaterial.uniforms.uSunDirection.value.set(-Math.cos(seasonPhaseRad), -Math.sin(seasonPhaseRad), 0).normalize();
    }
    for (const group of groupById.values()) {
      if (group.userData.starMaterial) group.userData.starMaterial.uniforms.uTime.value = elapsedSeconds;
      if (group.userData.accretionMaterial) group.userData.accretionMaterial.uniforms.uTime.value = elapsedSeconds;
    }
    updateSpacetimeRipple(bodies, activeExperiment, nowMs, centerM, sceneScale);
    updateCollisionEffects(collisionEffects, nowMs, centerM, sceneScale);
    applyCamera(cameraState);
    renderer.render(scene, camera);
  }

  function project(positionM) {
    if (!lastView) return null;
    const vector = new THREE.Vector3(
      (positionM[0] - lastView.centerM[0]) * lastView.sceneScale,
      (positionM[1] - lastView.centerM[1]) * lastView.sceneScale,
      ((positionM[2] || 0) - (lastView.centerM[2] || 0)) * lastView.sceneScale
    ).project(camera);
    return [
      (vector.x + 1) * .5 * viewportWidth,
      (1 - vector.y) * .5 * viewportHeight,
      vector.z
    ];
  }

  function unprojectToPlane(screenX, screenY, planeZM = 0) {
    if (!lastView) return null;
    const normalized = new THREE.Vector2(
      screenX / viewportWidth * 2 - 1,
      1 - screenY / viewportHeight * 2
    );
    raycaster.setFromCamera(normalized, camera);
    const planeSceneZ = (planeZM - (lastView.centerM[2] || 0)) * lastView.sceneScale;
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeSceneZ), intersection);
    if (!hit) return null;
    return [
      intersection.x / lastView.sceneScale + lastView.centerM[0],
      intersection.y / lastView.sceneScale + lastView.centerM[1],
      planeZM
    ];
  }

  function resize(width, height) {
    viewportWidth = width;
    viewportHeight = height;
    viewportAspect = width / height;
    renderer.setSize(width, height, false);
    camera.aspect = viewportAspect;
    camera.updateProjectionMatrix();
  }

  function setPresentation({ gridOpacity, constellationOpacity: nextConstellationOpacity } = {}) {
    if (Number.isFinite(gridOpacity)) {
      referenceGrid.material.opacity = Math.max(0, Math.min(.6, gridOpacity));
      referenceAxes.material.opacity = Math.max(0, Math.min(.8, gridOpacity * 1.7));
    }
    if (Number.isFinite(nextConstellationOpacity)) {
      constellationOpacity = Math.max(0, Math.min(.3, nextConstellationOpacity));
      if (constellationMaterial) constellationMaterial.opacity = constellationOpacity;
    }
  }

  function setQuality(quality = 'auto') {
    if (!['auto', 'cinematic', 'balanced', 'efficient'].includes(quality)) return resolvedRenderQuality;
    requestedRenderQuality = quality;
    applyRendererQuality();
    clearCollisionGroups();
    disposeSpacetimeRipple();
    if (viewportWidth > 1 && viewportHeight > 1) renderer.setSize(viewportWidth, viewportHeight, false);
    return resolvedRenderQuality;
  }

  return { project, resize, setPresentation, setQuality, unprojectToPlane, update };
}

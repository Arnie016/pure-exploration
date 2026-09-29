import { AU_M, C_M_S, G, NBodySystem, REFERENCE_MASS_KG } from './nbody.js';

const EARTH_RADIUS_M = 6_371_008.4;
const SOLAR_RADIUS_M = 695_700_000;
const JUPITER_MASS_KG = 1.89813e27;
const MAX_DROPPED_ORBITAL_SPEED_MPS = 100_000;

function body({ id, name, type, massKg, radiusM, positionM, velocityMps, color, axialTiltDeg = 0, flags = [] }) {
  return {
    id,
    name,
    type,
    massKg,
    radiusM,
    visualRadiusM: radiusM,
    positionM,
    velocityMps,
    axialTiltRad: axialTiltDeg * Math.PI / 180,
    color,
    provenance: { source: 'deterministic educational preset', id },
    flags: ['preset', 'hypothetical', ...flags]
  };
}

function recenter(records) {
  const massive = records.filter((record) => record.massKg > 0);
  const totalMassKg = massive.reduce((sum, record) => sum + record.massKg, 0);
  if (totalMassKg <= 0) return records;
  const center = [0, 0, 0];
  const velocity = [0, 0, 0];
  for (const record of massive) {
    for (let axis = 0; axis < 3; axis += 1) {
      center[axis] += record.positionM[axis] * record.massKg / totalMassKg;
      velocity[axis] += record.velocityMps[axis] * record.massKg / totalMassKg;
    }
  }
  return records.map((record) => ({
    ...record,
    positionM: record.positionM.map((value, axis) => value - center[axis]),
    velocityMps: record.velocityMps.map((value, axis) => value - velocity[axis])
  }));
}

function circularRecord({ id, name, type = 'planet', hostMassKg, distanceAu, massKg, radiusM, phaseDeg = 0, inclinationDeg = 0, color, axialTiltDeg = 0 }) {
  const distanceM = distanceAu * AU_M;
  const phase = phaseDeg * Math.PI / 180;
  const inclination = inclinationDeg * Math.PI / 180;
  const speed = Math.sqrt(G * (hostMassKg + massKg) / distanceM);
  return body({
    id,
    name,
    type,
    massKg,
    radiusM,
    positionM: [distanceM * Math.cos(phase), distanceM * Math.sin(phase) * Math.cos(inclination), distanceM * Math.sin(phase) * Math.sin(inclination)],
    velocityMps: [-speed * Math.sin(phase), speed * Math.cos(phase) * Math.cos(inclination), speed * Math.cos(phase) * Math.sin(inclination)],
    color,
    axialTiltDeg
  });
}

function system(records, { stepSeconds = 1_800, collisionMode = 'merge' } = {}) {
  return new NBodySystem({ bodies: recenter(records), stepSeconds, collisionMode });
}

function sunRecord(massScale = 1, color = '#ffd08a') {
  return body({
    id: 'sun', name: 'Sun', type: 'star', massKg: REFERENCE_MASS_KG.sun * massScale,
    radiusM: SOLAR_RADIUS_M * Math.max(.45, massScale ** .8), positionM: [0, 0, 0],
    velocityMps: [0, 0, 0], color, axialTiltDeg: 7.25
  });
}

export function createBlankCanvasPreset({ stepSeconds = 1_800 } = {}) {
  return new NBodySystem({ bodies: [], stepSeconds });
}

export function createEqualBinaryPreset({ stepSeconds = 900 } = {}) {
  const massKg = REFERENCE_MASS_KG.sun * .8;
  const separationM = AU_M;
  const speed = Math.sqrt(G * (massKg * 2) / separationM ** 3) * separationM * .5;
  return system([
    body({ id: 'binary-a', name: 'Binary A', type: 'star', massKg, radiusM: SOLAR_RADIUS_M * .82, positionM: [-separationM / 2, 0, 0], velocityMps: [0, -speed, 0], color: '#ffd08a' }),
    body({ id: 'binary-b', name: 'Binary B', type: 'star', massKg, radiusM: SOLAR_RADIUS_M * .82, positionM: [separationM / 2, 0, 0], velocityMps: [0, speed, 0], color: '#ff9c6c' })
  ], { stepSeconds });
}

export function createCompactBinaryInspiralPreset({ stepSeconds = 600 } = {}) {
  const massKg = REFERENCE_MASS_KG.sun * 7;
  const separationM = AU_M * 0.06;
  const orbitalSpeed = Math.sqrt(G * (massKg * 2) / separationM ** 3) * separationM * 0.5;
  const proxyFlags = ['compact-mass-proxy', 'compact-binary-proxy', 'no-general-relativity', 'newtonian-orbit-proxy', 'toy-gw-ripple'];
  return system([
    body({
      id: 'compact-a', name: 'Compact A', type: 'star', massKg, radiusM: 45_000,
      positionM: [-separationM / 2, 0, 0], velocityMps: [0, -orbitalSpeed, 0], color: '#cf95ff',
      flags: proxyFlags, axialTiltDeg: 0
    }),
    body({
      id: 'compact-b', name: 'Compact B', type: 'star', massKg, radiusM: 45_000,
      positionM: [separationM / 2, 0, 0], velocityMps: [0, orbitalSpeed, 0], color: '#ffd08a',
      flags: proxyFlags, axialTiltDeg: 0
    })
  ], { stepSeconds });
}

export function createCircumbinaryPreset({ stepSeconds = 900 } = {}) {
  const stellarMassKg = REFERENCE_MASS_KG.sun * .7;
  const totalMassKg = stellarMassKg * 2;
  const separationM = AU_M * .22;
  const stellarSpeed = Math.sqrt(G * totalMassKg / separationM ** 3) * separationM * .5;
  const planet = circularRecord({ id: 'circumbinary-planet', name: 'Janus', hostMassKg: totalMassKg, distanceAu: 1.05, massKg: REFERENCE_MASS_KG.earth, radiusM: EARTH_RADIUS_M, phaseDeg: 42, inclinationDeg: 3, color: '#6aa9ff', axialTiltDeg: 18 });
  return system([
    body({ id: 'binary-a', name: 'Helios A', type: 'star', massKg: stellarMassKg, radiusM: SOLAR_RADIUS_M * .72, positionM: [-separationM / 2, 0, 0], velocityMps: [0, -stellarSpeed, 0], color: '#ffd08a' }),
    body({ id: 'binary-b', name: 'Helios B', type: 'star', massKg: stellarMassKg, radiusM: SOLAR_RADIUS_M * .72, positionM: [separationM / 2, 0, 0], velocityMps: [0, stellarSpeed, 0], color: '#ffb06c' }),
    planet
  ], { stepSeconds });
}

export function createTiltedSystemPreset({ stepSeconds = 1_800 } = {}) {
  const star = sunRecord();
  return system([
    star,
    circularRecord({ id: 'tilt-one', name: 'Plane 0°', hostMassKg: star.massKg, distanceAu: .58, massKg: REFERENCE_MASS_KG.earth * .4, radiusM: EARTH_RADIUS_M * .72, phaseDeg: 20, inclinationDeg: 0, color: '#d8835f', axialTiltDeg: 8 }),
    circularRecord({ id: 'tilt-two', name: 'Plane 18°', hostMassKg: star.massKg, distanceAu: 1, massKg: REFERENCE_MASS_KG.earth, radiusM: EARTH_RADIUS_M, phaseDeg: 135, inclinationDeg: 18, color: '#6aa9ff', axialTiltDeg: 38 }),
    circularRecord({ id: 'tilt-three', name: 'Plane 35°', hostMassKg: star.massKg, distanceAu: 1.65, massKg: REFERENCE_MASS_KG.earth * 3, radiusM: EARTH_RADIUS_M * 1.35, phaseDeg: 250, inclinationDeg: 35, color: '#8fc7b5', axialTiltDeg: 67 })
  ], { stepSeconds });
}

export function createHotJupiterPreset({ stepSeconds = 300 } = {}) {
  const star = sunRecord(1.05, '#fff0ba');
  return system([
    star,
    circularRecord({ id: 'hot-jupiter', name: 'Cinder', hostMassKg: star.massKg, distanceAu: .047, massKg: JUPITER_MASS_KG, radiusM: 71_492_000, phaseDeg: 28, inclinationDeg: 2, color: '#e3b779', axialTiltDeg: 3 })
  ], { stepSeconds });
}

export function createResonantChainPreset({ stepSeconds = 900 } = {}) {
  const star = sunRecord(.85, '#ffc58d');
  const radii = [.42, .42 * 2 ** (2 / 3), .42 * 2 ** (4 / 3), .42 * 2 ** 2];
  return system([
    star,
    ...radii.map((distanceAu, index) => circularRecord({
      id: `resonant-${index + 1}`, name: `Resonant ${index + 1}`, hostMassKg: star.massKg,
      distanceAu, massKg: REFERENCE_MASS_KG.earth * (.7 + index * .35), radiusM: EARTH_RADIUS_M * (.8 + index * .12),
      phaseDeg: index * 73, inclinationDeg: index * 1.5, color: ['#d8835f', '#efc47f', '#6aa9ff', '#9ac7ba'][index], axialTiltDeg: 8 + index * 9
    }))
  ], { stepSeconds });
}

export function createCometSweepPreset({ stepSeconds = 900 } = {}) {
  const star = sunRecord();
  const aphelionM = 4.8 * AU_M;
  const perihelionM = .28 * AU_M;
  const semiMajorM = (aphelionM + perihelionM) / 2;
  const aphelionSpeed = Math.sqrt(G * star.massKg * (2 / aphelionM - 1 / semiMajorM));
  return system([
    star,
    circularRecord({ id: 'earth', name: 'Earth reference', hostMassKg: star.massKg, distanceAu: 1, massKg: REFERENCE_MASS_KG.earth, radiusM: EARTH_RADIUS_M, phaseDeg: 170, color: '#6aa9ff', axialTiltDeg: 23.44 }),
    body({ id: 'comet', name: 'Comet sweep', type: 'tracer', massKg: 0, radiusM: 2_000, positionM: [aphelionM, 0, 0], velocityMps: [0, aphelionSpeed * Math.cos(.18), aphelionSpeed * Math.sin(.18)], color: '#bdeaff', flags: ['elliptical-orbit', 'massless-tracer'] })
  ], { stepSeconds });
}

export function createWorldCollisionPreset({ stepSeconds = 10 } = {}) {
  const offsetM = EARTH_RADIUS_M * 12;
  const missDistanceM = EARTH_RADIUS_M * .35;
  const approachSpeedMps = 11_000;
  return system([
    body({
      id: 'earth-a', name: 'Earth A', type: 'planet', massKg: REFERENCE_MASS_KG.earth,
      radiusM: EARTH_RADIUS_M, positionM: [-offsetM, -missDistanceM / 2, 0],
      velocityMps: [approachSpeedMps, 0, 0], color: '#6aa9ff', axialTiltDeg: 23.44,
      flags: ['preset:earth-analogue', 'collision-demo']
    }),
    body({
      id: 'earth-b', name: 'Earth B', type: 'planet', massKg: REFERENCE_MASS_KG.earth,
      radiusM: EARTH_RADIUS_M, positionM: [offsetM, missDistanceM / 2, 0],
      velocityMps: [-approachSpeedMps, 0, 0], color: '#78a8e8', axialTiltDeg: -17,
      flags: ['preset:earth-analogue', 'collision-demo']
    })
  ], { stepSeconds, collisionMode: 'merge' });
}

export function createNeutronStarBinaryPreset({ stepSeconds = 600 } = {}) {
  const massKg = REFERENCE_MASS_KG.sun * 1.4;
  const separationM = AU_M * .08;
  const orbitalSpeed = Math.sqrt(G * (massKg * 2) / separationM ** 3) * separationM * .5;
  const proxyFlags = ['neutron-star-proxy', 'compact-mass-proxy', 'newtonian-orbit-proxy'];
  return system([
    body({
      id: 'neutron-a', name: 'Neutron A', type: 'star', massKg,
      radiusM: 12_000, positionM: [-separationM / 2, 0, 0], velocityMps: [0, -orbitalSpeed, 0], color: '#8fd3ff',
      flags: proxyFlags, axialTiltDeg: 12
    }),
    body({
      id: 'neutron-b', name: 'Neutron B', type: 'star', massKg,
      radiusM: 12_000, positionM: [separationM / 2, 0, 0], velocityMps: [0, orbitalSpeed, 0], color: '#7ec7ff',
      flags: proxyFlags, axialTiltDeg: 9
    })
  ], { stepSeconds, collisionMode: 'merge' });
}

export function createMiniGalaxySwirlPreset({ stepSeconds = 1_800 } = {}) {
  const core = body({
    id: 'galactic-core', name: 'Galactic core', type: 'star', massKg: REFERENCE_MASS_KG.sun * 3,
    radiusM: SOLAR_RADIUS_M * 1.8, positionM: [0, 0, 0], velocityMps: [0, 0, 0], color: '#ffd17a',
    axialTiltDeg: 5, flags: ['compact-mass-proxy', 'newtonian-orbit-proxy']
  });
  const masses = [0.42, 0.8, 1.2, 0.75, 0.55];
  const distances = [0.8, 1.05, 1.45, 1.75, 2.05];
  const phases = [14, 118, 238, 302, 48];
  const inclinations = [3, 8, 11, 6, 4];
  const clusterBodies = distances.map((distanceAu, index) => circularRecord({
    id: `swirl-${index + 1}`,
    name: `Swirl body ${index + 1}`,
    hostMassKg: core.massKg,
    distanceAu,
    massKg: REFERENCE_MASS_KG.earth * masses[index],
    radiusM: EARTH_RADIUS_M * (0.5 + 0.2 * index),
    phaseDeg: phases[index],
    inclinationDeg: inclinations[index],
    color: ['#6aa9ff', '#9ac7ba', '#74b9df', '#ffbf66', '#d8835f'][index],
    axialTiltDeg: 10 * index
  }));
  return system([
    core,
    ...clusterBodies
  ], { stepSeconds });
}

export function createBlackHoleLensingPreset({ stepSeconds = 10 } = {}) {
  const massKg = REFERENCE_MASS_KG.sun * 10;
  const schwarzschildRadiusM = 2 * G * massKg / C_M_S ** 2;
  return system([
    body({
      id: 'black-hole', name: 'Black hole', type: 'star', massKg,
      radiusM: schwarzschildRadiusM, positionM: [0, 0, 0], velocityMps: [0, 0, 0],
      color: '#050608', flags: ['preset:black-hole', 'black-hole', 'schwarzschild-radius', 'newtonian-orbit-proxy']
    })
  ], { stepSeconds, collisionMode: 'merge' });
}

export function createLagrangeTrianglePreset({ stepSeconds = 1_800 } = {}) {
  const massKg = REFERENCE_MASS_KG.sun * .45;
  const radiusM = AU_M * .75;
  const omega = Math.sqrt(G * massKg / (Math.sqrt(3) * radiusM ** 3));
  return system([0, 1, 2].map((index) => {
    const phase = index * Math.PI * 2 / 3;
    return body({
      id: `triangle-${index + 1}`, name: `Triangle ${index + 1}`, type: 'star', massKg,
      radiusM: SOLAR_RADIUS_M * .52, positionM: [Math.cos(phase) * radiusM, Math.sin(phase) * radiusM, 0],
      velocityMps: [-Math.sin(phase) * omega * radiusM, Math.cos(phase) * omega * radiusM, 0],
      color: ['#ffd08a', '#ff9c6c', '#fff0ba'][index]
    });
  }), { stepSeconds });
}

export const OBJECT_PRESETS = Object.freeze({
  'sun-like': { name: 'Sun-like star', type: 'star', massKg: REFERENCE_MASS_KG.sun, radiusM: SOLAR_RADIUS_M, color: '#ffd08a', axialTiltDeg: 7.25, role: '1.00 M☉ · yellow dwarf' },
  'red-dwarf': { name: 'Red dwarf', type: 'star', massKg: REFERENCE_MASS_KG.sun * .2, radiusM: SOLAR_RADIUS_M * .25, color: '#ff8065', axialTiltDeg: 12, role: '0.20 M☉ · long lived' },
  'blue-star': { name: 'Blue star', type: 'star', massKg: REFERENCE_MASS_KG.sun * 6, radiusM: SOLAR_RADIUS_M * 3.4, color: '#a8cfff', axialTiltDeg: 18, role: '6.0 M☉ · Newtonian only' },
  'white-dwarf': { name: 'White dwarf', type: 'star', massKg: REFERENCE_MASS_KG.sun * .7, radiusM: EARTH_RADIUS_M * 1.15, color: '#eef5ff', axialTiltDeg: 8, role: 'compact mass · no GR' },
  'earth-analogue': { name: 'Earth analogue', type: 'planet', massKg: REFERENCE_MASS_KG.earth, radiusM: EARTH_RADIUS_M, color: '#6aa9ff', axialTiltDeg: 23.44, role: '1.00 M⊕ · rocky' },
  'mars-like': { name: 'Mars-like world', type: 'planet', massKg: REFERENCE_MASS_KG.earth * .107, radiusM: 3_389_500, color: '#d8835f', axialTiltDeg: 25.2, role: '0.107 M⊕ · rocky' },
  'gas-giant': { name: 'Gas giant', type: 'planet', massKg: JUPITER_MASS_KG, radiusM: 71_492_000, color: '#e3b779', axialTiltDeg: 3.1, role: '1.00 MJ · giant' },
  'ice-giant': { name: 'Ice giant', type: 'planet', massKg: 1.02413e26, radiusM: 24_622_000, color: '#74b9df', axialTiltDeg: 28.3, role: 'Neptune class' },
  'super-earth': { name: 'Super-Earth', type: 'planet', massKg: REFERENCE_MASS_KG.earth * 5, radiusM: EARTH_RADIUS_M * 1.55, color: '#9ac7ba', axialTiltDeg: 32, role: '5.0 M⊕ · hypothetical' },
  'moon': { name: 'Rocky moon', type: 'moon', massKg: REFERENCE_MASS_KG.moon, radiusM: 1_737_400, color: '#d9d8d2', axialTiltDeg: 6.68, role: '1 lunar mass' },
  'comet': {
    name: 'Comet tracer',
    type: 'tracer',
    massKg: 0,
    radiusM: 2_000,
    color: '#bdeaff',
    axialTiltDeg: 0,
    role: 'massless gravity probe',
    flags: ['no-collision']
  },
  'rocket-probe': {
    name: 'Rocket probe',
    type: 'tracer',
    massKg: 0,
    radiusM: 1_200_000,
    color: '#9be8ff',
    axialTiltDeg: 0,
    role: 'massless launchable probe · n-body tracer',
    flags: ['no-collision']
  },
  'collision-pulse': {
    name: 'Collision pulse', type: 'tracer', massKg: 0, radiusM: 25_000_000,
    color: '#ffbf66', axialTiltDeg: 0,
    role: 'explosion marker · free placement · event timing',
    flags: ['free-placement', 'event-marker', 'massless-event', 'no-collision']
  },
  'vehicle-car': {
    name: 'Vehicle car', type: 'tracer', massKg: 1_250, radiusM: 1_500, color: '#9da7ff',
    axialTiltDeg: 0, role: 'everyday object · mass 1.25 t',
    flags: ['free-placement', 'earth-scale-object']
  },
  'vehicle-satellite': {
    name: 'Satellite', type: 'tracer', massKg: 4_800, radiusM: 900_000, color: '#a8ebff',
    axialTiltDeg: 0, role: 'everyday object · low-mass probe',
    flags: ['free-placement', 'earth-scale-object']
  },
  'vehicle-rocketcraft': {
    name: 'Rocketcraft', type: 'tracer', massKg: 3_200, radiusM: 1_800_000, color: '#b6ecff',
    axialTiltDeg: 0, role: 'everyday-scale craft · 3.2 t',
    flags: ['free-placement', 'earth-scale-object']
  },
  'vehicle-asteroid': {
    name: 'Asteroid fragment', type: 'tracer', massKg: 5e12, radiusM: 40_000, color: '#c2b49a',
    axialTiltDeg: 0, role: 'compact fragment · collision demo',
    flags: ['free-placement', 'earth-scale-object']
  },
  'neutron-star': {
    name: 'Neutron star', type: 'star', massKg: REFERENCE_MASS_KG.sun * 1.4, radiusM: 12_000,
    color: '#f0fbff', axialTiltDeg: 0, role: '1.4 M☉ · compact remnant',
    flags: ['neutron-star-proxy', 'newtonian-orbit-proxy', 'compact-mass-proxy']
  },
  'space-station': {
    name: 'Space station', type: 'planet', massKg: 4.2e5, radiusM: 120_000,
    color: '#f6f7bf', axialTiltDeg: 0, role: 'small station · 420 t',
    flags: ['free-placement', 'earth-scale-object']
  },
  'black-hole': {
    name: 'Black hole', type: 'star', massKg: REFERENCE_MASS_KG.sun * 10,
    radiusM: 2 * G * REFERENCE_MASS_KG.sun * 10 / C_M_S ** 2,
    color: '#050608', axialTiltDeg: 0, role: '10 M☉ · Schwarzschild light lab',
    flags: ['black-hole', 'schwarzschild-radius', 'newtonian-orbit-proxy']
  },
  'compact-mass': { name: 'Compact mass proxy', type: 'star', massKg: REFERENCE_MASS_KG.sun * 5, radiusM: 30_000, color: '#b49cff', axialTiltDeg: 0, role: 'Newtonian proxy · not a black hole' }
});

export function minimumDropSeparationM(presetId, host) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown content preset: ${presetId}`);
  if (!host) return 0;
  const physicalClearanceM = host.radiusM + preset.radiusM;
  if (host.type === 'star' && preset.type === 'star') return Math.max(physicalClearanceM, AU_M * .12);
  if (host.type === 'star' && (preset.type === 'planet' || preset.type === 'moon')) return Math.max(physicalClearanceM, AU_M * .06);
  if (host.type === 'planet' && preset.type === 'moon') return Math.max(physicalClearanceM, host.radiusM * 6);
  return Math.max(physicalClearanceM, host.radiusM * 3);
}

export function droppedBodyRecord(
  presetId,
  { id, positionM, host = null, existingBodies = [] } = {}
) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown content preset: ${presetId}`);
  const bodyList = Array.isArray(existingBodies) ? existingBodies : [];
  const isFreePlacement = preset.flags?.includes('free-placement');
  const flagsForRecord = [];
  const velocityMps = [0, 0, 0];
  const dropPositionM = [...(positionM || [0, 0, 0])];
  const shouldComputeTangentialOrbit = host && host.massKg > 0 && !isFreePlacement;
  if (shouldComputeTangentialOrbit) {
    velocityMps[0] = host.velocityMps[0];
    velocityMps[1] = host.velocityMps[1];
    velocityMps[2] = host.velocityMps[2];
    const safeHostDistanceM = G * (host.massKg + preset.massKg) / (MAX_DROPPED_ORBITAL_SPEED_MPS ** 2);
    let dx = dropPositionM[0] - host.positionM[0];
    let dy = dropPositionM[1] - host.positionM[1];
    let dz = dropPositionM[2] - host.positionM[2];
    let distanceM = Math.hypot(dx, dy, dz);
    const minimumDistanceM = minimumDropSeparationM(presetId, host);
    if (distanceM < minimumDistanceM) {
      const readableDistance = host.type === 'star'
        ? `${(minimumDistanceM / AU_M).toFixed(3)} AU`
        : `${Math.round(minimumDistanceM / 1000).toLocaleString()} km`;
      throw new RangeError(`Place ${preset.name} at least ${readableDistance} from ${host.name}; the center zone is intentionally blocked.`);
    }
    if (!Number.isFinite(distanceM) || distanceM <= 0) {
      throw new RangeError(`Invalid placement: ${preset.name} must be offset from ${host.name} to compute initial velocity.`);
    }
    const cappedDistanceM = Math.max(minimumDistanceM, safeHostDistanceM, distanceM);
    if (cappedDistanceM !== distanceM) {
      const correctionScale = cappedDistanceM / distanceM;
      dropPositionM[0] += dx * (correctionScale - 1);
      dropPositionM[1] += dy * (correctionScale - 1);
      dropPositionM[2] += dz * (correctionScale - 1);
      dx *= correctionScale;
      dy *= correctionScale;
      dz *= correctionScale;
      distanceM = cappedDistanceM;
      flagsForRecord.push('initial-velocity-capped');
    }
    const rawSpeed = Math.sqrt(G * (host.massKg + preset.massKg) / distanceM);
    if (rawSpeed > MAX_DROPPED_ORBITAL_SPEED_MPS && !flagsForRecord.includes('initial-velocity-capped')) {
      flagsForRecord.push('initial-velocity-capped');
    }
    const clampedSpeed = Math.min(rawSpeed, MAX_DROPPED_ORBITAL_SPEED_MPS);
    const radialUnit = [dx / distanceM, dy / distanceM, dz / distanceM];

    const candidates = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];
    let tangent = null;
    for (const axis of candidates) {
      const cross = [
        axis[1] * radialUnit[2] - axis[2] * radialUnit[1],
        axis[2] * radialUnit[0] - axis[0] * radialUnit[2],
        axis[0] * radialUnit[1] - axis[1] * radialUnit[0]
      ];
      const tangentLength = Math.hypot(...cross);
      if (tangentLength >= 1e-12) {
        tangent = cross.map((axisValue) => axisValue / tangentLength);
        break;
      }
    }
    if (!tangent) {
      tangent = [1, 0, 0];
    }
    velocityMps[0] += tangent[0] * clampedSpeed;
    velocityMps[1] += tangent[1] * clampedSpeed;
    velocityMps[2] += tangent[2] * clampedSpeed;
    if (rawSpeed > clampedSpeed) {
      flagsForRecord.push('initial-velocity-capped');
    }
  }
  if (host && host.massKg > 0 && isFreePlacement && preset.massKg > 0) {
    const dx = positionM[0] - host.positionM[0];
    const dy = positionM[1] - host.positionM[1];
    const dz = positionM[2] - host.positionM[2];
    const distanceM = Math.hypot(dx, dy, dz);
    const minimumDistanceM = minimumDropSeparationM(presetId, host);
    if (distanceM < minimumDistanceM) {
      const readableDistance = host.type === 'star'
        ? `${(minimumDistanceM / AU_M).toFixed(3)} AU`
        : `${Math.round(minimumDistanceM / 1000).toLocaleString()} km`;
      throw new RangeError(`Place ${preset.name} at least ${readableDistance} from ${host.name}; the center zone is intentionally blocked.`);
    }
  }
  if (!isFreePlacement || preset.massKg > 0) {
    for (const candidate of bodyList) {
      if (!candidate || candidate.id === id) continue;
      if (candidate.id === host?.id) continue;
      if (!candidate.massKg && !preset.massKg) continue;
      const dx = positionM[0] - candidate.positionM[0];
      const dy = positionM[1] - candidate.positionM[1];
      const dz = positionM[2] - candidate.positionM[2];
      const distanceM = Math.hypot(dx, dy, dz);
      const minimumDistanceM = minimumDropSeparationM(presetId, candidate);
      if (distanceM < minimumDistanceM) {
        const readableDistance = candidate.type === 'star'
          ? `${(minimumDistanceM / AU_M).toFixed(3)} AU`
          : `${Math.round(minimumDistanceM / 1000).toLocaleString()} km`;
        throw new RangeError(`Place ${preset.name} at least ${readableDistance} from ${candidate.name}; bodies are currently too close.`);
      }
    }
  }
  return body({
    id, name: `${preset.name} ${id.split('-').at(-1)}`, type: preset.type, massKg: preset.massKg,
    radiusM: preset.radiusM, positionM: dropPositionM, velocityMps, color: preset.color, axialTiltDeg: preset.axialTiltDeg,
    flags: [
      ...flagsForRecord,
      'content-drawer-drop',
      ...(host && host.massKg > 0 ? ['computed-circular-initial-velocity'] : []),
      `preset:${presetId}`,
      ...(preset.flags || [])
    ]
  });
}

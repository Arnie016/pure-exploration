export const G = 6.67430e-11;
export const AU_M = 149_597_870_700;
export const DAY_S = 86_400;
export const JULIAN_YEAR_S = 365.25 * DAY_S;
export const C_M_S = 299_792_458;

// JPL DE440 mass parameters. Planet values are converted from km^3/s^2.
export const GM = Object.freeze({
  sun: 1.3271244004127942e20,
  earth: 398_600.435507e9,
  moon: 4_902.800118e9
});

export const REFERENCE_MASS_KG = Object.freeze({
  sun: GM.sun / G,
  earth: GM.earth / G,
  moon: GM.moon / G
});

const DEFAULT_RADII_M = Object.freeze({
  star: 696_340_000,
  planet: 6_371_008.4,
  moon: 1_737_400,
  tracer: 1
});

const BODY_TYPES = new Set(['star', 'planet', 'moon', 'tracer']);

function vector3(value, label) {
  if (!value || value.length !== 3) throw new TypeError(`${label} must contain three numbers`);
  const vector = Float64Array.from(value);
  if (![...vector].every(Number.isFinite)) throw new TypeError(`${label} must contain finite numbers`);
  return vector;
}

function magnitude(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function addScaled(target, vector, scale) {
  target[0] += vector[0] * scale;
  target[1] += vector[1] * scale;
  target[2] += vector[2] * scale;
}

function copyBody(body) {
  const snapshot = {
    ...body,
    positionM: new Float64Array(body.positionM),
    velocityMps: new Float64Array(body.velocityMps),
    provenance: body.provenance ? { ...body.provenance } : null,
    flags: [...(body.flags || [])]
  };
  if (Number.isFinite(body.placementProtectionFrames)) {
    snapshot.placementProtectionFrames = body.placementProtectionFrames;
  }
  return snapshot;
}

function publicBody(body) {
  return {
    id: body.id,
    name: body.name,
    type: body.type,
    massKg: body.massKg,
    radiusM: body.radiusM,
    visualRadiusM: body.visualRadiusM,
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    axialTiltRad: body.axialTiltRad,
    color: body.color,
    provenance: body.provenance ? { ...body.provenance } : null,
    flags: [...body.flags]
  };
}

function validateBody(input) {
  const id = String(input.id || '').trim();
  if (!id) throw new TypeError('Body id is required');
  const type = input.type || 'planet';
  if (!BODY_TYPES.has(type)) throw new RangeError(`Unsupported body type: ${type}`);
  const massKg = Number(input.massKg ?? 0);
  const radiusM = Number(input.radiusM ?? DEFAULT_RADII_M[type]);
  const visualRadiusM = Number(input.visualRadiusM ?? radiusM);
  const axialTiltRad = Number(input.axialTiltRad ?? 0);
  if (!Number.isFinite(massKg) || massKg < 0) throw new RangeError('Body mass must be finite and non-negative');
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError('Body radius must be finite and positive');
  if (!Number.isFinite(visualRadiusM) || visualRadiusM <= 0) throw new RangeError('Visual radius must be finite and positive');
  if (!Number.isFinite(axialTiltRad)) throw new RangeError('Axial tilt must be finite');
  return {
    id,
    name: String(input.name || id),
    type,
    massKg,
    radiusM,
    visualRadiusM,
    positionM: vector3(input.positionM || [0, 0, 0], 'Body position'),
    velocityMps: vector3(input.velocityMps || [0, 0, 0], 'Body velocity'),
    axialTiltRad,
    color: input.color || '#ffffff',
    provenance: input.provenance ? { ...input.provenance } : null,
    flags: [...(input.flags || [])]
  };
}

export function computeAccelerations(
  bodies,
  positions = bodies.map((body) => body.positionM),
  { uniformDensityKgM3 = 0, uniformDensityOriginM = [0, 0, 0] } = {}
) {
  const accelerations = bodies.map(() => new Float64Array(3));
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const dx = positions[j][0] - positions[i][0];
      const dy = positions[j][1] - positions[i][1];
      const dz = positions[j][2] - positions[i][2];
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared === 0) continue;
      const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
      const common = G * inverseDistanceCubed;
      if (bodies[j].massKg > 0) {
        const scale = common * bodies[j].massKg;
        accelerations[i][0] += dx * scale;
        accelerations[i][1] += dy * scale;
        accelerations[i][2] += dz * scale;
      }
      if (bodies[i].massKg > 0) {
        const scale = common * bodies[i].massKg;
        accelerations[j][0] -= dx * scale;
        accelerations[j][1] -= dy * scale;
        accelerations[j][2] -= dz * scale;
      }
    }
  }
  if (uniformDensityKgM3 > 0) {
    const coefficient = -4 * Math.PI * G * uniformDensityKgM3 / 3;
    for (let index = 0; index < bodies.length; index += 1) {
      accelerations[index][0] += coefficient * (positions[index][0] - uniformDensityOriginM[0]);
      accelerations[index][1] += coefficient * (positions[index][1] - uniformDensityOriginM[1]);
      accelerations[index][2] += coefficient * (positions[index][2] - uniformDensityOriginM[2]);
    }
  }
  return accelerations;
}

export function diagnosticsFor(
  bodies,
  { uniformDensityKgM3 = 0, uniformDensityOriginM = [0, 0, 0] } = {}
) {
  let totalMassKg = 0;
  let kineticJ = 0;
  let potentialJ = 0;
  const weightedPosition = new Float64Array(3);
  const momentum = new Float64Array(3);
  const angularMomentum = new Float64Array(3);

  for (const body of bodies) {
    if (body.massKg <= 0) continue;
    totalMassKg += body.massKg;
    addScaled(weightedPosition, body.positionM, body.massKg);
    addScaled(momentum, body.velocityMps, body.massKg);
    const speed = magnitude(body.velocityMps);
    kineticJ += 0.5 * body.massKg * speed * speed;
    const bodyAngularMomentum = cross(body.positionM, body.velocityMps);
    addScaled(angularMomentum, bodyAngularMomentum, body.massKg);
    if (uniformDensityKgM3 > 0) {
      const dx = body.positionM[0] - uniformDensityOriginM[0];
      const dy = body.positionM[1] - uniformDensityOriginM[1];
      const dz = body.positionM[2] - uniformDensityOriginM[2];
      const harmonicCoefficient = 4 * Math.PI * G * uniformDensityKgM3 / 3;
      potentialJ += 0.5 * body.massKg * harmonicCoefficient * (dx * dx + dy * dy + dz * dz);
    }
  }

  for (let i = 0; i < bodies.length; i += 1) {
    if (bodies[i].massKg <= 0) continue;
    for (let j = i + 1; j < bodies.length; j += 1) {
      if (bodies[j].massKg <= 0) continue;
      const distance = Math.hypot(
        bodies[j].positionM[0] - bodies[i].positionM[0],
        bodies[j].positionM[1] - bodies[i].positionM[1],
        bodies[j].positionM[2] - bodies[i].positionM[2]
      );
      if (distance > 0) potentialJ -= G * bodies[i].massKg * bodies[j].massKg / distance;
    }
  }

  const barycenterM = totalMassKg > 0
    ? [...weightedPosition].map((value) => value / totalMassKg)
    : [0, 0, 0];

  return {
    totalMassKg,
    barycenterM,
    momentumKgMps: [...momentum],
    momentumMagnitudeKgMps: magnitude(momentum),
    angularMomentumKgM2ps: [...angularMomentum],
    angularMomentumMagnitudeKgM2ps: magnitude(angularMomentum),
    kineticJ,
    potentialJ,
    totalEnergyJ: kineticJ + potentialJ
  };
}

export function barycenterOf(bodies) {
  return diagnosticsFor(bodies).barycenterM;
}

export class NBodySystem {
  constructor({
    bodies = [],
    stepSeconds = 3_600,
    collisionMode = 'merge',
    uniformDensityKgM3 = 0,
    uniformDensityOriginM = [0, 0, 0]
  } = {}) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) throw new RangeError('Step duration must be positive');
    if (!['merge', 'none'].includes(collisionMode)) throw new RangeError(`Unsupported collision mode: ${collisionMode}`);
    if (!Number.isFinite(uniformDensityKgM3) || uniformDensityKgM3 < 0) throw new RangeError('Uniform density must be finite and non-negative');
    this.stepSeconds = stepSeconds;
    this.collisionMode = collisionMode;
    this.uniformDensityKgM3 = uniformDensityKgM3;
    this.uniformDensityOriginM = vector3(uniformDensityOriginM, 'Uniform-density origin');
    this.timeSeconds = 0;
    this.revision = 0;
    this.bodies = [];
    this.events = [];
    for (const body of bodies) this.addBody(body, { recordEvent: false });
    this.initialState = this.bodies.map(copyBody);
    this.initialDiagnostics = diagnosticsFor(this.bodies, this.fieldOptions());
  }

  fieldOptions() {
    return {
      uniformDensityKgM3: this.uniformDensityKgM3,
      uniformDensityOriginM: this.uniformDensityOriginM
    };
  }

  body(id) {
    return this.bodies.find((candidate) => candidate.id === id) || null;
  }

  addBody(input, { recordEvent = true } = {}) {
    const body = validateBody(input);
    body.placementProtectionFrames = Math.max(0, Number(input.placementProtectionFrames || 0));
    if (!Number.isFinite(body.placementProtectionFrames)) body.placementProtectionFrames = 0;
    if (this.body(body.id)) throw new Error(`Body id already exists: ${body.id}`);
    this.bodies.push(body);
    if (recordEvent) this.recordEvent('body.spawned', { bodyId: body.id, type: body.type });
    return publicBody(body);
  }

  spawnCircular({
    id,
    name,
    type = 'planet',
    hostId,
    distanceM,
    massKg = type === 'tracer' ? 0 : REFERENCE_MASS_KG.earth,
    radiusM = DEFAULT_RADII_M[type],
    phaseRad = 0,
    inclinationRad = 0,
    clockwise = false,
    axialTiltRad = 0,
    color = '#8cb8ff',
    provenance = null
  }) {
    const host = this.body(hostId);
    if (!host || host.massKg <= 0) throw new Error(`Massive host not found: ${hostId}`);
    if (!Number.isFinite(distanceM) || distanceM <= host.radiusM + radiusM) {
      throw new RangeError('Spawn distance must place the new body outside the host');
    }
    const direction = clockwise ? -1 : 1;
    const cosPhase = Math.cos(phaseRad);
    const sinPhase = Math.sin(phaseRad);
    const cosInclination = Math.cos(inclinationRad);
    const sinInclination = Math.sin(inclinationRad);
    const relativePosition = [
      distanceM * cosPhase,
      distanceM * sinPhase * cosInclination,
      distanceM * sinPhase * sinInclination
    ];
    const speed = Math.sqrt(G * (host.massKg + massKg) / distanceM);
    const relativeVelocity = [
      -direction * speed * sinPhase,
      direction * speed * cosPhase * cosInclination,
      direction * speed * cosPhase * sinInclination
    ];
    return this.addBody({
      id,
      name,
      type,
      massKg,
      radiusM,
      positionM: relativePosition.map((value, index) => host.positionM[index] + value),
      velocityMps: relativeVelocity.map((value, index) => host.velocityMps[index] + value),
      axialTiltRad,
      color,
      provenance,
      flags: ['spawned']
    });
  }

  editBody(id, changes) {
    const body = this.body(id);
    if (!body) throw new Error(`Body not found: ${id}`);
    // Validate the complete edit before assigning any field. A failed velocity
    // or position must not leave an earlier mass/radius edit half-applied.
    const next = {};
    if ('massKg' in changes) {
      const massKg = Number(changes.massKg);
      if (!Number.isFinite(massKg) || massKg < 0) throw new RangeError('Body mass must be finite and non-negative');
      next.massKg = massKg;
    }
    if ('radiusM' in changes) {
      const radiusM = Number(changes.radiusM);
      if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError('Body radius must be finite and positive');
      next.radiusM = radiusM;
      next.visualRadiusM = radiusM;
    }
    if ('axialTiltRad' in changes) {
      const axialTiltRad = Number(changes.axialTiltRad);
      if (!Number.isFinite(axialTiltRad)) throw new RangeError('Axial tilt must be finite');
      next.axialTiltRad = axialTiltRad;
    }
    if ('positionM' in changes) next.positionM = vector3(changes.positionM, 'Body position');
    if ('velocityMps' in changes) next.velocityMps = vector3(changes.velocityMps, 'Body velocity');
    Object.assign(body, next);
    this.recordEvent('body.edited', { bodyId: id, fields: Object.keys(changes) });
    return publicBody(body);
  }

  removeBody(id) {
    const index = this.bodies.findIndex((body) => body.id === id);
    if (index < 0) return false;
    this.bodies.splice(index, 1);
    this.recordEvent('body.removed', { bodyId: id });
    return true;
  }

  reset() {
    this.bodies = this.initialState.map(copyBody);
    this.timeSeconds = 0;
    this.revision += 1;
    this.events = [];
    this.initialDiagnostics = diagnosticsFor(this.bodies, this.fieldOptions());
    this.recordEvent('system.reset', {});
    return this.snapshot();
  }

  rebaseline(reason = 'manual-edit') {
    this.initialDiagnostics = diagnosticsFor(this.bodies, this.fieldOptions());
    this.recordEvent('system.rebaselined', { reason });
    return this.snapshot();
  }

  setUniformDensity(densityKgM3, originM = this.uniformDensityOriginM) {
    const density = Number(densityKgM3);
    if (!Number.isFinite(density) || density < 0) throw new RangeError('Uniform density must be finite and non-negative');
    this.uniformDensityKgM3 = density;
    this.uniformDensityOriginM = vector3(originM, 'Uniform-density origin');
    this.rebaseline('uniform-density-change');
    this.recordEvent('field.uniform-density', { densityKgM3: density });
    return this.snapshot();
  }

  recordEvent(type, detail) {
    this.events.push({ revision: this.revision, timeSeconds: this.timeSeconds, type, ...detail });
    if (this.events.length > 32) this.events.shift();
  }

  resolveCollisions() {
    if (this.collisionMode !== 'merge') return;
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < this.bodies.length; i += 1) {
        for (let j = i + 1; j < this.bodies.length; j += 1) {
          const a = this.bodies[i];
          const b = this.bodies[j];
          const aProtected = Number.isFinite(a.placementProtectionFrames) && a.placementProtectionFrames > 0;
          const bProtected = Number.isFinite(b.placementProtectionFrames) && b.placementProtectionFrames > 0;
          if (aProtected || bProtected) continue;
          const isMasslessBody = a.massKg <= 0 || b.massKg <= 0;
          const isMarkerBody = (a.flags || []).includes('no-collision')
            || (b.flags || []).includes('no-collision');
          if (isMasslessBody || isMarkerBody) continue;
          const separation = Math.hypot(
            b.positionM[0] - a.positionM[0],
            b.positionM[1] - a.positionM[1],
            b.positionM[2] - a.positionM[2]
          );
          if (separation > a.radiusM + b.radiusM) continue;
          const separationVectorM = Array.from(b.positionM, (value, axis) => value - a.positionM[axis]);
          const impactPositionM = Array.from(a.positionM, (value, axis) => (value + b.positionM[axis]) * .5);
          const relativeVelocityMps = Array.from(b.velocityMps, (value, axis) => value - a.velocityMps[axis]);
          const relativeSpeedMps = Math.hypot(...relativeVelocityMps);
          const impactNormal = separation > Number.EPSILON
            ? separationVectorM.map((value) => value / separation)
            : relativeSpeedMps > Number.EPSILON
              ? relativeVelocityMps.map((value) => value / relativeSpeedMps)
              : [1, 0, 0];
          const totalMass = a.massKg + b.massKg;
          const reducedMassKg = totalMass > 0 ? a.massKg * b.massKg / totalMass : 0;
          const impactEnergyJ = .5 * reducedMassKg * relativeSpeedMps ** 2;
          const centerOfMassVelocityMps = totalMass > 0
            ? Array.from(a.velocityMps, (value, axis) => (value * a.massKg + b.velocityMps[axis] * b.massKg) / totalMass)
            : [0, 0, 0];
          const preImpact = [a, b].map((body) => ({
            id: body.id,
            name: body.name,
            type: body.type,
            massKg: body.massKg,
            radiusM: body.radiusM,
            positionM: [...body.positionM],
            velocityMps: [...body.velocityMps]
          }));
          const survivor = a.massKg >= b.massKg ? a : b;
          const absorbed = survivor === a ? b : a;
          if (totalMass > 0) {
            for (let axis = 0; axis < 3; axis += 1) {
              survivor.positionM[axis] = (a.positionM[axis] * a.massKg + b.positionM[axis] * b.massKg) / totalMass;
              survivor.velocityMps[axis] = (a.velocityMps[axis] * a.massKg + b.velocityMps[axis] * b.massKg) / totalMass;
            }
          }
          survivor.massKg = totalMass;
          survivor.radiusM = Math.cbrt(a.radiusM ** 3 + b.radiusM ** 3);
          survivor.visualRadiusM = Math.max(a.visualRadiusM, b.visualRadiusM);
          survivor.flags = [...new Set([...a.flags, ...b.flags, 'merged'])];
          this.bodies.splice(this.bodies.indexOf(absorbed), 1);
          this.recordEvent('collision.merged', {
            survivorId: survivor.id,
            absorbedId: absorbed.id,
            impactPositionM,
            impactNormal,
            relativeVelocityMps,
            relativeSpeedMps,
            centerOfMassVelocityMps,
            reducedMassKg,
            impactEnergyJ,
            totalMassKg: totalMass,
            preImpact,
            presentation: 'illustrative-debris-only'
          });
          merged = true;
          break outer;
        }
      }
    }
  }

  step(count = 1) {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Step count must be a non-negative integer');
    const dt = this.stepSeconds;
    for (let iteration = 0; iteration < count; iteration += 1) {
      const accelerationStart = computeAccelerations(this.bodies, undefined, this.fieldOptions());
      for (let i = 0; i < this.bodies.length; i += 1) {
        addScaled(this.bodies[i].velocityMps, accelerationStart[i], dt * 0.5);
        addScaled(this.bodies[i].positionM, this.bodies[i].velocityMps, dt);
      }
      this.resolveCollisions();
      const accelerationEnd = computeAccelerations(this.bodies, undefined, this.fieldOptions());
      for (let i = 0; i < this.bodies.length; i += 1) {
        addScaled(this.bodies[i].velocityMps, accelerationEnd[i], dt * 0.5);
      }
      for (const body of this.bodies) {
        if (Number.isFinite(body.placementProtectionFrames) && body.placementProtectionFrames > 0) {
          body.placementProtectionFrames -= 1;
        }
      }
      this.timeSeconds += dt;
      this.revision += 1;
    }
    return this.snapshot();
  }

  diagnostics() {
    const current = diagnosticsFor(this.bodies, this.fieldOptions());
    const initialEnergy = this.initialDiagnostics.totalEnergyJ;
    const initialAngularMomentum = this.initialDiagnostics.angularMomentumMagnitudeKgM2ps;
    return {
      ...current,
      relativeEnergyDrift: initialEnergy === 0 ? 0 : (current.totalEnergyJ - initialEnergy) / Math.abs(initialEnergy),
      relativeAngularMomentumDrift: initialAngularMomentum === 0
        ? 0
        : (current.angularMomentumMagnitudeKgM2ps - initialAngularMomentum) / initialAngularMomentum
    };
  }

  barycenter(ids = null) {
    const selected = ids ? ids.map((id) => this.body(id)).filter(Boolean) : this.bodies;
    return barycenterOf(selected);
  }

  relativeOrbit(primaryId, secondaryId) {
    const primary = this.body(primaryId);
    const secondary = this.body(secondaryId);
    if (!primary || !secondary) throw new Error('Both orbit bodies are required');
    const relativePosition = secondary.positionM.map((value, axis) => value - primary.positionM[axis]);
    const relativeVelocity = secondary.velocityMps.map((value, axis) => value - primary.velocityMps[axis]);
    const distanceM = magnitude(relativePosition);
    if (distanceM === 0) throw new RangeError('Orbit is undefined at zero separation');
    const speedMps = magnitude(relativeVelocity);
    const mu = G * (primary.massKg + secondary.massKg);
    if (mu <= 0) throw new RangeError('Orbit requires at least one massive body');
    const specificEnergy = speedMps * speedMps * 0.5 - mu / distanceM;
    const semiMajorAxisM = specificEnergy < 0 ? -mu / (2 * specificEnergy) : Infinity;
    const periodSeconds = Number.isFinite(semiMajorAxisM)
      ? 2 * Math.PI * Math.sqrt(semiMajorAxisM ** 3 / mu)
      : Infinity;
    const angularMomentumM2ps = cross(relativePosition, relativeVelocity);
    const angularMomentumMagnitudeM2ps = magnitude(angularMomentumM2ps);
    const velocityCrossMomentum = cross(relativeVelocity, angularMomentumM2ps);
    const eccentricityVector = velocityCrossMomentum.map((value, axis) => value / mu - relativePosition[axis] / distanceM);
    const eccentricity = magnitude(eccentricityVector);
    const semiLatusRectumM = angularMomentumMagnitudeM2ps ** 2 / mu;
    const periapsisM = semiLatusRectumM / (1 + eccentricity);
    const apoapsisM = eccentricity < 1 ? semiLatusRectumM / (1 - eccentricity) : Infinity;
    const inclinationRad = angularMomentumMagnitudeM2ps > 0
      ? Math.acos(Math.max(-1, Math.min(1, angularMomentumM2ps[2] / angularMomentumMagnitudeM2ps)))
      : 0;
    return {
      distanceM,
      speedMps,
      barycenterM: this.barycenter([primaryId, secondaryId]),
      semiMajorAxisM,
      periodSeconds,
      eccentricity,
      eccentricityVector,
      periapsisM,
      apoapsisM,
      inclinationRad,
      angularMomentumM2ps,
      orbitType: eccentricity < 1 - 1e-9 ? 'elliptic' : eccentricity <= 1 + 1e-9 ? 'parabolic' : 'hyperbolic'
    };
  }

  snapshot() {
    return {
      version: 1,
      fidelity: 'computed',
      integrator: 'velocity-verlet',
      timeSeconds: this.timeSeconds,
      stepSeconds: this.stepSeconds,
      revision: this.revision,
      bodies: this.bodies.map(publicBody),
      diagnostics: this.diagnostics(),
      events: this.events.map((event) => ({ ...event })),
      fields: {
        uniformDensityKgM3: this.uniformDensityKgM3,
        uniformDensityOriginM: [...this.uniformDensityOriginM]
      },
      caveat: 'Newtonian point-mass gravity with spherical merge collisions; tides, relativity, atmospheres, and material deformation are omitted.'
    };
  }
}

export function createSunEarthMoonPreset({ stepSeconds = 3_600, collisionMode = 'merge' } = {}) {
  const sunMass = REFERENCE_MASS_KG.sun;
  const earthMass = REFERENCE_MASS_KG.earth;
  const moonMass = REFERENCE_MASS_KG.moon;
  const earthMoonMass = earthMass + moonMass;
  const systemMass = sunMass + earthMoonMass;
  const earthMoonSeparationM = 384_400_000;

  const sunX = -AU_M * earthMoonMass / systemMass;
  const earthMoonBarycenterX = AU_M * sunMass / systemMass;
  const earthOrbitRate = Math.sqrt(G * systemMass / AU_M ** 3);
  const sunVelocityY = earthOrbitRate * sunX;
  const earthMoonBarycenterVelocityY = earthOrbitRate * earthMoonBarycenterX;

  const earthRelativeX = -earthMoonSeparationM * moonMass / earthMoonMass;
  const moonRelativeX = earthMoonSeparationM * earthMass / earthMoonMass;
  const moonOrbitRate = Math.sqrt(G * earthMoonMass / earthMoonSeparationM ** 3);
  const earthRelativeVelocityY = moonOrbitRate * earthRelativeX;
  const moonRelativeVelocityY = moonOrbitRate * moonRelativeX;

  return new NBodySystem({
    stepSeconds,
    collisionMode,
    bodies: [
      {
        id: 'sun',
        name: 'Sun',
        type: 'star',
        massKg: sunMass,
        radiusM: 696_340_000,
        visualRadiusM: 10_000_000_000,
        positionM: [sunX, 0, 0],
        velocityMps: [0, sunVelocityY, 0],
        axialTiltRad: 7.25 * Math.PI / 180,
        color: '#ffd08a',
        provenance: { source: 'JPL DE440 mass parameter', id: 'jpl-de440-sun' },
        flags: ['preset', 'visual-radius-exaggerated']
      },
      {
        id: 'earth',
        name: 'Earth',
        type: 'planet',
        massKg: earthMass,
        radiusM: 6_371_008.4,
        visualRadiusM: 4_400_000_000,
        positionM: [earthMoonBarycenterX + earthRelativeX, 0, 0],
        velocityMps: [0, earthMoonBarycenterVelocityY + earthRelativeVelocityY, 0],
        axialTiltRad: 23.44 * Math.PI / 180,
        color: '#6aa9ff',
        provenance: { source: 'JPL DE440 mass parameter and planetary physical parameters', id: 'jpl-earth' },
        flags: ['preset', 'visual-radius-exaggerated']
      },
      {
        id: 'moon',
        name: 'Moon',
        type: 'moon',
        massKg: moonMass,
        radiusM: 1_737_400,
        visualRadiusM: 2_300_000_000,
        positionM: [earthMoonBarycenterX + moonRelativeX, 0, 0],
        velocityMps: [0, earthMoonBarycenterVelocityY + moonRelativeVelocityY, 0],
        axialTiltRad: 6.68 * Math.PI / 180,
        color: '#d9d8d2',
        provenance: { source: 'JPL DE440 mass parameter', id: 'jpl-moon' },
        flags: ['preset', 'visual-radius-exaggerated']
      }
    ]
  });
}

import { AU_M, C_M_S, G, REFERENCE_MASS_KG, computeAccelerations } from './nbody.js';

export const SOLAR_LUMINOSITY_W = 3.828e26;
export const EARTH_DIPOLE_MOMENT_A_M2 = 7.8e22;
export const LOCAL_DARK_MATTER_DENSITY_KG_M3 = 0.4 * 1.78266192e-21;
export const ARCSECONDS_PER_RADIAN = 206_264.80624709636;

export function gravityAccelerationField({
  bodies,
  uniformDensityKgM3 = 0,
  uniformDensityOriginM = [0, 0, 0]
}) {
  if (!Array.isArray(bodies)) throw new TypeError('Gravity field bodies must be an array');
  const accelerations = computeAccelerations(bodies, bodies.map((body) => body.positionM), {
    uniformDensityKgM3,
    uniformDensityOriginM
  });
  return {
    fidelity: 'computed',
    equation: 'a_i = Σ G m_j (r_j − r_i) / |r_j − r_i|³',
    vectors: bodies.map((body, index) => ({
      id: body.id,
      name: body.name,
      vectorMps2: [...accelerations[index]],
      magnitudeMps2: Math.hypot(...accelerations[index])
    })),
    caveat: 'Instantaneous Newtonian acceleration from the same point-mass solver state. Arrow lengths are normalized for legibility and do not share one physical length scale.'
  };
}

export function gravityAccelerationBreakdown({
  bodies,
  targetId,
  uniformDensityKgM3 = 0,
  uniformDensityOriginM = [0, 0, 0]
}) {
  if (!Array.isArray(bodies)) throw new TypeError('Gravity field bodies must be an array');
  const target = bodies.find((body) => body.id === targetId);
  if (!target) throw new RangeError(`Unknown gravity target: ${targetId}`);
  const contributions = [];
  for (const source of bodies) {
    if (source.id === target.id || source.massKg <= 0) continue;
    const delta = source.positionM.map((value, axis) => value - target.positionM[axis]);
    const distanceSquared = delta.reduce((sum, value) => sum + value * value, 0);
    if (distanceSquared === 0) continue;
    const scale = G * source.massKg / (distanceSquared * Math.sqrt(distanceSquared));
    const vectorMps2 = delta.map((value) => value * scale);
    contributions.push({
      id: source.id,
      name: source.name,
      kind: 'body',
      distanceM: Math.sqrt(distanceSquared),
      vectorMps2,
      magnitudeMps2: Math.hypot(...vectorMps2)
    });
  }
  if (uniformDensityKgM3 > 0) {
    const vectorMps2 = uniformDarkMatterAcceleration({
      positionM: target.positionM,
      densityKgM3: uniformDensityKgM3,
      originM: uniformDensityOriginM
    });
    contributions.push({
      id: 'uniform-density',
      name: 'Uniform-density field',
      kind: 'field',
      distanceM: Math.hypot(...target.positionM.map((value, axis) => value - uniformDensityOriginM[axis])),
      vectorMps2,
      magnitudeMps2: Math.hypot(...vectorMps2)
    });
  }
  const field = gravityAccelerationField({ bodies, uniformDensityKgM3, uniformDensityOriginM });
  const total = field.vectors.find((vector) => vector.id === target.id);
  return {
    fidelity: 'computed',
    equation: field.equation,
    targetId: target.id,
    targetName: target.name,
    totalVectorMps2: [...total.vectorMps2],
    totalMagnitudeMps2: total.magnitudeMps2,
    contributions: contributions.sort((a, b) => b.magnitudeMps2 - a.magnitudeMps2),
    caveat: 'Per-source vectors sum to the same instantaneous Newtonian acceleration used by the live solver; displayed arrows remain normalized for legibility.'
  };
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function isFiniteVector3(value) {
  return Boolean(
    value
    && typeof value.length === 'number'
    && value.length === 3
    && Array.from(value).every(Number.isFinite)
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function subsolarLatitudeRad(axialTiltRad, orbitalLongitudeRad) {
  const tilt = finite(axialTiltRad, 'Axial tilt');
  const longitude = finite(orbitalLongitudeRad, 'Orbital longitude');
  const result = Math.asin(Math.sin(tilt) * Math.sin(longitude));
  return Object.is(result, -0) ? 0 : result;
}

export function daylightHours(latitudeRad, solarDeclinationRad) {
  const latitude = clamp(finite(latitudeRad, 'Latitude'), -Math.PI / 2, Math.PI / 2);
  const declination = clamp(finite(solarDeclinationRad, 'Solar declination'), -Math.PI / 2, Math.PI / 2);
  const cosineHourAngle = -Math.tan(latitude) * Math.tan(declination);
  if (cosineHourAngle <= -1) return 24;
  if (cosineHourAngle >= 1) return 0;
  return 24 * Math.acos(cosineHourAngle) / Math.PI;
}

export function solarFluxWm2(distanceM, luminosityW = SOLAR_LUMINOSITY_W) {
  const distance = finite(distanceM, 'Star distance');
  const luminosity = finite(luminosityW, 'Luminosity');
  if (distance <= 0 || luminosity < 0) throw new RangeError('Distance must be positive and luminosity non-negative');
  return luminosity / (4 * Math.PI * distance * distance);
}

export function dailyMeanInsolationWm2({ latitudeRad, solarDeclinationRad, distanceM = AU_M, luminosityW = SOLAR_LUMINOSITY_W }) {
  const latitude = clamp(finite(latitudeRad, 'Latitude'), -Math.PI / 2, Math.PI / 2);
  const declination = clamp(finite(solarDeclinationRad, 'Solar declination'), -Math.PI / 2, Math.PI / 2);
  const hours = daylightHours(latitude, declination);
  if (hours === 0) return 0;
  const hourAngle = hours === 24 ? Math.PI : hours * Math.PI / 24;
  const flux = solarFluxWm2(distanceM, luminosityW);
  const mean = flux / Math.PI * (
    hourAngle * Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * Math.cos(declination) * Math.sin(hourAngle)
  );
  return Math.max(0, mean);
}

export function seasonSnapshot({
  axialTiltRad,
  orbitalLongitudeRad,
  distanceM = AU_M,
  latitudesDeg = [-75, -45, 0, 45, 75]
}) {
  const solarDeclinationRad = subsolarLatitudeRad(axialTiltRad, orbitalLongitudeRad);
  return {
    fidelity: 'derived',
    axialTiltRad,
    orbitalLongitudeRad,
    solarDeclinationRad,
    solarDeclinationDeg: solarDeclinationRad * 180 / Math.PI,
    distanceM,
    samples: latitudesDeg.map((latitudeDeg) => {
      const latitudeRad = latitudeDeg * Math.PI / 180;
      return {
        latitudeDeg,
        daylightHours: daylightHours(latitudeRad, solarDeclinationRad),
        dailyMeanInsolationWm2: dailyMeanInsolationWm2({ latitudeRad, solarDeclinationRad, distanceM })
      };
    }),
    caveat: 'Top-of-atmosphere geometric insolation only; clouds, oceans, heat transport, albedo feedback, and climate response are omitted.'
  };
}

export function dipoleFieldTesla({ positionM, dipoleMomentA_M2 = EARTH_DIPOLE_MOMENT_A_M2, axis = [0, 0, 1] }) {
  if (!positionM || positionM.length !== 3 || !axis || axis.length !== 3) throw new TypeError('Position and dipole axis require three components');
  const position = positionM.map((value) => finite(value, 'Position component'));
  const axisVector = axis.map((value) => finite(value, 'Axis component'));
  const radius = Math.hypot(...position);
  const axisMagnitude = Math.hypot(...axisVector);
  if (radius === 0 || axisMagnitude === 0) throw new RangeError('Dipole field is undefined at zero radius or with a zero axis');
  const rHat = position.map((value) => value / radius);
  const moment = axisVector.map((value) => value / axisMagnitude * dipoleMomentA_M2);
  const momentDotR = moment[0] * rHat[0] + moment[1] * rHat[1] + moment[2] * rHat[2];
  const coefficient = 1e-7 / radius ** 3;
  return rHat.map((component, index) => coefficient * (3 * momentDotR * component - moment[index]));
}

export function magneticPreset(mode = 'none') {
  const presets = {
    none: { momentA_M2: 0, label: 'No global dipole', multiplier: 0 },
    'earth-like': { momentA_M2: EARTH_DIPOLE_MOMENT_A_M2, label: 'Earth-like dipole', multiplier: 1 },
    'hypothetical-strong': { momentA_M2: EARTH_DIPOLE_MOMENT_A_M2 * 5, label: '5× Earth hypothetical', multiplier: 5 }
  };
  const preset = presets[mode];
  if (!preset) throw new RangeError(`Unknown magnetic preset: ${mode}`);
  return {
    fidelity: 'toy-model',
    mode,
    ...preset,
    caveat: 'Static dipole geometry only. It does not model a dynamo, plasma, solar wind, atmospheric escape, or forces on neutral orbital bodies.'
  };
}

export function dipoleFieldLines({ radiusM, tiltRad = 0, shells = [2, 3, 4.5, 6], samples = 72 }) {
  const radius = finite(radiusM, 'Body radius');
  if (radius <= 0 || !Number.isInteger(samples) || samples < 8) throw new RangeError('Positive radius and at least eight samples are required');
  const lines = [];
  const cosTilt = Math.cos(tiltRad);
  const sinTilt = Math.sin(tiltRad);
  for (const shell of shells) {
    for (const side of [-1, 1]) {
      const points = [];
      for (let index = 0; index <= samples; index += 1) {
        const theta = 0.17 + (Math.PI - 0.34) * index / samples;
        const radial = radius * shell * Math.sin(theta) ** 2;
        const x = side * radial * Math.sin(theta);
        const y = -radial * Math.cos(theta);
        points.push([
          x * cosTilt - y * sinTilt,
          x * sinTilt + y * cosTilt
        ]);
      }
      lines.push(points);
    }
  }
  return lines;
}

export function uniformDarkMatterAcceleration({ positionM, densityKgM3, originM = [0, 0, 0] }) {
  const density = finite(densityKgM3, 'Dark-matter density');
  if (density < 0) throw new RangeError('Dark-matter density must be non-negative');
  if (!positionM || positionM.length !== 3 || !originM || originM.length !== 3) throw new TypeError('Position and origin require three components');
  const coefficient = -4 * Math.PI * G * density / 3;
  return positionM.map((value, index) => {
    const result = coefficient * (finite(value, 'Position component') - finite(originM[index], 'Origin component'));
    return Object.is(result, -0) ? 0 : result;
  });
}

export function darkMatterPreset(mode = 'none') {
  const presets = {
    none: { densityKgM3: 0, label: 'No added dark matter', exaggeration: 0 },
    'local-estimate': { densityKgM3: LOCAL_DARK_MATTER_DENSITY_KG_M3, label: 'Local Milky Way estimate', exaggeration: 1 },
    'uniform-exaggerated': { densityKgM3: 1e-7, label: 'Uniform density · exaggerated', exaggeration: 1e-7 / LOCAL_DARK_MATTER_DENSITY_KG_M3 }
  };
  const preset = presets[mode];
  if (!preset) throw new RangeError(`Unknown dark-matter preset: ${mode}`);
  const accelerationAtOneAu = Math.hypot(...uniformDarkMatterAcceleration({
    positionM: [AU_M, 0, 0],
    densityKgM3: preset.densityKgM3
  }));
  const solarAccelerationAtOneAu = G * REFERENCE_MASS_KG.sun / AU_M ** 2;
  return {
    fidelity: 'toy-model',
    mode,
    ...preset,
    accelerationAtOneAuMps2: accelerationAtOneAu,
    ratioToSolarGravityAtOneAu: accelerationAtOneAu / solarAccelerationAtOneAu,
    caveat: mode === 'local-estimate'
      ? 'Uniform-density approximation using a representative local Galactic estimate; the predicted Solar System effect is effectively negligible.'
      : 'Uniform-density toy field about the declared origin; this is not a particle-dark-matter, galaxy-formation, or cosmological simulation.'
  };
}

export function darkMatterModeComparison({
  bodies,
  targetId = null,
  mode = 'none',
  uniformDensityOriginM = [0, 0, 0]
}) {
  const preset = darkMatterPreset(mode);
  const offField = gravityAccelerationField({
    bodies,
    uniformDensityKgM3: 0,
    uniformDensityOriginM
  });
  const onField = gravityAccelerationField({
    bodies,
    uniformDensityKgM3: preset.densityKgM3,
    uniformDensityOriginM
  });
  if (offField.vectors.length === 0 || onField.vectors.length === 0) {
    return null;
  }
  const target = targetId
    ? (offField.vectors.find((vector) => vector.id === targetId) || offField.vectors[0])
    : offField.vectors[0];
  const onTarget = onField.vectors.find((vector) => vector.id === target.id) || onField.vectors[0];
  const deltaVectorMps2 = target.vectorMps2.map((value, index) => onTarget.vectorMps2[index] - target.vectorMps2[index]);
  return {
    targetId: target.id,
    targetName: target.name,
    mode,
    preset,
    off: target,
    on: onTarget,
    deltaVectorMps2,
    deltaMagnitudeMps2: Math.hypot(...deltaVectorMps2),
    baseMagnitudeMps2: target.magnitudeMps2,
    onMagnitudeMps2: onTarget.magnitudeMps2
  };
}

export function weakFieldDeflection({ massKg, impactParameterM }) {
  const mass = finite(massKg, 'Lens mass');
  const impact = finite(impactParameterM, 'Impact parameter');
  if (mass < 0 || impact <= 0) throw new RangeError('Lens mass must be non-negative and impact parameter positive');
  const radians = 4 * G * mass / (impact * C_M_S ** 2);
  return { radians, arcseconds: radians * ARCSECONDS_PER_RADIAN };
}

export function weakFieldLightPath({
  massKg,
  impactParameterM,
  extentM = impactParameterM * 8,
  samples = 121,
  visualExaggeration = 1
}) {
  if (!Number.isInteger(samples) || samples < 3) throw new RangeError('At least three path samples are required');
  if (!Number.isFinite(visualExaggeration) || visualExaggeration < 1) throw new RangeError('Visual exaggeration must be at least one');
  const trueDeflection = weakFieldDeflection({ massKg, impactParameterM });
  const visualAngle = trueDeflection.radians * visualExaggeration;
  const points = [];
  for (let index = 0; index < samples; index += 1) {
    const x = -extentM + 2 * extentM * index / (samples - 1);
    const y = impactParameterM - visualAngle * 0.5 * (x + Math.sqrt(x * x + impactParameterM * impactParameterM));
    points.push([x, y]);
  }
  return {
    fidelity: 'toy-model',
    trueDeflection,
    visualExaggeration,
    visualAngleRad: visualAngle,
    impactParameterM,
    extentM,
    points,
    caveat: 'Leading-order weak-field deflection around one spherical, non-rotating mass. Path curvature may be visually exaggerated; strong-field lensing is omitted.'
  };
}

export function relativisticLongitudinalDopplerFactor({
  sourceVelocityMps = [0, 0, 0],
  observerVelocityMps = [0, 0, 0],
  lineOfSightVectorM
}) {
  if (!isFiniteVector3(sourceVelocityMps)) {
    throw new TypeError('Source velocity must be a 3-vector');
  }
  if (!isFiniteVector3(observerVelocityMps)) {
    throw new TypeError('Observer velocity must be a 3-vector');
  }
  if (!isFiniteVector3(lineOfSightVectorM)) {
    throw new TypeError('Line-of-sight vector must be a 3-vector');
  }
  const losLength = Math.hypot(...lineOfSightVectorM);
  if (!Number.isFinite(losLength) || losLength <= 0) throw new RangeError('Line-of-sight distance must be positive');
  const radialSpeedMps = lineOfSightVectorM.map((value, axis) => {
    const relative = observerVelocityMps[axis] - sourceVelocityMps[axis];
    return relative * (lineOfSightVectorM[axis] / losLength);
  }).reduce((sum, value) => sum + value, 0);
  const beta = Math.max(-0.999999, Math.min(0.999999, radialSpeedMps / C_M_S));
  const factor = Math.sqrt((1 - beta) / (1 + beta));
  return {
    model: 'relativistic-longitudinal',
    radialSpeedMps,
    radialSpeedKmPerS: radialSpeedMps / 1000,
    beta,
    factor,
    observedFrequencyMultiplierFromDoppler: factor,
    formula: 'f_obs = f_em * √((1 - β)/(1 + β))'
  };
}

export function schwarzschildGravitationalFrequencyRatio({
  lensMassKg,
  sourceDistanceM,
  observerDistanceM
}) {
  const mass = finite(lensMassKg, 'Lens mass');
  const sourceRadius = finite(sourceDistanceM, 'Source radial distance');
  const observerRadius = finite(observerDistanceM, 'Observer radial distance');
  if (mass <= 0) throw new RangeError('Lens mass must be positive for relativistic redshift');
  if (sourceRadius <= 0 || observerRadius <= 0) throw new RangeError('Observer and source distances must be positive');
  const schwarzschildRadius = schwarzschildRadiusM(mass);
  const safeSourceRadius = Math.max(sourceRadius, schwarzschildRadius * 1.000001);
  const safeObserverRadius = Math.max(observerRadius, schwarzschildRadius * 1.000001);
  const sourcePotential = 1 - 2 * G * mass / (safeSourceRadius * C_M_S ** 2);
  const observerPotential = 1 - 2 * G * mass / (safeObserverRadius * C_M_S ** 2);
  const factor = Math.sqrt(observerPotential / sourcePotential);
  const observedMinusEmitted = factor - 1;
  return {
    model: 'Schwarzschild redshift (toy model)',
    lensMassKg: mass,
    sourceDistanceM: sourceRadius,
    observerDistanceM: observerRadius,
    schwarzschildRadiusM: schwarzschildRadius,
    factor,
    redshift: observedMinusEmitted,
    equation: 'f_obs = f_em * √((1 - r_s/r_obs)/(1 - r_s/r_src))'
  };
}

export function lightWaveReadout({
  restFrequencyHz = 4.56e14,
  source,
  observer,
  lens
}) {
  if (!source || !observer) return null;
  if (!source.positionM || !observer.positionM) return null;
  if (!isFiniteVector3(source.positionM)) {
    throw new TypeError('Source position must be a 3-vector');
  }
  if (!isFiniteVector3(observer.positionM)) {
    throw new TypeError('Observer position must be a 3-vector');
  }
  const lineOfSightVectorM = observer.positionM.map((value, axis) => value - source.positionM[axis]);
  const doppler = relativisticLongitudinalDopplerFactor({
    sourceVelocityMps: source.velocityMps || [0, 0, 0],
    observerVelocityMps: observer.velocityMps || [0, 0, 0],
    lineOfSightVectorM
  });
  const restFrequency = finite(restFrequencyHz, 'Rest frequency');
  let observedFrequencyHz = restFrequency * doppler.factor;
  let gravity = null;
  if (lens && lens.massKg > 0 && isFiniteVector3(lens.positionM)) {
    const lensToSource = source.positionM.map((value, axis) => value - lens.positionM[axis]);
    const lensToObserver = observer.positionM.map((value, axis) => value - lens.positionM[axis]);
    const sourceDistanceM = Math.hypot(...lensToSource);
    const observerDistanceM = Math.hypot(...lensToObserver);
    if (Number.isFinite(sourceDistanceM) && Number.isFinite(observerDistanceM) && sourceDistanceM > 0 && observerDistanceM > 0) {
      gravity = schwarzschildGravitationalFrequencyRatio({
        lensMassKg: lens.massKg,
        sourceDistanceM,
        observerDistanceM
      });
      observedFrequencyHz *= gravity.factor;
    }
  }
  return {
    model: 'electromagnetic-wave-analytic',
    restFrequencyHz,
    restWavelengthNm: C_M_S / restFrequency * 1e9,
    observedFrequencyHz,
    observedWavelengthNm: observedFrequencyHz === 0 ? Number.POSITIVE_INFINITY : C_M_S / observedFrequencyHz * 1e9,
    redshift: observedFrequencyHz / restFrequency - 1,
    wavelengthShift: restFrequency / observedFrequencyHz,
    doppler,
    gravity
  };
}

export function compactBinaryInspiralGridRipple({
  centerM = [0, 0, 0],
  separationM,
  timeSeconds = 0,
  ringCount = 4,
  samples = 72,
  baselineRings = true
}) {
  if (!centerM || centerM.length !== 3) throw new TypeError('Ripple center requires three components');
  if (!Number.isFinite(separationM) || separationM <= 0) throw new RangeError('Separation distance must be positive');
  if (!Number.isFinite(timeSeconds)) throw new TypeError('timeSeconds must be finite');
  if (!Number.isInteger(ringCount) || ringCount <= 0 || ringCount > 16) {
    throw new RangeError('Ring count must be a positive integer up to 16');
  }
  if (!Number.isInteger(samples) || samples < 32 || samples > 256) {
    throw new RangeError('Samples must be an integer between 32 and 256');
  }

  const ringSpacingM = separationM * 1.7;
  const rippleScale = Math.max(1e5, separationM * 0.09);
  const phase = finite(timeSeconds, 'Time seconds') * 0.35 + separationM / AU_M * 1.75;
  const rings = [];
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const radiusM = ringSpacingM * (ringIndex + 1.25);
    const ringPhase = phase + ringIndex * 0.65;
    const waveAmplitudeM = rippleScale * (1 - ringIndex / (ringCount + 2));
    const points = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const angle = Math.PI * 2 * sample / samples;
      const ripple = Math.sin(angle * 3 + ringPhase) * waveAmplitudeM / (1 + ringIndex * 0.3);
      const radius = radiusM + ripple;
      points.push([radius * Math.cos(angle), radius * Math.sin(angle), 0]);
    }
    rings.push({
      index: ringIndex,
      radiusM,
      phase: ringPhase,
      points
    });
  }
  return {
    fidelity: 'toy-model',
    model: 'compact-binary inspiral grid-ripple',
    unit: 'M',
    centerM: [...centerM],
    separationM,
    rings,
    rippleScaleM: rippleScale,
    baselineRings,
    caveat: baselineRings
      ? 'TOY GRID RIPPLE · N-body solver evolves Newtonian motion only; compact masses and inspiral visuals are illustrative and do not compute general relativity or gravitational-wave radiation.'
      : 'TOY GRID RIPPLE · Wave pattern displayed for educational intuition only; no relativistic or radiative dynamics are computed.'
  };
}

export function schwarzschildRadiusM(massKg) {
  const mass = finite(massKg, 'Black-hole mass');
  if (mass <= 0) throw new RangeError('Black-hole mass must be positive');
  return 2 * G * mass / C_M_S ** 2;
}

export function schwarzschildCriticalImpactParameterM(massKg) {
  return 3 * Math.sqrt(3) * schwarzschildRadiusM(massKg) / 2;
}

function schwarzschildTurningPoint(impactRadii) {
  const critical = 3 * Math.sqrt(3) / 2;
  if (!Number.isFinite(impactRadii) || impactRadii <= critical) {
    throw new RangeError(`Escaping rays require an impact parameter above ${critical.toFixed(6)} Schwarzschild radii`);
  }
  const inverseImpactSquared = 1 / impactRadii ** 2;
  const radialPolynomial = (inverseRadius) => inverseImpactSquared - inverseRadius ** 2 + inverseRadius ** 3;
  let lower = 0;
  let upper = 2 / 3;
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (radialPolynomial(midpoint) > 0) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}

function schwarzschildAngularIntegrand(theta, turningInverseRadius, impactRadii) {
  if (Math.abs(theta - Math.PI / 2) < 1e-12) {
    return Math.sqrt(2 / (2 - 3 * turningInverseRadius));
  }
  const inverseRadius = turningInverseRadius * Math.sin(theta);
  const denominatorSquared = 1 / impactRadii ** 2 - inverseRadius ** 2 + inverseRadius ** 3;
  return turningInverseRadius * Math.cos(theta) / Math.sqrt(Math.max(denominatorSquared, Number.EPSILON));
}

export function schwarzschildDeflection({ massKg, impactParameterM, integrationSteps = 4096 }) {
  const radiusM = schwarzschildRadiusM(massKg);
  const impact = finite(impactParameterM, 'Impact parameter');
  if (impact <= 0) throw new RangeError('Impact parameter must be positive');
  if (!Number.isInteger(integrationSteps) || integrationSteps < 128 || integrationSteps % 2 !== 0) {
    throw new RangeError('Schwarzschild integration steps must be an even integer of at least 128');
  }
  const impactRadii = impact / radiusM;
  const turningInverseRadius = schwarzschildTurningPoint(impactRadii);
  const step = (Math.PI / 2) / integrationSteps;
  let weighted = 0;
  for (let index = 0; index <= integrationSteps; index += 1) {
    const theta = index * step;
    const weight = index === 0 || index === integrationSteps ? 1 : index % 2 === 0 ? 2 : 4;
    weighted += weight * schwarzschildAngularIntegrand(theta, turningInverseRadius, impactRadii);
  }
  const halfAngle = weighted * step / 3;
  const radians = 2 * halfAngle - Math.PI;
  return {
    fidelity: 'computed-schwarzschild',
    model: 'Schwarzschild null geodesic · non-rotating spherical mass',
    radians,
    degrees: radians * 180 / Math.PI,
    arcseconds: radians * ARCSECONDS_PER_RADIAN,
    schwarzschildRadiusM: radiusM,
    criticalImpactParameterM: schwarzschildCriticalImpactParameterM(massKg),
    impactParameterM: impact,
    impactSchwarzschildRadii: impactRadii,
    closestApproachM: radiusM / turningInverseRadius
  };
}

export function schwarzschildLightPath({
  massKg,
  impactParameterM,
  extentSchwarzschildRadii = 30,
  samples = 181
}) {
  if (!Number.isInteger(samples) || samples < 65 || samples % 2 !== 1) {
    throw new RangeError('Schwarzschild light paths require an odd sample count of at least 65');
  }
  if (!Number.isFinite(extentSchwarzschildRadii) || extentSchwarzschildRadii <= 3) {
    throw new RangeError('Schwarzschild path extent must exceed three radii');
  }
  const deflection = schwarzschildDeflection({ massKg, impactParameterM });
  const radiusM = deflection.schwarzschildRadiusM;
  const impactRadii = deflection.impactSchwarzschildRadii;
  const turningInverseRadius = radiusM / deflection.closestApproachM;
  const minimumInverseRadius = 1 / extentSchwarzschildRadii;
  if (minimumInverseRadius >= turningInverseRadius) throw new RangeError('Path extent must exceed the closest approach');

  const halfSamples = (samples - 1) / 2;
  const minimumTheta = Math.asin(minimumInverseRadius / turningInverseRadius);
  const thetaStep = (Math.PI / 2 - minimumTheta) / halfSamples;
  const thetaValues = [];
  const integrandValues = [];
  for (let index = 0; index <= halfSamples; index += 1) {
    const theta = minimumTheta + thetaStep * index;
    thetaValues.push(theta);
    integrandValues.push(schwarzschildAngularIntegrand(theta, turningInverseRadius, impactRadii));
  }
  const angleFromTurningPoint = new Array(halfSamples + 1).fill(0);
  for (let index = halfSamples - 1; index >= 0; index -= 1) {
    angleFromTurningPoint[index] = angleFromTurningPoint[index + 1]
      + (integrandValues[index] + integrandValues[index + 1]) * thetaStep / 2;
  }

  const branchPoint = (index, side) => {
    const inverseRadius = turningInverseRadius * Math.sin(thetaValues[index]);
    const radialDistanceM = radiusM / inverseRadius;
    const polarAngle = Math.PI / 2 + side * angleFromTurningPoint[index];
    return [radialDistanceM * Math.cos(polarAngle), radialDistanceM * Math.sin(polarAngle)];
  };
  const points = [];
  for (let index = 0; index <= halfSamples; index += 1) points.push(branchPoint(index, 1));
  for (let index = halfSamples - 1; index >= 0; index -= 1) points.push(branchPoint(index, -1));

  return {
    fidelity: deflection.fidelity,
    model: deflection.model,
    deflection,
    points,
    extentM: extentSchwarzschildRadii * radiusM,
    visualExaggeration: 1,
    caveat: 'Computed numerical null geodesic for a non-rotating Schwarzschild mass. The n-body motion, accretion disk, photon ring, background lensing, spin, plasma, and radiative transfer are outside this calculation.'
  };
}

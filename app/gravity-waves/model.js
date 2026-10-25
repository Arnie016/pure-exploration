// A self-contained, deterministic Michelson interferometer teaching model.
// All optical results use a one-bounce, equal-arm, long-wavelength approximation.
// No astrophysical waveform inference, real detector feed or calibrated noise.
export const LIGHT_SPEED = 299792458;
export const CHIRP_SECONDS = 2.5;
export const RINGDOWN_SECONDS = 0.35;
export const TOTAL_SECONDS = CHIRP_SECONDS + RINGDOWN_SECONDS;
/** @type {Readonly<{peakStrain:number,armLengthM:number,wavelengthNm:number,displayGain:number,noiseLevel:number}>} */
export const DEFAULT_SETTINGS = Object.freeze({
  peakStrain: 1.2e-21, armLengthM: 4000, wavelengthNm: 1064,
  displayGain: 1e10, noiseLevel: 0.22
});
const TWO_PI = Math.PI * 2;
const START_HZ = 24;
const FINAL_HZ = 160;

export function phaseAt(timeSeconds) {
  const t = Math.max(0, Math.min(CHIRP_SECONDS, Number(timeSeconds) || 0));
  // Frequency f(t) = f0 + (f1 - f0) (t/T)^2, analytically integrated.
  return TWO_PI * (START_HZ * t + (FINAL_HZ - START_HZ) * t ** 3 / (3 * CHIRP_SECONDS ** 2));
}

export function instantaneousFrequency(timeSeconds) {
  const u = Math.max(0, Math.min(1, timeSeconds / CHIRP_SECONDS));
  return START_HZ + (FINAL_HZ - START_HZ) * u * u;
}

export function normalizedChirp(timeSeconds) {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0 || timeSeconds > TOTAL_SECONDS) return 0;
  if (timeSeconds <= CHIRP_SECONDS) {
    const u = timeSeconds / CHIRP_SECONDS;
    const envelope = (0.12 + 0.88 * u * u) * Math.min(1, u / 0.06);
    return envelope * Math.sin(phaseAt(timeSeconds));
  }
  const after = timeSeconds - CHIRP_SECONDS;
  const finish = Math.max(0, 1 - after / RINGDOWN_SECONDS);
  return Math.exp(-after / 0.12) * finish * finish *
    Math.sin(phaseAt(CHIRP_SECONDS) + TWO_PI * FINAL_HZ * after);
}

export function opticalReadout(strain, armLengthM = 4000, wavelengthNm = 1064, displayGain = 1e10) {
  if (![strain, armLengthM, wavelengthNm, displayGain].every(Number.isFinite) ||
      armLengthM <= 0 || wavelengthNm <= 0 || displayGain < 0) {
    throw new RangeError('Finite positive arm lengths and wavelengths are required.');
  }
  // A plus-polarized, optimally oriented GW changes the two arms by +/- hL/2.
  const differentialMetres = strain * armLengthM;
  // Round-trip path difference 2(hL), hence 4*pi*(hL)/lambda.
  const physicalPhaseRad = 4 * Math.PI * differentialMetres / (wavelengthNm * 1e-9);
  const darkPortFraction = Math.sin(physicalPhaseRad / 2) ** 2;
  // Conceptual signed quadrature monitor. Gain is for display ONLY.
  // It is not the physical dark-port power or an optical cavity gain.
  const displayQuadrature = Math.sin(physicalPhaseRad * displayGain);
  return {differentialMetres, physicalPhaseRad, darkPortFraction, displayQuadrature};
}

export function instrumentAt(timeSeconds, settings = DEFAULT_SETTINGS) {
  const strain = settings.peakStrain * normalizedChirp(timeSeconds);
  const optics = opticalReadout(strain, settings.armLengthM, settings.wavelengthNm, settings.displayGain);
  return {
    timeSeconds, strain, instantaneousHz: instantaneousFrequency(timeSeconds),
    roundTripSeconds: 2 * settings.armLengthM / LIGHT_SPEED,
    ...optics
  };
}

// Reproducible, zero-mean-ish illustrative noise, never random per rerender.
function seededNoise(index) {
  let x = (index + 1) * 2654435761 >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0;
  x ^= x >>> 16;
  return (x / 4294967295) * 2 - 1;
}

export function sampleTrace(settings = DEFAULT_SETTINGS, samples = 240) {
  if (!Number.isInteger(samples) || samples < 8 || samples > 4096) throw new RangeError('samples must be 8..4096');
  const points = [];
  let templatePower = 0, observedPower = 0, cross = 0;
  for (let i = 0; i < samples; i++) {
    const t = TOTAL_SECONDS * i / (samples - 1);
    const ideal = instrumentAt(t, settings).displayQuadrature;
    const noise = Math.max(0, settings.noiseLevel) * (0.7 * seededNoise(i) + 0.3 * Math.sin(i * 2.29));
    const observed = ideal + noise;
    points.push({t, ideal, observed});
    templatePower += ideal * ideal;
    observedPower += observed * observed;
    cross += ideal * observed;
  }
  const alignment = templatePower > 1e-20 && observedPower > 1e-20 ?
    cross / Math.sqrt(templatePower * observedPower) : 0;
  // Only a normalized template alignment, not a calibrated SNR or detection probability.
  return {points, alignment: Math.max(-1, Math.min(1, alignment))};
}

/**
 * Radio Sky: single-frequency, ideal scalar plane-wave beamforming.
 * All positions are in metres. Directions point FROM the array TO the source.
 * This is not a visibility imager, calibrated correlator or hardware benchmark.
 */
export const LIGHT_SPEED_M_S = 299_792_458;
export type Station = { id: 'A' | 'B' | 'C' | 'D'; x: number; z: number };
export const clamp = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;

export function antennaStations(baselineMeters: number): Station[] {
  const h = clamp(baselineMeters, 6, 48) / 2;
  return [
    { id: 'A', x: -h, z: 0 },
    { id: 'B', x: h, z: 0 },
    { id: 'C', x: 0, z: -h },
    { id: 'D', x: 0, z: h },
  ];
}

/** Azimuth clockwise from north (+z); elevation above the horizon. */
export function skyDirection(azimuthDeg: number, elevationDeg: number) {
  const az = azimuthDeg * Math.PI / 180;
  const el = elevationDeg * Math.PI / 180;
  return { x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: Math.cos(az) * Math.cos(el) };
}
export function wavelengthMeters(frequencyMHz: number) {
  return LIGHT_SPEED_M_S / (clamp(frequencyMHz, 80, 400) * 1e6);
}

/** Arrival time at second station minus arrival time at first, in ns. */
export function arrivalDelayNs(first: Station, second: Station, azimuthDeg: number, elevationDeg: number) {
  const s = skyDirection(azimuthDeg, elevationDeg);
  return -((second.x - first.x) * s.x + (second.z - first.z) * s.z) / LIGHT_SPEED_M_S * 1e9;
}

/** Post-steering phase at one station. Common phase is irrelevant. */
export function residualPhaseRad(station: Station, frequencyMHz: number, sourceAz: number, steeringAz: number, elevationDeg: number) {
  const source = skyDirection(sourceAz, elevationDeg), pointing = skyDirection(steeringAz, elevationDeg);
  const cycles = (station.x * (source.x - pointing.x) + station.z * (source.z - pointing.z)) / wavelengthMeters(frequencyMHz);
  return 2 * Math.PI * cycles;
}

/**
 * Unit-peak coherent sum of equal-amplitude signals after true time-delay steering.
 * Ignored: antenna primary beam, polarization, noise, bandwidth, atmosphere, calibration.
 */
export function beamPower(stations: readonly Station[], frequencyMHz: number, sourceAz: number, steeringAz: number, elevationDeg: number) {
  if (!stations.length) return 0;
  let re = 0, im = 0;
  for (const station of stations) {
    const p = residualPhaseRad(station, frequencyMHz, sourceAz, steeringAz, elevationDeg);
    re += Math.cos(p);
    im += Math.sin(p);
  }
  return clamp((re * re + im * im) / (stations.length * stations.length), 0, 1);
}

export function angularScan(stations: readonly Station[], frequencyMHz: number, sourceAz: number, elevationDeg: number) {
  return Array.from({ length: 181 }, (_, steeringAz) => ({
    azimuth: steeringAz,
    power: beamPower(stations, frequencyMHz, sourceAz, steeringAz, elevationDeg),
  }));
}

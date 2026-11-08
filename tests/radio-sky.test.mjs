import test from 'node:test';
import assert from 'node:assert/strict';
import { antennaStations, skyDirection, wavelengthMeters, arrivalDelayNs, residualPhaseRad, beamPower, angularScan, LIGHT_SPEED_M_S } from '../app/radio-sky/physics.ts';

const nearly = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('wavelength follows c/f and baseline geometry is symmetric', () => {
  nearly(wavelengthMeters(100), LIGHT_SPEED_M_S / 1e8, 1e-12);
  const stations = antennaStations(24);
  assert.deepEqual(stations.map(s => s.id), ['A', 'B', 'C', 'D']);
  assert.equal(stations[1].x - stations[0].x, 24);
  assert.equal(stations[3].z - stations[2].z, 24);
});

test('plane wave has correct geometric arrival sign and zero transverse delay', () => {
  const [a, b] = antennaStations(24);
  nearly(arrivalDelayNs(a, b, 90, 0), -24 / LIGHT_SPEED_M_S * 1e9, 1e-9);
  nearly(arrivalDelayNs(a, b, 0, 0), 0, 1e-10);
  nearly(skyDirection(90, 0).x, 1);
});

test('steering at true source makes all phases coherent', () => {
  const antenna = antennaStations(36);
  for (const az of [0, 31, 90, 149, 180]) {
    nearly(beamPower(antenna, 225, az, az, 42), 1);
    for (const station of antenna) nearly(residualPhaseRad(station, 225, az, az, 42), 0);
  }
});

test('off-axis response is bounded and cannot exceed coherent alignment', () => {
  const antenna = antennaStations(24);
  const power = beamPower(antenna, 150, 44, 69, 35);
  assert.ok(power >= 0 && power < 1);
  const scan = angularScan(antenna, 150, 44, 35);
  assert.equal(scan.length, 181);
  nearly(scan[44].power, 1);
  assert.ok(scan.every(x => Number.isFinite(x.power) && x.power >= 0 && x.power <= 1));
});

test('no antennas has zero power and invalid physical inputs are bounded', () => {
  assert.equal(beamPower([], 150, 40, 40, 35), 0);
  assert.ok(Number.isFinite(wavelengthMeters(Infinity)));
  assert.ok(Number.isFinite(beamPower(antennaStations(NaN), NaN, 30, 60, 35)));
});

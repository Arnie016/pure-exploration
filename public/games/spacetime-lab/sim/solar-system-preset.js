import { G, NBodySystem } from './nbody.js';
import { HORIZONS_SOLAR_SYSTEM } from '../data/solar-system-horizons.js';

const KM_TO_M = 1_000;

export function createHorizonsSolarSystemPreset({ stepSeconds = 1_800, collisionMode = 'merge' } = {}) {
  return new NBodySystem({
    stepSeconds,
    collisionMode,
    bodies: HORIZONS_SOLAR_SYSTEM.bodies.map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      massKg: record.gmKm3S2 * 1e9 / G,
      radiusM: record.radiusKm * KM_TO_M,
      visualRadiusM: record.radiusKm * KM_TO_M,
      positionM: record.positionKm.map((value) => value * KM_TO_M),
      velocityMps: record.velocityKmS.map((value) => value * KM_TO_M),
      axialTiltRad: record.axialTiltDeg * Math.PI / 180,
      color: record.color,
      provenance: {
        source: HORIZONS_SOLAR_SYSTEM.ephemerisSource,
        target: record.command,
        epochTdb: HORIZONS_SOLAR_SYSTEM.epochTdb,
        frame: HORIZONS_SOLAR_SYSTEM.referencePlane
      },
      flags: ['preset', 'pinned-horizons-state']
    }))
  });
}

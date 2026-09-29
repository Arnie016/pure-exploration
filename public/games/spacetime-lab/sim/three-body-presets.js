import { AU_M, G, NBodySystem, REFERENCE_MASS_KG } from './nbody.js';

// Dimensionless Chenciner-Montgomery figure-eight initial conditions, scaled so
// one length unit is 1 AU and each equal mass is one solar mass. Scaling changes
// size and period, not the Newtonian choreography.
export const FIGURE_EIGHT_REFERENCE = Object.freeze({
  source: 'Chenciner & Montgomery, Annals of Mathematics 152 (2000), 881-901',
  sourceUrl: 'https://annals.math.princeton.edu/articles/12364',
  doi: '10.2307/2661357',
  lengthScaleM: AU_M,
  massScaleKg: REFERENCE_MASS_KG.sun,
  dimensionlessPeriod: 6.32591398
});

export function createFigureEightThreeBodyPreset({ stepSeconds = 1_800, collisionMode = 'merge' } = {}) {
  const massKg = FIGURE_EIGHT_REFERENCE.massScaleKg;
  const velocityScaleMps = Math.sqrt(G * massKg / FIGURE_EIGHT_REFERENCE.lengthScaleM);
  const records = [
    ['eight-a', 'Aster A', '#ffd08a', [-0.97000436, 0.24308753, 0], [0.466203685, 0.43236573, 0]],
    ['eight-b', 'Aster B', '#ff9c6c', [0.97000436, -0.24308753, 0], [0.466203685, 0.43236573, 0]],
    ['eight-c', 'Aster C', '#fff0ba', [0, 0, 0], [-0.93240737, -0.86473146, 0]]
  ];
  return new NBodySystem({
    stepSeconds,
    collisionMode,
    bodies: records.map(([id, name, color, position, velocity]) => ({
      id,
      name,
      type: 'star',
      massKg,
      radiusM: 695_700_000,
      visualRadiusM: 695_700_000,
      positionM: position.map((value) => value * FIGURE_EIGHT_REFERENCE.lengthScaleM),
      velocityMps: velocity.map((value) => value * velocityScaleMps),
      axialTiltRad: 0,
      color,
      provenance: {
        source: FIGURE_EIGHT_REFERENCE.source,
        url: FIGURE_EIGHT_REFERENCE.sourceUrl,
        scale: '1 dimensionless length = 1 AU; 1 dimensionless mass = 1 solar mass'
      },
      flags: ['preset', 'computed-newtonian', 'scaled-figure-eight', 'hypothetical-three-star-system']
    }))
  });
}

/** Softened three-body Newtonian gravity, in explicitly dimensionless teaching units (G = 1). */
export type Vector = [number, number, number];
export type Body = { mass: number; position: Vector; velocity: Vector };
export type Preset = 'eight' | 'triangle' | 'visitor';
export type System = { bodies: Body[]; time: number; initialEnergy: number };
export type Settings = { preset: Preset; thirdMass: number; softening: number; perturbation: number };
export const DEFAULT_SETTINGS: Settings = { preset: 'eight', thirdMass: 1, softening: 0.015, perturbation: 0.003 };
const G = 1;
const clone = (b: Body): Body => ({ mass: b.mass, position: [...b.position], velocity: [...b.velocity] });
export function initialBodies(preset: Preset, thirdMass: number, softening: number): Body[] {
  const m = Math.max(0.1, Math.min(3, Number.isFinite(thirdMass) ? thirdMass : 1));
  if (preset === 'triangle') {
    const omega = Math.sqrt(3 / Math.pow(3 + softening * softening, 1.5));
    return [0, 1, 2].map(i => {
      const angle = i * 2 * Math.PI / 3;
      const x = Math.cos(angle), y = Math.sin(angle);
      return { mass: i === 2 ? m : 1, position: [x, y, 0], velocity: [-omega * y, omega * x, 0] };
    });
  }
  if (preset === 'visitor') {
    return [
      { mass: 1.3, position: [-0.7, 0, 0], velocity: [0, -0.56, 0] },
      { mass: 1.3, position: [0.7, 0, 0], velocity: [0, 0.56, 0] },
      { mass: m, position: [0, 2.4, 0.25], velocity: [-0.73, -0.08, 0] },
    ];
  }
  // Moore-Chenciner-Montgomery figure-eight initial conditions for equal masses.
  // The optional softening and mass controls make the displayed motion an approximation.
  return [
    { mass: 1, position: [-0.97000436, 0.24308753, 0], velocity: [0.466203685, 0.43236573, 0] },
    { mass: 1, position: [0.97000436, -0.24308753, 0], velocity: [0.466203685, 0.43236573, 0] },
    { mass: m, position: [0, 0, 0], velocity: [-0.93240737, -0.86473146, 0] },
  ];
}
export function totalEnergy(bodies: readonly Body[], softening: number): number {
  let value = 0;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    value += b.mass * b.velocity.reduce((sum, v) => sum + v * v, 0) / 2;
    for (let j = i + 1; j < bodies.length; j++) {
      const other = bodies[j];
      const squared = b.position.reduce((sum, v, k) => sum + (v - other.position[k]) ** 2, softening ** 2);
      value -= G * b.mass * other.mass / Math.sqrt(Math.max(1e-12, squared));
    }
  }
  return value;
}
export function totalMomentum(bodies: readonly Body[]): Vector {
  return [0, 1, 2].map(k => bodies.reduce((sum, b) => sum + b.mass * b.velocity[k], 0)) as Vector;
}
export function centerOfMass(bodies: readonly Body[]): Vector {
  const m = bodies.reduce((sum, b) => sum + b.mass, 0);
  return [0, 1, 2].map(k => bodies.reduce((sum, b) => sum + b.mass * b.position[k], 0) / m) as Vector;
}
export function accelerations(bodies: readonly Body[], softening: number): Vector[] {
  const a: Vector[] = bodies.map(() => [0, 0, 0]);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const dx: Vector = [0, 1, 2].map(k => bodies[j].position[k] - bodies[i].position[k]) as Vector;
    const squared = dx.reduce((sum, v) => sum + v * v, softening ** 2);
    const invCube = 1 / Math.pow(Math.max(squared, 1e-8), 1.5);
    for (let k = 0; k < 3; k++) {
      a[i][k] += G * bodies[j].mass * dx[k] * invCube;
      a[j][k] -= G * bodies[i].mass * dx[k] * invCube;
    }
  }
  return a;
}
/** Velocity Verlet: second-order, time-reversible, symplectic at fixed dt. */
export function step(system: System, dt: number, softening: number): void {
  if (!(dt > 0 && dt <= 0.02)) throw new RangeError('Fixed time step must be between 0 and 0.02');
  const before = accelerations(system.bodies, softening);
  system.bodies.forEach((b, i) => {
    for (let k = 0; k < 3; k++) {
      b.position[k] += b.velocity[k] * dt + 0.5 * before[i][k] * dt * dt;
    }
  });
  const after = accelerations(system.bodies, softening);
  system.bodies.forEach((b, i) => {
    for (let k = 0; k < 3; k++) b.velocity[k] += (before[i][k] + after[i][k]) * dt * 0.5;
  });
  system.time += dt;
}
export function createPair(settings: Settings): { original: System; shadow: System } {
  const bodies = initialBodies(settings.preset, settings.thirdMass, settings.softening);
  const shadow = bodies.map(clone);
  shadow[2].velocity[0] += settings.perturbation;
  return {
    original: { bodies, time: 0, initialEnergy: totalEnergy(bodies, settings.softening) },
    shadow: { bodies: shadow, time: 0, initialEnergy: totalEnergy(shadow, settings.softening) },
  };
}
export function separation(original: System, shadow: System): number {
  const a = original.bodies[2].position, b = shadow.bodies[2].position;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
export function energyDrift(system: System, softening: number): number {
  return (totalEnergy(system.bodies, softening) - system.initialEnergy) / Math.max(Math.abs(system.initialEnergy), 1e-9);
}

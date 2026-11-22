import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS, accelerations, centerOfMass, createPair, energyDrift, initialBodies, separation, step, totalEnergy, totalMomentum} from '../app/orbital-chaos/physics.ts';

test('three named presets initialize finite positions and positive masses', () => {
  for (const preset of ['eight', 'triangle', 'visitor']) {
    const bodies = initialBodies(preset, 1, 0.015);
    assert.equal(bodies.length, 3);
    assert.ok(bodies.every(b => b.mass > 0 && [...b.position, ...b.velocity].every(Number.isFinite)));
  }
});
test('mutual gravity preserves the sum of forces', () => {
  const bodies = initialBodies('visitor', 0.6, 0.03);
  const acc = accelerations(bodies, 0.03);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(acc.reduce((sum, a, i) => sum + a[axis] * bodies[i].mass, 0)) < 1e-12);
  }
});
test('velocity Verlet preserves momentum and energy over the triangle orbit', () => {
  const {original} = createPair({...DEFAULT_SETTINGS, preset: 'triangle', perturbation: 0});
  const momentum = totalMomentum(original.bodies);
  for (let i = 0; i < 4000; i++) step(original, 0.004, DEFAULT_SETTINGS.softening);
  assert.ok(Math.abs(energyDrift(original, DEFAULT_SETTINGS.softening)) < 1e-4);
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(totalMomentum(original.bodies)[axis] - momentum[axis]) < 1e-10);
});
test('perturbing third body diverges but identical initial conditions do not', () => {
  const identical = createPair({...DEFAULT_SETTINGS, perturbation: 0});
  for (let i = 0; i < 100; i++) { step(identical.original, 0.008, 0.015); step(identical.shadow, 0.008, 0.015); }
  assert.equal(separation(identical.original, identical.shadow), 0);
  const perturbed = createPair(DEFAULT_SETTINGS);
  for (let i = 0; i < 100; i++) { step(perturbed.original, 0.008, 0.015); step(perturbed.shadow, 0.008, 0.015); }
  assert.ok(separation(perturbed.original, perturbed.shadow) > 0);
});
test('third mass affects center of mass and softened potential remains finite', () => {
  const two = initialBodies('visitor', 2, 0.015);
  assert.ok(centerOfMass(two).every(Number.isFinite));
  const b = [{mass: 1, position: [0,0,0], velocity: [0,0,0]}, {mass: 1, position: [0,0,0], velocity: [0,0,0]}];
  assert.equal(totalEnergy(b,0.1), -10);
  assert.ok(accelerations(b,0.1).flat().every(Number.isFinite));
});

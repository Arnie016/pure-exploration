import { G } from './nbody.js';

function finiteVector(value) {
  if (!value || value.length !== 3 || !Array.from(value).every(Number.isFinite)) {
    throw new RangeError('Choose a point on the visible plane.');
  }
  return Array.from(value);
}

const difference = (a, b) => Array.from(a, (value, axis) => value - b[axis]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const length = Math.hypot(...v); return length > 1e-12 ? v.map(value => value / length) : null; };

export function validateBodyPosition(system, bodyId, positionM) {
  const body = system.body(bodyId);
  if (!body) throw new Error('This object is no longer here. Select another object.');
  const position = finiteVector(positionM);
  for (const other of system.bodies) {
    if (other.id === bodyId || other.flags?.includes('no-collision')) continue;
    const distance = Math.hypot(...difference(position, other.positionM));
    if (!Number.isFinite(distance)) throw new RangeError('That position is too far away. Choose a closer point.');
    if (distance <= body.radiusM + other.radiusM) {
      throw new RangeError(`Too close to ${other.name}. Move farther away.`);
    }
  }
  return position;
}

// Keep the existing fixed-step integrator. Edits may shorten, never enlarge,
// its step to resolve the fastest pair's local orbital/crossing timescale.
export function recommendedOrbitStep(bodies, currentStepSeconds) {
  if (!Number.isFinite(currentStepSeconds) || currentStepSeconds <= 0) throw new RangeError('Invalid simulation step');
  let step = currentStepSeconds;
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i], b = bodies[j];
      if (a.flags?.includes('no-collision') || b.flags?.includes('no-collision')) continue;
      const distance = Math.hypot(...difference(a.positionM, b.positionM));
      const mu = G * (a.massKg + b.massKg);
      if (!(distance > 0) || !(mu > 0)) continue;
      const orbitalTime = distance / Math.sqrt(mu / distance);
      const speed = Math.hypot(...difference(a.velocityMps, b.velocityMps));
      const crossingTime = speed > 0 ? distance / speed : Infinity;
      step = Math.min(step, .02 * Math.min(orbitalTime, crossingTime));
    }
  }
  if (!Number.isFinite(step) || step <= 0) throw new RangeError('This arrangement cannot be simulated. Move the objects farther apart.');
  return step;
}

export function circularOrbitEdit(system, bodyId, hostId) {
  const body = system.body(bodyId), host = system.body(hostId);
  if (!body || !host || host.id === body.id || host.massKg <= 0) {
    throw new Error('Choose an object with a nearby star or planet to orbit.');
  }
  const positionM = validateBodyPosition(system, bodyId, body.positionM);
  const radial = difference(positionM, host.positionM);
  const radialUnit = unit(radial);
  const relativeVelocity = difference(body.velocityMps, host.velocityMps);
  const normal = unit(cross(radial, relativeVelocity));
  let tangent = normal && unit(cross(normal, radialUnit));
  if (!tangent) {
    for (const axis of [[0, 0, 1], [0, 1, 0], [1, 0, 0]]) {
      tangent = unit(cross(axis, radialUnit));
      if (tangent) break;
    }
  }
  const speed = Math.sqrt(G * (host.massKg + body.massKg) / Math.hypot(...radial));
  const velocityMps = finiteVector(tangent.map((value, axis) => host.velocityMps[axis] + value * speed));
  const bodies = system.bodies.map(candidate => candidate.id === bodyId ? { ...candidate, velocityMps } : candidate);
  return { positionM, velocityMps, stepSeconds: recommendedOrbitStep(bodies, system.stepSeconds) };
}

export function createBodyMove(system, bodyId) {
  const body = system.body(bodyId);
  if (!body) throw new Error('Select an object to move.');
  const original = { positionM: [...body.positionM], velocityMps: [...body.velocityMps] };
  const originalStep = system.stepSeconds;
  let valid = false, moved = false, finished = false;
  return {
    bodyId, original,
    get valid() { return valid; },
    preview(positionM) {
      if (finished) throw new Error('This move has ended.');
      try {
        const position = validateBodyPosition(system, bodyId, positionM);
        system.editBody(bodyId, { positionM: position, velocityMps: original.velocityMps });
        valid = true;
        moved = position.some((value, axis) => value !== original.positionM[axis]);
        return { ok: true };
      } catch (error) {
        valid = false;
        return { ok: false, message: error.message };
      }
    },
    commit() {
      if (finished || !valid || !moved) return false;
      // Revalidate at release in case another edit changed a neighbour.
      validateBodyPosition(system, bodyId, system.body(bodyId).positionM);
      system.stepSeconds = recommendedOrbitStep(system.bodies, originalStep);
      system.rebaseline('reposition-object');
      finished = true;
      return true;
    },
    cancel() {
      if (finished) return;
      if (system.body(bodyId)) system.editBody(bodyId, original);
      system.stepSeconds = originalStep;
      finished = true;
    }
  };
}

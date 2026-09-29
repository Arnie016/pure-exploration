import { DAY_S, NBodySystem } from './nbody.js';

// A separate copy of the live solver. Previewing must never edit the experiment.
export function createTrajectoryPreview(source, { durationSeconds = 30 * DAY_S, maxSteps = 4096, maxSamples = 256 } = {}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new RangeError('Preview duration must be positive');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || !Number.isInteger(maxSamples) || maxSamples < 2) throw new RangeError('Invalid preview budget');
  const solver = new NBodySystem({
    bodies: source.bodies.map(body => ({ ...body, positionM: [...body.positionM], velocityMps: [...body.velocityMps] })),
    stepSeconds: source.stepSeconds,
    collisionMode: source.collisionMode,
    ...source.fieldOptions()
  });
  solver.timeSeconds = source.timeSeconds;
  const requestedSteps = Math.max(1, Math.ceil(durationSeconds / solver.stepSeconds));
  const targetSteps = Math.min(requestedSteps, maxSteps);
  const sampleEvery = Math.max(1, Math.ceil(targetSteps / (maxSamples - 1)));
  const paths = source.bodies.map(body => ({ id: body.id, color: body.color, points: [[...body.positionM]] }));
  const startTime = source.timeSeconds;
  let completedSteps = 0;
  let collision = null;
  function sample() {
    for (const path of paths) {
      const body = solver.body(path.id);
      if (body) path.points.push([...body.positionM]);
      else if (collision?.absorbedId === path.id) path.points.push([...collision.impactPositionM]);
    }
  }
  return {
    paths,
    get done() { return completedSteps >= targetSteps || collision !== null; },
    get progress() { return this.done ? 1 : completedSteps / targetSteps; },
    get durationSeconds() { return solver.timeSeconds - startTime; },
    get limited() { return requestedSteps > maxSteps; },
    get collision() { return collision; },
    advance(budget = 64) {
      if (!Number.isInteger(budget) || budget < 1) throw new RangeError('Preview batch must be positive');
      for (let index = 0; index < budget && !this.done; index += 1) {
        solver.step();
        completedSteps += 1;
        collision = solver.events.find(event => event.type === 'collision.merged') || null;
        if (completedSteps % sampleEvery === 0 || this.done) sample();
      }
      return this.done;
    }
  };
}

const C_M_S = 299_792_458;
const DEFAULT_SEPARATION_M = 225_000_000_000;

function finiteVector(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((component) => Number.isFinite(Number(component)));
}

export function simultaneitySnapshot({ eventA = null, eventB = null, beta = 0.1 } = {}) {
  const boundedBeta = Math.max(0.01, Math.min(0.5, Number(beta) || 0.1));
  const ready = finiteVector(eventA?.positionM) && finiteVector(eventB?.positionM);
  const separationM = ready
    ? Math.hypot(...eventB.positionM.map((component, index) => component - eventA.positionM[index]))
    : DEFAULT_SEPARATION_M;
  const gamma = 1 / Math.sqrt(1 - boundedBeta ** 2);
  const lightCrossingSeconds = separationM / C_M_S;
  const rocketFrameDeltaSeconds = gamma * boundedBeta * lightCrossingSeconds;
  return {
    model: 'Lorentz transform in flat spacetime',
    frame: 'Sun frame events are simultaneous at t=0',
    beta: boundedBeta,
    gamma,
    ready,
    placedEventCount: Number(Boolean(eventA)) + Number(Boolean(eventB)),
    separationM,
    lightCrossingSeconds,
    rocketFrameDeltaSeconds,
    equation: 't_prime = gamma * (t - v*x/c^2); t_B_prime = -gamma*v*L/c^2',
    classification: 'spacelike-separated events',
    caveat: 'This is simultaneity convention for distant events, not light-travel delay or time dilation.'
  };
}

export function rocketPositionBetween(eventA, eventB, progress) {
  if (!finiteVector(eventA?.positionM) || !finiteVector(eventB?.positionM)) return null;
  const boundedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  return eventA.positionM.map((component, index) => (
    component + (eventB.positionM[index] - component) * boundedProgress
  ));
}

export function simultaneityPlayback({ phase = 0, snapshot = null } = {}) {
  const normalizedPhase = ((Number(phase) || 0) % 1 + 1) % 1;
  const lightCrossingSeconds = Math.max(1, Number(snapshot?.lightCrossingSeconds) || 1);
  const rocketDeltaSeconds = Math.max(0, Number(snapshot?.rocketFrameDeltaSeconds) || 0);
  // This maps the derived time gap into a bounded visual loop; it is not a clock or signal-arrival model.
  const rocketGap = Math.max(.12, Math.min(.42, (rocketDeltaSeconds / lightCrossingSeconds) * .75));
  const eventWindow = .16;
  const sunStart = .18;
  const rocketMarsStart = .14;
  const rocketEarthStart = rocketMarsStart + rocketGap;
  const envelope = (start) => {
    const local = (normalizedPhase - start) / eventWindow;
    return local <= 0 || local >= 1 ? 0 : Math.sin(Math.PI * local) ** 2;
  };
  return {
    classification: 'ILLUSTRATIVE normalized event timeline',
    phase: normalizedPhase,
    eventWindow,
    sun: { earth: envelope(sunStart), mars: envelope(sunStart), simultaneous: true },
    rocket: {
      mars: envelope(rocketMarsStart),
      earth: envelope(rocketEarthStart),
      marsStart: rocketMarsStart,
      earthStart: rocketEarthStart,
      order: 'Mars before Earth'
    },
    caveat: 'Visual playback order only; it does not represent light-arrival timing.'
  };
}

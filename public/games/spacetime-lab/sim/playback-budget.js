// Keep the solver's physical step fixed. If rendering cannot keep up, slow
// simulated time instead of carrying an unbounded queue into later frames.
export function planPlaybackFrame({ elapsedSeconds, rateSecondsPerSecond, stepSeconds, remainder = 0, maxSteps = 240 }) {
  if (![elapsedSeconds, rateSecondsPerSecond, stepSeconds, remainder].every(Number.isFinite)
    || elapsedSeconds < 0 || rateSecondsPerSecond < 0 || stepSeconds <= 0 || remainder < 0
    || !Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('Invalid playback clock input');
  const requested = Math.min(elapsedSeconds, .1) * rateSecondsPerSecond / stepSeconds + remainder;
  const whole = Math.floor(requested);
  return { steps: Math.min(whole, maxSteps), remainder: requested - whole, limited: whole > maxSteps };
}

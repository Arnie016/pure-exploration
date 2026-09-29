export const RECENT_TRAJECTORY_LIMIT = 280;
export const PERSISTENT_TRAJECTORY_LIMIT = 4_096;

function trajectoryLimit(persistent) {
  return persistent ? PERSISTENT_TRAJECTORY_LIMIT : RECENT_TRAJECTORY_LIMIT;
}

export function trimTrajectory(trail, { persistent = false } = {}) {
  if (!Array.isArray(trail)) throw new TypeError('trail must be an array');
  const overflow = trail.length - trajectoryLimit(persistent);
  if (overflow > 0) trail.splice(0, overflow);
  return trail;
}

export function appendTrajectoryPoint(trail, point, { persistent = false } = {}) {
  const vector = Array.isArray(point) || (ArrayBuffer.isView(point) && !(point instanceof DataView))
    ? Array.from(point)
    : null;
  if (!vector || vector.length !== 3 || vector.some((value) => !Number.isFinite(value))) {
    throw new TypeError('trajectory point must contain three finite coordinates');
  }
  trail.push(vector);
  return trimTrajectory(trail, { persistent });
}

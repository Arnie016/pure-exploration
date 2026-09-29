const DEFAULT_MINIMUM_WIDTH_M = 50_000_000;

function finiteVector(value) {
  return (Array.isArray(value) || ArrayBuffer.isView(value))
    && value.length === 3
    && value.every(Number.isFinite);
}

// The renderer accepts world coordinates. A reference origin is a camera
// destination, not an offset to subtract from that destination a second time.
export function cameraCenterInWorld(center, { reference = 'barycentric', starPosition, fixedOrigin, focus = false } = {}) {
  const fallback = finiteVector(center) ? [...center] : [0, 0, 0];
  if (focus) return fallback;
  if (reference === 'heliocentric' && finiteVector(starPosition)) return [...starPosition];
  if (reference === 'galactocentric' && finiteVector(fixedOrigin)) return [...fixedOrigin];
  return fallback;
}

export function barycentricSystemView(bodies, {
  padding = 1.25,
  minimumWidthM = DEFAULT_MINIMUM_WIDTH_M,
  maximumWidthM = Number.POSITIVE_INFINITY,
  singleBodyRadiusMultiplier = 32
} = {}) {
  if (!Array.isArray(bodies) || bodies.length === 0) return null;
  const visible = bodies.filter((body) => finiteVector(body?.positionM));
  if (visible.length === 0) return null;

  const massive = visible.filter((body) => Number.isFinite(body.massKg) && body.massKg > 0);
  const anchors = massive.length > 0 ? massive : visible;
  const totalMass = massive.reduce((sum, body) => sum + body.massKg, 0);
  const center = [0, 1, 2].map((axis) => {
    if (totalMass > 0) return massive.reduce((sum, body) => sum + body.positionM[axis] * body.massKg, 0) / totalMass;
    return anchors.reduce((sum, body) => sum + body.positionM[axis], 0) / anchors.length;
  });

  const largestRadiusM = Math.max(...visible.map((body) => Number.isFinite(body.radiusM) ? Math.max(0, body.radiusM) : 0));
  const furthestExtentM = Math.max(...visible.map((body) => {
    const distanceM = Math.hypot(...body.positionM.map((value, axis) => value - center[axis]));
    return distanceM + (Number.isFinite(body.radiusM) ? Math.max(0, body.radiusM) : 0);
  }));
  const contentWidthM = visible.length === 1
    ? largestRadiusM * singleBodyRadiusMultiplier
    : furthestExtentM * 2 * padding;
  const widthM = Math.min(maximumWidthM, Math.max(minimumWidthM, contentWidthM));

  return { center, widthM };
}

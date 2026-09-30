// Presentation preferences never change simulation difficulty or resource costs.
export const QUALITY = Object.freeze({
  low: { label:'Performance', dpr:1, mobileDpr:1, shadow:0, particles:.4 },
  balanced: { label:'Balanced', dpr:1.35, mobileDpr:1.15, shadow:1024, particles:.75 },
  high: { label:'High', dpr:1.75, mobileDpr:1.35, shadow:2048, particles:1 },
  ultra: { label:'Ultra', dpr:2, mobileDpr:1.5, shadow:2048, particles:1.25 },
});
export const DEFAULT_PRESENTATION = Object.freeze({quality:'balanced', sensitivity:1, distance:7.6, fov:62, invertY:false, aimAssist:true});
const bounded = (value, fallback, low, high) => Number.isFinite(value) ? Math.max(low,Math.min(high,value)) : fallback;
export function normalizePresentation(value) {
  const p = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    quality:Object.hasOwn(QUALITY,p.quality) ? p.quality : DEFAULT_PRESENTATION.quality,
    sensitivity:bounded(p.sensitivity,1,.4,2),
    distance:bounded(p.distance,7.6,6,12),
    fov:bounded(p.fov,62,50,85),
    invertY:p.invertY === true,
    aimAssist:p.aimAssist !== false,
  };
}

// Resolve shoulder-camera parallax against the point under the reticle. Rays
// originate at the camera; projectiles still originate at the fighter's torso.
export function resolveViewAim(fighter, origin, direction, fighters = [], props = []) {
  const length = Math.hypot(direction?.x,direction?.y,direction?.z);
  if (!fighter || !origin || !Number.isFinite(length) || length < .001 ||
      ![origin.x,origin.y,origin.z,fighter.x,fighter.y,fighter.z].every(Number.isFinite)) return null;
  const ray = {x:direction.x/length,y:direction.y/length,z:direction.z/length};
  const chest = {x:fighter.x,y:fighter.y+1.5,z:fighter.z};
  const ahead = (chest.x-origin.x)*ray.x+(chest.y-origin.y)*ray.y+(chest.z-origin.z)*ray.z;
  let distance = Math.max(60,ahead+2);
  const sphere = (x,y,z,radius) => {
    const dx=x-origin.x,dy=y-origin.y,dz=z-origin.z;
    const along=dx*ray.x+dy*ray.y+dz*ray.z;
    const perpendicular=dx*dx+dy*dy+dz*dz-along*along;
    if (perpendicular > radius*radius) return;
    const entry=along-Math.sqrt(Math.max(0,radius*radius-perpendicular));
    if (entry > Math.max(.1,ahead+.4) && entry < distance) distance=entry;
  };
  for (const target of fighters) if (target !== fighter && target.alive && target.hp > 0) sphere(target.x,target.y+1.5,target.z,.85);
  for (const prop of props) if (prop.hp > 0 && prop.heldBy === -1 && !prop.respawn) sphere(prop.x,prop.y,prop.z,prop.radius || .9);
  if (ray.y < -.001) {
    const ground=(.1-origin.y)/ray.y;
    if (ground > Math.max(.1,ahead+.4) && ground < distance) distance=ground;
  }
  const x=origin.x+ray.x*distance-chest.x,y=origin.y+ray.y*distance-chest.y,z=origin.z+ray.z*distance-chest.z;
  const norm=Math.hypot(x,y,z);
  return norm>.001 ? {x:x/norm,y:y/norm,z:z/norm} : ray;
}

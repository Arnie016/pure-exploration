// Shared by the authoritative simulation and HUD: prompts describe real rules.
export const PICKUP_RADIUS = 6.5;
export const PICKUP_COST = 10;
export const BLINK_COST = 16;
export const BLINK_DISTANCE = 6;
export const BLINK_COOLDOWN = 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function normalizedAim(input = {}) {
  const { aimX:x, aimY:y = 0, aimZ:z } = input;
  if (![x,y,z].every(Number.isFinite)) return null;
  const length = Math.hypot(x,y,z);
  if (length < .001) return null;
  return {x:x / length, y:y / length, z:z / length};
}

export function pickupCandidate(fighter, props = [], aim = null) {
  if (!fighter?.alive) return null;
  let best = null, bestScore = Infinity;
  for (const prop of props) {
    if (prop.heldBy !== -1 || prop.hp <= 0 || prop.respawn !== 0) continue;
    const x = prop.x-fighter.x, y = prop.y-fighter.y-1.5, z = prop.z-fighter.z;
    const distance = Math.hypot(x,y,z);
    if (distance > PICKUP_RADIUS) continue;
    // Nearby objects remain selectable even when slightly behind the fighter.
    const alignment = aim ? (x*aim.x+y*aim.y+z*aim.z)/(distance || 1) : 0;
    const score = distance - alignment * 1.6;
    if (score < bestScore || score === bestScore && prop.id < best.id) { best = prop; bestScore = score; }
  }
  return best;
}

// Aim assistance uses the same narrow cone in the HUD and the authoritative
// simulation, and can acquire any living opponent in a crowded arena.
export function aimCandidate(fighter, fighters = [], aim, positions = fighters) {
  const own = fighters.indexOf(fighter), origin = positions[own];
  if (own < 0 || !fighter.alive || !origin || !aim) return null;
  const norm = Math.hypot(aim.x,aim.y,aim.z);
  if (!Number.isFinite(norm) || norm < .001) return null;
  let best = null, bestScore = Infinity;
  for (let slot=0;slot<fighters.length;slot++) {
    if (slot === own || !fighters[slot].alive || fighters[slot].hp <= 0) continue;
    const target=positions[slot];
    if (!target) continue;
    const x=target.x-origin.x,y=target.y-origin.y,z=target.z-origin.z;
    const distance=Math.hypot(x,y,z);
    if (distance < .001 || distance > 60) continue;
    const alignment=(x*aim.x+y*aim.y+z*aim.z)/(distance*norm);
    if (alignment < Math.cos(.13)) continue;
    const score=(1-alignment)*80+distance*.001;
    if (score < bestScore) {
      best={slot,distance,direction:{x:x/distance,y:y/distance,z:z/distance}};
      bestScore=score;
    }
  }
  return best;
}

export function powerReadiness(fighter, forms, maxEnergy = 100) {
  const next = forms[fighter.form + 1];
  const ki = Math.floor(fighter.energy);
  const busy = !['idle','run','charge','flight','jump'].includes(fighter.action) ||
    fighter.dodgeTime > 0 || fighter.vanishTime > 0 || fighter.regeneration > 0 || fighter.heldProp >= 0 || fighter.clashId >= 0;
  const kiMissing = next ? Math.max(0, Math.ceil(next.kiCost-fighter.energy-1e-8)) : 0;
  const resolveMissing = next ? Math.max(0, Math.ceil(next.minResolve-fighter.resolve-1e-8)) : 0;
  const ready = !!next && !kiMissing && !resolveMissing && !busy && fighter.alive;
  const moving = Math.hypot(fighter.vx || 0, fighter.vz || 0) > .2;
  const airborne = Math.abs(fighter.vy || 0) > .01 || (!fighter.flight && fighter.y > .01);
  const charge = !fighter.alive ? 'Unavailable after knockout' : fighter.energy >= maxEnergy-.01 ? 'Ki full' : busy ? 'Finish your move to charge' : moving ? 'Stop moving, then hold T' : airborne ? 'Land or hover, then hold T' : fighter.action === 'charge' ? 'Charging Ki — release T to stop' : 'Hold T to charge Ki';
  const reason = !next ? 'Maximum form reached' : resolveMissing ? `Earn ${resolveMissing} more Resolve by landing hits` : kiMissing ? `Charge ${kiMissing} more Ki — hold T` : busy ? 'Finish your move, then press R' : 'Ready — press R to transform';
  return {next, ki, kiMissing, resolveMissing, busy, ready, charge, reason,
    kiProgress:next ? clamp(fighter.energy/next.kiCost,0,1) : 1,
    resolveProgress:next ? clamp(fighter.resolve/next.minResolve,0,1) : 1};
}

export function actionReason(fighter, action, cost = 0) {
  if (!fighter?.alive) return 'You are knocked out';
  if (fighter.energy + 1e-8 < cost) return `Need ${Math.ceil(cost-fighter.energy)} more Ki — hold T`;
  const cooldown = action === 'dodge' ? fighter.dodgeCooldown : fighter.cooldowns?.[action];
  if (cooldown > .01) return `Ready in ${cooldown.toFixed(1)}s`;
  if (['hurt','down','transform','lift','throw','regenerate','surge'].includes(fighter.action)) return 'Finish your current move first';
  return '';
}

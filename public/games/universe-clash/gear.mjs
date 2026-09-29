export const GEAR_SLOTS = Object.freeze(['head', 'shoulders', 'arms', 'waist', 'aura']);

// Modifiers are small additive bonuses, never client-supplied stat multipliers.
export const ATTACHMENTS = Object.freeze([
  { id: 'head-scouter', name: 'Training Scouter', slot: 'head', description: 'A colored eye lens. +1.5% power, +2% charge.', modifiers: { power: .015, charge: .02 } },
  { id: 'head-halo', name: 'Focus Halo', slot: 'head', description: 'A floating practice ring. +4% resolve.', modifiers: { resolve: .04 } },
  { id: 'shoulder-cape', name: 'Mentor Cape', slot: 'shoulders', description: 'A short shoulder cape. +1.5% speed, +1% guard.', modifiers: { speed: .015, guard: .01 } },
  { id: 'shoulder-weights', name: 'Training Weights', slot: 'shoulders', description: 'Paired shoulder weights. +2.5% power, +2% guard.', modifiers: { power: .025, guard: .02 } },
  { id: 'arm-wraps', name: 'Sparring Wraps', slot: 'arms', description: 'Bright forearm wraps. +2% speed, +2% resolve.', modifiers: { speed: .02, resolve: .02 } },
  { id: 'arm-bracers', name: 'Guard Bracers', slot: 'arms', description: 'Hard forearm cuffs. +1.5% power, +2% guard.', modifiers: { power: .015, guard: .02 } },
  { id: 'waist-sash', name: 'Flow Sash', slot: 'waist', description: 'A trailing cloth sash. +2% speed, +2% charge.', modifiers: { speed: .02, charge: .02 } },
  { id: 'waist-belt', name: 'Resolve Belt', slot: 'waist', description: 'A broad belt and buckle. +2% guard, +3% resolve.', modifiers: { guard: .02, resolve: .03 } },
  { id: 'aura-sparks', name: 'Ki Sparks', slot: 'aura', description: 'Small training sparks. +2% power, +3% charge.', modifiers: { power: .02, charge: .03 } },
  { id: 'aura-orbit', name: 'Orbit Wisps', slot: 'aura', description: 'Orbiting motes of light. +2% charge, +4% resolve.', modifiers: { charge: .02, resolve: .04 } },
].map((item) => Object.freeze({ ...item, modifiers: Object.freeze(item.modifiers) })));

const byId = new Map(ATTACHMENTS.map((item) => [item.id, item]));

export function normalizeLoadout(value) {
  if (!Array.isArray(value)) return [];
  const slots = new Set();
  const ids = [];
  for (const id of value) {
    const item = byId.get(id);
    if (!item || slots.has(item.slot)) continue;
    slots.add(item.slot);
    ids.push(id);
    if (ids.length === GEAR_SLOTS.length) break;
  }
  return ids;
}

export function validateLoadout(value) {
  if (!Array.isArray(value) || value.length > GEAR_SLOTS.length) return false;
  // Reject sparse/decorated arrays as well as objects containing ids plus stats/tint.
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  const slots = new Set();
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i)) return false;
    const item = byId.get(value[i]);
    if (!item || slots.has(item.slot)) return false;
    slots.add(item.slot);
  }
  return true;
}

export function getLoadoutStats(ids) {
  const stats = { power: 1, speed: 1, charge: 1, guard: 0, resolve: 1 };
  const caps = { power: 1.08, speed: 1.06, charge: 1.08, guard: .08, resolve: 1.10 };
  for (const id of normalizeLoadout(ids)) {
    for (const [stat, bonus] of Object.entries(byId.get(id).modifiers)) {
      stats[stat] = Math.min(caps[stat], stats[stat] + bonus);
    }
  }
  for (const stat of Object.keys(stats)) stats[stat] = Number(stats[stat].toFixed(6));
  return stats;
}

export function randomLoadout(seed = 1) {
  if (!Number.isSafeInteger(seed)) throw new TypeError('Seed must be a safe integer.');
  let state = seed >>> 0;
  return GEAR_SLOTS.map((slot) => {
    state = (state + 0x6D2B79F5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    const roll = ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    const choices = ATTACHMENTS.filter((item) => item.slot === slot);
    return choices[Math.floor(roll * choices.length)].id;
  });
}

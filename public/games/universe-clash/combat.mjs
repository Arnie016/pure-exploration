import { ROSTER, FORMS, STAGES } from './catalog.mjs';
import { normalizeLoadout, getLoadoutStats, randomLoadout } from './gear.mjs';
import { pickupCandidate, aimCandidate, normalizedAim, PICKUP_COST, BLINK_COST, BLINK_DISTANCE, BLINK_COOLDOWN } from './readability.mjs';
export { ROSTER } from './catalog.mjs';

export const MAX_HP = 1000;
export const MAX_ENERGY = 100;

const STATS = Object.fromEntries(ROSTER.map((f) => [f.id, f]));
// All multipliers, mastery thresholds and ratings are original game balance, not canon.
const KI_POWER = { goku: 1, vegeta: 1.15, jiren: 0.95, frieza: 1.08, beerus: 1.18, gohan: 1.04, piccolo: 1.12, trunks: 0.96, android18: 1, cell: 1.08, buu: 1.06, hit: 0.98, broly: 1.12, android17: 1.03, krillin: 1.02, tien: 1.14 };
const LEVELS = [300, 800, 1500, 2400];
const AURA = { combo: 25, 'skill-chain': 40, 'round-win': 100, 'match-win': 200, 'pit-win': 200 };
const KEYS = ['left', 'right', 'forward', 'back', 'jump', 'flight', 'targetNext', 'guard', 'light', 'heavy', 'blast', 'beam', 'ultimate', 'dash', 'dodge', 'vanish', 'grab', 'interact', 'drop', 'charge', 'transform', 'special', 'clashBoost'];
const CLASH = { limit: 6, duration: 18, boostCost: 4, boostCooldown: 0.3, boost: 0.55, cueBoost: 0.95, braceCost: 2, bracePower: 0.35, decay: 2, pressure: 0.22, powerCap: 6, releaseCap: 450 };
const SPLASH = { blast: 1.6, beam: 2.8, ultimate: 6 };
const ATTACKS = {
  light: { windup: 0.10, duration: 0.30, damage: 58, reach: 2.1, stun: 0.23, knock: 2.4, cost: 0, cooldown: 0 },
  heavy: { windup: 0.27, duration: 0.66, damage: 138, reach: 2.2, stun: 0.44, knock: 11, cost: 0, cooldown: 0.7 },
  blast: { windup: 0.11, duration: 0.29, damage: 80, speed: 19, radius: 0.24, life: 1.4, stun: 0.21, knock: 4, cost: 8, cooldown: 0.35 },
  beam: { windup: 0.48, duration: 0.94, damage: 220, speed: 48, radius: 0.48, life: 0.65, stun: 0.48, knock: 10, cost: 35, cooldown: 3 },
  ultimate: { windup: 0.90, duration: 1.50, damage: 375, speed: 30, radius: 0.9, life: 1.1, stun: 0.7, knock: 15, cost: 100, cooldown: 8 },
};
const SPECIALS = {
  goku: { type: 'rush', windup: 0.28, duration: 0.70, damage: 116, reach: 2.5, rush: 15, stun: 0.38, knock: 8 },
  vegeta: { type: 'volley', windup: 0.18, duration: 0.72, damage: 50, shots: 3, interval: 0.12, speed: 24, radius: 0.24, life: 1.2, stun: 0.16, knock: 2.5 },
  jiren: { type: 'barrier', windup: 0.16, duration: 0.95, barrier: 0.55, damage: 100, reach: 2.8, stun: 0.30, knock: 9 },
  frieza: { type: 'precision', windup: 0.30, duration: 0.62, damage: 147, speed: 31, radius: 0.16, life: 0.85, stun: 0.35, knock: 5 },
  beerus: { type: 'flick', windup: 0.12, duration: 0.48, damage: 162, reach: 1.8, stun: 0.42, knock: 14 },
  gohan: { type: 'rush', windup: 0.24, duration: 0.72, damage: 123, reach: 2.4, rush: 14, stun: 0.42, knock: 7.5 },
  piccolo: { type: 'precision', windup: 0.34, duration: 0.74, damage: 151, speed: 26, radius: 0.34, life: 1, stun: 0.44, knock: 8 },
  trunks: { type: 'rush', windup: 0.18, duration: 0.58, damage: 112, reach: 3, rush: 18, stun: 0.30, knock: 6 },
  android18: { type: 'volley', windup: 0.16, duration: 0.64, damage: 30, shots: 4, interval: 0.10, speed: 22, radius: 0.23, life: 1.35, stun: 0.13, knock: 1.7 },
  cell: { type: 'barrier', windup: 0.20, duration: 0.80, barrier: 0.42, damage: 91, reach: 3.3, stun: 0.32, knock: 6 },
  buu: { type: 'precision', windup: 0.24, duration: 0.62, damage: 136, speed: 17, radius: 0.60, life: 1.4, stun: 0.52, knock: 3 },
  hit: { type: 'timeSkip', windup: 0.26, duration: 0.68, damage: 136, reach: 1.9, skip: 2.6, stun: 0.46, knock: 6 },
  broly: { type: 'rush', windup: 0.36, duration: 0.92, damage: 162, reach: 2.8, rush: 10, stun: 0.50, knock: 13 },
  android17: { type: 'barrier', windup: 0.18, duration: 0.84, barrier: 0.48, damage: 97, reach: 3.1, stun: 0.32, knock: 7 },
  krillin: { type: 'precision', windup: 0.25, duration: 0.60, damage: 133, speed: 27, radius: 0.42, life: 1.1, stun: 0.32, knock: 4 },
  tien: { type: 'volley', windup: 0.35, duration: 0.88, damage: 69, shots: 2, interval: 0.20, speed: 29, radius: 0.45, life: 1.1, stun: 0.24, knock: 4 },
};
const AI_STYLES = {
  adaptive:  { range: 1.7, defense: 0.70, ki: 0.48, heavy: 0.26, special: 0.45, reserve: 30, dash: 0.20, jump: 0.10, learning: 0.85 },
  pressure:  { range: 3.7, defense: 0.44, ki: 0.95, heavy: 0.22, special: 0.65, reserve: 38, dash: 0.12, jump: 0.06, learning: 0.30 },
  counter:   { range: 1.8, defense: 0.94, ki: 0.28, heavy: 0.62, special: 0.70, reserve: 24, dash: 0.08, jump: 0.05, learning: 0.60 },
  zoner:     { range: 5.8, defense: 0.55, ki: 1.00, heavy: 0.12, special: 0.72, reserve: 32, dash: 0.16, jump: 0.18, learning: 0.45 },
  reactive:  { range: 1.8, defense: 0.86, ki: 0.52, heavy: 0.38, special: 0.55, reserve: 30, dash: 0.18, jump: 0.12, learning: 0.75 },
  tactical:  { range: 4.3, defense: 0.74, ki: 0.85, heavy: 0.36, special: 0.78, reserve: 36, dash: 0.10, jump: 0.10, learning: 0.95 },
  rush:      { range: 1.4, defense: 0.32, ki: 0.24, heavy: 0.35, special: 0.82, reserve: 20, dash: 0.48, jump: 0.12, learning: 0.20 },
  efficient: { range: 2.5, defense: 0.64, ki: 0.62, heavy: 0.18, special: 0.76, reserve: 24, dash: 0.14, jump: 0.08, learning: 0.55 },
  erratic:   { range: 3.0, defense: 0.34, ki: 0.65, heavy: 0.50, special: 0.64, reserve: 28, dash: 0.26, jump: 0.28, learning: 0.15 },
  assassin:  { range: 2.6, defense: 0.88, ki: 0.22, heavy: 0.40, special: 0.94, reserve: 26, dash: 0.32, jump: 0.09, learning: 1.00 },
  berserker: { range: 1.3, defense: 0.24, ki: 0.26, heavy: 0.68, special: 0.86, reserve: 22, dash: 0.30, jump: 0.07, learning: 0.10 },
};
const DIFFICULTIES = {
  easy: { reaction: 0.36, decision: 0.22, defense: 0.60, prediction: 0 },
  normal: { reaction: 0.22, decision: 0.13, defense: 0.85, prediction: 0.5 },
  hard: { reaction: 0.12, decision: 0.09, defense: 1, prediction: 0.8 },
};
const AI_VARIANTS = {
  android17: { range: 3.2, defense: 0.84, special: 0.84 },
  krillin: { range: 4.9, heavy: 0.14, jump: 0.24, ki: 0.75 },
  tien: { range: 4.6, defense: 0.62, ki: 0.88, special: 0.85, jump: 0.02 },
};
// Behavior nodes: probabilistic stances layered over plan intents. Each node shifts
// preferred range and attack/defense bias for 1.6-3.2s. Selection is seeded
// categorical sampling over observed public state only, never hidden inputs.
const BEHAVIOR_NODES = {
  press:  { range: 0, aggression: 1.25, defense: 0.8 },
  zone:   { range: 1.6, aggression: 0.85, defense: 1.0 },
  bait:   { range: -0.6, aggression: 0.7, defense: 1.35 },
  lurk:   { range: 2.2, aggression: 0.55, defense: 1.1 },
  pounce: { range: -1.2, aggression: 1.6, defense: 0.7 },
};
const NODE_STYLE_BIAS = {
  pressure: { press: 1.6 }, counter: { bait: 1.8 }, zoner: { zone: 1.6 },
  rush: { press: 1.6 }, reactive: { bait: 1.4 }, tactical: { zone: 1.3 },
  efficient: { lurk: 1.5 }, erratic: { pounce: 1.4 }, assassin: { pounce: 1.6 },
  berserker: { pounce: 1.7 }, adaptive: {},
};
function pickBehaviorNode(ai, styleName, situation) {
  const bias = NODE_STYLE_BIAS[styleName] || {};
  const weights = {
    press: 2 * (bias.press || 1),
    zone: 2 * (bias.zone || 1),
    bait: 1 * (bias.bait || 1),
    lurk: 1 * (bias.lurk || 1),
    pounce: 0.5 * (bias.pounce || 1),
  };
  if (situation.opening) { weights.pounce *= 6; weights.press *= 1.5; weights.lurk *= 0.3; weights.bait *= 0.5; }
  if (situation.desperate) { weights.lurk *= 2.5; weights.bait *= 2; weights.zone *= 1.2; weights.press *= 0.4; weights.pounce *= 0.3; }
  if (situation.windful) { weights.lurk *= 3; weights.zone *= 1.2; weights.press *= 0.4; weights.pounce *= 0.4; }
  if (situation.crowded) { weights.zone *= 2.5; weights.bait *= 1.5; weights.press *= 0.6; weights.lurk *= 1.2; }
  return categorical(ai, Object.entries(weights));
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function held(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = Object.fromEntries(KEYS.map((key) => [key, input?.[key] === true]));
  const analog = input && (Object.hasOwn(input, 'moveX') || Object.hasOwn(input, 'moveZ'));
  let x = analog ? (Number.isFinite(input.moveX) ? clamp(input.moveX, -1, 1) : 0) : Number(result.right) - Number(result.left);
  let z = analog ? (Number.isFinite(input.moveZ) ? clamp(input.moveZ, -1, 1) : 0) : Number(result.back) - Number(result.forward);
  const length = Math.max(1, Math.hypot(x, z));
  // Keep the raw axis ratio for 3D dodges without changing ordinary X/Z movement.
  return { ...result, aim:normalizedAim(input), aimAssist:input.aimAssist !== false, moveX: x / length, moveZ: z / length, moveScale: length, grabRelease: Object.hasOwn(input, 'grab') && input.grab === false };
}
const living = (f) => !!f && f.alive && f.hp > 0;
const distanceTo = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const validTint = (value) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '#ffc45b';
const gearCache = new WeakMap();
function gearFor(f) {
  if (!Array.isArray(f?.loadout)) return getLoadoutStats([]);
  if (!gearCache.has(f.loadout)) gearCache.set(f.loadout, getLoadoutStats(f.loadout));
  return gearCache.get(f.loadout);
}
function random(ai) {
  ai.seed = (Math.imul(ai.seed, 1664525) + 1013904223) >>> 0;
  return ai.seed / 4294967296;
}
// Rejection sampling, not clamping: no artificial mass at the reaction bounds.
function reactionDelay(ai, mean) {
  for (let i = 0; i < 32; i++) {
    const n = Math.sqrt(-2 * Math.log(Math.max(1e-12, random(ai)))) * Math.cos(2 * Math.PI * random(ai));
    if (Math.abs(n) <= 2) return mean * (1 + n * 0.2);
  }
  return mean;
}
function categorical(ai, choices) {
  let pick = random(ai) * choices.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [key, weight] of choices) if ((pick -= weight) < 0) return key;
  return choices.at(-1)?.[0];
}
const masteryValue = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 10000);
const levelFor = (mastery) => 1 + LEVELS.filter((threshold) => masteryValue(mastery) >= threshold).length;
const levelBonus = (fighter) => 1 + (levelFor(fighter?.mastery) - 1) * 0.03;

export function getForm(fighter) {
  const forms = typeof fighter?.char === 'string' && Object.hasOwn(FORMS, fighter.char) ? FORMS[fighter.char] : FORMS.goku;
  return (Number.isInteger(fighter?.form) && forms[fighter.form]) || forms[0];
}

export function getPowerRating(fighter) {
  const stats = typeof fighter?.char === 'string' && Object.hasOwn(STATS, fighter.char) ? STATS[fighter.char] : STATS.goku;
  const form = getForm(fighter);
  const gear = gearFor(fighter);
  return Math.round(stats.rating * form.damage * form.speed * levelBonus(fighter) * gear.power * gear.speed);
}

function progress(fighter, resolve = 0, mastery = 0) {
  fighter.resolve = clamp(fighter.resolve + resolve * gearFor(fighter).resolve, 0, 100);
  fighter.mastery = masteryValue(fighter.mastery + mastery);
  fighter.level = levelFor(fighter.mastery);
  fighter.powerLevel = getPowerRating(fighter);
}

// Private mechanics never enter a snapshot or depend on browser/Node globals.
const internals = new WeakMap();
function fighterData() {
  return { clashId: -1, emotion: 'calm', adrenaline: 0, thresholds: 0, shocks: 0, shockAt: 0, realKO: false, manualAt: -1e9, autoAt: -1e9, aura: 0, auraAttack: null, skillHit: null, previous: {}, cooldowns: {}, attack: null, transform: null, missingArm: false, regeneration: null, regenCooldown: 0, revertTime: 0, stun: 0, comboTime: 0, queue: [], takeoff: false, dodgeX: 0, dodgeY: 0, dodgeZ: 0, dodgeTime: 0, dodgeCooldown: 0, evadeKind: 'normal', evadeMomentum: 0, guardKiAt: 0, heldProp: -1, holdTime: 0, throwTime: 0, environment: { fire: 0, zone: 0 }, environmentAt: 0, boundaryCooldown: 0, perfect: false, lastHitBy: -1 };
}
function aiData(seed) {
  const profileSeed = { seed: (seed ^ 0xa511e9b3) >>> 0 };
  const profile = { preferredRange: (random(profileSeed) - 0.5) * 0.6, aggression: 0.9 + random(profileSeed) * 0.2 };
  return { seed, profile, controlled: false, plan: null, input: {}, nextDecision: 0, sampleTick: -1, pending: [], observed: null, targetAt: 0, autoAt: -1e9, node: null, surgeRequested: false, lastSeenEvent: 0, lastAction: 'idle', habits: { melee: 0, ranged: 0, guard: 0, charge: 0, jump: 0 } };
}
function dataFor(state, humanPit = false) {
  if (!internals.has(state)) {
    // JSON snapshots are display data, not authority to resume scores or pending chains.
    for (const f of state.fighters) f.aura = 0;
    internals.set(state, {
      scoring: false, humanPit, auraMoves: new WeakMap(), energyShots: new WeakMap(), clashes: new Map(), clashId: 0, pressureWindows: [], auraWins: state.fighters.map(() => 0), roundScored: false, matchScored: false,
      time: 0, zoneStart: null, propHomes: state.props.map(p => ({ x: p.x, y: p.y, z: p.z })), maxHp: state.kind === 'pit' ? 2000 : MAX_HP, fighters: state.fighters.map(fighterData), eventId: state.events.at(-1)?.id || 0,
      projectileId: Math.max(0, ...state.projectiles.map((p) => p.id)),
      ai: state.fighters.map((_, i) => humanPit ? null : aiData((12345 + i * 0x9e3779b9) >>> 0)),
    });
  }
  return internals.get(state);
}
function makeFighter(char, slot, carry, loadout = [], tint, maxHp = MAX_HP) {
  const form = Number.isInteger(carry?.form) && carry.form >= 0 && carry.form < FORMS[char].length ? carry.form : 0;
  const fighter = { char, x: slot ? 4 : -4, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: slot ? -Math.PI / 2 : Math.PI / 2, face: slot ? -1 : 1, target: slot ? 0 : 1, alive: true, rank: null, maxHp, hp: maxHp, energy: 60, action: 'idle', actionTime: 0, combo: 0, aura: 0, hitFlash: 0, form, resolve: 0, mastery: masteryValue(carry?.mastery), level: 1, powerLevel: 0, loadout: normalizeLoadout(loadout), tint: validTint(tint), flight: false, dodgeTime: 0, dodgeCooldown: 0, dodgeX: 0, dodgeY: 0, dodgeZ: 0, vanishTime: 0, evadeKind: 'normal', heldProp: -1, counterWindow: 0, surge: 0, surgeCharge: 0, surgeCooldown: 0, missingArm: false, regeneration: 0, regenCooldown: 0, cooldowns: {} };
  progress(fighter);
  Object.assign(fighter, { clashId: -1, emotion: 'calm', adrenaline: 0 });
  return fighter;
}
export function createMatch(charA = 'goku', charB = 'jiren', options = {}) {
  options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  // Trusted local ladder carry only. Network callers must not forward client options.
  const carry = Array.isArray(options.progression) ? options.progression : [];
  const state = {
    fighters: [makeFighter(typeof charA === 'string' && Object.hasOwn(STATS, charA) ? charA : 'goku', 0, carry[0], options.loadouts?.[0], options.tints?.[0]), makeFighter(typeof charB === 'string' && Object.hasOwn(STATS, charB) ? charB : 'jiren', 1, carry[1], options.loadouts?.[1], options.tints?.[1])],
    kind: 'duel', training: options.training === true, arenaRadius: 10, aliveCount: 2, eliminations: [],
    stage: STAGES.some((stage) => stage.id === options.stage) ? options.stage : 'void',
    difficulty: typeof options.difficulty === 'string' && Object.hasOwn(DIFFICULTIES, options.difficulty) ? options.difficulty : 'normal',
    phase: 'countdown', phaseTime: 3, round: 1, timer: 90,
    wins: [0, 0], winner: null, tick: 0, projectiles: [], clashes: [], events: [], props: [], hazards: [], zone: null,
  };
  setupArena(state);
  const data = dataFor(state);
  data.scoring = !state.training;
  if (Number.isFinite(options.seed)) data.ai = [aiData(options.seed >>> 0), aiData((options.seed ^ 0x9e3779b9) >>> 0)];
  return state;
}

// Trusted caller API: own participants overrides playerId with exactly 12 catalog IDs.
// Duplicates are valid. Non-arrays/sparse/decorated/non-string entries throw TypeError;
// wrong length/unknown IDs throw RangeError. Never forward a client options/profile object.
export function createPit(playerId = 'goku', options = {}) {
  options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  let participants = null;
  if (Object.hasOwn(options, 'participants')) {
    const ids = options.participants;
    if (!Array.isArray(ids)) throw new TypeError('participants must be an array of catalog IDs');
    if (ids.length !== 12) throw new RangeError('participants must contain exactly 12 IDs');
    if (Reflect.ownKeys(ids).length !== 13) throw new TypeError('participants must be a plain dense array');
    participants = Array.from({ length: 12 }, (_, slot) => {
      const id = Object.getOwnPropertyDescriptor(ids, slot)?.value;
      if (typeof id !== 'string') throw new TypeError('each participant must be a catalog ID string');
      if (!Object.hasOwn(STATS, id)) throw new RangeError('unknown participant catalog ID');
      return id;
    });
  }
  const state = createMatch(playerId, 'jiren', options);
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : 12345;
  const rng = { seed };
  const others = ROSTER.filter((f) => f.id !== state.fighters[0].char).map((f) => f.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random(rng) * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  Object.assign(state, { kind: 'pit', training: false, arenaRadius: 14 * Math.sqrt(10), timer: 180, aliveCount: 12, wins: Array(12).fill(0) });
  state.fighters = (participants || [state.fighters[0].char, ...others.slice(0, 11)]).map((char, slot) => {
    const f = makeFighter(char, slot, null, participants || slot === 0 ? options.loadouts?.[slot] : randomLoadout((seed + slot * 997) >>> 0), participants || slot === 0 ? options.tints?.[slot] : undefined, 2000);
    const angle = slot * Math.PI / 6 - Math.PI / 2;
    Object.assign(f, { x: Math.sin(angle) * 10.5, z: Math.cos(angle) * 10.5, heading: angle + Math.PI, target: (slot + 1) % 12 });
    f.face = Math.sign(Math.sin(f.heading)) || 1;
    return f;
  });
  internals.delete(state);
  setupArena(state);
  const data = dataFor(state, participants !== null);
  data.scoring = true;
  data.humanPit = participants !== null;
  if (!participants) data.ai = state.fighters.map((_, slot) => ({ ...aiData((seed + slot * 0x9e3779b9) >>> 0), controlled: slot > 0 }));
  return state;
}

function setupArena(state) {
  const ring = state.kind === 'pit' ? 18 : 7.6;
  state.props = Array.from({ length: 8 }, (_, id) => {
    const angle = Math.PI / 8 + id * Math.PI / 4;
    return { id, x: Math.cos(angle) * ring, y: 0.9, z: Math.sin(angle) * ring, radius: 0.9, hp: 120, heldBy: -1, respawn: 0 };
  });
  const kind = ['namek', 'beerus-world'].includes(state.stage) ? 'water' : state.stage === 'volcanic' ? 'fire' : null;
  state.hazards = kind ? [{ kind, x: -3, z: 5, radius: 2.2 }, { kind, x: 3, z: -5, radius: 2.2 }] : [];
  state.zone = state.kind === 'pit' ? { radius: state.arenaRadius, progress: 0, active: false, damagePerSecond: 25 } : null;
}

function releaseProp(state, slot, throwing = false, positions) {
  const data = dataFor(state), d = data.fighters[slot], f = state.fighters[slot];
  const prop = state.props[d.heldProp];
  if (!prop) return;
  if (throwing) {
    const target = positions[f.target];
    let dx = d.aim ? d.aim.x : target ? target.x - prop.x : Math.sin(f.heading), dy = d.aim ? d.aim.y : target ? target.y + 1.5 - prop.y : 0, dz = d.aim ? d.aim.z : target ? target.z - prop.z : Math.cos(f.heading);
    const length = Math.hypot(dx, dy, dz) || 1;
    dx /= length; dy /= length; dz /= length;
    const damage = Math.round(110 * STATS[f.char].power * getForm(f).damage * levelBonus(f) * gearFor(f).power * (f.surge > 0 ? 1.12 : 1));
    const projectile = { id: ++data.projectileId, owner: slot, x: prop.x, y: prop.y, z: prop.z, vx: dx * 22, vy: dy * 22, vz: dz * 22, kind: 'special', prop: true, propId: prop.id, life: 2, damage, radius: 0.65, stun: 0.35, knock: 6, counter: false };
    data.auraMoves.set(projectile, { owner: slot, kind: 'prop' });
    state.projectiles.push(projectile);
    d.throwTime = f.actionTime = 0.3; f.action = 'throw';
  } else if (f.action === 'lift') { f.action = 'idle'; f.actionTime = 0; }
  event(state, 'prop', slot, -1, throwing ? 'throw' : 'drop', 0, prop.x, prop.y, prop.z, { propId: prop.id });
  prop.heldBy = -1; prop.hp = 0; prop.respawn = 8;
  d.heldProp = f.heldProp = -1; d.holdTime = 0; d.toggleHold = false;
}

function environmentStep(state, dt) {
  const data = dataFor(state);
  if (state.zone) {
    if (data.zoneStart === null && (data.time >= 90 - 1e-8 || state.fighters.filter(living).length <= 4)) data.zoneStart = data.time;
    const progress = data.zoneStart === null ? 0 : clamp((data.time - data.zoneStart) / 45, 0, 1);
    const ease = progress * progress * (3 - 2 * progress);
    Object.assign(state.zone, { radius: state.arenaRadius + (6 - state.arenaRadius) * ease, progress, active: data.zoneStart !== null, damagePerSecond: 25 });
  }
  for (const [slot, f] of state.fighters.entries()) {
    if (!living(f)) continue;
    const d = data.fighters[slot];
    for (const kind of ['fire', 'zone']) {
      const exposed = kind === 'zone' ? state.zone?.active && Math.hypot(f.x, f.z) > state.zone.radius
        : f.y < 0.8 && state.hazards.some(h => h.kind === 'fire' && distanceTo(f, h) < h.radius);
      if (exposed) {
        const damage = Math.min(f.hp, (kind === 'zone' ? 25 : 12) * dt);
        f.hp = Math.max(0, f.hp - damage);
        d.environment[kind] += damage;
        // Environment never inherits a prior opponent's KO credit, even on the same frame.
        if (f.hp === 0) { d.lastHitBy = -1; d.realKO = false; }
      }
    }
    if (data.time + 1e-8 >= d.environmentAt || f.hp === 0) {
      flushEnvironment(state, slot);
    }
  }
}

function flushEnvironment(state, slot) {
  const data = dataFor(state), d = data.fighters[slot];
  for (const kind of ['fire', 'zone']) if (d.environment[kind] > 0) {
    event(state, 'environment', slot, -1, kind, d.environment[kind]);
    d.environment[kind] = 0;
  }
  d.environmentAt = data.time + 0.5;
}

export function surfaceAt(x) {
  const position = Math.abs(Number.isFinite(x) ? x : 0);
  if (position > 8) return { name: 'rubble', grip: 1.55 };
  if (position > 5.4) return { name: 'cracked seams', grip: 1.12 };
  if (position > 3.1) return { name: 'spawn stone', grip: 1 };
  if (position < 1.65) return { name: 'polished inlay', grip: 0.32 };
  return { name: 'basalt', grip: 0.85 };
}

function event(state, type, owner, target = -1, kind = '', power = 0, x, y, z, extra = {}) {
  const f = state.fighters[target >= 0 ? target : Math.max(0, owner)];
  state.events.push({ id: ++dataFor(state).eventId, type, owner, target, x: x ?? f.x, y: y ?? f.y + 1.5, z: z ?? f.z, kind, power, ...extra });
  const limit = state.kind === 'pit' ? 48 : 24;
  if (state.events.length > limit) state.events.splice(0, state.events.length - limit);
}

function awardAura(state, owner, kind) {
  const data = dataFor(state), d = data.fighters[owner];
  if (!data.scoring || !d) return;
  state.fighters[owner].aura = d.aura += AURA[kind];
  event(state, 'aura', owner, -1, kind, AURA[kind], undefined, undefined, undefined, { total: d.aura });
}

function startAttack(state, slot, kind, positions) {
  const f = state.fighters[slot];
  const d = dataFor(state).fighters[slot];
  if (kind === 'special' && f.char === 'cell' && d.missingArm) {
    if (f.energy + 1e-8 < 20 || d.regenCooldown > 1e-8 || (d.cooldowns.special || 0) > 1e-8) return false;
    f.energy = Math.max(0, f.energy - 20);
    d.regeneration = { age: 0 };
    d.regenCooldown = f.regenCooldown = 20;
    d.cooldowns.special = 5;
    d.queue.length = 0; d.comboTime = 0; f.combo = 0;
    f.action = 'regenerate'; f.actionTime = 1.4;
    event(state, 'regeneration', slot, -1, 'started', 0, undefined, undefined, undefined, { duration: 1.4, cost: 20, cooldown: 20 });
    return true;
  }
  const base = kind === 'special' ? { ...SPECIALS[f.char], cost: 20, cooldown: 5 } : ATTACKS[kind];
  if (f.energy + 1e-8 < base.cost || (d.cooldowns[kind] || 0) > 1e-8) return false;
  f.energy = Math.max(0, f.energy - base.cost);
  d.cooldowns[kind] = base.cooldown;
  const launcher = kind === 'heavy' && d.comboTime > 0 && f.combo === 2;
  f.combo = launcher ? 3 : kind === 'light' ? (d.comboTime > 0 && f.combo < 3 ? f.combo + 1 : 1) : 0;
  d.comboTime = kind === 'light' || launcher ? 0.95 : 0;
  const move = { ...base, kind, age: 0, fired: false, shotsFired: 0, dx: Math.sin(f.heading), dy: 0, dz: Math.cos(f.heading), launcher, counter: f.counterWindow > 0 };
  if (d.aim && base.speed) Object.assign(move, {dx:d.aim.x, dy:d.aim.y, dz:d.aim.z});
  if (kind === 'ultimate' && f.char === 'beerus') {
    const target = positions[f.target] || positions[slot];
    Object.assign(move, { meteor: true, targetX: target.x, targetY: clamp(target.y + 1.5, 1.5, 7.5), targetZ: target.z, splashRadius: 6 });
  }
  if (base.speed) {
    // Both torsos use the same frame snapshot, independent of fighter update order.
    const assisted = d.aim && d.aimAssist ? aimCandidate(f,state.fighters,d.aim,positions) : null;
    const origin = positions[slot], target = positions[d.aim ? assisted?.slot : f.target];
    if (target) {
      const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
      const length = Math.hypot(dx, dy, dz);
      if (length > 1e-8) Object.assign(move, { dx: dx / length, dy: dy / length, dz: dz / length });
    }
    if (state.kind === 'pit') move.life = Math.min(3, Math.max(move.life, 44 / move.speed));
  }
  if (Math.abs(move.dx) < 1e-12) move.dx = 0;
  if (Math.abs(move.dz) < 1e-12) move.dz = 0;
  if (kind === 'light' && f.combo > 1) {
    Object.assign(move, f.combo === 2
      ? { damage: 70, windup: 0.12, duration: 0.32, stun: 0.26, knock: 3, reach: 2.2 }
      : { damage: 94, windup: 0.17, duration: 0.45, stun: 0.36, knock: 7, reach: 2.3 });
  }
  if (launcher) Object.assign(move, { damage: 174, windup: 0.20, reach: 2.8, stun: 0.60, knock: 7 });
  // Score tokens stay private and are shared by every hit/shot of one committed move.
  const previous = d.auraAttack;
  const step = kind === 'light' ? (f.combo === 1 ? 1 : f.combo === 2 && previous?.step === 1 ? 2 : 0) : 0;
  const token = { owner: slot, kind, step, hits: new Set(), targets: step === 2 || (launcher && previous?.step === 2) ? previous.hits : new Set(), rewarded: false };
  dataFor(state).auraMoves.set(move, token);
  d.auraAttack = token;
  if (f.char === 'buu' && kind === 'heavy') move.reach = 5;
  move.damage = Math.round(move.damage * (base.speed ? KI_POWER[f.char] : STATS[f.char].power) * getForm(f).damage * levelBonus(f) * gearFor(f).power * (move.counter ? 1.25 : 1) * (f.surge > 0 ? 1.12 : d.adrenaline > 0 ? 1.08 : 1));
  if (move.counter) f.counterWindow = 0;
  if (move.skip) {
    const target = state.fighters[f.target];
    const gap = target ? distanceTo(f, target) : 0;
    // Commit the destination now: the skip never tracks a moving target during windup.
    const travel = clamp(gap - 1.1, 0, move.skip);
    move.destination = { x: f.x + move.dx * travel, z: f.z + move.dz * travel };
  }
  f.action = kind;
  f.actionTime = move.duration;
  d.attack = move;
  if (!base.speed && f.y === 0) { f.vx += move.dx * 1.6; f.vz += move.dz * 1.6; }
  event(state, 'attack', slot, -1, kind, move.damage * (move.shots || 1), undefined, undefined, undefined, { heading: f.heading, windup: move.windup, duration: move.duration, counter: move.counter, launcher, ...(move.meteor ? { meteor: true, targetX: move.targetX, targetY: move.targetY, targetZ: move.targetZ, radius: move.splashRadius } : {}) });
  return true;
}

function startTransform(state, slot) {
  const f = state.fighters[slot];
  const next = FORMS[f.char][f.form + 1];
  if (!next || f.resolve < next.minResolve || f.energy + 1e-8 < next.kiCost) return false;
  const d = dataFor(state).fighters[slot];
  f.energy = Math.max(0, f.energy - next.kiCost);
  f.action = 'transform';
  f.actionTime = 1;
  f.combo = 0;
  d.comboTime = 0;
  d.queue.length = 0;
  d.transform = { form: f.form + 1, age: 0 };
  event(state, 'attack', slot, -1, 'transform');
  return true;
}

function perfectDodge(state, slot, attacker) {
  const f = state.fighters[slot], d = dataFor(state).fighters[slot];
  if (d.dodgeTime <= 1e-8 || d.perfect) return;
  d.perfect = true;
  f.counterWindow = 0.9;
  const gain = Math.min(4, MAX_ENERGY - f.energy);
  f.energy += gain;
  event(state, 'ki', slot, -1, 'evade', gain);
  event(state, 'dodge', slot, attacker, 'perfect', 0, f.x, f.y + 1.5, f.z, { counterWindow: 0.9 });
}

function hit(state, owner, target, move, dx, dz, x, y, z, defense) {
  const a = state.fighters[owner];
  const b = state.fighters[target];
  const d = dataFor(state).fighters[target];
  if (!living(b)) return;
  if (defense.dodge) { perfectDodge(state, target, owner); return; }
  const frontGuard = defense.guard && -(Math.sin(defense.heading) * dx + Math.cos(defense.heading) * dz) > 0.25;
  const blocked = frontGuard || defense.shield;
  const damage = Math.round(move.damage * (blocked ? Math.max(0.10, 0.2 - gearFor(b).guard) : 1));
  const actual = Math.min(b.hp, damage);
  b.hp = Math.max(0, b.hp - damage);
  b.hitFlash = Math.max(b.hitFlash, blocked ? 0.10 : 0.18);
  // Simultaneous impulses are summed before the contact batch clamps velocity.
  b.vx += dx * move.knock * (blocked ? 0.18 : 1);
  b.vz += dz * move.knock * (blocked ? 0.18 : 1);
  d.lastHitBy = owner;
  const real = dataFor(state).auraMoves.get(move)?.owner === owner && owner !== target;
  d.realKO = b.hp === 0 && actual > 0 && real;
  if (actual > 0 && d.clashId >= 0) endClash(state, dataFor(state).clashes.get(d.clashId), 'break');
  d.stun = Math.max(d.stun, blocked ? 0.10 : move.stun);
  if (actual > 0 && d.stun > 0) releaseProp(state, target);
  if (actual > 0 && frontGuard && dataFor(state).time + 1e-8 >= d.guardKiAt) {
    d.guardKiAt = dataFor(state).time + 0.5;
    const gain = Math.min(4, MAX_ENERGY - b.energy);
    b.energy += gain;
    event(state, 'ki', target, -1, 'guard', gain);
  }
  if (actual > 0 && d.regeneration) {
    d.regeneration = null; b.regeneration = 0;
    event(state, 'regeneration', target, owner, 'interrupted');
  }
  if (b.char === 'cell' && b.hp > 0 && actual >= 180 && !d.missingArm && d.regenCooldown <= 1e-8) {
    d.missingArm = b.missingArm = true;
    event(state, 'limb', target, -1, 'lost');
  }
  if (!blocked) {
    d.attack = null;
    d.transform = null;
    d.queue.length = 0;
    d.comboTime = 0;
    b.combo = 0;
    b.action = b.hp === 0 ? 'down' : 'hurt';
    b.actionTime = d.stun;
    if (b.surgeCharge > 0) event(state, 'surge', target, owner, 'interrupted');
    b.surgeCharge = 0;
    if (move.kind === 'heavy' || move.kind === 'ultimate') {
      b.flight = false;
      b.vy = Math.max(b.vy, move.launcher ? 11 : 5);
    }
  }
  // Melee rewards engagement; ki shots cannot refund their own resource cost.
  if (move.kind === 'light' || move.kind === 'heavy') a.energy = Math.min(MAX_ENERGY, a.energy + (blocked ? 1 : 4));
  b.energy = Math.min(MAX_ENERGY, b.energy + (blocked ? 0 : 1.5));
  progress(a, actual * 0.045, actual * 0.45);
  progress(b, actual * 0.06, actual * 0.30);
  event(state, blocked ? 'block' : 'hit', owner, target, move.kind, damage, x, y, z, move.prop ? { prop: true, propId: move.propId } : {});
  if (real && actual > 0 && living(b)) {
    const desperate = b.hp / b.maxHp <= 0.2, pressured = b.hp / b.maxHp <= 0.45;
    if (desperate && !(d.thresholds & 2)) { d.thresholds |= 3; emotion(state, target, 'desperate', 6); }
    else if (pressured && !(d.thresholds & 1)) { d.thresholds |= 1; emotion(state, target, 'pressured', 3); }
  }
  if (!blocked && move.launcher) event(state, 'combo', owner, target, 'launcher', 3, x, y, z, { damage, sequence: ['light', 'light', 'heavy'] });
  const data = dataFor(state), token = data.auraMoves.get(move);
  if (!blocked && actual > 0 && token?.owner === owner && data.scoring) {
    if (token.step === 1 || (token.step === 2 && token.targets.has(target))) token.hits.add(target);
    if (!token.rewarded && move.launcher && token.targets.has(target)) {
      token.rewarded = true;
      awardAura(state, owner, 'combo');
    }
    if (!token.rewarded && ['special', 'beam', 'ultimate'].includes(token.kind)) {
      token.rewarded = true;
      const attacker = data.fighters[owner], previous = attacker.skillHit;
      if (previous && previous.kind !== token.kind && data.time - previous.time <= 2 + 1e-8) {
        attacker.skillHit = null;
        awardAura(state, owner, 'skill-chain');
      } else attacker.skillHit = { kind: token.kind, time: data.time };
    }
  }
  if (!blocked && move.counter && !move.counterRewarded) {
    move.counterRewarded = true;
    a.energy = Math.min(MAX_ENERGY, a.energy + 6);
    event(state, 'counter', owner, target, move.kind, damage, x, y, z, { multiplier: 1.25, energyReward: 6 });
  }
}

function constrain(state, f) {
  const radius = state.arenaRadius;
  let impact = 0;
  if (state.kind === 'pit') {
    const length = Math.hypot(f.x, f.z);
    if (length > radius) {
      const nx = f.x / length, nz = f.z / length;
      f.x = nx * radius; f.z = nz * radius;
      const out = Math.max(0, f.vx * nx + f.vz * nz);
      f.vx -= out * nx; f.vz -= out * nz;
      impact = out;
    }
  } else {
    for (const [axis, velocity] of [['x', 'vx'], ['z', 'vz']]) if (Math.abs(f[axis]) > radius) {
      f[axis] = clamp(f[axis], -radius, radius);
      if (Math.sign(f[velocity]) === Math.sign(f[axis])) {
        impact = Math.hypot(impact, f[velocity]);
        f[velocity] = 0;
      }
    }
  }
  return impact;
}

function updateTargets(state, edges) {
  const data = dataFor(state);
  for (const [slot, f] of state.fighters.entries()) {
    if (!living(f)) continue;
    const ai = data.ai[slot];
    const candidates = state.fighters.map((_, i) => i).filter((i) => i !== slot && living(state.fighters[i]));
    if (edges[slot].targetNext && candidates.length) {
      f.target = candidates.find((i) => i > f.target) ?? candidates[0];
      if (ai) {
        ai.targetAt = data.time + 4;
        // An explicit human lock wins; autonomous input must reacquire admission.
        if (state.kind === 'pit') { ai.controlled = false; ai.input = {}; ai.surgeRequested = false; }
        if (ai.plan) Object.assign(ai.plan, { primary: f.target, backup: -1, until: ai.targetAt, since: data.time, progressAt: data.time, bestGap: Infinity, reason: 'manual' });
      }
    } else if (!(state.kind === 'pit' && ai?.controlled) && (!living(state.fighters[f.target]) || f.target === slot)) {
      f.target = candidates.sort((a, b) => distanceTo(f, state.fighters[a]) - distanceTo(f, state.fighters[b]) || a - b)[0] ?? -1;
    }
  }
}

function eliminate(state) {
  const data = dataFor(state), knockedOut = [];
  // Same-frame KOs rank higher slot last-to-first; a total wipe is a draw, never a fabricated survivor.
  for (let slot = state.fighters.length - 1; slot >= 0; slot--) {
    const f = state.fighters[slot], d = dataFor(state).fighters[slot];
    if (!f.alive || f.hp > 0) continue;
    if (d.clashId >= 0) endClash(state, data.clashes.get(d.clashId), 'break');
    if (d.realKO && d.lastHitBy !== slot && d.lastHitBy >= 0) knockedOut.push(f);
    d.realKO = false; d.adrenaline = 0; d.emotion = 'calm';
    releaseProp(state, slot);
    flushEnvironment(state, slot);
    f.alive = false;
    f.rank = state.aliveCount--;
    f.action = 'down'; f.actionTime = 0;
    f.vx = f.vy = f.vz = 0;
    f.flight = false; d.dodgeTime = f.dodgeTime = f.vanishTime = f.counterWindow = f.surge = f.surgeCharge = f.regeneration = 0;
    d.attack = d.transform = d.regeneration = null; d.queue.length = 0;
    const entry = { slot, owner: d.lastHitBy, rank: f.rank, tick: state.tick };
    state.eliminations.push(entry);
    if (state.kind === 'pit') event(state, 'elimination', entry.owner, slot, 'knockout', f.rank, undefined, undefined, undefined, { rank: f.rank, aliveCount: state.aliveCount });
  }
  for (const [slot, f] of state.fighters.entries()) {
    const d = data.fighters[slot];
    if (living(f) && d.shocks < 2 && data.time >= d.shockAt && knockedOut.some(b => Math.hypot(f.x - b.x, f.y - b.y, f.z - b.z) <= 10)) {
      d.shocks++; d.shockAt = data.time + 8;
      emotion(state, slot, 'shocked', 2);
    }
  }
}

function finishPit(state) {
  for (const c of dataFor(state).clashes.values()) endClash(state, c, 'break');
  // Timeout ordering: living HP descending, then slot ascending. Dead ranks stay in KO order.
  const remaining = state.fighters.map((_, i) => i).filter((i) => living(state.fighters[i])).sort((a, b) => state.fighters[b].hp - state.fighters[a].hp || a - b);
  state.winner = remaining[0] ?? -1;
  remaining.forEach((slot, i) => { state.fighters[slot].rank = i + 1; });
  if (state.winner >= 0) state.wins[state.winner] = 1;
  state.phase = 'matchOver'; state.phaseTime = 0;
  state.projectiles.length = 0;
  for (const [slot, f] of state.fighters.entries()) {
    releaseProp(state, slot);
    flushEnvironment(state, slot);
    dataFor(state).fighters[slot].dodgeTime = f.dodgeTime = f.vanishTime = 0;
    f.vx = f.vy = f.vz = 0;
    f.action = living(f) ? 'idle' : 'down'; f.actionTime = 0;
    dataFor(state).fighters[slot].attack = dataFor(state).fighters[slot].transform = dataFor(state).fighters[slot].regeneration = null;
    f.regeneration = 0;
  }
  event(state, 'match', state.winner, -1, state.winner < 0 ? 'draw' : state.timer === 0 ? 'timeout' : 'lastStanding', 1);
  const data = dataFor(state);
  if (state.winner >= 0 && !data.matchScored) {
    data.matchScored = true;
    awardAura(state, state.winner, 'pit-win');
  }
}

function finishRound(state) {
  for (const c of dataFor(state).clashes.values()) endClash(state, c, 'break');
  const [a, b] = state.fighters;
  state.winner = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
  if (state.winner >= 0) state.wins[state.winner]++;
  state.phase = 'roundOver';
  state.phaseTime = 2.6;
  state.projectiles.length = 0;
  for (const [slot, f] of state.fighters.entries()) {
    releaseProp(state, slot);
    flushEnvironment(state, slot);
    dataFor(state).fighters[slot].dodgeTime = f.dodgeTime = f.vanishTime = 0;
    f.action = f.hp === 0 ? 'down' : 'idle';
    f.actionTime = 0;
    f.vx = f.vy = f.vz = 0;
    dataFor(state).fighters[slot].attack = null;
    dataFor(state).fighters[slot].transform = null;
    dataFor(state).fighters[slot].regeneration = null;
    f.regeneration = 0;
  }
  event(state, 'round', state.winner, -1, state.winner < 0 ? 'draw' : 'win', state.round);
  const data = dataFor(state);
  if (state.winner >= 0 && !data.roundScored) {
    data.roundScored = true;
    data.auraWins[state.winner]++;
    awardAura(state, state.winner, 'round-win');
  }
}

// Earliest segment entry into a vertical body capsule (radius .45, feet .25, top 2.95).
function bodyEntry(ox, oy, oz, dx, dy, dz, radius) {
  let entry = Infinity;
  for (const cap of [null, 0.7, 2.5]) {
    const y = cap === null ? 0 : oy - cap, vy = cap === null ? 0 : dy;
    const a = dx * dx + vy * vy + dz * dz;
    const b = ox * dx + y * vy + oz * dz;
    const c = ox * ox + y * y + oz * oz - radius * radius;
    let lo = 0, hi = 1;
    if (a < 1e-16) {
      if (c > 0) continue;
    } else {
      const discriminant = b * b - a * c;
      if (discriminant < 0) continue;
      const root = Math.sqrt(discriminant);
      lo = Math.max(lo, (-b - root) / a);
      hi = Math.min(hi, (-b + root) / a);
    }
    if (cap === null) {
      if (Math.abs(dy) < 1e-8) {
        if (oy < 0.7 || oy > 2.5) continue;
      } else {
        const bottom = (0.7 - oy) / dy, top = (2.5 - oy) / dy;
        lo = Math.max(lo, Math.min(bottom, top));
        hi = Math.min(hi, Math.max(bottom, top));
      }
    }
    if (lo <= hi) entry = Math.min(entry, lo);
  }
  return entry;
}

function sphereEntry(ox, oy, oz, dx, dy, dz, radius) {
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz, b = ox * dx + oy * dy + oz * dz;
  const discriminant = b * b - a * c;
  if (a < 1e-16 || discriminant < 0) return Infinity;
  const entry = (-b - Math.sqrt(discriminant)) / a;
  return entry >= 0 && entry <= 1 ? entry : Infinity;
}

function emotion(state, slot, kind, duration) {
  const d = dataFor(state).fighters[slot];
  // Refresh only from privately capped triggers, never add durations or stack multipliers.
  if (duration >= d.adrenaline) { d.emotion = kind; d.adrenaline = duration; }
  event(state, 'emotion', slot, -1, kind);
}

function showdownMirrors(state) {
  const data = dataFor(state);
  state.clashes = Array.from(data.clashes.values(), c => ({ id: c.id, a: c.a, b: c.b, x: c.x, y: c.y, z: c.z, progress: c.progress, age: c.age, remaining: Math.max(0, CLASH.duration - c.age), cue: c.cue, powerA: c.powerA, powerB: c.powerB }));
  for (const [slot, f] of state.fighters.entries()) {
    const d = data.fighters[slot];
    Object.assign(f, { clashId: d.clashId, emotion: d.emotion, adrenaline: d.adrenaline });
  }
}

function endClash(state, c, kind, winner = -1) {
  const data = dataFor(state);
  if (!c || !data.clashes.delete(c.id)) return;
  for (const slot of [c.a, c.b]) {
    const d = data.fighters[slot], f = state.fighters[slot];
    d.clashId = -1;
    d.queue.length = 0;
    if (d.stun <= 1e-8) { f.action = living(f) ? f.flight ? 'flight' : 'idle' : 'down'; f.actionTime = 0; }
  }
  const loser = winner === c.a ? c.b : c.a;
  event(state, 'clash', winner < 0 ? c.a : winner, winner < 0 ? c.b : loser, kind, 0, c.x, c.y, c.z, { clashId: c.id });
  if (kind !== 'win' || !living(state.fighters[winner]) || !living(state.fighters[loser])) return;
  const source = c.shots[winner === c.a ? 0 : 1], target = state.fighters[loser];
  const dx = target.x - c.x, dy = target.y + 1.5 - c.y, dz = target.z - c.z, length = Math.hypot(dx, dy, dz) || 1;
  const p = { ...source, id: ++data.projectileId, owner: winner, x: c.x, y: c.y, z: c.z, vx: dx / length * 30, vy: dy / length * 30, vz: dz / length * 30, life: 1.5, damage: Math.min(CLASH.releaseCap, Math.round(source.damage * (0.65 + 0.35 * Math.abs(c.progress)))), counter: false };
  data.auraMoves.set(p, c.tokens[winner === c.a ? 0 : 1]);
  data.energyShots.set(p, { ...p, canClash: false });
  state.projectiles.push(p);
}

function advanceClashes(state, controls, edges, dt) {
  const data = dataFor(state);
  for (const c of data.clashes.values()) {
    if (state.timer <= 0 || [c.a, c.b].some(slot => !living(state.fighters[slot]) || data.fighters[slot].stun > 1e-8)) { endClash(state, c, 'break'); continue; }
    if (c.tick === state.tick) continue;
    // Both sides see the same cue and pay before pressure is integrated.
    const powers = [c.a, c.b].map((slot, side) => {
      const f = state.fighters[slot];
      c.boosts[side] *= Math.exp(-CLASH.decay * dt);
      if (edges[slot].clashBoost && data.time + 1e-8 >= c.boostAt[side] && f.energy + 1e-8 >= CLASH.boostCost) {
        f.energy = Math.max(0, f.energy - CLASH.boostCost);
        c.boostAt[side] = data.time + CLASH.boostCooldown;
        c.boosts[side] = Math.min(2, c.boosts[side] + (c.cue ? CLASH.cueBoost : CLASH.boost));
        event(state, 'clash', slot, side ? c.a : c.b, 'boost', 0, c.x, c.y, c.z, { clashId: c.id });
      }
      const brace = controls[slot].guard && f.energy + 1e-8 >= CLASH.braceCost * dt;
      if (brace) f.energy = Math.max(0, f.energy - CLASH.braceCost * dt);
      return clamp(c.base[side] + c.boosts[side] + (brace ? CLASH.bracePower : 0), 0, CLASH.powerCap);
    });
    [c.powerA, c.powerB] = powers;
    c.progress = clamp(c.progress + (powers[0] - powers[1]) * CLASH.pressure * dt, -1, 1);
    c.age = Math.min(CLASH.duration, c.age + dt);
    const phase = c.age % 1.2;
    c.cue = phase >= 0.6 && phase < 0.84;
    if (Math.abs(c.progress) >= 1 - 1e-8 || c.age >= CLASH.duration - 1e-8) {
      if (Math.abs(c.progress) < 0.12) endClash(state, c, 'draw');
      else endClash(state, c, 'win', c.progress > 0 ? c.a : c.b);
    }
  }
}

function startClash(state, first, second, time) {
  const data = dataFor(state);
  if (data.clashes.size >= CLASH.limit) return false;
  const pair = [first, second].sort((a, b) => a.p.owner - b.p.owner);
  for (const t of pair) {
    const p = t.p, real = data.energyShots.get(p), d = data.fighters[p.owner], f = state.fighters[p.owner];
    if (!real?.canClash || !living(f) || d.clashId >= 0 || d.stun > 1e-8 || d.regeneration || d.transform || d.heldProp >= 0 || d.throwTime > 1e-8 || d.dodgeTime > 1e-8 || ['surge', 'dodge', 'dash'].includes(f.action)) return false;
    if (d.attack && (!d.attack.fired || data.auraMoves.get(d.attack) !== data.auraMoves.get(p))) return false;
  }
  const [a, b] = pair, center = {};
  for (const axis of ['x', 'y', 'z']) center[axis] = (a.start[axis] + a.p[`v${axis}`] * time + b.start[axis] + b.p[`v${axis}`] * time) / 2;
  // Retain values and tokens privately, never projectile or public-clash object references.
  const shots = pair.map(t => { const { canClash, ...shot } = data.energyShots.get(t.p); return shot; });
  const base = shots.map(p => clamp(p.damage / 220, 0.5, 3));
  const c = { id: ++data.clashId, a: a.p.owner, b: b.p.owner, ...center, progress: 0, age: 0, cue: false, powerA: base[0], powerB: base[1], base, boosts: [0, 0], boostAt: [0, 0], shots, tokens: pair.map(t => data.auraMoves.get(t.p)), tick: state.tick };
  data.clashes.set(c.id, c);
  for (const t of pair) {
    const d = data.fighters[t.p.owner], f = state.fighters[t.p.owner];
    d.clashId = c.id; d.attack = null; d.queue.length = 0; d.comboTime = 0;
    f.combo = 0; f.action = t.p.kind; f.actionTime = CLASH.duration; f.vx = f.vy = f.vz = 0;
    data.energyShots.delete(t.p);
  }
  event(state, 'clash', c.a, c.b, 'start', 0, c.x, c.y, c.z, { clashId: c.id });
  return true;
}

function explosion(state, p, direct, cover, hits) {
  const data = dataFor(state), real = data.energyShots.get(p);
  if (!real || !SPLASH[real.kind] || real.prop) return;
  const radius = SPLASH[real.kind];
  event(state, 'explosion', p.owner, direct, real.kind, 0, p.x, p.y, p.z, { radius });
  for (const [slot, f] of state.fighters.entries()) {
    if (slot === p.owner || slot === direct || !living(f)) continue;
    const dx = f.x - p.x, dy = f.y + 1.5 - p.y, dz = f.z - p.z, length = Math.hypot(dx, dy, dz);
    if (length >= radius || cover.some(prop => Number.isFinite(sphereEntry(p.x - prop.x, p.y - prop.y, p.z - prop.z, dx, dy, dz, prop.radius)))) continue;
    const move = { ...p, counter: false, damage: Math.round(p.damage * 0.5 * (1 - length / radius)) };
    if (!move.damage) continue;
    data.auraMoves.set(move, data.auraMoves.get(p));
    const horizontal = Math.hypot(dx, dz);
    hits.push([p.owner, slot, move, horizontal > 1e-8 ? dx / horizontal : -Math.sin(f.heading), horizontal > 1e-8 ? dz / horizontal : -Math.cos(f.heading), f.x, f.y + 1.5, f.z]);
  }
}

function simulate(state, inputs, dt) {
  const data = dataFor(state);
  if (state.phase !== 'fight') {
    for (const c of data.clashes.values()) endClash(state, c, 'break');
    for (const d of data.fighters) { d.adrenaline = 0; d.emotion = 'calm'; }
    data.energyShots = new WeakMap();
    if (state.phase === 'disconnected') state.projectiles.length = 0;
  }
  showdownMirrors(state);
  const controls = state.fighters.map((f, slot) => held(living(f) ? inputs?.[slot] : {}));
  const edges = controls.map((input, slot) => Object.fromEntries(KEYS.map((key) => [key, input[key] && !data.fighters[slot].previous[key]])));
  for (let slot = 0; slot < state.fighters.length; slot++) {
    data.fighters[slot].previous = controls[slot];
    state.fighters[slot].aura = data.fighters[slot].aura;
    state.fighters[slot].maxHp = data.maxHp;
    state.fighters[slot].heldProp = data.fighters[slot].heldProp;
    if (state.phase !== 'fight') {
      releaseProp(state, slot);
      data.fighters[slot].dodgeTime = state.fighters[slot].dodgeTime = state.fighters[slot].vanishTime = 0;
    }
    state.fighters[slot].hitFlash = Math.max(0, state.fighters[slot].hitFlash - dt);
  }
  if (state.phase === 'matchOver' || state.phase === 'disconnected') return;
  state.tick++;
  if (state.phase !== 'fight') {
    state.phaseTime = Math.max(0, state.phaseTime - dt);
    if (state.phaseTime > 1e-8) return;
    state.phaseTime = 0;
    if (state.phase === 'countdown') {
      state.phase = 'fight';
    } else if (state.phase === 'roundOver') {
      if (Math.max(...state.wins) >= 2) {
        state.phase = 'matchOver';
        event(state, 'match', state.winner, -1, 'win', state.round);
        if (data.auraWins[state.winner] >= 2 && !data.matchScored) {
          data.matchScored = true;
          awardAura(state, state.winner, 'match-win');
        }
      } else {
        // Draws replay the same round without awarding an arbitrary winner.
        if (state.winner !== -1) state.round++;
        state.fighters = state.fighters.map((f, slot) => Object.assign(makeFighter(f.char, slot, f, f.loadout, f.tint), { aura: data.fighters[slot].aura }));
        state.aliveCount = 2;
        state.eliminations = [];
        setupArena(state);
        data.propHomes = state.props.map(p => ({ x: p.x, y: p.y, z: p.z }));
        data.fighters = data.fighters.map((d) => ({ ...fighterData(), previous: d.previous, aura: d.aura }));
        data.roundScored = false;
        data.auraMoves = new WeakMap();
        data.energyShots = new WeakMap(); data.pressureWindows = [];
        data.ai = data.ai.map((ai) => ({ ...aiData(ai.seed), profile: ai.profile, habits: ai.habits, lastSeenEvent: data.eventId, nextDecision: data.time }));
        state.winner = null;
        state.timer = 90;
        state.phase = 'countdown';
        state.phaseTime = 3;
      }
    }
    return;
  }

  data.time += dt;
  // Third reservations expire on simulation time, even if no controller asks for a decision.
  for (const [slot, ai] of data.ai.entries()) if (ai?.controlled && ai.plan?.pressureUntil && data.time + 1e-8 >= ai.plan.pressureUntil) {
    state.fighters[slot].target = -1; ai.input = {}; ai.plan.pressureUntil = 0; ai.plan.until = data.time;
  }
  state.timer = Math.max(0, state.timer - dt);
  if (state.timer < 1e-8) state.timer = 0;
  eliminate(state);
  updateTargets(state, edges);
  for (const prop of state.props) if (prop.respawn > 0) {
    prop.respawn = Math.max(0, prop.respawn - dt);
    if (prop.respawn < 1e-8) {
      Object.assign(prop, data.propHomes[prop.id], { hp: 120, heldBy: -1, respawn: 0 });
      event(state, 'prop', -1, -1, 'respawn', 0, prop.x, prop.y, prop.z, { propId: prop.id });
    }
  }
  const positions = state.fighters.map(({ x, y, z }) => ({ x, y, z }));
  const blinked = new Set();
  const existingShots = new Set(state.projectiles);
  for (let slot = 0; slot < state.fighters.length; slot++) {
    const f = state.fighters[slot];
    if (!living(f)) continue;
    const other = state.fighters[f.target];
    const d = data.fighters[slot];
    const input = controls[slot];
    const edge = edges[slot];
    d.aim = input.aim;
    d.aimAssist = input.aimAssist;
    for (const key of Object.keys(d.cooldowns)) d.cooldowns[key] = Math.max(0, d.cooldowns[key] - dt);
    d.regenCooldown = Math.max(0, d.regenCooldown - dt);
    // Renderer mirrors only: client/snapshot values never grant a channel or clear its cooldown.
    f.missingArm = d.missingArm;
    f.regeneration = d.regeneration ? clamp(d.regeneration.age / 1.4, 0, 1) : 0;
    f.regenCooldown = d.regenCooldown;
    for (const key of ['counterWindow', 'surge', 'surgeCharge', 'surgeCooldown']) f[key] = Math.max(0, f[key] - dt);
    d.dodgeTime = Math.max(0, d.dodgeTime - dt);
    d.dodgeCooldown = Math.max(0, d.dodgeCooldown - dt);
    d.throwTime = Math.max(0, d.throwTime - dt);
    d.stun = Math.max(0, d.stun - dt);
    d.boundaryCooldown = Math.max(0, d.boundaryCooldown - dt);
    d.comboTime = Math.max(0, d.comboTime - dt);
    d.queue = d.queue.filter((entry) => entry.until >= data.time);
    d.revertTime = Math.max(0, d.revertTime - dt);
    d.adrenaline = Math.max(0, d.adrenaline - dt);
    if (d.adrenaline <= 1e-8) { d.adrenaline = 0; d.emotion = 'calm'; }
    f.actionTime = Math.max(0, f.actionTime - dt);
    if (d.comboTime === 0) f.combo = 0;
    // Preserve both presses through the full recovery, including early windup taps.
    if (d.attack && d.stun <= 1e-8) for (const kind of ['light', 'heavy']) {
      if (edge[kind] && d.queue.length < 2) d.queue.push({ kind, until: data.time + 1.0 });
    }
    if (d.attack && f.actionTime < 1e-8) d.attack = null;
    const evading = () => ['dash', 'dodge'].includes(f.action) && f.actionTime > 1e-8;
    const dodgeEdge = (edge.dodge || edge.dash) && !d.previousDodge;
    d.previousDodge = input.dodge || input.dash;
    // Recovery can be escaped, but attack windups, transformation and hitstun remain commitments.
    const canEscape = d.clashId < 0 && d.stun <= 1e-8 && !d.transform && !d.regeneration && d.heldProp < 0 && d.throwTime <= 1e-8 && f.action !== 'surge' && (!d.attack || d.attack.fired);
    if (edge.flight && canEscape && !evading()) {
      f.flight = !f.flight;
      f.vy = 0;
      d.takeoff = f.flight && f.y === 0;
      d.attack = null; d.queue.length = 0;
      f.action = f.flight ? 'flight' : f.y > 0 ? 'jump' : 'idle'; f.actionTime = 0;
      event(state, 'flight', slot, -1, f.flight ? 'on' : 'off', 0, f.x, f.y, f.z, { height: f.y });
    }
    const vanish = edge.vanish;
    if ((vanish || dodgeEdge) && (!vanish || !d.attack) && f.energy >= (vanish ? BLINK_COST : 8) && (vanish ? (d.cooldowns.vanish || 0) : d.dodgeCooldown) <= 1e-8 && canEscape && !evading()) {
      let dx = input.moveX * input.moveScale, dz = input.moveZ * input.moveScale;
      let dy = f.flight ? Number(input.jump) - Number(input.guard) : 0;
      if (vanish && input.aim) { dx = input.aim.x; dy = input.aim.y; dz = input.aim.z; }
      if (!dx && !dy && !dz && other) {
        const origin = positions[slot], target = positions[f.target];
        dx = origin.x - target.x; dy = f.flight ? origin.y - target.y : 0; dz = origin.z - target.z;
      }
      if (Math.hypot(dx, dy, dz) < 1e-8) { dx = -Math.sin(f.heading); dz = -Math.cos(f.heading); }
      const length = Math.hypot(dx, dy, dz);
      // Carry only a bounded projection of actual moving-start momentum, not raw XYZ speed.
      const moving = Math.hypot(input.moveX, input.moveZ, f.flight ? Number(input.jump) - Number(input.guard) : 0) > 0;
      d.evadeMomentum = moving ? clamp((f.vx * dx + f.vy * dy + f.vz * dz) / length, -7, 7) * 0.2 : 0;
      f.dodgeX = d.dodgeX = dx / length; f.dodgeY = d.dodgeY = dy / length; f.dodgeZ = d.dodgeZ = dz / length;
      d.perfect = false; d.takeoff = false;
      d.attack = null; d.queue.length = 0;
      f.energy -= vanish ? BLINK_COST : 8; d.dodgeTime = 0.18;
      d.evadeKind = vanish ? 'vanish' : 'normal';
      if (vanish) {
        d.cooldowns.vanish = BLINK_COOLDOWN;
        const distance = input.aim ? BLINK_DISTANCE : 2.4;
        f.x += d.dodgeX * distance; f.y = clamp(f.y + d.dodgeY * distance, 0, 6); f.z += d.dodgeZ * distance;
        constrain(state, f);
        f.vx = f.vy = f.vz = 0;
        // A teleport has no swept body path through the space it skipped.
        blinked.add(slot);
      }
      else { d.dodgeCooldown = 0.65; d.cooldowns.dash = d.cooldowns.dodge = 0.65; }
      f.action = vanish || edge.dodge ? 'dodge' : 'dash'; f.actionTime = 0.22;
      event(state, 'attack', slot, -1, f.action);
      event(state, 'dodge', slot, -1, 'evade', 0, undefined, undefined, undefined, { duration: 0.18, cooldown: vanish ? 2 : 0.65, evadeKind: d.evadeKind });
    }
    f.dodgeTime = d.dodgeTime; f.dodgeCooldown = d.dodgeCooldown;
    f.vanishTime = d.evadeKind === 'vanish' ? d.dodgeTime : 0; f.evadeKind = d.evadeKind;
    if (d.heldProp >= 0) {
      d.holdTime += dt;
      if (d.aim) { f.heading = Math.atan2(d.aim.x, d.aim.z); f.face = Math.sign(d.aim.x) || f.face; }
      if (edge.drop || d.stun > 1e-8 || edge.interact || (!d.toggleHold && (d.holdTime >= 2 - 1e-8 || !input.grab))) {
        releaseProp(state, slot, !edge.drop && d.stun <= 1e-8 && (edge.interact || (!d.toggleHold && d.holdTime < 2 - 1e-8 && input.grabRelease)), positions);
      }
    } else if ((edge.grab || edge.interact) && !input.drop && !d.attack && canEscape && !evading() && f.energy >= PICKUP_COST) {
      const prop = pickupCandidate(f, state.props, d.aim);
      if (prop) {
        f.energy -= PICKUP_COST; d.heldProp = f.heldProp = prop.id; prop.heldBy = slot; d.holdTime = 0; d.toggleHold = !!edge.interact;
        d.queue.length = 0; f.action = 'lift'; f.actionTime = 2;
        event(state, 'prop', slot, -1, 'lift', 0, prop.x, prop.y, prop.z, { propId: prop.id });
      }
    }
    const busy = d.clashId >= 0 || d.attack || d.transform || d.regeneration || d.heldProp >= 0 || d.throwTime > 1e-8 || d.stun > 1e-8 || evading() || f.action === 'surge';
    if (!busy) {
      // Guard and committed moves lock facing; jumping over a guard can cross it up.
      if (f.action !== 'guard' || !input.guard) {
        if (d.aim) {
          f.heading = Math.atan2(d.aim.x, d.aim.z);
          f.face = Math.sign(d.aim.x) || f.face;
          // Close-range assistance selects a visible opponent, never a fighter behind you.
          if (edge.light || edge.heavy || edge.special) {
            const nearest = state.fighters.map((enemy,index) => ({enemy,index,distance:distanceTo(f,enemy)}))
              .filter(({enemy,index,distance}) => index !== slot && living(enemy) && distance < 4 &&
                ((enemy.x-f.x)*d.aim.x+(enemy.z-f.z)*d.aim.z)/(distance || 1) > .45)
              .sort((a,b) => a.distance-b.distance)[0];
            if (nearest) { f.target = nearest.index; f.heading = Math.atan2(nearest.enemy.x-f.x,nearest.enemy.z-f.z); }
          }
        } else if (other) {
          f.heading = Math.atan2(other.x - f.x, other.z - f.z);
          f.face = Math.sign(other.x - f.x) || f.face;
        }
      }
      f.action = f.flight ? 'flight' : f.y > 0 ? 'jump' : 'idle';
      f.actionTime = 0;
      if (input.guard && (f.y === 0 || f.flight)) {
        f.action = 'guard';
      } else {
        if (edge.jump && f.y === 0 && !f.flight && !edge.flight) {
          f.vy = f.char === 'frieza' ? 13.8 : 13;
          f.action = 'jump';
          event(state, 'jump', slot, -1, 'jump', 0, f.x, f.y);
        }
        let started = false;
        if (data.ai[slot]?.surgeRequested && f.surgeCooldown <= 1e-8) {
          data.ai[slot].surgeRequested = false;
          f.surgeCharge = 0.85; f.surgeCooldown = 24; f.action = 'surge'; f.actionTime = 0.85;
          d.queue.length = 0;
          event(state, 'surge', slot, -1, 'windup', 0, undefined, undefined, undefined, { duration: 0.85 });
          started = true;
        }
        if (!started) started = edge.transform && startTransform(state, slot);
        const queued = !started ? d.queue.shift()?.kind : null;
        for (const kind of ['special', 'ultimate', 'beam', 'heavy', 'blast', 'light']) {
          if (!started && (queued ? queued === kind : edge[kind]) && startAttack(state, slot, kind, positions)) {
            started = true;
            break;
          }
        }
        if (!started) {
          const moving = input.moveX || input.moveZ;
          if (input.charge && !moving && f.vy === 0 && (f.flight ? !input.jump && !d.takeoff && f.vx === 0 && f.vz === 0 : f.y === 0)) {
            f.action = 'charge';
            f.energy = Math.min(MAX_ENERGY, f.energy + 25 * gearFor(f).charge * dt);
          } else {
            if (moving) {
              const water = !f.flight && f.y < 0.8 && state.hazards.some(h => h.kind === 'water' && distanceTo(f, h) < h.radius);
              const speed = STATS[f.char].speed * getForm(f).speed * gearFor(f).speed * (f.surge > 0 ? 1.08 : d.adrenaline > 0 ? 1.06 : 1) * (water ? 0.82 : 1);
              const dx = input.moveX * speed - f.vx, dz = input.moveZ * speed - f.vz;
              const acceleration = Math.min(1, (f.flight ? 54 : f.y > 0 ? 18 : 55) * dt / (Math.hypot(dx, dz) || 1));
              f.vx += dx * acceleration; f.vz += dz * acceleration;
              f.action = f.flight ? 'flight' : f.y === 0 && f.vy === 0 ? 'run' : 'jump';
            }
            f.energy = Math.min(MAX_ENERGY, f.energy + 1.6 * dt);
          }
        }
      }
    } else if (d.stun > 0 && f.action !== 'guard' && !d.attack && !d.transform) {
      f.action = 'hurt';
      f.actionTime = d.stun;
    }
    // The paid transform channel pauses upkeep, but offers no defense or ki regen.
    if (!d.transform && f.form > 0) {
      f.energy = Math.max(0, f.energy - getForm(f).drain * dt);
      // Evaluate the balance after this tick's charging, recovery and upkeep.
      // Paying the exact transformation cost must not undo a sustainable form.
      if (f.energy < 1e-8 && d.revertTime < 1e-8) {
        if (f.energy < 1e-8) f.energy = 0;
        f.form--;
        d.revertTime = 1;
        progress(f);
        event(state, 'revert', slot, -1, getForm(f).id, f.powerLevel);
      }
    }
    if (d.clashId >= 0) {
      f.vx = f.vy = f.vz = 0;
      f.actionTime = Math.max(0, CLASH.duration - data.clashes.get(d.clashId).age);
    } else if (d.attack?.rush && !d.attack.fired) {
      f.vx = d.attack.dx * d.attack.rush;
      f.vz = d.attack.dz * d.attack.rush;
    } else if (evading()) {
      // Start visibly on frame one, peak quickly, then settle before recovery ends.
      const rise = clamp((0.22 - f.actionTime) / 0.04, 0, 1), fall = clamp(f.actionTime / 0.10, 0, 1);
      const speed = d.evadeKind === 'vanish' ? 0 : (18 + d.evadeMomentum) * (0.65 + 0.35 * rise * rise * (3 - 2 * rise)) * fall * fall * (3 - 2 * fall);
      f.vx = d.dodgeX * speed; f.vz = d.dodgeZ * speed;
      if (f.flight) f.vy = d.dodgeY * speed;
    } else if (f.action !== 'run' && !(['jump', 'flight'].includes(f.action) && (input.moveX || input.moveZ))) {
      const braking = f.flight && !d.attack && !d.transform && !d.regeneration && d.stun <= 1e-8 && f.action !== 'surge';
      const drag = Math.exp(-(braking ? 24 : f.y > 0 ? 1.4 : surfaceAt(Math.hypot(f.x, f.z)).grip * 9) * dt);
      f.vx *= drag; f.vz *= drag;
      if (Math.abs(f.vx) < 0.025) f.vx = 0;
      if (Math.abs(f.vz) < 0.025) f.vz = 0;
    }
    f.x += f.vx * dt;
    f.z += f.vz * dt;
    if (d.attack?.skip && !d.attack.fired && d.attack.age + dt + 1e-8 >= d.attack.windup) {
      Object.assign(f, d.attack.destination);
      f.vx = f.vz = 0;
    }
    const impact = constrain(state, f);
    if (impact >= 6 && (evading() || d.stun > 1e-8) && d.boundaryCooldown <= 1e-8) {
      d.boundaryCooldown = 0.25;
      event(state, 'boundary', slot, -1, evading() ? 'dodge' : 'knockback', impact, f.x, f.y, f.z);
    }
    const previousY = f.y;
    if (d.clashId >= 0) {
      f.vy = 0;
    } else if (f.flight) {
      if (!evading()) {
        const steering = !d.attack && !d.transform && !d.regeneration && d.heldProp < 0 && d.throwTime <= 1e-8 && d.stun <= 1e-8 && f.action !== 'surge';
        const vertical = steering ? Number(input.jump) - Number(input.guard) : 0;
        if (!steering || input.jump || input.guard) d.takeoff = false;
        const targetSpeed = d.takeoff ? Math.min(4, Math.max(0, 2.2 - f.y) * 8) : vertical * 4;
        if (!steering) f.vy = 0;
        else f.vy += clamp(targetSpeed - f.vy, -(targetSpeed ? 36 : 54) * dt, (targetSpeed ? 36 : 54) * dt);
      }
      f.y += f.vy * dt;
      if (d.takeoff && f.y >= 2.195) { f.y = 2.2; f.vy = 0; d.takeoff = false; }
    } else if (f.y > 0 || f.vy > 0) {
      d.takeoff = false;
      f.vy -= 25 * dt;
      f.y += f.vy * dt;
    }
    if (f.y >= 6) { f.y = 6; f.vy = Math.min(0, f.vy); }
    if (f.y <= 0) {
      if (previousY > 0) event(state, 'land', slot, -1, surfaceAt(Math.hypot(f.x, f.z)).name, Math.max(0, -f.vy), f.x, 0, f.z, { vy: f.vy });
      f.y = f.vy = 0;
      if (f.action === 'jump') f.action = 'idle';
    }
    f.cooldowns = { ...d.cooldowns };
  }

  for (let i = 0; i < state.fighters.length; i++) for (let j = i + 1; j < state.fighters.length; j++) {
    const a = state.fighters[i], b = state.fighters[j];
    const length = distanceTo(a, b);
    if (!living(a) || !living(b) || Math.abs(a.y - b.y) >= 2.3 || length >= 0.9) continue;
    const dx = length > 1e-8 ? (b.x - a.x) / length : 1;
    const dz = length > 1e-8 ? (b.z - a.z) / length : 0;
    const push = (0.9 - length) / 2;
    a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
    constrain(state, a); constrain(state, b);
  }

  for (const prop of state.props) if (prop.heldBy >= 0) {
    const f = state.fighters[prop.heldBy];
    prop.x = f.x + Math.sin(f.heading) * 0.7 + Math.cos(f.heading) * 0.35;
    prop.y = f.y + 2.7;
    prop.z = f.z + Math.cos(f.heading) * 0.7 - Math.sin(f.heading) * 0.35;
  }

  // Collect committed strikes before resolving contacts, so interrupted attackers
  // still trade their already-released shots/strikes, but cannot start a later clash.
  const contacts = [];
  for (let slot = 0; slot < state.fighters.length; slot++) {
    const f = state.fighters[slot];
    if (!living(f)) continue;
    const move = data.fighters[slot].attack;
    const transform = data.fighters[slot].transform;
    if (transform) transform.age += dt;
    const regeneration = data.fighters[slot].regeneration;
    if (regeneration) {
      regeneration.age += dt;
      f.regeneration = clamp(regeneration.age / 1.4, 0, 1);
    }
    if (!move) continue;
    move.age += dt;
    if (move.fired || move.age + 1e-8 < move.windup) continue;
    if (move.speed) {
      while (move.shotsFired < (move.shots || 1) && move.age + 1e-8 >= move.windup + move.shotsFired * (move.interval || 0)) {
        // Snapshot impact data, including special shots. Never look up owner power at impact.
        const projectile = { id: ++data.projectileId, owner: slot, x: f.x + move.dx * 0.65, y: f.y + 1.5 + move.dy * 0.65, z: f.z + move.dz * 0.65, vx: move.dx * move.speed, vy: move.dy * move.speed, vz: move.dz * move.speed, kind: move.kind, life: move.life, damage: move.damage, radius: move.radius, stun: move.stun, knock: move.knock, counter: move.counter && move.shotsFired === 0 };
        if (move.kind === 'blast') projectile.bounces = 0;
        if (move.meteor) Object.assign(projectile, { meteor: true, targetX: move.targetX, targetY: move.targetY, targetZ: move.targetZ, splashRadius: move.splashRadius, x: move.targetX, y: move.targetY + 10, z: move.targetZ, vx: 0, vy: -14, vz: 0, life: 1.5 });
        data.auraMoves.set(projectile, data.auraMoves.get(move));
        if (SPLASH[move.kind]) data.energyShots.set(projectile, { ...projectile, canClash: !move.meteor && ['beam', 'ultimate'].includes(move.kind) });
        state.projectiles.push(projectile);
        move.shotsFired++;
      }
      move.fired = move.shotsFired === (move.shots || 1);
    } else {
      move.fired = true;
      const time = clamp(move.windup - (move.age - dt), 0, dt);
      for (const [index, target] of state.fighters.entries()) {
        if (index === slot || !living(target) || Math.abs(target.y - f.y) > 1.65) continue;
        const distance = distanceTo(f, target);
        const dx = target.x - f.x, dz = target.z - f.z;
        const aimed = move.barrier || (dx * move.dx + dz * move.dz) / (distance || 1) >= 0.5;
        if (!aimed) continue;
        if (distance <= move.reach + 0.8) contacts.push({ time, dodge: index, owner: slot });
        if (distance <= move.reach) contacts.push({ time, hit: [slot, index, move, move.barrier ? dx / (distance || 1) : move.dx, move.barrier ? dz / (distance || 1) : move.dz, target.x, target.y + 1.5, target.z] });
      }
    }
  }
  // Freeze cover and every nearest impact before consuming shots or destroying props.
  const cover = state.props.filter(p => p.heldBy === -1 && p.hp > 0 && p.respawn === 0).map(p => ({ ...p }));
  const trajectories = Array.from(new Set(state.projectiles), p => {
    const real = data.energyShots.get(p);
    if (real) {
      const { canClash, ...snapshot } = real;
      // Registered energy shots have a complete private payload, not an overlay.
      // Mutable in-process state remains trusted: unregistered geometry fixtures
      // may deal damage, but their copies cannot acquire clash or scoring tokens.
      if (Object.getPrototypeOf(p) !== Object.prototype) Object.setPrototypeOf(p, Object.prototype);
      for (const key of Reflect.ownKeys(p)) if (!Object.hasOwn(snapshot, key)) delete p[key];
      Object.assign(p, snapshot);
    }
    p.z ??= 0; p.vz ??= 0; p.vy ??= 0;
    const start = { x: p.x, y: p.y, z: p.z };
    const travelTime = Math.max(0, Math.min(dt, p.life));
    const valid = Number.isInteger(p.owner) && !!state.fighters[p.owner] && ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'radius', 'damage'].every(k => Number.isFinite(p[k])) && p.life > 0;
    if (!valid) return { p, start, travelTime: 0, candidates: [], dodges: [], invalid: true };
    const radius = p.radius + 0.45;
    const dx = p.vx * travelTime, dy = p.vy * travelTime, dz = p.vz * travelTime;
    const candidates = [];
    const dodges = [];
    // Relative motion catches crossing paths, not just bodies at their final positions.
    for (const [index, target] of state.fighters.entries()) {
      if (index === p.owner || !living(target)) continue;
      const before = existingShots.has(p) && !blinked.has(index) ? positions[index] : target;
      const fraction = travelTime / dt;
      const evading = data.fighters[index].dodgeTime > 1e-8;
      const reach = radius + (evading ? 0.65 : 0);
      const entry = bodyEntry(start.x - before.x, start.y - before.y, start.z - before.z,
        dx - (target.x - before.x) * fraction, dy - (target.y - before.y) * fraction, dz - (target.z - before.z) * fraction, reach);
      if (!Number.isFinite(entry)) continue;
      (evading ? dodges : candidates).push({ index, entry });
    }
    for (const prop of cover) {
      const entry = sphereEntry(start.x - prop.x, start.y - prop.y, start.z - prop.z, dx, dy, dz, p.radius + prop.radius);
      if (Number.isFinite(entry)) candidates.push({ prop, index: -1, entry });
    }
    if (real) {
      const wall = (entry, nx, ny, nz) => {
        if (entry >= 0 && entry <= 1) candidates.push({ index: -2, entry, wall: true, nx, ny, nz });
      };
      if (state.kind === 'pit') {
        const a = dx * dx + dz * dz, b = start.x * dx + start.z * dz, c = start.x ** 2 + start.z ** 2 - state.arenaRadius ** 2;
        if (a > 1e-16) {
          const entry = c >= 0 && b >= 0 ? 0 : (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a;
          const x = start.x + dx * entry, z = start.z + dz * entry, length = Math.hypot(x, z) || 1;
          wall(entry, x / length, 0, z / length);
        }
      } else {
        for (const [axis, delta] of [['x', dx], ['z', dz]]) if (Math.abs(delta) > 1e-12) {
          const sign = Math.sign(delta), entry = Math.max(0, (sign * state.arenaRadius - start[axis]) / delta);
          wall(entry, axis === 'x' ? sign : 0, 0, axis === 'z' ? sign : 0);
        }
      }
      if (dy < 0) wall(Math.max(0, ((real.meteor ? real.targetY : 0) - start.y) / dy), 0, -1, 0);
    }
    candidates.sort((a, b) => a.entry - b.entry || a.index - b.index);
    return { p, start, travelTime, candidates, dodges };
  });
  const meetings = [];
  for (let i = 0; i < trajectories.length; i++) for (let j = i + 1; j < trajectories.length; j++) {
    const a = trajectories[i], b = trajectories[j], p = a.p, q = b.p;
    if (a.invalid || b.invalid || p.owner === q.owner || !data.energyShots.get(p)?.canClash || !data.energyShots.get(q)?.canClash) continue;
    const dot = p.vx * q.vx + p.vy * q.vy + p.vz * q.vz;
    if (dot >= -0.25 * Math.hypot(p.vx, p.vy, p.vz) * Math.hypot(q.vx, q.vy, q.vz)) continue;
    const duration = Math.min(a.travelTime, b.travelTime);
    const entry = sphereEntry(a.start.x - b.start.x, a.start.y - b.start.y, a.start.z - b.start.z, (p.vx - q.vx) * duration, (p.vy - q.vy) * duration, (p.vz - q.vz) * duration, p.radius + q.radius);
    const time = entry * duration;
    // Cover/body ties belong to the obstacle, never to a clash behind it.
    if (Number.isFinite(time) && time + 1e-8 < (a.candidates[0] ? a.candidates[0].entry * a.travelTime : Infinity) && time + 1e-8 < (b.candidates[0] ? b.candidates[0].entry * b.travelTime : Infinity)) meetings.push({ a, b, time });
  }
  for (const t of trajectories) {
    const fraction = t.candidates[0]?.entry ?? 1;
    contacts.push({ time: t.candidates.length ? fraction * t.travelTime : dt, trajectory: t });
    for (const dodge of t.dodges) if (dodge.entry <= fraction) contacts.push({ time: dodge.entry * t.travelTime, dodge: dodge.index, owner: t.p.owner, projectile: t.p });
  }
  for (const meeting of meetings) contacts.push({ time: meeting.time, meeting });
  contacts.sort((a, b) => a.time - b.time);
  const consumed = new Set();
  for (let start = 0; start < contacts.length;) {
    let end = start + 1;
    while (end < contacts.length && contacts[end].time - contacts[start].time <= 1e-8) end++;
    const batch = contacts.slice(start, end), hits = [];
    const defenses = state.fighters.map((f, slot) => {
      const d = data.fighters[slot], move = d.attack;
      return { guard: f.action === 'guard', heading: f.heading, dodge: d.dodgeTime > 1e-8,
        shield: !!(move?.barrier && move.age + 1e-8 >= move.windup && move.age < move.windup + move.barrier) };
    });
    for (const contact of batch) {
      if (contact.hit) { hits.push(contact.hit); continue; }
      if (contact.dodge !== undefined) {
        if (!consumed.has(contact.projectile)) perfectDodge(state, contact.dodge, contact.owner);
        continue;
      }
      const t = contact.trajectory;
      if (!t) continue;
      const { p, start, travelTime, candidates } = t;
      if (t.invalid || consumed.has(p)) { data.energyShots.delete(p); continue; }
      const impact = candidates[0], fraction = impact?.entry ?? 1;
      p.x = start.x + p.vx * travelTime * fraction;
      p.y = start.y + p.vy * travelTime * fraction;
      p.z = start.z + p.vz * travelTime * fraction;
      p.life = Math.max(0, p.life - dt);
      if (impact) {
        const real = data.energyShots.get(p);
        if (impact.wall && real?.kind === 'blast' && real.bounces === 0 && p.life > 0) {
          const dot = p.vx * impact.nx + p.vy * impact.ny + p.vz * impact.nz;
          for (const axis of ['x', 'y', 'z']) { p[`v${axis}`] = (p[`v${axis}`] - 2 * dot * impact[`n${axis}`]) * 0.8; p[axis] -= impact[`n${axis}`] * 0.001; }
          p.bounces = 1; p.damage = Math.round(real.damage * 0.55);
          for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'damage', 'bounces']) real[key] = p[key];
          event(state, 'ricochet', p.owner, -1, 'blast', 0, p.x, p.y, p.z);
          t.keep = true;
          continue;
        }
        const prop = impact.prop && state.props.find(p => p.id === impact.prop.id);
        if (prop) {
          const wasAlive = prop.hp > 0;
          prop.hp = Math.max(0, prop.hp - p.damage);
          if (prop.hp === 0 && wasAlive) {
            prop.respawn = 8;
            event(state, 'prop', p.owner, -1, 'break', 0, prop.x, prop.y, prop.z, { propId: prop.id });
          }
        } else if (!impact.wall) {
          const index = impact.index, target = state.fighters[index], source = state.fighters[p.owner];
          const dx = Math.hypot(p.vx, p.vz) > 1e-8 ? p.vx : target.x - source.x;
          const dz = Math.hypot(p.vx, p.vz) > 1e-8 ? p.vz : target.z - source.z;
          const speed = Math.hypot(dx, dz);
          hits.push([p.owner, index, p, speed > 1e-8 ? dx / speed : -Math.sin(target.heading), speed > 1e-8 ? dz / speed : -Math.cos(target.heading), target.x, p.y, target.z]);
        }
        explosion(state, p, impact.index >= 0 ? impact.index : -1, cover, hits);
        data.energyShots.delete(p); consumed.add(p);
        continue;
      }
      t.keep = p.life > 0 && Math.abs(p.x) < state.arenaRadius + 3 && Math.abs(p.z) < state.arenaRadius + 3;
      if (t.keep && data.energyShots.has(p)) for (const key of ['x', 'y', 'z', 'life']) data.energyShots.get(p)[key] = p[key];
      if (!t.keep) data.energyShots.delete(p);
    }
    // Hits win ties with clash admission. Within a hit batch, guard/barrier/evade
    // eligibility is frozen before any rear hit can clear another hit's defense.
    for (const args of hits) hit(state, ...args, defenses[args[1]]);
    for (const [, target] of hits) if (!defenses[target].dodge) {
      const f = state.fighters[target];
      f.vx = clamp(f.vx, -19, 19); f.vz = clamp(f.vz, -19, 19);
    }
    for (const { meeting: m } of batch) {
      if (!m || consumed.has(m.a.p) || consumed.has(m.b.p)) continue;
      // Ambiguous simultaneous multi-way contacts keep trading instead of favoring a slot.
      if (meetings.some(n => n !== m && Math.abs(n.time - m.time) < 1e-8 && [n.a.p.owner, n.b.p.owner].some(slot => slot === m.a.p.owner || slot === m.b.p.owner))) continue;
      if (startClash(state, m.a, m.b, m.time)) { consumed.add(m.a.p); consumed.add(m.b.p); }
    }
    start = end;
  }
  state.projectiles = trajectories.filter(t => t.keep && !consumed.has(t.p)).map(t => t.p);
  // A falling ultimate has not struck on its release frame; that final windup frame
  // remains interruptible in either slot, just like regeneration completion.
  state.projectiles = state.projectiles.filter(p => {
    if (data.energyShots.get(p)?.meteor && !existingShots.has(p) && !data.fighters[p.owner].attack) { data.energyShots.delete(p); return false; }
    return true;
  });
  environmentStep(state, dt);
  // Resolve completion after impacts, so even the final windup frame can be interrupted.
  eliminate(state);
  advanceClashes(state, controls, edges, dt);
  if (state.aliveCount > 1 && state.timer > 0) {
    for (let slot = 0; slot < state.fighters.length; slot++) {
      const d = data.fighters[slot];
      const f = state.fighters[slot];
      if (!living(f)) continue;
      if (d.regeneration && d.regeneration.age + 1e-8 >= 1.4) {
        d.regeneration = null;
        d.missingArm = f.missingArm = false;
        f.regeneration = 0;
        const healed = Math.min(90, Math.max(0, f.maxHp - f.hp));
        f.hp += healed;
        f.action = f.flight ? 'flight' : f.y > 0 ? 'jump' : 'idle'; f.actionTime = 0;
        event(state, 'limb', slot, -1, 'regrown', healed);
      }
      if (f.action === 'surge' && f.actionTime <= 1e-8) {
        f.surge = 3; f.surgeCharge = 0; f.action = 'idle';
        event(state, 'surge', slot, -1, 'active', 3, undefined, undefined, undefined, { damageMultiplier: 1.12, speedMultiplier: 1.08 });
      }
      if (d.transform && d.transform.age + 1e-8 >= 1) {
        f.form = d.transform.form;
        d.transform = null;
        d.revertTime = 2; // A brief chance to recharge after paying the form's entry cost.
        f.action = f.flight ? 'flight' : f.y > 0 ? 'jump' : 'idle';
        f.actionTime = 0;
        progress(f);
        event(state, 'transform', slot, -1, getForm(f).id, f.powerLevel);
      }
    }
  }
  if (state.aliveCount <= 1 || state.timer <= 1e-8) {
    if (state.kind === 'pit') finishPit(state);
    else finishRound(state);
  }
  if (state.phase !== 'fight') {
    data.energyShots = new WeakMap();
    for (const d of data.fighters) { d.adrenaline = 0; d.emotion = 'calm'; }
  }
  showdownMirrors(state);
}

export function stepMatch(state, inputs, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  // Bound catch-up work after tab suspension and keep collision steps <= 1/60s.
  const time = Math.min(dt, 0.25);
  const steps = Math.ceil(time / (1 / 60));
  for (let i = 0; i < steps; i++) simulate(state, inputs, time / steps);
}

// Read-only diagnostics: no brain creation, observation sampling, or PRNG advancement.
export function getAITactics(state, slot) {
  if (!Number.isInteger(slot)) return null;
  const data = internals.get(state), ai = data?.ai[slot], p = ai?.plan;
  if (!p) return null;
  return { intent: p.intent, primary: p.primary, backup: p.backup, commitRemaining: Math.max(0, p.until - data.time), intentRemaining: Math.max(0, p.intentUntil - data.time), reason: p.reason, neighbors: p.neighbors, preferredRange: p.range, observedAge: data.time - ai.observed.time, node: ai.node?.id ?? null };
}

function planPit(state, slot, ai, style) {
  const data = dataFor(state), f = state.fighters[slot], view = ai.observed, actors = view.actors;
  const pressure = (target) => state.fighters.reduce((n, other, i) => n + Number(i !== slot && data.ai[i]?.controlled && living(other) && other.target === target), 0);
  for (const [target, a] of actors.entries()) {
    const window = data.pressureWindows[target];
    const opening = a.action === 'charge' || a.surgeCharge > 0 || a.regeneration > 0 || a.emotion === 'desperate' && a.adrenaline > 0;
    if (target !== slot && living(a) && distanceTo(f, a) < 14 && opening && data.time >= (window?.nextAt || 0)) data.pressureWindows[target] = { until: data.time + 2, nextAt: data.time + 8 };
  }
  const limit = target => data.time < (data.pressureWindows[target]?.until || 0) ? 3 : 2;
  const effective = (actor) => actor.powerLevel * (0.45 + 0.55 * actor.hp / actor.maxHp) * (actor.surge > 0 ? 1.12 : 1);
  const nearby = actors.filter((a, i) => i !== slot && living(a) && distanceTo(f, a) < 7);
  const current = actors[ai.plan?.primary];
  const gap = current ? distanceTo(f, current) : Infinity;
  let p = ai.plan;
  if (p && gap < p.bestGap - 1) { p.bestGap = gap; p.progressAt = data.time; }
  const danger = f.hp / f.maxHp < 0.3 && nearby.some(a => effective(a) > effective(f) * 1.6 && ['light', 'heavy', 'special', 'surge'].includes(a.action));
  const reason = !p ? 'initial' : !living(current) ? 'death'
    : gap > 24 && data.time - p.progressAt > 2.5 ? 'unreachable'
      : danger && data.time >= (ai.dangerAfter || 0) && data.time - p.since > 1 ? 'danger'
        : data.time >= p.until ? 'expired' : null;
  if (reason) {
    const candidates = actors.map((a, i) => ({ a, i })).filter(({ a, i }) => i !== slot && living(a) && pressure(i) < limit(i));
    const ranked = candidates.map(({ a, i }) => {
      const distance = distanceTo(f, a);
      const crowd = actors.filter((b, j) => j !== i && j !== slot && living(b) && distanceTo(a, b) < 6).length;
      const retaliation = ai.attacker === i && view.time - ai.attackedAt < 4 && distance < 10 && effective(a) < effective(f) * 1.5;
      const utility = 3 * Math.log(Math.max(1, effective(f)) / Math.max(1, effective(a))) + 1.5 * (1 - a.hp / a.maxHp)
        - distance * 0.22 - pressure(i) * 1.8 - crowd * 0.7 + (retaliation ? 2.5 : 0)
          + (limit(i) === 3 ? 3 : 0) + (i === p?.primary ? 0.9 : i === p?.backup ? 0.5 : 0) + random(ai) * 0.25;
      return { i, utility };
    }).sort((a, b) => b.utility - a.utility || a.i - b.i);
    const primary = !p && ai.targetAt > data.time ? f.target : ranked[0]?.i ?? -1;
    p = ai.plan = { primary, backup: ranked.find(a => a.i !== primary)?.i ?? -1, until: !p && ai.targetAt > data.time ? ai.targetAt : data.time + 4 + random(ai) * 4,
      since: data.time, reason: !p && ai.targetAt > data.time ? 'manual' : reason, intent: 'pursue', intentUntil: 0, side: random(ai) < 0.5 ? -1 : 1, bestGap: Infinity, progressAt: data.time, neighbors: 0, range: style.range };
    if (primary >= 0 && pressure(primary) >= 2) {
      p.pressureUntil = data.pressureWindows[primary]?.until || data.time;
      p.until = Math.min(p.until, p.pressureUntil);
    }
    if (reason === 'danger') ai.dangerAfter = data.time + 4;
    if (f.target !== primary) ai.input = {};
    f.target = ai.target = primary;
  }
  const enemy = actors[p.primary];
  if (!living(enemy)) return false;
  // Primary reservations, not backup wishes, consume the bounded attacker budget.
  if (!living(actors[p.backup])) p.backup = -1;
  view.enemy = enemy;
  const distance = distanceTo(f, enemy);
  const others = actors.filter((a, i) => i !== slot && i !== p.primary && living(a));
  p.neighbors = nearby.length;
  const crowded = others.filter(a => distanceTo(f, a) < 8).length >= 2;
  const opening = enemy.action === 'charge' || enemy.surgeCharge > 0 || enemy.regeneration > 0 || enemy.emotion === 'desperate' && enemy.adrenaline > 0;
  if (ai.recoverUntil > data.time && (ai.recoverEnergy && f.energy >= style.reserve + 8 || opening && f.energy >= 20)) ai.recoverUntil = 0;
  if (!(ai.recoverUntil > data.time) && data.time >= (ai.recoverAfter || 0) && (f.energy < 12 || f.hp / f.maxHp < 0.26 && distance < 5)) {
    ai.recoverUntil = data.time + 3;
    ai.recoverAfter = data.time + 8;
    ai.recoverEnergy = f.energy < 12;
  }
  const recovering = ai.recoverUntil > data.time;
  if (recovering || opening || data.time >= p.intentUntil || p.intent === 'punish' || ['recover', 'retreat'].includes(p.intent)) {
    const flank = crowded && data.time >= (ai.flankAfter || 0);
    const intent = recovering ? distance < 5.5 ? 'retreat' : 'recover' : opening && distance < 14 ? 'punish' : flank ? 'flank' : 'pursue';
    if (p.intent !== intent || data.time >= p.intentUntil) { p.intent = intent; p.intentUntil = data.time + 0.8 + random(ai) * 0.8; }
    if (flank && intent === 'flank') ai.flankAfter = data.time + 4;
  }
  // Move an engaged pair away from unrelated fights, not away from each other.
  const mid = { x: (f.x + enemy.x) / 2, z: (f.z + enemy.z) / 2 };
  p.spaceX = p.spaceZ = 0;
  for (const a of others) {
    const d = distanceTo(mid, a), local = distanceTo(f, a);
    if (d < 11) { p.spaceX += (mid.x - a.x) / (d || 1) * (11 - d) / 11; p.spaceZ += (mid.z - a.z) / (d || 1) * (11 - d) / 11; }
    if (local < 4) { p.spaceX += (f.x - a.x) / (local || 1) * (4 - local) / 2; p.spaceZ += (f.z - a.z) / (local || 1) * (4 - local) / 2; }
  }
  return true;
}

export function getAIInput(state, slot, dt) {
  if (!Number.isInteger(slot) || !living(state.fighters[slot]) || state.phase !== 'fight') return {};
  const data = dataFor(state);
  if (data.humanPit) return {};
  const ai = data.ai[slot];
  if (!Number.isFinite(dt) || dt <= 0 || ai.sampleTick === state.tick) return { ...ai.input };
  ai.sampleTick = state.tick;
  const settings = DIFFICULTIES[state.difficulty];
  const f = state.fighters[slot];
  const pit = state.kind === 'pit';
  if (pit && !ai.controlled) {
    const full = state.fighters.filter((a, i) => i !== slot && data.ai[i]?.controlled && living(a) && a.target === f.target).length >= 2;
    if (full && ai.targetAt > data.time) return {};
    ai.controlled = true;
    if (full) { f.target = -1; ai.plan = null; }
  }
  const visible = state.fighters[f.target];
  if (!pit && (!living(visible) || f.target === slot)) { ai.input = {}; return {}; }
  if (!pit && ai.target !== f.target) { ai.target = f.target; ai.pending = []; ai.observed = null; ai.input = {}; }
  const attacks = state.events.filter((e) => e.id > ai.lastSeenEvent && e.owner === f.target && e.type === 'attack').map((e) => e.kind);
  const hits = pit ? state.events.filter(e => e.id > ai.lastSeenEvent && e.target === slot && ['hit', 'block'].includes(e.type)).map(({ owner }) => owner) : [];
  ai.lastSeenEvent = state.events.at(-1)?.id || ai.lastSeenEvent;
  // Only public, visible state enters the delayed observation queue. No enemy input,
  // cooldown, pending attack or private fighter data is available to the decision policy.
  const observe = a => ({ char: a.char, x: a.x, y: a.y, z: a.z, vx: a.vx, vz: a.vz, heading: a.heading, flight: a.flight, action: a.action, actionTime: a.actionTime, surgeCharge: a.surgeCharge, missingArm: a.missingArm, regeneration: a.regeneration, emotion: a.emotion, adrenaline: a.adrenaline });
  const ownClash = data.clashes.get(data.fighters[slot].clashId);
  ai.pending.push({ time: data.time, delay: reactionDelay(ai, settings.reaction), enemy: visible ? observe(visible) : null,
     ownClash: ownClash ? { id: ownClash.id, cue: ownClash.cue } : null,
     ...(pit ? { actors: state.fighters.map(a => ({ ...observe(a), hp: a.hp, maxHp: a.maxHp, powerLevel: a.powerLevel, alive: a.alive, surge: a.surge })), hits } : {}),
     props: state.props.map(p => ({ ...p })), hazards: state.hazards.map(h => ({ ...h })), zone: state.zone ? { ...state.zone } : null,
    projectiles: state.projectiles.filter((p) => p.owner !== slot).map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, vx: p.vx, vz: p.vz ?? 0 })), attacks });
  if (ai.pending.length > 64) ai.pending.shift();
  while (ai.pending.length && ai.pending[0].time + ai.pending[0].delay <= data.time + 1e-8) {
    const view = ai.pending.shift();
    if (pit && view.hits.length) { ai.attacker = view.hits.at(-1); ai.attackedAt = view.time; }
    if (!view.enemy) { ai.observed = view; continue; }
    const elapsed = ai.observed ? view.time - ai.observed.time : 0;
    for (const key of Object.keys(ai.habits)) ai.habits[key] *= Math.exp(-elapsed / 12);
    for (const kind of view.attacks) {
      const ranged = ['blast', 'beam', 'ultimate'].includes(kind) || (kind === 'special' && SPECIALS[view.enemy.char].speed);
      const habit = ranged ? 'ranged' : ['light', 'heavy', 'special'].includes(kind) ? 'melee' : null;
      if (habit) ai.habits[habit] = Math.min(24, ai.habits[habit] + 1);
    }
    if (view.enemy.action === 'guard' || view.enemy.action === 'charge') ai.habits[view.enemy.action] = Math.min(24, ai.habits[view.enemy.action] + elapsed * 2);
    if (view.enemy.action === 'jump' && ai.lastAction !== 'jump') ai.habits.jump = Math.min(24, ai.habits.jump + 1);
    ai.lastAction = view.enemy.action;
    ai.observed = view;
  }
  if (!ai.observed || data.time + 1e-8 < ai.nextDecision) return { ...ai.input };
  const decisionDt = settings.decision * (0.85 + random(ai) * 0.3);
  ai.nextDecision = data.time + decisionDt;
  if (ownClash) {
    ai.input = ai.observed.ownClash?.id === ownClash.id ? { guard: true, clashBoost: ai.observed.ownClash.cue && !ai.input.clashBoost && random(ai) < 0.75 } : {};
    return { ...ai.input };
  }
  const chance = random(ai), choice = random(ai), motion = random(ai);
  const style = { ...AI_STYLES[STATS[f.char].ai], ...AI_VARIANTS[f.char] };
  style.range += ai.profile.preferredRange;
  if (pit && !planPit(state, slot, ai, style)) { ai.input = {}; return {}; }
  const enemy = ai.observed.enemy;
  const technique = SPECIALS[f.char];
  const observedAge = data.time - ai.observed.time;
  const enemyX = clamp(enemy.x + enemy.vx * observedAge * settings.prediction, -state.arenaRadius, state.arenaRadius);
  const enemyZ = clamp(enemy.z + enemy.vz * observedAge * settings.prediction, -state.arenaRadius, state.arenaRadius);
  const distance = Math.hypot(enemyX - f.x, enemyZ - f.z);
  const directionX = (enemyX - f.x) / (distance || 1), directionZ = (enemyZ - f.z) / (distance || 1);
  // Behavior node: a seeded probabilistic stance over the plan intent. Refresh only
  // on decision ticks from delayed observations, so reaction latency is preserved.
  const nodeSituation = {
    opening: enemy.action === 'charge' || enemy.surgeCharge > 0 || enemy.regeneration > 0,
    desperate: f.hp / f.maxHp < 0.3,
    windful: f.energy < 25,
    crowded: pit && !!ai.plan && (ai.plan.neighbors || 0) >= 2,
  };
  if (!ai.node || !BEHAVIOR_NODES[ai.node.id] || data.time + 1e-8 >= ai.node.until) {
    ai.node = { id: pickBehaviorNode(ai, STATS[f.char].ai, nodeSituation), until: data.time + 1.6 + random(ai) * 1.6 };
  }
  const nodeMod = BEHAVIOR_NODES[ai.node.id];
  style.range += nodeMod.range;
  style.special *= nodeMod.aggression; style.ki *= nodeMod.aggression; style.heavy *= nodeMod.aggression;
  style.defense = clamp(style.defense * nodeMod.defense, 0.05, 1.5);
  const totalHabits = 1 + Object.values(ai.habits).reduce((sum, value) => sum + value, 0);
  const guardHabit = ai.habits.guard / totalHabits;
  const rangedHabit = ai.habits.ranged / totalHabits;
  const meleeHabit = ai.habits.melee / totalHabits;
  const chargeHabit = ai.habits.charge / totalHabits;
  const input = {};
  const zone = ai.observed.zone;
  const fire = ai.observed.hazards.some(h => h.kind === 'fire' && distanceTo(f, h) < h.radius + 1);
  if (zone?.active && zone.radius < 12) style.range = Math.min(style.range, 1.8);
  const move = (sign) => {
    input.moveX = directionX * sign; input.moveZ = directionZ * sign;
    if (pit) {
      const p = ai.plan;
      const separation = (p.intent === 'flank' || p.intent === 'retreat' ? (distance < 2.6 ? 0.3 : 0.8) : distance < 2.6 ? 0 : 0.2) * (zone?.active ? clamp((zone.radius - 6) / 12, 0, 1) : 1);
      input.moveX += p.spaceX * separation;
      input.moveZ += p.spaceZ * separation;
      if (p.intent === 'flank' && distance > 3) { input.moveX += directionZ * p.side * 0.45; input.moveZ -= directionX * p.side * 0.45; }
      if (p.intent === 'retreat') { input.moveX += directionZ * p.side * 0.8; input.moveZ -= directionX * p.side * 0.8; }
      const radius = Math.hypot(f.x, f.z);
      if (radius > state.arenaRadius - 5) { input.moveX -= f.x / radius; input.moveZ -= f.z / radius; }
      if (zone?.active && radius > zone.radius - 3) { input.moveX -= 2 * f.x / (radius || 1); input.moveZ -= 2 * f.z / (radius || 1); }
      const length = Math.max(1, Math.hypot(input.moveX, input.moveZ));
      input.moveX /= length; input.moveZ /= length;
    }
    // Boolean cues remain available to old controllers; analog axes are authoritative.
    input.left = input.moveX < -0.1; input.right = input.moveX > 0.1;
    input.forward = input.moveZ < -0.1; input.back = input.moveZ > 0.1;
  };
  const ready = (kind, cost = ATTACKS[kind]?.cost ?? (kind === 'special' ? 20 : ['dash', 'dodge'].includes(kind) ? 8 : 0)) => !ai.input[kind] && f.energy + 1e-8 >= cost && (data.fighters[slot].cooldowns[kind] || 0) < 1e-8;
  const incoming = ai.observed.projectiles.some((p) => {
    const x = p.x + p.vx * observedAge * settings.prediction;
    const z = p.z + p.vz * observedAge * settings.prediction;
    const dx = f.x - x, dz = f.z - z, speed = Math.hypot(p.vx, p.vz) || 1;
    return dx * p.vx + dz * p.vz > 0 && Math.hypot(dx, dz) < 6 && Math.abs(dx * p.vz - dz * p.vx) / speed < 1.2 && Math.abs(p.y - f.y - 1.5) < 1.7;
  });
  const aimed = (f.x - enemyX) * Math.sin(enemy.heading) + (f.z - enemyZ) * Math.cos(enemy.heading) > distance * 0.5 && Math.abs(enemy.y - f.y) < 1.8;
  const rangedWindup = ['beam', 'ultimate', 'blast'].includes(enemy.action) || (enemy.action === 'special' && SPECIALS[enemy.char].speed);
  const threatening = incoming || (aimed && (rangedWindup || enemy.surgeCharge > 0 || (distance < (enemy.char === 'buu' && enemy.action === 'heavy' ? 5.3 : 3.1) && ['light', 'heavy', 'special'].includes(enemy.action))));
  const next = FORMS[f.char][f.form + 1];
  const canTransform = next && f.resolve >= next.minResolve && f.energy >= next.kiCost + 5;
  const ownBusy = !!data.fighters[slot].regeneration || f.action === 'hurt' || (['light', 'heavy', 'blast', 'beam', 'ultimate', 'special', 'transform', 'dash', 'dodge', 'surge', 'throw'].includes(f.action) && f.actionTime > 1e-8);
  const needsArm = f.char === 'cell' && data.fighters[slot].missingArm;
  const enemyRegenerating = enemy.missingArm && enemy.regeneration > 0;
  const specialRange = needsArm ? false : technique.speed ? distance > 2.3 && distance < 12
    : technique.barrier ? threatening || distance < technique.reach
      : distance < technique.reach + (technique.skip || (technique.rush || 0) * technique.windup) - 0.2;
  const cover = ai.observed.props.find(p => p.hp > 0 && p.heldBy === -1 && p.respawn === 0 && Number.isFinite(sphereEntry(f.x - p.x, f.y + 1.5 - p.y, f.z - p.z, enemyX - f.x, enemy.y - f.y, enemyZ - f.z, p.radius + 0.35)));
  if (zone?.active && Math.hypot(f.x, f.z) > zone.radius - 1.5) {
    const radius = Math.hypot(f.x, f.z) || 1;
    input.moveX = -f.x / radius; input.moveZ = -f.z / radius;
    if (f.heldProp >= 0) input.drop = true;
  } else if (fire && f.y < 1 && !ownBusy) {
    if (f.heldProp >= 0) input.drop = true;
    if (!f.flight && ready('flight')) input.flight = true;
    input.jump = true;
  } else if (f.heldProp >= 0) {
    input.grab = data.fighters[slot].holdTime < 0.4;
  } else if (ownBusy) {
    if (f.action === 'light' && f.actionTime < 0.18 && f.combo < 3 && distance < 2.6) {
      const follow = f.combo === 2 ? 'heavy' : 'light';
      if (ready(follow)) input[follow] = true;
    }
  } else if (needsArm && data.fighters[slot].regenCooldown <= 1e-8 && ready('special') && !threatening && distance > 5.5) {
    input.special = true;
  } else if (enemy.flight && (!f.flight || Math.abs(enemy.y - f.y) > 0.65)) {
    // Close the observed height gap before committing an attack; never steer from held enemy inputs.
    if (!f.flight && ready('flight')) input.flight = true;
    if (enemy.y > f.y + 0.5) input.jump = true;
    else if (f.flight && enemy.y < f.y - 0.5) input.guard = true;
    if (distance > style.range) move(1);
  } else if (cover && !incoming && distance > 3) {
    const side = ai.plan?.side || (slot % 2 ? -1 : 1);
    input.moveX = directionZ * side + directionX * 0.25;
    input.moveZ = -directionX * side + directionZ * 0.25;
  } else if (pit && ['retreat', 'recover'].includes(ai.plan.intent)) {
    if (distance < 5.5 || threatening) { move(-1); if (threatening && ready('dodge')) input.dodge = true; }
    else input.charge = true;
  } else if (canTransform && f.y === 0 && !threatening && distance > 5.2 && ready('transform')) {
    input.transform = true;
  } else if (pit && ai.plan.intent === 'punish' && !incoming && distance > 2.4 && distance < 14 && ready('blast')) {
    input[technique.speed && ready('special') ? 'special' : 'blast'] = true;
  } else if (threatening && technique.barrier && !needsArm && ready('special') && choice < style.special) {
    input.special = true;
  } else if (threatening && ready('dodge') && motion < style.dash + 0.08) {
    input.dodge = true; move(-1);
  } else if (threatening && f.y === 0 && chance < style.defense * settings.defense) {
    input.guard = true;
  } else if (threatening && f.y === 0 && ready('jump') && motion < 0.3 + rangedHabit * style.learning) {
    input.jump = true;
    move(1);
  } else if (f.y === 0 && distance < 4 && ready('jump') && guardHabit > 0.35 && motion < guardHabit * style.learning) {
    input.jump = true;
    move(1);
  } else if (f.y === 0 && distance > 4.5 && f.energy < style.reserve + (ai.node.id === 'lurk' ? 20 : ai.node.id === 'bait' ? 10 : 0) && !threatening && !enemyRegenerating && (!pit || ai.plan.intent !== 'punish')) {
    input.charge = true;
  } else {
    const punish = pit && ai.plan.intent === 'punish';
    const choices = [['move', 0.45 / ai.profile.aggression / (enemyRegenerating || punish ? 1.5 : 1)]];
    if (!threatening && distance > 3 && distance < 14 && f.energy >= 25 && !ai.input.grab && ai.observed.props.some(p => p.hp > 0 && p.heldBy === -1 && p.respawn === 0 && Math.hypot(p.x - f.x, p.y - f.y - 1.5, p.z - f.z) < 5)) choices.push(['grab', f.energy < style.reserve * 0.6 ? 0.2 : 0.08]);
    if (specialRange && ready('special')) choices.push(['special', style.special * (enemy.action === 'charge' || enemyRegenerating ? 1.25 : 1)]);
    if (distance > 3 && ready('ultimate')) choices.push(['ultimate', style.ki * 0.16]);
    if (distance > 3.8 && ready('beam')) choices.push(['beam', style.ki * 0.48]);
    if (distance > 2.4 && ready('blast')) choices.push(['blast', style.ki * 0.78]);
    if (distance < (f.char === 'buu' ? 4.8 : 2.05) && Math.abs(enemy.y - f.y) < 1.7) {
      if (ready('heavy')) choices.push(['heavy', style.heavy + guardHabit * style.learning * 0.3]);
      if (distance < 2.05 && ready('light')) choices.push(['light', 1 - style.heavy]);
    }
    if (pit) for (const entry of choices) if (entry[0] !== 'move') entry[1] *= 1.3 * (['blast', 'beam', 'ultimate', 'special'].includes(entry[0]) ? clamp((28 - distance) / 16, 0.1, 1) * (punish ? 2 : 1) : 1);
    const selected = categorical(ai, choices);
    if (selected !== 'move') input[selected] = true;
    else {
      let range = style.range + style.learning * (meleeHabit - rangedHabit - chargeHabit) * 1.2;
      if (technique.type === 'flick') range = 1.4 + ai.profile.preferredRange * 0.5;
      if (STATS[f.char].ai === 'erratic') range = 1.2 + choice * 4 + ai.profile.preferredRange;
      if (enemyRegenerating) range = Math.min(range, 2);
      if (f.energy < 8) range = 1.5;
      if (distance > range || (canTransform && distance < 5.2 && motion < 0.3)) {
        move(canTransform && distance < 5.2 ? -1 : 1);
        if (ready('dash') && distance > 5 && motion < style.dash) input.dash = true;
      } else if (distance < range - 0.6 && Math.hypot(f.x, f.z) < state.arenaRadius - 1) {
        move(-1);
      }
      if (f.y === 0 && ready('jump') && motion > 1 - style.jump) input.jump = true;
    }
  }
  if (!fire && !ownBusy && f.heldProp < 0 && !(needsArm && input.special) && f.flight && !enemy.flight && ready('flight')) input.flight = true;
  // Poisson hazard per decision interval, with a paid-in-time, interruptible public warning.
  const surgeRate = f.hp / f.maxHp <= 0.2 ? 0.18 : 0.025;
  if (!ownBusy && !(needsArm && input.special) && data.time > 8 && f.surgeCooldown <= 1e-8 && !f.surge && !f.surgeCharge && !ai.surgeRequested && random(ai) < -Math.expm1(-surgeRate * decisionDt)) ai.surgeRequested = true;
  ai.input = input;
  return { ...input };
}

import { ROSTER, FORMS, STAGES } from './catalog.mjs';
import { ATTACHMENTS } from './gear.mjs';

/** Local visual snapshots only, never authoritative combat/progression data.
 * createReplayStore() is synchronous. All methods return promises except status(),
 * which returns a fresh {persistent:boolean,message:string} snapshot. Call list()
 * to initialize storage. save(clip) resolves metadata; list() resolves metadata[]
 * newest first; load(id) resolves a detached clip or null; remove(id) resolves a
 * boolean; clear()/dispose() resolve undefined. dispose drains already queued work,
 * closes the connection, releases memory, and rejects subsequent work (DISPOSED).
 * Metadata: {id,label,createdAt,duration,stage,kind,storage,bytes,frameCount}.
 * storage is 'indexeddb' or 'memory'; bytes includes a conservative record overhead.
 * Storage failure switches this store permanently to bounded, session-only memory.
 * Deletions in that mode affect memory ONLY, not inaccessible disk copies.
 * Invalid input rejects INVALID_REPLAY / TOO_LARGE; damaged disk data rejects
 * CORRUPT_REPLAY; missing gzip support rejects UNSUPPORTED_ENCODING. Read failures
 * are never silently reported as valid clips. Render labels with textContent.
 * Optional test/platform adapters: {indexedDB:null|IDBFactory,compression:boolean,
 * timeoutMs:number}. Limits and database name are intentionally not configurable.
 * Recorder capture(state,dt) uses seconds and returns whether a sample was taken.
 * finish() is non-destructive: a new detached clip, or null if no samples exist.
 * It rebases retained timestamps to zero without changing their relative spacing.
 */
export const REPLAY_LIMITS = Object.freeze({ seconds: 60, frames: 600, hz: 10, clips: 5, bytes: 12 * 1024 * 1024, projectiles: 96, events: 48 });
const DB_NAME = 'uc-replays-v1', MAX_INT = 2147483647, EPS = 1e-8;
const characters = new Set(ROSTER.map(f => f.id));
const stages = new Set(STAGES.map(s => s.id));
const gear = new Map(ATTACHMENTS.map(a => [a.id, a.slot]));
const kinds = new Set(['duel', 'pit', 'solo', 'local', 'training', 'tournament', 'network', 'spectate']);
const actions = new Set(['idle', 'run', 'guard', 'jump', 'flight', 'light', 'heavy', 'blast', 'beam', 'ultimate', 'special', 'transform', 'charge', 'dash', 'dodge', 'hurt', 'down', 'surge', 'regenerate', 'lift', 'throw', 'clash']);
const attacks = new Set(['light', 'heavy', 'blast', 'beam', 'ultimate', 'special', 'dash', 'dodge', 'vanish', 'grab', 'transform', 'launcher', 'surge']);
const phases = new Set(['countdown', 'fight', 'roundOver', 'matchOver', 'disconnected']);

export class ReplayError extends Error {
  constructor(code, message) { super(message); this.name = 'ReplayError'; this.code = code; }
}
function invalid(path) { throw new ReplayError('INVALID_REPLAY', `Invalid replay field: ${path}.`); }
function plain(value, path) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(path);
  return value;
}
// Never read getters, inherit fields, copy arbitrary keys, or stringify caller data.
function own(value, key) {
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (d && !Object.hasOwn(d, 'value')) invalid(key);
  return d?.value;
}
function number(value, min, max, path, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(path);
  return value;
}
function choice(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) invalid(path);
  return value;
}
function array(value, max, path, visit, min = 0) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < min || value.length > max) invalid(path);
  const out = [];
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i)) invalid(path);
    out.push(visit(own(value, String(i)), i));
  }
  return out;
}
function fields(value, schema, path) {
  plain(value, path);
  const out = {};
  for (const [key, rule] of Object.entries(schema)) {
    const v = own(value, key);
    if (v !== undefined) out[key] = rule(v, `${path}.${key}`);
  }
  return out;
}
function required(value, names, path) {
  for (const name of names.split(' ')) if (!Object.hasOwn(value, name)) invalid(`${path}.${name}`);
  return value;
}
const n = (lo, hi, integer = false) => (v, p) => number(v, lo, hi, p, integer);
const enumeration = set => (v, p) => choice(v, set, p);
const bool = (v, p) => { if (typeof v !== 'boolean') invalid(p); return v; };
const nullable = rule => (v, p) => v === null ? null : rule(v, p);
const position = n(-500, 500), counter = n(0, MAX_INT, true), seconds = n(0, 60);
const heading = n(-Math.PI * 4, Math.PI * 4);
const fighterSchema = {
  char: enumeration(characters), x: position, y: position, z: position,
  vx: position, vy: position, vz: position, heading,
  face: (v, p) => { if (v !== -1 && v !== 1) invalid(p); return v; },
  target: n(-1, 11, true), alive: bool, rank: nullable(n(1, 12, true)),
  hp: n(0, 2000), maxHp: (v,p)=>{if(v!==1000&&v!==2000)invalid(p);return v;}, energy: n(0, 100), action: enumeration(actions),
  actionTime: seconds, combo: n(0, 3, true), hitFlash: n(0, 1), form: n(0, 20, true),
  resolve: n(0, 100), mastery: n(0, 10000), level: n(1, 5, true), powerLevel: n(0, 10000),
  flight: bool, dodgeTime: n(0, 1), dodgeCooldown: seconds,
  vanishTime: n(0,.18), evadeKind: enumeration(new Set(['normal','vanish'])), heldProp: n(-1,7,true),
  dodgeX: n(-1, 1), dodgeY: n(-1, 1), dodgeZ: n(-1, 1), counterWindow: seconds,
  surge: seconds, surgeCharge: seconds, surgeCooldown: seconds,
  missingArm: bool, regeneration: n(0, 1), regenCooldown: n(0, 20),
  aura: counter,
  clashId: n(-1, MAX_INT, true), emotion: enumeration(new Set(['calm','pressured','desperate','shocked'])), adrenaline: n(0,6),
  tint: (v, p) => { if (typeof v !== 'string' || !/^#[\da-f]{6}$/i.test(v)) invalid(p); return v.toLowerCase(); },
  loadout: (v, p) => {
    const slots = new Set();
    return array(v, 5, p, id => {
      if (typeof id !== 'string' || !gear.has(id) || slots.has(gear.get(id))) invalid(p);
      slots.add(gear.get(id)); return id;
    });
  },
  cooldowns: (v, p) => fields(v, Object.fromEntries([...attacks].map(id => [id, seconds])), p),
};
const projectileSchema = {
  id: counter, owner: n(0, 11, true), x: position, y: position, z: position,
  vx: position, vy: position, vz: position,
  kind: enumeration(new Set(['blast', 'beam', 'ultimate', 'special'])),
  life: n(0, 3), radius: n(0, 5), counter: bool,
  prop: bool, propId: n(0,7,true),
  bounces: n(0,1,true), meteor: bool, targetX: position, targetY: position, targetZ: position, splashRadius: n(0,6),
};
const eventKinds = {
  attack: attacks, hit: attacks, block: attacks, counter: attacks,
  dodge: new Set(['perfect', 'evade']), flight: new Set(['on', 'off']),
  jump: new Set(['jump']), land: new Set(['rubble', 'cracked seams', 'spawn stone', 'polished inlay', 'basalt']),
  boundary: new Set(['dodge', 'knockback']), combo: new Set(['launcher']),
  round: new Set(['draw', 'win']), match: new Set(['draw', 'win', 'timeout', 'lastStanding']),
  elimination: new Set(['knockout']), surge: new Set(['windup', 'active', 'interrupted']),
  limb: new Set(['lost', 'regrown']), regeneration: new Set(['started', 'interrupted']),
  aura: new Set(['combo', 'skill-chain', 'round-win', 'match-win', 'pit-win']),
  ki: new Set(['guard','evade']),
  prop: new Set(['lift','throw','drop','break','respawn']),
  environment: new Set(['fire','zone']),
  clash: new Set(['start','boost','win','draw','break']),
  explosion: new Set(['blast','beam','ultimate']),
  ricochet: new Set(['blast']),
  emotion: new Set(['pressured','desperate','shocked']),
  transform: new Set(Object.values(FORMS).flat().map(f => f.id)),
  revert: new Set(Object.values(FORMS).flat().map(f => f.id)),
};
const eventSchema = {
  id: counter, type: enumeration(new Set(Object.keys(eventKinds))),
  owner: n(-1, 11, true), target: n(-1, 11, true),
  x: position, y: position, z: position, power: n(0, 10000), heading,
  windup: seconds, duration: seconds, cooldown: seconds, counterWindow: seconds,
  height: position, vy: position, counter: bool, launcher: bool,
  rank: n(1, 12, true), aliveCount: n(0, 12, true),
  total: counter,
  prop: bool, propId: n(0,7,true), evadeKind: enumeration(new Set(['normal','vanish'])),
  clashId: counter, radius: n(0,6), meteor: bool, targetX: position, targetY: position, targetZ: position,
};

export function sanitizeReplayState(value) {
  const state = required(fields(value, {
    stage: enumeration(stages), kind: enumeration(new Set(['duel', 'pit'])),
    phase: enumeration(phases), phaseTime: seconds, timer: n(0, 3600),
    round: n(1, 100000, true), tick: counter, winner: nullable(n(-1, 11, true)),
    arenaRadius: n(1, 500), aliveCount: n(0, 12, true), training: bool,
  }, 'state'), 'stage kind phase phaseTime timer tick', 'state');
  state.fighters = array(own(value, 'fighters'), 12, 'fighters', (f, slot) => {
    const out = required(fields(f, fighterSchema, `fighters[${slot}]`), 'char x y z hp energy action actionTime form', 'fighter');
    if (out.form >= FORMS[out.char].length) invalid('fighter.form');
    if (out.hp > (out.maxHp ?? 1000) || (state.kind === 'duel' && out.maxHp === 2000)) invalid('fighter.hp');
    return out;
  }, 2);
  const count = state.fighters.length;
  if (count !== (state.kind === 'pit' ? 12 : 2)) invalid('fighters.length');
  for (const f of state.fighters) if (f.target >= count || f.rank > count) invalid('fighter.slot');
  if (state.winner >= count || state.aliveCount > count) invalid('state.slot');
  const clashValues = own(value, 'clashes');
  if (clashValues !== undefined) {
    const seen = new Set(), participants = new Set();
    state.clashes = array(clashValues, 6, 'clashes', c => {
      const out = required(fields(c, { id:counter, a:n(0,11,true), b:n(0,11,true), x:position, y:position, z:position,
        progress:n(-1,1), age:n(0,18), remaining:n(0,18), cue:bool, powerA:n(0,6), powerB:n(0,6) }, 'clash'),
      'id a b x y z progress age remaining cue powerA powerB', 'clash');
      if (seen.has(out.id) || out.a === out.b || out.a >= count || out.b >= count
        || participants.has(out.a) || participants.has(out.b)) invalid('clash.id/participants');
      for (const slot of [out.a, out.b]) {
        if (state.fighters[slot].clashId !== out.id) invalid('fighter.clashId');
        participants.add(slot);
      }
      seen.add(out.id); return out;
    });
    for (const [slot, f] of state.fighters.entries()) if (f.clashId >= 0 && !participants.has(slot)) invalid('fighter.clashId');
  } else if (state.fighters.some(f => f.clashId >= 0)) invalid('state.clashes');
  const propValues = own(value,'props');
  if(propValues !== undefined){
    const seen = new Set();
    state.props = array(propValues,8,'props',p=>{
      const out = required(fields(p,{id:n(0,7,true),x:position,y:position,z:position,radius:n(0,2),hp:n(0,120),heldBy:n(-1,11,true),respawn:n(0,8)},'prop'),'id x y z radius hp heldBy respawn','prop');
      if(seen.has(out.id)||out.heldBy>=count)invalid('prop.id/owner');seen.add(out.id);return out;
    });
  }
  const hazardValues = own(value,'hazards');
  if(hazardValues !== undefined)state.hazards=array(hazardValues,8,'hazards',h=>required(fields(h,{kind:enumeration(new Set(['water','fire'])),x:position,z:position,radius:n(0,20)},'hazard'),'kind x z radius','hazard'));
  const zoneValue=own(value,'zone');
  if(zoneValue!==undefined)state.zone=zoneValue===null?null:required(fields(zoneValue,{radius:n(0,500),progress:n(0,1),active:bool,damagePerSecond:n(0,100)},'zone'),'radius progress active damagePerSecond','zone');
  state.wins = array(own(value, 'wins'), count, 'wins', n(0, 100000, true), count);
  const ids = new Set();
  state.projectiles = array(own(value, 'projectiles'), REPLAY_LIMITS.projectiles, 'projectiles', p => {
    const out = required(fields(p, projectileSchema, 'projectile'), 'id owner x y z vx vy vz kind life radius', 'projectile');
    if (out.owner >= count || ids.has(out.id)) invalid('projectile.owner/id');
    ids.add(out.id); return out;
  });
  let lastEvent = -1;
  state.events = array(own(value, 'events'), state.kind === 'pit' ? 48 : 24, 'events', e => {
    const out = required(fields(e, eventSchema, 'event'), 'id type owner target x y z power', 'event');
    out.kind = choice(own(e, 'kind'), eventKinds[out.type], 'event.kind');
    if (out.owner >= count || out.target >= count || out.id <= lastEvent || out.rank > count || out.aliveCount > count) invalid('event.slot/id');
    if (['transform', 'revert'].includes(out.type) && (out.owner < 0 || !FORMS[state.fighters[out.owner].char].some(f => f.id === out.kind))) invalid('event.form');
    lastEvent = out.id; return out;
  });
  return state;
}

function identifier(v) {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) invalid('id');
  return v;
}
function label(v) {
  if (typeof v !== 'string' || !v.trim() || v.length > 96 || /[<>\u0000-\u001f\u007f]/.test(v)) invalid('label');
  return v;
}
function header(value) {
  plain(value, 'clip');
  if (own(value, 'version') !== 1) invalid('version');
  return {
    version: 1, id: identifier(own(value, 'id')),
    createdAt: number(own(value, 'createdAt'), 0, 8640000000000000, 'createdAt', true),
    stage: choice(own(value, 'stage'), stages, 'stage'),
    kind: choice(own(value, 'kind'), kinds, 'kind'), label: label(own(value, 'label')),
    duration: number(own(value, 'duration'), 0, 60, 'duration'),
  };
}
function jsonBlob(value) { return new Blob([JSON.stringify(value)], { type: 'application/json' }); }
function sizeCheck(size) {
  if (size > REPLAY_LIMITS.bytes) throw new ReplayError('TOO_LARGE', 'Replay exceeds the fixed 12 MiB limit.');
}
export function validateReplayClip(value) {
  const clip = header(value);
  let previous = -1;
  clip.frames = array(own(value, 'frames'), 600, 'frames', frame => {
    plain(frame, 'frame');
    const t = number(own(frame, 't'), 0, 60, 'frame.t');
    if (previous >= 0 && t - previous < 0.1 - EPS) invalid('frame.t order/rate');
    previous = t;
    return { t, state: sanitizeReplayState(own(frame, 'state')) };
  }, 1);
  if (clip.frames[0].t !== 0 || Math.abs(clip.frames.at(-1).t - clip.duration) > EPS) invalid('duration/timestamps');
  sizeCheck(jsonBlob(clip).size);
  return clip;
}

let idSequence = 0;
function newId() { return globalThis.crypto?.randomUUID?.() ?? `replay-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`; }
export function createReplayRecorder(meta = {}) {
  plain(meta, 'meta');
  const stage = own(meta, 'stage'), kind = own(meta, 'kind'), title = own(meta, 'label');
  if (stage !== undefined) choice(stage, stages, 'meta.stage');
  if (kind !== undefined) choice(kind, kinds, 'meta.kind');
  if (title !== undefined) label(title);
  let clock = 0, lastSample = -Infinity, tick = 0, eventId = 0, sourceEvent = -1, sourceTick = -1, bytes = 0;
  const samples = [];
  return {
    capture(state, dt) {
      number(dt, 0, 86400, 'dt');
      const nextClock = clock + dt;
      if (nextClock - lastSample < .1 - EPS) { clock = nextClock; return false; }
      const visual = sanitizeReplayState(state);
      const reset = visual.tick < sourceTick;
      const newEvents = visual.events.filter(e => e.id > (reset ? -1 : sourceEvent));
      sourceTick = visual.tick;
      sourceEvent = visual.events.at(-1)?.id ?? (reset ? -1 : sourceEvent);
      visual.tick = ++tick;
      visual.events = newEvents.map(e => ({ ...e, id: ++eventId }));
      clock = lastSample = nextClock;
      const sample = { t: clock, state: visual };
      const size = jsonBlob(sample).size + 1;
      samples.push({ sample, size }); bytes += size;
      // Keep both the ring and uncompressed representation bounded, including pits.
      while (samples.length > 600 || clock - samples[0].sample.t > 60 || bytes > REPLAY_LIMITS.bytes - 2048) bytes -= samples.shift().size;
      return true;
    },
    finish() {
      if (!samples.length) return null;
      const origin = samples[0].sample.t;
      const frames = samples.map(({ sample }) => ({ t: Math.max(0, Number((sample.t - origin).toFixed(9))), state: sample.state }));
      return validateReplayClip({ version: 1, id: newId(), createdAt: Date.now(), stage: stage ?? frames.at(-1).state.stage, kind: kind ?? frames.at(-1).state.kind, label: title ?? 'Arena replay', duration: frames.at(-1).t, frames });
    },
  };
}

async function boundedBlob(stream, limit, timeoutMs) {
  const reader = stream.getReader();
  let timer;
  const work = (async () => {
    const chunks = []; let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return new Blob(chunks);
      total += value.byteLength;
      if (total > limit) throw new ReplayError('TOO_LARGE', 'Replay data exceeds the decoding limit.');
      chunks.push(value);
    }
  })();
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ReplayError('STORAGE_TIMEOUT', 'Replay codec timed out.')), timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
function metadata(row, persistent) {
  const { id, label, createdAt, duration, stage, kind, bytes, frameCount } = row;
  return { id, label, createdAt, duration, stage, kind, storage: persistent ? 'indexeddb' : 'memory', bytes, frameCount };
}
function newest(a, b) { return b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
function capped(rows, incoming) {
  const next = [...rows.filter(r => r.id !== incoming.id), incoming].sort(newest);
  let total = next.reduce((sum, r) => sum + r.bytes, 0);
  while (next.length > 5 || total > REPLAY_LIMITS.bytes) {
    const index = next.findLastIndex(r => r.id !== incoming.id);
    if (index < 0) sizeCheck(total);
    total -= next.splice(index, 1)[0].bytes;
  }
  return next;
}
function corrupt(error) {
  if (error?.code === 'UNSUPPORTED_ENCODING') return error;
  return new ReplayError('CORRUPT_REPLAY', 'This replay is corrupt or unsupported. It was not played; delete this clip to remove it.');
}
function storedRow(value) {
  try {
    const row = header(value);
    row.blob = own(value, 'blob');
    if (!(row.blob instanceof Blob)) invalid('blob');
    row.encoding = choice(own(value, 'encoding'), new Set(['gzip', 'json']), 'encoding');
    row.bytes = number(own(value, 'bytes'), 1024, REPLAY_LIMITS.bytes, 'bytes', true);
    row.frameCount = number(own(value, 'frameCount'), 1, 600, 'frameCount', true);
    if (row.bytes !== row.blob.size + 1024) invalid('bytes');
    return row;
  } catch (error) { throw corrupt(error); }
}

export function createReplayStore(options = {}) {
  const timeoutMs = options.timeoutMs ?? 3000;
  number(timeoutMs, 10, 30000, 'timeoutMs', true);
  let factory, db = null, opening = null, memoryOnly = false, closing = false, disposed = null;
  let queue = Promise.resolve(), memory = new Map();
  let snapshot = { persistent: false, message: 'Local replay storage has not opened yet.' };
  function fallback(error) {
    const reason = error?.name === 'QuotaExceededError' ? 'Device storage is full.' : error?.code === 'STORAGE_TIMEOUT' ? 'Local storage timed out or was blocked.' : 'Local storage is unavailable.';
    memoryOnly = true;
    const connection = db; db = null; connection?.close();
    snapshot = { persistent: false, message: `${reason} Memory only: changes will be lost on reload and disk copies may differ. No other storage was cleared.` };
  }
  try { factory = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB; }
  catch (error) { fallback(error); }
  function open() {
    if (memoryOnly || db) return Promise.resolve();
    if (opening) return opening;
    opening = new Promise(resolve => {
      let request, timer, settled = false;
      const fail = error => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { request?.transaction?.abort(); } catch { /* Late upgrade may already be inactive. */ }
        fallback(error); resolve();
      };
      try {
        if (!factory) { fail(); return; }
        request = factory.open(DB_NAME, 1);
        timer = setTimeout(() => fail(new ReplayError('STORAGE_TIMEOUT', 'Storage open timed out.')), timeoutMs);
        request.onblocked = () => fail(new ReplayError('STORAGE_TIMEOUT', 'Storage open blocked.'));
        request.onerror = () => fail(request.error);
        request.onupgradeneeded = () => {
          if (settled) { request.transaction.abort(); return; }
          try {
            if (!request.result.objectStoreNames.contains('clips')) request.result.createObjectStore('clips', { keyPath: 'id' });
          } catch (error) { fail(error); }
        };
        request.onsuccess = () => {
          const connection = request.result;
          if (settled) { connection.close(); return; }
          if (!connection.objectStoreNames.contains('clips')) { connection.close(); fail(); return; }
          settled = true; clearTimeout(timer); db = connection;
          connection.onversionchange = () => { if (db === connection) fallback(); };
          connection.onclose = () => { if (db === connection) fallback(); };
          snapshot = { persistent: true, message: 'Replays saved on this browser only. No cloud or cross-device sync.' };
          resolve();
        };
      } catch (error) { fail(error); }
    });
    return opening;
  }
  function enqueue(work) {
    if (closing) return Promise.reject(new ReplayError('DISPOSED', 'Replay store is disposed.'));
    const task = queue.then(async () => { await open(); return work(); });
    queue = task.catch(() => {});
    return task;
  }
  function transaction(mode, work) {
    return new Promise((resolve, reject) => {
      let tx, timer, result, failure, settled = false;
      const fail = error => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(error);
      };
      try {
        tx = db.transaction('clips', mode);
        tx.oncomplete = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
        tx.onabort = () => fail(failure ?? tx.error ?? new Error('Replay transaction aborted.'));
        tx.onerror = () => { failure ??= tx.error; };
        timer = setTimeout(() => {
          failure = new ReplayError('STORAGE_TIMEOUT', 'Replay transaction timed out.');
          try { tx.abort(); } catch { /* Completion may already have been dispatched. */ }
          fail(failure);
        }, timeoutMs);
        const abort = error => { failure = error; try { tx.abort(); } catch { fail(error); } };
        work(tx.objectStore('clips'), value => { result = value; }, abort);
      } catch (error) {
        failure = error;
        try { tx?.abort(); } catch { /* No active transaction. */ }
        fail(error);
      }
    });
  }
  function readRows(store, done, abort) {
    const rows = []; let total = 0;
    const request = store.openCursor();
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (!cursor) { done(rows); return; }
        if (rows.length >= 5) throw corrupt();
        const row = storedRow(cursor.value);
        if (cursor.primaryKey !== row.id || (total += row.bytes) > REPLAY_LIMITS.bytes) throw corrupt();
        rows.push(row); cursor.continue();
      } catch (error) { abort(error); }
    };
  }
  function remember(rows) { memory = new Map(rows.map(row => [row.id, row])); }
  function storageFailure(error) {
    if (error instanceof ReplayError && ['CORRUPT_REPLAY', 'INVALID_REPLAY', 'TOO_LARGE', 'UNSUPPORTED_ENCODING'].includes(error.code)) {
      snapshot = { ...snapshot, message: error.message }; throw error;
    }
    fallback(error);
  }
  async function pack(clip) {
    let blob = jsonBlob(clip), encoding = 'json';
    sizeCheck(blob.size);
    if (options.compression !== false && typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function') {
      try {
        const compressed = await boundedBlob(blob.stream().pipeThrough(new CompressionStream('gzip')), REPLAY_LIMITS.bytes, timeoutMs);
        if (compressed.size < blob.size) { blob = compressed; encoding = 'gzip'; }
      } catch { /* Bounded plain JSON is valid when a codec is unavailable or broken. */ }
    }
    sizeCheck(blob.size + 1024);
    return { ...header(clip), blob, encoding, bytes: blob.size + 1024, frameCount: clip.frames.length };
  }
  async function unpack(value, id) {
    try {
      const row = storedRow(value);
      if (row.id !== id) invalid('stored id');
      let blob = row.blob;
      if (row.encoding === 'gzip') {
        if (typeof globalThis.DecompressionStream !== 'function') throw new ReplayError('UNSUPPORTED_ENCODING', 'This browser cannot decompress this replay. Open it in a browser with gzip support.');
        blob = await boundedBlob(blob.stream().pipeThrough(new DecompressionStream('gzip')), REPLAY_LIMITS.bytes, timeoutMs);
      }
      sizeCheck(blob.size);
      const clip = validateReplayClip(JSON.parse(await blob.text()));
      for (const key of Object.keys(header(clip))) if (clip[key] !== row[key]) invalid('stored metadata');
      if (clip.frames.length !== row.frameCount) invalid('stored frameCount');
      return clip;
    } catch (error) {
      const failure = corrupt(error); snapshot = { ...snapshot, message: failure.message }; throw failure;
    }
  }
  return {
    list() {
      return enqueue(async () => {
        if (db) {
          try { remember(await transaction('readonly', (store, done, abort) => readRows(store, done, abort))); }
          catch (error) { storageFailure(error); }
        }
        return [...memory.values()].sort(newest).map(row => metadata(row, !!db));
      });
    },
    save(value) {
      // Detach at invocation, before yielding to a codec or another queued operation.
      let clip, error;
      try { clip = validateReplayClip(value); } catch (e) { error = e; }
      return enqueue(async () => {
        if (error) throw error;
        const row = await pack(clip);
        if (db) {
          try {
            const rows = await transaction('readwrite', (store, done, abort) => readRows(store, existing => {
              remember(existing);
              const next = capped(existing, row);
              for (const old of existing) if (!next.some(r => r.id === old.id)) store.delete(old.id);
              store.put(row); done(next);
            }, abort));
            remember(rows);
            return metadata(row, true);
          } catch (error) { storageFailure(error); }
        }
        remember(capped([...memory.values()], row));
        return metadata(row, false);
      });
    },
    load(id) {
      return enqueue(async () => {
        identifier(id);
        let row = memory.get(id);
        if (db) {
          try {
            row = await transaction('readonly', (store, done) => {
              const request = store.get(id); request.onsuccess = () => done(request.result);
            });
          } catch (error) { storageFailure(error); }
        }
        if (!row) { memory.delete(id); return null; }
        const clip = await unpack(row, id);
        remember(capped([...memory.values()], storedRow(row)));
        return clip;
      });
    },
    remove(id) {
      return enqueue(async () => {
        identifier(id);
        let existed = memory.has(id);
        if (db) {
          try {
            existed = await transaction('readwrite', (store, done, abort) => {
              const request = store.count(id);
              request.onsuccess = () => {
                try { store.delete(id); done(request.result > 0); } catch (error) { abort(error); }
              };
            });
          } catch (error) { storageFailure(error); }
        }
        memory.delete(id); return existed;
      });
    },
    clear() {
      return enqueue(async () => {
        if (db) {
          try { await transaction('readwrite', store => { store.clear(); }); }
          catch (error) { storageFailure(error); }
        }
        memory.clear();
      });
    },
    status() { return { ...snapshot }; },
    dispose() {
      if (!disposed) {
        closing = true;
        disposed = queue.then(() => {
          const connection = db; db = null; connection?.close(); memory.clear();
          snapshot = { persistent: false, message: 'Replay store disposed.' };
        });
      }
      return disposed;
    },
  };
}

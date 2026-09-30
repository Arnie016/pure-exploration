import {
  ROSTER,
  MAX_HP,
  MAX_ENERGY,
  createMatch,
  createPit,
  stepMatch,
  getAIInput,
  getAITactics,
  getForm,
} from './combat.mjs';
import { FORMS, STAGES, PERSONAS } from './catalog.mjs';
import {
  ATTACHMENTS,
  GEAR_SLOTS,
  normalizeLoadout,
  validateLoadout,
  randomLoadout,
  getLoadoutStats,
} from './gear.mjs';
import { INTEL } from './intel.mjs';
import {
  createTournament,
  nextPlayerMatch,
  recordPlayerMatch,
  tickTournament,
  createLadder,
  nextLadderMatch,
  recordLadderMatch,
} from './tournament.mjs';
import { DRILLS, TUTORIAL_STEPS, createTraining, stepTraining, resetTraining, recordTrainingLook } from './training.mjs';
import { createReplayStore, createReplayRecorder } from './replay.mjs';
import { createWorld } from './world.mjs';
import { createAudio } from './audio.mjs';
import { createPersona } from './persona.mjs';
import { pickupCandidate, aimCandidate, powerReadiness, actionReason } from './readability.mjs';
import { normalizePresentation, DEFAULT_PRESENTATION } from './presentation.mjs';
import { createExperience } from './experience.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function validateServerOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === '/' && value === url.origin ? url.origin : null;
  } catch { return null; }
}
const serverOriginMeta = $('meta[name="uc-server-origin"]');
const backendOrigin = serverOriginMeta ? validateServerOrigin(serverOriginMeta.content) : location.origin;
const multiplayerEnabled = $('meta[name="uc-multiplayer"]')?.content !== 'disabled' && !!backendOrigin;
const socketURL = backendOrigin ? `${backendOrigin.replace(/^http/, 'ws')}/ws` : null;
const byId = Object.fromEntries(ROSTER.map((fighter) => [fighter.id, fighter]));
const stageById = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]));
const gearById = Object.fromEntries(ATTACHMENTS.map((gear) => [gear.id, gear]));
const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const seed = () => globalThis.crypto?.getRandomValues
  ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clone = (value) => (value == null ? null : structuredClone(value));
const safeJSON = (value) => { try { return JSON.parse(value); } catch { return null; } };
const readPreference = (key, fallback) => {
  try {
    return localStorage.getItem(`uc-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
};
const savePreference = (key, value) => {
  try {
    localStorage.setItem(`uc-${key}`, value);
  } catch {
    /* Storage may be disabled. */
  }
};
const keymap = {
  KeyW: 'forward',
  KeyA: 'left',
  KeyS: 'back',
  KeyD: 'right',
  Space: 'flight',
  ShiftLeft: 'dodge',
  ShiftRight: 'dodge',
  KeyQ: 'dodge',
  KeyC: 'guard',
  KeyE: 'jump',
  KeyX: 'context',
  KeyF: 'special',
  KeyZ: 'vanish',
  KeyG: 'grab',
  KeyT: 'charge',
  KeyR: 'transform',
  KeyV: 'ultimate',
  Tab: 'targetNext',
  KeyH: 'targetNext',
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'energy',
  KeyU: 'beam',
  KeyI: 'ultimate',
};
const heldActions = new Set([
  'forward',
  'back',
  'left',
  'right',
  'jump',
  'guard',
  'charge',
  'grab',
]);
const abilityDefinitions = [
  ['light', 'Strike', 'J', 'COMBO START', 'M5 18 17 6M6 5l2 4M15 16l4 2M4 12h3'],
  ['heavy', 'Heavy', 'K', 'FINISHER', 'M5 9l7-5 7 5-7 11Z M5 9h14M12 4v16'],
  ['dodge', 'Evade', 'Q', '8 KI', 'm8 5 7 7-7 7M3 8h3M2 12h4M3 16h3'],
  ['guard', 'Guard', 'Hold C', 'HOLD / DESCEND', 'M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6Z M12 7v9'],
  ['energy', 'Ki blast', 'L', '8 KI / HOLD FOR BEAM', 'M8 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M2 8h3M1 12h4M2 16h3'],
  ['special', 'Technique', 'F', '20 KI', 'm12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3Z'],
  ['charge', 'Charge Ki', 'Hold T', 'STAND STILL', 'm6 15 6-10 6 10M12 5v15M3 6l2-2M19 4l2 2'],
  ['jump', 'Ascend', 'E', 'JUMP / RISE', 'm5 11 7-7 7 7M12 4v14M5 20h14'],
];
const icons = {
  play:'m9 5 10 7-10 7Z', audio:'M4 9h4l5-5v16l-5-5H4ZM17 8q6 4 0 8',
  visuals:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  training:'M4 20 20 4M5 4h5v5H5Zm10 11h5v5h-5Z', replays:'M4 4h16v16H4ZM4 8h16M8 4v4m8-4v4m-6 3 5 3-5 3Z',
  exit:'M10 4H4v16h6m4-13 5 5-5 5m-6-5h11', save:'M5 3h12l4 4v14H3V3Zm2 0v6h10V3M7 21v-8h10v8',
  reset:'M4 10a8 8 0 1 1 1 8M4 4v6h6', shuffle:'M3 6h3c6 0 6 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-2 5-5m3-5c1-1 2-2 4-2h3m-4-4 4 4-4 4',
  pool:'M8 20v-3a4 4 0 0 1 8 0v3M9 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M2 19v-4q0-3 4-3m12 0q4 0 4 3v4',
  person:'M7 21v-4a5 5 0 0 1 10 0v4M8 6a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  move:'m12 2-3 3m3-3 3 3M12 2v20m0 0-3-3m3 3 3-3M2 12h20m0 0-3-3m3 3-3 3M2 12l3-3m-3 3 3 3',
  look:'M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Zm9-3v6m-3-3h6',
  chain:'m9 15 6-6M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2 8a4 4 0 0 0 5 0l5-5a4 4 0 0 0-5-5l-2 2',
};
function icon(name) {
  const path = icons[name] || abilityDefinitions.find(item => item[0] === name)?.[4] || icons.training;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
function drillIcon(drill) {
  return icon(drill.id === 'flight' || drill.id === 'transform' ? 'power' : ['beam','blast'].includes(drill.id) ? 'energy' : drill.action);
}
const costs = {
  light: 0,
  heavy: 0,
  dodge: 8,
  vanish: 16,
  grab: 10,
  guard: 0,
  blast: 8,
  beam: 35,
  special: 20,
  ultimate: 100,
};
const cooldownDuration = {
  light: 0.3,
  heavy: 0.7,
  dodge: 0.65,
  vanish: 2,
  blast: 0.35,
  beam: 3,
  special: 5,
  ultimate: 8,
};
let selected = 'goku',
  opponent = 'jiren',
  selectedMode = 'story',
  selectedStage = 'void',
  difficulty = 'normal';
let loadout = [],
  tint = '#ffc45b',
  previewForm = 0,
  previewUntil = 0,
  cameraMode = 2;
const savedProfile = safeJSON(readPreference('profile-v1', 'null'));
if (savedProfile?.version === 1) {
  if (Object.hasOwn(byId, savedProfile.fighter)) selected = savedProfile.fighter;
  if (Object.hasOwn(byId, savedProfile.opponent)) opponent = savedProfile.opponent;
  if (Object.hasOwn(stageById, savedProfile.stage)) selectedStage = savedProfile.stage;
  if (['easy', 'normal', 'hard'].includes(savedProfile.difficulty)) difficulty = savedProfile.difficulty;
  if (validateLoadout(savedProfile.loadout)) loadout = [...savedProfile.loadout];
  if (typeof savedProfile.tint === 'string' && /^#[a-f\d]{6}$/i.test(savedProfile.tint)) tint = savedProfile.tint;
  if (Number.isInteger(savedProfile.previewForm)) previewForm = clamp(savedProfile.previewForm, 0, FORMS[selected].length - 1);
}
let trainingFighter = selected;
const replayStore = createReplayStore();
let recorder = null, replay = null, replaySaving = false, replayRequest = 0;
let lastDraw = readPreference('last-draw-v5', '');
let powerGesture = null, lastPowerTap = -Infinity;
let movementBasis = null, modePreview = null, pausePanel = 'root';
let dropPending = false, cancellationTimer = null, kiUntil = 0;
let impactUntil = 0;
const grabQueue = [], evadeQueue = [], lookKeyAt = new Map(), chordKeys = new Set();
const pointerCaptures = new Map();
const menuQuotes = Object.fromEntries(Object.entries({
  goku:'A different rhythm. This should be fun.', vegeta:'Precision first. Power follows.',
  jiren:'No wasted motion.', frieza:'A little composure would suit you.',
  beerus:'Make this worth staying awake for.', gohan:'A calm mind leaves fewer openings.',
  piccolo:'Breathe. Your next move can be better.', trunks:'One opening is all we need.',
  android18:'Less posing. More accuracy.', cell:'Every exchange is useful data.',
  buu:'Buu wants a turn!', hit:'I only need a moment.', broly:'I will find my balance.',
  android17:'Keep a little energy in reserve.', krillin:'Try a smarter angle.', tien:'Again. This time with focus.',
}).map(([id, line]) => [id, [PERSONAS[id].intro, line]]));
let quoteSpeaker = '', quoteIndex = 0, quoteAt = 0, menuAction = 'idle';
let deniedUntil = 0, denial = '', deniedAction = null, auraUntil = 0;
let series = null;
let pendingSeries = null, pendingPit = null, launchSeed = null;
const savedSeriesOpeners = safeJSON(readPreference('series-openers-v8', '{}'));
const seriesOpeners = new Map(ROSTER.map(({ id }) => [id, savedSeriesOpeners?.[id]])
  .filter(([id, rival]) => typeof rival === 'string' && Object.hasOwn(byId, rival) && rival !== id));
let inputContext = '', resourceObservation = null, lastSample = {};
let seriesBest = clamp(Math.floor(Number(readPreference('series-best-v6', '0')) || 0), 0, 1000000);
let leaderboard = null, leaderboardRequestedAt = -Infinity;
const storedLessons = safeJSON(readPreference('lessons-v1', '[]'));
let presentation = normalizePresentation(safeJSON(readPreference('presentation-v1', 'null')));
const completedLessons = new Set(Array.isArray(storedLessons) ? storedLessons.filter(id => DRILLS.some(d => d.id === id)).slice(0, DRILLS.length) : []);
let onlineStatusTimer, onlinePoll, onlineRefreshAt = -Infinity, lessonId = 'move', pendingTournament = null;
let soundOn = readPreference('sound', '1') === '1',
  voiceOn = readPreference('voice', '0') === '1';
let reduced =
  readPreference(
    'reduced',
    matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0',
  ) === '1';
let mode = 'menu',
  state = createMatch(selected, opponent),
  menuState = state,
  training = null;
let cup = null,
  activeFixture = null,
  autoRemaining = 5,
  autoPaused = false,
  cupPaused = false,
  cupRenderKey = '';
let localSlot = 0,
  spectateSlot = 0,
  resultShown = false,
  lastRoundVoice = 0;
let socket = null,
  room = null,
  connectionPromise = null,
  connectionGeneration = 0;
let tutorialComplete = readPreference('tutorial-v4', '') === 'complete';
let tutorial = null;
let matchmaking = { status: 'idle', mode:'duel', required:2, queued: 0, waited: 0 };
const cameraLook = { yaw: 0, pitch: .2, manual: false };
let mouseLooking = false, mouseLast = null;
let renderSuspended = false, renderDirty = true;
window.addEventListener('resize', () => { renderDirty = true; });
const lookKeys = new Set();
let lookPointer = null;
let previousState = null,
  receivedAt = 0,
  lastNetworkSend = 0,
  lastPing = 0,
  rtt = 0,
  networkDirty = false;
let world,
  lastFrame = performance.now(),
  accumulator = 0,
  lastEvent = 0,
  hitUntil = 0,
  comboUntil = 0,
  comboCount = 0,
  lastJump = -Infinity,
  toastTimer;
let previewTick = 0,
  hudTick = 0,
  padPointer = null,
  padX = 0,
  padY = 0;
const sources = new Map(),
  pending = new Map(),
  previousEdges = new Set(),
  portraits = new Map(),
  stageImages = new Map(),
  attackWindows = new Map();
const dmgPool = [];
let dmgCursor = 0;
const audio = createAudio();
const persona = createPersona({
  onCaption(caption) {
    const dialog = $$('dialog[open]').at(-1);
    const speaker = mode === 'menu' ? selected : state.fighters[dialog?.id === 'results-dialog' ? state.winner : localSlot]?.char;
    for (const node of $$('#persona-caption, .dialog-caption')) {
      const allowed = !!caption && caption.id === speaker && !document.hidden && !modePreview && !activeClash() &&
        (dialog ? node.closest('dialog') === dialog && ['forms-dialog', 'results-dialog'].includes(dialog.id) : mode !== 'menu' && node.id === 'persona-caption');
      node.hidden = !allowed;
      if (allowed) {
        node.dataset.speaker = caption.id;
        node.querySelector('b').textContent = caption.name.toUpperCase();
        node.querySelector('span').textContent = caption.text;
      } else {
        delete node.dataset.speaker;
        node.querySelector('b').textContent = node.querySelector('span').textContent = '';
      }
    }
  },
  onStatus(status) {
    const text = !status.enabled
      ? 'Voices off. Original dialogue is still captioned.'
      : status.available
        ? 'Local synthetic voice ready. Not the anime actor.'
        : 'No local English voice available. Captions only; no remote fallback.';
    for (const node of $$('#voice-status, #persona-status'))
      node.textContent = text;
  },
});

if (navigator.maxTouchPoints > 0 || matchMedia('(any-pointer:coarse)').matches)
  document.body.classList.add('touch-input');
window.addEventListener(
  'pointerdown',
  (event) => {
    if (event.pointerType === 'touch')
      document.body.classList.add('touch-input');
  },
  { passive: true },
);
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('#toast').hidden = true;
  }, 4000);
}
function send(message) {
  if (['create', 'join', 'queue'].includes(message.type)) message = { ...message, clientVersion: 8 };
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(message));
}
function clearDamageNumbers() {
  const container = $('#damage-numbers');
  if (!container) return;
  for (const node of dmgPool) {
    if (node.timer) clearTimeout(node.timer);
    node.timer = 0;
    node.className = 'dmg-num';
    node.textContent = '';
  }
  dmgCursor = 0;
}
function spawnDamageNumber(slot, power, kind, dealt) {
  const container = $('#damage-numbers');
  // Reduced-motion presentation hides these via CSS; the DOM nodes still exist for tests.
  if (!container || !(power > 0)) return;
  let x = 50, y = 38;
  try {
    const actor = world?.stats?.().actors?.[slot];
    const bounds = actor?.projected?.bounds;
    if (actor?.projected?.inFrame && bounds?.every(Number.isFinite)) {
      x = clamp(((bounds[0] + bounds[2]) / 2) * 100, 5, 95);
      y = clamp(bounds[1] * 100, 5, 82);
    }
  } catch { /* Projection is best-effort; fall back to center. */ }
  let node = dmgPool[dmgCursor % 12];
  if (!node) {
    node = document.createElement('div');
    node.className = 'dmg-num';
    container.append(node);
    dmgPool.push(node);
  }
  dmgCursor++;
  if (node.timer) clearTimeout(node.timer);
  node.className = 'dmg-num';
  void node.offsetWidth;
  node.textContent = `${dealt ? '-' : ''}${Math.round(power)}`;
  node.dataset.kind = kind;
  node.classList.add('show', dealt ? 'dealt' : 'taken');
  if (kind.includes('block')) node.classList.add('blocked');
  if (kind.includes('counter')) node.classList.add('counter');
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;
  node.timer = setTimeout(() => {
    node.className = 'dmg-num';
    node.timer = 0;
  }, 950);
}
function unlockAudio() {
  audio.unlock();
  audio.setMuted(!soundOn);
  persona.unlock();
  persona.setEnabled(voiceOn);
  persona.setMuted(!soundOn);
}
function updateSound() {
  audio.setMuted(!soundOn);
  persona.setMuted(!soundOn);
  $('#showcase-video').muted = !soundOn;
  $('#sound-toggle').textContent = soundOn ? 'Sound On' : 'Sound Off';
  $('#sound-toggle').setAttribute(
    'aria-label',
    soundOn ? 'Mute sound' : 'Enable sound',
  );
  $('#sound-setting').checked = soundOn;
  savePreference('sound', soundOn ? '1' : '0');
}
function clearInput() {
  lastSample = {};
  movementBasis = null;
  powerGesture = null;
  lastPowerTap = -Infinity;
  lookKeys.clear();
  lookKeyAt.clear();
  chordKeys.clear();
  evadeQueue.length = 0;
  grabQueue.length = 0;
  dropPending = true;
  lookPointer = null;
  sources.clear();
  pending.clear();
  previousEdges.clear();
  lastJump = -Infinity;
  networkDirty = true;
  padPointer = null;
  padX = padY = 0;
  $('#thumbpad').classList.remove('held');
  $$('[data-action].held').forEach((button) => button.classList.remove('held'));
  // Release captures after clearing sources so lostcapture cannot fire a shot.
  for (const [id, node] of pointerCaptures) {
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
  }
  pointerCaptures.clear();
  // A cancelled hold must never pass through the explicit release/throw queue.
  // The timer also flushes while a hidden tab has stopped requestAnimationFrame.
  if (mode === 'network') {
    clearTimeout(cancellationTimer);
    cancellationTimer = setTimeout(() => {
      if (mode !== 'network' || !dropPending) return;
      send({ type:'input', input:{ drop:true } });
      dropPending = false;
      lastNetworkSend = performance.now();
    }, Math.max(0, 20 - (performance.now() - lastNetworkSend)));
  }
}
function showDialog(id) {
  if (document.pointerLockElement) document.exitPointerLock();
  mouseLooking = false;
  clearInput();
  persona.cancel();
  $('#menu-quote').hidden = true;
  const dialog = $(`#${id}`);
  if (!dialog.open) dialog.showModal();
  updateNavigation();
}
function closeDialog(dialog) {
  if (dialog.id === 'queue-dialog') cancelQueue();
  clearInput();
  persona.cancel();
  if (dialog.id === 'showcase-dialog') stopShowcase();
  if (dialog.id === 'lesson-dialog') stopLesson();
  dialog.close();
  updateNavigation();
}
function closeDialogs() {
  clearInput();
  persona.cancel();
  if ($('#showcase-dialog').open) stopShowcase();
  if ($('#lesson-dialog').open) stopLesson();
  $$('dialog[open]').forEach((dialog) => dialog.close());
  updateNavigation();
}
function simulationPaused() {
  return (
    document.hidden ||
    $$('dialog[open]').some(
      (dialog) =>
        dialog.id !== 'results-dialog' &&
        !(dialog.id === 'cup-dialog' && resultShown),
    )
  );
}
function watching() {
  return (
    mode === 'spectate' ||
    (mode === 'tournament' && cup?.spectator) ||
    (state.kind === 'pit' && mode !== 'menu' && !state.fighters[localSlot]?.alive)
  );
}
function canInput() {
  return (
    mode !== 'menu' &&
    mode !== 'replay' &&
    !resultShown &&
    !document.hidden &&
    !$('dialog[open]') &&
    state.phase !== 'disconnected' &&
    !watching()
  );
}
function activeClash() {
  const fighter = state.fighters[localSlot];
  return state.phase === 'fight' && fighter?.alive && fighter.clashId >= 0
    ? state.clashes?.find(clash => clash.id === fighter.clashId && (clash.a === localSlot || clash.b === localSlot)) || null : null;
}
function syncInputContext() {
  const next = `${mode}:${state.round}:${state.phase}:${!!state.fighters[localSlot]?.alive}:${activeClash()?.id ?? -1}`;
  if (next !== inputContext) { inputContext = next; clearInput(); }
}
function transformEligible(fighter) {
  return powerReadiness(fighter, FORMS[fighter.char]).ready && canInput() && state.phase === 'fight' && !activeClash() &&
    ![...sources.values()].some(value => value.action === 'guard');
}
function pulse(action) {
  const mine = state.fighters[localSlot];
  if (!mine?.alive || !canInput()) return;
  const reason = actionReason(mine, action, costs[action] || 0);
  if (reason && !['targetNext','interact'].includes(action)) { denial = reason; deniedAction = action; deniedUntil = performance.now() + 2200; }
  if (action === 'transform') {
    const readiness = powerReadiness(mine, FORMS[mine.char]);
    if (!readiness.ready) {
      denial = readiness.reason;
      deniedAction = 'transform';
      deniedUntil = performance.now() + 1500;
    }
  }
  pending.set(action, Math.min(4, (pending.get(action) || 0) + 1));
  networkDirty = true;
}
function press(source, action, at = performance.now()) {
  syncInputContext();
  if (sources.has(source)) return;
  if (action === 'targetNext' && watching() && !$('dialog[open]')) {
    Object.assign(cameraLook, { yaw:0, pitch:.2, manual:false });
    movementBasis = null;
    cycleSpectator();
    return;
  }
  if (!canInput()) return;
  if (action === 'context' && activeClash()) action = 'energy';
  if (action === 'context') {
    const mine = state.fighters[localSlot];
    const prop = pickupCandidate(mine, state.props, world.aimDirection());
    action = mine.heldProp >= 0 || prop ? 'interact' : 'energy';
    if (action === 'interact' && mine.heldProp < 0 && (mine.energy < 10 || !['idle','run','flight','jump','charge'].includes(mine.action))) {
      denial = actionReason(mine, 'grab', 10) || 'Finish your move to pick up';
      deniedUntil = performance.now() + 2200;
      return;
    }
  }
  if (activeClash()) {
    if (action === 'energy' || action === 'light') action = 'clashBoost';
    if (!['clashBoost', 'guard', 'targetNext'].includes(action)) return;
  }
  const now = at;
  sources.set(source, { action, at: now });
  if (action === 'targetNext') {
    Object.assign(cameraLook, { yaw:0, pitch:.2, manual:false });
    movementBasis = null;
  }
  if (action === 'grab' && ![...sources.entries()].some(([key, value]) => key !== source && value.action === 'grab')) grabQueue.push(true);
  if (['forward', 'back', 'left', 'right'].includes(action) && !movementBasis) movementBasis = world.movementBasis();
  if (action === 'power' && !powerGesture) {
    const double = now - lastPowerTap <= 320;
    powerGesture = { at:now, double, fired:false };
    lastPowerTap = -Infinity;
    if (double) pulse('flight');
  } else if (action === 'jump') {
    if (now - lastJump <= 320) {
      pulse('flight');
      lastJump = -Infinity;
    } else {
      lastJump = now;
      pulse('jump');
    }
  } else if (['dodge', 'vanish'].includes(action)) {
    evadeQueue.push({ action, at:now, arrows:new Set(lookKeys), basis:clone(movementBasis || world.movementBasis()) });
    for (const key of lookKeys) chordKeys.add(key);
  } else if (!heldActions.has(action) && !['energy', 'power'].includes(action)) pulse(action);
  networkDirty = true;
}
function release(source, cancelled = false, at = performance.now()) {
  if (cancelled && sources.has(source)) { clearInput(); return; }
  const value = sources.get(source);
  sources.delete(source);
  if (!padX && !padY && ![...sources.values()].some(v => ['forward','back','left','right'].includes(v.action))) movementBasis = null;
  if (!value) return;
  if (value.action === 'grab') {
    if (cancelled || !canInput()) { clearInput(); return; }
    if (![...sources.values()].some(entry => entry.action === 'grab')) grabQueue.push(false);
  }
  if (!cancelled && canInput()) {
    if (value.action === 'energy' && !activeClash()) {
      const tier = at - value.at >= 1200 ? 'ultimate' : at - value.at >= 350 ? 'beam' : 'blast';
      pulse(tier);
    }
    if (value.action === 'power' && ![...sources.values()].some((entry) => entry.action === 'power')) {
      if (powerGesture && !powerGesture.double && at - powerGesture.at < 320) lastPowerTap = powerGesture.at;
    }
  }
  if (value.action === 'power' && ![...sources.values()].some((entry) => entry.action === 'power')) powerGesture = null;
  networkDirty = true;
}
function sampleInput() {
  syncInputContext();
  if (dropPending) { dropPending = false; return { drop:true }; }
  const input = {};
  if (cameraMode === 2 || cameraMode === 4) {
    const direct = pending.has('interact') || evadeQueue.some(gesture => gesture.action === 'vanish');
    const aim = world.aimDirection(direct ? null : state.fighters[localSlot]);
    if (cameraLook.manual || direct) {
      Object.assign(input, {aimX:aim.x, aimY:aim.y, aimZ:aim.z,aimAssist:presentation.aimAssist});
    }
  }
  for (const { action } of sources.values())
    if (heldActions.has(action)) input[action] = true;
  // Consume once per simulation tick / outgoing packet, including fast physical taps.
  if (grabQueue.length) { input.grab = grabQueue.shift(); networkDirty = true; }
  const evade = evadeQueue[0];
  const committing = evade && performance.now() - evade.at >= 40 ? evadeQueue.shift() : null;
  if (committing) pulse(committing.action);
  if (powerGesture && !powerGesture.double) {
    const age = performance.now() - powerGesture.at;
    if (age >= 320) input.charge = true;
    const mine = state.fighters[localSlot];
    if (age >= 600 && !powerGesture.fired && transformEligible(mine)) {
      powerGesture.fired = true;
      pulse('transform');
    }
  }
  // A guaranteed neutral sample between queued taps preserves edge-triggered attacks.
  for (const action of new Set([...pending.keys(), ...previousEdges])) {
    if (previousEdges.has(action)) {
      previousEdges.delete(action);
      if (action !== 'jump') input[action] = false;
      networkDirty = true;
      continue;
    }
    const count = pending.get(action) || 0;
    if (count) {
      input[action] = true;
      previousEdges.add(action);
      if (count === 1) pending.delete(action);
      else pending.set(action, count - 1);
      networkDirty = true;
    }
  }
   const arrows = committing?.arrows;
   const arrowX = arrows ? Number(arrows.has('ArrowRight')) - Number(arrows.has('ArrowLeft')) : 0;
   const arrowZ = arrows ? Number(arrows.has('ArrowUp')) - Number(arrows.has('ArrowDown')) : 0;
   const horizontal = arrowX || arrowZ ? arrowX : clamp(
      Number(!!input.right) - Number(!!input.left) + padX,
      -1,
      1,
    ),
    forward = arrowX || arrowZ ? arrowZ : clamp(
      Number(!!input.forward) - Number(!!input.back) - padY,
      -1,
      1,
    );
  // Automatic framing must not steer a held escape gesture back into a wall.
  if (!horizontal && !forward) movementBasis = null;
  else movementBasis ||= world.movementBasis();
   const { x: fx, z: fz } = committing?.basis || movementBasis || world.movementBasis();
  const length = Math.max(1, Math.hypot(horizontal, forward));
  input.moveX = clamp((fx * forward - fz * horizontal) / length, -1, 1);
  input.moveZ = clamp((fz * forward + fx * horizontal) / length, -1, 1);
  if (activeClash()) {
    for (const key of Object.keys(input)) if (!['clashBoost', 'guard', 'targetNext'].includes(key)) delete input[key];
  }
  lastSample = clone(input);
  return input;
}
function cycleSpectator() {
  const living = state.fighters
    .map((fighter, index) => (fighter.alive ? index : -1))
    .filter((index) => index >= 0);
  spectateSlot =
    living[(living.indexOf(spectateSlot) + 1) % living.length] ?? localSlot;
}
function updateNavigation() {
  const dialog = $$('dialog[open]').at(-1)?.id;
  const active =
    {
      'cup-dialog': 'tournament',
      'training-dialog': 'training',
      'studio-dialog': 'studio',
      'achievements-dialog': 'achievements',
      'locker-dialog': 'locker',
      'intel-dialog': 'intel',
    }[dialog] || 'play';
  $$('.main-nav [data-nav]').forEach((button) => {
    if (button.dataset.nav === active)
      button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function seriesDraw() {
  if (!pendingSeries || pendingSeries.ladder.playerId !== selected) {
    const drawSeed = seed();
    pendingSeries = { seed:drawSeed, ladder:createLadder(selected, { count:12, seed:drawSeed }) };
    // Only a fresh draw changes: both unique rivals belong to the first four-entry band.
    const rivals = pendingSeries.ladder.opponents;
    if (rivals[0] === seriesOpeners.get(selected)) [rivals[0], rivals[1]] = [rivals[1], rivals[0]];
  }
  return pendingSeries;
}
function pitDraw() {
  const key = JSON.stringify([selected, selectedStage, difficulty, loadout, tint]);
  if (pendingPit?.key !== key) pendingPit = { key, seed:seed() };
  return pendingPit;
}
function updateMenu() {
  persona.cancel();
  savePreference('profile-v1', JSON.stringify({ version:1, fighter:selected, opponent, stage:selectedStage, loadout, tint, difficulty, previewForm }));
  modePreview = null;
  $('#difficulty').value = difficulty;
  const fighter = byId[selected];
  const storyMode = selectedMode === 'story';
  const explicitRival = ['duel', 'spectate'].includes(selectedMode);
  const fixture = selectedMode === 'series' ? nextLadderMatch(seriesDraw().ladder) : null;
  const shownRival = fixture?.b || opponent;
  const shownStage = fixture?.stage || selectedStage;
  $('#profile-name').textContent = fighter.name;
  $('#profile-description').textContent = fighter.description;
  $('#selected-portrait').src = portraits.get(selected);
  $('#selected-portrait').alt = fighter.name;
  $('#preview-name').textContent = fighter.name;
  $('#preview-form').textContent = FORMS[selected][previewForm].label;
  $('#loadout-count').textContent = `${loadout.length}/5`;
  $('#stage-title').textContent = stageById[shownStage].name;
  $('#stage-region').textContent = stageById[shownStage].region;
  $('#stage-thumbnail').src = stageImages.get(shownStage);
  $('#stage-thumbnail').alt = stageById[shownStage].name;
  $('#stage-open').disabled = !!fixture;
  $('#stage-open small').textContent = fixture ? 'SERIES MAP / AUTO' : storyMode ? 'PREVIEW MAP / STORY SETS EACH ARENA' : 'MAP / 10 WORLDS ↗';
  $('#stage-open').setAttribute('aria-label', fixture ? `Series map: ${stageById[shownStage].name}, automatic` : `Choose map: ${stageById[shownStage].name}`);
  $('#opponent-select').value = opponent;
  $('#duel-options').hidden = !explicitRival;
  $('#rival-open').disabled = !explicitRival;
  $('#rival-open').setAttribute('aria-label', explicitRival ? 'Choose your rival' : fixture ? `Series next opponent: ${byId[shownRival].name}` : storyMode ? 'Story episodes choose their cast and arena' : 'Pit field: 11 AI rivals, automatic selection');
  $('#rival-open small').textContent = explicitRival ? 'RIVAL' : fixture ? 'SERIES NEXT' : storyMode ? 'STORY CAST' : 'PIT FIELD';
  $('#rival-open b').textContent = explicitRival ? 'CHANGE ↗' : fixture ? 'SEEDED / 1 OF 12' : storyMode ? 'CAST CHANGES EACH EPISODE' : 'AUTO / NOT DUEL RIVAL';
  $('#rival-portrait').hidden = selectedMode === 'pit';
  $('#rival-portrait').src = portraits.get(shownRival);
  $('#rival-portrait').alt = byId[shownRival].name;
  $('#rival-name').textContent = selectedMode === 'pit' ? '11 AI rivals' : storyMode ? '16 fighters' : byId[shownRival].name;
  $$('#rival-grid [data-rival]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rival === opponent)));
  $$('#roster [data-fighter]').forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.fighter === selected),
    ),
  );
  $$('#stage-grid [data-stage]').forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.stage === selectedStage),
    ),
  );
  menuState = createMatch(selected, shownRival, {
    stage: fixture?.stage || selectedStage,
    loadouts: [loadout],
    tints: [tint],
  });
  if (mode === 'menu') state = menuState;
}
function setMode(value) {
  if (!['story', 'pit', 'duel', 'spectate', 'series'].includes(value)) return;
  selectedMode = value;
  const copy = {
    story:['THE <em>CONVERGENCE.</em>', 'Sixteen fighters. Ten fractured worlds. One wish that could erase them all.', 'ENTER STORY SAGA'],
    pit: [
      'THE <em>PIT.</em>',
      'You + 11 AI. Last fighter standing.',
      'ENTER 12-FIGHTER PIT',
    ],
    duel: [
      'THE <em>DUEL.</em>',
      'Your rival. Best of 3.',
      'ENTER DUEL',
    ],
    spectate: [
      'WATCH <em>AI.</em>',
      'Two AI. Real combat. Just watch.',
      'WATCH LIVE DUEL',
    ],
    series: [
      'AURA <em>SERIES.</em>',
      `12 rivals / best of 3 / browser best ${seriesBest}`,
      'START AURA SERIES',
    ],
  }[value];
  $('#mode-title').innerHTML = copy[0];
  $('#mode-description').textContent = copy[1];
  $('#play').innerHTML = `${copy[2]} <span>&#8599;</span>`;
  $$('[data-mode]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.mode === value)),
  );
  updateMenu();
}
function previewMode(value) {
  if (mode !== 'menu' || room || $('dialog[open]')) return;
  const index = ['pit', 'duel', 'series', 'spectate'].indexOf(value);
  if (index < 0) return;
  persona.cancel();
  $('#menu-quote').hidden = true;
  const draw = value === 'series' ? seriesDraw() : null;
  const fixture = draw ? nextLadderMatch(draw.ladder) : null;
  const options = { stage:fixture?.stage || selectedStage, seed:draw?.seed ?? (value === 'pit' ? pitDraw().seed : 0), difficulty, loadouts:[loadout], tints:[tint] };
  const preview = value === 'pit' ? createPit(selected, options) : createMatch(selected, fixture?.b || opponent, options);
  preview.phase = 'fight'; preview.phaseTime = 0;
  modePreview = { mode:value, state:preview, seed:options.seed };
}
function restorePreview() {
  modePreview = null; previewUntil = 0;
  Object.assign(cameraLook, { yaw:0, pitch:.2, manual:false });
  setCamera(2);
  if (mode === 'menu') updateMenu();
}
function selectFighter(id) {
  if (!byId[id]) return;
  selected = id;
  previewForm = 0;
  updateMenu();
}
function chooseStage(id) {
  if (!stageById[id]) return;
  selectedStage = id;
  updateMenu();
}
function openForms() {
  $('#forms-intro').textContent =
    `${byId[selected].name} / ${PERSONAS[selected].style}. Select a release to preview its actual 3D form.`;
  $('#form-list').innerHTML = FORMS[selected]
    .map(
      (form, index) =>
        `<button class="form-option" data-form-index="${index}" data-form="${form.id}" aria-pressed="${index === previewForm}"><i style="background:${form.aura}"></i><span><b>${escapeHTML(form.label)}</b><small>${index ? `${form.minResolve} RESOLVE + ${form.kiCost} KI` : 'STARTING STATE'} / ${escapeHTML(form.kind)}</small></span></button>`,
    )
    .join('');
  showDialog('forms-dialog');
}
function openTraining() {
  if (mode !== 'training') trainingFighter = selected;
  $('#training-fighter-select').value = trainingFighter;
  $('#training-fighter').textContent =
    'Watch a short demonstration, then try the move with your fighter. Every lesson is optional.';
  updateLessonProgress();
  showDialog('training-dialog');
}
function startTutorial() {
  if (mode === 'network' && !confirm('Leave the online match and start optional training?')) return;
  tutorial = { index:0, advanceAt:0 };
  startTraining(TUTORIAL_STEPS[0], trainingFighter, true);
}
function advanceTutorial(now) {
  if (!tutorial || mode !== 'training' || !training.lesson.complete) return;
  if (!tutorial.advanceAt) tutorial.advanceAt = now + 700;
  if (now < tutorial.advanceAt) return;
  if (++tutorial.index < TUTORIAL_STEPS.length) {
    tutorial.advanceAt = 0;
    startTraining(TUTORIAL_STEPS[tutorial.index], trainingFighter, true);
    return;
  }
  tutorialComplete = true;
  savePreference('tutorial-v4', 'complete');
  returnToMenu();
  toast('Guided practice complete. Play any mode whenever you like.');
}
function applyLoadout() {
  loadout = normalizeLoadout(loadout);
  updateMenu();
  renderLocker();
  if (room && mode === 'menu') send({ type: 'loadout', loadout, tint });
}
function renderLocker() {
  $('#locker-fighter').textContent = byId[selected].name;
  $('#loadout-tint').value = tint;
  $$('#gear-slots [data-gear]').forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(loadout.includes(button.dataset.gear)),
    ),
  );
  const stats = getLoadoutStats(loadout);
  $('#gear-stats').textContent =
    `EQUIPPED ${loadout.length}/5 / Power +${Math.round((stats.power - 1) * 100)}% / Speed +${Math.round((stats.speed - 1) * 100)}% / Charge +${Math.round((stats.charge - 1) * 100)}%`;
}
function openLocker() {
  renderLocker();
  showDialog('locker-dialog');
}
function renderIntel(id) {
  if (!byId[id] || !INTEL[id]) return;
  const fighter = byId[id],
    intel = INTEL[id];
  $('#intel-fighter').value = id;
  $('#intel-content').innerHTML =
    `<div class="intel-profile"><img src="${portraits.get(id)}" alt="${escapeHTML(fighter.name)}"><div><h3>${escapeHTML(fighter.name)}</h3><p>${escapeHTML(intel.summary)}</p><p>${escapeHTML(intel.style)}</p></div></div><div class="intel-facts">${intel.achievements
      .map((fact) => {
        let source = '';
        try {
          const url = new URL(fact.source);
          if (url.protocol === 'https:')
            source = `<a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">Read source / ${escapeHTML(fact.medium)} &#8599;</a>`;
        } catch {
          /* Invalid source URLs are not interactive. */
        }
        return `<article><p>${escapeHTML(fact.text)}</p>${source}</article>`;
      })
      .join(
        '',
      )}</div><h3>Put It Into Practice</h3><p class="note">${escapeHTML(intel.trainingTip)}</p><div class="intel-practice">${[
      ['combo', 'Launch Combo'],
      ['blast', 'Ki Shot'],
      ['beam', fighter.beam],
      ['special', fighter.special],
      ['transform', 'Power Release'],
    ]
      .map(
        ([drill, label]) =>
          `<button data-intel-drill="${drill}" data-practice-fighter="${id}">${escapeHTML(label)} &#8594;</button>`,
      )
      .join(
        '',
      )}</div><p class="note">Story achievements are sourced. Combat stats and gear bonuses are original game balance.</p>`;
}
function openIntel() {
  renderIntel(selected);
  showDialog('intel-dialog');
}
function disconnect() {
  clearInput();
  clearTimeout(cancellationTimer);
  connectionGeneration++;
  const old = socket;
  socket = null;
  connectionPromise = null;
  room = null;
  if (['connecting', 'waiting', 'matched'].includes(matchmaking.status)) matchmaking.status = 'cancelled';
  previousState = null;
  if (old) {
    if (old.readyState === WebSocket.OPEN) {
      if (mode === 'network') old.send(JSON.stringify({ type:'input', input:{ drop:true } }));
      old.send(JSON.stringify({ type: 'leave' }));
    }
    old.close();
  }
}
function startMatch(nextState, nextMode, matchSeed = null) {
  impactUntil = 0;
  launchSeed = matchSeed;
  replayRequest++;
  replay = null;
  modePreview = null;
  previewUntil = 0; deniedUntil = 0; auraUntil = 0; kiUntil = 0;
  $('#menu-quote').hidden = true;
  $('#ki-cue').hidden = true;
  $('#aura-gain').hidden = true;
  Object.assign(cameraLook, { yaw: 0, pitch: .2, manual: false });
  closeDialogs();
  mode = nextMode;
  state = nextState;
  recorder = nextMode === 'replay' ? null : createReplayRecorder({
    stage:state.stage, kind:['series','story'].includes(nextMode) ? 'duel' : nextMode,
    label:state.kind === 'pit' ? `${byId[state.fighters[localSlot].char].name} / ${nextMode === 'network' ? 'Human Pool' : 'Local Pit'}` : `${byId[state.fighters[localSlot].char].name} vs ${byId[state.fighters[1 - localSlot].char].name}`,
  });
  resultShown = false;
  accumulator = 0;
  lastEvent = 0;
  comboCount = 0;
  comboUntil = 0;
  hitUntil = 0;
  lastRoundVoice = 0;
  attackWindows.clear();
  spectateSlot = localSlot;
  persona.cancel();
  clearInput();
  unlockAudio();
  $('#menu').hidden = true;
  $('#battle').hidden = false;
  document.body.classList.add('in-match');
  document.body.classList.toggle('replaying', nextMode === 'replay');
  $('#replay-controls').hidden = nextMode !== 'replay';
  document.body.classList.toggle('spectating', watching());
  document.body.dataset.training =
    nextMode === 'training' ? training.lesson.id : '';
  $('#thumbpad').classList.toggle(
    'lesson-action',
    nextMode === 'training' && training.lesson.id === 'move',
  );
  $('#battle-bracket').hidden = mode !== 'tournament';
  $('#training-coach').hidden = mode !== 'training';
  $('#pit-feed').hidden = state.kind !== 'pit';
  $('#battle-stage-name').textContent =
    stageById[state.stage].name.toUpperCase();
  const rivalSlot = state.fighters[localSlot].target ?? (localSlot === 0 ? 1 : 0);
  $('#intro-a').src = portraits.get(state.fighters[localSlot].char);
  $('#intro-b').src = portraits.get(state.fighters[rivalSlot]?.char || opponent);
  $('#intro-stage').src = stageImages.get(state.stage);
  $('#intro-stage').alt = `${stageById[state.stage].name}, actual rendered arena`;
  $('#intro-stage-name').textContent = stageById[state.stage].name;
  $('#intro-fighters').textContent = state.kind === 'pit' ? (nextMode === 'network' ? '12 HUMANS / NO AI' : 'YOU + 11 AI') : `${byId[state.fighters[localSlot].char].name} / ${byId[state.fighters[rivalSlot].char].name}`;
  const drawSeed = nextMode === 'tournament' ? cup.seed : state.seed;
  $('#intro-seed').textContent = nextMode === 'tournament' ? `DRAW ${drawSeed} / ${activeFixture.id}` : '';
  const chapter = nextMode === 'tournament' ? ['OPENING COLLISION', 'RIVAL SIGNAL', 'ARENA ASCENT'][drawSeed % 3] : 'HEAD TO HEAD';
  $('#intro-chapter').textContent = chapter;
  $('#announcement').dataset.variant = String((drawSeed || 0) % 3);
  $('#announcement').style.setProperty('--intro-accent', ['#ffc45b', '#91d5be', '#efac91'][(drawSeed || 0) % 3]);
  $('#hit-label').textContent = '';
  $('#resource-gain').dataset.until = '0';
  $('#resource-gain').hidden = true;
  resourceObservation = null;
  $('#combo-progress').hidden = true;
  $('#combat-cues').hidden = true;
  clearDamageNumbers();
  window.scrollTo(0, 0);
  hudTick = 0;
}
function launchMode() {
  if (selectedMode === 'story') { experience.openStory(); return; }
  if (selectedMode === 'series') { startSeries(); return; }
  disconnect();
  localSlot = 0;
  training = null;
  activeFixture = null;
  cup = null;
  series = null;
  const options = {
    stage: selectedStage,
    difficulty,
    seed: selectedMode === 'pit' ? pitDraw().seed : seed(),
    loadouts: [loadout],
    tints: [tint],
  };
  startMatch(
    selectedMode === 'pit'
      ? createPit(selected, options)
      : createMatch(selected, opponent, options),
    selectedMode,
    options.seed,
  );
  if (selectedMode === 'pit') pendingPit = null;
}
function startSeries() {
  disconnect(); training = null; cup = null; activeFixture = null; localSlot = 0;
  const draw = seriesDraw();
  series = { ...clone(draw.ladder), seed:draw.seed, aura:0 };
  seriesOpeners.set(selected, series.opponents[0]);
  savePreference('series-openers-v8', JSON.stringify(Object.fromEntries(seriesOpeners)));
  pendingSeries = null;
  startSeriesMatch();
}
function startSeriesMatch() {
  const next = series && nextLadderMatch(series);
  if (!next) return;
  const matchSeed = (series.seed + series.index) >>> 0;
  startMatch(createMatch(next.a, next.b, {
    stage:next.stage, difficulty, seed:matchSeed, loadouts:[loadout], tints:[tint],
    progression:[series.progression],
  }), 'series', matchSeed);
}
function startTraining(id = 'move', fighter = trainingFighter, guided = false) {
  if (mode === 'network' && !guided && !confirm('Leave the online match and practice?')) return;
  if (!guided) tutorial = null;
  disconnect();
  localSlot = 0;
  cup = null;
  series = null;
  activeFixture = null;
  trainingFighter = Object.hasOwn(byId, fighter) ? fighter : selected;
  $('#training-live-fighter').value = trainingFighter;
  $('#training-help').open = false;
  training = createTraining(fighter, id, {
    stage: selectedStage,
    loadout,
    tint,
  });
  startMatch(training.state, 'training');
  updateTraining();
}
function startTournament() {
  disconnect();
  series = null;
  training = null;
  localSlot = 0;
  autoPaused = false;
  cupPaused = false;
  cupRenderKey = '';
  if (pendingTournament?.participantId === selected && pendingTournament.spectator === $('#tournament-spectator').checked) {
    cup = pendingTournament;
  } else cup = createTournament(selected, seed(), { spectator:$('#tournament-spectator').checked });
  pendingTournament = null;
  const first = nextPlayerMatch(cup);
  lastDraw = `${selected}:${first.a === selected ? first.b : first.a}:${first.stage}`;
  savePreference('last-draw-v5', lastDraw);
  startCupMatch();
}
function startCupMatch() {
  const next = cup && nextPlayerMatch(cup);
  if (!next) return false;
  activeFixture = next;
  localSlot = 0;
  autoRemaining = 5;
  const first = cup.spectator ? next.a : cup.playerId;
  const second = next.a === first ? next.b : next.a;
  startMatch(
    createMatch(first, second, {
      stage: next.stage,
      difficulty,
      seed: seed(),
      loadouts: [loadout, randomLoadout(seed())],
      tints: [tint],
    }),
    'tournament',
  );
  return true;
}
function returnToMenu() {
  replayRequest++;
  replay = null;
  recorder = null;
  tutorial = null;
  clearInput();
  disconnect();
  mode = 'menu';
  localSlot = 0;
  closeDialogs();
  training = null;
  activeFixture = null;
  cupPaused = false;
  autoPaused = false;
  persona.cancel();
  resultShown = false;
  $('#battle').hidden = true;
  $('#menu').hidden = false;
  $('#movement-marker').hidden = true;
  document.body.classList.remove('in-match', 'spectating', 'replaying');
  $('#replay-controls').hidden = true;
  document.body.dataset.training = '';
  restorePreview();
  setMode(selectedMode);
  $('#play').focus({ preventScroll: true });
}
function renderCup(force = false) {
  if (!cup) return;
  const live = activeFixture && !resultShown;
  $('#cup-play').textContent = live
    ? 'RESUME MATCH'
    : nextPlayerMatch(cup)
      ? 'PLAY NEXT MATCH'
      : cup.champion
        ? 'CHAMPION DECIDED'
        : 'WAITING FOR CPU FIXTURES';
  $('#cup-play').disabled = !live && !nextPlayerMatch(cup);
  $('#cup-pause').textContent = cupPaused
    ? 'Resume Progression'
    : 'Pause Progression';
  $('#cup-status').textContent = cup.champion
    ? `${byId[cup.champion].name} is champion.`
    : live
      ? `${activeFixture.roundLabel}. Live match and CPU timers paused while viewing bracket.`
      : cup.eliminated
        ? 'You are out. Remaining CPU fixtures continue toward a champion.'
        : 'CPU fixtures resolve one at a time. Your next match is protected.';
  const key = JSON.stringify([cup.bracket, activeFixture?.id, cup.champion]);
  if (!force && key === cupRenderKey) return;
  cupRenderKey = key;
  const entrants = cup.bracket[0].flatMap((game) => [game.a, game.b]);
  $('#cup-bracket').innerHTML = [
    'ROUND OF 16',
    'QUARTERFINALS',
    'SEMIFINALS',
    'FINAL',
  ]
    .map(
      (label, round) =>
        `<section class="bracket-round" data-round="${round}" style="--round-span:${2 ** round}"><h3>${label}</h3><div class="round-tree">${Array.from(
          { length: 8 / 2 ** round },
          (_, index) => {
            const fixture = cup.bracket[round]?.[index];
            const isLive = !!(fixture?.id && activeFixture?.id && fixture.id === activeFixture.id && !resultShown);
            return `<article data-fixture="${fixture?.id || ''}" class="bracket-match ${fixture && [fixture.a, fixture.b].includes(cup.playerId) ? 'your-match' : ''} ${isLive ? 'live' : ''}" style="--slot:${index};--connector:${2 ** round * 52}px">${[
              'a',
              'b',
            ]
              .map((side) => {
                const id = fixture?.[side];
                return `<div class="${id && fixture.winner === id ? 'winner' : ''}">${id ? `<img src="${portraits.get(id)}" alt=""><span>${escapeHTML(byId[id].name)}</span><em>#${entrants.indexOf(id) + 1}${id === cup.playerId ? ' YOU' : ''}</em>` : '<span>Awaiting winner</span>'}</div>`;
              })
              .join(
                '',
              )}<small>${fixture?.resultLabel || (isLive ? 'LIVE / PLAYED IN ENGINE' : 'UPCOMING')}</small></article>`;
          },
        ).join('')}</div>${round === 3 ? `<div id="cup-champion"><small>CHAMPION</small>${cup.champion ? `<img src="${portraits.get(cup.champion)}" alt=""><strong>${escapeHTML(byId[cup.champion].name)}</strong>` : '<strong>The final awaits</strong>'}</div>` : ''}</section>`,
    )
    .join('');
  $('#cup-feed').innerHTML =
    tournamentFeed() || '<p>First matches are underway.</p>';
}
function tournamentFeed() {
  return (
    cup?.feed
      .slice(-6)
      .reverse()
      .map((entry) => {
        const fixture = cup.bracket.flat().find((item) => item.id === entry.id);
        return `<p><b>${escapeHTML(byId[entry.winner].name)}</b> defeated ${escapeHTML(byId[entry.loser].name)} / ${escapeHTML(entry.roundLabel)} / ${fixture?.resultLabel || 'PLAYED'}</p>`;
      })
      .join('') || ''
  );
}
function openCup() {
  if (!cup || mode !== 'tournament') {
    openTournamentEntry();
    return;
  }
  renderCup(true);
  showDialog('cup-dialog');
}
function showResult() {
  resultShown = true;
  clearInput();
  closeDialogs();
  const winner = state.fighters[state.winner],
    win = state.winner === localSlot;
  $('#result-eyebrow').textContent =
    state.kind === 'pit'
      ? mode === 'network' ? 'HUMAN POOL / COMPLETE' : 'LOCAL PIT / COMPLETE'
      : mode === 'tournament'
        ? activeFixture?.roundLabel || 'CHAMPIONSHIP'
        : 'MATCH COMPLETE';
  $('#result-title').textContent = !winner
    ? 'DRAW.'
    : mode === 'spectate' || (mode === 'tournament' && cup?.spectator)
      ? `${byId[winner.char].name.toUpperCase()} WINS`
      : win
        ? 'YOU WIN.'
        : state.kind === 'pit' && (state.fighters[localSlot].rank || 12) <= 4 ? 'FINAL FOUR.' : 'KEEP GOING.';
  $('#result-description').textContent =
    state.kind === 'pit'
      ? `Your place: ${state.fighters[localSlot].rank || (win ? 1 : '-')}/12 / ${state.fighters[localSlot].aura || 0} Aura`
      : watching()
        ? 'A completed live AI duel. No preset outcome.'
        : win
          ? 'A new limit. A stronger fighter.'
          : 'Reset your stance. The next opening is yours.';
  $('#result-score').textContent =
    state.kind === 'pit'
      ? `#${state.fighters[localSlot].rank || (win ? 1 : '-')}`
      : `${state.wins[localSlot]} : ${state.wins[1 - localSlot]}`;
  $('#rematch').disabled = false;
  $('#rematch').textContent = mode === 'pit' ? 'ENTER ANOTHER PIT' : 'REMATCH';
  $('#rematch-status').textContent =
    mode === 'network'
      ? state.kind === 'pit' ? 'All 12 players must agree.' : 'Both players must agree to a rematch.'
      : 'Same fighter. Fresh start.';
  $('#result-bracket').hidden = mode !== 'tournament';
  $('#result-auto-pause').hidden = mode !== 'tournament';
  $('#result-feed').replaceChildren();
  if (mode === 'network' && state.kind === 'pit') updatePoolRematch();
  if (mode === 'series') {
    const mine = state.fighters[localSlot];
    series.aura += mine.aura || 0;
    recordLadderMatch(series, win, { form:mine.form, mastery:mine.mastery });
    seriesBest = Math.max(seriesBest, Math.min(1000000, series.aura));
    savePreference('series-best-v6', String(seriesBest));
    $('#result-eyebrow').textContent = `AURA SERIES / ${series.wins} OF 12`;
    $('#result-description').textContent = `${series.aura} local Aura / browser best ${seriesBest}`;
    $('#rematch').textContent = nextLadderMatch(series) ? 'NEXT RIVAL' : 'NEW SERIES';
    $('#rematch-status').textContent = series.complete ? '12 rivals defeated.' : series.failed ? 'Series ended. Try a new run.' : 'Forms and mastery carry forward.';
  }
  if (win && !watching() && mode !== 'training' && mode !== 'replay') experience.win(state.kind);
  if (mode === 'story') {
    const chapter = experience.result(win);
    $('#result-eyebrow').textContent = `THE CONVERGENCE · ${chapter.act}`;
    $('#result-description').textContent = win ? 'Episode cleared. Continue to discover what the arena is hiding.' : 'The story waits for you. Try again or practice a move before returning.';
    $('#rematch').textContent = win ? 'CONTINUE STORY →' : 'RETRY EPISODE';
    $('#rematch-status').textContent = win ? 'Progress saved in this browser.' : chapter.objective;
  }
  if (mode === 'tournament') {
    // The bracket stores character IDs; the human was deliberately mapped to slot 0.
    if (winner && activeFixture) {
      recordPlayerMatch(cup, winner.char);
      activeFixture = null;
    }
    autoRemaining = 5;
    autoPaused = false;
    updateCupResult();
  }
  showDialog('results-dialog');
  if (winner) persona.speak(winner.char, 'win', true);
}
function updateCupResult() {
  if (!cup || !resultShown) return;
  const next = nextPlayerMatch(cup);
  $('#result-auto-pause').textContent = autoPaused
    ? 'Resume Advance'
    : 'Pause Advance';
  $('#result-auto-pause').disabled = !!cup.champion || cup.eliminated;
  $('#rematch').disabled = !next || cup.eliminated;
  $('#rematch').textContent = cup.champion
    ? 'CHAMPIONSHIP COMPLETE'
    : next
      ? `PLAY ${next.roundLabel.toUpperCase()}`
      : 'WAITING FOR CPU RESULTS';
  $('#rematch-status').textContent = cup.champion
    ? `${byId[cup.champion].name} is the champion.${cup.champion === cup.playerId ? ' You won the championship.' : ''}`
    : cup.eliminated
      ? 'You are eliminated. The championship continues automatically below.'
      : cupPaused
        ? 'Tournament progression paused in the bracket.'
        : autoPaused
          ? 'Automatic advance paused. Play next when ready.'
          : next
            ? `Next live match in ${Math.ceil(autoRemaining)} seconds.`
            : 'Other fixtures are still resolving. Your next match starts as soon as the round is ready.';
  const feed = tournamentFeed();
  if ($('#result-feed').innerHTML !== feed) $('#result-feed').innerHTML = feed;
}
function onDisconnected(message = 'Your rival disconnected.') {
  if (mode !== 'network' && !room) return;
  clearInput();
  persona.cancel();
  if (mode === 'network') {
    state.phase = 'disconnected';
    resultShown = true;
    closeDialogs();
    showDialog('results-dialog');
    $('#result-eyebrow').textContent = 'CONNECTION ENDED';
    $('#result-title').textContent = 'CONNECTION LOST';
    $('#result-description').textContent = message;
    $('#result-score').textContent = '';
    $('#rematch').textContent = 'REMATCH UNAVAILABLE';
    $('#rematch').disabled = true;
    $('#rematch-status').textContent =
      'Exit and create or join a new room to reconnect.';
    $('#result-bracket').hidden = true;
    $('#result-auto-pause').hidden = true;
    $('#result-feed').replaceChildren();
  } else {
    $('#lobby-status').textContent = message;
    $('#ready-button').disabled = true;
  }
}
async function connect() {
  if (!multiplayerEnabled) throw new Error('Friend rooms are unavailable in this single-player preview.');
  if (socket?.readyState === WebSocket.OPEN) return;
  if (connectionPromise) return connectionPromise;
  const generation = ++connectionGeneration;
  const current = new WebSocket(socketURL);
  leaderboardRequestedAt = -Infinity;
  socket = current;
  connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('The room server did not respond. Try again.'));
      current.close();
    }, 5000);
    current.addEventListener(
      'open',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    current.addEventListener(
      'error',
      () => {
        clearTimeout(timeout);
        reject(new Error('Cannot reach the room server. Please try again.'));
      },
      { once: true },
    );
    current.addEventListener(
      'close',
      () => {
        clearTimeout(timeout);
        reject(new Error('The room connection closed. Please try again.'));
      },
      { once: true },
    );
  }).finally(() => {
    if (generation === connectionGeneration) connectionPromise = null;
  });
  current.addEventListener('message', ({ data }) => {
    if (socket !== current || mode === 'replay') return;
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.type === 'status') {
      clearTimeout(onlineStatusTimer);
      const compatible = message.clientVersion === 8;
      $('#online-status').textContent = compatible ? 'Connected · choose your fight' : 'The server needs an update before this version can play online.';
      $('#duel-population').textContent = `${Math.max(0, Number(message.duelQueued) || 0)} players waiting for a duel`;
      $('#pit-population').textContent = `${Math.max(0, Number(message.pitQueued) || 0)} players waiting for a 12-player battle`;
      for (const button of $$('#quick-match, #pool-match, #create-room, #join-room')) button.disabled = !compatible;
    } else if (message.type === 'queue') {
      if (!['connecting', 'waiting', 'matched'].includes(matchmaking.status)) return;
      matchmaking = { status: message.status, mode:message.mode === 'pit12' ? 'pit12' : 'duel', required:message.required === 12 ? 12 : 2, queued: Math.max(0, message.queued ?? 0), waited: Math.max(0, message.waited ?? 0) };
      $('#queue-status').textContent = message.status === 'matched'
        ? 'Players found. Starting…'
        : message.status === 'cancelled' ? 'Search cancelled.' : `${Math.min(matchmaking.queued, matchmaking.required)} / ${matchmaking.required} players ready${matchmaking.queued <= 1 ? ' · waiting for opponents' : ''}`;
      $('#queue-wait').textContent = message.status === 'waiting' ? `${matchmaking.waited}s waiting` : '';
      $('#queue-help').textContent = matchmaking.waited >= 20 ? 'This queue is quiet. Keep waiting, or leave and try another fight.' : 'The match starts automatically when every place is filled. No bots.';
      renderQueueSlots();
    } else if (message.type === 'leaderboard' && message.scope === 'server-session' && Array.isArray(message.entries)) {
      leaderboard = { scope:message.scope, entries:message.entries.slice(0, 20), updatedAt:message.updatedAt };
      $('#leaderboard-status').textContent = leaderboard.entries.length ? 'Online matches only' : 'No scores yet. Finish an online fight, then return here. Scores reset when the server restarts.';
      $('#leaderboard-entries').innerHTML = leaderboard.entries.map(entry => `<li><span class="rank">${escapeHTML(entry.rank)}</span><img src="${portraits.get(entry.fighter) || portraits.get('goku')}" alt="${escapeHTML(byId[entry.fighter]?.name || 'Fighter')}" /><span><b>${escapeHTML(entry.name)}</b><small>${escapeHTML(entry.wins)} wins</small></span><strong>${escapeHTML(entry.aura)}<small>AURA</small></strong></li>`).join('');
    } else if (message.type === 'error') {
      $('#join-error').textContent = message.message;
      $('#join-submit').disabled = false;
      $('#create-room').disabled = false;
      if (!$('#join-dialog').open) toast(message.message);
      if ($('#queue-dialog').open) { $('#queue-status').textContent = message.message; $('#queue-retry').hidden = false; }
      if ($('#leaderboard-dialog').open) $('#leaderboard-status').textContent = message.message;
    } else if (message.type === 'lobby') {
      const firstLobby = !room;
      room = message;
      localSlot = message.slot;
      updateLobby();
      if (message.matchmaking) {
        $('#queue-dialog').close();
        $('#queue-status').textContent = 'Humans ready. Starting...';
      }
      if (mode === 'menu' && (firstLobby || !$('#lobby-dialog').open)) {
        closeDialogs();
        showDialog('lobby-dialog');
      }
      $('#join-submit').disabled = false;
      $('#create-room').disabled = false;
    } else if (message.type === 'state') {
      const next = message.state;
      const tickBefore = state.tick;
      const newMatch =
        mode !== 'network' ||
        (resultShown && !['matchOver', 'disconnected'].includes(next.phase));
      previousState = newMatch ? next : state;
      receivedAt = performance.now();
      if (newMatch) {
        training = null;
        cup = null;
        series = null;
        activeFixture = null;
        startMatch(next, 'network');
      } else state = next;
      if (!simulationPaused() && next.tick !== tickBefore) captureReplay(newMatch ? 1/60 : clamp((next.tick - tickBefore) / 60, 0, .2));
    } else if (message.type === 'disconnected') {
      if (mode === 'network' && state.kind === 'pit') toast('Player left. Pool continues.');
      else onDisconnected(message.message);
    }
    else if (message.type === 'pong' && Number.isFinite(message.sent))
      rtt = clamp(Math.round(performance.now() - message.sent), 0, 10000);
  });
  current.addEventListener('close', () => {
    if (socket !== current) return;
    if ($('#queue-dialog').open) {
      matchmaking.status = 'disconnected';
      $('#queue-status').textContent = 'Connection lost. Try again or return to the menu.';
      $('#queue-retry').hidden = false;
    }
    clearTimeout(onlineStatusTimer);
    $('#online-status').textContent = 'Connection lost. Check the connection to try again.';
    for (const button of $$('#quick-match, #pool-match, #create-room, #join-room')) button.disabled = true;
    if ($('#leaderboard-dialog').open) $('#leaderboard-status').textContent = 'Connection lost. These scores may be out of date. Refresh to reconnect.';
    onDisconnected('Connection lost. Exit and reconnect to a new room.');
    socket = null;
    $('#join-submit').disabled = false;
    $('#create-room').disabled = false;
  });
  return connectionPromise;
}
function updateLobby() {
  if (!room) return;
  const mine = room.players[localSlot];
  $('#lobby-aura strong').textContent = Math.max(0, Math.floor(Number(mine?.aura) || 0));
  $('#lobby-aura').hidden = room.mode === 'pit12';
  const pool = room.mode === 'pit12';
  $('#lobby-dialog').classList.toggle('pool-lobby', pool);
  $('#pool-players').hidden = !pool;
  $('.lobby-players').hidden = pool;
  for (const node of $$('#ready-button, #copy-code, #copy-invite, #lobby-dialog .room-code-row, #lobby-dialog .form-row, #lobby-locker, #lobby-dialog .note')) node.hidden = pool;
  if (pool) {
    $('#lobby-title').textContent = 'Twelve Humans. One Pit.';
    $('#lobby-dialog .eyebrow').textContent = 'PUBLIC POOL / NO AI';
    $('#pool-players').innerHTML = room.players.map((player, slot) => `<div class="pool-player ${player.connected ? '' : 'departed'}"><img src="${portraits.get(player.fighter)}" alt="" /><b>${escapeHTML(byId[player.fighter]?.name || 'Fighter')}</b><small>${slot === localSlot ? 'YOU' : `P${slot + 1}`} / ${player.connected ? 'READY' : 'LEFT'}</small></div>`).join('');
    $('#lobby-status').textContent = 'All 12 auto-ready. Starts automatically.';
    if (resultShown) updatePoolRematch();
    return;
  }
  $('#lobby-title').textContent = room.matchmaking ? 'Player Matched' : 'Your Arena. Your Rival.';
  $('#lobby-dialog .eyebrow').textContent = room.matchmaking ? 'PUBLIC MATCH / HUMAN OPPONENT' : 'FRIENDS / PRIVATE 1V1';
  $('#room-code').textContent = room.code;
  room.players.forEach((player, slot) => {
    const prefix = slot ? '#lobby-b' : '#lobby-a';
    $(`${prefix}-label`).textContent = slot === localSlot ? 'YOU' : 'RIVAL';
    $(`${prefix}-img`).src = portraits.get(player.fighter);
    $(`${prefix}-img`).style.opacity = player.connected ? '1' : '.2';
    $(`${prefix}-name`).textContent = player.connected
      ? byId[player.fighter].name
      : 'Waiting';
    $(`${prefix}-state`).textContent = !player.connected
      ? 'Not connected'
      : player.ready
        ? 'READY'
        : 'Choosing loadout';
    $(`${prefix}-gear`).textContent =
      `${player.loadout?.length || 0}/5 gear slots`;
  });
  selected = mine.fighter;
  loadout = normalizeLoadout(mine.loadout);
  tint = mine.tint || tint;
  previewForm = Math.min(previewForm, FORMS[selected].length - 1);
  selectedStage = room.stage;
  updateMenu();
  $('#lobby-fighter').value = mine.fighter;
  $('#lobby-fighter').disabled = mine.ready;
  $('#lobby-stage').value = room.stage;
  $('#lobby-stage').disabled =
    localSlot !== 0 ||
    room.players.some((player) => player.ready) ||
    mode === 'network';
  $('#lobby-locker').disabled = mine.ready;
  $('#ready-button').disabled = mine.ready;
  $('#ready-button').textContent = mine.ready
    ? 'READY / WAITING FOR RIVAL'
    : 'READY';
  $('#lobby-status').textContent = !room.players[1 - localSlot].connected
    ? 'Waiting for your rival. Share a code or invite link.'
    : mine.ready
      ? 'Waiting for your rival to ready up.'
      : 'Rival connected. Choose your fighter and ready up.';
  if (room.matchmaking) {
    $('#lobby-status').textContent = 'Both players auto-ready. Your duel starts automatically.';
    $('#ready-button').textContent = 'MATCHED / STARTING';
  }
  if (resultShown && mode === 'network' && state.phase === 'matchOver') {
    $('#rematch').disabled = mine.ready;
    $('#rematch-status').textContent = mine.ready
      ? 'Rematch requested. Waiting for your rival.'
      : room.players[1 - localSlot].ready
        ? 'Your rival wants a rematch.'
        : 'Both players must agree to a rematch.';
  }
}
function updatePoolRematch() {
  const connected = room?.players.length === 12 && room.players.every(player => player.connected);
  $('#rematch').disabled = connected && !!room.players[localSlot]?.ready;
  $('#rematch').textContent = connected ? 'REMATCH' : 'REQUEUE 12 HUMANS';
  $('#rematch-status').textContent = connected
    ? `${room.players.filter(player => player.ready).length} / 12 rematch votes`
    : 'A player left. Join a fresh human pool.';
}
function renderQueueSlots() {
  $('#queue-slots').innerHTML = Array.from({length:matchmaking.required}, (_, index) => `<span class="queue-slot ${index < matchmaking.queued ? 'filled' : ''}" aria-label="Slot ${index + 1}: ${index < matchmaking.queued ? 'human queued, fighter unknown' : 'waiting'}">${icon('person')}<small>${String(index + 1).padStart(2, '0')}</small></span>`).join('');
}
async function requestLeaderboard() {
  if (!multiplayerEnabled) return;
  $('#leaderboard-status').textContent = 'Connecting to the Aura board…';
  try {
    await connect();
    if (performance.now() - leaderboardRequestedAt < 5000) {
      $('#leaderboard-status').textContent = leaderboard ? (leaderboard.entries.length ? 'Online matches only' : 'No scores yet. Finish an online fight, then return here. Scores reset when the server restarts.') : 'Loading server session…';
      return;
    }
    leaderboardRequestedAt = performance.now();
    $('#leaderboard-status').textContent = 'Loading server session...';
    $('#leaderboard-refresh').disabled = true;
    send({ type:'leaderboard' });
    setTimeout(() => { $('#leaderboard-refresh').disabled = false; }, 5100);
  } catch (error) { $('#leaderboard-status').textContent = error.message; }
}
async function createRoom() {
  if (!multiplayerEnabled) return;
  $('#create-room').disabled = true;
  unlockAudio();
  try {
    const connecting = connect(), generation = connectionGeneration;
    await connecting;
    if (generation !== connectionGeneration) return;
    send({
      type: 'create',
      fighter: selected,
      stage: selectedStage,
      loadout,
      tint,
    });
  } catch (error) {
    toast(error.message);
    $('#create-room').disabled = false;
  }
}
async function joinRoom(code) {
  if (!multiplayerEnabled) return;
  $('#join-error').textContent = '';
  $('#join-submit').disabled = true;
  unlockAudio();
  try {
    const connecting = connect(), generation = connectionGeneration;
    await connecting;
    if (generation !== connectionGeneration) return;
    send({ type: 'join', code, fighter: selected, loadout, tint });
  } catch (error) {
    $('#join-error').textContent = error.message;
    $('#join-submit').disabled = false;
    if (!$('#join-dialog').open) toast(error.message);
  }
}
async function startQueue(queueMode = 'duel') {
  if (!multiplayerEnabled) return;
  if (mode !== 'menu') returnToMenu();
  closeDialogs();
  disconnect();
  matchmaking = { status: 'connecting', mode:queueMode, required:queueMode === 'pit12' ? 12 : 2, queued: 0, waited: 0 };
  $('#queue-title').textContent = queueMode === 'pit12' ? '12-Player Battle' : 'Find a Rival';
  $('#queue-retry').hidden = true;
  $('#queue-duel').hidden = queueMode !== 'pit12';
  $('#queue-help').textContent = 'Only connected players count. No bots.';
  $('#queue-status').textContent = 'Connecting to the match server...';
  $('#queue-wait').textContent = '';
  renderQueueSlots();
  showDialog('queue-dialog');
  const connecting = connect(), generation = connectionGeneration;
  try {
    await connecting;
    if (generation !== connectionGeneration || matchmaking.status !== 'connecting' || !$('#queue-dialog').open) return;
    send({ type: 'queue', mode:queueMode, fighter: selected, loadout, tint });
  } catch (error) {
    if (generation !== connectionGeneration) return;
    matchmaking.status = 'error';
    $('#queue-retry').hidden = false;
    $('#queue-status').textContent = error.message;
  }
}
function cancelQueue() {
  // Cancel then leave/close: even a server pairing already in flight cannot launch.
  send({ type: 'cancelQueue' });
  matchmaking.status = 'cancelled';
  disconnect();
}
function openSettings() {
  if (resultShown) return;
  $('#resume b').textContent = mode === 'menu' ? 'Back' : 'Resume';
  $('#save-replay').disabled = !recorder;
  $('#pause-label').textContent =
    mode === 'network'
      ? 'ONLINE / MATCH CONTINUES'
      : mode === 'menu' ? 'SETTINGS' : 'MATCH PAUSED';
  showDialog('settings-dialog');
  showPausePanel('root');
  $('#resume').focus();
}
function showPausePanel(panel) {
  if (!['root', 'audio', 'visuals', 'training', 'replays'].includes(panel)) return;
  const previous = pausePanel;
  pausePanel = panel;
  $('#pause-root').hidden = panel !== 'root';
  $('#pause-back').hidden = panel === 'root';
  $('#settings-title').textContent = ({ root:'Take A Breath', audio:'Audio', visuals:'Visuals', training:'Practice', replays:'Replays' })[panel];
  $$('[data-pause-view]').forEach(node => { node.hidden = node.dataset.pauseView !== panel; });
  if (panel !== 'root') $('#pause-back').focus();
  else ($(`[data-pause-panel="${previous}"]`) || $('#resume')).focus();
}
function syncTrainingState() {
  if (state === training.state) return;
  persona.cancel();
  kiUntil = 0;
  state = training.state;
  lastEvent = 0;
  lastRoundVoice = 0;
  attackWindows.clear();
  clearInput();
}
function captureReplay(dt) {
  if (!recorder || mode === 'replay') return;
  try { recorder.capture(state, dt); }
  catch (error) {
    recorder = null;
    toast(`Replay recording stopped (${error.code || 'ERROR'}): ${error.message}`);
  }
}
async function saveReplay(button) {
  if (replaySaving || !recorder || mode === 'replay') return;
  replaySaving = true;
  for (const node of $$('[data-save-replay]')) node.disabled = true;
  const label = button.textContent;
  button.textContent = 'Saving locally...';
  try {
    const clip = recorder.finish();
    if (!clip) throw new Error('No footage yet. Play a few seconds first.');
    const metadata = await replayStore.save(clip);
    toast(`Saved ${metadata.duration.toFixed(1)}s visual replay. ${replayStore.status().message}`);
  } catch (error) {
    toast(`Replay not saved${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  } finally {
    replaySaving = false;
    button.textContent = label;
    for (const node of $$('[data-save-replay]')) node.disabled = false;
  }
}
async function refreshReplays() {
  const request = ++replayRequest;
  $('#replay-list').replaceChildren();
  $('#replay-library-status').textContent = 'Loading local replay history...';
  $('#replay-clear').disabled = true;
  $('#replay-retry').hidden = true;
  try {
    const clips = await replayStore.list();
    if (request !== replayRequest) return;
    $('#replay-storage').textContent = replayStore.status().message;
    $('#replay-library-status').textContent = clips.length
      ? `${clips.length} visual replays / newest first / this browser only`
      : 'No saved replays. Pause a match and choose Save Last 60 Seconds.';
    $('#replay-clear').disabled = clips.length === 0;
    $('#replay-list').innerHTML = clips.map(clip => `<article class="replay-card">
      <img src="${stageImages.get(clip.stage)}" alt="${escapeHTML(stageById[clip.stage].name)}">
      <div><b>${escapeHTML(clip.label)}</b><small>${escapeHTML(new Date(clip.createdAt).toLocaleString())} / ${clip.duration.toFixed(1)}s / ${escapeHTML(clip.kind)} / ${escapeHTML(clip.storage)}</small></div>
      <button data-replay-watch="${escapeHTML(clip.id)}">Watch</button><button data-replay-delete="${escapeHTML(clip.id)}">Delete</button></article>`).join('');
  } catch (error) {
    if (request !== replayRequest) return;
    $('#replay-library-status').textContent = `Cannot load history (${error.code || 'ERROR'}): ${error.message}`;
    $('#replay-storage').textContent = replayStore.status().message;
    $('#replay-retry').hidden = false;
  }
}
function openReplays() {
  showDialog('replays-dialog');
  void refreshReplays();
}
async function watchReplay(id) {
  if (socket && !confirm('Leave the online room or queue to watch this local visual replay?')) return;
  if (socket) returnToMenu();
  showDialog('replays-dialog');
  const request = ++replayRequest;
  $('#replay-library-status').textContent = 'Loading visual replay...';
  try {
    const clip = await replayStore.load(id);
    if (request !== replayRequest || !$('#replays-dialog').open) return;
    if (!clip) throw new Error('Replay no longer exists. Refresh the library.');
    disconnect();
    training = null;
    tutorial = null;
    cup = activeFixture = null;
    localSlot = 0;
    startMatch(clone(clip.frames[0].state), 'replay');
    replay = { clip, playing:true, time:0, speed:1, index:0 };
    $('#replay-speed').value = '1';
    $('#replay-seek').max = String(clip.duration);
    $('#replay-title').textContent = `${clip.label} / VISUAL REPLAY`;
    updateReplay(0);
  } catch (error) {
    if (request !== replayRequest) return;
    $('#replay-library-status').textContent = `Cannot play (${error.code || 'ERROR'}): ${error.message}`;
    $('#replay-retry').hidden = false;
  }
}
function updateReplay(dt) {
  if (!replay) return;
  if (replay.playing) replay.time = Math.min(replay.clip.duration, replay.time + dt * replay.speed);
  if (replay.time >= replay.clip.duration) replay.playing = false;
  const frames = replay.clip.frames;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= replay.time) lo = mid;
    else hi = mid - 1;
  }
  if (replay.index !== lo) {
    replay.index = lo;
    state = clone(frames[lo].state);
  }
  $('#replay-toggle').textContent = replay.playing ? 'Pause' : 'Play';
  $('#replay-toggle').setAttribute('aria-pressed', String(replay.playing));
  $('#replay-seek').value = String(replay.time);
  $('#replay-time').textContent = `${replay.time.toFixed(1)} / ${replay.clip.duration.toFixed(1)}s`;
}
function setCamera(value) {
  if (![1, 2, 3, 4].includes(value)) return;
  cameraMode = value;
  movementBasis = null;
  networkDirty = true;
  $$('#camera-controls [data-camera]').forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(Number(button.dataset.camera) === value),
    ),
  );
}
function turnCamera(yaw, pitch) {
  if (mode === 'menu' || $('dialog[open]')) return;
  yaw *= presentation.sensitivity;
  pitch *= presentation.sensitivity * (presentation.invertY ? -1 : 1);
  const before = cameraLook.pitch;
  cameraLook.yaw = Math.atan2(Math.sin(cameraLook.yaw + yaw), Math.cos(cameraLook.yaw + yaw));
  cameraLook.pitch = clamp(cameraLook.pitch + pitch, -.75, .85);
  cameraLook.manual = true;
  movementBasis = null;
  if (mode === 'training') recordTrainingLook(training, Math.hypot(yaw, cameraLook.pitch - before));
}
function stopShowcase() {
  const video = $('#showcase-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
}
function updateMenuQuote(now) {
  const visible = mode === 'menu' && !modePreview && !room && !simulationPaused();
  $('#menu-quote').hidden = !visible;
  $('.preview-tag').hidden = !visible;
  if (!visible) return 'idle';
  if (quoteSpeaker !== selected) { quoteSpeaker = selected; quoteIndex = 0; quoteAt = now; }
  if (!reduced && now - quoteAt >= 5000) { quoteIndex = (quoteIndex + 1) % menuQuotes[selected].length; quoteAt = now; }
  const quote = $('#menu-quote');
  quote.dataset.speaker = selected;
  quote.querySelector('b').textContent = byId[selected].name.toUpperCase();
  quote.querySelector('span').textContent = menuQuotes[selected][reduced ? 0 : quoteIndex];
  return !reduced && now - quoteAt < 1500 ? quoteIndex % 2 ? 'power-pose' : 'wave' : 'idle';
}
function updateTraining() {
  if (!training || mode !== 'training') return;
  const lesson = training.lesson,
    drill = DRILLS.find((item) => item.id === lesson.id),
    index = DRILLS.indexOf(drill);
  if (lesson.complete && !completedLessons.has(lesson.id)) { completedLessons.add(lesson.id); savePreference('lessons-v1', JSON.stringify([...completedLessons])); updateLessonProgress(); }
  $('#training-step').textContent =
    tutorial ? `GUIDED / ${tutorial.index + 1} OF ${TUTORIAL_STEPS.length}` : `DRILL ${index + 1} / ${DRILLS.length}`;
  $('#training-title').textContent = drill.title;
  $('#training-prompt').textContent = drill.prompt;
  $('#training-hint').textContent = drill.hint;
  let keys = lesson.id === 'combo' ? ['J', 'J', 'K'] : [drill.key];
  let nextKey = lesson.id === 'combo' ? Math.min(2, state.fighters[0].combo) : 0;
  if (lesson.id === 'transform' && !lesson.complete) {
    const mine = state.fighters[0], next = FORMS[mine.char][mine.form + 1];
    const remaining = next ? Math.max(0, next.minResolve - mine.resolve) : 0;
    const baseHits = Math.ceil(remaining / (80 * byId[mine.char].power * getLoadoutStats(mine.loadout).power * getLoadoutStats(mine.loadout).resolve * .045));
    $('#training-hint').textContent = next
      ? `${Math.floor(mine.resolve)}/${next.minResolve} resolve. Land about ${baseHits} more L blasts (80 base damage; 0.045 resolve/damage). T refills ki only. With ${next.kiCost} ki, press R to transform.`
      : drill.hint;
    keys = [remaining > 0 ? 'L' : next && mine.energy < next.kiCost ? 'T' : 'R'];
    $('#training-prompt').textContent = remaining > 0 ? `Land hits / about ${baseHits} blasts` : keys[0] === 'T' ? 'Hold T to refill ki' : 'Press R to transform';
  }
  const keyHTML = keys.map((key, index) => `<kbd class="${lesson.complete || index < nextKey ? 'done' : index === nextKey ? 'pending' : ''}">${escapeHTML(key)}</kbd>`).join('');
  if ($('#training-keys').innerHTML !== keyHTML) $('#training-keys').innerHTML = keyHTML;
  $('#training-keys').setAttribute('aria-label', lesson.complete ? 'Complete' : `Next: ${keys[nextKey]}`);
  const gesture = `${lesson.id}:${keys.join()}`;
  if ($('#training-illustration').dataset.drill !== gesture) {
    $('#training-illustration').dataset.drill = gesture;
    $('#training-illustration').innerHTML = lesson.id === 'transform' && keys[0] === 'L' ? icon('energy') : drillIcon(drill);
  }
  $('#training-damage').textContent = training.respawnIn > 0
    ? `DUMMY KO / respawn in ${training.respawnIn.toFixed(1)}s. Reset now below.`
    : `${Math.round(lesson.damage)} actual damage / your health is protected`;
  $('#training-progress').textContent =
    `${Math.round(clamp(lesson.progress / lesson.goal) * 100)}%`;
  $('#training-coach .lesson-meter i').style.width =
    `${clamp(lesson.progress / lesson.goal) * 100}%`;
  $('#training-success').hidden = !lesson.complete;
  $('#training-success').textContent = lesson.successText;
  $('#training-coach').classList.toggle('complete', lesson.complete);
  $('#training-next').disabled = !lesson.complete;
  $('#training-next').hidden = !!tutorial || index === DRILLS.length - 1;
  $('#training-repeat').hidden = false;
  $('#training-choose').hidden = !!tutorial;
  $('#training-next').textContent =
    index === DRILLS.length - 1 ? 'Choose Drill' : 'Next Drill';
  $('#thumbpad').classList.toggle(
    'lesson-action',
    lesson.id === 'move' && !lesson.complete,
  );
  $('#movement-marker').hidden = lesson.id !== 'move' || lesson.complete;
}
function consumeEvents(now) {
  const mine = state.fighters[localSlot];
  const previousResolve = resourceObservation?.state === state && resourceObservation.round === state.round ? resourceObservation.resolve : mine.resolve;
  let hitFeedback = null;
  for (const event of state.events) {
    if (event.id <= lastEvent) continue;
    lastEvent = event.id;
    if (mode !== 'replay' && !watching()) experience.observe(event,localSlot);
    audio.event(event);
    if (event.type === 'ki' && event.owner === localSlot && ['guard', 'evade'].includes(event.kind) && event.power > 0) {
      $('#ki-cue').textContent = `${event.kind === 'guard' ? 'FRONT GUARD' : 'PERFECT EVADE'} +${Number(event.power.toFixed(1))} KI / DEFENSE RETURN`;
      $('#ki-cue').dataset.kind = event.kind;
      kiUntil = now + 1300;
    }
    if (event.type === 'aura' && event.owner === localSlot && mode !== 'training') {
      const names = { combo:'Launcher', 'skill-chain':'Skill chain', 'round-win':'Round won', 'match-win':'Match won', 'pit-win':'Pit won' };
      $('#aura-gain').innerHTML = `${icon(event.kind === 'skill-chain' ? 'chain' : 'special')}<b>+${event.power}</b><small>${escapeHTML(names[event.kind] || 'Aura')}</small>`;
      $('#aura-gain').dataset.kind = event.kind;
      auraUntil = now + 1700;
      if (mode === 'series') {
        seriesBest = Math.max(seriesBest, Math.min(1000000, series.aura + (event.total || 0)));
        savePreference('series-best-v6', String(seriesBest));
      }
    }
    if (event.type === 'attack' && event.windup)
      attackWindows.set(event.owner, {
        action: event.kind,
        duration: event.duration,
        windup: event.windup,
      });
    let text = '';
    if (event.type === 'attack' && event.owner === localSlot) {
      if (event.kind === 'light') {
        comboCount = state.fighters[localSlot].combo;
        comboUntil = now + 950;
      } else if (event.kind === 'heavy' && event.launcher) {
        comboCount = 3;
        comboUntil = now + 1300;
      }
      if (['special', 'beam', 'ultimate'].includes(event.kind))
        text =
          byId[state.fighters[event.owner].char][
            event.kind === 'special' ? 'special' : event.kind
          ];
    }
    if (event.type === 'combo' && event.owner === localSlot) {
      comboCount = event.power;
      comboUntil = now + 1400;
      text =
        event.kind === 'launcher'
          ? 'LAUNCHER CONFIRMED'
          : `${event.power} HIT COMBO`;
    }
    if (
      event.type === 'dodge' &&
      event.owner === localSlot &&
      event.kind === 'perfect'
    )
      text = 'PERFECT EVADE / COUNTER NOW';
    if (event.type === 'hit' && event.owner === localSlot && !reduced && !watching() && ['light','heavy','special'].includes(event.kind))
      impactUntil = Math.max(impactUntil, now + (event.kind === 'heavy' ? 60 : 35));
    if (event.type === 'hit' && event.owner === localSlot)
      text = event.counter
        ? 'COUNTER HIT'
         : `${Math.round(event.power)} DAMAGE`;
    if (['hit', 'block'].includes(event.type) && event.power > 0 && (event.owner === localSlot || event.target === localSlot)) hitFeedback = event;
    if (event.type === 'block' && event.target === localSlot) text = 'GUARDED';
    if (event.type === 'transform' && event.owner === localSlot) {
      text = getForm(state.fighters[event.owner]).label;
      if (!simulationPaused()) persona.speak(state.fighters[event.owner].char, 'transform');
    }
    if (event.type === 'revert' && event.owner === localSlot)
      text = 'KI EMPTY / POWER LOWERED';
    if (event.type === 'hit' && event.target === localSlot && !simulationPaused())
      persona.speak(state.fighters[event.target].char, 'hurt');
    if (text) {
      $('#hit-label').textContent = text.toUpperCase();
      hitUntil = now + (event.type === 'transform' ? 1600 : 900);
    }
  }
  if (hitFeedback) {
    const gain = Math.min(100, Math.max(0, mine.resolve - previousResolve));
    const dealt = hitFeedback.owner === localSlot;
    $('#resource-gain').textContent = `${dealt ? 'HIT' : 'UNDER PRESSURE'} / ${gain > .05 ? `+${gain.toFixed(1)} RESOLVE` : `${Math.floor(mine.resolve)} RESOLVE`} / ${dealt ? ['light','heavy'].includes(hitFeedback.kind) ? 'MELEE RETURNS KI' : 'SHOT SPENDS KI' : 'COMBAT EARNED'}`;
    $('#resource-gain').dataset.until = String(now + 1400);
    spawnDamageNumber(hitFeedback.target, hitFeedback.power, `${hitFeedback.type}${hitFeedback.counter ? '-counter' : ''}`, dealt);
  }
  resourceObservation = { state, round:state.round, resolve:mine.resolve };
}
function updateClashHUD() {
  const clash = activeClash();
  const visible = !!clash && !watching() && mode !== 'replay';
  $('#clash-hud').hidden = !visible;
  if (visible) $('#persona-caption').hidden = true;
  document.body.classList.toggle('clashing', visible);
  if (!visible) return;
  const a = state.fighters[clash.a], b = state.fighters[clash.b];
  if (!a || !b) { $('#clash-hud').hidden = true; return; }
  const progress = clamp(clash.progress, -1, 1);
  $('#clash-a').textContent = `${byId[a.char].name}${clash.a === localSlot ? ' / YOU' : ''}`;
  $('#clash-b').textContent = `${byId[b.char].name}${clash.b === localSlot ? ' / YOU' : ''}`;
  $('#clash-ki-a').textContent = `${Math.floor(a.energy)} KI`;
  $('#clash-ki-b').textContent = `${Math.floor(b.energy)} KI`;
  $('#clash-time').textContent = `${Math.max(0, clash.remaining).toFixed(1)}s`;
  $('#clash-pressure i').style.width = `${(progress + 1) * 50}%`;
  $('#clash-pressure').setAttribute('aria-valuenow', progress.toFixed(2));
  $('#clash-pressure').setAttribute('aria-valuetext', Math.abs(progress) < .05 ? 'Even pressure' : `${byId[progress > 0 ? a.char : b.char].name} leads`);
  const cueText = clash.cue ? 'TAP NOW' : 'WATCH THE CUE';
  if ($('#clash-cue').textContent !== cueText) $('#clash-cue').textContent = cueText;
  $('#clash-hud').dataset.cue = String(!!clash.cue);
  $('#clash-hud').dataset.clashId = String(clash.id);
}
function updateHUD(now) {
  const mine = state.fighters[localSlot];
  if (!mine) return;
  const observed = watching() ? state.fighters[spectateSlot] : mine;
  const targetIndex =
    watching() && state.kind === 'pit'
      ? spectateSlot
      : state.fighters[observed.target]?.alive
        ? observed.target
        : state.fighters.findIndex((f, i) => i !== localSlot && f.alive);
  const target = state.fighters[targetIndex] || mine;
  for (const [selector, fighter, slot] of [
    ['#hud-a', mine, localSlot],
    ['#hud-b', target, targetIndex],
  ]) {
    const node = $(selector),
      portrait = node.querySelector('img');
    if (portrait.dataset.fighter !== fighter.char) {
      portrait.src = portraits.get(fighter.char);
      portrait.dataset.fighter = fighter.char;
    }
    node.querySelector('.hud-name').textContent =
      byId[fighter.char].name.toUpperCase();
    node.querySelector('.hud-hp').textContent = Math.ceil(fighter.hp);
    node.querySelector('.health-track i').style.transform =
      `scaleX(${clamp(fighter.hp / (fighter.maxHp || MAX_HP))})`;
    node.querySelector('.health-track').setAttribute('aria-valuemax', fighter.maxHp || MAX_HP);
    node
      .querySelector('.health-track')
      .setAttribute('aria-valuenow', Math.ceil(fighter.hp));
    node.querySelector('.energy-track i').style.transform =
      `scaleX(${clamp(fighter.energy / MAX_ENERGY)})`;
    node
      .querySelector('.energy-track')
      .setAttribute('aria-valuenow', Math.floor(fighter.energy));
    node.querySelector('.energy-value').textContent =
      `${Math.floor(fighter.energy)} KI`;
    node.querySelector('.hud-form').textContent =
      `${getForm(fighter).label.toUpperCase()}${state.kind === 'duel' && mode !== 'training' ? ` / ${state.wins[slot] || 0} ROUNDS` : ''}`;
    node.querySelector('.player-tag').textContent =
      selector === '#hud-a'
        ? watching() && state.kind !== 'pit'
          ? 'LIVE AI'
          : mine.alive
            ? 'YOU'
            : 'ELIMINATED'
        : mode === 'training'
          ? 'TRAINING DUMMY'
          : 'LOCKED TARGET';
  }
  updateClashHUD();
  const next = FORMS[mine.char][mine.form + 1];
  const readiness = powerReadiness(mine, FORMS[mine.char]);
  const canTransform = transformEligible(mine);
  const clashing = !!activeClash();
  $('#current-form').textContent = `${getForm(mine).label.toUpperCase()}${mine.form ? ` · ${getForm(mine).drain} KI/S` : ''}`;
  $('#center-ki').textContent = `${Math.floor(mine.energy)} / 100 KI`;
  $('#center-ki').setAttribute('aria-label', `Ki: ${Math.floor(mine.energy)} of ${MAX_ENERGY}`);
  $('#power-rating').textContent = mine.flight ? `${mine.y.toFixed(1)}m ALT` : `PL ${mine.powerLevel.toLocaleString()}`;
  $('#next-form-name').textContent = next ? `NEXT · ${next.label}` : 'FULL POTENTIAL';
  $('#transform-requirement').textContent = readiness.reason;
  $('#resolve-label').textContent = next ? `Resolve ${Math.floor(mine.resolve)} / ${next.minResolve}` : `Resolve ${Math.floor(mine.resolve)}`;
  $('#ki-label').textContent = next ? `Ki ${Math.floor(mine.energy)} / ${next.kiCost}` : `Ki ${Math.floor(mine.energy)} / 100`;
  $('.transform-ki-track i').style.transform = `scaleX(${readiness.kiProgress})`;
  $('#charge-status').textContent = readiness.charge;
  $('#resolve-label').classList.toggle('met', !readiness.resolveMissing);
  $('#ki-label').classList.toggle('met', !readiness.kiMissing);
  $('.power-readout .resolve-track i').style.transform =
    `scaleX(${next ? clamp(mine.resolve / next.minResolve) : 1})`;
  const held = new Set([...sources.values()].map((value) => value.action));
  const powerAge = powerGesture ? now - powerGesture.at : 0;
  const powerPhase = !powerGesture ? 'idle' : powerGesture.double ? 'flight'
    : powerGesture.fired ? 'attempted' : powerAge < 320 ? 'tap' : powerAge < 600 ? 'hold'
      : next && mine.resolve < next.minResolve ? 'resolve' : 'ki';
  const powerVisible = state.phase === 'fight' && mine.alive && !watching() && mode !== 'replay' && !clashing;
  const deniedCost = !powerGesture && now < deniedUntil ? costs[deniedAction] : 0;
  $('.power-key').textContent = 'T';
  $('#transform-ready').hidden = !next;
  $('#transform-ready').innerHTML = `<kbd>R</kbd> ${canTransform ? 'TRANSFORM NOW' : 'TRANSFORM'}`;
  $('#transform-ready').classList.toggle('unavailable', !canTransform);
  $('#transform-ready').setAttribute('aria-label', `Transform: ${readiness.reason}`);
  $('.power-readout').hidden = !powerVisible;
  $('.power-readout').classList.toggle('charging', mine.action === 'charge');
  $('.power-readout').style.setProperty('--charge', `${Math.round(clamp(powerAge / 600) * 360)}deg`);
  $('#power-meter').hidden = !powerGesture && !held.has('charge') && now >= deniedUntil;
  $('#power-meter').dataset.phase = powerPhase;
  $('#power-meter i').style.width = `${clamp(powerAge / 600) * 100}%`;
  $('#power-phase').textContent = now < deniedUntil && !powerGesture ? `${denial}${deniedCost ? ` / ${deniedCost} KI` : ''}` : held.has('charge') ? readiness.charge : {
    idle:'T REFILLS KI', flight:'FLY', attempted:'RELEASE', tap:'2x FLY',
    hold:'HOLD 0.6s', resolve:'LAND HITS', ki:canTransform ? 'READY' : next ? 'NEED KI' : 'CHARGE',
  }[powerPhase];
  const energyPress = [...sources.values()].find(
    (value) => value.action === 'energy',
  );
  const energyAge = energyPress ? now - energyPress.at : 0;
  const energyTier = energyAge >= 1200 ? 'ultimate' : energyAge >= 350 ? 'beam' : 'blast';
  $('#energy-meter').hidden = !energyPress || state.phase !== 'fight' || clashing;
  $('#energy-meter').classList.toggle('above-power', powerVisible);
  const shotName = energyTier === 'blast' ? 'Ki Blast' : byId[mine.char][energyTier];
  const tierLabel = `${energyTier.toUpperCase()}: ${shotName} / ${costs[energyTier]} KI`;
  $('#energy-tier').textContent = `${tierLabel}${mine.energy < costs[energyTier] ? ' / NEED KI' : ''}`;
  $('#shot-readiness').textContent = `L blast · U beam ${costs.beam} Ki`;
  $('#resource-gain').hidden = now >= Number($('#resource-gain').dataset.until || 0) || !powerVisible;
  $('#energy-meter i').style.width = `${clamp(energyAge / 1200) * 100}%`;
  const lessonAction =
    training && mode === 'training' && !training.lesson.complete
      ? DRILLS.find((drill) => drill.id === training.lesson.id)?.action
      : null;
  for (const button of $$('#battle [data-action]')) {
    const action = button.dataset.action,
      actual = action === 'energy' ? energyTier : action;
    const regrow = action === 'special' && mine.char === 'cell' && mine.missingArm;
    if (action === 'special') button.querySelector('b').textContent = regrow ? 'Regrow Arm' : 'Technique';
    if (action === 'heavy') button.querySelector('b').textContent = mine.char === 'buu' ? 'Stretch' : 'Heavy';
    const cooldown =
      action === 'dodge'
        ? mine.dodgeCooldown || 0
        : Math.max(mine.cooldowns?.[actual] || 0, regrow ? mine.regenCooldown || 0 : 0);
    const ready =
      ['power','transform'].includes(action)
        ? canTransform
        : action === 'ultimate'
          ? mine.energy >= 100 && cooldown <= 0
          : false;
    const fill =
      action === 'power'
        ? next
          ? Math.min(
              clamp(mine.resolve / next.minResolve),
              clamp(mine.energy / next.kiCost),
            )
          : 1
        : energyPress && action === 'energy'
          ? clamp(energyAge / 1200)
          : cooldown > 0
            ? 1 - clamp(cooldown / (regrow ? 20 : cooldownDuration[actual] || 1))
            : costs[actual]
              ? clamp(mine.energy / costs[actual])
              : 1;
    const active =
      action === mine.action ||
      (action === 'energy' && ['blast', 'beam', 'ultimate'].includes(mine.action)) ||
      (action === 'power' && ['charge', 'transform'].includes(mine.action)) ||
      (regrow && mine.action === 'regenerate') ||
      (action === 'dodge' && mine.dodgeTime > 0);
    button.classList.toggle('held', held.has(action));
    button.classList.toggle('active', active);
    button.classList.toggle('ready', ready);
    button.classList.toggle(
      'unavailable',
      cooldown > 0 || mine.energy < (costs[actual] || 0) || action === 'transform' && !canTransform,
    );
    button.classList.toggle(
      'lesson-action',
      !!lessonAction &&
        (action === lessonAction ||
          (action === 'energy' && ['blast', 'beam'].includes(lessonAction)) ||
          (action === 'jump' && lessonAction === 'flight') ||
          (action === 'power' && lessonAction === 'transform') ||
          (action === 'heavy' && lessonAction === 'light' && comboCount >= 2)),
    );
    const bar = button.querySelector('.ability-fill');
    if (bar) bar.style.width = `${fill * 100}%`;
    const status = button.querySelector('.ability-status');
    if (status)
      status.textContent =
        action === 'power'
          ? ready
            ? 'READY'
            : !next
               ? 'MAX FORM'
               : '2 TAP / HOLD'
          : action === 'energy'
            ? energyPress
              ? `RELEASE: ${energyTier.toUpperCase()}`
              : '8 KI · HOLD'
          : action === 'charge'
            ? mine.energy >= 99.99 ? 'KI FULL' : 'STAND STILL'
             : action === 'jump' ? 'JUMP / RISE'
            : cooldown > 0.05
              ? `${cooldown.toFixed(1)}s`
              : ready
                ? 'READY'
                : costs[actual]
                  ? `${costs[actual]} KI`
                  : action === 'heavy'
                    ? 'FINISHER'
                    : 'COMBO START';
    if (button.classList.contains('ability'))
      button.setAttribute(
        'aria-label',
        `${button.querySelector('b').textContent}${status ? `, ${status.textContent}` : ''}`,
      );
  }
  const holdingProp = Number.isInteger(mine.heldProp) && mine.heldProp >= 0;
  const nearProp = pickupCandidate(mine, state.props, world.aimDirection());
  $('#utility-dock').hidden = state.phase !== 'fight' || watching() || mode === 'replay';
  $('#grab-button b').textContent = holdingProp ? 'Throw' : nearProp ? 'Pick up' : 'Ki blast';
  $('#grab-button .ability-status').textContent = holdingProp ? 'AIM · TAP X' : nearProp ? '10 KI · TAP X' : '8 KI · HOLD: BEAM';
  $('#grab-button').classList.toggle('unavailable', !holdingProp && mine.energy < (nearProp ? 10 : 8));
  $('#grab-button').setAttribute('aria-label', holdingProp ? 'Press X to throw the held object' : nearProp ? 'Press X to pick up the highlighted object, 10 Ki' : 'Press X to fire a Ki blast');
  $('#grab-button').setAttribute('aria-pressed', String(holdingProp));
  $('#vanish-button').setAttribute('aria-label', `Vanish, ${$('#vanish-button .ability-status').textContent}`);
  $('#flight-hint').textContent = mine.flight
    ? `${mine.y.toFixed(1)}m / E UP / C DOWN`
    : 'SPACE: FLY · T: CHARGE · R: TRANSFORM';
  $('#flight-button b').textContent = mine.flight ? 'Land' : 'Fly';
  $('#flight-button .ability-status').textContent = mine.flight ? 'E UP · C DOWN' : 'PRESS SPACE';
  $('#context-prompt').textContent = now < deniedUntil ? denial : holdingProp ? 'X  THROW · Aim with the mouse' : nearProp ? `X  PICK UP · Highlighted object · ${mine.energy >= 10 ? '10 Ki' : `need ${Math.ceil(10-mine.energy)} more Ki`}` : '';
  $('#context-prompt').dataset.state = now < deniedUntil ? 'blocked' : 'ready';
  $('#context-prompt').hidden = !powerVisible || !$('#context-prompt').textContent;
  $('#aim-reticle').hidden = !powerVisible || ![2,4].includes(cameraMode) || !cameraLook.manual;
  const aimActive=powerVisible && [2,4].includes(cameraMode) && cameraLook.manual;
  const aimed=aimActive && presentation.aimAssist ? aimCandidate(mine,state.fighters,world.aimDirection(mine)) : null;
  $('#aim-reticle').classList.toggle('on-target',!!aimed);
  $('#aim-target').hidden=!aimActive;
  $('#aim-target').textContent=aimed ? `${byId[state.fighters[aimed.slot].char].name} · ${Math.round(aimed.distance)}m` : presentation.aimAssist ? 'FREE AIM' : 'ASSIST OFF';
  const tracked=state.fighters[mine.target], cue=aimActive ? world.targetCue(tracked) : null;
  const guide=$('#target-guide');
  guide.hidden=!cue || cue.onScreen;
  if (cue && !cue.onScreen) {
    guide.style.left=`${cue.x*100}%`; guide.style.top=`${cue.y*100}%`;
    guide.style.setProperty('--cue-angle',`${cue.angle}deg`);
    guide.querySelector('span').textContent=`${byId[tracked.char].name} · ${Math.round(Math.hypot(tracked.x-mine.x,tracked.y-mine.y,tracked.z-mine.z))}m`;
  }
  $('#camera-hint').hidden = !powerVisible || mouseLooking || ![2,4].includes(cameraMode);
  $('#timer').textContent =
    mode === 'training'
      ? '--'
      : Math.ceil(state.timer).toString().padStart(2, '0');
  $('#round-label').textContent =
    state.kind === 'pit'
      ? 'BATTLE ROYALE'
      : mode === 'training'
        ? 'TRAINING'
        : `ROUND ${state.round}`;
  $('#match-mode').textContent =
    mode === 'replay' ? 'VISUAL REPLAY' : mode === 'network'
      ? state.kind === 'pit' ? '12 HUMANS' : room?.matchmaking ? 'PUBLIC 1V1' : 'FRIENDS 1V1'
      : mode === 'tournament'
        ? 'CHAMPIONSHIP'
        : mode === 'pit'
          ? `${state.aliveCount} ALIVE`
          : mode === 'spectate'
            ? 'LIVE AI'
            : mode === 'training'
              ? 'GUIDED DRILL'
               : mode === 'series' ? `RIVAL ${Math.min(12, series.index + 1)}/12` : 'DUEL';
  $('#aura-total').textContent = `${(mode === 'series' ? series.aura : 0) + (mode === 'series' && resultShown ? 0 : mine.aura || 0)} AURA`;
  $('#auratotal').hidden = mode === 'training';
  $('#ki-cue').hidden = now >= kiUntil || state.phase !== 'fight' || simulationPaused() || watching();
  const outside = mine.alive && state.phase === 'fight' && state.zone?.active && Math.hypot(mine.x, mine.z) > state.zone.radius;
  $('#field-warning').hidden = !outside;
  $('#field-warning').textContent = outside ? `RETURN TO FIELD / -${state.zone.damagePerSecond} HP/s` : '';
  const hazard = mine.alive && mine.y < .8 && state.phase === 'fight' && (state.hazards || []).find(h => Math.hypot(mine.x - h.x, mine.z - h.z) < h.radius);
  $('#hazard-cue').hidden = !hazard || outside;
  $('#hazard-cue').dataset.kind = hazard?.kind || '';
  $('#hazard-cue').textContent = hazard?.kind === 'fire' ? 'FIRE / ASCEND TO CLEAR' : hazard?.kind === 'water' ? 'SHALLOWS / SLOWED' : '';
  $('#aura-gain').hidden = now >= auraUntil || state.phase === 'countdown' || watching();
  $('#connection-status').textContent =
    mode === 'replay' ? 'LOCAL VISUAL REPLAY / NO LIVE COMBAT' : mode === 'network'
      ? `ROOM ${room?.code || ''} / ${rtt} MS / YOU P${localSlot + 1}`
      : mode === 'tournament'
        ? activeFixture?.roundLabel.toUpperCase() || 'CHAMPIONSHIP'
        : mode === 'pit'
          ? '1 HUMAN + 11 AI / LOCAL'
          : mode === 'training'
            ? 'LOCAL TRAINING / REAL ACTIONS'
            : 'LOCAL COMBAT';
  $('#action-hint').textContent = watching()
    ? 'SPECTATING / H OR TAB NEXT TARGET'
    : clashing ? 'X / J TAP BOOST / C OR PRIMARY POINTER HOLD BRACE'
    : mine.flight
      ? 'E UP / C DOWN / Q EVADE (SHIFT ALT) / H TARGET'
      : energyPress
        ? 'X: TAP BLAST / 0.35s BEAM / 1.2s ULTIMATE'
        : 'WASD MOVE / Q EVADE / H TARGET / T KI / R FORM';
  const threats = state.fighters
    .map((fighter, index) => ({ fighter, index }))
    .filter(({ fighter, index }) => {
      if (index === localSlot || !fighter.alive || fighter.clashId >= 0) return false;
      const attack = attackWindows.get(index);
      return (
        fighter.target === localSlot &&
        (fighter.surgeCharge > 0 ||
          (attack &&
            fighter.action === attack.action &&
            attack.duration - fighter.actionTime >= 0 && attack.duration - fighter.actionTime <= attack.windup))
      );
    })
    .map(({ fighter, index }) => ({
      fighter,
      index,
      surge: fighter.surgeCharge > 0,
      distance: Math.hypot(fighter.x - mine.x, fighter.z - mine.z),
    }))
    .sort((a, b) => Number(b.surge) - Number(a.surge) || a.distance - b.distance)
    .slice(0, 3);
  const threat = threats[0]?.fighter;
  $('#danger-cue').hidden = !threat;
  $('#danger-cue').dataset.count = String(threats.length);
  if (threat) {
    const names = threats.map(({ fighter }) => byId[fighter.char].name.toUpperCase());
    const head = threats.length > 1 ? `${threats.length} INCOMING: ${names.join(' + ')}` : names[0];
    const switchHint = threats.length > 1 && state.fighters[localSlot]?.target !== threats[0].index ? ' / H SWITCH' : '';
    $('#danger-cue').textContent =
      clashing ? `${head} / CLASH AT RISK`
        : threats[0].surge ? `${head} SURGE / EVADE${switchHint}`
        : `${head} WINDUP / GUARD OR EVADE${switchHint}`;
  }
  $('#counter-cue').hidden = mine.counterWindow <= 0;
  $('#hit-label').hidden = now >= hitUntil;
  if (now > comboUntil) comboCount = 0;
  $$('#combo-progress i').forEach((node, index) =>
    node.classList.toggle('landed', index < comboCount),
  );
  $('#combo-progress').hidden =
    state.phase !== 'fight' || !comboCount || watching() || (mode === 'training' && training.lesson.id !== 'combo');
  $('#combat-cues').hidden = state.phase !== 'fight';
  $('#elimination-feed').hidden = state.phase !== 'fight';
  if (state.kind === 'pit') {
    $('#alive-counter').textContent = `${state.aliveCount} REMAIN`;
    $('#spectate-message').hidden = mine.alive;
    if (!mine.alive)
      $('#spectate-message').textContent =
        `Watching ${byId[state.fighters[spectateSlot]?.char]?.name || 'survivors'} / H or Tab to switch`;
    const feed = state.eliminations
      .slice(-4)
      .reverse()
      .map(
        (event) =>
          `<p>${escapeHTML(byId[state.fighters[event.slot]?.char]?.name || 'Fighter')} eliminated${event.owner >= 0 ? ` by ${escapeHTML(byId[state.fighters[event.owner]?.char]?.name || 'rival')}` : ''}</p>`,
      )
      .join('');
    if ($('#elimination-feed').innerHTML !== feed)
      $('#elimination-feed').innerHTML = feed;
  }
  $('#intro-details').hidden = mode === 'replay' || state.phase !== 'countdown';
  if (mode === 'replay' || mode === 'training') {
    $('#announcement').hidden = true;
  } else if (state.phase === 'countdown') {
    $('#announcement').hidden = false;
    $('.vs-portraits').hidden = state.kind === 'pit';
    $('#announcement-small').textContent =
      `${activeFixture?.roundLabel || (state.kind === 'pit' ? 'TWELVE FIGHTERS / ONE PIT' : mode === 'series' ? `RIVAL ${series.index + 1}/12 / BEST OF 3` : `ROUND ${state.round}`)} / GET READY`;
    $('#announcement-big').textContent = Math.ceil(state.phaseTime);
  } else if (state.phase === 'roundOver') {
    $('#announcement').hidden = false;
    $('.vs-portraits').hidden = true;
    $('#announcement-small').textContent =
      state.winner >= 0
        ? `${byId[state.fighters[state.winner].char].name.toUpperCase()} TAKES THE ROUND`
        : 'ROUND DRAW';
    $('#announcement-big').textContent =
      state.timer <= 0 ? 'TIME UP' : 'KNOCKOUT';
  } else $('#announcement').hidden = true;
  if (
    state.phase === 'fight' &&
    lastRoundVoice !== state.round &&
    !simulationPaused()
  ) {
    lastRoundVoice = state.round;
    if (mode !== 'training' && mode !== 'replay')
      persona.speak(state.fighters[localSlot].char, 'intro', true);
  }
  if (mode === 'training') updateTraining();
  else $('#movement-marker').hidden = true;
}
function renderState(now) {
  if (mode !== 'network' || !previousState || state.phase !== 'fight')
    return state;
  const interval = clamp((state.tick - previousState.tick) * 1000 / 60, 16.667, 100);
  // Visual-only interpolation. Hold at the newest snapshot; never extrapolate hits.
  const alpha = clamp((now - receivedAt) / interval);
  return {
    ...state,
    fighters: state.fighters.map((fighter, index) => {
      const before = previousState.fighters[index] || fighter;
      return {
        ...fighter,
        x: before.x + (fighter.x - before.x) * alpha,
        y: before.y + (fighter.y - before.y) * alpha,
        z: before.z + (fighter.z - before.z) * alpha,
      };
    }),
    ...Object.fromEntries(['props', 'projectiles'].map(key => {
      const beforeById = new Map((previousState[key] || []).map(item => [item.id, item]));
      return [key, (state[key] || []).map(item => {
        const before = beforeById.get(item.id);
        if (!before || (key === 'props' && (before.heldBy !== item.heldBy || before.respawn !== item.respawn || before.hp <= 0 || item.hp <= 0))) return item;
        return { ...item, ...Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, before[axis] + (item[axis] - before[axis]) * alpha])) };
      })];
    })),
  };
}
function drawGearPreview() {
  if (!$('#locker-dialog').open) return;
  const source = $('#arena'),
    target = $('#gear-preview'),
    context = target.getContext('2d');
  const width = innerWidth,
    height = innerHeight,
    mobile = width < 700;
  const heroHeight = height <= 500 ? clamp(height * .55, 160, 240) : mobile
    ? clamp(height * 0.32, 205, 270)
    : clamp(height * 0.41, 280, 420);
  const centerY = height <= 500 ? height * .5 : mobile
    ? clamp(height * 0.39, 275, 355)
    : (height - 190) * 0.5;
  const slot = room ? localSlot : 0;
  const centerX =
    width * (mobile ? (slot ? 0.715 : 0.285) : slot ? 0.815 : 0.617);
  const cropHeight = heroHeight * 1.45,
    cropWidth = cropHeight * 0.75,
    ratio = source.width / width;
  context.fillStyle = '#080c12';
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(
    source,
    (centerX - cropWidth / 2) * ratio,
    (centerY - cropHeight * 0.48) * ratio,
    cropWidth * ratio,
    cropHeight * ratio,
    0,
    0,
    target.width,
    target.height,
  );
}
function frame(now) {
  if (mode !== 'menu') syncInputContext();
  const dt = clamp((now - lastFrame) / 1000, 0, 0.08);
  lastFrame = now;
  const paused = simulationPaused();
  if (mode === 'menu' && modePreview && !$('dialog[open]')) {
    stepMatch(modePreview.state, modePreview.state.fighters.map((_, slot) => getAIInput(modePreview.state, slot, dt)), dt);
  }
  if (!paused && mode !== 'menu') {
    const evading = evadeQueue.length || [...sources.values()].some(value => ['dodge', 'vanish'].includes(value.action));
    const looking = key => !evading && !chordKeys.has(key) && lookKeys.has(key) && now - lookKeyAt.get(key) >= 40;
    const yaw = (Number(looking('ArrowLeft')) - Number(looking('ArrowRight'))) * dt * 1.5;
    const pitch = (Number(looking('ArrowDown')) - Number(looking('ArrowUp'))) * dt;
    if (yaw || pitch) turnCamera(yaw, pitch);
    advanceTutorial(now);
  }
  if (mode === 'replay') updateReplay(paused ? 0 : dt);
  if (mode !== 'menu' && mode !== 'network' && mode !== 'replay' && !paused && now >= impactUntil) {
    accumulator = Math.min(0.15, accumulator + dt);
    while (accumulator >= 1 / 60) {
      if (mode === 'tournament' && cup && !cupPaused) {
        const lock =
          activeFixture?.id ||
          (cup.spectator ? nextPlayerMatch(cup)?.id : null);
        tickTournament(cup, 1 / 60, lock);
      }
      if (!resultShown) {
        const tickBefore = state.tick;
        const input = canInput() ? sampleInput() : {};
        if (mode === 'training') {
          stepTraining(training, input, 1 / 60);
          syncTrainingState();
        }
        else
          stepMatch(
            state,
            state.fighters.map((fighter, index) =>
              index === localSlot && !watching()
                ? input
                : getAIInput(state, index, 1 / 60),
            ),
            1 / 60,
          );
        if (state.tick !== tickBefore) captureReplay(1 / 60);
      }
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  if (mode === 'network' && !document.hidden) {
    // 20 Hz steady snapshots plus bounded input edges, never an unthrottled key flood.
    if (now - lastNetworkSend >= (networkDirty ? 20 : 50)) {
      networkDirty = false;
      send({ type: 'input', input: canInput() || dropPending ? sampleInput() : {} });
      lastNetworkSend = now;
    }
    if (now - lastPing > 2000) {
      send({ type: 'ping', sent: now });
      lastPing = now;
    }
  }
  if (mode !== 'menu' && state.kind === 'pit' && !state.fighters[localSlot].alive) {
    if (sources.size || pending.size || padPointer !== null) clearInput();
    if (!state.fighters[spectateSlot]?.alive) cycleSpectator();
    document.body.classList.add('spectating');
  }
  if (mode === 'tournament' && resultShown) {
    if (
      !paused &&
      !autoPaused &&
      !cupPaused &&
      !cup.eliminated &&
      !cup.champion
    ) {
      autoRemaining = Math.max(0, autoRemaining - dt);
      if (autoRemaining === 0 && !$('#cup-dialog').open) startCupMatch();
    }
    updateCupResult();
    if ($('#cup-dialog').open) renderCup();
  }
  const menu = mode === 'menu',
    players = room?.players;
  menuAction = updateMenuQuote(now);
  let previewViewport = null;
  if(menu && modePreview){
    const box = $('.preview-space').getBoundingClientRect();
    const left = Math.max(12, box.left), top = Math.max(12, box.top);
    const right = Math.min(innerWidth - 12, box.right), bottom = Math.min(innerHeight - 12, box.bottom);
    if(right-left>=160 && bottom-top>=160) previewViewport = {
      left:left/innerWidth, top:top/innerHeight, width:(right-left)/innerWidth, height:(bottom-top)/innerHeight,
    };
  }
  const studio = experience.studio();
  const freezeArena = paused && !studio;
  // Keep UI responsive without drawing the same arena behind a modal each frame.
  // Studio deliberately keeps its live model. Resize/settings request one redraw.
  if (!freezeArena || !renderSuspended || renderDirty) world.update(
    menu ? modePreview?.state || menuState : renderState(now),
    mode === 'replay' ? (paused || !replay.playing ? 0 : dt * replay.speed) : paused && !menu && mode !== 'network' ? 0 : dt,
    {
      menu:menu && !modePreview,
      studio,
      previewViewport,
      cameraMode:modePreview ? 1 : cameraMode,
      cameraLook,
      localSlot:menu ? 0 : watching() ? spectateSlot : localSlot,
      reduced,
      selected: players?.[0].fighter || selected,
      opponent: players?.[1].fighter || menuState.fighters[1].char,
      loadout: players?.[0].loadout || loadout,
      tint: players?.[0].tint || tint,
      opponentLoadout: players?.[1].loadout || [],
      opponentTint: players?.[1].tint || '#ffc45b',
      stage: menu ? modePreview?.state.stage || menuState.stage : state.stage,
      previewForm: players ? 0 : previewForm,
      opponentForm: 0,
      previewAction: now < previewUntil ? 'transform' : menuAction,
      previewActionTime: Math.max(0, ((now < previewUntil ? previewUntil : quoteAt + 1500) - now) / 1000),
    },
  );
  renderSuspended = freezeArena;
  renderDirty = false;
  if (now - previewTick > 70) {
    drawGearPreview();
    previewTick = now;
  }
  if (!menu) {
    if (mode !== 'replay') consumeEvents(now);
    if (now - hudTick > 40) {
      updateHUD(now);
      hudTick = now;
    }
    const shotCharge = Math.max(0, ...[...sources.values()]
      .filter(value => value.action === 'energy')
      .map(value => (now - value.at) / 1000));
    audio.tick(paused || mode === 'replay' ? null : state, dt, { shotCharge: paused ? 0 : shotCharge, localSlot, reduced });
    if (state.phase === 'matchOver' && !resultShown && !['training', 'replay'].includes(mode)) showResult();
  }
  requestAnimationFrame(frame);
}

const experience = createExperience({
  portraits, stageImages,
  read:(key,fallback)=>safeJSON(readPreference(key,JSON.stringify(fallback))) ?? fallback,
  save:(key,value)=>savePreference(key,JSON.stringify(value)),
  show:showDialog,closeAll:closeDialogs,menu:returnToMenu,
  selection:()=>({fighter:selected,form:previewForm,loadout}),select:selectFighter,
  form:index=>{previewForm=index;previewUntil=performance.now()+1000;updateMenu();},
  gear:id=>{const gear=gearById[id];if(!gear)return;const equipped=loadout.includes(id);loadout=loadout.filter(x=>gearById[x].slot!==gear.slot);if(!equipped)loadout.push(id);applyLoadout();},
  train:id=>startTraining('combo',id),
  preview:chapter=>{if(mode!=='menu')returnToMenu();selected=chapter.player;opponent=chapter.rival;selectedStage=chapter.stage;previewForm=0;updateMenu();},
  startEpisode:(chapter,index)=>{disconnect();training=null;cup=null;series=null;activeFixture=null;localSlot=0;const matchSeed=0xc0ffee+index;startMatch(createMatch(chapter.player,chapter.rival,{stage:chapter.stage,difficulty,seed:matchSeed,loadouts:[loadout],tints:[tint]}),'story',matchSeed);},
});
$('#form-path-open').addEventListener('click',()=>experience.openPath(state.fighters[localSlot]));
$('#credits-open').addEventListener('click',()=>showDialog('credits-dialog'));
$('#guide-open').addEventListener('click',startTutorial);

$('#ability-dock').innerHTML = [abilityDefinitions.slice(0, 4), abilityDefinitions.slice(4)].map((cluster, index) =>
  `<div id="abilities-${index ? 'right' : 'left'}" class="ability-cluster">${cluster
  .map(
    ([action, label, key, status, icon]) =>
      `<button class="ability" data-action="${action}" aria-label="${label}, ${action === 'dodge' ? 'Q or Shift; arrows choose direction without orbit' : action === 'power' ? 'Space twice for flight, hold to charge and transform; T charge, R transform' : key}"><span class="ability-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></svg></span><b>${label}</b><kbd>${key}</kbd><small class="${['guard'].includes(action) ? '' : 'ability-status'}">${status}</small><i class="ability-fill"></i></button>`,
  )
  .join('')}</div>`).join('');
$('#training-drills').innerHTML = DRILLS.map((drill, index) => `<article class="lesson-card"><button class="lesson-poster" ${["charge","blink","prop"].includes(drill.id)?`data-drill="${drill.id}"`:`data-lesson="${drill.id}"`} aria-label="Watch ${escapeHTML(drill.title)} demonstration"><img src="/games/universe-clash/assets/training-${["charge","blink","prop"].includes(drill.id)?"move":drill.id}.png" loading="lazy" alt="${escapeHTML(drill.title)} in-game demonstration"><span>${["charge","blink","prop"].includes(drill.id)?"TRY IT LIVE":"▶ WATCH DEMO"}</span></button><span class="eyebrow">${String(index + 1).padStart(2, '0')} / ${index < 2 ? 'MOVEMENT' : index < 5 ? 'CLOSE COMBAT' : 'POWER & ENERGY'}</span><h3>${escapeHTML(drill.title)} <kbd>${escapeHTML(drill.key)}</kbd></h3><p>${escapeHTML(drill.prompt)}</p><small data-lesson-progress="${drill.id}"></small><div><button data-drill="${drill.id}" aria-label="Practice ${escapeHTML(drill.title)}">Practice</button></div></article>`).join('');
$('#pause-drills').innerHTML = DRILLS.filter(drill => ['move', 'combo', 'transform', 'flight'].includes(drill.id)).map(drill => `<button class="pause-tile" data-drill="${drill.id}">${drillIcon(drill)}<b>${drill.title}</b></button>`).join('');
$$('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
$('#gear-slots').innerHTML = GEAR_SLOTS.map(
  (slot) =>
    `<section class="gear-slot"><h3>${slot}</h3><div class="gear-choices">${ATTACHMENTS.filter(
      (gear) => gear.slot === slot,
    )
      .map(
        (gear) =>
          `<button data-gear="${gear.id}" aria-pressed="false">${escapeHTML(gear.name)}<small>${escapeHTML(gear.description)}</small></button>`,
      )
      .join(
        '',
      )}</div><button data-unequip="${slot}">Clear ${slot}</button></section>`,
).join('');

$('#play').addEventListener('click', launchMode);
$('#start-tournament').addEventListener('click', openCup);
$('#start-training').addEventListener('click', openTraining);
$('#menu-settings').addEventListener('click', openSettings);
$('#showcase-open').addEventListener('click', () => {
  restorePreview();
  showDialog('showcase-dialog');
  const video = $('#showcase-video');
  video.muted = !soundOn;
  $('#showcase-status').textContent = '42 seconds / original synthesized sound / not a real match or leaderboard result.';
  video.src = '/games/universe-clash/assets/goku-jiren-showcase.webm';
  void video.play().catch(() => {
    if ($('#showcase-dialog').open) $('#showcase-status').textContent = 'Use Play to start the scripted cinematic.';
  });
});
$('#showcase-dialog').addEventListener('close', () => { if (!$('#showcase-dialog').open) stopShowcase(); });
$('#showcase-video').addEventListener('error', () => {
  if ($('#showcase-dialog').open && $('#showcase-video').hasAttribute('src')) $('#showcase-status').textContent = 'Cinematic unavailable from this server. Regular matches are still ready.';
});
$('#replay-tutorial').addEventListener('click', startTutorial);
$('#training-guided').addEventListener('click', startTutorial);
$$('[data-replays]').forEach(button => button.addEventListener('click', openReplays));
$$('[data-save-replay]').forEach(button => button.addEventListener('click', () => saveReplay(button)));
$('#replay-retry').addEventListener('click', refreshReplays);
$('#replays-dialog').addEventListener('close', () => {
  // Native close events are queued; a leave-room flow can already have reopened it.
  if (!$('#replays-dialog').open) replayRequest++;
});
$('#replay-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-replay-watch], [data-replay-delete]');
  if (!button) return;
  if (button.dataset.replayWatch) { void watchReplay(button.dataset.replayWatch); return; }
  if (!confirm('Delete this visual replay from this browser?')) return;
  button.disabled = true;
  try { await replayStore.remove(button.dataset.replayDelete); await refreshReplays(); }
  catch (error) { $('#replay-library-status').textContent = `Delete failed (${error.code || 'ERROR'}): ${error.message}`; button.disabled = false; }
});
$('#replay-clear').addEventListener('click', async () => {
  if (!confirm('Delete all saved visual replays in this browser? This cannot be undone.')) return;
  $('#replay-clear').disabled = true;
  try { await replayStore.clear(); await refreshReplays(); }
  catch (error) { $('#replay-library-status').textContent = `Clear failed (${error.code || 'ERROR'}): ${error.message}`; $('#replay-clear').disabled = false; }
});
$('#replay-toggle').addEventListener('click', () => {
  if (!replay) return;
  if (replay.time >= replay.clip.duration) replay.time = 0;
  replay.playing = !replay.playing;
  updateReplay(0);
});
$('#replay-seek').addEventListener('input', event => {
  if (replay) { replay.time = clamp(Number(event.target.value), 0, replay.clip.duration); updateReplay(0); }
});
$('#replay-speed').addEventListener('change', event => {
  if (replay && [.5, 1, 2].includes(Number(event.target.value))) replay.speed = Number(event.target.value);
});
$('#replay-exit').addEventListener('click', returnToMenu);
async function refreshOnline() {
  if (performance.now() - onlineRefreshAt < 5100 && socket?.readyState === WebSocket.OPEN) return;
  onlineRefreshAt = performance.now();
  clearTimeout(onlineStatusTimer);
  if (!multiplayerEnabled) { $('#online-status').textContent = 'Offline preview. Online play needs the connected version.'; return; }
  $('#online-status').textContent = 'Checking the match server…';
  $('#duel-population').textContent = $('#pit-population').textContent = 'Queue count unavailable';
  for (const button of $$('#quick-match, #pool-match, #create-room, #join-room')) button.disabled = true;
  try {
    await connect();
    if (!$('#online-dialog').open) return;
    send({ type:'status' });
    onlineStatusTimer = setTimeout(() => { $('#online-status').textContent = 'No compatible server response. Check the connection to try again.'; }, 5500);
  } catch (error) { $('#online-status').textContent = error.message; }
}
$('#online-open').addEventListener('click', () => { showDialog('online-dialog'); void refreshOnline(); clearInterval(onlinePoll); onlinePoll = setInterval(() => { if ($('#online-dialog').open) void refreshOnline(); }, 15000); });
$('#online-dialog').addEventListener('close', () => { clearInterval(onlinePoll); clearTimeout(onlineStatusTimer); });
$('#online-refresh').addEventListener('click', refreshOnline);
$('#queue-retry').addEventListener('click', () => startQueue(matchmaking.mode));
$('#queue-duel').addEventListener('click', () => startQueue('duel'));
function openTournamentEntry() {
  pendingTournament = createTournament(selected, seed(), { spectator:$('#tournament-spectator').checked });
  const first = nextPlayerMatch(pendingTournament);
  $('#tournament-entry-status').textContent = pendingTournament.spectator ? 'Watch the AI championship. You will not control a fighter.' : `Your opening match: ${byId[first.a].name} vs ${byId[first.b].name}. This draw is kept when you enter.`;
  $('#tournament-enter').textContent = pendingTournament.spectator ? 'WATCH THIS CHAMPIONSHIP' : 'ENTER THIS CHAMPIONSHIP';
  $('#tournament-preview').innerHTML = ['ROUND OF 16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'].map((label, round) => `<section><h3>${label}</h3><div class="preview-round">${Array.from({length:8 / 2 ** round}, (_, i) => { const match = pendingTournament.bracket[round]?.[i]; return `<article data-preview-a="${match?.a || ''}" data-preview-b="${match?.b || ''}" class="${match && [match.a, match.b].includes(pendingTournament.playerId) ? 'your-match' : ''}">${match ? [match.a, match.b].map(id => `<span><img src="${portraits.get(id)}" alt="">${escapeHTML(byId[id].name)}${id === pendingTournament.playerId ? ' · YOU' : ''}</span>`).join('') : `<span>${round === 1 ? 'R16' : round === 2 ? 'Quarterfinal' : 'Semifinal'} winner ${i * 2 + 1}</span><span>${round === 1 ? 'R16' : round === 2 ? 'Quarterfinal' : 'Semifinal'} winner ${i * 2 + 2}</span>`}</article>`; }).join('')}</div></section>`).join('');
  showDialog('tournament-entry-dialog');
}
$('#tournament-enter').addEventListener('click', startTournament);
$('#tournament-spectator').addEventListener('change', openTournamentEntry);
function updateLessonProgress() {
  const saved = readPreference('lessons-v1', null) === JSON.stringify([...completedLessons]);
  $('#lesson-course-progress').textContent = `${completedLessons.size} / ${DRILLS.length} lessons completed · ${saved ? 'saved in this browser' : 'this session'}`;
  for (const node of $$('[data-lesson-progress]')) node.textContent = completedLessons.has(node.dataset.lessonProgress) ? '✓ COMPLETED' : 'NOT PRACTICED YET';
}
function stopLesson() { const video = $('#lesson-video'); video.pause(); video.removeAttribute('src'); video.load(); }
$('#lesson-dialog').addEventListener('close', () => { if (!$('#lesson-dialog').open) stopLesson(); });
$('#lesson-video').addEventListener('error', () => { $('#lesson-video-status').textContent = 'The demonstration could not load. You can still practice this move.'; });
$('#training-drills').addEventListener('click', event => {
  const button = event.target.closest('[data-lesson]'); if (!button) return;
  lessonId = button.dataset.lesson;
  const drill = DRILLS.find(d => d.id === lessonId);
  $('#lesson-title').textContent = drill.title;
  $('#lesson-prompt').textContent = drill.prompt;
  $('#lesson-hint').textContent = drill.hint;
  $('#lesson-video-status').textContent = 'Recorded in-game demonstration · Goku · no audio';
  $('#lesson-video').poster = `/games/universe-clash/assets/training-${lessonId}.png`;
  $('#lesson-video').src = `/games/universe-clash/assets/training-${lessonId}.webm`;
  $('#lesson-video').load();
  showDialog('lesson-dialog');
});
$('#lesson-practice').addEventListener('click', () => startTraining(lessonId, trainingFighter));
$('#quick-match').addEventListener('click', () => startQueue('duel'));
$('#pool-match').addEventListener('click', () => startQueue('pit12'));
$('#leaderboard-open').addEventListener('click', () => {
  showDialog('leaderboard-dialog');
  void requestLeaderboard();
});
$('#leaderboard-refresh').addEventListener('click', requestLeaderboard);
$$('[data-pause-panel]').forEach(button => button.addEventListener('click', () => showPausePanel(button.dataset.pausePanel)));
$('#pause-back').addEventListener('click', () => showPausePanel('root'));
$('#queue-cancel').addEventListener('click', () => closeDialog($('#queue-dialog')));
$('#queue-dialog').addEventListener('close', () => {
  if ($('#queue-dialog').open) return; // A queued close event must not cancel a newly opened search.
  if (!['matched', 'cancelled'].includes(matchmaking.status)) cancelQueue();
});
$$('[data-nav]').forEach((button) =>
  button.addEventListener('click', () => {
    const action = button.dataset.nav;
    if (action === 'play') {
      closeDialogs();
      $('#play').focus({ preventScroll: true });
    } else if (action === 'tournament') openCup();
    else if (action === 'training') openTraining();
    else if (action === 'studio') experience.openStudio();
    else if (action === 'achievements') experience.openAchievements();
    else if (action === 'locker') openLocker();
    else if (action === 'intel') openIntel();
  }),
);
$$('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
  button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') previewMode(button.dataset.mode); });
  button.addEventListener('focus', () => previewMode(button.dataset.mode));
  button.addEventListener('pointerleave', restorePreview);
  button.addEventListener('blur', restorePreview);
});
$('#difficulty').addEventListener('change', (event) => {
  difficulty = event.target.value;
  updateMenu();
});
$('#opponent-select').addEventListener('change', (event) => {
  if (!Object.hasOwn(byId, event.target.value)) return;
  opponent = event.target.value;
  updateMenu();
});
$('#rival-open').addEventListener('click', () => showDialog('rival-dialog'));
$('#random-rival').addEventListener('click', () => {
  const others = ROSTER.filter(fighter => fighter.id !== opponent && fighter.id !== selected);
  opponent = others[seed() % others.length].id;
  restorePreview();
});
$('#stage-open').addEventListener('click', () => showDialog('stages-dialog'));
$('#roster-open').addEventListener('click', () => experience.openStudio());
$('#random-fighter').addEventListener('click', () => {
  const others = ROSTER.filter((fighter) => fighter.id !== selected);
  selectFighter(others[Math.floor(Math.random() * others.length)].id);
});
$('#form-lab-open').addEventListener('click', openForms);
$('#form-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-form-index]');
  if (!button) return;
  previewForm = Number(button.dataset.formIndex);
  previewUntil = performance.now() + 1000;
  closeDialog($('#forms-dialog'));
  updateMenu();
});
for (const picker of $$('#training-drills, #pause-drills')) picker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-drill]');
  if (button) startTraining(button.dataset.drill);
});
$('#training-next').addEventListener('click', () => {
  if (!training?.lesson.complete) return;
  const index = DRILLS.findIndex((drill) => drill.id === training.lesson.id);
  if (index === DRILLS.length - 1) openTraining();
  else startTraining(DRILLS[index + 1].id, trainingFighter);
});
$('#training-repeat').addEventListener('click', () => {
  if (tutorial) tutorial.advanceAt = 0;
  if (training) startTraining(training.lesson.id, trainingFighter, !!tutorial);
});
$('#training-reset').addEventListener('click', () => {
  if (mode !== 'training') return;
  resetTraining(training);
  syncTrainingState();
  updateTraining();
});
for (const select of $$('#training-fighter-select, #training-live-fighter')) select.addEventListener('change', event => {
  if (!Object.hasOwn(byId, event.target.value) || mode === 'network') return;
  trainingFighter = event.target.value;
  if (mode === 'training') {
    resetTraining(training, trainingFighter);
    if (tutorial) tutorial.advanceAt = 0;
    syncTrainingState();
    updateTraining();
  }
  for (const node of $$('#training-fighter-select, #training-live-fighter')) node.value = trainingFighter;
});
$('#training-choose').addEventListener('click', openTraining);
$('#training-exit').addEventListener('click', returnToMenu);
$('#gear-slots').addEventListener('click', (event) => {
  const button = event.target.closest('[data-gear], [data-unequip]');
  if (!button) return;
  const gear = gearById[button.dataset.gear],
    slot = gear?.slot || button.dataset.unequip;
  const equipped = gear && loadout.includes(gear.id);
  loadout = loadout.filter((id) => gearById[id].slot !== slot);
  if (gear && !equipped) loadout.push(gear.id);
  applyLoadout();
});
$('#loadout-random').addEventListener('click', () => {
  loadout = randomLoadout(seed());
  applyLoadout();
});
$('#loadout-tint').addEventListener('input', (event) => {
  tint = event.target.value;
  updateMenu();
});
$('#loadout-tint').addEventListener('change', applyLoadout);
$('#intel-fighter').addEventListener('change', (event) =>
  renderIntel(event.target.value),
);
$('#intel-content').addEventListener('click', (event) => {
  const button = event.target.closest('[data-intel-drill]');
  if (button)
    startTraining(button.dataset.intelDrill, button.dataset.practiceFighter);
});
$('#battle-bracket').addEventListener('click', openCup);
$('#result-bracket').addEventListener('click', openCup);
$('#cup-play').addEventListener('click', () => {
  if (activeFixture && !resultShown) closeDialog($('#cup-dialog'));
  else {
    cupPaused = false;
    startCupMatch();
  }
});
$('#cup-pause').addEventListener('click', () => {
  cupPaused = !cupPaused;
  renderCup();
});
$('#cup-exit').addEventListener('click', returnToMenu);
$('#result-auto-pause').addEventListener('click', () => {
  autoPaused = !autoPaused;
  updateCupResult();
});
$('#create-room').addEventListener('click', createRoom);
$('#join-room').addEventListener('click', () => {
  if (!multiplayerEnabled) return;
  $('#join-error').textContent = '';
  $('#join-submit').disabled = false;
  showDialog('join-dialog');
});
$('#join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  joinRoom($('#room-input').value.trim().toUpperCase());
});
$('#ready-button').addEventListener('click', () => {
  unlockAudio();
  send({ type: 'ready' });
});
$('#lobby-fighter').addEventListener('change', (event) =>
  send({ type: 'select', fighter: event.target.value }),
);
$('#lobby-stage').addEventListener('change', (event) =>
  send({ type: 'stage', stage: event.target.value }),
);
$('#lobby-locker').addEventListener('click', openLocker);
$('#leave-lobby').addEventListener('click', returnToMenu);
$('#copy-code').addEventListener('click', async () => {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(room.code);
    toast('Room code copied.');
  } catch {
    toast(`Room code: ${room.code}`);
  }
});
$('#copy-invite').addEventListener('click', async () => {
  if (!room) return;
  const url = new URL('/games/universe-clash/index.html', location.origin);
  url.searchParams.set('room', room.code);
  try {
    await navigator.clipboard.writeText(url.href);
    toast('Invite copied. Your friend must be able to reach this server.');
  } catch {
    toast(`Invite: ${url.href}`);
  }
});
$('#sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn;
  unlockAudio();
  updateSound();
});
$('#sound-setting').addEventListener('change', (event) => {
  soundOn = event.target.checked;
  unlockAudio();
  updateSound();
});
$('#voice-setting').checked = voiceOn;
$('#effects-setting').checked = reduced;
persona.setEnabled(voiceOn);
$('#voice-setting').addEventListener('change', (event) => {
  voiceOn = event.target.checked;
  savePreference('voice', voiceOn ? '1' : '0');
  unlockAudio();
});
$('#effects-setting').addEventListener('change', (event) => {
  reduced = event.target.checked;
  document.body.classList.toggle('reduced-effects', reduced);
  savePreference('reduced', reduced ? '1' : '0');
});
function syncPresentation() {
  for (const input of $$('[data-presentation]')) {
    const key=input.dataset.presentation;
    if (input.type === 'checkbox') input.checked=presentation[key];
    else input.value=String(presentation[key]);
    const output=$(`#${input.id}-value`);
    if (output) output.textContent=key==='sensitivity' ? `${presentation[key].toFixed(1)}×` : key==='fov' ? `${Math.round(presentation[key])}°` : `${presentation[key].toFixed(1)}m`;
  }
}
for (const input of $$('[data-presentation]')) input.addEventListener('input', () => {
  const value=input.type==='checkbox' ? input.checked : input.type==='range' ? Number(input.value) : input.value;
  presentation=normalizePresentation({...presentation,[input.dataset.presentation]:value});
  world?.configure(presentation);
  renderDirty = true;
  savePreference('presentation-v1',JSON.stringify(presentation));
  syncPresentation();
});
$('#reset-presentation').addEventListener('click', () => {
  presentation=normalizePresentation(DEFAULT_PRESENTATION);
  world?.configure(presentation);
  renderDirty = true;
  savePreference('presentation-v1',JSON.stringify(presentation));
  syncPresentation();
});
syncPresentation();
$('#voice-preview').addEventListener('click', () => {
  voiceOn = true;
  $('#voice-setting').checked = true;
  savePreference('voice', '1');
  unlockAudio();
  persona.speak(selected, 'intro', true);
});
$('#pause-button').addEventListener('click', openSettings);
$('#resume').addEventListener('click', () => closeDialogs());
$('#exit-match').addEventListener('click', returnToMenu);
$('#results-exit').addEventListener('click', returnToMenu);
$('#rematch').addEventListener('click', () => {
  if (mode === 'network') {
    if (state.kind === 'pit' && !room?.players.every(player => player.connected)) { void startQueue('pit12'); return; }
    send({ type: 'rematch' });
    $('#rematch').disabled = true;
    $('#rematch-status').textContent = state.kind === 'pit' ? 'Waiting for all 12 votes.' : 'Waiting for your rival to agree.';
  } else if (mode === 'tournament') {
    autoPaused = false;
    cupPaused = false;
    startCupMatch();
  } else if (mode === 'story') {
    experience.advance();
  } else if (mode === 'series') {
    if (nextLadderMatch(series)) startSeriesMatch();
    else startSeries();
  } else launchMode();
});
$('#show-controls').addEventListener('click', () =>
  showDialog('controls-dialog'),
);
$('#controls-training').addEventListener('click', openTraining);
$$('[data-open]').forEach((button) =>
  button.addEventListener('click', () => showDialog(button.dataset.open)),
);
$$('[data-close]').forEach((button) =>
  button.addEventListener('click', () => closeDialog(button.closest('dialog'))),
);
$$('dialog').forEach((dialog) =>
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (dialog.id === 'results-dialog') return;
    if (dialog.id === 'settings-dialog' && pausePanel !== 'root') { showPausePanel('root'); return; }
    if (dialog.id === 'lobby-dialog') returnToMenu();
    else closeDialog(dialog);
  }),
);
$$('#camera-controls [data-camera]').forEach((button) =>
  button.addEventListener('click', () =>
    setCamera(Number(button.dataset.camera)),
  ),
);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (!$('dialog[open]')) {
      event.preventDefault();
      openSettings();
    }
    return;
  }
  if (
    mode === 'menu' ||
    $('dialog[open]') ||
    event.target.matches('input,select,textarea')
  )
    return;
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
    event.preventDefault();
    setCamera(Number(event.code.at(-1)));
    return;
  }
  if (event.code.startsWith('Arrow')) {
    event.preventDefault();
    if (event.repeat) return;
    if (!lookKeys.has(event.code)) lookKeyAt.set(event.code, event.timeStamp);
    lookKeys.add(event.code);
    if (evadeQueue.length || [...sources.values()].some(value => ['dodge', 'vanish'].includes(value.action))) {
      chordKeys.add(event.code);
      for (const gesture of evadeQueue) gesture.arrows.add(event.code);
    }
    return;
  }
  if (event.code === 'Home') {
    event.preventDefault();
    Object.assign(cameraLook, { yaw: 0, pitch: .2, manual: false });
    movementBasis = null;
    return;
  }
  const action = keymap[event.code];
  if (!action) return;
  event.preventDefault();
  if (!event.repeat) press(`key:${event.code}`, action, event.timeStamp);
});
window.addEventListener('keyup', (event) => {
  lookKeys.delete(event.code);
  lookKeyAt.delete(event.code);
  chordKeys.delete(event.code);
  if (keymap[event.code]) release(`key:${event.code}`, false, event.timeStamp);
});
$$('#battle [data-action]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || button.closest('#thumbpad')) return;
    syncInputContext();
    if (!canInput() && !(button.dataset.action === 'targetNext' && watching())) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointerCaptures.set(event.pointerId, button);
    press(`pointer:${event.pointerId}`, button.dataset.action, event.timeStamp);
  });
  button.addEventListener('pointerup', (event) =>
    release(`pointer:${event.pointerId}`, false, event.timeStamp),
  );
  button.addEventListener('pointercancel', (event) =>
    release(`pointer:${event.pointerId}`, true),
  );
  button.addEventListener('lostpointercapture', (event) =>
    release(`pointer:${event.pointerId}`, true),
  );
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const action = button.dataset.action;
    if (['guard', 'power', 'grab', 'charge'].includes(action)) {
      const source = `accessible:${action}`;
      if (sources.has(source)) release(source);
      else press(source, action);
    } else {
      press('accessible:tap', action);
      release('accessible:tap');
    }
  });
});
$('#look-pad').addEventListener('pointerdown', (event) => {
  if (mode === 'menu' || $('dialog[open]') || lookPointer) return;
  event.preventDefault();
  lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  $('#look-pad').setPointerCapture(event.pointerId);
  pointerCaptures.set(event.pointerId, $('#look-pad'));
});
$('#look-pad').addEventListener('pointermove', (event) => {
  if (lookPointer?.id !== event.pointerId) return;
  turnCamera((lookPointer.x - event.clientX) * .008, (event.clientY - lookPointer.y) * .008);
  lookPointer.x = event.clientX; lookPointer.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('#look-pad').addEventListener(type, () => { lookPointer = null; });
}
function movePad(event) {
  const box = $('#thumbpad').getBoundingClientRect();
  const x = (event.clientX - box.x - box.width / 2) / (box.width * 0.4),
    y = (event.clientY - box.y - box.height / 2) / (box.height * 0.4);
  const length = Math.hypot(x, y),
    scale = Math.max(1, length);
  padX = length < 0.15 ? 0 : x / scale;
  padY = length < 0.15 ? 0 : y / scale;
  if (padX || padY) movementBasis ||= world.movementBasis();
  else if (![...sources.values()].some(v => ['forward','back','left','right'].includes(v.action))) movementBasis = null;
  networkDirty = true;
}
$('#thumbpad').addEventListener('pointerdown', (event) => {
  if (!canInput() || padPointer !== null) return;
  event.preventDefault();
  padPointer = event.pointerId;
  $('#thumbpad').setPointerCapture(event.pointerId);
  pointerCaptures.set(event.pointerId, $('#thumbpad'));
  $('#thumbpad').classList.add('held');
  movePad(event);
});
$('#thumbpad').addEventListener('pointermove', (event) => {
  if (padPointer === event.pointerId) movePad(event);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('#thumbpad').addEventListener(type, (event) => {
    if (padPointer !== event.pointerId) return;
    padPointer = null;
    padX = padY = 0;
    if (![...sources.values()].some(v => ['forward','back','left','right'].includes(v.action))) movementBasis = null;
    networkDirty = true;
    $('#thumbpad').classList.remove('held');
  });
$('#arena').addEventListener('pointerdown', (event) => {
  if (
    (event.pointerType === 'touch' && !activeClash()) ||
    ![0, 2].includes(event.button) ||
    !canInput()
  )
    return;
  event.preventDefault();
  syncInputContext();
  if (event.pointerType !== 'touch' && !mouseLooking && (cameraMode === 2 || cameraMode === 4)) {
    mouseLooking = true;
    mouseLast = {x:event.clientX,y:event.clientY};
    turnCamera(0,0);
    try { const request = $('#arena').requestPointerLock?.(); request?.catch?.(() => {}); } catch { /* Drag-free look also works without pointer lock in embedded browsers. */ }
    return;
  }
  $('#arena').setPointerCapture(event.pointerId);
  pointerCaptures.set(event.pointerId, $('#arena'));
  press(`arena:${event.pointerId}`, event.button === 2 ? 'heavy' : activeClash() ? 'guard' : 'light', event.timeStamp);
});
window.addEventListener('pointermove', event => {
  if (!mouseLooking || !canInput() || ![2,4].includes(cameraMode) || event.pointerType === 'touch') return;
  const locked = document.pointerLockElement === $('#arena');
  if (!locked && event.target !== $('#arena')) { mouseLast = null; return; }
  const dx = locked ? event.movementX : mouseLast ? event.clientX-mouseLast.x : 0;
  const dy = locked ? event.movementY : mouseLast ? event.clientY-mouseLast.y : 0;
  mouseLast = {x:event.clientX,y:event.clientY};
  // Screen-right mouse movement rotates the viewing direction to screen right.
  turnCamera(-clamp(dx,-100,100)*.003, clamp(dy,-100,100)*.0025);
});
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('mouse-locked', !!document.pointerLockElement);
  if (!document.pointerLockElement && mouseLooking) {
    mouseLooking = false; mouseLast = null; clearInput();
    if (canInput()) openSettings();
  }
});
window.addEventListener('pointerup', (event) => {
  release(`arena:${event.pointerId}`, false, event.timeStamp);
  pointerCaptures.delete(event.pointerId);
});
window.addEventListener('pointercancel', () => clearInput());
$('#arena').addEventListener('lostpointercapture', event => release(`arena:${event.pointerId}`, true));
$('#arena').addEventListener('contextmenu', (event) => {
  if (mode !== 'menu') event.preventDefault();
});
window.addEventListener('blur', () => {
  clearInput();
  persona.cancel();
  if ($('#showcase-dialog').open) $('#showcase-video').pause();
  if (
    mode !== 'menu' &&
    mode !== 'network' &&
    !resultShown &&
    !$('dialog[open]')
  )
    openSettings();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInput();
    persona.cancel();
    $('#showcase-video').pause();
  }
});
window.addEventListener('pagehide', () => {
  disconnect();
  audio.dispose();
  persona.dispose();
  world?.dispose();
  void replayStore.dispose().catch(() => {});
});

try {
  world = createWorld($('#arena'), ROSTER);
  world.configure(presentation);
  for (const [index, fighter] of ROSTER.entries()) {
    portraits.set(fighter.id, world.portrait(fighter.id));
    const button = document.createElement('button');
    button.className = 'fighter-card';
    button.dataset.fighter = fighter.id;
    button.setAttribute('aria-label', `Select ${fighter.name}`);
    button.innerHTML = `<small>${String(index + 1).padStart(2, '0')}</small><img src="${portraits.get(fighter.id)}" alt="" draggable="false"><strong>${escapeHTML(fighter.name)}</strong>`;
    button.addEventListener('click', () => {
      selectFighter(fighter.id);
      audio.click();
      closeDialog($('#roster-dialog'));
    });
    $('#roster').append(button);
    const rivalButton = document.createElement('button');
    rivalButton.className = 'fighter-card';
    rivalButton.dataset.rival = fighter.id;
    rivalButton.setAttribute('aria-label', `Rival ${fighter.name}`);
    rivalButton.innerHTML = `<img src="${portraits.get(fighter.id)}" alt="" /><strong>${escapeHTML(fighter.name)}</strong>`;
    rivalButton.addEventListener('click', () => {
      opponent = fighter.id;
      closeDialog($('#rival-dialog'));
      restorePreview();
    });
    $('#rival-grid').append(rivalButton);
    for (const select of $$(
      '#lobby-fighter, #opponent-select, #intel-fighter, #training-fighter-select, #training-live-fighter',
    )) {
      const option = document.createElement('option');
      option.value = fighter.id;
      option.textContent = fighter.name;
      select.append(option);
    }
  }
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 320;
  thumbnail.height = 180;
  const context = thumbnail.getContext('2d');
  for (const stage of STAGES) {
    const scene = createMatch(selected, opponent, { stage: stage.id });
    world.update(scene, 0.1, {
      menu: false,
      reduced: true,
      stage: stage.id,
      cameraMode: 1,
    });
    context.drawImage($('#arena'), 0, 0, 320, 180);
    const image = thumbnail.toDataURL('image/jpeg', 0.78);
    stageImages.set(stage.id, image);
    const button = document.createElement('button');
    button.className = 'stage-card';
    button.dataset.stage = stage.id;
    button.innerHTML = `<img src="${image}" alt="${escapeHTML(stage.name)} actual rendered arena"><b>${escapeHTML(stage.name)}</b><small>${escapeHTML(stage.description)}</small>`;
    button.addEventListener('click', () => {
      chooseStage(stage.id);
      closeDialog($('#stages-dialog'));
    });
    $('#stage-grid').append(button);
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = stage.name;
    $('#lobby-stage').append(option);
  }
  $$('[data-mode]').forEach((button, index) => {
    const stage = STAGES[(index * 2 + 1) % STAGES.length];
    if (!button.querySelector('img')) return;
    button.querySelector('img').src = stageImages.get(stage.id);
    button.querySelector('img').alt = `${stage.name}, rendered in-game preview`;
  });
  updateMenu();
  updateSound();
  setMode('story');
  setCamera(2);
  document.body.classList.toggle('reduced-effects', reduced);
  $('#training-fighter-select').value = $('#training-live-fighter').value = trainingFighter;
  void replayStore.list().then(() => {
    $('#replay-storage').textContent = replayStore.status().message;
  }).catch(error => {
    $('#replay-storage').textContent = `Storage unavailable (${error.code || 'ERROR'}): ${error.message}`;
  });
  if (!multiplayerEnabled) {
    $('.friend-actions > span').textContent = 'Story · duels · tournaments · local AI';
    $('#online-open').disabled = true;
    $('#online-open').textContent = 'ONLINE · UNAVAILABLE';
    $('#online-open').title = 'This edition has no multiplayer server connected.';
    for (const button of $$('#create-room, #join-room, #join-submit, #quick-match, #pool-match, #leaderboard-open')) {
      button.disabled = true;
      button.title = 'Online friend rooms need the separate multiplayer server.';
    }
  }
  $('#menu').hidden = false;
  $('#loading').hidden = true;
  // Diagnostics are snapshots only. Gameplay can only be changed through real UI/input.
  Object.defineProperty(window, '__UC__', {
    value: Object.freeze({
      ready: true,
      snapshot: () => clone(state),
      mode: () => mode,
      room: () => clone(room),
      stats: () => clone(world.stats()),
      cup: () => clone(cup),
      persona: () => clone(persona.status()),
      training: () => clone(training?.lesson),
      tutorial: () => ({ step: tutorial ? TUTORIAL_STEPS[tutorial.index] : null, complete: tutorialComplete, intent: clone(tutorial?.intent) }),
      matchmaking: () => clone(matchmaking),
      backendOrigin: () => backendOrigin,
      socketURL: () => socketURL,
      pool: () => ({ mode:room?.mode || matchmaking.mode, localSlot, humans:room?.players.filter(player => player.connected).length || 0, spectating:watching(), canInput:canInput() }),
      series: () => clone(series),
      selection: () => clone({ fighter:selected, opponent, mode:selectedMode, pendingSeries, pendingPit }),
      launch: () => ({ mode, seed:launchSeed }),
      input: () => clone({ sources:[...sources.values()].map(v => v.action), pending:[...pending], edges:[...previousEdges], evade:evadeQueue.length, grab:grabQueue.length, power:powerGesture, arrows:[...lookKeys], chord:[...chordKeys], pad:[padX,padY], drop:dropPending, lastSample, clashId:activeClash()?.id ?? -1 }),
      readiness: () => ({ transform:transformEligible(state.fighters[localSlot]) }),
      aura: () => ({ local:state.fighters[localSlot]?.aura || 0, series:series?.aura || 0, best:seriesBest, leaderboard:clone(leaderboard) }),
       preview: () => ({ mode:modePreview?.mode || null, seed:modePreview?.seed, stage:modePreview?.state.stage || menuState.stage, fighters:modePreview?.state.fighters.map(f => ({char:f.char, action:f.action})) || [{char:selected, form:previewForm, action:performance.now() < previewUntil ? 'transform' : menuAction}, {char:menuState.fighters[1].char, form:0, action:'idle'}] }),
      tactics: () => {
        const viewed = modePreview?.state || state;
        return viewed.fighters.map((_, slot) => getAITactics(viewed, slot));
      },
      movementBasis: () => clone(movementBasis),
      cameraLook: () => clone(cameraLook),
      presentation: () => clone(presentation),
      loadout: () => [...loadout],
      camera: () => cameraMode,
      replay: () => ({ recording:!!recorder, playing:!!replay?.playing, time:replay?.time || 0, duration:replay?.clip.duration || 0, clipId:replay?.clip.id || null, storage:replayStore.status() }),
    }),
    writable: false,
    configurable: false,
  });
  const invite = new URLSearchParams(location.search).get('room');
  if (multiplayerEnabled && invite && /^[A-Z0-9]{6}$/i.test(invite)) {
    $('#room-input').value = invite.toUpperCase();
    showDialog('join-dialog');
  }
  requestAnimationFrame(frame);
} catch (error) {
  $('#loading strong').textContent = 'THE ARENA COULD NOT START';
  $('#loading-status').textContent =
    `${error.message} Reload after the local modules finish updating.`;
  $('.loading-ring').style.animation = 'none';
  console.error(error);
}

import { createMatch, stepMatch, ROSTER, MAX_HP } from './combat.mjs';

export const DRILLS = Object.freeze([
  { id:'move', title:'Move', prompt:'Move 3 meters', hint:'Use WASD or the direction pad. Cover three meters.', action:'move', key:'WASD', goal:3 },
  { id:'look', title:'Look', prompt:'Turn the view', hint:'Click the arena, then move your mouse. Esc releases the pointer and pauses. On touch, drag LOOK. H picks another rival and recenters.', action:'look', key:'MOUSE', goal:.3 },
  { id:'combo', title:'Launcher', prompt:'Strike. Strike. Heavy.', hint:'J, J, K or click twice, then right-click. Queue the next strike during recovery.', action:'light', key:'J J K', goal:3 },
  { id:'dodge', title:'Evade', prompt:'Evade the warning', hint:'Q + Arrows chooses an escape direction without turning the view, in either key order. Shift remains an alternate. Z teleports up to 6m in your viewing direction for 16 Ki (2s cooldown). Evade a real hit for up to 4 defensive ki, then counter; charging never earns resolve.', action:'dodge', key:'Q', goal:2 },
  { id:'guard', title:'Guard', prompt:'Block the shot', hint:'Hold C or Guard. Front-block a real shot for up to 4 defensive ki; empty guarding earns none. During a beam clash, C or held primary pointer braces; X or J taps boost.', action:'guard', key:'C', goal:1 },
  { id:'blast', title:'Blast', prompt:'Tap to hit', hint:'Tap L or Ki blast. A shot costs 8 Ki. X also fires when no object is nearby; a highlighted object makes X pick it up instead.', action:'blast', key:'L', goal:1 },
  { id:'beam', title:'Beam', prompt:'Press U to fire a beam', hint:'U fires a beam for 35 Ki. V fires an ultimate for 100 Ki. The Ki blast button can also be held for 0.35s or 1.2s, then released. In a real beam clash, X or J taps boost instead; C or held primary pointer braces. No repeat-key farming.', action:'beam', key:'U', goal:1 },
  { id:'special', title:'Technique', prompt:'Land your technique', hint:'Press F or Technique. Every fighter has a different timing and range.', action:'special', key:'F', goal:1 },
  { id:'transform', title:'Power', prompt:'Land hits first', hint:'Land hits to earn Resolve. T refills Ki. Both meters must be ready, then press R. The form path shows every threshold and each form’s Ki upkeep.', action:'power', key:'R', goal:1 },
  { id:'flight', title:'Flight', prompt:'Press Space to fly', hint:'Press Space to enter flight. E rises, C descends. Press Space again to land. T charges while hovering still.', action:'power', key:'SPACE', goal:1 },
  { id:'charge', title:'Recharge', prompt:'Hold T until you reach 80 Ki', hint:'Stop moving and hold T. Charging fills Ki, not Resolve. Let go before attacking.', action:'charge', key:'T', goal:80 },
  { id:'blink', title:'Aimed teleport', prompt:'Look, then press Z', hint:'Click the arena and look toward an open space. Press Z to teleport up to 6m in that direction. It costs 16 Ki and has a 2s cooldown.', action:'vanish', key:'Z', goal:1 },
  { id:'prop', title:'The arena is your weapon', prompt:'Tap X to pick up. Tap again to throw.', hint:'The highlighted object is in reach. X spends 10 Ki to lift it. Aim with the mouse, then tap X again to throw. You can hold it until you are ready.', action:'context', key:'X', goal:2 },
  { id:'clash', title:'Clash', prompt:'Press U to meet the dummy’s beam', hint:'The dummy answers your beam with a real beam. Once they meet, tap X or J on the cue to spend Ki boosting, or hold C to brace. Hold T to recharge between clashes.', action:'beam', key:'U', goal:1 },
].map(Object.freeze));

export const TUTORIAL_STEPS = Object.freeze(['move', 'look', 'combo', 'guard', 'blast', 'charge', 'blink', 'prop', 'transform', 'flight']);

// Camera observation belongs to the local lesson, never authoritative combat input.
export function recordTrainingLook(session, delta) {
  const lesson = session?.lesson;
  if (lesson?.id !== 'look' || lesson.complete || !Number.isFinite(delta)) return;
  lesson.progress = Math.min(lesson.goal, lesson.progress + Math.abs(delta));
  if (lesson.progress >= lesson.goal) {
    lesson.complete = true;
    lesson.successText = 'View turned';
  }
}

export function createTraining(fighter = 'goku', drill = 'move', options = {}) {
  const id = DRILLS.some((item) => item.id === drill) ? drill : 'move';
  const character = ROSTER.some((item) => item.id === fighter) ? fighter : 'goku';
  const definition = DRILLS.find((item) => item.id === id);
  const state = createMatch(character, character === 'goku' ? 'vegeta' : 'goku', {
    stage: options.stage || 'time-chamber', training: true, difficulty:'easy',
    loadouts:[options.loadout || []], tints:[options.tint || '#ffc45b'],
  });
  state.phase = 'fight'; state.phaseTime = 0; state.timer = 90;
  const [player, dummy] = state.fighters;
  const ranged = ['guard','blast','beam','clash','transform','flight','move','look'].includes(id);
  player.x = ranged ? -2.5 : -.55; dummy.x = ranged ? 2.5 : .55;
  if (id === 'dodge') { player.x = -1; dummy.x = 1; }
  player.energy = id === 'charge' ? 12 : id === 'transform' ? 40 : ['guard', 'dodge'].includes(id) ? 60 : 100;
  player.resolve = 0;
  if (id === 'prop') { Object.assign(state.props[0],{x:player.x+2,y:.9,z:player.z+1}); }
  else state.props = [];
  if (id === 'clash') dummy.energy = 100;
  return { state, options, respawnIn:0, lastDummyHP:dummy.maxHp || MAX_HP, lesson:{ id, title:definition.title, progress:0, goal:definition.goal, complete:false, elapsed:0, lastEvent:0, lastX:player.x, lastZ:0, successText:'', dodges:0, damage:0 } };
}

// A fresh engine state also gets fresh private combat data. Never copy it over an
// old state: the engine keeps private channels keyed by the state object itself.
export function resetTraining(session, fighter = null) {
  const fresh = createTraining(fighter || session.state.fighters[0].char, session.lesson.id, session.options);
  if (!fighter) Object.assign(fresh.lesson, session.lesson, {
    lastEvent:0, lastX:fresh.state.fighters[0].x, lastZ:0, elapsed:0,
  });
  Object.assign(session, fresh);
  return session;
}

export function stepTraining(session, input = {}, dt = 1/60) {
  if (!session?.state?.training || !Number.isFinite(dt) || dt <= 0) return session;
  dt = Math.min(dt,.1);
  const { state, lesson } = session;
  if (state.phase !== 'fight') {
    session.respawnIn = Math.max(0, session.respawnIn - dt);
    if (session.respawnIn === 0) resetTraining(session);
    return session;
  }
  const [player,dummy] = state.fighters;
  lesson.elapsed += dt;
  // Training is local-only: protect the learner and use a predictable sparring
  // partner. The same authoritative attacks/guards/combos still resolve each hit.
  state.timer = 90;
  player.hp = player.maxHp || MAX_HP;
  if (!['charge', 'transform', 'guard', 'dodge', 'clash'].includes(lesson.id)) player.energy = 100;
  if (lesson.id !== 'clash') dummy.energy = 100;
  const cycle = lesson.elapsed % 2;
  const dummyInput = lesson.id === 'guard' ? { blast:cycle > .8 && cycle < .9 }
    : lesson.id === 'dodge' ? { heavy:cycle > .8 && cycle < .9 }
    : lesson.id === 'clash' ? { beam:player.action === 'beam', charge:player.action !== 'beam' && !(dummy.clashId >= 0) } : {};
  stepMatch(state,[input,dummyInput],dt);
  if (state.phase !== 'fight') session.respawnIn = 2;
  lesson.damage += Math.max(0, (session.lastDummyHP ?? (dummy.maxHp || MAX_HP)) - dummy.hp);
  session.lastDummyHP = dummy.hp;
  if (lesson.complete) return session;
  if (lesson.id === 'move') {
    lesson.progress = Math.min(lesson.goal, lesson.progress + Math.hypot(player.x - lesson.lastX,player.z - lesson.lastZ));
  }
  lesson.lastX = player.x; lesson.lastZ = player.z;
  if (lesson.id === 'charge') lesson.progress = Math.min(lesson.goal,player.energy);
  if (lesson.id === 'combo') lesson.progress = Math.max(lesson.progress,Math.min(2,player.combo));
  for (const event of state.events) {
    if (event.id <= lesson.lastEvent) continue;
    lesson.lastEvent = event.id;
    if (lesson.id === 'combo' && event.type === 'combo' && event.owner === 0 && event.kind === 'launcher') lesson.progress = 3;
    if (lesson.id === 'dodge' && event.type === 'dodge' && event.owner === 0 && event.kind === 'perfect') lesson.progress = ++lesson.dodges;
    if (lesson.id === 'guard' && event.type === 'block' && event.target === 0) lesson.progress = 1;
    if (['blast','beam'].includes(lesson.id) && event.type === 'hit' && event.owner === 0 && event.kind === lesson.id) lesson.progress = 1;
    if (lesson.id === 'special' && event.type === 'hit' && event.owner === 0 && event.kind === 'special' && !event.prop) lesson.progress = 1;
    if (lesson.id === 'transform' && event.type === 'transform' && event.owner === 0) lesson.progress = 1;
    if (lesson.id === 'blink' && event.type === 'dodge' && event.owner === 0 && event.evadeKind === 'vanish') lesson.progress = 1;
    if (lesson.id === 'prop' && event.type === 'prop' && event.owner === 0) lesson.progress = Math.max(lesson.progress,event.kind === 'throw' ? 2 : event.kind === 'lift' ? 1 : 0);
    if (lesson.id === 'flight' && event.type === 'flight' && event.owner === 0 && event.kind === 'on') lesson.progress = 1;
    if (lesson.id === 'clash' && event.type === 'clash' && event.kind === 'start' && (event.owner === 0 || event.target === 0)) lesson.progress = 1;
  }
  if (lesson.progress >= lesson.goal) {
    lesson.progress = lesson.goal; lesson.complete = true;
    lesson.successText = lesson.id === 'combo' ? 'Launcher landed' : lesson.id === 'transform' ? 'Power earned' : lesson.id === 'clash' ? 'Real beams met / controlled training' : 'Complete';
  }
  return session;
}

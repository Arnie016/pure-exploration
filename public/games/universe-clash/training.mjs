import { createMatch, stepMatch, ROSTER, MAX_HP } from './combat.mjs';

export const DRILLS = Object.freeze([
  { id:'move', title:'Move', prompt:'Move 3 meters', hint:'Use WASD or the direction pad. Cover three meters.', action:'move', key:'WASD', goal:3 },
  { id:'look', title:'Look', prompt:'Turn the view', hint:'Hold an arrow key or drag the LOOK pad. H or Tab changes target and recenters; Home only recenters.', action:'look', key:'ARROWS', goal:.3 },
  { id:'combo', title:'Launcher', prompt:'Strike. Strike. Heavy.', hint:'J, J, K or click twice, then right-click. Queue the next strike during recovery.', action:'light', key:'J J K', goal:3 },
  { id:'dodge', title:'Evade', prompt:'Evade the warning', hint:'Q + Arrows chooses an escape direction without turning the view, in either key order. Shift remains an alternate. Z is a committed 2.4m blink for 16 ki. Evade a real hit for up to 4 defensive ki, then counter; charging never earns resolve.', action:'dodge', key:'Q', goal:2 },
  { id:'guard', title:'Guard', prompt:'Block the shot', hint:'Hold C or Guard. Front-block a real shot for up to 4 defensive ki; empty guarding earns none. During a beam clash, C or held primary pointer braces; X or J taps boost.', action:'guard', key:'C', goal:1 },
  { id:'blast', title:'Blast', prompt:'Tap to hit', hint:'Tap X or Blast. Your target is five meters away. A quick shot costs 8 ki.', action:'blast', key:'X', goal:1 },
  { id:'beam', title:'Beam', prompt:'Hold 0.35s. Release.', hint:'Hold X for 0.35s for a beam (35 ki), or 1.2s for an ultimate (100 ki). In a real beam clash, X or J taps boost instead; C or held primary pointer braces. No repeat-key farming.', action:'beam', key:'X', goal:1 },
  { id:'special', title:'Technique', prompt:'Land your technique', hint:'Press F or Technique. Every fighter has a different timing and range.', action:'special', key:'F', goal:1 },
  { id:'transform', title:'Power', prompt:'Land hits first', hint:'Hits earn resolve; T charges ki only. Press R when TRANSFORM READY, or hold Space at least 0.6s to transform while held. Release before trying another form.', action:'power', key:'R', goal:1 },
  { id:'flight', title:'Flight', prompt:'Double-tap to fly', hint:'Tap Space twice within 320ms. E rises, C descends. Double-tap Space again to land. Double-E is also supported.', action:'power', key:'SPACE', goal:1 },
  { id:'clash', title:'Clash', prompt:'Hold X 0.35s, then release', hint:'Controlled sparring, not a human match. The dummy answers your visible beam with a real beam. Once they meet: tap X or J on the cue to spend ki boosting, or hold C / primary pointer to brace. No ki refills during this drill; T recharges between clashes.', action:'energy', key:'X', goal:1 },
].map(Object.freeze));

export const TUTORIAL_STEPS = Object.freeze(['move', 'look', 'dodge', 'blast', 'transform', 'flight']);

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
  player.energy = id === 'transform' ? 40 : ['guard', 'dodge'].includes(id) ? 60 : 100;
  player.resolve = 0;
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
  if (!['transform', 'guard', 'dodge', 'clash'].includes(lesson.id)) player.energy = 100;
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
    if (lesson.id === 'flight' && event.type === 'flight' && event.owner === 0 && event.kind === 'on') lesson.progress = 1;
    if (lesson.id === 'clash' && event.type === 'clash' && event.kind === 'start' && (event.owner === 0 || event.target === 0)) lesson.progress = 1;
  }
  if (lesson.progress >= lesson.goal) {
    lesson.progress = lesson.goal; lesson.complete = true;
    lesson.successText = lesson.id === 'combo' ? 'Launcher landed' : lesson.id === 'transform' ? 'Power earned' : lesson.id === 'clash' ? 'Real beams met / controlled training' : 'Complete';
  }
  return session;
}

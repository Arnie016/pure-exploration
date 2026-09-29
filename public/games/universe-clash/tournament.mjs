import { ROSTER, FORMS, STAGES } from './catalog.mjs';

const fighters = new Map(ROSTER.map((fighter) => [fighter.id, fighter]));
const styleEdges = {
  adaptive: ['counter', 'assassin'], pressure: ['adaptive', 'efficient'],
  counter: ['rush', 'berserker'], zoner: ['counter', 'berserker'],
  reactive: ['pressure', 'rush'], tactical: ['zoner', 'erratic'],
  rush: ['zoner', 'tactical'], efficient: ['reactive', 'erratic'],
  erratic: ['adaptive', 'assassin'], assassin: ['tactical', 'efficient'],
  berserker: ['pressure', 'reactive'],
};

function random(seed, key = '') {
  let value = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) value = Math.imul(value ^ key.charCodeAt(i), 16777619) >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(ids, rng) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function match(seed, id, a, b, roundLabel) {
  return {
    id, a, b, winner: null,
    stage: STAGES[Math.floor(random(seed, `stage:${id}`)() * STAGES.length)].id,
    roundLabel, simulated: false, resultLabel: null, simulation: null,
  };
}

// Mutators return the same object. All state is JSON-serializable; queries are pure.
export function createTournament(playerId, seed = 1, options = { spectator: false }) {
  if (!fighters.has(playerId)) throw new TypeError('Choose a valid player fighter.');
  if (!Number.isSafeInteger(seed)) throw new TypeError('Seed must be a safe integer.');
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || (options.spectator !== undefined && typeof options.spectator !== 'boolean')) {
    throw new TypeError('Options must contain a boolean spectator flag.');
  }
  seed = seed >>> 0;
  const entrants = shuffled(ROSTER.map((f) => f.id), random(seed, 'entrants'));
  const firstRound = Array.from({ length: 8 }, (_, i) =>
    match(seed, `R16${i + 1}`, entrants[i * 2], entrants[i * 2 + 1], `Round of 16 - Match ${i + 1}`));
  const spectator = options.spectator ?? false;
  return {
    playerId: spectator ? null : playerId, participantId: playerId, seed, spectator,
    phase: 'knockout', bracket: [firstRound], roundIndex: 0,
    champion: null, eliminated: false, clock: 0, feed: [],
  };
}

function advance(cup) {
  if (cup.phase === 'complete') return false;
  const round = cup.bracket[cup.roundIndex];
  if (round.some((game) => game.winner === null)) return false;
  const winners = round.map((game) => game.winner);
  if (round.length === 1) {
    cup.champion = winners[0];
    cup.phase = 'complete';
    cup.clock = 0;
  } else {
    const [prefix, label] = round.length === 8 ? ['QF', 'Quarterfinal']
      : round.length === 4 ? ['SF', 'Semifinal'] : ['F', 'Final'];
    cup.bracket.push(Array.from({ length: winners.length / 2 }, (_, i) => match(cup.seed,
      `${prefix}${i + 1}`, winners[i * 2], winners[i * 2 + 1], label === 'Final' ? label : `${label} ${i + 1}`)));
    cup.roundIndex++;
  }
  return true;
}

export function nextPlayerMatch(cup) {
  if (cup.eliminated || cup.phase === 'complete') return null;
  const game = cup.bracket[cup.roundIndex].find((item) => item.winner === null
    && (cup.spectator || item.a === cup.playerId || item.b === cup.playerId));
  if (!game) return null;
  // Preserve bracket sides. The client plays playerId in combat slot 0 and must
  // map the combat winner back to a fighter ID, never send a slot number here.
  const { id, a, b, stage, roundLabel } = game;
  return { id, a, b, stage, roundLabel };
}

export function recordPlayerMatch(cup, winnerId) {
  const pending = nextPlayerMatch(cup);
  if (!pending) throw new Error('No player match is ready. Wait for pending CPU matches.');
  if (winnerId !== pending.a && winnerId !== pending.b) throw new TypeError('Winner must be a fighter ID in the current player match.');
  const game = cup.bracket[cup.roundIndex].find((item) => item.id === pending.id);
  finishMatch(cup, game, winnerId);
  return cup;
}

function finishMatch(cup, game, winnerId, simulation = null) {
  game.winner = winnerId;
  game.simulated = simulation !== null;
  game.resultLabel = game.simulated ? 'SIMULATED' : 'PLAYED';
  game.simulation = simulation;
  const loser = winnerId === game.a ? game.b : game.a;
  if (loser === cup.playerId) cup.eliminated = true;
  cup.feed.push({ id: game.id, winner: winnerId, loser, roundLabel: game.roundLabel });
  if (cup.feed.length > 12) cup.feed.splice(0, cup.feed.length - 12);
  advance(cup);
}

function pendingCPU(cup, lockedMatchId = null) {
  if (cup.phase === 'complete') return null;
  return cup.bracket[cup.roundIndex].find((game) => game.winner === null
    && game.id !== lockedMatchId && game.a !== cup.playerId && game.b !== cup.playerId);
}

function simulateMatch(cup, game) {
  const [a, b] = [fighters.get(game.a), fighters.get(game.b)];
  const advantage = Number(styleEdges[a.ai]?.includes(b.ai) || false) - Number(styleEdges[b.ai]?.includes(a.ai) || false);
  // Balance ratings and a counter-style edge, not canonical power scaling or combat.
  const weights = [a, b].map((f, i) => {
    const fitness = 0.94 + random(cup.seed, `fitness:${f.id}`)() * 0.12;
    const style = 1 + (i ? -advantage : advantage) * 0.16;
    return (f.rating * f.power * Math.sqrt(f.speed / 7) * fitness * style) ** 2;
  });
  const chanceA = weights[0] / (weights[0] + weights[1]);
  // Fixture-keyed draws survive locks, human pacing and JSON round trips.
  const roll = random(cup.seed, `result:${game.id}:${game.a}:${game.b}`)();
  finishMatch(cup, game, roll < chanceA ? game.a : game.b, { weights, chanceA, roll });
}

export function simulatePending(cup) {
  let game;
  while ((game = pendingCPU(cup))) simulateMatch(cup, game);
  cup.clock = 0;
  return cup;
}

export function tickTournament(cup, dt, lockedMatchId = null) {
  if (cup.phase === 'complete' || !Number.isFinite(dt) || dt <= 0) return cup;
  // clock is residual active CPU time, not wall time. Blocked time is discarded
  // so waiting at a human/featured gate cannot bank an instant next-round result.
  cup.clock += Math.min(dt, 30);
  let game;
  while ((game = pendingCPU(cup, lockedMatchId))) {
    const resolved = cup.bracket.flat().filter((item) => item.simulated).length;
    const delay = 2 + random(cup.seed, `cadence:${resolved}`)() * 2;
    if (cup.clock + 1e-9 < delay) break;
    cup.clock = Math.max(0, cup.clock - delay);
    simulateMatch(cup, game);
  }
  if (!game || cup.phase === 'complete') cup.clock = 0;
  return cup;
}

export function createLadder(playerId, options = {}) {
  if (!fighters.has(playerId)) throw new TypeError('Choose a valid player fighter.');
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => !['count', 'seed'].includes(key))) throw new TypeError('Ladder options must contain count and seed.');
  const { count = 12, seed = 1 } = options;
  if (!Number.isInteger(count) || count < 1 || count > ROSTER.length - 1) throw new RangeError('Ladder count must be 1..15.');
  if (!Number.isSafeInteger(seed)) throw new TypeError('Seed must be a safe integer.');
  const opponents = ROSTER.filter((f) => f.id !== playerId)
    .sort((a, b) => a.rating * a.power - b.rating * b.power)
    .slice(0, count).map((f) => f.id);
  // Vary each new run without turning the escalating ladder into a random boss rush.
  const bandSize = Math.ceil(count / 3), rng = random(seed >>> 0, `ladder:${playerId}`);
  for (let i = 0; i < count; i += bandSize) opponents.splice(i, bandSize, ...shuffled(opponents.slice(i, i + bandSize), rng));
  return { playerId, opponents, index: 0, wins: 0, complete: false, failed: false, progression: { form: 0, mastery: 0 } };
}

export function nextLadderMatch(ladder) {
  if (ladder.failed || ladder.complete || ladder.index >= ladder.opponents.length) return null;
  return {
    a: ladder.playerId, b: ladder.opponents[ladder.index],
    stage: STAGES[ladder.index % STAGES.length].id,
    roundLabel: `Ladder ${ladder.index + 1} / ${ladder.opponents.length}`,
  };
}

export function recordLadderMatch(ladder, won, progression = ladder.progression) {
  if (!nextLadderMatch(ladder)) throw new Error('No ladder match is ready.');
  if (typeof won !== 'boolean') throw new TypeError('Ladder result must be a boolean.');
  if (!progression || Array.isArray(progression) || typeof progression !== 'object'
    || Object.keys(progression).some((key) => key !== 'form' && key !== 'mastery')
    || !Number.isInteger(progression.form) || progression.form < 0 || progression.form >= FORMS[ladder.playerId].length
    || !Number.isFinite(progression.mastery) || progression.mastery < 0 || progression.mastery > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('Progression must contain a valid form index and finite nonnegative mastery.');
  }
  if (!won) {
    ladder.failed = true;
    return ladder;
  }
  ladder.progression = { form: progression.form, mastery: progression.mastery };
  ladder.wins++;
  ladder.index++;
  ladder.complete = ladder.index === ladder.opponents.length;
  return ladder;
}

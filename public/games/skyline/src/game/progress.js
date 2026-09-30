// Achievements + XP levels. Stats come from the run (skill counts, score, zones…);
// unlocks persist in the save and pay out coins.

export const ACHIEVEMENTS = [
  { id: 'first_swing', name: 'First Swing', desc: 'Finish a run.', coins: 50, finishOnly: true, test: (r) => r.dist > 0 },
  { id: 'km1', name: 'Rush Hour', desc: 'Swing 1 km in one run.', coins: 100, test: (r) => r.dist >= 1000 },
  { id: 'km5', name: 'Marathon Swinger', desc: 'Swing 5 km in one run.', coins: 400, test: (r) => r.dist >= 5000 },
  { id: 'score50k', name: 'Headliner', desc: 'Score 50,000 in one run.', coins: 150, test: (r) => r.score >= 50000 },
  { id: 'score250k', name: 'Front Page', desc: 'Score 250,000 in one run.', coins: 500, test: (r) => r.score >= 250000 },
  { id: 'coins200', name: 'Pocket Change', desc: 'Grab 200 coins in one run.', coins: 100, test: (r) => r.coins >= 200 },
  { id: 'chain5k', name: 'Chain Reaction', desc: 'Bank a 5,000 skill chain.', coins: 150, test: (r) => r.bestChain >= 5000 },
  { id: 'chain20k', name: 'Unbreakable', desc: 'Bank a 20,000 skill chain.', coins: 400, test: (r) => r.bestChain >= 20000 },
  { id: 'perfect10', name: 'Silk Touch', desc: '10 perfect releases in one run.', coins: 200, test: (r) => (r.counts.perfect || 0) >= 10 },
  { id: 'triple', name: 'Triple Threat', desc: 'Pull off a triple jump.', coins: 60, test: (r) => (r.counts.triple || 0) >= 1 },
  { id: 'flip20', name: 'Acrobat', desc: '20 flips in one run.', coins: 150, test: (r) => (r.counts.flip || 0) >= 20 },
  { id: 'thread', name: 'Needle Threader', desc: 'Thread the needle 5 times.', coins: 150, test: (r) => (r.counts.thread || 0) >= 5 },
  { id: 'smash25', name: 'Wrecking Crew', desc: 'Smash 25 things in one run.', coins: 150, test: (r) => (r.counts.smash || 0) >= 25 },
  { id: 'escape', name: 'Not Today', desc: 'Escape the Ink Hound.', coins: 80, test: (r) => (r.counts.escape || 0) >= 1 },
  { id: 'rescue', name: 'Hero of the Block', desc: 'Complete a rescue.', coins: 150, test: (r) => (r.counts.rescue || 0) >= 1 },
  { id: 'mission3', name: 'Case Closed', desc: 'Finish 3 missions in one run.', coins: 300, test: (r) => (r.counts.mission || 0) >= 3 },
  { id: 'green', name: 'Walk in the Park', desc: 'Reach The Green.', coins: 60, test: (r) => r.zones.has('park') },
  { id: 'rift', name: 'Through the Looking Glass', desc: 'Enter Mirror City.', coins: 200, test: (r) => r.zones.has('rift') },
  { id: 'allzones', name: 'Tourist', desc: 'Visit every zone in one run.', coins: 300, test: (r) => r.zones.size >= r.zoneTotal },
  { id: 'office', name: 'Casual Friday', desc: 'Crash through an office window.', coins: 100, test: (r) => (r.counts.crash || 0) >= 1 },
  { id: 'switch', name: 'Switchman', desc: 'Save the train passengers.', coins: 200, test: (r) => (r.counts.switch || 0) >= 1 },
  { id: 'clues3', name: 'Detective', desc: 'Find 3 clue pages in one run.', coins: 150, test: (r) => (r.counts.clue || 0) >= 3 },
  { id: 'photobomb', name: 'Photobomber', desc: 'Crash the film fest.', coins: 100, test: (r) => (r.counts.photobomb || 0) >= 1 },
  { id: 'act2', name: 'Checkpoint!', desc: 'Complete a story act.', coins: 300, test: (r) => (r.counts.checkpoint || 0) >= 1 },
  { id: 'jailbreak', name: 'Jailbreak', desc: 'Run the Iron Isle cell block.', coins: 150, test: (r) => r.zones.has('prison') },
  { id: 'nomiss', name: 'Never Miss', desc: 'Swing 2 km without a missed line.', coins: 250, test: (r) => r.dist >= 2000 && !r.misses },
  { id: 'untouched', name: 'Untouchable', desc: 'Reach 1.5 km without losing a heart.', coins: 250, test: (r) => r.untouchedDist >= 1500 },
  { id: 'lucky', name: 'Feeling Lucky', desc: 'Open 5 mystery boxes in one run.', coins: 120, test: (r) => (r.counts.mystery || 0) >= 5 },
];

/** Total XP needed to reach `level` (level 1 = 0 XP). Gentle curve. */
export const xpFor = (level) => Math.round(400 * (level - 1) ** 1.6);

export function levelOf(xp) {
  let l = 1;
  while (xpFor(l + 1) <= xp) l++;
  return l;
}

/** Award achievements + XP for a finished run. Mutates the save. */
export function settleRun(save, r, live = []) {
  save.achievements ??= [];
  save.xp ??= 0;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    if (live.includes(a.id) || a.test(r)) {
      save.achievements.push(a.id);
      save.bank += a.coins;
      fresh.push(a);
    }
  }
  const lvl0 = levelOf(save.xp);
  const gained = Math.round(r.score / 60 + r.dist / 10 + r.coins * 2 + fresh.length * 150);
  save.xp += gained;
  const lvl1 = levelOf(save.xp);
  const levelBonus = (lvl1 - lvl0) * 250;
  save.bank += levelBonus;
  return { fresh, gained, lvl0, lvl1, levelBonus, xp: save.xp };
}

/** Mid-run check: returns achievements newly met (for a toast), not saved yet. */
export function liveCheck(save, r, already) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (a.finishOnly || already.includes(a.id) || (save.achievements || []).includes(a.id)) continue;
    if (a.test(r)) out.push(a);
  }
  return out;
}

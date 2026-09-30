import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// A production-module regression, without booting the WebGL game or changing saves.
// Optional argument checks a separately hosted production copy of the game.
const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../public/games/skyline/', import.meta.url));
const source = (path) => readFile(resolve(root, path), 'utf8');
const { ACHIEVEMENTS, liveCheck, settleRun } = await import(pathToFileURL(resolve(root, 'src/game/progress.js')));
const { SkillChain } = await import(pathToFileURL(resolve(root, 'src/game/skills.js')));
const run = (extra = {}) => ({ dist: 10, score: 0, coins: 0, bestChain: 0, counts: {}, zones: new Set(['roof']), zoneTotal: 8, misses: 0, untouchedDist: 10, ...extra });
const save = () => ({ achievements: [], xp: 0, bank: 0 });
const ids = (awards) => awards.map((a) => a.id);

for (const dist of [0, 6, 10, 100]) {
  assert.equal(ids(liveCheck(save(), run({dist}), [])).includes('first_swing'), false, 'First Swing requires a finished run, including the 6 m intro start');
}
assert.equal(ids(settleRun(save(), run({dist: 0})).fresh).includes('first_swing'), false, 'An empty run earns no finish achievement');
const finished = save();
assert.deepEqual(ids(settleRun(finished, run()).fresh), ['first_swing']);
assert.equal(finished.bank, 50, 'Finished run pays its achievement once');
assert.deepEqual(ids(settleRun(finished, run()).fresh), []);
assert.equal(finished.bank, 50, 'Repeated settlement cannot repay the achievement');
console.log('PASS: First Swing is finish-only, nonempty, and awarded once.');

const skills = new SkillChain({chain() {}});
for (let i = 0; i < 10; i++) {
  assert.equal(ids(liveCheck(save(), run({counts: skills.counts}), [])).includes('escape'), false, 'Time/distance checks alone do not count as escaping');
}
skills.add('escape');
const escaped = run({counts: skills.counts});
assert.deepEqual(ids(liveCheck(save(), escaped, [])), ['escape']);
assert.deepEqual(ids(liveCheck(save(), escaped, ['escape'])), [], 'Already announced escape is not re-announced');
const escapedSave = save();
assert.deepEqual(ids(settleRun(escapedSave, escaped, ['escape']).fresh), ['first_swing', 'escape']);
assert.deepEqual(ids(liveCheck(escapedSave, escaped, [])), [], 'Saved escape is not re-announced');
skills.reset();
assert.equal(ids(liveCheck(save(), run({counts: skills.counts}), [])).includes('escape'), false, 'Quit/new-run skill reset does not preserve a prior escape');
console.log('PASS: Not Today requires the production escape skill and deduplicates live/saved awards.');

// Execute the actual DOM methods with deterministic timers. Other UI methods
// are left intact but uncalled; no WebGL/encounter dependencies are instantiated.
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    const classes = new Set(['hidden']);
    elements.set(id, {innerHTML: '', offsetWidth: 1, classList: {
      add(...values) { values.forEach((v) => classes.add(v)); },
      remove(...values) { values.forEach((v) => classes.delete(v)); },
      contains(value) { return classes.has(value); },
      toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
    }});
  }
  return elements.get(id);
}
let timerId = 0;
const timers = new Map();
const context = vm.createContext({
  document: {getElementById: element},
  setTimeout(fn, ms) { const id = ++timerId; timers.set(id, {fn, ms}); return id; },
  clearTimeout(id) { timers.delete(id); },
  liveCheck,
});
const uiSource = (await source('src/game/ui.js')).replace(/^import .*;\r?\n/gm, '').replace('export class UI', 'class UI');
const UI = vm.runInContext(`${uiSource}\nUI;`, context);
const ui = Object.create(UI.prototype);
const escape = ACHIEVEMENTS.find((a) => a.id === 'escape');
for (const screen of ['pause', 'title', 'gameover', 'safehouse']) {
  ui.achievement(escape);
  assert.equal(element('ach-toast').classList.contains('hidden'), false);
  assert.equal(timers.get(ui.achT).ms, 4300);
  ui.screen(screen);
  assert.equal(element('ach-toast').classList.contains('hidden'), true, `${screen} dismisses an earlier achievement toast`);
  assert.equal(element('ach-toast').classList.contains('show'), false);
  assert.equal(timers.size, 0, `${screen} cancels the old toast timer`);
  ui.screen(null);
  assert.equal(element('ach-toast').classList.contains('hidden'), true, 'Resuming does not replay a stale achievement');
}
ui.achievement(escape);
const pending = timers.get(ui.achT);
pending.fn(); timers.delete(ui.achT);
assert.equal(element('ach-toast').classList.contains('hidden'), true, 'Active-play toasts still expire normally');
console.log('PASS: Pause/title/results/checkpoint dismiss old toasts and cancel their timers; resume does not replay them.');

const main = await source('src/main.js');
function productionMethod(name) {
  const match = main.match(new RegExp(`^  ${name}\\([^)]*\\) \\{[\\s\\S]*?^  \\}`, 'm'));
  assert.ok(match, `Production method ${name} found`);
  return vm.runInContext(`({${match[0]}}).${name}`, context);
}
const check = productionMethod('checkAchievements');
for (const state of ['paused', 'title', 'safehouse', 'dying', 'gameover']) {
  check.call({state, achCheckT: 0}, 1 / 60);
}
let announcements = 0;
const game = {state:'playing', achCheckT:0, zonesSeen:new Set(), curSeg:{zone:'roof'}, save:save(), liveAch:[], runStats:()=>escaped, ui:{achievement(){announcements++;}}, audio:{play(){}}};
check.call(game, 1/60);
assert.equal(announcements, 1);
assert.deepEqual(game.liveAch, ['escape']);
productionMethod('pause').call({...game, ui, audio:{playing:true}});
assert.equal(element('ach-toast').classList.contains('hidden'), true);
check.call(game, 1);
assert.equal(announcements, 1, 'The same live achievement is never announced twice');
console.log('PASS: Production checks only announce during active play; actual pause uses toast dismissal.');
console.log(`Achievement regression passed against ${root}`);

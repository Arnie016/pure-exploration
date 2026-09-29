// The Web Shop: spend banked coins on permanent upgrades and consumable gadgets.
// Core loop: run -> bank coins -> upgrade -> run longer -> bank more.

export const UPGRADES = [
  { id: 'hearts', name: 'EXTRA HEART', icon: '❤', desc: '+1 heart per run.', max: 2, costs: [1200, 3500] },
  { id: 'magnet', name: 'MAGNET', icon: '🧲', desc: '+2 s magnet time per level.', max: 5, costs: [150, 300, 600, 1000, 1600] },
  { id: 'shield', name: 'SHIELD', icon: '🛡', desc: '+3 s shield time per level.', max: 5, costs: [150, 300, 600, 1000, 1600] },
  { id: 'dash', name: 'SKY DASH', icon: '🚀', desc: '+1 s sky dash per level.', max: 5, costs: [200, 400, 750, 1200, 1900] },
  { id: 'focus', name: 'HERO SENSE', icon: '👁', desc: '+1 s slow-mo per level.', max: 5, costs: [200, 400, 750, 1200, 1900] },
  { id: 'web', name: 'WEB SHOOTERS', icon: '🕸', desc: 'Faster web shots, stronger grapple zip.', max: 4, costs: [250, 600, 1100, 1800] },
  { id: 'coins', name: 'COIN DOUBLER', icon: '🪙', desc: '+20% coins banked per level.', max: 5, costs: [300, 700, 1300, 2200, 3500] },
  { id: 'shock', name: 'SHOCK CORE', icon: '⚡', desc: 'Shockwave charges 12% faster per level.', max: 4, costs: [250, 550, 1000, 1700] },
];

export const GADGETS = [
  { id: 'net', name: 'WEB NET', icon: '🕸', key: 'R', desc: 'Wraps every obstacle ahead in all lanes.', cost: 200 },
  { id: 'smoke', name: 'SMOKE BOMB', icon: '💨', key: 'G', desc: 'The hound loses your scent. Instantly.', cost: 150 },
  { id: 'revive', name: 'SECOND WIND', icon: '✚', desc: 'Auto-used when caught: get back up once.', cost: 400 },
  { id: 'headstart', name: 'HEAD START', icon: '⏩', desc: 'Auto-used at the start: 6 s sky dash.', cost: 250 },
];

export function lvl(save, id) {
  return save.upgrades?.[id] || 0;
}

export function upgradeCost(save, u) {
  const l = lvl(save, u.id);
  return l >= u.max ? null : u.costs[l];
}

export function buy(save, id) {
  save.upgrades ??= {};
  save.gadgets ??= {};
  const u = UPGRADES.find((x) => x.id === id);
  if (u) {
    const c = upgradeCost(save, u);
    if (c === null || save.bank < c) return false;
    save.bank -= c;
    save.upgrades[id] = lvl(save, id) + 1;
    return true;
  }
  const gd = GADGETS.find((x) => x.id === id);
  if (gd && save.bank >= gd.cost) {
    save.bank -= gd.cost;
    save.gadgets[id] = (save.gadgets[id] || 0) + 1;
    return true;
  }
  return false;
}

/** Cheapest thing the player can't afford yet (drives the "next goal" bar). */
export function nextGoal(save) {
  let best = null;
  for (const u of UPGRADES) {
    const c = upgradeCost(save, u);
    if (c !== null && (!best || c < best.cost)) best = { name: `${u.name} ${lvl(save, u.id) + 1}`, cost: c };
  }
  return best;
}

export function canAffordAny(save) {
  return UPGRADES.some((u) => {
    const c = upgradeCost(save, u);
    return c !== null && c <= save.bank;
  }) || GADGETS.some((g) => g.cost <= save.bank);
}

/** Gameplay numbers after upgrades. */
export function stats(save, CFG) {
  const L = (id) => lvl(save, id);
  return {
    lives: 3 + L('hearts'),
    magnetSec: CFG.magnetSec + L('magnet') * 2,
    shieldSec: CFG.shieldSec + L('shield') * 3,
    turboSec: CFG.turboSec + L('dash'),
    focusSec: CFG.focusSec + L('focus'),
    webCool: 0.22 * (1 - L('web') * 0.15),
    zip: 2.5 + L('web') * 1,
    coinMult: 1 + L('coins') * 0.2,
    shockCost: Math.round(CFG.shockCost * (1 - L('shock') * 0.12)),
  };
}

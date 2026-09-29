// Central tuning. Everything gameplay-facing lives here.
export const CFG = {
  laneWidth: 2.6,
  corridorHalf: 5.2, // half width of the lane corridor (floor / tunnel)

  speedStart: 22,
  speedMax: 44,
  rampSec: 150,

  // Hero logical body band (metres above the zone floor).
  bodyHalfH: 0.9,
  restCenter: 1.8,
  hopHeight: 3.2,
  hopSec: 0.72,
  diveSec: 0.75,
  diveCenter: 0.75,
  diveHalfH: 0.5,
  bodyHalfW: 0.55,
  bodyHalfD: 0.5,
  laneLerp: 14,

  // Chase
  chaseWindowSec: 7,
  invulnSec: 1.3,
  monsterGapFar: 32,
  monsterGapNear: 4.4,

  // Turns
  turnWindow: 34, // metres before a junction where a matching swipe = turn
  turnSignAt: 70,

  gravity: 32,

  // Abilities
  focusSec: 5, // slow-motion
  springSec: 10, // super jump
  doubleSec: 12, // double coins
  magnetSec: 8,
  shieldSec: 12,
  turboSec: 5,
  turboMult: 1.65,
  shockCost: 40, // tokens needed to charge the Shockwave
  tokenPoints: 10,

  // World streaming
  aheadMetres: 520,
  behindMetres: 90,
  zoneBaseY: { roof: 40, office: 22, prison: -12, street: 0, park: 0, subway: -12, rift: 64 },
  // Levels: subway -12, street/park 0, office floor 22, rooftops 40, Mirror City 64 (through rift portals).
  zoneOrder: ['roof', 'office', 'street', 'park', 'subway', 'prison', 'rift'],
  zoneNames: { prison: 'IRON ISLE LOCKUP', office: 'FLOOR 20', roof: 'ROOFTOPS', street: 'DOWNTOWN', park: 'THE GREEN', subway: 'UNDERGROUND', rift: 'MIRROR CITY' },
  // Route graph: where each zone can lead. Two options = a T-junction you choose at.
  cities: {
    nyc: {
      name: 'NEW YORK',
      start: 'roof',
      succ: {
        roof: ['office', 'street', 'rift'],
        office: ['street'],
        street: ['park', 'subway'],
        park: ['street', 'subway'],
        subway: ['prison', 'roof'],
        prison: ['roof', 'subway'],
        rift: ['roof'],
      },
    },
  },
  segmentsPerZone: 2,

  introSec: 30,
};

export const SKINS = [
  {
    id: 'volt', name: 'VOLT', cost: 0,
    hoodie: 0xff3fa4, pants: 0x232a5c, accent: 0x3fe0ff, shoes: 0xffd84a, trim: 0x1b1030,
  },
  {
    id: 'night', name: 'NIGHT SHIFT', cost: 250,
    hoodie: 0x2b2640, pants: 0x15131f, accent: 0xa8f03a, shoes: 0xa8f03a, trim: 0x5a5480,
  },
  {
    id: 'sun', name: 'SUNBURST', cost: 500,
    hoodie: 0xffc02e, pants: 0x19b6a0, accent: 0xff3fa4, shoes: 0xff6b3d, trim: 0xff7a1a,
  },
  {
    id: 'glacier', name: 'GLACIER', cost: 800,
    hoodie: 0xeaf6ff, pants: 0x6a79c9, accent: 0xb56bff, shoes: 0x3fc7ff, trim: 0x9ad8ff,
  },
  {
    id: 'custom', name: 'CUSTOM', cost: 1000, custom: true,
    hoodie: 0x19d3b5, pants: 0x2b2640, accent: 0xff9a2e, shoes: 0xffffff, trim: 0x1b1030,
  },
];

// ── Hero Studio ──
export const DEFAULT_LOOK = {
  body: 'A', skin: '#8a5a44', hair: 'short', hairColor: '#1b1030', hood: 'up', mask: 'full', eyes: 'visor',
  suit: '#ff3fa4', pants: '#232a5c', shoes: '#ffd84a', trim: '#1b1030', accent: '#3fe0ff',
  pattern: 'solid', emblem: 'bolt', backpack: true, headphones: false, scarf: false, scarfColor: '#ff3fa4',
};

export const PRESETS = [
  { id: 'volt', name: 'VOLT', cost: 0, look: {} },
  { id: 'blonde', name: 'BLONDE BOLT', cost: 0, look: { body: 'B', skin: '#f1c7a5', hood: 'down', hair: 'long', hairColor: '#f2cf6b', mask: 'eye', suit: '#fff1f8', pants: '#ff3fa4', shoes: '#3fc7ff', accent: '#ff3fa4', trim: '#1b1030', emblem: 'star', scarf: true, scarfColor: '#3fc7ff' } },
  { id: 'night', name: 'NIGHT SHIFT', cost: 250, look: { suit: '#2b2640', pants: '#15131f', shoes: '#a8f03a', accent: '#a8f03a', trim: '#5a5480', pattern: 'circuit', emblem: 'v' } },
  { id: 'bronx', name: 'BRONX BEAT', cost: 400, look: { skin: '#6b4432', hood: 'down', hair: 'afro', hairColor: '#1b1030', mask: 'eye', eyes: 'goggles', suit: '#ffd84a', pants: '#232a5c', pattern: 'graffiti', headphones: true, emblem: 'spiral', accent: '#ff3fa4' } },
  { id: 'sun', name: 'SUNBURST', cost: 500, look: { suit: '#ffc02e', pants: '#19b6a0', accent: '#ff3fa4', shoes: '#ff6b3d', trim: '#ff7a1a', pattern: 'halftone', emblem: 'star' } },
  { id: 'noir', name: 'NOIR', cost: 650, look: { suit: '#f4f4f4', pants: '#111111', shoes: '#f4f4f4', accent: '#ffffff', trim: '#111111', pattern: 'stripes', emblem: 'eye', scarf: true, scarfColor: '#111111' } },
  { id: 'glacier', name: 'GLACIER', cost: 800, look: { body: 'B', suit: '#eaf6ff', pants: '#6a79c9', accent: '#b56bff', shoes: '#3fc7ff', trim: '#9ad8ff', hood: 'down', hair: 'ponytail', hairColor: '#f5f5ff', mask: 'eye', skin: '#c68a64' } },
  { id: 'rift', name: 'RIFT RUNNER', cost: 1000, look: { suit: '#19d3b5', pants: '#2b2640', accent: '#ff9a2e', eyes: 'goggles', pattern: 'camo', scarf: true, scarfColor: '#ff9a2e', emblem: 'bolt', hood: 'down', hair: 'mohawk', hairColor: '#ff3fa4', mask: 'eye', skin: '#a86c4c' } },
];

export const STUDIO = {
  skin: ['#f8d9c0', '#f1c7a5', '#e0ac86', '#c68a64', '#a86c4c', '#8a5a44', '#6b4432', '#4e3022', '#3a2218', '#2a180f'],
  hairColor: ['#1b1030', '#3b2618', '#6b3f22', '#9c4a24', '#f2cf6b', '#f5f5ff', '#ff3fa4', '#3fc7ff', '#a8f03a', '#7b4dff'],
  colors: ['#ff3fa4', '#3fe0ff', '#ffd84a', '#a8f03a', '#ff9a2e', '#7b4dff', '#19d3b5', '#f4f4f4', '#232a5c', '#1b1030', '#d6203a', '#2b2640'],
  hair: ['short', 'ponytail', 'long', 'puffs', 'braids', 'afro', 'mohawk'],
  pattern: ['solid', 'stripes', 'halftone', 'circuit', 'graffiti', 'camo'],
  emblem: ['none', 'bolt', 'star', 'v', 'eye', 'spiral'],
};

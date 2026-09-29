// The one map of the Sable Reach. Every placement in the game reads from here.
//
// Layout is a journey outward from home, in story order (north is -z):
//
//   HOME ISLE (0,0)            den on the north cliff, Hearthholm village + harbor on the south shore,
//                              three tutorial rings that tour the island              — Chapter I
//   KEEPER SHALLOWS (east)     three keeper lighthouses on sea stacks                 — Chapter II  (beacons 1-4)
//   SERPENT REACH (north-east) the canyon slot, then the drowned village              — Chapter III (beacons 5-8)
//   RIB WASTES (north-west)    a line of giant rib arches you fly *through*           — Chapter IV  (beacons 9-11)
//   TEMPEST GATE (far north)   a ring of sea stacks around the gate                   — Chapter V   (beacon 12)
//
// Mountain pairs stand either side of each crossing between regions, so every leg reads as a
// gateway and the next region's tallest landmark is visible before you reach it.

export const HOME = { x: 0, z: 0, r: 300, peak: 96 };
export const VILLAGE = { name: 'Hearthholm', x: 50, z: 150, r: 78, floor: 9 };
export const DEN = { x: -20, z: -262, ledge: 26 };   // ledge radius the menu camera can orbit inside
export const HARBOR = { x: 140, z: 215 };

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= .5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

let denLedgeY = null;
function rawHeight(x, z) {
  const dx = (x - HOME.x) / HOME.r, dz = (z - HOME.z) / HOME.r;
  const d = Math.hypot(dx, dz * 1.08);
  if (d > 1.15) return -10;
  const north = sstep(-0.35, 0.75, -dz);                     // 0 on the south shore, 1 on the north cliffs
  const edge = lerp(2.2, 7, north);                          // gentle southern slopes, sheer northern cliffs
  const dome = Math.max(0, 1 - Math.pow(d, edge));
  const ridge = 0.32 + 0.68 * north;
  let h = HOME.peak * dome * ridge * (0.72 + 0.56 * fbm(x * .011 + 3, z * .011 + 7)) - 7;
  const bx = x - HARBOR.x, bz = z - HARBOR.z;                // the harbor bay bites into the south-east
  h -= 70 * Math.exp(-(bx * bx + bz * bz) / (2 * 62 * 62));
  return h;
}
/** Terrain height of the home isle at (x,z); below ~0 is sea. Pure function: safe to call anywhere. */
export function homeHeight(x, z) {
  let h = rawHeight(x, z);
  const vx = x - VILLAGE.x, vz = z - VILLAGE.z, vd = Math.hypot(vx, vz);   // Hearthholm's terrace
  if (vd < VILLAGE.r * 1.35) h = lerp(VILLAGE.floor, h, sstep(VILLAGE.r * .85, VILLAGE.r * 1.35, vd));
  if (denLedgeY === null) denLedgeY = Math.max(18, rawHeight(DEN.x, DEN.z));
  const ex = x - DEN.x, ez = z - DEN.z, ed = Math.hypot(ex, ez);           // the den's ledge
  if (ed < DEN.ledge * 1.6) h = lerp(denLedgeY, h, sstep(DEN.ledge * .9, DEN.ledge * 1.6, ed));
  return h;
}
export function denPoint() { homeHeight(DEN.x, DEN.z); return [DEN.x, denLedgeY + 2, DEN.z]; }

// Chapter I: tour the island — over the village, round the west cliffs, out past the north-east point.
export const TUTORIAL = [[-30, 58, -380], [-290, 52, -60], [60, 46, 185]];   // burst out over the north cliff, round the west, home over Hearthholm

// The beacon road, in story order. Heights stay low enough to thread the rib arches.
export const ROUTE = [
  [440, 50, -10], [660, 52, 0], [880, 60, -120], [780, 66, -320],          // II  Keeper Shallows
  [745, 60, -570], [960, 62, -840], [1060, 58, -900], [820, 76, -1100],    // III Serpent Reach
  [300, 52, -1160], [-200, 48, -1080], [-520, 64, -1100],                  // IV  Rib Wastes
  [-240, 120, -1620]                                                         // V   Tempest Gate
];
export const GATE = { x: -240, z: -1620, y: 120 };

export const KEEPERS = {
  center: [760, -40],
  lighthouses: [[700, -100, 42, 0, 0.42], [860, 30, 26, 2.1, -0.34], [640, 80, 30, 4.0, 0.29]],  // x,z,baseH,yaw0,rate
  rocks: [[700, -100, 34, 42], [860, 30, 16, 26], [640, 80, 16, 30], [790, -170, 14, 22], [950, -40, 12, 18], [700, 140, 13, 20]],
  crystals: [[740, -20, 26], [820, -60, 20], [660, 10, 24], [780, 90, 22], [610, -40, 18]]
};

// Serpent canyon: the old slot, carried whole to the Serpent Reach (translation only, so the
// hand-tuned wall angles survive). You enter at the south-west end and exit north-east.
const CAN0 = [[-60, -150, 0.3], [-95, -135, 0.7], [-130, -105, 1.0], [-155, -65, 1.25], [-168, -20, 1.5]];
const CAN_T = [960, -610];
export const CANYON = CAN0.map(([x, z, a]) => [x + CAN_T[0], z + CAN_T[1], a]);

export const DROWNED = { dx: 1080 - 500, dz: -880 + 450 };   // offset applied to the old village cluster

// Rib arches stand across the b9 -> b10 leg, so the route runs straight through the ribcage.
export const RIBS = (() => {
  const [ax, , az] = ROUTE[8], [bx, , bz] = ROUTE[9];
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const yaw = Math.atan2(ux, uz);
  return [0.2, 0.34, 0.48, 0.62, 0.76].map((t, i) => ({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw, R: 78 - i * 3, tube: 5.2 - i * 0.4, px: uz, pz: -ux }));
})();
export const SKULL = [-640, -1180, 30, 26];

export const MOUNTAINS = [
  [360, -300, 130, 260], [420, 300, 140, 270],          // home  <-> keepers
  [560, -560, 140, 285], [1010, -440, 130, 260],        // keepers <-> serpent
  [560, -1330, 150, 310], [560, -930, 110, 230],        // serpent <-> ribs
  [-800, -1320, 140, 285], [-140, -1480, 120, 245],     // ribs <-> gate
  // the world's walls: tall, hungry peaks that frame every horizon and point the way north
  [-200, -2250, 320, 620], [300, -2350, 260, 520], [-700, -2150, 280, 560],
  [1650, -600, 300, 560], [1600, -1300, 280, 520], [1550, 150, 240, 440],
  [-1500, -900, 300, 580], [-1450, -200, 260, 480], [-1400, -1600, 280, 540],
  [80, 900, 300, 520], [-700, 700, 240, 440], [900, 750, 240, 440]
];

export const LANDMARK_POSITIONS = {
  'wake-arch': [205, 6, 330], 'tide-viaduct': [-500, 4, 70],
  'storm-spire': [1010, 8, -20], 'keeper-arcade': [560, 4, -240], 'drowned-gate': [760, 6, 210],
  'cinder-harbor': [1250, 2, -760], 'salt-arcade': [1020, 4, -1260],
  'bone-sentinel': [130, 4, -1400], 'gale-spire': [380, 8, -1340], 'keeper-works': [-900, 2, -760],
  'rib-vault': [-760, 4, -1500], 'aurora-crown': [60, 6, -1770]
};

export const FEEDING = { x: -620, z: -260, r: 170 };
export const WHALES = [[-640, -200], [-560, -340], [-720, -320], [-40, -1500]];
export const SHARKS = [[-600, -180], [-700, -280], [-540, -300], [-660, -380], [700, 60], [840, -60], [-300, -1000], [-500, -1140]];
export const BIRDS = [[0, -220, 7], [60, 170, 6], [850, -700, 7], [-300, -1060, 6]];
export const SHIP_LANES = [[760, -40, 240, 0.018], [1000, -800, 210, -0.03], [-420, -1060, 230, 0.026], [-240, -1620, 300, -0.02]];
export const RUNESTONES = [[330, -80], [700, -450], [560, -1060], [-420, -1240], [-560, -360], [230, 250], [-120, -1560], [1040, -960], [-240, -960], [980, -250]];

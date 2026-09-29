import * as THREE from 'three';

// All textures are painted procedurally on canvases, so the game ships with
// zero image downloads and every surface matches the comic palette.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

// Deterministic RNG so textures look the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LIT = ['#ffcf6b', '#ffe9a8', '#ff8fc8', '#7fe6ff', '#ffb36b', '#fff3d0'];

/**
 * Window grid atlas: 8x8 cells per repeat. Returns {map, glow}. The map is
 * white wall (tinted by vertex colour) with dark glass; glow holds lit panes.
 * Cell (0,0) corner is always plain wall so roof faces can sample it.
 */
function windowAtlas(style, seed) {
  const N = 8;
  const S = 512;
  const cell = S / N;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  const r = rng(seed);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000000';
  ge.fillRect(0, 0, S, S);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x * cell;
      const py = y * cell;
      let wx, wy, ww, wh;
      if (style === 'glass') {
        wx = px + cell * 0.08; wy = py + cell * 0.1; ww = cell * 0.84; wh = cell * 0.72;
      } else {
        wx = px + cell * 0.26; wy = py + cell * 0.2; ww = cell * 0.48; wh = cell * 0.56;
      }
      const lit = r() < (style === 'glass' ? 0.18 : 0.26);
      g.fillStyle = style === 'glass' ? '#2e3d70' : '#232a55';
      g.fillRect(wx, wy, ww, wh);
      // Glass highlight streak (fake reflection).
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(wx + ww * 0.15, wy + wh);
      g.lineTo(wx + ww * 0.45, wy);
      g.lineTo(wx + ww * 0.6, wy);
      g.lineTo(wx + ww * 0.3, wy + wh);
      g.fill();
      if (style !== 'glass') {
        g.fillStyle = 'rgba(40,20,60,0.55)';
        g.fillRect(wx - 3, wy + wh, ww + 6, 5); // sill
        g.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); // mullion
      } else {
        g.fillStyle = 'rgba(30,20,60,0.5)';
        g.fillRect(wx, wy + wh * 0.5 - 1.5, ww, 3);
      }
      if (lit) {
        ge.fillStyle = LIT[Math.floor(r() * LIT.length)];
        ge.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        g.fillStyle = 'rgba(255,230,160,0.5)';
        g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }
  // Keep the (0,0) corner plain wall for roof sampling.
  g.fillStyle = '#ffffff';
  g.fillRect(0, S - 6, 6, 6);
  ge.fillStyle = '#000000';
  ge.fillRect(0, S - 6, 6, 6);
  return { map: tex(c), glow: tex(e) };
}

function laneFloor({ base, speck, lines, edge, seed, sheen }) {
  const W = 256;
  const H = 256;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = speck[Math.floor(r() * speck.length)];
    g.fillRect(r() * W, r() * H, 2 + r() * 2, 2 + r() * 2);
  }
  if (sheen) {
    // Wet-street neon reflection streaks.
    for (let i = 0; i < 18; i++) {
      g.fillStyle = sheen[i % sheen.length];
      const x = r() * W;
      g.globalAlpha = 0.25 + r() * 0.2;
      g.fillRect(x, r() * H, 3 + r() * 5, 40 + r() * 90);
    }
    g.globalAlpha = 1;
  }
  // Lane boundaries at +-1.3 and +-3.9 of a 10.4 m wide corridor.
  const toU = (x) => ((x + 5.2) / 10.4) * W;
  g.fillStyle = lines;
  for (const x of [-3.9, -1.3, 1.3, 3.9]) {
    for (let y = 0; y < H; y += 64) g.fillRect(toU(x) - 3, y, 6, 36);
  }
  g.fillStyle = edge;
  g.fillRect(0, 0, 8, H);
  g.fillRect(W - 8, 0, 8, H);
  return tex(c);
}

function subwayTiles() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(77);
  g.fillStyle = '#f6f2ea';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#b9b3c9';
  g.lineWidth = 2;
  for (let y = 0; y <= S; y += 16) {
    for (let x = 0; x <= S; x += 32) {
      g.strokeRect(x + ((y / 16) % 2) * 16, y, 32, 16);
    }
  }
  // Colour band.
  g.fillStyle = '#ff6b3d';
  g.fillRect(0, 96, S, 22);
  g.fillStyle = '#19b6a0';
  g.fillRect(0, 120, S, 8);
  // Grime.
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(60,40,80,${0.05 + r() * 0.08})`;
    g.beginPath();
    g.arc(r() * S, 150 + r() * 106, 6 + r() * 18, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

function trackBed() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(91);
  g.fillStyle = '#3a3350';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = ['#4a4266', '#2a2440', '#5b5178'][Math.floor(r() * 3)];
    g.fillRect(r() * S, r() * S, 3, 3);
  }
  // Sleepers under each lane.
  g.fillStyle = '#6b4a3a';
  for (let y = 0; y < S; y += 32) g.fillRect(8, y, S - 16, 10);
  return tex(c);
}

function billboard(text, bg, fg, accent, seed) {
  const [c, g] = canvas(512, 256);
  const r = rng(seed);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = accent;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(r() * 512, r() * 256, 30 + r() * 80, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.font = 'bold 118px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = '#1b1030';
  g.strokeText(text, 256, 132);
  g.fillStyle = fg;
  g.fillText(text, 256, 132);
  g.lineWidth = 12;
  g.strokeStyle = '#1b1030';
  g.strokeRect(6, 6, 500, 244);
  return tex(c, false);
}

function graffiti(seed) {
  const [c, g] = canvas(512, 128);
  const r = rng(seed);
  const cols = ['#ff3fa4', '#3fe0ff', '#a8f03a', '#ffd84a', '#b56bff', '#ff9a2e'];
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 100 + r() * 20;
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.strokeStyle = '#1b1030';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(x + 40, 64, 42 + r() * 12, 30 + r() * 20, r() - 0.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.font = 'bold 54px Impact, sans-serif';
    g.fillStyle = '#fff';
    g.fillText('ABCDKXZRVW'[Math.floor(r() * 10)], x + 24, 84);
  }
  return tex(c, false);
}

let T = null;
export function textures() {
  if (T) return T;
  T = {
    brick: windowAtlas('brick', 11),
    glass: windowAtlas('glass', 23),
    asphalt: laneFloor({
      base: '#3b3a5e',
      speck: ['#34335a', '#46457a', '#2e2c4f'],
      lines: '#fff1d6',
      edge: '#ffd84a',
      seed: 5,
      sheen: ['#ff3fa4', '#3fe0ff', '#ffd84a'],
    }),
    roof: laneFloor({
      base: '#b3a9c4',
      speck: ['#a399b6', '#c4bbd3', '#948aa8', '#d2cadf'],
      lines: 'rgba(255,255,255,0.75)',
      edge: '#ff6b6b',
      seed: 9,
    }),
    tiles: subwayTiles(),
    track: trackBed(),
    ads: [
      billboard('ZAP!', '#ff3fa4', '#ffd84a', '#ffffff', 1),
      billboard('NYC', '#3fc7ff', '#ffffff', '#ff3fa4', 2),
      billboard('SODA', '#ffd84a', '#ff3fa4', '#19d3b5', 3),
      billboard('WOW', '#7b4dff', '#a8f03a', '#ff9a2e', 4),
      billboard('24/7', '#19d3b5', '#fff1d6', '#7b4dff', 5),
    ],
    graffiti: [graffiti(3), graffiti(8), graffiti(13)],
  };
  return T;
}

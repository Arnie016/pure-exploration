import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

// Comic panel shapes (normalised screen quads) for each story beat. The live
// 3D view shows through the panel; paper and ink cover the rest.
const PANELS = [
  [0, [[0.04, 0.06], [0.96, 0.03], [0.95, 0.62], [0.05, 0.66]]],
  [6.4, [[0.05, 0.2], [0.94, 0.12], [0.97, 0.9], [0.03, 0.95]]],
  [12.2, [[0.1, 0.05], [0.98, 0.1], [0.9, 0.94], [0.02, 0.88]]],
  [18.6, [[0.03, 0.08], [0.9, 0.04], [0.97, 0.86], [0.08, 0.93]]],
  [23.4, [[0, 0], [1, 0], [1, 1], [0, 1]]],
];

// Camera keyframes in first-segment coordinates: [time, [d, x, y], [d, x, y]].
const KEYS = [
  [0, [-170, 150, 240], [140, -30, 60]],
  [6, [-80, 100, 170], [140, -20, 50]],
  [7.4, [10, 45, 95], [95, -10, 10]],
  [11.8, [63, -9.2, 10], [92, -10, 2.5]],
  [12.6, [66, -9.4, 6], [92, -10, 3]],
  [17.6, [74, -8.8, 4.2], [92, -10, 3.8]],
  [18.8, [70, -9.4, 26], [40, 0, 41.4]],
  [23.4, [44.2, 1.9, 41.9], [40, 0, 41.5]],
  [27.4, [45.4, 2.6, 42.3], [40, 0, 41.4]],
  [28.8, [33.5, 1.6, 43.6], [62, 0, 41]],
  [30, [32.8, 0, 43.4], [52, 0, 41.5]],
];

/**
 * 30-second comic story: skyline flyover -> the ink rift tears open -> an Ink
 * Hound climbs out and roars -> Volt on the rooftop -> title -> leap into play.
 */
export class Intro {
  constructor(game) {
    this.g = game;
    this.rift = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2fd0).multiplyScalar(3.5) }));
    ring.rotation.x = Math.PI / 2;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), new THREE.MeshStandardMaterial({ color: 0x14081f, roughness: 0.05, metalness: 0.4, emissive: 0x5a0a60, emissiveIntensity: 1.2 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    const cracks = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 3 + Math.random() * 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2fd0).multiplyScalar(2.5) }));
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      c.position.set(Math.cos(a) * 4.5, 0.04, Math.sin(a) * 4.5);
      c.rotation.y = -a + Math.PI / 2;
      cracks.add(c);
    }
    this.rift.add(ring, pool, cracks);
    this.rift.traverse((o) => o.isMesh && o.layers.set(LAYER_NO_OUTLINE));
    this.riftLight = new THREE.PointLight(0xff2fd0, 0, 40, 1.6);
    this.riftLight.position.y = 3;
    this.rift.add(this.riftLight);
    this.caps = [];
  }

  P(d, x, y, out = new THREE.Vector3()) {
    const seg = this.seg;
    return out.copy(seg.origin).addScaledVector(seg.fwd, d).addScaledVector(seg.right, x).setY(y);
  }

  start() {
    const g = this.g;
    this.quad = PANELS[0][1].map((p) => p.slice());
    this.seg = g.path.segments[0];
    this.t = 0;
    this.done = false;
    this.lineOn = false;
    this.events = new Set();
    this.posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => this.P(...k[1])), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => this.P(...k[2])), false, 'centripetal');
    this.P(90, -10, -0.02, this.rift.position);
    this.rift.scale.setScalar(0.01);
    g.scene.add(this.rift);
    g.monster.root.visible = true;
    g.ui.introShow(true);
    g.ui.showHud(false);
  }

  skip() {
    if (this.t < 30) {
      this.g.ui.clearBubbles();
      this.t = 30; // finish() fires on the very next update(), no lingering skip button
      this.events.clear();
      for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) this.events.add(k);
      this.g.ui.clearCaptions();
      this.g.ui.splash(false);
      this.rift.scale.setScalar(1);
    }
  }

  once(key, at, fn) {
    if (this.t >= at && !this.events.has(key)) {
      this.events.add(key);
      fn();
    }
  }

  timeToU(t) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i][0];
      const b = KEYS[i + 1][0];
      if (t <= b) {
        const f = (t - a) / (b - a);
        const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
        return (i + e) / (KEYS.length - 1);
      }
    }
    return 1;
  }

  update(dt) {
    const g = this.g;
    const ui = g.ui;
    this.t += dt;
    const t = this.t;

    this.once('a', 0.3, () => ui.caption('NEW YORK CITY.', 'dark', { left: '6%', top: '13%' }));
    this.once('b', 2.4, () => ui.caption('7:42 PM. Golden hour over the skyline.', '', { left: '10%', top: '26%' }));
    this.once('c', 5.8, () => ui.clearCaptions(true));
    this.once('d', 6.6, () => ui.caption('Somewhere beneath the streets…', 'pink', { left: '6%', top: '13%' }));
    this.once('e', 8.8, () => {
      ui.caption('…the city <b>TORE OPEN.</b>', '', { right: '6%', bottom: '18%' });
      g.shake = 0.5;
      g.audio.play('thunder');
      g.audio.play('drone');
    });
    this.once('f', 11.8, () => ui.clearCaptions(true));
    this.once('g', 14.2, () => {
      g.monster.roar();
      g.audio.play('roar');
      g.audio.play('braam');
      g.shake = 0.9;
      ui.caption('INK HOUNDS.', 'dark', { left: '6%', top: '13%' });
      ui.bubble('GRRRAAAHHH!!', 50, 52, true, 2400);
    });
    this.once('h', 15.6, () => ui.caption('They hunt anything that glows.', 'pink', { left: '12%', top: '27%' }));
    this.once('i', 17.8, () => ui.clearCaptions(true));
    this.once('j', 19.2, () => ui.caption('Lucky for New York…', 'cyan', { left: '6%', top: '13%' }));
    this.once('k', 21.2, () => {
      ui.caption('…the city has a guardian.', '', { right: '6%', bottom: '18%' });
      ui.bubble('Not on my watch.', 56, 34, false, 2200);
      g.audio.play('zap');
      g.particles.burst(g.hero.handWorld, g.hero.accent, 24, 3, 0.6, 2, 3);
    });
    this.once('l', 23.6, () => {
      ui.clearCaptions(true);
      ui.splash(true);
      g.audio.play('braam');
    });
    this.once('m', 27.3, () => {
      ui.splash(false);
      ui.introOpen();
    });
    this.once('n', 28.6, () => {
      g.audio.play('zap');
      g.audio.play('whoosh');
      ui.bubble('Let\u2019s swing.', 58, 40, false, 1500);
    });

    // Motion-comic panel: ease the quad toward the current beat's shape.
    let target = PANELS[0][1];
    for (const [at, q] of PANELS) if (t >= at) target = q;
    const k = 1 - Math.exp(-7 * dt);
    this.quad.forEach((p, i) => {
      p[0] += (target[i][0] - p[0]) * k;
      p[1] += (target[i][1] - p[1]) * k;
    });
    const full = this.quad.every((p, i) => Math.abs(p[0] - [0, 1, 1, 0][i]) < 0.004 && Math.abs(p[1] - [0, 0, 1, 1][i]) < 0.004);
    ui.panels(full ? null : this.quad);

    // Camera.
    const u = this.timeToU(Math.min(t, 30));
    this.posCurve.getPoint(u, g.camera.position);
    const look = this.lookCurve.getPoint(u);
    if (g.shake > 0) {
      g.camera.position.x += (Math.random() - 0.5) * g.shake;
      g.camera.position.y += (Math.random() - 0.5) * g.shake;
    }
    g.camera.lookAt(look);
    g.camLook.copy(look);

    // Rift + monster.
    const riftK = THREE.MathUtils.clamp((t - 8.6) / 0.8, 0, 1);
    this.rift.scale.setScalar(Math.max(0.01, riftK));
    this.rift.rotation.y += dt * 0.4;
    this.riftLight.intensity = riftK * (60 + Math.sin(t * 9) * 20);
    if (t > 8.6 && t < 19 && Math.random() < 0.5) {
      const p = this.rift.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.3, (Math.random() - 0.5) * 4));
      g.particles.burst(p, 0xb02fff, 2, 5, 1.1, 4, 1.4);
    }
    const rise = THREE.MathUtils.clamp((t - 12.2) / 2.0, 0, 1);
    const m = g.monster.root;
    this.P(92, -10, -5.5 + rise * 5.5, m.position);
    m.rotation.set(0, this.seg.yaw, 0);
    m.visible = t > 11 && t < 26;
    g.monster.update(dt, rise > 0 && rise < 1 ? 4 : 0);

    // Hero: crouched on the roof, then stands and leaps.
    const hero = g.hero;
    const heroPos = this.P(40, 0, 41.05);
    let mode = 'idle';
    if (t > 27.6) mode = 'hop';
    if (t > 28.6) {
      const k = Math.min(1, (t - 28.6) / 1.4);
      heroPos.addScaledVector(this.seg.fwd, k * 6).setY(41.05 + Math.sin(k * Math.PI) * 1.6 + k * 0.8);
      mode = 'swing';
    }
    hero.root.position.copy(heroPos);
    hero.root.rotation.set(0, this.seg.yaw + Math.PI, 0);
    const visorBoost = t > 21 ? 1 + Math.max(0, 1 - (t - 21)) * 2 : 1;
    hero.mats.glow.color.copy(hero.accent).multiplyScalar(3 * visorBoost);
    const anchor = mode === 'swing' ? this.P(58, 9, 58) : null;
    hero.lineSide = 1;
    hero.animate(dt, { mode, phase: 0.2, anchorWorld: anchor });
    if (anchor && !this.lineOn) {
      this.lineOn = true;
      g.line.zap();
    }
    if (anchor) g.line.update(dt, hero.handWorld, anchor, true);
    else g.line.hide();

    if (t >= 30) {
      this.finish();
      return true;
    }
    return false;
  }

  finish() {
    const g = this.g;
    g.ui.panels(null);
    g.ui.clearBubbles();
    g.scene.remove(this.rift);
    g.ui.introShow(false);
    g.ui.splash(false);
    g.hero.mats.glow.color.copy(g.hero.accent).multiplyScalar(3);
    this.done = true;
  }
}

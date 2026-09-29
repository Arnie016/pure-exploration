import * as THREE from 'three';
import { CFG } from '../config.js';
import { buildInto, goon } from './hazards.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';
import { PRIM, mat4 } from '../world/geo.js';

const LW = CFG.laneWidth;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lanes = [-1, 0, 1];

/** World-space sign sprite (e.g. "HELP!") drawn on a canvas. */
function signSprite(text, bg = '#ffd84a', fg = '#1b1030') {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(8, 8, 240, 90, 20);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(100, 96);
  g.lineTo(128, 124);
  g.lineTo(140, 96);
  g.fill();
  g.font = 'bold 64px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(text, 128, 56);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  sp.scale.set(1.8, 0.9, 1);
  sp.layers.set(LAYER_NO_OUTLINE);
  sp.renderOrder = 10;
  return sp;
}

function villainVan(mats) {
  return buildInto(new THREE.Group(), mats, (B) => {
    B.box('solid', 0, 1.7, -0.6, 2.3, 2.6, 5.2, 0x1b1030);
    B.box('solid', 0, 1.2, 2.3, 2.2, 1.6, 1.6, 0x2b2640);
    B.box('metal', 0, 1.6, 3.12, 1.9, 0.7, 0.04, 0x3d4f86);
    B.box('glowV', 0, 2.1, -0.6, 2.34, 0.25, 5.0, 0xa8f03a, 0, 0, 0, 3);
    B.box('glowV', 0, 1.2, -0.6, 2.34, 0.12, 5.0, 0xff3fa4, 0, 0, 0, 3);
    for (const [x, z] of [[-1, 1.8], [1, 1.8], [-1, -2], [1, -2]]) B.cyl('solid', x, 0.42, z, 0.42, 0.34, 0x0d0a14, 0, 0, Math.PI / 2);
    B.box('glowV', -0.8, 1.0, -3.22, 0.3, 0.25, 0.04, 0xff2030, 0, 0, 0, 4);
    B.box('glowV', 0.8, 1.0, -3.22, 0.3, 0.25, 0.04, 0xff2030, 0, 0, 0, 4);
    // Money bags bouncing on the roof rack.
    for (const z of [-1.8, -0.4, 1.0]) B.add('solid', PRIM.sphere, mat4(0, 3.25, z, 0.7, 0.55, 0.7), 0xc9b37a);
  });
}

function lightCore(mats) {
  return buildInto(new THREE.Group(), mats, (B) => {
    B.add('glowV', PRIM.sphere, mat4(0, 0, 0, 0.7, 0.7, 0.7), 0xfff6a0, 4);
    B.add('glowV', PRIM.torus, mat4(0, 0, 0, 1.3, 1.3, 1.3, Math.PI / 2, 0, 0), 0x3fe0ff, 3);
  });
}

/**
 * Story pacing on top of the endless run: every so often a mission takes
 * over (rescue, heist chase, boss, gauntlet), sometimes in a special episode
 * style (noir, horror). Missions adapt to the zone you're in.
 */
export class Director {
  constructor(game) {
    this.g = game;
    this.reset();
  }

  reset() {
    this.cleanup();
    this.t = 0;
    this.mission = null;
    this.episode = 1;
    this.nextAt = 32;
    this.order = ['rescue', 'heist', 'gauntlet', 'boss'];
    this.idx = 0;
    this.style = { noir: 0, horror: 0 };
    this.styleTarget = { noir: 0, horror: 0 };
    this.g.ui?.objective(null);
  }

  cleanup() {
    this.mission?.cleanup?.();
    this.mission = null;
  }

  update(dt) {
    const g = this.g;
    if (g.state !== 'playing') return;
    this.t += dt;
    if (!this.mission && this.t >= this.nextAt) this.tryStart();
    if (this.mission) {
      const res = this.mission.update(dt);
      if (res) this.finish(res);
    }
    // Episode style blend.
    const k = 1 - Math.exp(-1.5 * dt);
    for (const s of ['noir', 'horror']) this.style[s] += (this.styleTarget[s] - this.style[s]) * k;
    g.pipeline.uniforms.noir.value = this.style.noir;
    g.pipeline.uniforms.horror.value = this.style.horror;
  }

  tryStart() {
    const g = this.g;
    const zone = g.curSeg.zone;
    if (zone === 'office' || zone === 'prison') return; // no room for set pieces indoors
    let type = this.forceNext || this.order[this.idx % this.order.length];
    if (this.forceNext) this.idx--;
    this.forceNext = null;
    // Zone-bound missions fall back to one that fits right now.
    if (type === 'heist' && zone !== 'street') type = zone === 'subway' ? 'gauntlet' : 'rescue';
    if (type === 'gauntlet' && zone !== 'subway') type = zone === 'street' ? 'heist' : 'rescue';
    const seg = g.curSeg;
    const d = g.s - seg.startS;
    if (seg.turnEnd && d > seg.length - 60) return; // don't start right at a corner
    this.idx++;
    const cycle = Math.floor((this.idx - 1) / this.order.length);
    const style = type === 'gauntlet' ? 'noir' : cycle >= 1 && type === 'rescue' ? 'horror' : null;
    this.start(type, style);
  }

  start(type, style) {
    const g = this.g;
    this.styleTarget = { noir: style === 'noir' ? 1 : 0, horror: style === 'horror' ? 1 : 0 };
    const titles = {
      rescue: ['CIVILIANS IN THE AIR', 'Cars are falling. Catch the people.'],
      heist: g.story?.act.chaser === 'clown' ? ['RICTUS ROBS THE HEXBANK', 'The Ringmaster\u2019s getaway van! Land on its roof.'] : ['THE HEX HEIST', 'A masked crew hit the bank. Land on the van’s roof.'],
      gauntlet: ['THE GAUNTLET', 'Runaway trains in the dark. Survive.'],
      boss: ['ALPHA HOUND', 'The pack leader. Grab light cores to blast it.'],
    };
    const [title, line] = titles[type];
    // No full-screen card mid-run: the objective panel carries the mission.
    g.ui.actToast(style === 'noir' ? `${title} (NOIR)` : style === 'horror' ? `${title} (HORROR)` : title, line);
    if (style === 'horror') g.audio.play('drone');
    g.audio.play('braam');
    this.episode++;
    this.mission = this[type]();
    this.mission.type = type;
    // Story beat: the camera pulls back and looks down the road at what's coming.
    g.cineKey = `mission-${type}`;
    g.cine(() => g.path.toWorld(g.s + 60, 0, 6), 1.8, null, 0.5);
  }

  finish(res) {
    const g = this.g;
    const m = this.mission;
    m.cleanup?.();
    this.mission = null;
    this.styleTarget = { noir: 0, horror: 0 };
    g.ui.objective(null);
    if (res === 'win') {
      g.score += m.reward || 3000;
      g.coins += m.coins || 20;
      g.skills.add('mission');
      g.ui.pop(m.winText || 'MISSION COMPLETE!', '#a8f03a', 50, 34, 58);
      g.audio.play('unlock');
    } else {
      g.ui.pop(m.failText || 'MISSION FAILED', '#ff6b6b', 50, 34, 50);
    }
    this.nextAt = this.t + rand(28, 40);
  }

  // ── RESCUE: cars fall, people get thrown; swing into them ──
  rescue() {
    const g = this.g;
    const m = { goal: 3, saved: 0, missed: 0, spawned: 0, timer: 1.2, people: [], reward: 3500, coins: 25 };
    m.winText = 'EVERYONE SAVED!';
    m.update = (dt) => {
      m.timer -= dt;
      if (m.spawned < m.goal && m.timer <= 0) {
        if (this.spawnFalling(m)) m.spawned++;
        m.timer = m.spawned < m.goal ? 4.2 : 99;
      }
      for (const p of m.people) this.updatePerson(p, m, dt);
      m.people = m.people.filter((p) => !p.done);
      g.ui.objective('SAVE THE CIVILIANS', `${m.saved} / ${m.goal} saved`, m.saved / m.goal);
      if (m.saved + m.missed >= m.goal && !m.people.length) return m.saved >= m.goal ? 'win' : m.saved > 0 ? 'win' : 'fail';
      return null;
    };
    m.cleanup = () => {
      for (const p of m.people) g.scene.remove(p.obj);
    };
    return m;
  }

  spawnFalling(m) {
    const g = this.g;
    const spot = g.hazards.spotAhead(2.4, 8);
    if (!spot) return false;
    const { seg, d } = spot;
    // A civilian drifts down into a lane ahead, waving for help.
    const lane = pick(lanes);
    const civ = goon(g.mats, pick([0x3fc7ff, 0xffd84a, 0xa8f03a, 0xf2a0c8]));
    civ.traverse((o) => {
      if (o.isMesh && o.material.color && o.material === g.mats.solid) o.castShadow = true;
    });
    const obj = new THREE.Group();
    obj.add(civ);
    const sign = signSprite('HELP!');
    sign.position.y = 2.6;
    obj.add(sign);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3fa4, side: THREE.DoubleSide, roughness: 0.6 }));
    chute.position.y = 3.4;
    chute.scale.y = 0.55;
    obj.add(chute);
    g.scene.add(obj);
    const s = seg.startS + d + 14;
    const targetY = 1.4 + seg.stepAt(d + 14) + (Math.random() < 0.4 ? 1.6 : 0);
    const p = { obj, s, lane, y: 24, targetY, vy: 0, done: false, t: 0 };
    // The car that threw them tumbles down into another lane (a real obstacle).
    const carLane = pick(lanes.filter((l) => l !== lane));
    if (g.hazards.laneFree(seg, d, [carLane])) this.dropCar(seg, d, carLane);
    m.people.push(p);
    return true;
  }

  dropCar(seg, d, lane) {
    const g = this.g;
    const car = buildInto(new THREE.Group(), g.mats, (B) => {
      B.box('solid', 0, 0.6, 0, 1.9, 0.7, 4.2, pick([0xff6b6b, 0x3fc7ff, 0xffc21a, 0xf4f4f4]));
      B.box('solid', 0, 1.2, -0.2, 1.7, 0.6, 2.3, 0x2b2640);
      for (const [wx, wz] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) B.cyl('solid', wx, 0.35, wz, 0.35, 0.3, 0x1b1030, 0, 0, Math.PI / 2);
    });
    const floor = seg.floorY(d) + seg.stepAt(d);
    car.position.set(lane * LW, floor + 26, -d);
    seg.group.add(car);
    const mark = g.hazards.marker(seg, d, lane * LW, 1.3);
    mark.position.y = floor + 0.06;
    let t = 0;
    g.hazards.list.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / 1.8);
        car.position.y = floor + 26 * (1 - k * k);
        car.rotation.x = (1 - k) * 4;
        car.rotation.z = (1 - k) * 2;
        if (k < 1) return true;
        car.rotation.set(0, 0.3, 0);
        car.position.y = floor;
        seg.group.remove(mark);
        g.hazards.addObstacle(seg, { kind: 'block', lane, d, x: lane * LW, group: car, hw: 1.0, hd: 2.1, yMin: floor - seg.floorY(d), yMax: floor - seg.floorY(d) + 1.8, standable: true });
        const wp = seg.toWorld(d, lane * LW, 1);
        g.physics.rubble(wp, 6, 8, 0.4);
        g.particles.burst(wp, 0xfff1d6, 20, 8, 0.8, 10, 1.2);
        g.audio.play('slam');
        g.audio.play('glass');
        g.shake = Math.max(g.shake, 0.6);
        return false;
      },
      cleanup: () => seg.group.remove(mark),
    });
  }

  updatePerson(p, m, dt) {
    const g = this.g;
    p.t += dt;
    p.y += (p.targetY - p.y) * (1 - Math.exp(-1.6 * dt));
    const w = g.path.toWorld(p.s, p.lane * LW, p.y);
    p.obj.position.copy(w);
    const seg = g.path.segAt(p.s);
    p.obj.rotation.y = seg.yaw + Math.PI + Math.sin(p.t * 2) * 0.3;
    const arm = p.obj.children[0].userData.arm;
    if (arm) arm.rotation.x = -2.6 + Math.sin(p.t * 12) * 0.6; // waving
    const ds = p.s - g.s;
    if (Math.abs(ds) < 1.4 && Math.abs(p.lane * LW - g.x) < 1.35 && Math.abs(p.y + 0.9 - g.yLogic) < 1.8) {
      p.done = true;
      m.saved++;
      g.scene.remove(p.obj);
      g.skills.add('rescue');
      g.coins += 10;
      g.ui.pop('SAVED!', '#a8f03a', 50, 44, 50);
      g.audio.play('power');
      g.particles.burst(w, 0xa8f03a, 30, 7, 0.7, 2, 3);
    } else if (ds < -4) {
      p.done = true;
      m.missed++;
      g.scene.remove(p.obj);
      g.ui.pop('MISSED…', '#ff9a2e', 50, 44, 40);
    }
  }

  // ── HEIST: chase the villain van, land on its roof three times ──
  heist() {
    const g = this.g;
    const van = villainVan(g.mats);
    g.scene.add(van);
    const m = { tags: 0, goal: 3, vanS: g.s + 70, lane: 0, x: 0, t: 0, laneT: 3, dropT: 2, bounce: 0, reward: 5000, coins: 35 };
    m.winText = 'HEIST STOPPED!';
    m.failText = 'THEY GOT AWAY…';
    const TOP = 3.0;
    g.ui.pop('STOP THAT VAN!', '#a8f03a', 50, 36, 50);
    m.update = (dt) => {
      m.t += dt;
      // The van is a touch slower than you: the gap closes, faster with momentum.
      m.vanS += Math.max(8, g.speed - 3.5) * dt;
      m.laneT -= dt;
      if (m.laneT <= 0) {
        m.lane = pick(lanes.filter((l) => l !== m.lane));
        m.laneT = rand(2.5, 4);
      }
      m.x += (m.lane * LW - m.x) * (1 - Math.exp(-3 * dt));
      const w = g.path.toWorld(m.vanS, m.x, 0);
      const seg = g.path.segAt(m.vanS);
      van.position.copy(w);
      van.rotation.y = seg.yaw + Math.PI + (m.lane * LW - m.x) * -0.08;
      van.position.y += Math.abs(Math.sin(m.t * 9)) * 0.05;
      // It plows through anything in its lane.
      for (const sg of g.path.segments) {
        for (const ob of sg.obstacles) {
          if (!ob.alive || ob.step || Math.abs(sg.startS + ob.d - m.vanS) > 3.6 || Math.abs(ob.x - m.x) > 1.6) continue;
          g.smash(ob, true);
        }
      }
      // Drop barrels behind it.
      m.dropT -= dt;
      if (m.dropT <= 0 && m.vanS - g.s > 18) {
        m.dropT = rand(2, 3.2);
        const dseg = g.path.segAt(m.vanS - 4);
        const dd = m.vanS - 4 - dseg.startS;
        if (dd > 10 && dd < dseg.length - 10) {
          const bar = buildInto(new THREE.Group(), g.mats, (B) => {
            B.cyl('metal', 0, 0.6, 0, 0.45, 1.2, 0x3fc7ff);
            B.cyl('metal', 0, 0.6, 0, 0.47, 0.12, 0x1b1030);
          });
          bar.position.set(m.lane * LW, dseg.floorY(dd), -dd);
          dseg.group.add(bar);
          g.hazards.addObstacle(dseg, { kind: 'low', lane: m.lane, d: dd, x: m.lane * LW, group: bar, hw: 0.8, hd: 0.5, yMax: 1.25 });
        }
      }
      // Tag: come down on its roof. Anything else is a bump.
      const ds = m.vanS - g.s;
      if (Math.abs(ds) < 3.2 && Math.abs(m.x - g.x) < 1.5) {
        const feet = g.yLogic - CFG.bodyHalfH;
        if (feet >= TOP - 0.6 && g.vy <= 1) {
          m.tags++;
          g.vy = 13;
          g.jumps = 1;
          m.vanS += 22;
          g.shake = 0.6;
          g.audio.play('slam');
          g.skills.add('tag');
          g.ui.pop(`TAG ${m.tags}/3!`, '#a8f03a', 50, 44, 54);
          g.particles.burst(van.position.clone().setY(van.position.y + TOP), 0xa8f03a, 26, 8, 0.6, 6, 3);
        } else if (g.invuln <= 0) {
          g.hit(null, 'van');
          m.vanS += 10;
        }
      }
      g.ui.objective('THE HEX HEIST', `roof tags ${m.tags} / ${m.goal}`, m.tags / m.goal);
      if (m.tags >= m.goal) {
        // Spin it out with real physics.
        const seg2 = g.path.segAt(m.vanS);
        g.physics.add(van, new THREE.Vector3(1.2, 1.5, 3.2), new THREE.Vector3(0, 1.5, 0), seg2.fwd.clone().multiplyScalar(g.speed * 0.6).add(new THREE.Vector3(0, 9, 0)).addScaledVector(seg2.right, rand(-6, 6)), new THREE.Vector3(rand(-3, 3), rand(-6, 6), rand(-4, 4)), { mass: 4, life: 3.5 });
        m.gone = true;
        g.audio.play('boom');
        g.ui.pop('KA-CRASH!', '#ffd84a', 50, 30, 70);
        return 'win';
      }
      if (m.t > 55) return 'fail';
      return null;
    };
    m.cleanup = () => {
      if (!m.gone) g.scene.remove(van);
    };
    return m;
  }

  // ── GAUNTLET: survive a wave of runaway trains (subway, noir) ──
  gauntlet() {
    const g = this.g;
    const m = { t: 0, len: 32, trainT: 1.5, strikes0: g.strikes, reward: 3500, coins: 20 };
    m.winText = 'GAUNTLET SURVIVED!';
    m.update = (dt) => {
      m.t += dt;
      m.trainT -= dt;
      if (m.trainT <= 0 && g.curSeg.zone === 'subway') {
        g.hazards.rampage();
        m.trainT = rand(2.2, 3.4);
      }
      g.hazards.timer = Math.max(g.hazards.timer, 2); // keep other hazards quiet
      g.ui.objective('THE GAUNTLET', `survive ${Math.max(0, Math.ceil(m.len - m.t))}s`, m.t / m.len);
      return m.t >= m.len ? 'win' : null;
    };
    return m;
  }

  // ── BOSS: the Alpha Hound runs backwards ahead of you and attacks ──
  boss() {
    const g = this.g;
    const mini = g.monster.makeMini(1.45);
    const boss = new THREE.Group();
    if (mini) boss.add(mini.root);
    g.scene.add(boss);
    const m = { hp: 5, maxHp: 5, t: 0, x: 0, lane: 0, bombT: 2.5, slamT: 5, coreT: 6, hurtT: 0, cores: [], bombs: [], waves: [], reward: 7000, coins: 50 };
    m.winText = 'ALPHA DOWN!';
    m.failText = 'IT ESCAPED… FOR NOW';
    g.monster.roar();
    g.audio.play('roar');
    m.update = (dt) => {
      m.t += dt;
      const bossS = g.s + 30 + Math.sin(m.t * 0.7) * 4;
      if (Math.random() < dt * 0.4) m.lane = pick(lanes);
      m.x += (m.lane * LW - m.x) * (1 - Math.exp(-2 * dt));
      const seg = g.path.segAt(bossS);
      boss.position.copy(g.path.toWorld(bossS, m.x, 0));
      boss.rotation.y = seg.yaw; // faces back toward you
      mini?.update(dt * (m.hurtT > 0 ? 0.3 : 1));
      m.hurtT = Math.max(0, m.hurtT - dt);
      boss.scale.setScalar(1 + (m.hurtT > 0 ? Math.sin(m.t * 40) * 0.04 : 0));
      // Ink bombs lobbed at the lane you're in.
      m.bombT -= dt;
      if (m.bombT <= 0) {
        m.bombT = rand(1.8, 2.8);
        const from = boss.position.clone().setY(boss.position.y + 3);
        const T = 1.0;
        const lane = g.lane;
        const landS = g.s + g.speed * T;
        const to = g.path.toWorld(landS, lane * LW, 1.2);
        const orb = buildInto(new THREE.Group(), g.mats, (B) => B.add('solid', PRIM.sphere, mat4(0, 0, 0, 0.8, 0.8, 0.8), 0x2a0a40));
        g.scene.add(orb);
        m.bombs.push({ orb, from, to, t: 0, T, lane });
        g.audio.play('whoosh');
      }
      for (const b of m.bombs) {
        b.t += dt;
        const k = Math.min(1, b.t / b.T);
        b.orb.position.lerpVectors(b.from, b.to, k);
        b.orb.position.y += Math.sin(k * Math.PI) * 4;
        if (Math.random() < 0.5) g.particles.burst(b.orb.position, 0x7b1fa2, 1, 1, 0.4, 0, 2);
        if (k >= 1) {
          b.done = true;
          g.scene.remove(b.orb);
          g.particles.burst(b.to, 0x7b1fa2, 30, 7, 0.8, 8, 2);
          if (Math.abs(g.x - b.lane * LW) < 1.3 && g.mode !== 'dive' && g.yLogic - (g.ground || 0) < 3.4) g.hit(null, 'ink');
          else g.skills.add('dodge', 0.5);
        }
      }
      m.bombs = m.bombs.filter((b) => !b.done);
      // Ground slam: a shock ring rolls down all lanes. Hop it.
      m.slamT -= dt;
      if (m.slamT <= 0) {
        m.slamT = rand(5.5, 7.5);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2fd0).multiplyScalar(3) }));
        ring.layers.set(LAYER_NO_OUTLINE);
        g.scene.add(ring);
        m.waves.push({ ring, s: bossS - 2, hit: false });
        g.shake = Math.max(g.shake, 0.7);
        g.audio.play('slam');
        g.ui.pop('HOP!', '#ff2fd0', 50, 52, 44);
      }
      for (const w of m.waves) {
        w.s -= 26 * dt;
        const wseg = g.path.segAt(w.s);
        w.ring.position.copy(g.path.toWorld(w.s, 0, 0.35));
        w.ring.rotation.set(Math.PI / 2, 0, wseg.yaw);
        w.ring.scale.set(4.2, 0.5, 1);
        if (!w.hit && Math.abs(w.s - g.s) < 0.8) {
          w.hit = true;
          if (g.yLogic - CFG.bodyHalfH - (g.ground || 0) < 0.6) g.hit(null, 'slam');
          else g.skills.add('hopOver');
        }
        if (w.s < g.s - 6) {
          w.done = true;
          g.scene.remove(w.ring);
        }
      }
      m.waves = m.waves.filter((w) => !w.done);
      // Light cores: grab one and it blasts the boss.
      m.coreT -= dt;
      if (m.coreT <= 0 && m.cores.length < 2) {
        m.coreT = rand(4, 6);
        const core = lightCore(g.mats);
        g.scene.add(core);
        m.cores.push({ core, s: g.s + 34, lane: pick(lanes), y: 1.8 + (Math.random() < 0.35 ? 2.2 : 0) });
      }
      for (const c of m.cores) {
        c.core.position.copy(g.path.toWorld(c.s, c.lane * LW, c.y));
        c.core.rotation.y += dt * 3;
        if (Math.abs(c.s - g.s) < 1.3 && Math.abs(c.lane * LW - g.x) < 1.3 && Math.abs(c.y - g.yLogic) < 1.6) {
          c.done = true;
          g.scene.remove(c.core);
          m.hp--;
          m.hurtT = 0.8;
          g.monster.roar();
          g.audio.play('boom');
          g.shake = 1;
          g.pipeline.uniforms.hitFlash.value = 0.6;
          g.ui.pop('BLAST!', '#fff6a0', 50, 30, 66);
          g.particles.burst(boss.position.clone().setY(boss.position.y + 3), 0xfff6a0, 50, 12, 1, 4, 3);
        } else if (c.s < g.s - 5) {
          c.done = true;
          g.scene.remove(c.core);
        }
      }
      m.cores = m.cores.filter((c) => !c.done);
      g.ui.objective('ALPHA HOUND', `grab light cores · HP ${m.hp}/${m.maxHp}`, m.hp / m.maxHp, true);
      if (m.hp <= 0) {
        g.physics.rubble(boss.position.clone().setY(boss.position.y + 2), 16, 14, 0.9);
        g.particles.burst(boss.position.clone().setY(boss.position.y + 2), 0x7b1fa2, 80, 14, 1.2, 6, 2.5);
        g.ui.pop('KA-POW!', '#ffd84a', 50, 30, 90);
        return 'win';
      }
      return m.t > 80 ? 'fail' : null;
    };
    m.cleanup = () => {
      g.scene.remove(boss);
      for (const b of m.bombs) g.scene.remove(b.orb);
      for (const w of m.waves) g.scene.remove(w.ring);
      for (const c of m.cores) g.scene.remove(c.core);
    };
    return m;
  }
}

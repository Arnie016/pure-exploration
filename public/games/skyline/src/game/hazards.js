import * as THREE from 'three';
import { CFG } from '../config.js';
import { Buckets, PRIM, mat4 } from '../world/geo.js';
import { trainCar } from '../world/props.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LW = CFG.laneWidth;
const W = CFG.corridorHalf;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3();

// ── small procedural models ──

export function buildInto(group, mats, fn) {
  const B = new Buckets();
  fn(B);
  B.build(mats, group, new Set(['solid', 'metal', 'bldBrick']), new Set());
  group.traverse((o) => {
    if (o.isMesh && o.material === mats.glowV) o.layers.set(LAYER_NO_OUTLINE);
  });
  return group;
}

function rubbleChunk(mats) {
  return buildInto(new THREE.Group(), mats, (B) => {
    B.building('bldBrick', 0, 0, 0, 2.3, 2.3, 2.1, pick([0xff8a7a, 0xe8d2b0, 0xc8583f, 0xd9b8ff]), 1.6, 1.8);
    for (let i = 0; i < 4; i++) B.cyl('metal', rand(-0.8, 0.8), 2.3 + 0.3, rand(-0.8, 0.8), 0.04, 0.9, 0x6a5a7a, rand(-0.5, 0.5), 0, rand(-0.5, 0.5), true);
  });
}

function facadeSlab(mats) {
  // 9 m tall, 6 m wide chunk of building front; it hinges at its base.
  return buildInto(new THREE.Group(), mats, (B) => {
    B.building('bldBrick', 0, 0, 0, 0.8, 9, 6, pick([0xff8a7a, 0xffc36b, 0xf2a0c8, 0x9fe3c9]), 1.6, 1.8);
    B.box('solid', 0, 9.1, 0, 1.0, 0.3, 6.2, 0xe8e0f0);
    B.box('glowV', -0.45, 5.5, 0, 0.05, 1.2, 4.4, 0xff3fa4, 0, 0, 0, 3);
  });
}

export function goon(mats, color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  buildInto(body, mats, (B) => {
    B.add('solid', PRIM.cyl, mat4(-0.13, 0.45, 0, 0.2, 0.9, 0.2), 0x2b2640);
    B.add('solid', PRIM.cyl, mat4(0.13, 0.45, 0, 0.2, 0.9, 0.2), 0x2b2640);
    B.add('solid', PRIM.box, mat4(0, 1.2, 0, 0.55, 0.7, 0.32), color);
    B.add('solid', PRIM.sphere, mat4(0, 1.72, 0, 0.36, 0.4, 0.36), 0x8a5a44);
    B.add('solid', PRIM.box, mat4(0, 1.68, 0.12, 0.34, 0.12, 0.14), 0xd6203a); // bandana
    B.add('solid', PRIM.cyl, mat4(0, 1.92, -0.02, 0.4, 0.12, 0.4), 0x1b1030); // beanie
    B.add('solid', PRIM.cyl, mat4(-0.34, 1.2, 0, 0.14, 0.6, 0.14), color);
  });
  const arm = new THREE.Group();
  arm.position.set(0.34, 1.45, 0);
  body.add(arm);
  buildInto(arm, mats, (B) => B.add('solid', PRIM.cyl, mat4(0, -0.3, 0, 0.14, 0.62, 0.14), color));
  g.userData.arm = arm;
  return g;
}

export function trashCan(mats) {
  return buildInto(new THREE.Group(), mats, (B) => {
    B.cyl('metal', 0, 0, 0, 0.32, 0.8, 0x9aa7c7);
    B.cyl('metal', 0, 0.43, 0, 0.36, 0.08, 0x7b86a8);
    B.box('glowV', 0, 0.46, 0, 0.25, 0.03, 0.06, 0xa8f03a, 0, 0, 0, 2.5);
  });
}

function imp(mats) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  buildInto(body, mats, (B) => {
    B.add('solid', PRIM.sphere, mat4(0, 0.62, 0, 0.9, 0.75, 1.0), 0x241036);
    B.add('solid', PRIM.sphere, mat4(0, 0.92, 0.42, 0.6, 0.5, 0.55), 0x241036);
    B.add('solid', PRIM.cone, mat4(-0.2, 1.22, 0.36, 0.12, 0.34, 0.12, -0.4, 0, 0.3), 0x5a1f8a);
    B.add('solid', PRIM.cone, mat4(0.2, 1.22, 0.36, 0.12, 0.34, 0.12, -0.4, 0, -0.3), 0x5a1f8a);
    B.add('glowV', PRIM.sphere, mat4(-0.13, 0.98, 0.66, 0.1, 0.07, 0.05), 0xff2fd0, 4);
    B.add('glowV', PRIM.sphere, mat4(0.13, 0.98, 0.66, 0.1, 0.07, 0.05), 0xff2fd0, 4);
    for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]]) B.add('solid', PRIM.cyl, mat4(x, 0.22, z, 0.12, 0.45, 0.12), 0x1b0a2a);
  });
  g.userData.body = body;
  return g;
}

function bat(mats) {
  const g = new THREE.Group();
  buildInto(g, mats, (B) => {
    B.add('solid', PRIM.sphere, mat4(0, 0, 0, 0.45, 0.4, 0.6), 0x1d1033);
    B.add('glowV', PRIM.sphere, mat4(-0.1, 0.06, 0.26, 0.08, 0.06, 0.04), 0xff2fd0, 4);
    B.add('glowV', PRIM.sphere, mat4(0.1, 0.06, 0.26, 0.08, 0.06, 0.04), 0xff2fd0, 4);
  });
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.x = side * 0.18;
    buildInto(wing, mats, (B) => {
      B.add('solid', PRIM.cone, mat4(side * 0.55, 0, 0, 0.5, 1.1, 0.08, 0, 0, side * Math.PI / 2), 0x2b1446);
    });
    g.add(wing);
    g.userData[side < 0 ? 'wl' : 'wr'] = wing;
  }
  return g;
}

function tentacle(mats) {
  // A chain of pivots so it can writhe; ink-black with a glowing tip.
  const root = new THREE.Group();
  let parent = root;
  const joints = [];
  for (let i = 0; i < 6; i++) {
    const j = new THREE.Group();
    j.position.y = i === 0 ? 0 : 0.75;
    parent.add(j);
    buildInto(j, mats, (B) => {
      const r = 0.42 - i * 0.06;
      B.add('solid', PRIM.cyl, mat4(0, 0.4, 0, r * 2, 0.85, r * 2), 0x1d1033);
      if (i % 2 === 0) B.add('solid', PRIM.cone, mat4(r * 0.9, 0.4, 0, 0.12, 0.3, 0.12, 0, 0, -1.2), 0x5a1f8a);
      if (i === 5) B.add('glowV', PRIM.sphere, mat4(0, 0.9, 0, 0.3, 0.3, 0.3), 0xff2fd0, 3.5);
    });
    joints.push(j);
    parent = j;
  }
  root.userData.joints = joints;
  return root;
}

function ratGeometry() {
  const parts = [];
  const add = (geo, m, col) => {
    const g = geo.toNonIndexed();
    g.applyMatrix4(m);
    const c = new THREE.Color(col);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  add(PRIM.sphere, mat4(0, 0.16, 0, 0.3, 0.26, 0.55), 0x4a4058);
  add(PRIM.sphere, mat4(0, 0.2, 0.28, 0.2, 0.18, 0.24), 0x5a506a);
  add(PRIM.sphere, mat4(-0.07, 0.3, 0.24, 0.09, 0.09, 0.03), 0xf2a0c8);
  add(PRIM.sphere, mat4(0.07, 0.3, 0.24, 0.09, 0.09, 0.03), 0xf2a0c8);
  add(PRIM.cyl, mat4(0, 0.12, -0.45, 0.03, 0.5, 0.03, Math.PI / 2 - 0.3, 0, 0), 0xf2a0c8);
  return mergeGeometries(parts);
}

/**
 * Set-piece hazards that spawn ahead of the hero, each telegraphed (marker,
 * shout, horn) and then resolved as ordinary lane obstacles so collision stays
 * fair. Visual flourish (tumbling debris) goes through Physics.
 */
export class Hazards {
  constructor(game) {
    this.g = game;
    this.list = [];
    const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2f4a).multiplyScalar(2.5), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    this.markerGeo = new THREE.RingGeometry(0.85, 1.25, 32);
    this.markerMat = markerMat;
    this.ratMesh = new THREE.InstancedMesh(ratGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 48);
    this.ratMesh.count = 0;
    this.ratMesh.frustumCulled = false;
    this.ratMesh.castShadow = true;
    game.scene.add(this.ratMesh);
    this.reset();
  }

  reset() {
    for (const h of this.list) h.cleanup?.();
    this.list = [];
    this.timer = 7;
    this.ratMesh.count = 0;
  }

  /** A spot the hero reaches in T seconds, away from corners and ramps. */
  spotAhead(T, extra = 0) {
    const g = this.g;
    const s = g.s + g.speed * T + extra;
    g.path.ensure(s + 30);
    const seg = g.path.segAt(s);
    const d = s - seg.startS;
    const lo = Math.max(seg.floorStart, seg.transStart + (seg.transLen > 1 ? seg.transLen : 0)) + 8;
    const hi = seg.length - (seg.turnEnd ? CFG.turnWindow + 6 : 10);
    if (d < lo || d > hi) return null;
    return { seg, d, s };
  }

  /** Would blocking `lanes` near d still leave a clean lane? */
  laneFree(seg, d, lanes, range = 7) {
    const blocked = new Set(lanes);
    for (const ob of seg.obstacles) {
      if (!ob.alive || Math.abs(ob.d - d) > range + ob.hd) continue;
      if (ob.kind === 'block' || ob.moving) blocked.add(ob.lane);
    }
    return blocked.size < 3;
  }

  marker(seg, d, x, big = 1) {
    const m = new THREE.Mesh(this.markerGeo, this.markerMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, seg.floorY(d) + 0.06, -d);
    m.scale.setScalar(big);
    m.layers.set(LAYER_NO_OUTLINE);
    seg.group.add(m);
    return m;
  }

  addObstacle(seg, props) {
    const ob = { alive: true, moving: 0, yMin: 0, ...props };
    seg.obstacles.push(ob);
    return ob;
  }

  update(dt) {
    const g = this.g;
    if (g.state !== 'playing') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      const ok = this.spawn();
      const diff = Math.min(1, g.runTime / 120);
      this.timer = ok ? rand(4.2, 7) * (1 - diff * 0.45) : 0.7;
    }
    this.list = this.list.filter((h) => {
      const alive = h.update(dt);
      if (!alive) h.cleanup?.();
      return alive;
    });
    this.updateRats(dt);
  }

  spawn() {
    const zone = this.g.curSeg?.zone;
    const table = {
      roof: ['falling', 'falling', 'thrower', 'imps', 'bats', 'bats', 'tentacles'],
      street: ['falling', 'facade', 'facade', 'thrower', 'thrower', 'imps', 'bats', 'tentacles', 'tentacles'],
      office: ['imps', 'imps', 'bats', 'rats'],
      prison: ['thrower', 'thrower', 'imps', 'rats', 'bats', 'tentacles'],
      park: ['falling', 'thrower', 'thrower', 'imps', 'bats', 'bats', 'tentacles'],
      rift: ['imps', 'imps', 'bats', 'tentacles', 'tentacles', 'falling'],
      subway: ['rats', 'rats', 'imps', 'rampage', 'rampage', 'falling', 'bats', 'tentacles'],
    }[zone];
    if (!table) return false;
    const kind = pick(table);
    return this[kind]();
  }

  // ── Falling rubble: marker on your lane, chunk drops out of the sky ──
  falling() {
    const g = this.g;
    const T = 1.9;
    const spot = this.spotAhead(T);
    if (!spot) return false;
    const order = [g.lane, ...[-1, 0, 1].filter((l) => l !== g.lane)];
    const lane = order.find((l) => this.laneFree(spot.seg, spot.d, [l]));
    if (lane === undefined) return false;
    const { seg, d } = spot;
    const x = lane * LW;
    const step = seg.stepAt(d);
    const floor = seg.floorY(d) + step;
    const mark = this.marker(seg, d, x);
    mark.position.y = floor + 0.06;
    const chunk = rubbleChunk(g.mats);
    const h0 = 34;
    chunk.position.set(x, floor + h0, -d);
    seg.group.add(chunk);
    g.audio.play('glass');
    const spin = new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2));
    let t = 0;
    this.list.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / T);
        chunk.position.y = floor + h0 * (1 - k * k);
        chunk.rotation.x += spin.x * dt;
        chunk.rotation.z += spin.z * dt;
        mark.scale.setScalar(1 + Math.sin(t * 18) * 0.12);
        mark.material.opacity = 0.5 + k * 0.5;
        if (k < 1) return true;
        chunk.rotation.set(0, rand(-0.3, 0.3), 0);
        chunk.position.y = floor;
        seg.group.remove(mark);
        this.addObstacle(seg, { kind: 'block', lane, d, x, group: chunk, hw: 1.2, hd: 1.1, yMin: step, yMax: step + 2.3, standable: true });
        const wp = seg.toWorld(d, x, step + 0.8);
        g.physics.rubble(wp, 7, 8, 0.45);
        g.particles.burst(wp, 0xd8d0e8, 26, 9, 0.9, 10, 1.2);
        g.audio.play('slam');
        const near = Math.abs(seg.startS + d - g.s);
        if (near < 25) g.shake = Math.max(g.shake, 0.9 - near * 0.03);
        if (g.lane !== lane && near < 16) g.skills.add('dodge');
        return false;
      },
      cleanup: () => seg.group.remove(mark),
    });
    return true;
  }

  // ── A slab of building front topples across two lanes ──
  facade() {
    const g = this.g;
    const T = 2.5;
    const spot = this.spotAhead(T);
    if (!spot) return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const lanes = side < 0 ? [-1, 0] : [0, 1];
    if (!this.laneFree(spot.seg, spot.d, lanes, 8)) return false;
    const { seg, d } = spot;
    const floor = seg.floorY(d);
    const pivot = new THREE.Group();
    pivot.position.set(side * (W + 1.4), floor, -d);
    const slab = facadeSlab(g.mats);
    pivot.add(slab);
    seg.group.add(pivot);
    const marks = lanes.map((l) => this.marker(seg, d, l * LW, 1.4));
    g.ui.pop('LOOK OUT!', '#ff6b6b', 50, 30, 60);
    g.audio.play('drone');
    let t = 0;
    let landed = false;
    this.list.push({
      update: (dt) => {
        t += dt;
        const fallStart = T - 1.05;
        if (t < fallStart) {
          pivot.rotation.z = side * (Math.sin(t * 40) * 0.015 + t * 0.02);
          if (Math.random() < 0.3) g.particles.burst(_v.copy(seg.toWorld(d, side * (W + 1.4), 0.3)), 0xcfc6dc, 3, 3, 0.6, 5, 1);
        } else if (!landed) {
          const k = Math.min(1, (t - fallStart) / 1.05);
          pivot.rotation.z = side * (0.05 + (Math.PI / 2 - 0.12) * k * k);
          if (k >= 1) {
            landed = true;
            for (const m of marks) seg.group.remove(m);
            for (const l of lanes) {
              this.addObstacle(seg, { kind: 'low', lane: l, d, x: l * LW, group: l === lanes[0] ? pivot : new THREE.Group(), hw: 1.3, hd: 3.1, yMax: 1.2, noFling: true });
            }
            const wp = seg.toWorld(d, lanes[0] * LW * 0.5 + lanes[1] * LW * 0.5, 0.6);
            g.physics.rubble(wp, 12, 10, 0.6);
            g.particles.burst(wp, 0xd8d0e8, 40, 12, 1.1, 8, 1.2);
            g.audio.play('slam');
            g.audio.play('hit');
            const ds = seg.startS + d - g.s;
            g.shake = Math.max(g.shake, Math.abs(ds) < 30 ? 1.3 : 0.4);
            if (Math.abs(ds) < 3.5 && lanes.includes(g.lane)) g.hit(null, 'crush');
            else if (Math.abs(ds) < 18) g.skills.add('dodge');
            return false;
          }
        }
        return true;
      },
      cleanup: () => marks.forEach((m) => seg.group.remove(m)),
    });
    return true;
  }

  // ── A goon on the edge lobs a trash can at the lane you're in ──
  thrower() {
    const g = this.g;
    const spot = this.spotAhead(2.6);
    if (!spot) return false;
    const { seg, d } = spot;
    const side = Math.random() < 0.5 ? -1 : 1;
    const gx = seg.zone === 'roof' ? side * (W + 0.8) : side * (W + 2.3);
    const man = goon(g.mats, pick([0xd6203a, 0x3fc7ff, 0xa8f03a, 0xff9a2e]));
    man.position.set(gx, seg.floorY(d) + (seg.zone === 'street' ? 0.24 : seg.stepAt(d)), -d);
    man.rotation.y = side > 0 ? -0.5 : 0.5; // face the oncoming hero, angled to the road
    seg.group.add(man);
    let t = 0;
    let can = null;
    let flight = null;
    let shouted = false;
    this.list.push({
      update: (dt) => {
        t += dt;
        const arm = man.userData.arm;
        if (!can && t < 1.1) {
          arm.rotation.x = -Math.min(1, t / 1.1) * 2.6; // wind up
          if (t > 0.25 && !shouted) {
            shouted = true;
            g.ui.pop(pick(['HEY!', 'GET HIM!', 'CATCH!']), '#ffd84a', side > 0 ? 70 : 30, 38, 40);
          }
        } else if (!can) {
          arm.rotation.x = 0.8;
          can = trashCan(g.mats);
          man.updateMatrixWorld(true);
          const from = arm.getWorldPosition(new THREE.Vector3());
          const flyT = 0.95;
          const landS = g.s + g.speed * flyT;
          const landSeg = g.path.segAt(landS);
          const to = g.path.toWorld(landS, g.lane * LW, 1.5 + landSeg.stepAt(landS - landSeg.startS));
          can.position.copy(from);
          g.scene.add(can);
          flight = { from, to, t: 0, T: flyT, lane: g.lane, landS };
          g.audio.play('whoosh');
        } else if (flight) {
          flight.t += dt;
          const k = Math.min(1, flight.t / flight.T);
          can.position.lerpVectors(flight.from, flight.to, k);
          can.position.y += Math.sin(k * Math.PI) * 3.2;
          can.rotation.x += dt * 12;
          if (Math.random() < 0.6) g.particles.burst(can.position, 0xa8f03a, 1, 1, 0.35, 0, 2.5);
          if (k >= 1) {
            const hitIt = Math.abs(g.x - flight.lane * LW) < 1.2 && g.mode !== 'dive' && g.yLogic - (g.ground || 0) < 3.6;
            if (hitIt) {
              g.scene.remove(can);
              g.particles.burst(can.position, 0x9aa7c7, 20, 7, 0.7, 10, 1.4);
              g.hit(null, 'can');
            } else {
              g.physics.add(can, new THREE.Vector3(0.34, 0.45, 0.34), new THREE.Vector3(0, 0, 0), new THREE.Vector3((Math.random() - 0.5) * 6, 6, 0).add(_v.subVectors(flight.to, flight.from).setY(0).normalize().multiplyScalar(10)), new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { life: 2.5 });
              g.audio.play('smash');
              g.skills.add('dodge', 0.7);
            }
            flight = null;
          }
        }
        return g.s < seg.startS + d + 12;
      },
      cleanup: () => {
        seg.group.remove(man);
        if (flight && can) g.scene.remove(can);
      },
    });
    return true;
  }

  // ── Subway rat swarm across all lanes: hop it ──
  rats() {
    const g = this.g;
    const spot = this.spotAhead(2.1);
    if (!spot) return false;
    const { seg, d } = spot;
    if (!this.laneFree(seg, d, [], 5)) return false;
    const obs = [-1, 0, 1].map((l) => this.addObstacle(seg, { kind: 'low', lane: l, d, x: l * LW, group: new THREE.Group(), hw: 1.35, hd: 1.4, yMax: 1.0, skill: 'rats' }));
    g.ui.pop('RATS!', '#f2a0c8', 50, 36, 56);
    const rats = [];
    for (let i = 0; i < 26; i++) rats.push({ x: rand(-W, W), dz: rand(-1.4, 1.4), v: rand(5, 9) * (Math.random() < 0.5 ? -1 : 1), hop: rand(0, 6) });
    this.swarm = { seg, d, rats };
    this.list.push({
      update: () => g.s < seg.startS + d + 8,
      cleanup: () => {
        for (const o of obs) o.alive = false;
        if (this.swarm?.seg === seg) this.swarm = null;
      },
    });
    return true;
  }

  updateRats(dt) {
    const sw = this.swarm;
    if (!sw) {
      this.ratMesh.count = 0;
      return;
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const r of sw.rats) {
      r.x += r.v * dt;
      if (r.x > W) r.x = -W;
      if (r.x < -W) r.x = W;
      r.hop += dt * 14;
      const p = sw.seg.toWorld(sw.d + r.dz, r.x, Math.abs(Math.sin(r.hop)) * 0.25);
      q.setFromAxisAngle(_v.set(0, 1, 0), sw.seg.yaw + (r.v > 0 ? -Math.PI / 2 : Math.PI / 2));
      m.compose(p, q, sc);
      this.ratMesh.setMatrixAt(n++, m);
    }
    this.ratMesh.count = n;
    this.ratMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Ink imps burst from a manhole / side tunnel and charge you ──
  imps() {
    const g = this.g;
    const spot = this.spotAhead(2.8, 20);
    if (!spot) return false;
    const { seg, d } = spot;
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5).slice(0, 2);
    if (!this.laneFree(seg, d, [], 30)) return false;
    const floor = seg.floorY(d);
    const origin = seg.toWorld(d, seg.zone === 'subway' ? pick([-W, W]) : 0, 0.3);
    g.particles.burst(origin, 0x7b1fa2, 40, 10, 1, 8, 2);
    g.physics.rubble(origin, 3, 9, 0.4);
    g.audio.play('slam');
    g.ui.pop('INK IMPS!', '#c94dff', 50, 36, 52);
    const obs = lanes.map((l, i) => {
      // Prefer a pup of the real furred hound; fall back to the simple imp.
      const mini = g.monster.makeMini(0.3);
      const body = mini ? new THREE.Group() : imp(g.mats);
      if (mini) {
        body.add(mini.root);
        body.userData.mini = mini;
      }
      body.position.set(l * LW, floor, -(d + i * 3));
      body.rotation.y = 0; // face +z (toward the hero)
      seg.group.add(body);
      return this.addObstacle(seg, { kind: 'low', lane: l, d: d + i * 3, x: l * LW, group: body, hw: 0.8, hd: 0.6, yMax: 1.15, moving: 7, skill: 'imp' });
    });
    let t = 0;
    this.list.push({
      update: (dt) => {
        t += dt;
        for (const o of obs) {
          if (!o.alive) continue;
          if (o.group.userData.mini) {
            o.group.userData.mini.update(dt);
            continue;
          }
          const b = o.group.userData.body;
          b.position.y = Math.abs(Math.sin(t * 16 + o.d)) * 0.25;
          b.rotation.x = Math.sin(t * 16 + o.d) * 0.15;
        }
        return g.s < seg.startS + d + 20;
      },
    });
    return true;
  }

  // ── A flock of ink bats swoops at head height down one lane: dive ──
  bats() {
    const g = this.g;
    const spot = this.spotAhead(0, 70);
    if (!spot) return false;
    const { seg, d } = spot;
    const lane = g.lane;
    if (!this.laneFree(seg, d, [], 40)) return false;
    const floor = seg.floorY(d) + seg.stepAt(d);
    const flock = new THREE.Group();
    const bats = [];
    for (let i = 0; i < 5; i++) {
      const b = bat(g.mats);
      b.position.set(rand(-0.8, 0.8), rand(-0.3, 0.5), -i * 0.9);
      b.userData.ph = rand(0, 6);
      flock.add(b);
      bats.push(b);
    }
    flock.position.set(lane * LW, floor, -d);
    seg.group.add(flock);
    const ob = this.addObstacle(seg, { kind: 'high', lane, d, x: lane * LW, group: flock, hw: 1.1, hd: 2.2, yMin: seg.stepAt(d) + 2.05, yMax: seg.stepAt(d) + 6, moving: 14, skill: 'batDodge' });
    g.ui.pop('BATS! ▾ DIVE', '#c94dff', 50 + lane * 18, 34, 44);
    let t = 0;
    this.list.push({
      update: (dt) => {
        t += dt;
        for (const b of bats) {
          const f = Math.sin(t * 22 + b.userData.ph);
          b.userData.wl.rotation.z = f * 0.9;
          b.userData.wr.rotation.z = -f * 0.9;
        }
        flock.position.y = floor + 2.75 + Math.sin(t * 3) * 0.2;
        return ob.alive && g.s < seg.startS + ob.d + 10;
      },
    });
    return true;
  }

  // ── Ink tentacles erupt from a glowing crack and block a lane ──
  tentacles() {
    const g = this.g;
    const T = 2.0;
    const spot = this.spotAhead(T);
    if (!spot) return false;
    const { seg, d } = spot;
    const lanes = Math.random() < 0.35 ? [g.lane, g.lane === 0 ? pick([-1, 1]) : 0] : [g.lane];
    if (!this.laneFree(seg, d, lanes, 6)) return false;
    const floor = seg.floorY(d) + seg.stepAt(d);
    const marks = lanes.map((l) => this.marker(seg, d, l * LW, 1.1));
    for (const m of marks) m.position.y = floor + 0.06;
    const items = lanes.map((l) => {
      const t = tentacle(g.mats);
      t.position.set(l * LW, floor - 5, -d);
      seg.group.add(t);
      return { t, l };
    });
    let t = 0;
    let up = false;
    this.list.push({
      update: (dt) => {
        t += dt;
        for (const m of marks) m.scale.setScalar(1 + Math.sin(t * 20) * 0.15);
        if (!up && t >= T - 0.35) {
          up = true;
          for (const m of marks) seg.group.remove(m);
          for (const it of items) {
            this.addObstacle(seg, { kind: 'block', lane: it.l, d, x: it.l * LW, group: it.t, hw: 1.0, hd: 0.8, yMax: 4.2, noFling: true, skill: null });
            g.particles.burst(seg.toWorld(d, it.l * LW, seg.stepAt(d) + 0.3), 0x7b1fa2, 30, 9, 0.9, 8, 2);
          }
          g.physics.rubble(seg.toWorld(d, lanes[0] * LW, seg.stepAt(d) + 0.5), 5, 8, 0.4);
          g.audio.play('slam');
          g.shake = Math.max(g.shake, 0.5);
        }
        for (const it of items) {
          const target = up ? floor : floor - 5;
          it.t.position.y += (target - it.t.position.y) * (1 - Math.exp(-14 * dt));
          it.t.userData.joints.forEach((j, i) => {
            j.rotation.z = Math.sin(t * 3 + i * 0.7 + it.l) * 0.25;
            j.rotation.x = Math.cos(t * 2.4 + i * 0.6) * 0.18;
          });
        }
        return g.s < seg.startS + d + 15;
      },
      cleanup: () => marks.forEach((m) => seg.group.remove(m)),
    });
    return true;
  }

  // ── A runaway train screams down your lane ──
  rampage() {
    const g = this.g;
    const spot = this.spotAhead(0, 150);
    if (!spot || spot.seg.zone !== 'subway') return false;
    const { seg, d } = spot;
    const lane = g.lane;
    // Clear its lane and make sure the other two never both close up on the way.
    for (const ob of seg.obstacles) {
      if (!ob.alive || ob.d > d || ob.d < d - 150) continue;
      if (ob.lane === lane) {
        ob.alive = false;
        ob.group.visible = false;
      }
    }
    const rows = new Map();
    for (const ob of seg.obstacles) {
      if (!ob.alive || ob.kind !== 'block' || ob.d > d || ob.d < d - 150) continue;
      const k = Math.round(ob.d / 6);
      rows.set(k, (rows.get(k) || 0) + 1);
    }
    if ([...rows.values()].some((c) => c >= 2)) return false;
    const group = new THREE.Group();
    buildInto(group, g.mats, (B) => trainCar(B, 0, 0, 0, 16, 0xff2f4a));
    const lamp = new THREE.PointLight(0xfff0d0, 60, 40, 1.4);
    lamp.position.set(0, 1.5, 9);
    group.add(lamp);
    group.position.set(lane * LW, seg.floorY(d), -d);
    seg.group.add(group);
    this.addObstacle(seg, { kind: 'block', lane, d, x: lane * LW, group, hw: 1.2, hd: 8, yMax: 3.9, moving: 30, noFling: true, standable: true });
    g.audio.play('train');
    g.ui.pop(`◂ TRAIN! ▸`, '#ff2f4a', 50 + lane * 18, 30, 54);
    this.list.push({ update: () => false });
    return true;
  }
}

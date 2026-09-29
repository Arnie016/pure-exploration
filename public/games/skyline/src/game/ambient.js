import * as THREE from 'three';
import { Buckets } from '../world/geo.js';
import * as PR from '../world/props.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';
import { CFG } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const W = CFG.corridorHalf;
const LW = CFG.laneWidth;
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

const OPEN = new Set(['roof', 'street', 'park', 'rift']);

/**
 * Background life: the city reacts to the invasion around you. Nothing here
 * touches gameplay except the near-miss car drop, which lands in a lane you
 * are not in and then becomes an ordinary obstacle.
 */
export class Ambient {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    // Helicopters with sweeping searchlights.
    this.helis = [0, 1].map((i) => this.makeHeli(i));
    // Blimp drifting over the skyline.
    this.blimp = this.makeBlimp();
    // Flock of crows / pigeons.
    this.birds = this.makeBirds(26);
    this.flock = null;
    // Pedestrians fleeing along the sidewalks.
    this.peds = this.makePeds(36);
    // Distant raids: flash + smoke plume.
    this.raids = [0, 1, 2].map(() => this.makeRaid());
    this.raidT = 4;
    // Harmless background car drops + near misses.
    this.drops = [];
    this.dropT = 6;
    this.closeT = 14;
    this.sirenT = 5;
    this.birdT = 3;
    // Zone weather.
    this.weather = this.makeWeather(500);
  }

  // ───────────── builders ─────────────
  makeHeli(i) {
    const g = new THREE.Group();
    const B = new Buckets();
    B.box('solid', 0, 0, 0, 1.6, 1.4, 3.2, i ? 0x2b2640 : 0xf4f4f4);
    B.box('metal', 0, 0.15, 1.2, 1.3, 0.9, 0.8, 0x3d4f86);
    B.box('solid', 0, 0.2, -3, 0.3, 0.4, 3.2, i ? 0x2b2640 : 0xf4f4f4);
    B.box('solid', 0, 0.8, -4.4, 0.1, 1.2, 0.6, 0xd6203a);
    B.box('metal', -0.6, -0.95, 0, 0.1, 0.1, 3, 0x1b1030);
    B.box('metal', 0.6, -0.95, 0, 0.1, 0.1, 3, 0x1b1030);
    B.build(this.g.mats, g);
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0x1b1030, transparent: true, opacity: 0.55 });
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.35), rotorMat);
    rotor.position.y = 0.95;
    g.add(rotor);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2f4a).multiplyScalar(4) }));
    blink.position.set(0, -0.8, 0);
    g.add(blink);
    // Searchlight cone: tip at the heli, base on the ground.
    const coneGeo = new THREE.CylinderGeometry(0.2, 5, 1, 24, 1, true);
    coneGeo.translate(0, -0.5, 0);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.layers.set(LAYER_NO_OUTLINE);
    blink.layers.set(LAYER_NO_OUTLINE);
    rotor.layers.set(LAYER_NO_OUTLINE);
    this.root.add(g, cone);
    g.visible = cone.visible = false;
    return { g, rotor, blink, cone, ang: i * Math.PI, center: new THREE.Vector3(), on: false, side: i ? -1 : 1, beam: new THREE.Vector3() };
  }

  makeBlimp() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: 0xe8e0f0, roughness: 0.6 }));
    body.scale.set(9, 9, 26);
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(9.1, 9.1, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3fa4).multiplyScalar(1.8) }));
    band.rotation.x = Math.PI / 2;
    band.layers.set(LAYER_NO_OUTLINE);
    g.add(band);
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 5), body.material);
      fin.position.set(Math.sin(r) * 5, Math.cos(r) * 5, -22);
      fin.rotation.z = -r;
      g.add(fin);
    }
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x2b2640 }));
    gondola.position.y = -9.5;
    g.add(gondola);
    this.root.add(g);
    g.visible = false;
    return { g, t: 0, pos: new THREE.Vector3(), placed: false };
  }

  makeBirds(n) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, -0.9, 0.25, -0.2, 0, 0, -0.3, 0, 0, 0.3, 0.9, 0.25, -0.2, 0, 0, -0.3], 3));
    geo.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x1b1030, side: THREE.DoubleSide }), n);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return { mesh, list: Array.from({ length: n }, () => ({ o: new THREE.Vector3(), ph: Math.random() * 6 })) };
  }

  makePeds(n) {
    const B = new Buckets();
    B.box('solid', 0, 0.55, 0, 0.45, 0.7, 0.3, 0xffffff);
    B.box('solid', 0, 0.12, 0, 0.35, 0.3, 0.25, 0x2b2640);
    B.box('solid', 0, 1.08, 0, 0.3, 0.3, 0.3, 0xe0ac86);
    const tmp = new THREE.Group();
    B.build({ solid: new THREE.MeshStandardMaterial({ vertexColors: true }) }, tmp);
    const geo = tmp.children[0].geometry;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    const cols = [0xff3fa4, 0x3fc7ff, 0xffd84a, 0xa8f03a, 0xff9a2e, 0x7b4dff, 0xf4f4f4, 0xd6203a];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) mesh.setColorAt(i, c.set(pick(cols)));
    this.root.add(mesh);
    return { mesh, list: Array.from({ length: n }, () => ({ s: -1e9, x: 0, v: 0, ph: 0 })) };
  }

  makeRaid() {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a2e).multiplyScalar(4), transparent: true, depthWrite: false }));
    flash.layers.set(LAYER_NO_OUTLINE);
    const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x3a2f4a, roughness: 1, transparent: true, opacity: 0.85 }), 14);
    puffs.frustumCulled = false;
    const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.2, 1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1b0a2a, emissive: 0x7b4dff, emissiveIntensity: 0.4 }));
    tent.geometry.translate(0, 0.5, 0);
    this.root.add(flash, puffs, tent);
    flash.visible = puffs.visible = tent.visible = false;
    return { flash, puffs, tent, t: 99, pos: new THREE.Vector3(), seeds: Array.from({ length: 14 }, () => [rand(-3, 3), rand(0, 1), rand(-3, 3), rand(0.6, 1.4)]) };
  }

  makeWeather(n) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.layers.set(LAYER_NO_OUTLINE);
    this.root.add(pts);
    return { pts, pos, col, vel: new Float32Array(n * 3), n, zone: null };
  }

  // ───────────── update ─────────────
  update(dt) {
    const g = this.g;
    if (!['playing', 'dying', 'title'].includes(g.state) || !g.curSeg) return;
    const zone = g.curSeg.zone;
    const open = OPEN.has(zone);
    const t = g.elapsed;
    this.updateHelis(dt, zone, t);
    this.updateBlimp(dt, open);
    this.updateBirds(dt, zone);
    this.updatePeds(dt, zone);
    this.updateRaids(dt, open);
    this.updateDrops(dt, zone);
    this.updateWeather(dt, zone);
    if (g.state === 'playing' && zone === 'street' && (this.sirenT -= dt) <= 0) {
      this.sirenT = rand(9, 18);
      g.audio.play(pick(['siren', 'siren', 'horn']));
    }
  }

  updateHelis(dt, zone, t) {
    const g = this.g;
    for (const h of this.helis) {
      const want = zone !== 'subway' && (h.side > 0 || zone === 'street' || zone === 'roof');
      h.g.visible = h.cone.visible = want;
      if (!want) {
        h.on = false;
        continue;
      }
      const c = g.path.toWorld(g.s + 70, h.side * 16, 30, _v);
      if (!h.on) {
        h.center.copy(c);
        h.on = true;
      }
      h.center.lerp(c, 1 - Math.exp(-0.8 * dt));
      h.ang += dt * 0.5;
      const p = h.g.position.set(h.center.x + Math.cos(h.ang) * 22, h.center.y + Math.sin(t * 0.7 + h.side) * 2, h.center.z + Math.sin(h.ang) * 22);
      h.g.lookAt(p.x - Math.sin(h.ang) * 5, p.y, p.z + Math.cos(h.ang) * 5);
      h.g.rotateZ(0.18);
      h.rotor.rotation.y += dt * 40;
      h.blink.visible = Math.floor(t * 2 + h.side) % 2 === 0;
      // Beam sweeps around the hero.
      const tgt = g.path.toWorld(g.s + 12 + Math.sin(t * 0.8 + h.side) * 10, Math.sin(t * 1.3 + h.side * 2) * 5, 0, h.beam);
      const dir = _s.copy(tgt).sub(p);
      const len = dir.length();
      h.cone.position.copy(p);
      h.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      h.cone.scale.set(1, len, 1);
    }
  }

  updateBlimp(dt, open) {
    const g = this.g;
    const b = this.blimp;
    b.g.visible = open;
    if (!open) return;
    const want = g.path.toWorld(g.s + 260, -120, 95, _v);
    if (!b.placed || b.g.position.distanceTo(want) > 400) {
      b.g.position.copy(want);
      b.placed = true;
    }
    b.g.position.lerp(want, 1 - Math.exp(-0.15 * dt));
    b.g.lookAt(g.camera.position.x, b.g.position.y, g.camera.position.z);
    b.g.rotateY(Math.PI / 2);
  }

  updateBirds(dt, zone) {
    const g = this.g;
    const B = this.birds;
    if (!this.flock && (zone === 'park' || zone === 'roof' || zone === 'street') && (this.birdT -= dt) <= 0) {
      this.birdT = rand(8, 16);
      const side = Math.random() < 0.5 ? -1 : 1;
      this.flock = { t: 0, from: g.path.toWorld(g.s + rand(40, 70), side * 40, rand(16, 30)), dir: side, seg: g.curSeg };
      if (zone === 'park') g.audio.play('birds');
    }
    if (!this.flock) {
      B.mesh.count = 0;
      return;
    }
    const f = this.flock;
    f.t += dt;
    const n = B.list.length;
    B.mesh.count = n;
    for (let i = 0; i < n; i++) {
      const b = B.list[i];
      const lane = (i % 6) - 2.5;
      const row = Math.floor(i / 6);
      _v.copy(f.from).addScaledVector(f.seg.right, -f.dir * f.t * 14 + row * 2 * f.dir).addScaledVector(f.seg.fwd, lane * 1.6 + Math.sin(f.t * 2 + i) * 0.6);
      _v.y += Math.sin(f.t * 3 + i) * 0.5 + row * 0.4;
      const flap = Math.sin(t0(f.t) * 18 + b.ph);
      _e.set(0, f.seg.yaw + (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
      _q.setFromEuler(_e);
      _s.set(1, 1 + flap * 0.8, 1).multiplyScalar(0.8);
      B.mesh.setMatrixAt(i, _m.compose(_v, _q, _s));
    }
    B.mesh.instanceMatrix.needsUpdate = true;
    if (f.t > 7) this.flock = null;
  }

  updatePeds(dt, zone) {
    const g = this.g;
    const P = this.peds;
    const active = zone === 'street' || zone === 'park';
    if (!active) {
      P.mesh.count = 0;
      for (const p of P.list) p.s = -1e9;
      return;
    }
    P.mesh.count = P.list.length;
    for (let i = 0; i < P.list.length; i++) {
      const p = P.list[i];
      if (p.s < g.s - 20 || p.s > g.s + 160) {
        p.s = g.s + rand(30, 150);
        const side = Math.random() < 0.5 ? -1 : 1;
        p.x = side * (W + rand(1.2, 4.2));
        p.v = rand(3, 7) * (Math.random() < 0.7 ? 1 : -1);
        p.ph = Math.random() * 6;
        p.panic = Math.random() < 0.5;
      }
      p.s += p.v * dt;
      p.ph += dt * Math.abs(p.v) * 2.2;
      const seg = g.path.segAt(p.s);
      seg.toWorld(p.s - seg.startS, p.x, Math.abs(Math.sin(p.ph)) * 0.18 + (zone === 'street' ? 0.24 : 0), _v);
      _e.set(p.panic ? Math.sin(p.ph) * 0.15 : 0, seg.yaw + (p.v > 0 ? 0 : Math.PI), 0);
      _q.setFromEuler(_e);
      _s.set(1, 1, 1).multiplyScalar(1.5);
      P.mesh.setMatrixAt(i, _m.compose(_v, _q, _s));
    }
    P.mesh.instanceMatrix.needsUpdate = true;
    if (g.state === 'playing' && Math.random() < dt * 0.08) g.audio.play('scream');
  }

  updateRaids(dt, open) {
    const g = this.g;
    if (open && g.state === 'playing' && (this.raidT -= dt) <= 0) {
      this.raidT = rand(5, 11);
      const r = this.raids.find((x) => x.t > 9);
      if (r) {
        const side = Math.random() < 0.5 ? -1 : 1;
        g.path.toWorld(g.s + rand(90, 220), side * rand(45, 120), rand(15, 60), r.pos);
        r.t = 0;
        r.tentacle = Math.random() < 0.45;
        const dist = r.pos.distanceTo(g.camera.position);
        setTimeout(() => g.audio.play('distantBoom', dist), Math.min(900, dist * 3));
      }
    }
    for (const r of this.raids) {
      r.t += dt;
      const on = r.t < 9;
      r.flash.visible = on && r.t < 0.7;
      r.puffs.visible = on;
      r.tent.visible = on && r.tentacle && r.t < 5;
      if (!on) continue;
      if (r.flash.visible) {
        r.flash.position.copy(r.pos);
        r.flash.scale.setScalar(3 + r.t * 16);
        r.flash.material.opacity = 1 - r.t / 0.7;
      }
      for (let i = 0; i < r.seeds.length; i++) {
        const [sx, sy, sz, ss] = r.seeds[i];
        const k = Math.max(0, r.t - sy * 0.8);
        _v.set(r.pos.x + sx * (1 + k * 0.4), r.pos.y + k * 4 + sy * 3, r.pos.z + sz * (1 + k * 0.4));
        _s.setScalar(ss * (1.5 + k * 1.2) * Math.min(1, r.t * 3) * (r.t > 7 ? (9 - r.t) / 2 : 1));
        r.puffs.setMatrixAt(i, _m.compose(_v, _q.identity(), _s));
      }
      r.puffs.instanceMatrix.needsUpdate = true;
      if (r.tent.visible) {
        const grow = Math.min(1, r.t / 0.8) * (r.t > 4 ? (5 - r.t) : 1);
        r.tent.position.copy(r.pos).setY(r.pos.y - 8);
        r.tent.scale.set(1.4, 26 * grow + 0.01, 1.4);
        r.tent.rotation.set(Math.sin(r.t * 2) * 0.4, 0, Math.cos(r.t * 1.6) * 0.4);
      }
    }
  }

  carMesh() {
    const B = new Buckets();
    const f = Math.random();
    if (f < 0.6) PR.taxi(B, 0, 0, 0);
    else PR.bus(B, 0, 0, 0);
    const grp = new THREE.Group();
    B.build(this.g.mats, grp);
    grp.children.forEach((m) => (m.castShadow = true));
    return { grp, big: f >= 0.6 };
  }

  /** Cars tossed off buildings: far background drops, and near misses ~12 m ahead. */
  updateDrops(dt, zone) {
    const g = this.g;
    const canDrop = zone === 'street' || zone === 'park';
    if (canDrop && g.state === 'playing') {
      if ((this.dropT -= dt) <= 0) {
        this.dropT = rand(6, 12);
        const s = g.s + rand(60, 130);
        const side = Math.random() < 0.5 ? -1 : 1;
        this.spawnDrop(s, side * (W + (zone === 'street' ? rand(1.2, 3.4) : rand(4, 12))), false);
      }
      if ((this.closeT -= dt) <= 0) {
        this.closeT = rand(14, 24);
        // Fall time ~1.3 s: start it so it lands when you're ~12 m away.
        const T = 1.3;
        const s = g.s + g.speed * T + 12;
        const seg = g.path.segAt(s);
        const d = s - seg.startS;
        const lanes = [-1, 0, 1].filter((l) => l !== g.lane && Math.abs(l * LW - g.x) > LW * 0.6);
        const free = lanes.filter((l) => !seg.obstacles.some((o) => o.alive && o.lane === l && Math.abs(o.d - d) < 8));
        if (free.length && d > 20 && d < seg.length - CFG.turnWindow - 8 && !seg.obstacles.some((o) => o.alive && Math.abs(o.d - d) < 6 && o.kind === 'block' && o.lane !== free[0])) {
          this.spawnDrop(s, pick(free) * LW, true);
        } else this.closeT = 2;
      }
    }
    this.drops = this.drops.filter((dr) => {
      dr.t += dt;
      const k = Math.min(1, dr.t / dr.T);
      const seg = dr.seg;
      const floor = seg.floorY(dr.d) + (zone === 'street' && !dr.close ? 0.24 : 0);
      dr.grp.position.set(dr.x, floor + dr.h0 * (1 - k * k), -dr.d);
      dr.grp.rotation.x += dr.spin.x * dt * (1 - k);
      dr.grp.rotation.z += dr.spin.z * dt * (1 - k);
      if (dr.mark) dr.mark.scale.setScalar(1 + Math.sin(dr.t * 18) * 0.15);
      if (k < 1) return true;
      if (!dr.landed) {
        dr.landed = true;
        dr.grp.rotation.set(0, rand(-0.5, 0.5), rand(-0.1, 0.1));
        const wp = seg.toWorld(dr.d, dr.x, 0.8);
        g.physics.rubble(wp, dr.close ? 8 : 5, 8, 0.4);
        g.particles.burst(wp, 0xd8d0e8, 30, 10, 1, 10, 1.4);
        g.particles.burst(wp, 0xff9a2e, 12, 8, 0.4, 4, 2);
        g.audio.play('slam');
        const near = Math.abs(seg.startS + dr.d - g.s);
        g.shake = Math.max(g.shake, Math.max(0, 1 - near * 0.02));
        if (dr.mark) seg.group.remove(dr.mark);
        if (dr.close && g.state === 'playing') {
          const lane = Math.round(dr.x / LW);
          g.hazards.addObstacle(seg, { kind: 'block', lane, d: dr.d, x: dr.x, group: dr.grp, hw: 1.1, hd: dr.big ? 4.5 : 2.2, yMax: dr.big ? 3.4 : 1.8, standable: true, noFling: true });
          if (lane !== g.lane) {
            g.skills.add('dodge');
            g.ui.pop('CLOSE CALL!', '#ff9a2e', 50, 44, 44);
          }
        }
        dr.life = dr.close ? 99 : 6;
      }
      dr.life -= dt;
      if (dr.life > 0 && seg.group.parent) return true;
      if (!dr.close) {
        seg.group.remove(dr.grp);
        dr.grp.traverse((m) => m.isMesh && m.geometry.dispose());
      }
      return false;
    });
  }

  spawnDrop(s, x, close) {
    const g = this.g;
    g.path.ensure(s + 20);
    const seg = g.path.segAt(s);
    const d = s - seg.startS;
    const { grp, big } = this.carMesh();
    seg.group.add(grp);
    const dr = { seg, d, x, grp, big, close, t: 0, T: close ? 1.3 : 1.8, h0: close ? 26 : 38, spin: new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)) };
    if (close) {
      dr.mark = g.hazards.marker(seg, d, x, 1.6);
      g.audio.play('horn');
      g.audio.play('scream');
    }
    this.drops.push(dr);
  }

  updateWeather(dt, zone) {
    const g = this.g;
    const W8 = this.weather;
    const cam = g.camera.position;
    const style = {
      roof: { col: [0xffffff, 0xffe6f2], vel: [0, -0.3, 0], size: 0.16, spread: 1.2, streak: true },
      street: { col: [0xff3fa4, 0xffd84a, 0x3fc7ff, 0xffffff], vel: [0, -1.2, 0], size: 0.22, spread: 1.6 },
      park: { col: [0xff9a2e, 0xffd84a, 0x6fd24a, 0xc8583f], vel: [0, -1.6, 0], size: 0.3, spread: 2.2 },
      subway: { col: [0xfff0c0, 0xd8d0e8], vel: [0, 0.1, 0], size: 0.1, spread: 0.3, sparks: true },
      prison: { col: [0xff2030, 0xfff0c0, 0x9aa3c0], vel: [0, 0.2, 0], size: 0.12, spread: 0.4 },
      office: { col: [0xffffff, 0xf4ecd8], vel: [0, -0.6, 0], size: 0.28, spread: 1.4 },
      rift: { col: [0x3fe0ff, 0xff3fa4, 0xb56bff], vel: [0, 1.2, 0], size: 0.24, spread: 1 },
    }[zone];
    if (!style) return;
    W8.pts.material.size = style.size;
    const c = new THREE.Color();
    const R = 38;
    const seed = W8.zone !== zone;
    W8.zone = zone;
    for (let i = 0; i < W8.n; i++) {
      const i3 = i * 3;
      let x = W8.pos[i3], y = W8.pos[i3 + 1], z = W8.pos[i3 + 2];
      if (seed || Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R || Math.abs(y - cam.y) > 18) {
        x = cam.x + rand(-R, R);
        y = cam.y + rand(-10, 16);
        z = cam.z + rand(-R, R);
        W8.vel[i3] = rand(-1, 1) * style.spread;
        W8.vel[i3 + 1] = style.vel[1] * rand(0.5, 1.5);
        W8.vel[i3 + 2] = rand(-1, 1) * style.spread;
        c.set(pick(style.col));
        W8.col[i3] = c.r * 1.6;
        W8.col[i3 + 1] = c.g * 1.6;
        W8.col[i3 + 2] = c.b * 1.6;
      }
      const sway = Math.sin(g.elapsed * 1.7 + i) * 0.6;
      W8.pos[i3] = x + (W8.vel[i3] + sway) * dt;
      W8.pos[i3 + 1] = y + W8.vel[i3 + 1] * dt;
      W8.pos[i3 + 2] = z + W8.vel[i3 + 2] * dt;
    }
    W8.pts.geometry.attributes.position.needsUpdate = true;
    W8.pts.geometry.attributes.color.needsUpdate = true;
    // Subway: occasional rail sparks.
    if (style.sparks && Math.random() < dt * 2.5) {
      g.particles.burst(g.path.toWorld(g.s + rand(10, 40), pick([-1, 0, 1]) * LW + 0.7, 0.2), 0xffc040, 10, 6, 0.35, 3, 0.8);
    }
  }

  rebase(off) {
    for (const h of this.helis) h.center.sub(off);
    this.blimp.g.position.sub(off);
    if (this.flock) this.flock.from.sub(off);
    for (const r of this.raids) r.pos.sub(off);
    for (let i = 0; i < this.weather.n; i++) {
      this.weather.pos[i * 3] -= off.x;
      this.weather.pos[i * 3 + 2] -= off.z;
    }
  }
}

function t0(t) {
  return t;
}

import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();

/**
 * Pointer targeting + free web shots.
 *
 * Every frame we look for the grapple point nearest the pointer on screen
 * (building faces, lamps, trees, subway ceiling) and the nearest shootable
 * obstacle. A reticle and a world marker show what a press would do:
 *   hold  -> grapple exactly that point
 *   tap   -> fire a web ball: wraps + yanks obstacles, stops vehicles, or
 *            splats on walls just for fun.
 */
export class Webs {
  constructor(game) {
    this.g = game;
    this.anchor = new THREE.Vector3();
    this.hasAnchor = false;
    this.target = null; // obstacle under the reticle
    this.targets = []; // extra web targets: {pos(): Vector3, onHit(), alive, r}
    this.burstCool = 0;
    this.cool = 0;
    this.shots = [];
    this.splats = [];

    const ringGeo = new THREE.RingGeometry(0.55, 0.8, 24);
    this.marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2.2), transparent: true, depthTest: false, side: THREE.DoubleSide }));
    this.marker.renderOrder = 20;
    this.marker.layers.set(LAYER_NO_OUTLINE);
    this.marker.visible = false;
    game.scene.add(this.marker);
    this.targetRing = this.marker.clone();
    this.targetRing.material = this.marker.material.clone();
    this.targetRing.material.color.set(0xff3fa4).multiplyScalar(2.2);
    game.scene.add(this.targetRing);

    this.ballGeo = new THREE.IcosahedronGeometry(0.28, 1);
    this.webMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 });
    this.strandMat = new THREE.LineBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.9 });
    this.splatGeo = this.makeSplatGeo();
    this.cocoonGeo = new THREE.IcosahedronGeometry(1, 1);
    this.cocoonMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85, transparent: true, opacity: 0.88 });
    this.cocoonWire = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });

    this.reticle = document.getElementById('reticle');
  }

  /** Star-shaped web splat with radial strands. */
  makeSplatGeo() {
    const shape = new THREE.Shape();
    const n = 10;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.45 : 1.1 + Math.random() * 0.35;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const g = new THREE.ShapeGeometry(shape);
    g.userData.shared = true;
    return g;
  }

  project(p) {
    return _v.copy(p).project(this.g.camera);
  }

  /** Find the grapple point and obstacle closest to the pointer. */
  scan(aim) {
    const g = this.g;
    const cx = aim.x;
    const cy = 1 - 2 * aim.y;
    let best = 0.32;
    this.hasAnchor = false;
    const s0 = g.s;
    for (const seg of g.path.segments) {
      if (seg.endS < s0 + 4 || seg.startS > s0 + 70) continue;
      const tunnel = seg.zone === 'subway' || seg.zone === 'office' || seg.zone === 'prison';
      const ceil = seg.zone === 'office' ? 5.9 : seg.zone === 'prison' ? 8.6 : 7.85;
      for (const f of seg.faces || []) {
        const lo = Math.max(f.d0, s0 + 7 - seg.startS);
        const hi = Math.min(f.d1, s0 + 60 - seg.startS);
        if (hi < lo) continue;
        const floor = seg.floorY((lo + hi) / 2);
        if (f.top < floor + 5) continue;
        for (let d = lo; d <= hi; d += f.pole ? 1 : 4) {
          for (const h of f.pole ? [f.top - 0.3] : [8, 13, 19, 26]) {
            const y = Math.min(floor + h, f.top - 1.2);
            seg.toWorld(d, f.x - f.side * 0.05, y - seg.floorY(d), _a);
            const p = this.project(_a);
            if (p.z > 1) continue;
            const dist = Math.hypot(p.x - cx, (p.y - cy) * 0.8);
            if (dist < best) {
              best = dist;
              this.anchor.copy(_a);
              this.hasAnchor = true;
            }
          }
        }
      }
      if (tunnel) {
        // Anywhere on the tunnel ceiling is fair game.
        for (let d = Math.max(0, s0 + 8 - seg.startS); d < Math.min(seg.length, s0 + 50 - seg.startS); d += 3) {
          for (const x of [-4, 0, 4]) {
            seg.toWorld(d, x, ceil, _a);
            const p = this.project(_a);
            const dist = Math.hypot(p.x - cx, (p.y - cy) * 0.8);
            if (p.z < 1 && dist < best) {
              best = dist;
              this.anchor.copy(_a);
              this.hasAnchor = true;
            }
          }
        }
      }
    }
    // Obstacles and special targets (levers, clues, snacks) you could web.
    let bestOb = 0.2;
    this.target = null;
    this.targets = this.targets.filter((t) => t.alive);
    for (const t of this.targets) {
      const wp = t.pos();
      if (wp.distanceTo(g.camera.position) > 110) continue;
      const p = this.project(_a.copy(wp));
      const dist = Math.hypot(p.x - cx, (p.y - cy) * 0.8) - (t.r || 0.08);
      if (p.z < 1 && dist < bestOb) {
        bestOb = dist;
        this.target = { special: t, pos: wp.clone() };
      }
    }
    for (const seg of g.path.segments) {
      if (seg.endS < s0 || seg.startS > s0 + 75) continue;
      for (const ob of seg.obstacles) {
        if (!ob.alive || ob.step || ob.ramp || ob.webbed) continue;
        const ds = seg.startS + ob.d - s0;
        if (ds < 5 || ds > 70) continue;
        ob.group.getWorldPosition(_a);
        _a.y += ob.kind === 'high' ? (ob.yMin || 2.2) + 0.5 : Math.max(0.6, (ob.yMax || 1.2) * 0.5);
        const p = this.project(_a);
        const dist = Math.hypot(p.x - cx, (p.y - cy) * 0.8);
        if (p.z < 1 && dist < bestOb) {
          bestOb = dist;
          this.target = { ob, seg, pos: _a.clone() };
        }
      }
    }
  }

  update(dt) {
    const g = this.g;
    const aim = g.input.aim;
    const playing = g.state === 'playing';
    this.cool = Math.max(0, this.cool - dt);
    this.burstCool = Math.max(0, this.burstCool - dt);
    const show = playing && aim.active;
    if (show) this.scan(aim);
    else {
      this.hasAnchor = false;
      this.target = null;
    }
    const t = g.elapsed;
    this.marker.visible = show && this.hasAnchor && !this.target;
    if (this.marker.visible) {
      this.marker.position.copy(this.anchor);
      this.marker.quaternion.copy(g.camera.quaternion);
      this.marker.scale.setScalar((1 + Math.sin(t * 8) * 0.12) * (g.input.holding ? 0.7 : 1));
    }
    this.targetRing.visible = show && !!this.target;
    if (this.target) {
      this.targetRing.position.copy(this.target.pos);
      this.targetRing.quaternion.copy(g.camera.quaternion);
      this.targetRing.scale.setScalar(1.6 + Math.sin(t * 10) * 0.15);
    }
    if (this.reticle) {
      const mouse = !matchMedia('(pointer: coarse)').matches;
      const vis = show && (mouse || g.input.holding);
      this.reticle.classList.toggle('hidden', !vis);
      if (vis) {
        this.reticle.style.left = `${((aim.x + 1) / 2) * 100}%`;
        this.reticle.style.top = `${aim.y * 100}%`;
        this.reticle.dataset.mode = this.target ? 'shoot' : this.hasAnchor ? 'grab' : 'none';
        this.reticle.style.setProperty('--cd', `${(1 - this.cool / (g.st?.webCool || 0.22)) * 360}deg`);
      }
    }

    // Web balls in flight.
    this.shots = this.shots.filter((s) => {
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      if (s.follow) s.follow.group.getWorldPosition(s.to).add(s.off);
      s.mesh.position.copy(s.from).lerp(s.to, k);
      s.mesh.position.y += Math.sin(k * Math.PI) * s.arc;
      const pos = s.line.geometry.attributes.position;
      if (s.special && s.special.alive) s.to.copy(s.special.pos());
      pos.setXYZ(0, g.hero.handWorld.x, g.hero.handWorld.y, g.hero.handWorld.z);
      pos.setXYZ(1, s.mesh.position.x, s.mesh.position.y, s.mesh.position.z);
      pos.needsUpdate = true;
      if (k < 1) return true;
      g.scene.remove(s.mesh, s.line);
      s.line.geometry.dispose();
      this.land(s);
      return false;
    });
    this.splats = this.splats.filter((sp) => {
      sp.life -= dt;
      sp.mesh.material.opacity = Math.min(1, sp.life / 1.5);
      if (sp.life > 0) return true;
      sp.mesh.parent?.remove(sp.mesh);
      sp.mesh.material.dispose();
      return false;
    });
  }

  rebase(off) {
    this.anchor.sub(off);
    for (const sp of this.splats) sp.mesh.position.sub(off);
    for (const sh of this.shots) {
      sh.from.sub(off);
      sh.to.sub(off);
    }
  }

  /** Tap: fire a web ball at the obstacle, the grapple point, or open air. */
  fire() {
    const g = this.g;
    if (this.cool > 0 || g.state !== 'playing') return;
    this.cool = g.st?.webCool ?? 0.22;
    const from = g.hero.handWorld.clone();
    let to;
    let follow = null;
    const off = new THREE.Vector3();
    if (this.target?.special) {
      to = this.target.pos.clone();
      const sp = this.target.special;
      this.shots.push(this.makeShot(from, to, null, off, null, false, sp));
      g.audio.play('zap');
      return;
    } else if (this.target) {
      follow = this.target.ob;
      to = this.target.pos.clone();
      follow.group.getWorldPosition(_n);
      off.copy(to).sub(_n);
    } else if (this.hasAnchor) {
      to = this.anchor.clone();
    } else {
      // Open air: shoot along the pointer ray.
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(g.input.aim.x, 1 - 2 * g.input.aim.y), g.camera);
      to = ray.ray.at(38, new THREE.Vector3());
    }
    this.shots.push(this.makeShot(from, to, follow, off, this.target?.seg, !follow && this.hasAnchor));
    g.audio.play('zap');
    g.hero.shootT = 0.18;
  }

  makeShot(from, to, follow, off, seg, anchor, special = null) {
    const g = this.g;
    const dist = from.distanceTo(to);
    const mesh = new THREE.Mesh(this.ballGeo, this.webMat);
    mesh.layers.set(LAYER_NO_OUTLINE);
    const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(lg, this.strandMat);
    line.frustumCulled = false;
    line.layers.set(LAYER_NO_OUTLINE);
    g.scene.add(mesh, line);
    return { from, to, follow, off, t: 0, dur: Math.max(0.08, dist / 110), arc: dist * 0.02, mesh, line, ob: follow, seg, anchor, special };
  }

  /** Web Burst: a fan of lines at up to five things ahead at once. */
  burst() {
    const g = this.g;
    if (g.state !== 'playing') return false;
    if (this.burstCool > 0) {
      g.ui.pop(`BURST IN ${Math.ceil(this.burstCool)}s`, '#fff1d6', 50, 70, 26);
      return false;
    }
    const picks = [];
    for (const t of this.targets) if (t.alive && t.pos().distanceTo(g.hero.root.position) < 70) picks.push({ special: t, d: t.pos().distanceTo(g.hero.root.position) });
    for (const seg of g.path.segments) {
      for (const ob of seg.obstacles) {
        const ds = seg.startS + ob.d - g.s;
        if (!ob.alive || ob.step || ob.ramp || ob.webbed || ds < 3 || ds > 55) continue;
        picks.push({ ob, seg, d: ds });
      }
    }
    picks.sort((a, b) => a.d - b.d);
    const chosen = picks.slice(0, 5);
    if (!chosen.length) {
      g.ui.pop('NOTHING TO WEB', '#fff1d6', 50, 70, 26);
      return false;
    }
    this.burstMax = 7 * (1 - (g.save.upgrades?.web || 0) * 0.12);
    this.burstCool = this.burstMax;
    const from = g.hero.handWorld.clone();
    for (const c of chosen) {
      if (c.special) this.shots.push(this.makeShot(from, c.special.pos().clone(), null, new THREE.Vector3(), null, false, c.special));
      else {
        const to = c.ob.group.getWorldPosition(new THREE.Vector3());
        to.y += 1;
        const off = to.clone().sub(c.ob.group.getWorldPosition(new THREE.Vector3()));
        this.shots.push(this.makeShot(from, to, c.ob, off, c.seg, false));
      }
    }
    g.audio.play('zap');
    g.audio.play('whoosh');
    g.ui.pop(`WEB BURST x${chosen.length}!`, '#ffffff', 50, 30, 52);
    g.skills.add('burst');
    return true;
  }

  /** Little web star where a grapple line bites. */
  splatAt(p) {
    const g = this.g;
    const mesh = new THREE.Mesh(this.splatGeo, new THREE.MeshBasicMaterial({ color: 0xf4f1ea, transparent: true, side: THREE.DoubleSide }));
    mesh.position.copy(p);
    mesh.lookAt(g.camera.position);
    mesh.rotation.z = Math.random() * 6;
    mesh.scale.setScalar(0.55);
    mesh.layers.set(LAYER_NO_OUTLINE);
    g.scene.add(mesh);
    this.splats.push({ mesh, life: 5 });
    if (this.splats.length > 24) this.splats[0].life = 0;
  }

  land(s) {
    const g = this.g;
    if (s.special) {
      if (s.special.alive) {
        s.special.alive = false;
        s.special.onHit();
      }
      g.particles.burst(s.to, 0xf4f1ea, 10, 5, 0.35, 5, 1.2);
      return;
    }
    if (s.ob && s.ob.alive) {
      this.cocoon(s.ob);
      return;
    }
    // Splat on a wall / ceiling (or fizzle in the air).
    g.particles.burst(s.to, 0xf4f1ea, 8, 5, 0.35, 5, 1.2);
    if (!s.anchor) return;
    const mesh = new THREE.Mesh(this.splatGeo, new THREE.MeshBasicMaterial({ color: 0xf4f1ea, transparent: true, side: THREE.DoubleSide }));
    mesh.position.copy(s.to);
    mesh.lookAt(g.camera.position);
    mesh.rotation.z = Math.random() * 6;
    mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    mesh.layers.set(LAYER_NO_OUTLINE);
    g.scene.add(mesh);
    this.splats.push({ mesh, life: 7 });
    if (this.splats.length > 24) this.splats[0].life = 0;
    g.skills.add('webSplat');
  }

  /** Wrap an obstacle in web. Vehicles stop dead; everything else gets yanked away. */
  cocoon(ob) {
    const g = this.g;
    ob.webbed = true;
    const c = new THREE.Mesh(this.cocoonGeo, this.cocoonMat);
    const h = ob.kind === 'high' ? 1.2 : Math.max(0.8, ob.yMax || 1.2);
    c.scale.set(ob.hw * 1.15, h * 0.62, Math.min(ob.hd, 3) * 1.15);
    c.position.y = ob.kind === 'high' ? (ob.yMin || 2.2) + 0.6 : h * 0.5;
    const w = new THREE.Mesh(this.cocoonGeo, this.cocoonWire);
    w.scale.setScalar(1.04);
    c.add(w);
    ob.group.add(c);
    ob.group.getWorldPosition(_a);
    g.particles.burst(_a.setY(_a.y + 1), 0xf4f1ea, 26, 7, 0.5, 3, 2);
    if (ob.moving && ob.standable) {
      ob.moving = 0; // webbed to the road: stays solid, but stops charging you
      g.skills.add('webStop');
      g.ui.pop('WEBBED!', '#ffffff', 50, 36, 40);
    } else {
      g.skills.add('webYank');
      g.smash(ob, false, false);
      g.ui.pop('YANK!', '#ffffff', 50, 36, 40);
    }
    g.audio.play('smash');
  }
}

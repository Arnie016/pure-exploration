import * as THREE from 'three';
import { goon, buildInto } from './hazards.js';
import { PRIM, mat4 } from '../world/geo.js';
import { CFG } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const W = CFG.corridorHalf;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const G = 22;

/**
 * The title screen is playable: the pointer is your web-shooter. Click to fire
 * a web (it chips concrete, cocoons NPCs, breaks crates), hold to swing the
 * hero around the rooftop, let go to fling. Rooftop NPCs and pigeons react.
 */
export class Lobby {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.anchor = null;
    this.ropeLen = 0;
    this.active = false;
    this.ray = new THREE.Raycaster();
    this.npcs = [];
    this.crates = [];
    this.pigeons = [];
    this.lastLand = 0;
  }

  /** Build the rooftop hangout around the hero spot. */
  enter() {
    const g = this.g;
    this.clear();
    const seg = g.path.segments[0];
    this.seg = seg;
    this.home = seg.toWorld(40, 0, 0);
    this.pos.copy(this.home).setY(this.home.y + 1.05);
    this.vel.set(0, 0, 0);
    this.anchor = null;
    this.active = true;
    const place = (obj, d, x, h = 0, ry = 0) => {
      seg.toWorld(d, x, h, obj.position);
      obj.rotation.y = seg.yaw + ry;
      this.group.add(obj);
      return obj;
    };
    // NPCs: a boombox dancer, a phone-filming fan, a pizza guy, a worker on break, a kid.
    const roles = [
      { d: 46, x: -3.2, col: 0xff3fa4, kind: 'dance' },
      { d: 36, x: 3.4, col: 0x3fc7ff, kind: 'film', ry: Math.PI / 2 },
      { d: 52, x: 2.2, col: 0xffd84a, kind: 'wave' },
      { d: 30, x: -2.6, col: 0xa8f03a, kind: 'idle' },
      { d: 58, x: -0.8, col: 0xff9a2e, kind: 'dance' },
    ];
    for (const r of roles) {
      const m = goon(g.mats, r.col);
      place(m, r.d, r.x, 0, Math.PI + (r.ry || 0) + rand(-0.4, 0.4));
      this.npcs.push({ m, kind: r.kind, ph: Math.random() * 6, base: m.position.clone(), webbed: 0, cocoon: null, react: 0 });
    }
    // Boombox + string lights + crates to smash.
    const box = buildInto(new THREE.Group(), g.mats, (B) => {
      B.box('solid', 0, 0.3, 0, 0.9, 0.55, 0.35, 0x1b1030);
      B.cyl('metal', -0.22, 0.3, 0.18, 0.16, 0.05, 0x9aa7c7, Math.PI / 2, 0, 0);
      B.cyl('metal', 0.22, 0.3, 0.18, 0.16, 0.05, 0x9aa7c7, Math.PI / 2, 0, 0);
      B.box('glowV', 0, 0.62, 0, 0.5, 0.05, 0.1, 0xff3fa4, 0, 0, 0, 3);
    });
    place(box, 47.5, -4.2);
    const lights = buildInto(new THREE.Group(), g.mats, (B) => {
      for (let i = 0; i < 14; i++) B.add('glowV', PRIM.sphere, mat4(-W + (i / 13) * W * 2, 3.2 - Math.sin((i / 13) * Math.PI) * 0.6, 0, 0.16, 0.16, 0.16), pick([0xffd84a, 0xff3fa4, 0x3fe0ff, 0xa8f03a]), 3);
      for (const x of [-W, W]) B.box('metal', x, 1.6, 0, 0.08, 3.2, 0.08, 0x3b3552);
    });
    place(lights, 44, 0);
    for (let i = 0; i < 3; i++) {
      const c = buildInto(new THREE.Group(), g.mats, (B) => {
        B.box('solid', 0, 0.45, 0, 0.9, 0.9, 0.9, 0xc8903f);
        B.box('solid', 0, 0.45, 0.46, 0.92, 0.12, 0.02, 0x8a5a2f);
      });
      place(c, 62 + i * 1.1, 3.4 - (i % 2) * 1.0, i === 2 ? 0.9 : 0, rand(-0.3, 0.3));
      this.crates.push({ m: c, alive: true });
    }
    // Pigeons on the parapet.
    for (let i = 0; i < 10; i++) {
      const p = buildInto(new THREE.Group(), g.mats, (B) => {
        B.add('solid', PRIM.sphere, mat4(0, 0.12, 0, 0.22, 0.2, 0.34), 0x8a86a6);
        B.add('solid', PRIM.sphere, mat4(0, 0.25, 0.14, 0.13, 0.13, 0.13), 0x6a6690);
        B.box('solid', 0, 0.24, 0.24, 0.04, 0.03, 0.08, 0xffb040);
      });
      const side = i % 2 ? 1 : -1;
      place(p, 30 + i * 3.4, side * (W + 1.3), 1.05, rand(0, 6));
      this.pigeons.push({ m: p, fly: 0, v: new THREE.Vector3() });
    }
  }

  clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.npcs = [];
    this.crates = [];
    this.pigeons = [];
    this.active = false;
    this.anchor = null;
  }

  /** World point under the pointer (buildings, roof, props), or far along the ray. */
  pick(aim) {
    const g = this.g;
    this.ray.setFromCamera(new THREE.Vector2(aim.x, 1 - 2 * aim.y), g.camera);
    const targets = [...g.path.segments.slice(0, 3).map((s) => s.group), this.group];
    const hits = this.ray.intersectObjects(targets, true).filter((h) => h.distance > 1.5 && h.distance < 220 && h.object.visible);
    if (hits.length) return { point: hits[0].point.clone(), obj: hits[0].object, normal: hits[0].face?.normal };
    return { point: this.ray.ray.at(60, new THREE.Vector3()), obj: null };
  }

  owner(obj) {
    for (let o = obj; o; o = o.parent) {
      const n = this.npcs.find((x) => x.m === o);
      if (n) return { npc: n };
      const c = this.crates.find((x) => x.m === o);
      if (c) return { crate: c };
    }
    return null;
  }

  fire(aim) {
    const g = this.g;
    const hit = this.pick(aim);
    const from = g.hero.handWorld.clone();
    const shot = g.webs.makeShot(from, hit.point, null, new THREE.Vector3(), null, false, {
      alive: true,
      pos: () => hit.point,
      onHit: () => this.impact(hit),
    });
    g.webs.shots.push(shot);
    g.audio.play('zap');
  }

  impact(hit) {
    const g = this.g;
    const own = hit.obj && this.owner(hit.obj);
    g.particles.burst(hit.point, 0xf4f1ea, 12, 5, 0.4, 5, 1.2);
    if (own?.npc) {
      const n = own.npc;
      if (!n.cocoon) {
        n.cocoon = new THREE.Mesh(g.webs.cocoonGeo, g.webs.cocoonMat);
        n.cocoon.scale.set(0.5, 1.1, 0.45);
        n.cocoon.position.y = 1.1;
        n.m.add(n.cocoon);
      }
      n.webbed = 4;
      g.audio.play('scream');
      this.say(n.m, pick(['HEY!', 'NOT COOL!', 'MMPH!', 'LOL', 'MY PHONE!']));
      return;
    }
    if (own?.crate && own.crate.alive) {
      own.crate.alive = false;
      own.crate.m.visible = false;
      g.physics.rubble(hit.point, 8, 7, 0.35);
      g.audio.play('smash');
      g.particles.burst(hit.point, 0xc8903f, 20, 7, 0.6, 6, 1.5);
      setTimeout(() => (own.crate.alive = true, own.crate.m.visible = true), 5000);
      return;
    }
    // Environment damage: concrete chips, a web splat, a little dust.
    g.webs.splatAt(hit.point);
    if (hit.obj) {
      g.physics.rubble(hit.point, 3, 4, 0.18);
      g.particles.burst(hit.point, 0xb8b0c0, 10, 4, 0.5, 6, 1);
      g.audio.play('slam');
    }
  }

  say(obj, text) {
    const g = this.g;
    const p = obj.getWorldPosition(_v).setY(obj.getWorldPosition(_v).y + 2.3).project(g.camera);
    g.ui.bubble(text, (p.x + 1) * 50, (1 - p.y) * 50, true, 1100);
  }

  hold(on, aim) {
    const g = this.g;
    if (on) {
      const hit = this.pick(aim);
      this.anchor = hit.point;
      // Low hits still give a real swing: the line bites high on whatever it struck.
      this.anchor.y = Math.max(this.anchor.y, this.pos.y + 9);
      this.ropeLen = this.anchor.distanceTo(this.pos) * 0.8;
      g.line.zap();
      g.audio.play('zap');
      g.webs.splatAt(hit.point);
      // A little hop to get off the ground.
      if (this.onGround) this.vel.y = 6;
    } else if (this.anchor) {
      this.anchor = null;
      g.line.release();
      this.vel.multiplyScalar(1.15);
      this.vel.y += 3;
      g.audio.play('whoosh');
    }
  }

  jump() {
    if (this.onGround) {
      this.vel.y = 9;
      this.g.audio.play('hop');
    }
  }

  update(dt, actions, aim) {
    const g = this.g;
    if (!this.active) return;
    for (const a of actions) {
      if (a === 'web') this.fire(aim);
      else if (a === 'holdStart') this.hold(true, aim);
      else if (a === 'holdEnd') this.hold(false, aim);
      else if (a === 'up') this.jump();
    }
    const seg = this.seg;
    const floor = this.home.y + 1.05;
    // Physics: gravity + rope (reels in while held), soft bounds around the roof.
    this.vel.y -= G * dt;
    if (this.anchor) {
      this.ropeLen = Math.max(3, this.ropeLen - dt * 12);
      // Zip: a strong pull toward the anchor, plus the rope constraint for the arc.
      this.vel.addScaledVector(_w.copy(this.anchor).sub(this.pos).normalize(), 16 * dt);
      const d = _v.copy(this.pos).sub(this.anchor);
      const len = d.length();
      if (len > this.ropeLen) {
        d.normalize();
        this.pos.copy(this.anchor).addScaledVector(d, this.ropeLen);
        const radial = this.vel.dot(d);
        if (radial > 0) this.vel.addScaledVector(d, -radial);
        // Pump: a gentle pull along the swing.
        this.vel.addScaledVector(_w.copy(this.anchor).sub(this.pos).normalize(), 6 * dt);
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    this.onGround = this.pos.y <= floor + 0.01 && !this.anchor;
    if (this.pos.y <= floor) {
      if (this.vel.y < -8) {
        g.particles.burst(_v.copy(this.pos).setY(floor - 1), 0xd8d0e8, 16, 5, 0.5, 6, 1);
        g.audio.play('slam');
        g.shake = 0.3;
        this.lastLand = g.elapsed;
        for (const n of this.npcs) if (n.m.position.distanceTo(this.pos) < 7) n.react = 1.4;
      }
      this.pos.y = floor;
      this.vel.y = Math.max(0, this.vel.y);
      if (!this.anchor) {
        this.vel.x *= Math.exp(-6 * dt);
        this.vel.z *= Math.exp(-6 * dt);
      }
    }
    // Keep inside a play box around home (segment-local).
    const rel = _v.copy(this.pos).sub(this.home);
    const along = rel.dot(seg.fwd);
    const lat = rel.dot(seg.right);
    const cA = THREE.MathUtils.clamp(along, -30, 45);
    const cL = THREE.MathUtils.clamp(lat, -W - 1, W + 1);
    if (cA !== along || cL !== lat) {
      this.pos.addScaledVector(seg.fwd, cA - along).addScaledVector(seg.right, cL - lat);
      this.vel.addScaledVector(seg.fwd, -this.vel.dot(seg.fwd) * (cA !== along ? 1.5 : 0));
      this.vel.addScaledVector(seg.right, -this.vel.dot(seg.right) * (cL !== lat ? 1.5 : 0));
    }
    if (this.pos.y > floor + 30) {
      this.pos.y = floor + 30;
      this.vel.y = Math.min(0, this.vel.y);
    }

    // Hero pose + facing.
    const hero = g.hero;
    hero.root.position.copy(this.pos);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.8) this.yaw = Math.atan2(-this.vel.x, -this.vel.z) + Math.PI;
    hero.root.rotation.set(this.anchor ? -0.3 : 0, this.yaw ?? seg.yaw + Math.PI, 0, 'YXZ');
    const mode = this.anchor ? 'swing' : this.onGround ? (speed > 3 ? 'swing' : 'idle') : 'fly';
    hero.animate(dt, { mode, phase: 0.5, anchorWorld: this.anchor, swingVel: speed * 0.1 });
    if (this.anchor) g.line.update(dt, hero.handWorld, this.anchor, true, 0);
    else g.line.update(dt, hero.handWorld, hero.handWorld, false, 0);
    g.heroCenter = this.pos;

    // NPC idles and reactions.
    const t = g.elapsed;
    for (const n of this.npcs) {
      n.ph += dt;
      if (n.webbed > 0) {
        n.webbed -= dt;
        n.m.rotation.z = Math.sin(t * 20) * 0.08;
        if (n.webbed <= 0 && n.cocoon) {
          n.m.remove(n.cocoon);
          n.cocoon = null;
          n.m.rotation.z = 0;
          g.particles.burst(n.m.position, 0xf4f1ea, 12, 4, 0.4, 3, 1.5);
        }
        continue;
      }
      const arm = n.m.userData.arm;
      if (n.react > 0) {
        n.react -= dt;
        n.m.position.y = n.base.y + Math.abs(Math.sin(t * 12)) * 0.4;
        if (arm) arm.rotation.x = -2.6 + Math.sin(t * 18) * 0.4;
        if (n.react > 1.3) this.say(n.m, pick(['WHOA!', 'SO COOL!', 'AGAIN!', 'SELFIE!']));
        continue;
      }
      if (n.kind === 'dance') {
        n.m.position.y = n.base.y + Math.abs(Math.sin(t * 6 + n.ph)) * 0.25;
        n.m.rotation.y += Math.sin(t * 1.5 + n.ph) * dt * 2;
        if (arm) arm.rotation.x = Math.sin(t * 8 + n.ph) * 1.3 - 1.4;
      } else if (n.kind === 'film') {
        if (arm) arm.rotation.x = -1.7;
        n.m.lookAt(this.pos.x, n.m.position.y, this.pos.z);
      } else if (n.kind === 'wave') {
        if (arm) arm.rotation.x = -2.6 + Math.sin(t * 6) * 0.5;
      }
    }
    // Pigeons scatter when you come near, then settle back.
    for (const p of this.pigeons) {
      if (!p.fly && p.m.position.distanceTo(this.pos) < 4.5) {
        p.fly = 3;
        p.home = p.home || p.m.position.clone();
        p.v.set(rand(-4, 4), rand(5, 8), rand(-4, 4));
        if (Math.random() < 0.3) g.audio.play('birds');
      }
      if (p.fly > 0) {
        p.fly -= dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.z = Math.sin(t * 30) * 0.4;
        if (p.fly <= 0) {
          p.m.position.copy(p.home);
          p.m.rotation.z = 0;
          p.fly = -2; // cooldown before it can spook again
        }
      } else if (p.fly < 0) p.fly = Math.min(0, p.fly + dt);
    }
  }
}

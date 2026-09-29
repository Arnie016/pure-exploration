import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Gold "volt coin" with an embossed lightning bolt, rendered as one InstancedMesh. */
function coinGeometry() {
  const disc = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28);
  disc.rotateX(Math.PI / 2);
  const rim = new THREE.TorusGeometry(0.42, 0.05, 8, 28);
  const bolt = new THREE.Shape();
  bolt.moveTo(0.05, 0.3);
  bolt.lineTo(-0.16, -0.02);
  bolt.lineTo(-0.01, -0.02);
  bolt.lineTo(-0.08, -0.3);
  bolt.lineTo(0.17, 0.05);
  bolt.lineTo(0.02, 0.05);
  bolt.closePath();
  const b = new THREE.ExtrudeGeometry(bolt, { depth: 0.16, bevelEnabled: false });
  b.translate(0, 0, -0.08);
  b.deleteAttribute('uv');
  const parts = [colored(disc, 0xffd21a), colored(rim, 0xfff0a0), colored(b, 0xffffff)];
  for (const p of parts) if (!p.attributes.uv) p.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 2), 2));
  for (const p of parts) if (p.attributes.uv && p.attributes.uv.count !== p.attributes.position.count) p.deleteAttribute('uv');
  return mergeGeometries(parts.map((p) => {
    if (!p.attributes.uv) p.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 2), 2));
    return p;
  }));
}

export class Coins {
  constructor(scene, max = 420) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      coinGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.28, emissive: 0xffb000, emissiveIntensity: 0.75, envMapIntensity: 0.6 }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.t = 0;
  }

  /** Draw every live coin in the given segments. */
  update(dt, segments, path, heroPos) {
    this.t += dt;
    let n = 0;
    const rot = this.t * 3;
    for (const seg of segments) {
      for (const c of seg.tokens) {
        if (!c.alive || n >= this.max) continue;
        if (!c.world) c.world = seg.toWorld(c.d, c.x, c.y);
        if (c.pull) {
          c.world.lerp(heroPos, 1 - Math.exp(-14 * dt));
        }
        _e.set(0, rot + c.d * 0.2, 0);
        _q.setFromEuler(_e);
        _s.setScalar(c.pull ? 0.8 : 1);
        _p.copy(c.world);
        _p.y += Math.sin(this.t * 3 + c.d) * 0.08;
        _m.compose(_p, _q, _s);
        this.mesh.setMatrixAt(n++, _m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  rebase(offset, segments) {
    for (const seg of segments) for (const c of seg.tokens) if (c.world) c.world.sub(offset);
  }
}

/** Power-up orbs: magnet, shield, turbo. Small pool of meshes. */
export class PowerUps {
  constructor(scene) {
    this.scene = scene;
    this.protos = {
      magnet: this.makeOrb(0xff3f5a, (g) => {
        const u = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 10, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xff2f4a, metalness: 0.5, roughness: 0.3 }));
        u.rotation.z = Math.PI;
        g.add(u);
        for (const s of [-1, 1]) {
          const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xe8ecff, metalness: 0.9, roughness: 0.2 }));
          tip.position.set(0.3 * s, 0.08, 0);
          g.add(tip);
        }
      }),
      shield: this.makeOrb(0x3fe0ff, (g) => {
        const s = new THREE.Shape();
        s.moveTo(0, 0.34);
        s.lineTo(0.28, 0.22);
        s.lineTo(0.24, -0.1);
        s.lineTo(0, -0.34);
        s.lineTo(-0.24, -0.1);
        s.lineTo(-0.28, 0.22);
        s.closePath();
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0x3fc7ff, metalness: 0.6, roughness: 0.25 }));
        m.position.z = -0.05;
        g.add(m);
      }),
      turbo: this.makeOrb(0xff9a2e, (g) => {
        for (const k of [-0.12, 0.12]) {
          const s = new THREE.Shape();
          s.moveTo(-0.2, 0.25);
          s.lineTo(0.05, 0);
          s.lineTo(-0.2, -0.25);
          s.lineTo(-0.08, -0.25);
          s.lineTo(0.17, 0);
          s.lineTo(-0.08, 0.25);
          s.closePath();
          const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff6a00, emissiveIntensity: 0.6 }));
          m.position.set(k, 0, -0.04);
          m.rotation.z = Math.PI / 2;
          g.add(m);
        }
      }),
    };
    this.protos.focus = this.makeOrb(0x9bf5d5, (g) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x9bf5d5, metalness: 0.4, roughness: 0.2, emissive: 0x2bb5a5, emissiveIntensity: 0.5 });
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 16), m);
      top.position.y = 0.15;
      top.rotation.x = Math.PI;
      const bot = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 16), m);
      bot.position.y = -0.15;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x3b3552, metalness: 0.8, roughness: 0.3 }));
      cap.position.y = 0.32;
      const cap2 = cap.clone();
      cap2.position.y = -0.32;
      g.add(top, bot, cap, cap2);
    });
    this.protos.spring = this.makeOrb(0xa8f03a, (g) => {
      const coil = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.9) * 0.2, -0.3 + i * 0.015, Math.sin(i * 0.9) * 0.2))), 80, 0.035, 6),
        new THREE.MeshStandardMaterial({ color: 0xa8f03a, metalness: 0.7, roughness: 0.25 }),
      );
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xff3fa4 }));
      pad.position.y = 0.34;
      g.add(coil, pad);
    });
    this.protos.double = this.makeOrb(0xffd84a, (g) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0xffd21a, metalness: 0.7, roughness: 0.25, emissive: 0xffb000, emissiveIntensity: 0.5 }));
      c.rotation.x = Math.PI / 2;
      const c2 = c.clone();
      c2.position.set(0.14, 0.1, -0.08);
      g.add(c, c2);
    });
    // Mystery "?" box: comic-yellow crate with a question mark on each face.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#ffd84a';
    cx.fillRect(0, 0, 128, 128);
    cx.strokeStyle = '#1b1030';
    cx.lineWidth = 12;
    cx.strokeRect(6, 6, 116, 116);
    cx.font = 'bold 96px Impact, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.lineWidth = 8;
    cx.strokeText('?', 64, 70);
    cx.fillStyle = '#ff3fa4';
    cx.fillText('?', 64, 70);
    const qt = new THREE.CanvasTexture(cv);
    qt.colorSpace = THREE.SRGBColorSpace;
    const box = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), new THREE.MeshStandardMaterial({ map: qt, emissiveMap: qt, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4 }));
    cube.name = 'inner';
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd84a).multiplyScalar(3) }));
    ring.name = 'ring';
    ring.layers.set(LAYER_NO_OUTLINE);
    box.add(cube, ring);
    this.protos.mystery = box;
    this.live = [];
  }

  makeOrb(color, fill) {
    const g = new THREE.Group();
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 24, 16),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, emissive: color, emissiveIntensity: 0.6, depthWrite: false }),
    );
    bubble.layers.set(LAYER_NO_OUTLINE);
    g.add(bubble);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) }));
    ring.layers.set(LAYER_NO_OUTLINE);
    g.add(ring);
    ring.name = 'ring';
    const inner = new THREE.Group();
    inner.name = 'inner';
    fill(inner);
    g.add(inner);
    return g;
  }

  update(dt, segments, t) {
    // Attach meshes lazily for pickups in range.
    for (const seg of segments) {
      for (const p of seg.pickups) {
        if (p.alive && !p.mesh) {
          p.mesh = this.protos[p.type].clone();
          p.mesh.position.copy(seg.toWorld(p.d, p.x, p.y));
          this.scene.add(p.mesh);
          this.live.push(p);
        }
      }
    }
    this.live = this.live.filter((p) => {
      if (!p.alive || !segments.includes(p.seg)) {
        this.scene.remove(p.mesh);
        p.mesh = null;
        return false;
      }
      p.mesh.rotation.y = t * 2;
      p.mesh.getObjectByName('ring').rotation.x = t * 3;
      p.mesh.getObjectByName('inner').position.y = Math.sin(t * 4) * 0.05;
      return true;
    });
  }

  clear() {
    for (const p of this.live) this.scene.remove(p.mesh);
    this.live = [];
  }

  rebase(offset) {
    for (const p of this.live) p.mesh.position.sub(offset);
  }
}

/**
 * Glowing energy line. It shoots out from the hand (extend), ripples when it
 * catches (a travelling wave in the vertex shader), and snaps back on release.
 */
const LINE_VS = /* glsl */ `
  uniform float amp; uniform float phase; uniform float thick; uniform float sag; uniform float len;
  varying float vT; varying float vA;
  void main() {
    float t = position.y + 0.5;            // 0 at hand, 1 at anchor
    vT = t;
    vA = atan(position.z, position.x);
    vec3 p = position;
    p.xz *= thick;
    float env = sin(3.14159 * t);          // pinned at both ends
    p.x += amp * env * sin(t * 18.0 - phase);
    p.z += amp * 0.6 * env * cos(t * 13.0 - phase * 0.8);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    wp.y -= sag * env;                     // gravity: slack web droops
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const LINE_FS = /* glsl */ `
  uniform vec3 color; uniform float alpha; uniform float len;
  varying float vT; varying float vA;
  void main() {
    // Twisted silk strands: a spiral of light/dark fibres along the rope.
    float twist = fract((vT * len * 2.2) + vA / 6.2832 * 3.0);
    float fibre = 0.72 + 0.28 * smoothstep(0.2, 0.5, twist) * smoothstep(0.95, 0.6, twist);
    gl_FragColor = vec4(color * fibre, alpha);
  }
`;

export class SwingLine {
  constructor(scene) {
    const mk = (thick, color, alpha, additive) =>
      new THREE.ShaderMaterial({
        uniforms: { amp: { value: 0 }, phase: { value: 0 }, sag: { value: 0 }, len: { value: 10 }, thick: { value: thick }, color: { value: new THREE.Color(color) }, alpha: { value: alpha } },
        vertexShader: LINE_VS,
        fragmentShader: LINE_FS,
        transparent: true,
        depthWrite: false, // keep the ink-outline pass from edging the line
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 48, true);
    this.core = new THREE.Mesh(geo, mk(0.045, 0xf2eee6, 1, false));
    this.halo = new THREE.Mesh(geo, mk(0.085, 0xffffff, 0.12, true));
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(3), transparent: true, opacity: 1 }));
    for (const m of [this.core, this.halo, this.flash]) {
      m.layers.set(LAYER_NO_OUTLINE);
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
    }
    this.flashT = 0;
    this.extendT = 1;
    this.retractT = -1;
    this.waveT = 9;
    this.lastFrom = new THREE.Vector3();
    this.lastTo = new THREE.Vector3();
  }

  setColor(c) {
    // Web stays silk-white; the suit accent only faintly tints the sheen.
    this.core.material.uniforms.color.value.set(0xf2eee6).lerp(c, 0.08).multiplyScalar(1.15);
    this.halo.material.uniforms.color.value.set(0xffffff).lerp(c, 0.25).multiplyScalar(0.6);
  }

  /** Line fired: grow toward the anchor, then ripple. */
  zap() {
    this.flashT = 0.25;
    this.extendT = 0;
    this.waveT = 0;
    this.retractT = -1;
  }

  /** Let go: the hand end whips back to the anchor. */
  release() {
    this.retractT = 0;
  }

  draw(from, to, jitter) {
    const len = Math.max(0.01, from.distanceTo(to));
    _p.copy(from).add(to).multiplyScalar(0.5);
    _s.copy(to).sub(from).normalize();
    _q.setFromUnitVectors(UP, _s);
    for (const m of [this.core, this.halo]) {
      m.visible = true;
      m.position.copy(_p);
      m.quaternion.copy(_q);
      m.scale.set(1 + jitter, len, 1 + jitter);
      m.material.uniforms.len.value = len;
      // Flying out it droops a lot; once it bites it pulls nearly taut.
      const slack = this.extendT < 0.25 ? 0.07 * (1 - this.extendT / 0.25) : 0;
      m.material.uniforms.sag.value = len * (0.012 + slack + (this.retractT >= 0 ? 0.08 : 0));
    }
  }

  update(dt, from, to, attached, jitter = 0) {
    this.flashT = Math.max(0, this.flashT - dt);
    this.extendT += dt;
    this.waveT += dt;
    const amp = this.waveT < 0.45 ? 0.28 * (1 - this.waveT / 0.45) : 0.02;
    for (const m of [this.core, this.halo]) {
      m.material.uniforms.amp.value = amp;
      m.material.uniforms.phase.value += dt * 30;
    }
    if (attached) {
      const k = Math.min(1, this.extendT / 0.16); // silk shoots out, not a laser
      this.lastFrom.copy(from);
      this.lastTo.copy(to);
      _v.copy(from).lerp(to, k);
      this.draw(from, _v, jitter);
    } else if (this.retractT >= 0 && this.retractT < 0.16) {
      this.retractT += dt;
      const k = Math.min(1, this.retractT / 0.16);
      _v.copy(this.lastFrom).lerp(this.lastTo, k);
      this.draw(_v, this.lastTo, jitter);
    } else {
      this.core.visible = this.halo.visible = false;
    }
    this.flash.visible = this.flashT > 0;
    this.flash.position.copy(to);
    this.flash.material.opacity = this.flashT / 0.25;
    this.flash.scale.setScalar(0.5 + (0.25 - this.flashT) * 4);
  }

  hide() {
    this.core.visible = this.halo.visible = this.flash.visible = false;
    this.retractT = -1;
  }
}

/** Tiny instanced particle system for sparks, debris and ink splats. */
export class Particles {
  constructor(scene, max = 300) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_NO_OUTLINE);
    scene.add(this.mesh);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), col: new THREE.Color(), size: 1, g: 9 });
    this.mesh.setColorAt(0, new THREE.Color());
  }

  burst(pos, color, n = 16, speed = 6, size = 1, gravity = 9, intensity = 2.5) {
    let k = 0;
    for (const p of this.p) {
      if (p.life > 0) continue;
      p.life = 0.5 + Math.random() * 0.5;
      p.pos.copy(pos);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      p.col.set(color).multiplyScalar(intensity);
      p.size = size * (0.5 + Math.random());
      p.g = gravity;
      if (++k >= n) break;
    }
  }

  update(dt) {
    let n = 0;
    for (const p of this.p) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= p.g * dt;
      p.pos.addScaledVector(p.vel, dt);
      _s.setScalar(Math.max(0.01, p.size * Math.min(1, p.life * 2)));
      _e.set(p.life * 7, p.life * 5, 0);
      _q.setFromEuler(_e);
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, p.col);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  rebase(offset) {
    for (const p of this.p) p.pos.sub(offset);
  }
}

import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

const V = new THREE.Vector3();
const Q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.castShadow = true;
  return m;
}

const patternCache = new Map();
/** White-based suit patterns (tinted by the suit colour). */
function patternTexture(kind) {
  if (!kind || kind === 'solid') return null;
  if (patternCache.has(kind)) return patternCache.get(kind);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(20,10,40,0.55)';
  g.strokeStyle = 'rgba(20,10,40,0.6)';
  if (kind === 'stripes') for (let i = 0; i < 256; i += 32) g.fillRect(0, i, 256, 12);
  else if (kind === 'halftone') {
    for (let y = 0; y < 256; y += 10) for (let x = 0; x < 256; x += 10) {
      g.beginPath();
      g.arc(x + (y % 20 ? 5 : 0), y, 1 + (y / 256) * 3.5, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'circuit') {
    g.lineWidth = 4;
    for (let i = 0; i < 18; i++) {
      let x = (i * 53) % 256;
      let y = (i * 97) % 256;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (k % 2) y += 40; else x += 40;
        g.lineTo(x, y);
      }
      g.stroke();
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'graffiti') {
    const cols = ['rgba(255,63,164,0.7)', 'rgba(63,224,255,0.7)', 'rgba(255,216,74,0.8)', 'rgba(168,240,58,0.7)'];
    for (let i = 0; i < 22; i++) {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.ellipse((i * 71) % 256, (i * 43) % 256, 18 + (i % 4) * 8, 8 + (i % 3) * 6, i, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'camo') {
    const cols = ['rgba(20,10,40,0.35)', 'rgba(20,10,40,0.6)', 'rgba(255,255,255,0.3)'];
    for (let i = 0; i < 40; i++) {
      g.fillStyle = cols[i % 3];
      g.beginPath();
      g.ellipse((i * 67) % 256, (i * 131) % 256, 20 + (i % 5) * 6, 12 + (i % 4) * 6, i * 0.7, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  patternCache.set(kind, t);
  return t;
}

/** Original chest emblems (no licensed symbols). */
function drawEmblem(cv, kind, accent, trim) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  if (!kind || kind === 'none') return;
  const a = '#' + new THREE.Color(accent).getHexString();
  const t = '#' + new THREE.Color(trim).getHexString();
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = t;
  g.fillStyle = a;
  g.beginPath();
  if (kind === 'bolt') {
    g.moveTo(74, 8); g.lineTo(30, 70); g.lineTo(60, 70); g.lineTo(46, 120); g.lineTo(98, 50); g.lineTo(66, 50); g.closePath();
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 24 : 56;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(64 + Math.cos(ang) * r, 64 + Math.sin(ang) * r);
    }
    g.closePath();
  } else if (kind === 'v') {
    g.moveTo(14, 20); g.lineTo(48, 20); g.lineTo(64, 70); g.lineTo(80, 20); g.lineTo(114, 20); g.lineTo(78, 112); g.lineTo(50, 112); g.closePath();
  } else if (kind === 'eye') {
    g.ellipse(64, 64, 56, 30, 0, 0, Math.PI * 2);
  } else if (kind === 'spiral') {
    g.lineWidth = 14;
    g.strokeStyle = a;
    for (let i = 0; i < 60; i++) {
      const ang = i * 0.3;
      const r = 4 + i * 0.9;
      g.lineTo(64 + Math.cos(ang) * r, 64 + Math.sin(ang) * r);
    }
    g.stroke();
    return;
  }
  g.fill();
  g.stroke();
}

/**
 * Procedural hero "Volt": hoodie, visor mask, wrist launchers. Every limb hangs
 * off a pivot so poses are blended procedurally (swing, hop flip, dive roll).
 */
export class Hero {
  constructor() {
    this.root = new THREE.Group();
    this.mats = {
      hoodie: new THREE.MeshStandardMaterial({ roughness: 0.78 }),
      hoodieDark: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      shoes: new THREE.MeshStandardMaterial({ roughness: 0.45 }),
      sole: new THREE.MeshStandardMaterial({ color: 0xf4f1ff, roughness: 0.6 }),
      trim: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      mask: new THREE.MeshStandardMaterial({ color: 0x1b1030, roughness: 0.35, metalness: 0.3 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.6 }),
      gear: new THREE.MeshStandardMaterial({ color: 0x2e2a4a, roughness: 0.3, metalness: 0.85 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
    const M = this.mats;
    this.body = new THREE.Group();
    this.root.add(this.body);

    // Hips / legs.
    this.hips = new THREE.Group();
    this.hips.position.y = -0.12;
    this.body.add(this.hips);
    const pelvis = capsule(0.19, 0.18, M.pants);
    pelvis.rotation.z = Math.PI / 2;
    this.hips.add(pelvis);
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(0.12 * s, -0.05, 0);
      this.hips.add(hip);
      const thigh = capsule(0.1, 0.3, M.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      const shin = capsule(0.085, 0.3, M.pants);
      shin.position.y = -0.2;
      knee.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3), M.shoes);
      shoe.position.set(0, -0.43, 0.06);
      shoe.castShadow = true;
      knee.add(shoe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.32), M.sole);
      sole.position.set(0, -0.5, 0.06);
      knee.add(sole);
      return { hip, knee };
    });

    // Torso.
    this.torso = new THREE.Group();
    this.torso.position.y = -0.02;
    this.body.add(this.torso);
    const chest = capsule(0.22, 0.34, M.hoodie);
    chest.position.y = 0.26;
    chest.scale.set(1.15, 1, 0.82);
    this.torso.add(chest);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), M.hoodieDark);
    pocket.position.set(0, 0.12, 0.18);
    this.torso.add(pocket);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.4), M.trim);
    stripe.position.set(0, 0.3, 0);
    this.torso.add(stripe);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.14), M.gear);
    pack.position.set(0, 0.3, -0.22);
    pack.castShadow = true;
    this.torso.add(pack);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 10), M.glow);
    coil.rotation.z = Math.PI / 2;
    coil.position.set(0, 0.36, -0.3);
    this.torso.add(coil);
    this.glowParts = [coil];

    // Head: hood + visor mask.
    this.neck = new THREE.Group();
    this.neck.position.y = 0.52;
    this.torso.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), M.mask);
    head.position.y = 0.14;
    head.scale.set(1, 1.1, 1);
    head.castShadow = true;
    this.neck.add(head);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hoodie);
    hood.position.set(0, 0.16, -0.035);
    hood.rotation.x = -0.35;
    hood.castShadow = true;
    this.neck.add(hood);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.1), M.glow);
    visor.position.set(0, 0.17, 0.12);
    this.neck.add(visor);
    this.glowParts.push(visor);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.12), M.trim);
    brow.position.set(0, 0.215, 0.115);
    this.neck.add(brow);

    // Arms with launcher gauntlets.
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.3 * s, 0.4, 0);
      this.torso.add(shoulder);
      const upper = capsule(0.075, 0.24, M.hoodie);
      upper.position.y = -0.17;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      shoulder.add(elbow);
      const fore = capsule(0.065, 0.22, M.hoodie);
      fore.position.y = -0.15;
      elbow.add(fore);
      const gauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.14, 10), M.gear);
      gauntlet.position.y = -0.24;
      elbow.add(gauntlet);
      const light = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 16), M.glow);
      light.rotation.x = Math.PI / 2;
      light.position.y = -0.2;
      elbow.add(light);
      this.glowParts.push(light);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.trim);
      hand.position.y = -0.35;
      elbow.add(hand);
      return { shoulder, elbow, hand };
    });
    for (const g of this.glowParts) g.layers.set(LAYER_NO_OUTLINE);

    // Shield bubble (fresnel glow).
    this.parts = { chest, pocket, stripe, pack, coil, head, hood, visor, brow };
    this.buildExtras();

    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(0x3fe0ff) }, time: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 color; uniform float time; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = step(0.92, fract((vN.x+vN.y*1.7)*6.0 + time)); gl_FragColor = vec4(color*2.2, f*0.9 + hex*0.15); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.shield.visible = false;
    this.shield.layers.set(LAYER_NO_OUTLINE);
    this.root.add(this.shield);

    this.t = 0;
    this.pose = { swing: 1, fly: 0, hop: 0, dive: 0, idle: 0, stumble: 0, fall: 0 };
    this.flip = 0;
    this.lean = 0;
    this.pendulum = 0;
    this.handWorld = new THREE.Vector3();
    this.lineSide = 1;
  }

  /** Optional parts toggled by the Hero Studio look. */
  buildExtras() {
    const M = this.mats;
    M.hair = new THREE.MeshStandardMaterial({ color: 0x1b1030, roughness: 0.55 });
    M.pattern = null;
    const P = this.parts;
    const add = (parent, geo, mat, pos, rot, scl) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (scl) m.scale.set(...scl);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // Eye mask (upper face) used when the face is uncovered below.
    const eyeMask = add(this.neck, new THREE.SphereGeometry(0.168, 20, 10, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.3), M.mask, [0, 0.14, 0], null, [1, 1.1, 1]);
    // Hood down: a thick collar.
    const collar = add(this.neck, new THREE.TorusGeometry(0.16, 0.06, 8, 20), M.hoodie, [0, -0.02, -0.02], [Math.PI / 2, 0, 0]);
    // Hair styles.
    const hair = {};
    const hg = (name) => {
      const g = new THREE.Group();
      this.neck.add(g);
      hair[name] = g;
      return g;
    };
    const sph = new THREE.SphereGeometry(1, 16, 12);
    add(hg('short'), sph, M.hair, [0, 0.2, -0.02], null, [0.175, 0.13, 0.18]);
    const pony = hg('ponytail');
    add(pony, sph, M.hair, [0, 0.2, -0.02], null, [0.175, 0.13, 0.18]);
    add(pony, new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), M.hair, [0, 0.08, -0.2], [0.5, 0, 0]);
    const long = hg('long');
    add(long, sph, M.hair, [0, 0.19, -0.02], null, [0.18, 0.14, 0.19]);
    add(long, new THREE.BoxGeometry(0.34, 0.42, 0.12), M.hair, [0, -0.02, -0.12], [0.12, 0, 0]);
    const puffs = hg('puffs');
    add(puffs, sph, M.hair, [0, 0.19, -0.02], null, [0.175, 0.12, 0.18]);
    add(puffs, sph, M.hair, [-0.15, 0.3, -0.04], null, [0.1, 0.1, 0.1]);
    add(puffs, sph, M.hair, [0.15, 0.3, -0.04], null, [0.1, 0.1, 0.1]);
    const hawk = hg('mohawk');
    for (let i = 0; i < 5; i++) add(hawk, new THREE.ConeGeometry(0.035, 0.16, 6), M.hair, [0, 0.32 - Math.abs(i - 2) * 0.02, 0.12 - i * 0.07], [-0.4 - i * 0.12, 0, 0]);
    const braids = hg('braids');
    add(braids, sph, M.hair, [0, 0.19, -0.02], null, [0.175, 0.13, 0.18]);
    for (const x of [-0.13, 0.13]) add(braids, new THREE.CapsuleGeometry(0.035, 0.34, 4, 6), M.hair, [x, -0.02, -0.08], [0.25, 0, 0]);
    const afro = hg('afro');
    add(afro, sph, M.hair, [0, 0.22, -0.03], null, [0.26, 0.22, 0.25]);
    // Gear.
    const phones = new THREE.Group();
    this.neck.add(phones);
    add(phones, new THREE.TorusGeometry(0.19, 0.018, 6, 20, Math.PI), M.gear, [0, 0.16, 0], [0, Math.PI / 2, 0]);
    for (const x of [-0.18, 0.18]) add(phones, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), M.trim, [x, 0.13, 0], [0, 0, Math.PI / 2]);
    const goggles = new THREE.Group();
    this.neck.add(goggles);
    for (const x of [-0.07, 0.07]) {
      const lens = add(goggles, new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14), M.glow, [x, 0.18, 0.14], [Math.PI / 2, 0, 0]);
      lens.layers.set(LAYER_NO_OUTLINE);
    }
    add(goggles, new THREE.BoxGeometry(0.34, 0.035, 0.02), M.gear, [0, 0.18, 0.1]);
    // Chest emblem (canvas decal).
    this.emblemCanvas = document.createElement('canvas');
    this.emblemCanvas.width = this.emblemCanvas.height = 128;
    this.emblemTex = new THREE.CanvasTexture(this.emblemCanvas);
    this.emblemTex.colorSpace = THREE.SRGBColorSpace;
    const emblem = add(this.torso, new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshStandardMaterial({ map: this.emblemTex, transparent: true, alphaTest: 0.4, emissive: 0xffffff, emissiveMap: this.emblemTex, emissiveIntensity: 0.6 }), [0, 0.3, 0.195]);
    // Scarf: a ribbon driven by a little verlet chain (updated in animate).
    const N = 8;
    const scarfGeo = new THREE.PlaneGeometry(0.16, 1, 1, N - 1);
    const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.7, side: THREE.DoubleSide }));
    scarf.frustumCulled = false;
    this.scarf = { mesh: scarf, pts: [], prev: [], N, seg: 0.13, on: false };
    for (let i = 0; i < N; i++) {
      this.scarf.pts.push(new THREE.Vector3());
      this.scarf.prev.push(new THREE.Vector3());
    }
    Object.assign(this.parts, { eyeMask, collar, hair, phones, goggles, emblem });
    this.scarfNeck = new THREE.Object3D();
    this.scarfNeck.position.set(0, 0.02, -0.12);
    this.neck.add(this.scarfNeck);
  }

  /** Apply a full Hero Studio look. */
  setLook(look) {
    const M = this.mats;
    const P = this.parts;
    const c = (v) => new THREE.Color(v);
    M.hoodie.color.copy(c(look.suit));
    M.hoodieDark.color.copy(c(look.suit)).multiplyScalar(0.7);
    M.pants.color.copy(c(look.pants));
    M.shoes.color.copy(c(look.shoes));
    M.trim.color.copy(c(look.trim));
    M.skin.color.copy(c(look.skin));
    M.hair.color.copy(c(look.hairColor));
    M.glow.color.copy(c(look.accent)).multiplyScalar(3);
    this.accent = c(look.accent);
    // Body type: B = narrower shoulders, fuller hips, a touch shorter.
    const b = look.body === 'B';
    this.torso.scale.set(b ? 0.88 : 1, b ? 0.96 : 1, b ? 0.92 : 1);
    this.hips.scale.set(b ? 1.12 : 1, 1, 1);
    this.arms.forEach((a) => a.shoulder.scale.setScalar(b ? 0.92 : 1));
    this.legs.forEach((l) => l.hip.scale.set(b ? 0.95 : 1, b ? 0.96 : 1, b ? 0.95 : 1));
    // Head: mask style + hood + hair.
    const full = look.mask === 'full';
    P.head.material = full ? M.mask : M.skin;
    P.eyeMask.visible = !full;
    const hoodUp = look.hood === 'up';
    P.hood.visible = hoodUp;
    P.collar.visible = !hoodUp;
    for (const [k, g] of Object.entries(P.hair)) g.visible = !hoodUp && k === look.hair;
    P.visor.visible = look.eyes === 'visor';
    P.goggles.visible = look.eyes === 'goggles';
    P.brow.visible = look.eyes === 'visor';
    P.phones.visible = !!look.headphones;
    P.pack.visible = P.coil.visible = !!look.backpack;
    this.scarf.on = !!look.scarf;
    this.scarf.mesh.visible = this.scarf.on;
    this.scarf.mesh.material.color.copy(c(look.scarfColor || look.accent));
    // Suit pattern + emblem.
    M.hoodie.map = patternTexture(look.pattern);
    M.hoodie.needsUpdate = true;
    drawEmblem(this.emblemCanvas, look.emblem, look.accent, look.trim);
    this.emblemTex.needsUpdate = true;
    P.emblem.visible = look.emblem !== 'none';
    this.lookKey = JSON.stringify(look);
  }

  /** Verlet scarf that trails behind (call once per frame after animate). */
  updateScarf(dt, scene) {
    const sc = this.scarf;
    if (!sc.on) return;
    if (!sc.mesh.parent) scene.add(sc.mesh);
    const anchor = this.scarfNeck.getWorldPosition(new THREE.Vector3());
    if (!sc.init) {
      sc.pts.forEach((p, i) => p.copy(anchor).add(new THREE.Vector3(0, -i * sc.seg, 0)));
      sc.prev.forEach((p, i) => p.copy(sc.pts[i]));
      sc.init = true;
    }
    const g = new THREE.Vector3(0, -9.8 * dt * dt, 0);
    for (let i = 1; i < sc.N; i++) {
      const p = sc.pts[i];
      const v = p.clone().sub(sc.prev[i]).multiplyScalar(0.96);
      sc.prev[i].copy(p);
      p.add(v).add(g);
    }
    sc.pts[0].copy(anchor);
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i < sc.N; i++) {
        const a = sc.pts[i - 1];
        const p = sc.pts[i];
        const d = p.clone().sub(a);
        const len = d.length() || 1e-4;
        p.copy(a).addScaledVector(d, sc.seg / len);
      }
    }
    // Rebuild the ribbon: 2 verts per point, offset sideways.
    const pos = sc.mesh.geometry.attributes.position;
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.quaternion).multiplyScalar(0.08);
    for (let i = 0; i < sc.N; i++) {
      const p = sc.pts[i];
      const row = sc.N - 1 - i;
      pos.setXYZ(row * 2, p.x - side.x, p.y - side.y, p.z - side.z);
      pos.setXYZ(row * 2 + 1, p.x + side.x, p.y + side.y, p.z + side.z);
    }
    pos.needsUpdate = true;
    sc.mesh.geometry.computeVertexNormals();
    sc.mesh.geometry.computeBoundingSphere();
  }

  setSkin(skin) {
    const M = this.mats;
    M.hoodie.color.set(skin.hoodie);
    M.hoodieDark.color.set(skin.hoodie).multiplyScalar(0.7);
    M.pants.color.set(skin.pants);
    M.shoes.color.set(skin.shoes);
    M.trim.color.set(skin.trim);
    M.glow.color.set(skin.accent).multiplyScalar(3);
    this.accent = new THREE.Color(skin.accent);
  }

  /**
   * Blend the pose from the current state.
   * state: { mode: 'swing'|'hop'|'dive'|'idle'|'stumble'|'fall', phase, anchorWorld, lateralVel, hopT }
   */
  animate(dt, st) {
    this.t += dt;
    const P = this.pose;
    for (const k of Object.keys(P)) P[k] = damp(P[k], st.mode === k ? 1 : 0, 12, dt);
    const t = this.t;
    const ph = st.phase ?? 0;

    // Base pose values (radians) per state, blended by weight.
    let torsoPitch = 0, torsoRoll = 0, hipX = [0, 0], kneeX = [0, 0], armAim = [false, false];
    let shoulderX = [0, 0], shoulderZ = [0, 0], elbowX = [0, 0], headX = 0, bodyY = 0;

    // Swing: legs pendulum, one arm up at the anchor, other flung back.
    const sw = Math.sin(ph * Math.PI * 2);
    const w = P.swing;
    torsoPitch += w * (0.25 - sw * 0.25);
    hipX[0] += w * (-0.7 + sw * 0.55);
    hipX[1] += w * (-0.2 - sw * 0.65);
    kneeX[0] += w * (1.1 + sw * 0.3);
    kneeX[1] += w * (0.5 - sw * 0.2);
    const fi = this.lineSide > 0 ? 0 : 1; // free arm flings back
    shoulderX[fi] += w * 0.9;
    shoulderZ[fi] += w * 0.6;
    elbowX[fi] += w * -0.5;
    armAim[1 - fi] = !!st.anchorWorld && w > 0.3;

    // Swing inertia: legs trail the body's angular velocity.
    const trail = THREE.MathUtils.clamp((st.swingVel || 0) * -0.12, -0.6, 0.6) * w;
    hipX[0] += trail;
    hipX[1] += trail * 0.8;

    // Fly (between lines): arms flung wide, legs trailing.
    const fl = P.fly;
    shoulderZ[0] += fl * 1.25; shoulderZ[1] += fl * 1.25;
    shoulderX[0] += fl * 0.35; shoulderX[1] += fl * 0.2;
    elbowX[0] += fl * -0.35; elbowX[1] += fl * -0.35;
    hipX[0] += fl * 0.25; hipX[1] += fl * -0.45;
    kneeX[0] += fl * 0.5; kneeX[1] += fl * 1.0;
    torsoPitch += fl * 0.25;

    // Hop: tuck.
    const h = P.hop;
    hipX[0] += h * -1.5; hipX[1] += h * -1.3;
    kneeX[0] += h * 2.0; kneeX[1] += h * 2.1;
    shoulderX[0] += h * -0.8; shoulderX[1] += h * -0.8;
    elbowX[0] += h * -1.2; elbowX[1] += h * -1.2;
    torsoPitch += h * 0.35;

    // Dive: low curl.
    const dv = P.dive;
    hipX[0] += dv * -1.9; hipX[1] += dv * -1.9;
    kneeX[0] += dv * 2.3; kneeX[1] += dv * 2.3;
    shoulderX[0] += dv * -1.4; shoulderX[1] += dv * -1.4;
    elbowX[0] += dv * -1.6; elbowX[1] += dv * -1.6;
    torsoPitch += dv * 0.8;
    headX += dv * 0.4;

    // Idle crouch on a ledge.
    const id = P.idle;
    const br = Math.sin(t * 2.2) * 0.04;
    hipX[0] += id * -1.3; hipX[1] += id * -0.5;
    kneeX[0] += id * 1.9; kneeX[1] += id * 1.2;
    torsoPitch += id * (0.55 + br);
    shoulderX[0] += id * -0.5; shoulderX[1] += id * -0.2;
    elbowX[0] += id * -1.0; elbowX[1] += id * -0.8;
    shoulderZ[0] += id * 0.25; shoulderZ[1] += id * 0.25;
    bodyY += id * -0.35;
    headX += id * (-0.3 + Math.sin(t * 0.7) * 0.1);

    // Stumble / fall: flail.
    const sb = Math.max(P.stumble, P.fall);
    shoulderZ[0] += sb * (1.6 + Math.sin(t * 20) * 0.4);
    shoulderZ[1] += sb * (1.6 + Math.sin(t * 23) * 0.4);
    hipX[0] += sb * Math.sin(t * 18) * 0.6;
    hipX[1] += sb * -Math.sin(t * 18) * 0.6;
    torsoPitch += P.fall * -1.2;

    // Apply.
    this.body.position.y = bodyY;
    this.torso.rotation.set(torsoPitch * 0.5, 0, torsoRoll);
    this.hips.rotation.x = torsoPitch * 0.3;
    this.neck.rotation.x = headX - torsoPitch * 0.3;
    for (let i = 0; i < 2; i++) {
      this.legs[i].hip.rotation.x = hipX[i];
      this.legs[i].knee.rotation.x = kneeX[i];
      const arm = this.arms[i];
      arm.elbow.rotation.x = elbowX[i];
      if (armAim[i]) {
        // Point the arm at the anchor, expressed in the shoulder's parent space.
        arm.shoulder.parent.updateMatrixWorld(true);
        const inv = Q.copy(arm.shoulder.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
        arm.shoulder.getWorldPosition(V);
        const dir = st.anchorWorld.clone().sub(V).normalize().applyQuaternion(inv);
        const target = new THREE.Quaternion().setFromUnitVectors(DOWN, dir);
        arm.shoulder.quaternion.slerp(target, 1 - Math.exp(-25 * dt));
        arm.elbow.rotation.x = -0.1;
      } else {
        // shoulderZ is an outward raise; left arm raises toward -x.
        const e = new THREE.Euler(shoulderX[i], 0, shoulderZ[i] * (i === 0 ? -1 : 1));
        arm.shoulder.quaternion.slerp(new THREE.Quaternion().setFromEuler(e), 1 - Math.exp(-14 * dt));
      }
    }

    // Whole-body flips / rolls on top of the pose.
    this.body.rotation.x = this.flip;
    this.body.rotation.z = this.lean;
    this.shield.material.uniforms.time.value = t;

    const hand = this.arms[this.lineSide > 0 ? 1 : 0].hand;
    hand.getWorldPosition(this.handWorld);
    for (const g of this.glowParts) g.visible = true;
  }
}

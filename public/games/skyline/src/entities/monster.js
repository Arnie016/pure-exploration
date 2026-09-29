import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const FUR_TIME = { value: 0 };

/**
 * Shell fur: N copies of the skinned body pushed out along the skinned normal,
 * each discarding more of a 3D strand hash, so the hound reads as a shaggy,
 * wet-ink beast instead of smooth plastic. Shells share geometry + skeleton.
 */
function addFur(body, layers = 14, length = 0.16) {
  const root = new THREE.Color(0x07030b);
  const tip = new THREE.Color(0x3a1260);
  for (let i = 1; i <= layers; i++) {
    const f = i / layers;
    const mat = new THREE.MeshStandardMaterial({
      color: root.clone().lerp(tip, Math.pow(f, 1.6)),
      roughness: 0.85,
      emissive: new THREE.Color(0x5a0a70),
      emissiveIntensity: f * f * 0.5,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.shell = { value: f };
      sh.uniforms.furLen = { value: length };
      sh.uniforms.furTime = FUR_TIME;
      sh.vertexShader =
        'uniform float shell; uniform float furLen; uniform float furTime; varying vec3 vFurPos; varying float vShell;\n' +
        sh.vertexShader.replace(
          '#include <skinning_vertex>',
          `#include <skinning_vertex>
          vFurPos = position * 30.0;
          vShell = shell;
          vec3 fn = normalize(objectNormal);
          transformed += fn * shell * furLen;
          // Gravity droop + a little wind so the fur moves.
          transformed.y -= shell * shell * furLen * 0.7;
          transformed.x += sin(furTime * 6.0 + position.z * 3.0) * shell * shell * 0.03;`,
        );
      sh.fragmentShader =
        'varying vec3 vFurPos; varying float vShell;\nfloat furHash(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' +
        sh.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          float strand = furHash(vFurPos);
          if (strand < vShell * 0.92 + 0.04) discard;`,
        );
    };
    const shell = new THREE.SkinnedMesh(body.geometry, mat);
    shell.bind(body.skeleton, body.bindMatrix);
    shell.frustumCulled = false;
    shell.layers.set(LAYER_NO_OUTLINE);
    body.parent.add(shell);
  }
}

/** Merge static detail meshes that hang off the same bone (teeth, spines...). */
function mergeBoneDetails(scene) {
  scene.traverse((bone) => {
    if (!bone.isBone) return;
    const groups = new Map();
    for (const c of bone.children) {
      if (!c.isMesh || c.isSkinnedMesh) continue;
      const key = c.material.uuid;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        const g = m.geometry.clone().applyMatrix4(m.matrix);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g.index ? g.toNonIndexed() : g;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos), list[0].material);
      merged.castShadow = true;
      for (const m of list) bone.remove(m);
      bone.add(merged);
    }
  });
}

const damp = (a, b, k, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-k * dt));

/**
 * The Ink Hound: a hulking beast of wet graffiti ink. Glossy body, glowing
 * eyes, dripping ink, and a gallop cycle driven by speed.
 */
export class Monster {
  constructor() {
    this.root = new THREE.Group();
    const ink = new THREE.MeshStandardMaterial({ color: 0x1d1033, roughness: 0.12, metalness: 0.25, emissive: 0x2a0a40, emissiveIntensity: 0.6 });
    const inkLight = new THREE.MeshStandardMaterial({ color: 0x5a1f8a, roughness: 0.2, metalness: 0.2 });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2fd0).multiplyScalar(4) });
    const tooth = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.4 });
    this.eyeMat = eye;
    const mesh = (geo, mat, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast;
      return m;
    };

    this.body = new THREE.Group();
    this.root.add(this.body);
    const torso = mesh(new THREE.SphereGeometry(1, 28, 18), ink);
    torso.scale.set(1.25, 1.05, 1.9);
    torso.position.y = 2.1;
    this.body.add(torso);
    const chest = mesh(new THREE.SphereGeometry(1, 24, 16), ink);
    chest.scale.set(1.35, 1.25, 1.1);
    chest.position.set(0, 2.45, 1.1);
    this.body.add(chest);
    // Spines along the back.
    for (let i = 0; i < 7; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.18 + (i % 2) * 0.06, 0.8 + Math.sin(i) * 0.2, 8), inkLight);
      sp.position.set(0, 3.15 - i * 0.05, 1.2 - i * 0.55);
      sp.rotation.x = -0.5;
      this.body.add(sp);
    }

    // Head with snapping jaw.
    this.head = new THREE.Group();
    this.head.position.set(0, 2.9, 2.2);
    this.body.add(this.head);
    const skull = mesh(new THREE.SphereGeometry(0.75, 24, 16), ink);
    skull.scale.set(1.1, 0.85, 1.2);
    this.head.add(skull);
    const snout = mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), ink);
    snout.position.set(0, -0.1, 0.8);
    this.head.add(snout);
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.13, 12, 10), eye, false);
      e.scale.set(1.3, 0.7, 0.6);
      e.position.set(0.36 * s, 0.18, 0.72);
      e.layers.set(LAYER_NO_OUTLINE);
      this.head.add(e);
      const horn = mesh(new THREE.ConeGeometry(0.16, 0.9, 10), inkLight);
      horn.position.set(0.45 * s, 0.6, -0.1);
      horn.rotation.set(-0.7, 0, -0.35 * s);
      this.head.add(horn);
    }
    for (let i = 0; i < 4; i++) {
      const t = mesh(new THREE.ConeGeometry(0.06, 0.22, 6), tooth, false);
      t.position.set(-0.3 + i * 0.2, -0.38, 1.22);
      t.rotation.x = Math.PI;
      this.head.add(t);
    }
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.35, 0.3);
    this.head.add(this.jaw);
    const jawMesh = mesh(new THREE.BoxGeometry(0.8, 0.22, 1.05), ink);
    jawMesh.position.set(0, -0.08, 0.5);
    this.jaw.add(jawMesh);
    for (let i = 0; i < 4; i++) {
      const t = mesh(new THREE.ConeGeometry(0.055, 0.2, 6), tooth, false);
      t.position.set(-0.27 + i * 0.18, 0.1, 0.9);
      this.jaw.add(t);
    }
    const maw = mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2f8a).multiplyScalar(2) }), false);
    maw.position.set(0, -0.3, 0.8);
    maw.scale.set(1, 0.4, 1);
    maw.layers.set(LAYER_NO_OUTLINE);
    this.head.add(maw);

    // Legs: [front-left, front-right, back-left, back-right].
    this.legs = [];
    for (const [x, z, front] of [[-0.85, 1.3, true], [0.85, 1.3, true], [-0.9, -1.2, false], [0.9, -1.2, false]]) {
      const hip = new THREE.Group();
      hip.position.set(x, 2.1, z);
      this.body.add(hip);
      const upper = mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 10), ink);
      upper.position.y = -0.6;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -1.15;
      hip.add(knee);
      const lower = mesh(new THREE.CapsuleGeometry(0.2, 0.7, 6, 10), ink);
      lower.position.y = -0.45;
      knee.add(lower);
      const paw = mesh(new THREE.SphereGeometry(0.3, 12, 8), inkLight);
      paw.scale.set(1, 0.55, 1.3);
      paw.position.set(0, -0.92, 0.12);
      knee.add(paw);
      this.legs.push({ hip, knee, front });
    }
    const tail = mesh(new THREE.ConeGeometry(0.3, 2.2, 10), ink);
    tail.position.set(0, 2.5, -2.6);
    tail.rotation.x = -1.1;
    this.tail = tail;
    this.body.add(tail);

    // Ink drips: small blobs that fall and shrink.
    this.drips = [];
    const dripGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(dripGeo, ink);
      d.visible = false;
      this.root.add(d);
      this.drips.push({ m: d, v: new THREE.Vector3(), life: 0 });
    }

    this.root.scale.setScalar(0.78);
    this.phase = 0;
    this.roarT = 0;
    this.dripTimer = 0;
    this.loadModel();
  }

  /** Swap the placeholder for the Blender-built, rigged, furred hound. */
  loadModel() {
    new GLTFLoader().load('assets/models/ink_hound.glb', (gltf) => {
      const model = gltf.scene;
      mergeBoneDetails(model);
      let body = null;
      model.traverse((o) => {
        if (o.isSkinnedMesh) body = o;
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          const m = o.material;
          if (m.emissive && m.emissive.r + m.emissive.b > 0.8) {
            // Eyes / maw: keep them hot for bloom and off the ink-outline pass.
            m.emissiveIntensity = 3.5;
            o.layers.set(LAYER_NO_OUTLINE);
            if (m.name === 'Eye') this.eyeMat2 = m;
          }
        }
      });
      if (body) {
        body.material = new THREE.MeshStandardMaterial({ color: 0x120618, roughness: 0.25, metalness: 0.2, emissive: 0x1a0428, emissiveIntensity: 0.6 });
        addFur(body);
      }
      this.bones = {};
      model.traverse((o) => {
        if (o.isBone) this.bones[o.name] = { bone: o, rest: o.quaternion.clone() };
      });
      model.scale.setScalar(0.72 / 0.78);
      this.template = model;
      // Clones share these geometries: never dispose them with a segment.
      model.traverse((o) => o.isMesh && (o.geometry.userData.shared = true));
      this.root.add(model);
      this.body.visible = false; // retire the placeholder
      this.model = model;
    });
  }

  /** A small copy of the hound (fur and all) for the imp pack. */
  makeMini(scale = 0.3) {
    if (!this.template) return null;
    const m = cloneSkinned(this.template);
    m.scale.setScalar(scale);
    const bones = {};
    m.traverse((o) => {
      if (o.isBone) bones[o.name] = { bone: o, rest: o.quaternion.clone() };
    });
    const pose = (name, x = 0, y = 0, z = 0) => {
      const b = bones[name];
      if (!b) return;
      _e.set(x, y, z);
      b.bone.quaternion.copy(b.rest).multiply(_q.setFromEuler(_e));
    };
    let ph = Math.random() * 6;
    return {
      root: m,
      update(dt) {
        ph += dt * 13;
        pose('armUL', Math.sin(ph) * 0.9);
        pose('armUR', Math.sin(ph + 0.4) * 0.9);
        pose('legUL', Math.sin(ph + Math.PI) * 0.8);
        pose('legUR', Math.sin(ph + Math.PI + 0.4) * 0.8);
        pose('jaw', 0.3 + Math.max(0, Math.sin(ph * 0.5)) * 0.5);
        pose('tail2', 0, 0, Math.sin(ph * 0.5) * 0.5);
      },
    };
  }

  /** Rotate a bone by euler offsets on top of its rest pose. */
  pose(name, x = 0, y = 0, z = 0) {
    const b = this.bones?.[name];
    if (!b) return;
    _e.set(x, y, z);
    b.bone.quaternion.copy(b.rest).multiply(_q.setFromEuler(_e));
  }

  animateModel(p, roaring) {
    // Rotary gallop: fronts and hinds out of phase, spine flexes with the stride.
    const fl = Math.sin(p);
    const fr = Math.sin(p + 0.5);
    const hl = Math.sin(p + Math.PI);
    const hr = Math.sin(p + Math.PI + 0.5);
    this.pose('armUL', fl * 0.8);
    this.pose('armUR', fr * 0.8);
    this.pose('armLL', Math.max(0, -Math.cos(p)) * -0.9);
    this.pose('armLR', Math.max(0, -Math.cos(p + 0.5)) * -0.9);
    this.pose('legUL', hl * 0.75);
    this.pose('legUR', hr * 0.75);
    this.pose('legLL', Math.max(0, Math.cos(p + Math.PI)) * 0.9);
    this.pose('legLR', Math.max(0, Math.cos(p + Math.PI + 0.5)) * 0.9);
    this.pose('spine1', Math.sin(p * 2) * 0.08);
    this.pose('spine2', -Math.sin(p * 2) * 0.1);
    this.pose('neck', (roaring ? -0.5 : 0) + Math.sin(p * 2 + 1) * 0.06);
    this.pose('head', roaring ? -0.3 : 0);
    this.pose('jaw', roaring ? 0.9 : 0.15 + Math.max(0, Math.sin(p * 2)) * 0.3);
    this.pose('tail1', 0, 0, Math.sin(p * 0.5) * 0.3);
    this.pose('tail2', 0, 0, Math.sin(p * 0.5 - 0.6) * 0.4);
    this.pose('tail3', 0, 0, Math.sin(p * 0.5 - 1.2) * 0.5);
  }

  roar() {
    this.roarT = 1.4;
  }

  update(dt, speed) {
    this.phase += dt * (1.2 + speed * 0.07);
    const p = this.phase * Math.PI * 2;
    for (const L of this.legs) {
      const off = L.front ? 0 : Math.PI;
      L.hip.rotation.x = Math.sin(p + off) * 0.75;
      L.knee.rotation.x = Math.max(0, -Math.cos(p + off)) * 1.2;
    }
    this.body.position.y = Math.abs(Math.sin(p)) * 0.35;
    this.body.rotation.x = Math.sin(p) * 0.08;
    this.tail.rotation.z = Math.sin(p * 0.5) * 0.3;

    this.roarT = Math.max(0, this.roarT - dt);
    const roaring = this.roarT > 0 ? Math.sin(Math.min(1, (1.4 - this.roarT) * 3) * Math.PI * 0.5) : 0;
    this.jaw.rotation.x = damp(this.jaw.rotation.x, roaring ? 0.75 : 0.18 + Math.max(0, Math.sin(p * 2)) * 0.25, 18, dt);
    this.head.rotation.x = damp(this.head.rotation.x, roaring ? -0.55 : Math.sin(p) * 0.08, 10, dt);
    this.eyeMat.color.setRGB(4 + roaring * 4, 0.7, 3.2 + roaring * 2);
    FUR_TIME.value += dt;
    if (this.model) {
      this.animateModel(p, roaring > 0.2);
      if (this.eyeMat2) this.eyeMat2.emissiveIntensity = 3.5 + roaring * 4;
    }

    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = 0.08;
      const d = this.drips.find((x) => x.life <= 0);
      if (d) {
        d.life = 0.9;
        d.m.visible = true;
        d.m.position.set((Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 3);
        d.v.set((Math.random() - 0.5) * 0.5, -1, -2);
      }
    }
    for (const d of this.drips) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 9 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.scale.setScalar(Math.max(0.01, d.life));
      if (d.life <= 0 || d.m.position.y < 0) {
        d.life = 0;
        d.m.visible = false;
      }
    }
  }
}

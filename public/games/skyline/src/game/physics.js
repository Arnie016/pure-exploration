import * as THREE from 'three';
import * as CANNON from '../../vendor/cannon-es.js';

const _off = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Visual-only rigid-body physics (cannon-es): smashed obstacles, flung cars,
 * falling rubble. Gameplay collision stays in the lane system, so physics can
 * be wild without making the game unfair. Bodies are capped and expire.
 */
export class Physics {
  constructor(scene, max = 48) {
    this.scene = scene;
    this.max = max;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.restitution = 0.28;
    this.world.defaultContactMaterial.friction = 0.45;
    this.ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    this.ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.ground);
    this.items = [];

    this.chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    this.chunkMats = [0xb9b2c6, 0xc8583f, 0x8a93b3, 0xe9c08c].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
    );
  }

  setFloor(y) {
    this.ground.position.y = y;
  }

  /**
   * Hand an Object3D to physics. `half` = box half extents (m); `center` = the
   * box centre in the object's local space (e.g. obstacles sit on their base).
   */
  add(obj, half, center, vel, spin, { mass = 1, life = 4, owned = true } = {}) {
    if (this.items.length >= this.max) this.remove(this.items[0]);
    obj.updateMatrixWorld(true);
    if (obj.parent !== this.scene) this.scene.attach(obj);
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)),
      linearDamping: 0.04,
      angularDamping: 0.08,
      sleepSpeedLimit: 0.3,
    });
    _off.copy(center).applyQuaternion(obj.quaternion);
    body.position.set(obj.position.x + _off.x, obj.position.y + _off.y, obj.position.z + _off.z);
    body.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
    body.velocity.set(vel.x, vel.y, vel.z);
    body.angularVelocity.set(spin.x, spin.y, spin.z);
    this.world.addBody(body);
    const item = { obj, body, life, max: life, center: center.clone(), scale: obj.scale.clone(), owned };
    this.items.push(item);
    return item;
  }

  /** Small tumbling rubble chunks. */
  rubble(pos, n = 6, speed = 7, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const s = size * (0.5 + Math.random() * 0.8);
      const m = new THREE.Mesh(this.chunkGeo, this.chunkMats[i % this.chunkMats.length]);
      m.scale.setScalar(s);
      m.castShadow = true;
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5));
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 2, (Math.random() - 0.5) * speed);
      const w = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      this.add(m, new THREE.Vector3(s / 2, s / 2, s / 2), new THREE.Vector3(), v, w, { mass: 0.3, life: 2.6 + Math.random() });
    }
  }

  update(dt) {
    if (!this.items.length) return;
    this.world.step(1 / 60, dt, 3);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const b = it.body;
      it.obj.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      _off.copy(it.center).applyQuaternion(it.obj.quaternion);
      it.obj.position.set(b.position.x - _off.x, b.position.y - _off.y, b.position.z - _off.z);
      it.life -= dt;
      if (it.life < 0.5) it.obj.scale.copy(it.scale).multiplyScalar(Math.max(0.01, it.life / 0.5));
      if (it.life <= 0) this.remove(it);
    }
  }

  remove(it) {
    this.world.removeBody(it.body);
    this.scene.remove(it.obj);
    if (it.owned && it.obj.geometry !== this.chunkGeo) {
      it.obj.traverse((o) => o.isMesh && o.geometry !== this.chunkGeo && !o.geometry.userData.shared && o.geometry.dispose());
    }
    this.items.splice(this.items.indexOf(it), 1);
  }

  clear() {
    while (this.items.length) this.remove(this.items[0]);
  }

  rebase(off) {
    for (const it of this.items) {
      it.body.position.x -= off.x;
      it.body.position.z -= off.z;
      it.obj.position.sub(off);
    }
  }
}

export { _q };

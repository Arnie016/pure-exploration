import * as THREE from 'three';

const GRAVITY = 24; // a touch stronger than real: snappier arcs
const HAND = 0.8; // body centre hangs this far below the hand
const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Rope-and-pendulum model for the hero's *visual* motion.
 *
 * Gameplay stays in the lane system (s, x, logical height). This rig only
 * decides how high the body is drawn and how it tilts: while attached, the hand
 * is held on a sphere of radius R around the anchor, so the body sweeps a real
 * circular arc (low under the anchor, rising after it); after release it flies
 * ballistically until the next line fires. Near obstacles the arc is clamped
 * to the logical band so what you see is what collides.
 */
export class SwingRig {
  constructor() {
    this.anchor = new THREE.Vector3();
    this.reset(1.8);
  }

  reset(y) {
    this.state = 'fly';
    this.y = y;
    this.vy = 0;
    this.R = 0;
    this.side = 1;
    this.flyT = 0.3;
    this.attachT = 0;
    this.releaseT = 1;
    this.pitch = 0;
    this.roll = 0;
    this.pitchV = 0;
    this.rollV = 0;
    this.flip = 0;
    this.flipSpeed = 0;
    this.events = [];
    this.hold = false;
    this.wantAttach = false;
    this.releaseNow = false;
  }

  /** Player input: hold = hang on (or fire a line now), let go = release. */
  setHold(on, target = null) {
    this.hold = on;
    // A held press with a locked target always zips a fresh line to it, even
    // mid-swing; without one we fall back to the automatic anchor pick.
    if (on) {
      this.wantAttach = true;
      this.target = target ? target.clone() : null;
      this.pendingRelease = false;
    }
    if (!on && this.state === 'swing') this.releaseNow = true;
  }

  detach() {
    if (this.state === 'swing') {
      this.state = 'fly';
      this.flyT = 0;
      this.releaseT = 0;
      this.events.push('release');
    }
  }

  /**
   * @param ctx { s, x, yLogic, maxY, speed, mode, path, fwd, right, anchorFor(sAhead, side, out) }
   * yLogic / maxY are metres above the zone floor.
   */
  update(dt, ctx) {
    this.events.length = 0;
    this.attachT += dt;
    this.releaseT += dt;
    const floorPt = ctx.path.toWorld(ctx.s, ctx.x, 0, _p);
    const floorY = floorPt.y;
    const minY = ctx.yLogic - 0.05;
    const maxY = Math.max(minY + 0.1, ctx.maxY);
    const prevY = this.y;
    const grounded = ctx.mode === 'dive' || ctx.mode === 'stumble' || ctx.mode === 'fall';

    if (grounded) {
      this.detach();
      this.y += (minY - this.y) * (1 - Math.exp(-22 * dt));
      this.vy = 0;
    } else if (this.state === 'swing' && this.wantAttach) {
      this.wantAttach = false;
      this.attach(ctx, floorY);
    }
    if (grounded) {
      // handled above
    } else if (this.state === 'swing') {
      const A = this.anchor;
      const hd = Math.hypot(A.x - floorPt.x, A.z - floorPt.z);
      if (hd >= this.R - 0.2) {
        this.R = hd + 0.2; // rope pulled sideways past vertical reach: let it pay out
      }
      let yHand = A.y - Math.sqrt(this.R * this.R - hd * hd) - floorY;
      let y = yHand - HAND;
      // Reel in / pay out so the drawn body respects the gameplay band.
      if (y < minY) y = minY;
      if (y > maxY) y = maxY;
      const handY = floorY + y + HAND;
      this.R = Math.hypot(hd, A.y - handY);
      this.vy = (y - prevY) / Math.max(dt, 1e-4);
      this.y = y;
      // Release: auto once we've swept past the anchor and are climbing, or
      // when the player lets go. Holding keeps you on until the rope runs out.
      const ahead = (A.x - floorPt.x) * ctx.fwd.x + (A.z - floorPt.z) * ctx.fwd.z;
      const auto = !this.hold && ahead < -2 && (this.vy > 0 || ahead < -9) && this.attachT > 0.25;
      const forced = ahead < -Math.max(10, this.R * 0.8);
      if (this.releaseNow || auto || forced) {
        // A let-go on the upswing is a perfect release: more air, more speed.
        const perfect = this.releaseNow && ahead < -1 && this.vy > 1.5;
        this.releaseNow = false;
        this.state = 'fly';
        this.flyT = 0;
        this.releaseT = 0;
        this.vy = Math.min(Math.max(this.vy, 3), 11) * (perfect ? 1.35 : 1);
        if (this.vy > 7 && (perfect || Math.random() < 0.4)) this.flipSpeed = (Math.PI * 2) / 0.55;
        this.events.push(perfect ? 'perfect' : 'release');
      }
    } else {
      this.flyT += dt;
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y < minY) {
        this.y = minY;
        this.vy = Math.max(0, this.vy);
      }
      if (this.y > maxY + 0.6) {
        this.y = maxY + 0.6;
        this.vy = Math.min(0, this.vy);
      }
      // Fire the next line on the way down (or right away if the player holds).
      if (this.wantAttach || (this.flyT > 0.16 && (this.vy < -1.5 || this.flyT > 0.55))) {
        this.wantAttach = false;
        this.attach(ctx, floorY);
      }
    }

    // Flip spin during flight.
    if (this.flipSpeed > 0) {
      this.flip -= this.flipSpeed * dt;
      if (this.flip <= -Math.PI * 2 || this.state === 'swing') {
        this.flip = 0;
        this.flipSpeed = 0;
      }
    }

    // Body orientation: hang along the rope, with spring lag for weight.
    let pitchT;
    let rollT;
    if (this.state === 'swing') {
      _c.set(floorPt.x, floorY + this.y, floorPt.z);
      _u.copy(this.anchor).sub(_c).normalize();
      pitchT = Math.atan2(_u.dot(ctx.fwd), _u.dot(UP)) * 0.85;
      rollT = Math.atan2(_u.dot(ctx.right), _u.dot(UP)) * 0.7;
    } else {
      pitchT = grounded ? 0 : THREE.MathUtils.clamp(0.35 - this.vy * 0.05, -0.2, 0.9);
      rollT = 0;
    }
    const k = 70;
    const c = 11;
    this.pitchV += (k * (pitchT - this.pitch) - c * this.pitchV) * dt;
    this.rollV += (k * (rollT - this.roll) - c * this.rollV) * dt;
    this.pitch += this.pitchV * dt;
    this.roll += this.rollV * dt;
  }

  attach(ctx, floorY) {
    // Aim: pointer left/right picks the side, higher on screen = higher anchor
    // and a longer rope (bigger, slower arcs). No aim = alternate sides.
    if (this.target) {
      // Manual grapple: the line goes exactly where the player aimed.
      this.anchor.copy(this.target);
      this.target = null;
      this.anchorReal = true;
      this.side = Math.sign((this.anchor.x - _p.x) * ctx.right.x + (this.anchor.z - _p.z) * ctx.right.z) || 1;
      this.manual = true;
      const handY0 = floorY + this.y + HAND;
      const hd0 = Math.hypot(this.anchor.x - _p.x, this.anchor.z - _p.z);
      this.R = Math.hypot(hd0, this.anchor.y - handY0);
      this.state = 'swing';
      this.attachT = 0;
      this.events.push('attach');
      return;
    }
    this.manual = false;
    const aim = ctx.aim;
    const aimed = aim && aim.active && Math.abs(aim.x) > 0.22;
    this.side = aimed ? Math.sign(aim.x) : Math.random() < 0.72 ? -this.side : this.side;
    const height = aim && aim.active ? THREE.MathUtils.clamp(1.45 - aim.y * 1.1, 0.5, 1.4) : 1;
    const ahead = THREE.MathUtils.clamp(ctx.speed * 0.42 * (0.7 + height * 0.4), 8, 22);
    this.anchorReal = ctx.anchorFor(ctx.s + ahead * (0.8 + Math.random() * 0.4), this.side, this.anchor, height);
    if (!this.anchorReal) {
      // Line found nothing to bite: keep falling, try again a beat later.
      this.flyT = -0.35;
      this.events.push('miss');
      return;
    }
    const handY = floorY + this.y + HAND;
    const hd = Math.hypot(this.anchor.x - _p.x, this.anchor.z - _p.z);
    this.R = Math.hypot(hd, this.anchor.y - handY);
    this.state = 'swing';
    this.attachT = 0;
    this.events.push('attach');
  }

  get attached() {
    return this.state === 'swing';
  }
}

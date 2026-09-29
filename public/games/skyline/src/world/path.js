import * as THREE from 'three';
import { CFG } from '../config.js';

// Cardinal headings. Right vector of heading i is DIRS[(i + 1) % 4].
export const DIRS = [
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
];

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * One straight stretch of the route. Gameplay lives in path-local coordinates
 * (d = metres along the segment, x = lateral, y = height above the floor);
 * `toWorld` is the only place that knows about turns.
 */
export class Segment {
  constructor(opts) {
    Object.assign(this, opts);
    this.fwd = DIRS[this.dir].clone();
    this.right = DIRS[(this.dir + 1) % 4].clone();
    this.yaw = -this.dir * (Math.PI / 2);
    this.group = new THREE.Group();
    this.group.position.set(this.origin.x, 0, this.origin.z);
    this.group.rotation.y = this.yaw;
    this.obstacles = [];
    this.tokens = [];
    this.pickups = [];
    this.anchors = { left: [], right: [] };
  }

  get endS() {
    return this.startS + this.length;
  }

  /** Extra height of a raised rooftop step at d (0 when none). */
  stepAt(d) {
    if (!this.steps) return 0;
    for (const st of this.steps) if (d >= st.d0 && d <= st.d1) return st.h;
    return 0;
  }

  floorY(d) {
    if (this.prevBaseY === this.baseY) return this.baseY;
    const t = THREE.MathUtils.clamp((d - this.transStart) / this.transLen, 0, 1);
    return THREE.MathUtils.lerp(this.prevBaseY, this.baseY, smooth(t));
  }

  toWorld(d, x, y, out = new THREE.Vector3()) {
    out.copy(this.origin).addScaledVector(this.fwd, d).addScaledVector(this.right, x);
    out.y = this.floorY(d) + y;
    return out;
  }

  /** Local (segment group) coordinates for a path point. */
  local(d, x, y, out = new THREE.Vector3()) {
    return out.set(x, this.floorY(d) + y, -d);
  }
}

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/**
 * The route. Segments are built lazily ahead of the hero. Inside a zone the
 * road bends now and then (L-corners you must take). At the end of a zone the
 * road usually splits into a T-JUNCTION: both branches are built, the player
 * turns left or right, and the other branch is thrown away. Each branch leads
 * to a different next zone, so the run is a real route choice.
 */
export class Path {
  constructor(buildSegment, disposeSegment) {
    this.buildSegment = buildSegment;
    this.disposeSegment = disposeSegment;
    this.reset();
  }

  /**
   * @param startZone first zone of the route
   * @param city      zone graph to use (see CFG.cities)
   * @param startS    path distance of the new route's start (keeps `s` continuous on teleport)
   */
  reset(startZone = 'roof', city = 'nyc', startS = -40) {
    if (this.segments) for (const s of this.segments) this.disposeSegment(s);
    if (this.fork) for (const b of Object.values(this.fork.branches)) this.disposeSegment(b.seg);
    if (this.dropLater) this.disposeSegment(this.dropLater.seg);
    this.fork = null;
    this.dropLater = null;
    this.city = city;
    this.segments = [];
    this.count = 0;
    this.nextOrigin = new THREE.Vector3(0, 0, 0);
    this.nextDir = 0;
    this.nextStartS = startS;
    this.netTurn = 0;
    this.lastZone = null;
    this.lastBaseY = CFG.zoneBaseY[startZone] ?? 0;
    this.lastTurn = 0;
    this.zone = startZone;
    this.zoneLeft = CFG.segmentsPerZone;
  }

  succ(zone) {
    const graph = CFG.cities[this.city]?.succ || {};
    return graph[zone] || [zone];
  }

  state() {
    return {
      nextOrigin: this.nextOrigin.clone(), nextStartS: this.nextStartS, nextDir: this.nextDir, netTurn: this.netTurn,
      lastZone: this.lastZone, lastBaseY: this.lastBaseY, lastTurn: this.lastTurn, zone: this.zone, zoneLeft: this.zoneLeft, count: this.count,
    };
  }

  restore(st) {
    this.nextOrigin.copy(st.nextOrigin);
    Object.assign(this, { ...st, nextOrigin: this.nextOrigin });
  }

  /** Create (and build) one segment in `zone` from the current cursor. */
  makeSegment(zone, turn, extra = {}) {
    const i = this.count++;
    const length = i === 0 ? 230 : 170 + Math.floor(Math.random() * 60);
    const baseY = CFG.zoneBaseY[zone] ?? 0;
    const prevBaseY = this.lastZone ? this.lastBaseY : baseY;
    const W = CFG.corridorHalf;
    const seg = new Segment({
      index: i,
      startS: this.nextStartS,
      length,
      dir: this.nextDir,
      origin: this.nextOrigin.clone(),
      zone,
      city: this.city,
      prevZone: this.lastZone,
      nextZone: zone,
      baseY,
      prevBaseY,
      transStart: this.lastTurn ? W : 0,
      transLen: prevBaseY > baseY ? 46 : prevBaseY < baseY ? 52 : 1,
      turnStart: this.lastTurn,
      turnEnd: turn,
      ...extra,
    });
    return seg;
  }

  /** Advance the cursor past `seg` (which ends with `turn`). */
  advance(seg, turn) {
    this.nextOrigin.copy(seg.origin).addScaledVector(seg.fwd, seg.length);
    this.nextStartS += seg.length;
    this.nextDir = (this.nextDir + 4 + turn) % 4;
    this.netTurn += turn;
    this.lastZone = seg.zone;
    this.lastBaseY = seg.baseY;
    this.lastTurn = turn;
  }

  addSegment() {
    const zone = this.zone;
    const first = this.count === 0;
    const boundary = this.zoneLeft <= 1;
    const opts = boundary ? shuffle(this.succ(zone)) : [zone];
    // A fork needs two different places to go.
    const forkOpts = boundary && !first ? [...new Set(opts)].slice(0, 2) : [];
    if (forkOpts.length === 2 && !(forkOpts[0] === zone && forkOpts[1] === zone)) return this.addFork(forkOpts);

    const next = boundary ? opts[0] : zone;
    let turn = 0;
    const change = next !== zone;
    if (!first && (change || Math.random() < 0.45)) {
      if (this.netTurn >= 1) turn = -1;
      else if (this.netTurn <= -1) turn = 1;
      else turn = Math.random() < 0.5 ? -1 : 1;
    } else if (first && change) turn = 1;
    const seg = this.makeSegment(zone, turn, { nextZone: next });
    this.buildSegment(seg);
    this.segments.push(seg);
    this.advance(seg, turn);
    if (boundary) {
      this.zone = next;
      this.zoneLeft = CFG.segmentsPerZone;
    } else this.zoneLeft--;
    return seg;
  }

  /** End the zone in a T-junction: left leads to opts[0], right to opts[1]. */
  addFork(opts) {
    const zone = this.zone;
    const seg = this.makeSegment(zone, 2, { fork: true, nextZone: null, forkZones: { '-1': opts[0], 1: opts[1] } });
    this.buildSegment(seg);
    this.segments.push(seg);
    const base = this.state();
    const branches = {};
    for (const side of [-1, 1]) {
      this.restore(base);
      this.advance(seg, side);
      this.zone = opts[side < 0 ? 0 : 1];
      this.zoneLeft = CFG.segmentsPerZone;
      // The first stretch of each branch: may bend later, but never forks straight away.
      const turn = Math.random() < 0.35 ? (this.netTurn >= 1 ? -1 : this.netTurn <= -1 ? 1 : Math.random() < 0.5 ? -1 : 1) : 0;
      const b = this.makeSegment(this.zone, turn, { forkBranch: side, nextZone: this.zone });
      this.buildSegment(b);
      this.advance(b, turn);
      this.zoneLeft--;
      branches[side] = { seg: b, state: this.state() };
    }
    this.restore(base);
    this.fork = { seg, branches };
    return seg;
  }

  /** Commit to a branch of the pending fork (side -1 = left, 1 = right). */
  resolveFork(side) {
    const f = this.fork;
    if (!f) return null;
    const keep = f.branches[side];
    const drop = f.branches[-side];
    // Keep the other road on screen until the hero has turned away from it.
    if (this.dropLater) this.disposeSegment(this.dropLater.seg);
    this.dropLater = { seg: drop.seg, afterS: f.seg.endS + 45 };
    f.seg.turnEnd = side;
    f.seg.chosen = side;
    this.segments.push(keep.seg);
    this.restore(keep.state);
    this.fork = null;
    return keep.seg;
  }

  ensure(s) {
    if (this.dropLater && s > this.dropLater.afterS) {
      this.disposeSegment(this.dropLater.seg);
      this.dropLater = null;
    }
    while (!this.fork && (!this.segments.length || this.segments[this.segments.length - 1].endS < s + CFG.aheadMetres)) {
      this.addSegment();
    }
    while (this.segments.length > 2 && this.segments[0].endS < s - CFG.behindMetres) {
      this.disposeSegment(this.segments.shift());
    }
  }

  segAt(s) {
    const segs = this.segments;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (s >= segs[i].startS) return segs[i];
    }
    return segs[0];
  }

  /** World position of a path point, continuing straight past the first segment. */
  toWorld(s, x, y, out = new THREE.Vector3()) {
    const seg = this.segAt(s);
    return seg.toWorld(s - seg.startS, x, y, out);
  }

  /** Shift everything back toward the origin to keep float precision healthy. */
  rebase(offset) {
    this.nextOrigin.sub(offset);
    const all = [...this.segments];
    if (this.dropLater) all.push(this.dropLater.seg);
    if (this.fork) for (const b of Object.values(this.fork.branches)) {
      all.push(b.seg);
      b.state.nextOrigin.sub(offset);
    }
    for (const seg of all) {
      seg.origin.sub(offset);
      seg.group.position.x -= offset.x;
      seg.group.position.z -= offset.z;
    }
  }
}

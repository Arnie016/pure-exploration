import * as THREE from 'three';
import { CFG, DEFAULT_LOOK } from '../config.js';
import { buildInto, goon } from './hazards.js';
import { PRIM, mat4 } from '../world/geo.js';
import { LAYER_NO_OUTLINE } from '../render/pipeline.js';
import { Hero } from '../entities/hero.js';
import { SwingLine } from '../entities/pickups.js';
import * as PR from '../world/props.js';

const LW = CFG.laneWidth;
const W = CFG.corridorHalf;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3();

// The mystery behind the rift, told through torn newspaper pages and notes.
export const CLUES = [
  ['CITY HALL DENIES "INK LEAK"', 'Officials call the purple puddles under 5th Ave "a paint spill". Nobody believes them.'],
  ['DOCK WORKER: "IT HAD SIX EYES"', 'A night-shift crane operator swears something climbed out of the harbour.'],
  ['OBSIDIAN LABS SEEKS VOLUNTEERS', 'Classified ad: "Paid study. Must not fear the dark. Ask for Dr. Varga."'],
  ['BLACKOUT HITS MIDTOWN', 'Every screen showed the same frame for 9 seconds: a door in the sky.'],
  ['NOTE, HANDWRITTEN', '"The mirror city isn\'t a copy. It\'s the ORIGINAL. We\'re the reflection." —V.'],
  ['SUBWAY LINE 0 REOPENS?', 'A line that was never built appears on new maps. Trains are seen at 3:33 am.'],
  ['PIGEONS FLY BACKWARDS', 'Birdwatchers in the park report flocks flying tail-first near the rift.'],
  ['LAB MEMO #12', '"Specimen H-1 responds to light. Bright cores make it retreat. Keep the lamps on."'],
  ['MASKED SWINGER SAVES BUS', 'Witnesses describe a hero with glowing trim. "She waved. Or he did. Very fast."'],
  ['RIVAL SPOTTED: "SILK"', 'A second web-slinger in white. Friend or rival? She left chocolates at the scene.'],
  ['TACO TRUCK OWNER SPEAKS', '"Heroes eat free. Monsters don\'t. That\'s the rule at Taco Express."'],
  ['FILM FEST CHAOS', 'The dance crew\'s music video was "improved" by a surprise guest. It went viral.'],
  ['VARGA\'S JOURNAL, P.3', '"The hound isn\'t hunting the hero. It\'s hunting the SUIT. The suit remembers."'],
  ['SKYFIZZ RECALL', 'The glowing soda from the park trees was never manufactured. So who is making it?'],
  ['THE ALPHA WAKES', 'Seismographs in the underground spike every time the Alpha Hound roars.'],
  ['MISSING: DR. MIRA VARGA', 'Last seen entering Obsidian Labs on the night the sky first cracked.'],
  ['TRAIN SWITCHMAN\'S LOG', '"Lever 7 keeps switching itself. Toward the people. I think something wants it to."'],
  ['OFFICE RUMOUR', 'Floor 20 workers say a hero crashed through the window, grabbed a coffee, and left.'],
  ['THE BRUTE', 'A giant made of broken concrete was seen tearing a tower apart downtown.'],
  ['VARGA\'S JOURNAL, P.9', '"Close the rift from BOTH sides. The hero must enter the mirror city and come back."'],
  ['THE SUIT\'S ORIGIN', 'The first suit was stitched from rift-silk. That is why the web glows.'],
  ['LAST PAGE', '"If you\'re reading this, keep swinging. As long as you move, the ink can\'t hold you." —M.V.'],
];

/** Canvas sprite: a torn newspaper page. */
function paperSprite() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4ecd8';
  c.beginPath();
  c.moveTo(4, 6);
  for (let x = 4; x <= 124; x += 12) c.lineTo(x, 4 + Math.random() * 6);
  c.lineTo(124, 156);
  for (let x = 124; x >= 4; x -= 12) c.lineTo(x, 150 + Math.random() * 8);
  c.fill();
  c.fillStyle = '#1b1030';
  c.font = 'bold 22px Bangers, Impact';
  c.fillText('DAILY', 14, 32);
  c.fillText('BEACON', 14, 54);
  c.fillStyle = '#c8583f';
  c.fillRect(14, 62, 100, 4);
  c.fillStyle = '#6b6478';
  for (let y = 76; y < 144; y += 9) c.fillRect(14, y, 40 + Math.random() * 60, 4);
  c.fillStyle = '#1b1030';
  c.fillRect(70, 80, 44, 36);
  c.font = 'bold 30px Bangers, Impact';
  c.fillStyle = '#ff3fa4';
  c.fillText('?', 84, 110);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
  sp.scale.set(1.1, 1.4, 1);
  sp.layers.set(LAYER_NO_OUTLINE);
  return sp;
}

/** Emoji-style icon sprite (taco, pizza, soda, chocolates). */
function iconSprite(emoji, ring = '#ffd84a') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = ring;
  c.strokeStyle = '#1b1030';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(64, 64, 56, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.font = '72px serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  sp.renderOrder = 12;
  sp.scale.setScalar(1.5);
  sp.layers.set(LAYER_NO_OUTLINE);
  return sp;
}

function textSign(text, w = 8, bg = '#1b1030', fg = '#ffd84a') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 128);
  c.strokeStyle = fg;
  c.lineWidth = 10;
  c.strokeRect(8, 8, 496, 112);
  c.font = 'bold 76px Bangers, Impact';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = fg;
  c.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  m.layers.set(LAYER_NO_OUTLINE);
  return m;
}

/**
 * Small in-world set pieces between the big Director missions: things to
 * web, people to save, snacks to grab. Each uses a cinematic camera beat.
 */
export class Encounters {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.timer = 10;
    this.last = null;
  }

  reset() {
    for (const e of this.list) e.cleanup?.();
    this.list = [];
    this.timer = 9;
  }

  update(dt) {
    const g = this.g;
    if (g.state !== 'playing') return;
    this.timer -= dt;
    if (this.timer <= 0 && (!g.director.mission || g.director.mission.type === 'rescue' || g.director.mission.type === 'heist') && this.list.length < 2) {
      const ok = this.spawn();
      this.timer = ok ? rand(11, 18) : 1.5;
    }
    this.list = this.list.filter((e) => {
      const alive = e.update(dt);
      if (!alive) e.cleanup?.();
      return alive;
    });
  }

  spawn() {
    const zone = this.g.curSeg.zone;
    const table = {
      street: ['clues', 'fest', 'food', 'rival', 'fest', 'food'],
      park: ['clues', 'soda', 'fest', 'food', 'soda'],
      roof: ['clues', 'rival', 'rival'],
      subway: ['lever', 'lever', 'clues'],
      rift: ['clues', 'rival'],
      office: ['clues'],
      prison: ['clues', 'clues'],
    }[zone] || ['clues'];
    let kind = pick(table);
    if (kind === this.last && table.length > 1) kind = pick(table);
    this.g.cineKey = `enc-${kind}`;
    const ok = this[kind]?.();
    this.g.cineKey = null;
    if (ok) this.last = kind;
    return ok;
  }

  /** A clear spot `dist` metres ahead on a straight. */
  spot(dist, margin = 20) {
    const g = this.g;
    for (const off of [0, 15, 30, 45, -10]) {
      const s = g.s + dist + off;
      g.path.ensure(s + 60);
      const seg = g.path.segAt(s);
      const d = s - seg.startS;
      const lo = Math.max(seg.floorStart, seg.transStart + (seg.transLen > 1 ? seg.transLen : 0)) + 6;
      const hi = seg.length - (seg.turnEnd ? CFG.turnWindow + margin : 12);
      if (d >= lo && d <= hi && seg.zone === g.curSeg.zone) return { seg, d, s };
    }
    return null;
  }

  // ── Case-file pages fluttering between the towers ──
  clues() {
    const g = this.g;
    const save = g.save;
    save.clues ??= [];
    const left = CLUES.map((_, i) => i).filter((i) => !save.clues.includes(i));
    const sp0 = this.spot(90, 10);
    if (!sp0) return false;
    const n = Math.min(left.length ? 3 : 2, 3);
    const items = [];
    for (let i = 0; i < n; i++) {
      const d = sp0.d + i * 14;
      if (d > sp0.seg.length - 12) break;
      const sprite = paperSprite();
      const lane = pick([-1, 0, 1]);
      const high = Math.random() < 0.6;
      sprite.position.set(lane * LW, sp0.seg.floorY(d) + (high ? rand(5, 8) : 2), -d);
      sp0.seg.group.add(sprite);
      const it = { sprite, seg: sp0.seg, d, lane, base: sprite.position.y, alive: true, ph: Math.random() * 6 };
      it.target = { alive: true, r: 0.06, pos: () => sprite.getWorldPosition(new THREE.Vector3()), onHit: () => this.collectClue(it) };
      g.webs.targets.push(it.target);
      items.push(it);
    }
    if (!items.length) return false;
    g.ui.pop('CLUES AHEAD — WEB THEM!', '#f4ecd8', 50, 26, 30);
    this.list.push({
      update: (dt) => {
        let any = false;
        for (const it of items) {
          if (!it.alive) continue;
          any = true;
          it.ph += dt;
          it.sprite.position.y = it.base + Math.sin(it.ph * 2) * 0.3;
          it.sprite.material.rotation = Math.sin(it.ph * 1.5) * 0.3;
          const ds = it.seg.startS + it.d - g.s;
          // Touch-collect when low and in your lane.
          if (Math.abs(ds) < 1.2 && Math.abs(it.lane * LW - g.x) < 1.2 && Math.abs(it.base - it.seg.floorY(it.d) - g.yLogic) < 2) {
            it.target.alive = false;
            this.collectClue(it);
          }
          if (ds < -10) {
            it.alive = false;
            it.target.alive = false;
          }
        }
        return any;
      },
      cleanup: () => items.forEach((it) => {
        it.target.alive = false;
        it.seg.group.remove(it.sprite);
      }),
    });
    return true;
  }

  collectClue(it) {
    const g = this.g;
    if (!it.alive) return;
    it.alive = false;
    it.seg.group.remove(it.sprite);
    const save = g.save;
    const left = CLUES.map((_, i) => i).filter((i) => !save.clues.includes(i));
    g.audio.play('power');
    g.skills.add('clue');
    g.particles.burst(it.sprite.getWorldPosition(new THREE.Vector3()), 0xf4ecd8, 16, 5, 0.5, 3, 1.5);
    if (!left.length) {
      g.coins += 25;
      g.ui.pop('+25 (FILE COMPLETE)', '#f4ecd8', 50, 40, 30);
      return;
    }
    const idx = left[0];
    save.clues.push(idx);
    const [title, text] = CLUES[idx];
    g.ui.clue(save.clues.length, CLUES.length, title, text);
  }

  // ── Runaway train toward people on the track: web the switch lever ──
  lever() {
    const g = this.g;
    const sp = this.spot(45, 20);
    if (!sp) return false;
    const { seg } = sp;
    const dPeople = sp.d + 42;
    if (dPeople > seg.length - CFG.turnWindow - 20) return false;
    const lane = pick([-1, 0, 1].filter((l) => l !== g.lane));
    const safeOpts = [-1, 0, 1].filter((l) => l !== lane && l !== g.lane);
    const safe = safeOpts.length ? pick(safeOpts) : lane === 1 ? 0 : lane + 1;
    // Stranded passengers + HELP.
    const people = [];
    for (let i = 0; i < 3; i++) {
      const p = goon(g.mats, pick([0xffd84a, 0x3fc7ff, 0xff9a2e, 0xf4f4f4]));
      p.position.set(lane * LW + (i - 1) * 0.6, seg.floorY(dPeople), -dPeople - i * 0.4);
      p.rotation.y = Math.PI;
      seg.group.add(p);
      people.push(p);
    }
    // Lever box on the tunnel wall, glowing.
    const side = lane <= 0 ? -1 : 1;
    const lever = buildInto(new THREE.Group(), g.mats, (B) => {
      B.box('metal', 0, 1.3, 0, 0.6, 1.4, 0.5, 0x3b3552);
      B.box('glowV', 0, 1.9, 0.3, 0.5, 0.12, 0.05, 0xff2f4a, 0, 0, 0, 3);
    });
    const handle = buildInto(new THREE.Group(), g.mats, (B) => {
      B.add('metal', PRIM.cyl, mat4(0, 0.5, 0, 0.1, 1.0, 0.1), 0xd0d6ea);
      B.add('glowV', PRIM.sphere, mat4(0, 1.05, 0, 0.28, 0.28, 0.28), 0xffd84a, 3);
    });
    handle.position.set(0, 1.4, 0.3);
    handle.rotation.x = -0.6;
    lever.add(handle);
    const dLever = sp.d + 10;
    lever.position.set(side * (W - 0.5), seg.floorY(dLever), -dLever);
    lever.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    seg.group.add(lever);
    const sign = textSign('LEVER 7', 3);
    sign.position.set(side * (W - 0.1), seg.floorY(dLever) + 3.2, -dLever);
    sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    seg.group.add(sign);
    // The runaway train, coming at the people from the far end.
    const train = buildInto(new THREE.Group(), g.mats, (B) => PR.trainCar(B, 0, 0, 0, 16, 0xff2f4a));
    let dTrain = Math.min(dPeople + 85, seg.length + 40);
    train.position.set(lane * LW, seg.floorY(dTrain), -dTrain);
    seg.group.add(train);
    const ob = g.hazards.addObstacle(seg, { kind: 'block', lane, d: dTrain, x: lane * LW, group: train, hw: 1.2, hd: 8, yMax: 3.9, moving: 0, noFling: true, standable: true });
    let switched = false;
    let tx = lane * LW;
    let done = false;
    const target = { alive: true, r: 0.1, pos: () => handle.getWorldPosition(new THREE.Vector3()), onHit: () => {
      switched = true;
      handle.rotation.x = 0.6;
      ob.lane = safe;
      tx = safe * LW;
      g.audio.play('turn');
      g.ui.pop('TRACKS SWITCHED!', '#a8f03a', 50, 34, 48);
      g.cine(() => train.getWorldPosition(new THREE.Vector3()), 1.2, null, 0.4);
    } };
    g.webs.targets.push(target);
    g.audio.play('train');
    g.ui.objective('RUNAWAY TRAIN!', 'Web the glowing LEVER to switch tracks!', 0);
    g.cine(() => train.getWorldPosition(new THREE.Vector3()).setY(train.getWorldPosition(_v).y + 2), 1.8, 'SWITCH THE TRACKS!', 0.3);
    setTimeout(() => g.state === 'playing' && g.ui.bubble('HELP!!', 55, 38, true, 1400), 400);
    let t = 0;
    return this.push({
      update: (dt) => {
        t += dt;
        if (!ob.alive) return false;
        const speed = 26;
        dTrain -= speed * dt;
        ob.d = dTrain;
        ob.x += (tx - ob.x) * Math.min(1, dt * 5);
        train.position.set(ob.x, seg.floorY(dTrain), -dTrain);
        train.rotation.y = (tx - ob.x) * 0.05;
        for (const p of people) {
          p.userData.arm && (p.userData.arm.rotation.x = Math.sin(t * 12) * 1.2 - 1.6);
          p.position.y = seg.floorY(dPeople) + Math.abs(Math.sin(t * 8)) * 0.3;
        }
        if (!done && dTrain - 8 < dPeople + 1) {
          done = true;
          target.alive = false;
          g.ui.objective(null);
          if (switched) {
            g.skills.add('switch');
            g.skills.add('rescue');
            g.coins += 30;
            g.ui.pop('PASSENGERS SAFE! +30', '#a8f03a', 50, 40, 44);
            g.audio.play('power');
          } else {
            // The driver slams the brakes; people dive clear. No reward.
            ob.moving = 0;
            g.ui.pop('THEY JUMPED CLEAR… BARELY', '#ff9a2e', 50, 40, 32);
            g.audio.play('slam');
            g.particles.burst(train.getWorldPosition(new THREE.Vector3()), 0xffc040, 30, 8, 0.5, 3, 1);
          }
          // Unswitched: they dive to the wall. Switched: they stay and cheer.
          if (!switched) for (const [i, p] of people.entries()) p.position.x = side * (W - 0.8) + i * 0.1;
        }
        if (done && !switched) return false; // train stays as a stopped obstacle
        return dTrain > g.s - seg.startS - 20;
      },
      cleanup: () => {
        target.alive = false;
        g.ui.objective(null);
      },
    });
  }

  // ── A dance crew shooting a music video for the film fest: crash it ──
  fest() {
    const g = this.g;
    const sp = this.spot(85, 20);
    if (!sp) return false;
    const { seg, d } = sp;
    const side = pick([-1, 1]);
    const stage = new THREE.Group();
    buildInto(stage, g.mats, (B) => {
      B.box('solid', 0, 0.4, 0, 8, 0.8, 5, 0x2b2640);
      for (const x of [-4, 4]) B.box('metal', x, 3.2, 0, 0.25, 5.6, 0.25, 0x9aa7c7);
      B.box('metal', 0, 6, 0, 8.3, 0.25, 0.25, 0x9aa7c7);
      for (let x = -3; x <= 3; x += 1.5) B.box('glowV', x, 5.75, 0.2, 0.5, 0.35, 0.3, pick([0xff3fa4, 0x3fe0ff, 0xffd84a, 0xa8f03a]), 0, 0, 0, 4);
      // Film camera on a tripod.
      B.box('solid', -5.5, 1.8, 3, 0.8, 0.6, 1.2, 0x1b1030);
      B.cyl('solid', -5.5, 1.8, 3.8, 0.28, 0.4, 0x3d4f86, Math.PI / 2, 0, 0);
      B.box('metal', -5.5, 0.75, 3, 0.1, 1.5, 0.1, 0x3b3552);
    });
    const banner = textSign('CITY FILM FEST', 7, '#ff3fa4', '#fff1d6');
    banner.position.set(0, 6.9, 0.2);
    stage.add(banner);
    stage.position.set(side * (W + 6), seg.floorY(d), -d);
    stage.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    seg.group.add(stage);
    const dancers = [];
    for (let i = 0; i < 7; i++) {
      const p = goon(g.mats, pick([0xff3fa4, 0x3fe0ff, 0xffd84a, 0xa8f03a, 0x7b4dff, 0xff9a2e]));
      const lane = (i % 3) - 1;
      p.position.set(lane * LW + rand(-0.5, 0.5), seg.floorY(d), -(d + (i < 3 ? -2 : 3) + rand(-1, 1)));
      p.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      seg.group.add(p);
      dancers.push({ p, ph: i * 0.7, lane, flee: 0, dir: lane === 0 ? pick([-1, 1]) : Math.sign(lane) });
    }
    g.cine(() => seg.toWorld(d, 0, 2, new THREE.Vector3()), 1.4, 'FILM FEST — CRASH IT!', 0.5);
    g.audio.play('drone');
    let t = 0;
    let crashed = false;
    return this.push({
      update: (dt) => {
        t += dt;
        const ds = seg.startS + d - g.s;
        if (!crashed && ds < 22) {
          crashed = true;
          for (const dn of dancers) dn.flee = 1;
          g.skills.add('photobomb');
          g.ui.pop('PHOTOBOMB!', '#ff3fa4', 50, 36, 56);
          g.ui.bubble('CUT! CUT!', 30, 40, true, 1400);
          g.particles.burst(seg.toWorld(d, 0, 2), 0xff3fa4, 40, 10, 1.2, 2, 3);
          g.particles.burst(seg.toWorld(d, 0, 2), 0xffd84a, 40, 10, 1.2, 2, 3);
          g.audio.play('scream');
        }
        for (const dn of dancers) {
          if (dn.flee) {
            dn.p.position.x += dn.dir * dt * 9;
            dn.p.rotation.z = -dn.dir * 0.3;
            if (Math.abs(dn.p.position.x) > W + 3) dn.p.visible = false;
          } else {
            // Choreo: bounce, spin, arm pumps.
            dn.p.position.y = seg.floorY(d) + Math.abs(Math.sin(t * 6 + dn.ph)) * 0.35;
            dn.p.rotation.y += Math.sin(t * 2 + dn.ph) * dt * 3;
            if (dn.p.userData.arm) dn.p.userData.arm.rotation.x = Math.sin(t * 9 + dn.ph) * 1.4 - 1.2;
          }
        }
        return ds > -30;
      },
    });
  }

  // ── Snack stop: Taco Express truck or a pizza cart. Web the snack ──
  food() {
    const g = this.g;
    const sp = this.spot(75, 16);
    if (!sp) return false;
    const { seg, d } = sp;
    const side = pick([-1, 1]);
    const taco = Math.random() < 0.55;
    const truck = buildInto(new THREE.Group(), g.mats, (B) => {
      B.box('solid', 0, 1.8, 0, 2.5, 2.8, 6, taco ? 0xffc02e : 0xd6203a);
      B.box('solid', 0, 3.3, 0, 2.55, 0.25, 6.05, 0xfff1d6);
      B.box('glowV', side > 0 ? -1.27 : 1.27, 2.1, 0.5, 0.05, 1.1, 3, 0xfff6d0, 0, 0, 0, 2);
      for (const [x, z] of [[-1.1, 2], [1.1, 2], [-1.1, -2], [1.1, -2]]) B.cyl('solid', x, 0.42, z, 0.42, 0.3, 0x1b1030, 0, 0, Math.PI / 2);
    });
    const sign = textSign(taco ? 'TACO EXPRESS' : "TONY'S PIZZA", 5.5, taco ? '#1b1030' : '#fff1d6', taco ? '#ffc02e' : '#d6203a');
    sign.position.set(0, 4.3, 0);
    sign.rotation.y = Math.PI / 2;
    truck.add(sign);
    truck.position.set(side * (W + 3), seg.floorY(d) + (seg.zone === 'street' ? 0.24 : 0), -d);
    seg.group.add(truck);
    const icon = iconSprite(taco ? '🌮' : '🍕', taco ? '#ffc02e' : '#ff9a8a');
    icon.position.set(side * (W - 0.5), seg.floorY(d) + 3.2, -d);
    seg.group.add(icon);
    let got = false;
    const target = { alive: true, r: 0.12, pos: () => icon.getWorldPosition(new THREE.Vector3()), onHit: () => eat() };
    g.webs.targets.push(target);
    const eat = () => {
      if (got) return;
      got = true;
      target.alive = false;
      icon.visible = false;
      g.skills.add('snack');
      g.audio.play('power');
      if (g.lives < g.maxLives) {
        g.lives++;
        g.ui.pop(taco ? 'TACO TIME! +1 ❤' : 'PIZZA POWER! +1 ❤', '#ffc02e', 50, 38, 50);
      } else {
        g.coins += 20;
        g.magnetT = Math.max(g.magnetT, 5);
        g.ui.pop(taco ? 'TACO TIME! +20 & MAGNET' : 'PIZZA POWER! +20 & MAGNET', '#ffc02e', 50, 38, 44);
      }
      g.slowT = Math.max(g.slowT, 0.3); // a quick bite
      g.particles.burst(g.hero.root.position, 0xffc02e, 20, 5, 0.5, 2, 2);
    };
    g.ui.bubble(taco ? 'HEROES EAT FREE!' : 'HOT SLICE, HERO?', side > 0 ? 70 : 30, 44, false, 2000);
    let t = 0;
    return this.push({
      update: (dt) => {
        t += dt;
        icon.position.y = seg.floorY(d) + 3.2 + Math.sin(t * 3) * 0.25;
        const ds = seg.startS + d - g.s;
        if (!got && Math.abs(ds) < 2 && Math.abs(g.x - side * LW) < 1.5 && g.yLogic > 2.2) eat();
        return ds > -12;
      },
      cleanup: () => (target.alive = false),
    });
  }

  // ── A park tree drops a can of glowing SKYFIZZ ──
  soda() {
    const g = this.g;
    const sp = this.spot(70, 14);
    if (!sp) return false;
    const { seg, d } = sp;
    const lane = pick([-1, 0, 1]);
    const tree = buildInto(new THREE.Group(), g.mats, (B) => {
      B.cyl('solid', 0, 3, 0, 0.45, 6, 0x6b4432);
      B.box('solid', 0, 7, 0, 6, 3.4, 6, 0xb56bff);
      B.box('solid', 0, 9, 0, 4, 2.4, 4, 0x7b4dff);
      B.box('glowV', 0, 8, 0, 6.2, 0.2, 6.2, 0x3fe0ff, 0, 0, 0, 2);
    });
    const side = lane <= 0 ? 1 : -1;
    tree.position.set(side * (W + 1.5), seg.floorY(d), -d);
    seg.group.add(tree);
    const can = iconSprite('🥤', '#3fe0ff');
    can.position.set(side * (W - 0.5), seg.floorY(d) + 6, -d);
    seg.group.add(can);
    let fallen = false;
    let got = false;
    let vy = 0;
    const target = { alive: true, r: 0.12, pos: () => can.getWorldPosition(new THREE.Vector3()), onHit: () => drink() };
    g.webs.targets.push(target);
    const drink = () => {
      if (got) return;
      got = true;
      target.alive = false;
      can.visible = false;
      g.skills.add('snack');
      const fx = pick(['spring', 'focus', 'turbo', 'double']);
      g.collectPower({ type: fx, alive: true });
      g.ui.pop('SKYFIZZ!', '#3fe0ff', 50, 34, 56);
      g.particles.burst(g.hero.root.position, 0x3fe0ff, 30, 7, 0.7, 2, 3);
    };
    g.cine(() => can.getWorldPosition(new THREE.Vector3()), 1.1, 'SOMETHING GLOWS IN THE TREE…', 0.5);
    let t = 0;
    return this.push({
      update: (dt) => {
        t += dt;
        const ds = seg.startS + d - g.s;
        if (!fallen && ds < 45) fallen = true;
        if (fallen && !got) {
          // Drops out and rolls into a lane.
          vy -= 20 * dt;
          can.position.y = Math.max(seg.floorY(d) + 0.9, can.position.y + vy * dt);
          can.position.x += (lane * LW - can.position.x) * Math.min(1, dt * 2.5);
          if (can.position.y <= seg.floorY(d) + 0.9) vy = Math.abs(vy) > 3 ? -vy * 0.4 : 0;
          if (Math.abs(ds) < 1.3 && Math.abs(g.x - can.position.x) < 1.3 && g.yLogic < 3.5) drink();
        } else if (!fallen) can.material.rotation = Math.sin(t * 5) * 0.3;
        return ds > -12;
      },
      cleanup: () => (target.alive = false),
    });
  }

  // ── SILK, a rival web-slinger, swings by with a box of chocolates ──
  rival() {
    const g = this.g;
    if (!this.silk) {
      this.silk = new Hero();
      this.silk.setLook({
        ...DEFAULT_LOOK, body: 'B', skin: '#e0ac86', suit: '#f4f4f4', pants: '#f4f4f4', shoes: '#ff3fa4', trim: '#1b1030',
        accent: '#ff3fa4', hood: 'down', hair: 'ponytail', hairColor: '#1b1030', mask: 'full', eyes: 'visor', pattern: 'stripes', emblem: 'spiral', scarf: true, scarfColor: '#ff3fa4', backpack: false,
      });
      this.silkLine = new SwingLine(g.scene);
      this.silkLine.setColor(new THREE.Color('#ff3fa4'));
      g.scene.add(this.silk.root);
    }
    const H = this.silk;
    H.root.visible = true;
    const side = pick([-1, 1]);
    let t = 0;
    let thrown = false;
    let box = null;
    let boxT = 0;
    const anchor = new THREE.Vector3();
    g.ui.bubble('Hey, rookie! Truce?', side > 0 ? 72 : 28, 30, false, 2000);
    g.cine(() => H.root.position, 1.3, 'RIVAL: SILK', 0.55);
    this.silkLine.zap();
    return this.push({
      update: (dt) => {
        t += dt;
        const ahead = t < 1 ? 30 - t * 20 : t < 5 ? 8 + Math.sin(t) * 2 : 8 + (t - 5) * 30;
        const lateral = side * (t < 1 ? 14 - t * 8 : 6 + (t > 5 ? (t - 5) * 10 : 0));
        const h = 4 + Math.sin(t * 2.2) * 1.8 + (t > 5 ? (t - 5) * 8 : 0);
        g.path.toWorld(g.s + ahead, lateral, h, H.root.position);
        H.root.rotation.set(Math.sin(t * 2.2) * 0.4, g.curSeg.yaw + Math.PI, -side * 0.3, 'YXZ');
        g.path.toWorld(g.s + ahead + 12, lateral + side * 5, h + 12, anchor);
        H.animate(dt, { mode: 'swing', phase: 0.5, anchorWorld: anchor, swingVel: 1 });
        H.lineSide = -side;
        this.silkLine.update(dt, H.handWorld, anchor, true, 0);
        if (!thrown && t > 2.2) {
          thrown = true;
          g.ui.bubble('For you. Keep up! ♥', side > 0 ? 70 : 30, 32, false, 1800);
          box = iconSprite('🍫', '#ff9ac8');
          g.scene.add(box);
          box.position.copy(H.root.position);
        }
        if (box && box.visible) {
          boxT += dt;
          const k = Math.min(1, boxT / 0.8);
          box.position.lerpVectors(H.root.position, g.hero.root.position, k);
          box.position.y += Math.sin(k * Math.PI) * 3;
          box.material.rotation += dt * 6;
          if (k >= 1) {
            box.visible = false;
            g.coins += 50;
            g.skills.add('gift');
            g.ui.pop('CHOCOLATES! +50', '#ff9ac8', 50, 40, 46);
            g.audio.play('power');
            g.particles.burst(g.hero.root.position, 0xff9ac8, 24, 6, 0.6, 2, 2);
          }
        }
        return t < 7;
      },
      cleanup: () => {
        H.root.visible = false;
        this.silkLine.hide();
        if (box) g.scene.remove(box);
      },
    });
  }

  push(e) {
    this.list.push(e);
    return true;
  }
}

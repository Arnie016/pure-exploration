import * as THREE from 'three';
import { buildInto } from './hazards.js';
import { PRIM, mat4 } from '../world/geo.js';

// The campaign runs on top of the endless route. Each act has a distance goal
// (0-100 %). At 100 % you reach a SAFEHOUSE checkpoint: a breather where the
// chase stops, the story moves on, and the next act starts. Checkpoints are
// saved, so the next run can continue from the latest act.
export const ACTS = [
  {
    title: 'ACT I — THE HOUND', len: 2600, chaser: 'hound', zone: 'roof',
    intro: 'A rift tore open over Midtown. Something with six eyes came through, and it has your scent.',
    safe: 'You lose the hound in a water tower on 44th. For the first time tonight, it\'s quiet. On the radio: "…the First Hexbank is being robbed by… clowns?"',
  },
  {
    title: 'ACT II — THE RINGMASTER', len: 3000, chaser: 'clown', zone: 'street', mission: 'heist',
    intro: 'RINGMASTER RICTUS robs the Hexbank with a circus crew, then sends his clown car after YOU.',
    safe: 'The clown car wraps itself around a hydrant. In Rictus\'s getaway bag: a keycard. "IRON ISLE LOCKUP — CELL BLOCK 0".',
  },
  {
    title: 'ACT III — IRON ISLE', len: 3200, chaser: 'hound', zone: 'subway',
    intro: 'Someone opened every cell under the river. The hound is back, and it brought friends.',
    safe: 'Cell 0 is empty except for a journal: Dr. Mira Varga\'s. The last page is a map of the sky.',
  },
  {
    title: 'ACT IV — MIRROR CITY', len: 3600, chaser: 'hound', zone: 'roof',
    intro: 'Varga\'s map points up. Through the rift, a second New York hangs upside down. The Alpha is waiting.',
    safe: 'The rift flickers. Somewhere in the mirror city, a door closes. For now. TO BE CONTINUED…',
  },
];

function clownCar(mats) {
  return buildInto(new THREE.Group(), mats, (B) => {
    B.add('solid', PRIM.sphere, mat4(0, 1.3, 0, 2.2, 1.7, 3.4), 0xff3fa4);
    B.add('solid', PRIM.sphere, mat4(0, 1.35, 0, 2.25, 0.35, 3.45), 0xffd84a);
    B.box('metal', 0, 1.9, 0.9, 1.6, 0.6, 0.05, 0x3d4f86, -0.4);
    for (const [x, z] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      B.cyl('solid', x, 0.5, z, 0.55, 0.35, 0x1b1030, 0, 0, Math.PI / 2);
      B.cyl('solid', x * 1.02, 0.5, z, 0.25, 0.37, 0xffd84a, 0, 0, Math.PI / 2);
    }
    // The driver: white face, red nose, green hair, tiny top hat.
    B.add('solid', PRIM.sphere, mat4(0, 2.55, 0.1, 0.8, 0.8, 0.8), 0xf4f4f4);
    B.add('glowV', PRIM.sphere, mat4(0, 2.5, 0.55, 0.26, 0.26, 0.26), 0xff2030, 3);
    B.add('solid', PRIM.sphere, mat4(-0.45, 2.75, 0, 0.5, 0.4, 0.5), 0x3fbf5a);
    B.add('solid', PRIM.sphere, mat4(0.45, 2.75, 0, 0.5, 0.4, 0.5), 0x3fbf5a);
    B.cyl('solid', 0, 3.15, 0.05, 0.28, 0.5, 0x1b1030);
    B.cyl('solid', 0, 2.92, 0.05, 0.45, 0.06, 0x1b1030);
    B.box('glowV', 0, 2.62, 0.43, 0.4, 0.06, 0.05, 0xff2030, 0, 0, 0, 2);
    // Horn + balloons.
    B.cyl('metal', 0.9, 2.1, 1.2, 0.12, 0.6, 0xffd84a, 0.8, 0, 0);
    for (const [x, c] of [[-0.7, 0xa8f03a], [-0.3, 0x3fc7ff], [0.2, 0xffd84a]]) {
      B.add('glowV', PRIM.sphere, mat4(x, 4.2 + Math.abs(x), -1.4, 0.5, 0.6, 0.5), c, 1.4);
      B.box('metal', x * 0.7, 3.1, -1.3, 0.02, 1.9, 0.02, 0xffffff);
    }
  });
}

export class Story {
  constructor(game) {
    this.g = game;
    this.clown = null;
  }

  get act() {
    return ACTS[Math.min(this.actIdx, ACTS.length - 1)];
  }

  /** Called at run start. Starts at the saved checkpoint act. */
  begin(actIdx) {
    const g = this.g;
    this.actIdx = actIdx % ACTS.length;
    this.actStart = g.s;
    this.safeT = 0;
    this.applyChaser();
    this.showBar();
    setTimeout(() => {
      if (g.state !== 'playing') return;
      g.ui.actToast(this.act.title, this.act.intro);
      if (this.act.mission) {
        g.director.forceNext = this.act.mission;
        g.director.t = Math.max(g.director.t, g.director.nextAt - 5);
      }
    }, 600);
  }

  applyChaser() {
    const g = this.g;
    const clown = this.act.chaser === 'clown';
    if (clown && !this.clown) {
      this.clown = clownCar(g.mats);
      this.clown.rotation.y = Math.PI;
      this.clown.scale.setScalar(0.72);
      g.monster.root.add(this.clown);
    }
    if (this.clown) this.clown.visible = clown;
    if (g.monster.model) g.monster.model.visible = !clown;
    g.chaserName = clown ? 'CLOWN CAR' : 'INK HOUND';
    const lab = document.querySelector('.chase-label');
    if (lab) lab.textContent = clown ? 'CLOWN CAR!' : 'INK HOUND!';
  }

  get progress() {
    return Math.min(1, (this.g.s - this.actStart) / this.act.len);
  }

  showBar() {
    const el = document.getElementById('act-bar');
    if (!el) return;
    el.classList.remove('hidden');
    document.getElementById('act-name').textContent = this.act.title;
  }

  update(dt) {
    const g = this.g;
    if (g.state !== 'playing') return;
    const p = this.progress;
    const fill = document.getElementById('act-fill');
    if (fill) fill.style.width = `${p * 100}%`;
    const pct = document.getElementById('act-pct');
    if (pct) pct.textContent = `${Math.floor(p * 100)}%`;
    // Clown car: bounce and honk.
    if (this.clown?.visible) {
      this.clown.position.y = Math.abs(Math.sin(g.elapsed * 9)) * 0.25;
      this.clown.rotation.z = Math.sin(g.elapsed * 7) * 0.08;
      if (Math.random() < dt * 0.4 && g.monsterGap < 13) g.audio.play('horn');
    }
    if (p >= 1 && !g.director.mission && !(g.cineT > 0) && !(g.wallT > 0)) this.checkpoint();
  }

  checkpoint() {
    const g = this.g;
    const next = (this.actIdx + 1) % ACTS.length;
    g.save.checkpointAct = next;
    g.save.actsDone = Math.max(g.save.actsDone || 0, this.actIdx + 1);
    g.save.journal ??= [];
    if (!g.save.journal.includes(this.actIdx)) g.save.journal.push(this.actIdx);
    g.skills.add('checkpoint');
    g.coins += 50;
    if (g.lives < g.maxLives) g.lives++;
    // Clear what's right ahead so the restart after the break is calm.
    for (const seg of g.path.segments) {
      for (const ob of seg.obstacles) {
        const ds = seg.startS + ob.d - g.s;
        if (ob.alive && !ob.step && !ob.ramp && ds > 0 && ds < 160 && ob.group) {
          ob.alive = false;
          ob.group.visible = false;
        }
      }
    }
    import('./save.js').then(({ writeSave }) => writeSave(g.save));
    g.enterSafehouse(this.act, this.actIdx);
  }

  nextAct() {
    const g = this.g;
    this.actIdx = (this.actIdx + 1) % ACTS.length;
    this.actStart = g.s;
    this.applyChaser();
    this.showBar();
    g.audio.music('music_run');
    g.ui.actToast(this.act.title, this.act.intro);
    g.monsterGap = 12;
    g.strikes = 1;
    g.chaseT = 3;
    g.monster.roar();
    if (this.act.mission) {
      g.director.forceNext = this.act.mission;
      g.director.t = Math.max(g.director.t, g.director.nextAt - 5);
    }
    g.cine(() => g.monster.root.position.clone().setY(g.monster.root.position.y + 2), 1.6, this.act.chaser === 'clown' ? 'HONK HONK!' : 'IT\'S BACK!', 0.3);
  }
}

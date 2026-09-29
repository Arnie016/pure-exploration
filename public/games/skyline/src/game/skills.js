// Forza-style skill chain: stunts feed a chain that keeps going while you keep
// landing them inside the window. When the window runs out the chain banks
// (points x chain multiplier). Getting hit wipes the unbanked chain.

export const SKILLS = {
  near: { label: 'NEAR MISS', pts: 100 },
  thread: { label: 'THREAD THE NEEDLE', pts: 250 },
  hopOver: { label: 'HOP OVER', pts: 150 },
  diveUnder: { label: 'DIVE UNDER', pts: 150 },
  bigAir: { label: 'BIG AIR', pts: 90 },
  flip: { label: 'FLIP', pts: 120 },
  air: { label: 'AIR TIME', pts: 50 },
  weave: { label: 'WEAVE', pts: 120 },
  coinRush: { label: 'COIN RUSH', pts: 160 },
  corner: { label: 'CORNER CARVE', pts: 200 },
  clutch: { label: 'CLUTCH TURN', pts: 320 },
  smash: { label: 'WRECKING BALL', pts: 70 },
  escape: { label: 'ESCAPED!', pts: 500 },
  dodge: { label: 'DEBRIS DODGE', pts: 220 },
  zone: { label: 'NEW TURF', pts: 300 },
  pickup: { label: 'POWER GRAB', pts: 80 },
  imp: { label: 'IMP STOMP', pts: 180 },
  rats: { label: 'RAT RODEO', pts: 160 },
  double: { label: 'DOUBLE JUMP', pts: 90 },
  triple: { label: 'TRIPLE JUMP', pts: 180 },
  roofRide: { label: 'ROOF RIDER', pts: 200 },
  batDodge: { label: 'BAT DODGE', pts: 170 },
  perfect: { label: 'PERFECT RELEASE', pts: 220 },
  mission: { label: 'MISSION BONUS', pts: 800 },
  rescue: { label: 'HERO RESCUE', pts: 350 },
  tag: { label: 'ROOF TAG', pts: 300 },
  mystery: { label: 'LUCKY BOX', pts: 120 },
  grapple: { label: 'GRAPPLE', pts: 60 },
  burst: { label: 'WEB BURST', pts: 200 },
  clue: { label: 'CLUE FOUND', pts: 250 },
  switch: { label: 'TRACK SWITCH', pts: 600 },
  photobomb: { label: 'PHOTOBOMB', pts: 300 },
  snack: { label: 'SNACK BREAK', pts: 150 },
  gift: { label: 'RIVAL GIFT', pts: 250 },
  crash: { label: 'WINDOW CRASH', pts: 200 },
  office: { label: 'OFFICE HOURS', pts: 120 },
  checkpoint: { label: 'CHECKPOINT', pts: 1000 },
  route: { label: 'ROUTE PICKED', pts: 150 },
  webSplat: { label: 'WEB SPLAT', pts: 15 },
  webYank: { label: 'WEB YANK', pts: 160 },
  webStop: { label: 'TRAFFIC STOP', pts: 260 },
};

export class SkillChain {
  constructor(ui) {
    this.ui = ui;
    this.window = 3.2;
    this.reset();
  }

  reset() {
    this.items = [];
    this.points = 0;
    this.count = 0;
    this.timer = 0;
    this.banked = 0;
    this.best = 0;
    this.counts = {};
    this.ui.chain(null);
  }

  get mult() {
    // x1 for the first two stunts, then +0.5 every 3 more (capped at x5).
    return Math.min(5, 1 + Math.floor(this.count / 3) * 0.5);
  }

  add(key, scale = 1) {
    const s = SKILLS[key];
    if (!s) return;
    this.counts[key] = (this.counts[key] || 0) + 1;
    const pts = Math.round(s.pts * scale);
    const last = this.items[this.items.length - 1];
    if (last && last.key === key && this.timer > this.window - 0.8) {
      last.times++;
      last.pts += pts;
    } else {
      this.items.push({ key, label: s.label, pts, times: 1 });
    }
    this.points += pts;
    this.count++;
    this.timer = this.window;
    this.ui.chain(this, key);
  }

  /** Returns banked points when the chain closes this frame, else 0. */
  update(dt) {
    if (this.timer <= 0) return 0;
    this.timer -= dt;
    this.ui.chainTimer(this.timer / this.window);
    if (this.timer > 0) return 0;
    const total = Math.round(this.points * this.mult);
    this.best = Math.max(this.best, total);
    this.banked += total;
    this.ui.chainBank(total, this.count);
    this.items = [];
    this.points = 0;
    this.count = 0;
    return total;
  }

  break() {
    if (this.points <= 0) return;
    this.ui.chainBreak(Math.round(this.points * this.mult));
    this.items = [];
    this.points = 0;
    this.count = 0;
    this.timer = 0;
  }
}

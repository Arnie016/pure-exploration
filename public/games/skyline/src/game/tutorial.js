/** Rooftop practice: observes real physics, never enters or settles a scored run. */
export class Tutorial {
  constructor(game) {
    this.g = game;
    this.root = document.createElement('section');
    this.root.className = 'training hidden';
    this.root.setAttribute('aria-label', 'Rooftop training');
    this.root.innerHTML = `<div class="training-card"><div class="training-progress" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small id="training-count"></small><h2 id="training-title"></h2><p id="training-instruction"></p><p id="training-status" role="status" aria-live="polite"></p><div class="training-nav"><button data-training="back">BACK</button><button data-training="restart">RESTART</button><button data-training="skip">SKIP PRACTICE</button></div><button class="btn primary hidden" id="training-play" data-training="play">START THE CHASE</button></div><div class="training-controls" aria-label="Practice controls"><button data-input="left" aria-label="Move left">◀</button><button data-input="right" aria-label="Move right">▶</button><button data-input="up">JUMP</button><button id="training-swing">HOLD TO SWING</button></div>`;
    document.body.append(this.root);
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
    this.root.addEventListener('click', e => {
      const action = e.target.closest('[data-training]')?.dataset.training;
      if (action === 'restart') game.showHowto();
      if (action === 'back' || action === 'skip') game.toTitle();
      if (action === 'play') { this.hide(); game.save.seenTutorial = true; game.persistTutorial(); game.startRun(); }
    });
    bindPracticeControls(this.root, game.input);
  }
  start() {
    this.step = 0; this.timer = 0; this.hang = 0; this.left = false; this.right = false;
    this.lastMove = null;
    this.travel = { left: 0, right: 0 };
    this.lastPosition = this.g.lobby.pos.clone();
    this.root.classList.remove('hidden'); this.render();
  }
  hide() { this.root.classList.add('hidden'); this.g.input.holding = false; this.g.input.drain(); }
  render() {
    const lessons = [
      ['Move both ways', 'Tap ◀ then ▶. Keyboard: A / D.'],
      ['Jump', 'Tap JUMP. Keyboard: Space.'],
      ['Catch a swing', 'Hold SWING until the line catches. Keyboard: Shift.'],
      ['Release and fly', 'Let go. Your momentum carries you forward.'],
      ['You’re ready', 'Chase coins. Dodge obstacles. Stay ahead of the Ink Hound.'],
    ];
    const lesson = lessons[this.step];
    this.root.querySelector('#training-count').textContent = this.step < 4 ? `PRACTICE ${this.step + 1} / 4` : 'PRACTICE COMPLETE';
    this.root.querySelector('#training-title').textContent = lesson[0];
    this.root.querySelector('#training-instruction').textContent = lesson[1];
    this.root.querySelector('#training-status').textContent = this.step === 0 ? `${this.left ? '✓' : '○'} Left   ${this.right ? '✓' : '○'} Right` : '';
    this.root.querySelector('#training-play').classList.toggle('hidden', this.step !== 4);
    this.root.querySelectorAll('.training-progress i').forEach((dot, index) => {
      dot.classList.toggle('complete', index < this.step);
      dot.classList.toggle('current', index === this.step);
    });
    this.root.querySelectorAll('.training-controls button').forEach(button => {
      const relevant = this.step === 0 ? ['left', 'right'].includes(button.dataset.input)
        : this.step === 1 ? button.dataset.input === 'up'
        : this.step === 2 || this.step === 3 ? button.id === 'training-swing' : false;
      button.classList.toggle('suggested', relevant);
    });
  }
  before(actions) {
    const lobby = this.g.lobby;
    this.releasingAttached = actions.includes('holdEnd') && Boolean(lobby.anchor);
    for (const action of actions) {
      if (action === 'pause') { this.g.toTitle(); return []; }
      if (action === 'left' || action === 'right') {
        const side = action === 'left' ? -1 : 1;
        lobby.vel.addScaledVector(lobby.seg.right, side * 7);
        this.lastMove = action;
      }
    }
    return actions.filter(a => ['up', 'holdStart', 'holdEnd', 'web'].includes(a));
  }
  after(dt, actions) {
    this.timer += dt;
    const lobby = this.g.lobby;
    if (this.step === 0) {
      // Count real travel in each direction, rather than requiring a return
      // across the spawn point. Opposing momentum does not count as a turn.
      const movement = lobby.pos.clone().sub(this.lastPosition).dot(lobby.seg.right);
      this.lastPosition.copy(lobby.pos);
      const wasLeft = this.left, wasRight = this.right;
      if (this.lastMove === 'left' && movement < 0) this.travel.left -= movement;
      if (this.lastMove === 'right' && movement > 0) this.travel.right += movement;
      this.left = this.travel.left >= 0.3;
      this.right = this.travel.right >= 0.3;
      if (this.left !== wasLeft || this.right !== wasRight) this.render();
      if (this.left && this.right) this.advance();
    } else if (this.step === 1 && actions.includes('up') && lobby.vel.y > 0 && !lobby.onGround) this.advance();
    else if (this.step === 2) {
      this.hang = lobby.anchor ? this.hang + dt : 0;
      if (this.hang >= 0.65) this.advance();
    } else if (this.step === 3 && this.releasingAttached && !lobby.anchor) this.advance();
  }
  advance() { this.step++; this.timer = 0; this.render(); this.g.audio.play('ui'); }
}

/** Pointer taps fire on press; keyboard activation keeps the ordinary click path. */
export function bindPracticeControls(root, input) {
  for (const button of root.querySelectorAll('[data-input]')) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      input.push(button.dataset.input);
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) input.push(button.dataset.input);
    });
    button.addEventListener('keydown', event => {
      if (!['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) input.push(button.dataset.input);
    });
    button.addEventListener('keyup', event => {
      if (!['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault(); event.stopPropagation();
    });
  }
  const swing = root.querySelector('#training-swing');
  let pointer = null;
  swing.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null || key !== null) return;
    event.preventDefault();
    pointer = event.pointerId;
    swing.setPointerCapture(pointer);
    input.aim.active = false;
    input.hold(true);
  });
  const release = event => {
    if (event && event.pointerId !== pointer) return;
    pointer = null;
    input.hold(false);
  };
  let key = null;
  swing.addEventListener('keydown', event => {
    if (!['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat || key !== null || pointer !== null) return;
    key = event.code;
    input.aim.active = false;
    input.hold(true);
  });
  swing.addEventListener('keyup', event => {
    if (!['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.code !== key) return;
    key = null; release();
  });
  swing.addEventListener('blur', () => { key = null; release(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) swing.addEventListener(type, release);
  window.addEventListener('blur', () => { key = null; release(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { key = null; release(); } });
}

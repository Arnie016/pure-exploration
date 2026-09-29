// Keyboard + touch/mouse swipe input, normalised into a queue of actions:
// 'left' | 'right' | 'up' | 'down' | 'ability' | 'pause' | 'confirm'.
export class Input {
  constructor(target) {
    this.queue = [];
    this.enabled = true;
    const keyMap = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', Space: 'up',
      ArrowDown: 'down', KeyS: 'down',
      KeyE: 'ability',
      KeyF: 'web', KeyQ: 'web', KeyR: 'net', KeyG: 'smoke', KeyV: 'burst',
      Escape: 'pause', KeyP: 'pause',
      Enter: 'confirm',
    };
    // Aim: where the pointer is decides the swing side and height.
    this.aim = { x: 0, y: 0.4, active: false };
    this.holding = false;
    window.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && this.setAim(e.clientX, e.clientY));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!e.repeat) this.hold(true);
        return;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.hold(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const a = keyMap[e.code];
      if (!a) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.push(a);
    });

    // Pointer scheme
    //   mouse:  move = aim · click = web shot · hold = grapple the aimed spot · release = fling
    //   touch:  left 40% = swipe lanes / tap hop / swipe down dive
    //           right 60% = tap web shot · hold = grapple (drag to re-aim) · lift = fling
    let sx = 0, sy = 0, st = 0, fired = false, id = null, holdTimer = 0, webSide = false;
    const HOLD_MS = 150;
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      fired = false;
      const touch = e.pointerType !== 'mouse';
      webSide = !touch || e.clientX > window.innerWidth * 0.4;
      if (e.button === 2) { // right mouse = hop
        fired = true;
        this.push('up');
        return;
      }
      if (webSide) this.setAim(e.clientX, e.clientY);
      clearTimeout(holdTimer);
      if (webSide) {
        holdTimer = setTimeout(() => {
          if (id !== null && !fired) {
            fired = true;
            this.hold(true);
          }
        }, HOLD_MS);
      }
    });
    target.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      if (webSide) this.setAim(e.clientX, e.clientY);
      if (fired || (webSide && e.pointerType === 'mouse')) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const th = Math.max(28, Math.min(window.innerWidth, window.innerHeight) * 0.05);
      if (Math.hypot(dx, dy) > th && performance.now() - st < HOLD_MS + 60) {
        fired = true;
        clearTimeout(holdTimer);
        if (Math.abs(dx) > Math.abs(dy)) this.push(dx > 0 ? 'right' : 'left');
        else this.push(dy > 0 ? 'down' : 'up');
      }
    });
    const end = (e, cancel) => {
      if (e.pointerId !== id) return;
      id = null;
      clearTimeout(holdTimer);
      if (this.holding) this.hold(false);
      else if (!cancel && !fired && performance.now() - st < 350) this.push(webSide ? 'web' : 'up');
    };
    target.addEventListener('pointerup', (e) => end(e, false));
    target.addEventListener('pointercancel', (e) => end(e, true));
  }

  setAim(cx, cy) {
    this.aim.x = (cx / window.innerWidth) * 2 - 1;
    this.aim.y = cy / window.innerHeight;
    this.aim.active = true;
  }

  hold(on) {
    if (!this.enabled || this.holding === on) return;
    this.holding = on;
    this.push(on ? 'holdStart' : 'holdEnd');
  }

  push(a) {
    if (!this.enabled) return;
    this.queue.push(a);
    if (this.queue.length > 4) this.queue.shift();
    this.onAction?.(a);
  }

  drain() {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}

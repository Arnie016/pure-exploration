// Procedural WebAudio: ambience, positional SFX, and layered dynamic music.
export class AudioSys {
  constructor() { this.ok = false; this.intensity = 0; this.targetIntensity = 0; this.beatT = 0; this.duck = 1; this.duckT = 0; }
  init() {
    if (this.ok) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(this.muffle).connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.musBus = ctx.createGain(); this.musBus.gain.value = 0.55; this.musBus.connect(this.master);
    // shared echo for gunshots / big impacts
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.38; const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1600;
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.5;
    this.echoIn.connect(this.echo); this.echo.connect(elp).connect(fb).connect(this.echo); elp.connect(this.sfxBus);
    // noise
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const bl = ctx.createBuffer(1, len, ctx.sampleRate); const b = bl.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; } this.brown = bl;
    // rain bed
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0;
    const rn = this.loopNoise(this.noise); const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 2400; rbp.Q.value = 0.4;
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 9000;
    rn.connect(rbp).connect(this.rainLP).connect(this.rainG).connect(this.ambBus);
    const rum = this.loopNoise(this.brown); const rg = ctx.createGain(); rg.gain.value = 0.35; rum.connect(rg).connect(this.rainLP);
    // building creaks / wind bed
    this.windG = ctx.createGain(); this.windG.gain.value = 0.05; const wn = this.loopNoise(this.brown); const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 400; wn.connect(wlp).connect(this.windG).connect(this.ambBus);
    // music layers
    this.layers = {};
    const mk = (name) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.musBus); this.layers[name] = g; return g; };
    const drone = mk('drone'); const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 220; dlp.connect(drone);
    for (const f of [41.2, 41.5, 61.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g).connect(dlp); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg).connect(dlp.frequency); lfo.start();
    const strings = mk('strings'); const ws = ctx.createWaveShaper(); ws.curve = this.distCurve(18); const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 1600;
    const trem = ctx.createGain(); trem.gain.value = 0.5; const tl = ctx.createOscillator(); tl.frequency.value = 9; const tlg = ctx.createGain(); tlg.gain.value = 0.45; tl.connect(tlg).connect(trem.gain); tl.start();
    for (const f of [110, 116.54, 155.56, 164.81, 233.08]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 20; const g = ctx.createGain(); g.gain.value = 0.08; o.connect(g).connect(ws); o.start(); }
    ws.connect(slp).connect(trem).connect(strings);
    mk('pulse'); mk('escape');
    this.ok = true;
  }
  distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  loopNoise(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random()); return s; }
  now() { return this.ctx.currentTime; }

  setListener(cam) {
    if (!this.ok) return; const L = this.ctx.listener; const p = cam.position; const f = cam.getWorldDirection(this._v || (this._v = cam.position.clone()));
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }
  // output node for an SFX: positional or direct
  out(pos, vol = 1, echo = 0) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (pos) {
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 80;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1, pos.z);
      g.connect(p).connect(this.sfxBus); if (echo) { const e = this.ctx.createGain(); e.gain.value = echo; p.connect(e).connect(this.echoIn); }
    } else { g.connect(this.sfxBus); if (echo) { const e = this.ctx.createGain(); e.gain.value = echo; g.connect(e).connect(this.echoIn); } }
    return g;
  }
  burst(dest, { t = 0, dur = 0.1, type = 'bandpass', f = 1000, q = 1, gain = 1, attack = 0.002, curve = 'exp', buf } = {}) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf || this.noise; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); const t0 = this.now() + t; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); else g.gain.linearRampToValueAtTime(0, t0 + dur);
    s.connect(flt).connect(g).connect(dest); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05); return flt;
  }
  tone(dest, { t = 0, dur = 0.2, type = 'sine', f = 440, f2, gain = 0.5, attack = 0.003 } = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; const t0 = this.now() + t; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05); return o;
  }

  // ------------------------------------------------------------ SFX
  step(mat, vol, pos) {
    if (!this.ok) return; const o = this.out(pos, vol);
    switch (mat) {
      case 'c': this.burst(o, { dur: 0.09, type: 'lowpass', f: 500, gain: 0.35 }); break;
      case 'w': this.burst(o, { dur: 0.12, f: 900, q: 0.8, gain: 0.5 }); this.burst(o, { t: 0.02, dur: 0.15, type: 'highpass', f: 3500, gain: 0.25 }); break;
      case 'm': this.burst(o, { dur: 0.08, f: 1200, gain: 0.5 }); for (const f of [410, 1130, 1720]) this.tone(o, { f, dur: 0.35, gain: 0.08 }); break;
      case 'g': for (let i = 0; i < 5; i++) this.burst(o, { t: i * 0.018 + Math.random() * 0.02, dur: 0.05, type: 'highpass', f: 4000 + Math.random() * 3000, gain: 0.7 }); for (let i = 0; i < 3; i++) this.tone(o, { t: Math.random() * 0.06, f: 3000 + Math.random() * 4000, dur: 0.1, gain: 0.05 }); break;
      case 'f': this.burst(o, { dur: 0.18, type: 'lowpass', f: 380, gain: 0.7 }); this.burst(o, { t: 0.04, dur: 0.12, f: 700, q: 4, gain: 0.3 }); break;
      case 'k': this.burst(o, { dur: 0.1, f: 600, gain: 0.5 }); break;
      default: this.burst(o, { dur: 0.08, f: 1400, q: 0.9, gain: 0.45 }); this.burst(o, { dur: 0.05, type: 'lowpass', f: 250, gain: 0.3 });
    }
  }
  gunshot(pos) {
    if (!this.ok) return; const o = this.out(pos, 1.3, 0.9);
    this.burst(o, { dur: 0.28, type: 'highpass', f: 900, gain: 1.2, attack: 0.001 });
    this.burst(o, { dur: 0.5, type: 'lowpass', f: 400, gain: 1.4, attack: 0.001, buf: this.brown });
    this.tone(o, { f: 140, f2: 38, dur: 0.35, gain: 1.1 });
  }
  dryfire() { if (!this.ok) return; const o = this.out(null, 0.6); this.burst(o, { dur: 0.03, type: 'highpass', f: 3000, gain: 0.8 }); this.tone(o, { f: 2200, dur: 0.04, gain: 0.1 }); }
  casing(pos) { if (!this.ok) return; const o = this.out(pos, 0.5); [0.35, 0.52, 0.62, 0.68].forEach((t, i) => { this.tone(o, { t, f: 4200 - i * 300, dur: 0.12, gain: 0.12 / (i + 1) }); this.tone(o, { t, f: 6100, dur: 0.06, gain: 0.05 }); }); }
  reload(pos) { if (!this.ok) return; const o = this.out(pos, 0.8); [0, 0.35, 0.6, 0.95].forEach((t, i) => { this.burst(o, { t, dur: 0.04, type: 'highpass', f: 2500, gain: 0.8 }); this.tone(o, { t, f: 900 + i * 300, dur: 0.07, gain: 0.15 }); }); }
  click(pos, n = 3, vol = 1) { // knocker clicking
    if (!this.ok) return; const o = this.out(pos, vol);
    for (let i = 0; i < n; i++) { const t = i * (0.05 + Math.random() * 0.04); this.burst(o, { t, dur: 0.02, f: 2200 + Math.random() * 900, q: 6, gain: 1.4, attack: 0.0005 }); this.tone(o, { t, f: 180, dur: 0.03, gain: 0.25 }); }
    this.burst(o, { t: n * 0.07, dur: 0.25, type: 'lowpass', f: 300, gain: 0.25, buf: this.brown }); // throaty gurgle
  }
  scream(pos, kind = 'frenzied', vol = 1) {
    if (!this.ok) return; const o = this.out(pos, vol, 0.3); const ctx = this.ctx; const t0 = this.now();
    const base = kind === 'lurker' ? 210 : kind.includes('knock') ? 150 : 330;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(base * 1.3, t0); osc.frequency.exponentialRampToValueAtTime(base * 0.6, t0 + 0.7);
    const vib = ctx.createOscillator(); vib.frequency.value = 23; const vg = ctx.createGain(); vg.gain.value = base * 0.08; vib.connect(vg).connect(osc.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 950; f1.Q.value = 3; const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    osc.connect(f1).connect(g).connect(o); osc.start(t0); vib.start(t0); osc.stop(t0 + 0.85); vib.stop(t0 + 0.85);
    this.burst(o, { dur: 0.7, f: 1800, q: 1, gain: 0.35 });
  }
  growl(pos, vol = 0.6) { if (!this.ok) return; const o = this.out(pos, vol); this.tone(o, { type: 'sawtooth', f: 75 + Math.random() * 20, f2: 55, dur: 0.6, gain: 0.25 }); this.burst(o, { dur: 0.5, type: 'lowpass', f: 500, gain: 0.3, buf: this.brown }); }
  breath(vol = 0.3) { if (!this.ok) return; const o = this.out(null, vol); this.burst(o, { dur: 0.45, f: 1100, q: 0.7, gain: 0.3, attack: 0.15, curve: 'lin' }); }
  hurt() { if (!this.ok) return; const o = this.out(null, 0.8); this.tone(o, { type: 'triangle', f: 380, f2: 220, dur: 0.25, gain: 0.3 }); this.burst(o, { dur: 0.3, f: 900, gain: 0.3 }); this.tone(o, { f: 60, f2: 40, dur: 0.3, gain: 0.8 }); }
  stab(pos) { if (!this.ok) return; const o = this.out(pos, 0.9); this.burst(o, { dur: 0.08, type: 'highpass', f: 2000, gain: 0.5 }); this.burst(o, { t: 0.03, dur: 0.15, type: 'lowpass', f: 300, gain: 0.9 }); this.tone(o, { t: 0.03, f: 90, f2: 50, dur: 0.15, gain: 0.6 }); }
  swoosh() { if (!this.ok) return; const o = this.out(null, 0.5); this.burst(o, { dur: 0.18, f: 1400, q: 0.6, gain: 0.5, attack: 0.05 }); }
  door(pos, loud = true) { if (!this.ok) return; const o = this.out(pos, loud ? 1 : 0.5, 0.3); const ctx = this.ctx, t0 = this.now();
    const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(140, t0); s.frequency.linearRampToValueAtTime(260, t0 + 0.6); s.frequency.linearRampToValueAtTime(190, t0 + 0.9);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 18; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.7, t0 + 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + 1);
    s.connect(bp).connect(g).connect(o); s.start(t0); s.stop(t0 + 1.05);
    if (loud) { this.tone(o, { t: 0.9, f: 220, dur: 0.8, gain: 0.3 }); this.tone(o, { t: 0.9, f: 587, dur: 0.6, gain: 0.12 }); this.burst(o, { t: 0.9, dur: 0.2, type: 'lowpass', f: 300, gain: 0.8 }); } }
  smash(pos) { if (!this.ok) return; const o = this.out(pos, 1.1, 0.5); this.burst(o, { dur: 0.35, type: 'highpass', f: 3000, gain: 1 }); for (let i = 0; i < 9; i++) this.tone(o, { t: Math.random() * 0.25, f: 2500 + Math.random() * 5000, dur: 0.15, gain: 0.1 }); }
  thud(pos) { if (!this.ok) return; const o = this.out(pos, 1, 0.4); this.burst(o, { dur: 0.25, type: 'lowpass', f: 350, gain: 1.2 }); this.tone(o, { f: 110, f2: 60, dur: 0.2, gain: 0.6 }); }
  crack(pos) { if (!this.ok) return; const o = this.out(pos, 1.4, 0.5); this.burst(o, { dur: 0.12, type: 'highpass', f: 1500, gain: 1.3, attack: 0.0005 }); this.burst(o, { t: 0.02, dur: 0.9, type: 'lowpass', f: 200, gain: 1.2, buf: this.brown }); for (let i = 0; i < 6; i++) this.burst(o, { t: 0.1 + i * 0.07 + Math.random() * 0.05, dur: 0.04, f: 800 + Math.random() * 1500, q: 3, gain: 0.5 }); }
  thunder(dist = 1) { if (!this.ok) return; const o = this.out(null, 0.9 * dist); this.burst(o, { dur: 3.5, type: 'lowpass', f: 160, gain: 1.4, attack: 0.3, buf: this.brown }); this.burst(o, { t: 0.2, dur: 1.2, type: 'lowpass', f: 600, gain: 0.5, buf: this.brown }); }
  vent(pos) { if (!this.ok) return; const o = this.out(pos, 0.9); for (let i = 0; i < 7; i++) { const t = i * 0.09 + Math.random() * 0.04; this.burst(o, { t, dur: 0.05, f: 1500, q: 2, gain: 0.6 }); this.tone(o, { t, f: 620 + Math.random() * 200, dur: 0.15, gain: 0.08 }); } }
  scrape(pos, dur = 1.2) { if (!this.ok) return; const o = this.out(pos, 0.7); for (let i = 0; i < 6; i++) this.burst(o, { t: i * dur / 6, dur: dur / 5, f: 500 + Math.random() * 400, q: 2, gain: 0.5, attack: 0.05, curve: 'lin' }); }
  tear(pos) { if (!this.ok) return; const o = this.out(pos, 1.5, 0.6); this.burst(o, { dur: 2.5, type: 'lowpass', f: 700, gain: 1.4, attack: 0.1, buf: this.brown }); for (let i = 0; i < 14; i++) this.burst(o, { t: Math.random() * 1.8, dur: 0.15, f: 250 + Math.random() * 500, q: 5, gain: 0.8 }); this.tone(o, { f: 55, f2: 30, dur: 2, gain: 0.9 }); }
  pickup() { if (!this.ok) return; const o = this.out(null, 0.4); this.burst(o, { dur: 0.15, f: 2500, q: 0.6, gain: 0.4, attack: 0.03 }); }
  roll(pos) { if (!this.ok) return; const o = this.out(pos, 0.6); for (let i = 0; i < 10; i++) this.tone(o, { t: i * 0.11, f: 900 + Math.random() * 300, dur: 0.1, gain: 0.07 }); }
  heartbeat(vol) { if (!this.ok) return; const o = this.out(null, vol); this.tone(o, { f: 55, f2: 40, dur: 0.15, gain: 0.8 }); this.tone(o, { t: 0.2, f: 50, f2: 38, dur: 0.15, gain: 0.5 }); }
  debris(pos) { if (!this.ok) return; const o = this.out(pos, 1.2, 0.5); this.burst(o, { dur: 0.6, type: 'lowpass', f: 450, gain: 1.2, buf: this.brown }); for (let i = 0; i < 8; i++) this.burst(o, { t: 0.05 + Math.random() * 0.5, dur: 0.06, f: 700 + Math.random() * 1200, q: 2, gain: 0.5 }); }

  // ------------------------------------------------------------ per-frame mix
  // intensity: 0 ambient, 1 drone, 2 pulse, 3 combat, 4 escape
  update(dt, { target, indoor, listen, outsideProx }) {
    if (!this.ok) return;
    const up = target > this.intensity; this.intensity += (target - this.intensity) * Math.min(1, dt * (up ? 1.2 : 0.12));
    if (this.duckT > 0) { this.duckT -= dt; this.duck += (0 - this.duck) * Math.min(1, dt * 10); } else this.duck += (1 - this.duck) * Math.min(1, dt * 0.5);
    const I = this.intensity, t = this.now(), k = this.duck;
    const set = (g, v) => g.gain.setTargetAtTime(v, t, 0.3);
    set(this.layers.drone, Math.min(1, Math.max(0, I - 0.2)) * 0.35 * k);
    set(this.layers.strings, Math.max(0, Math.min(1, I - 2.2)) * 0.35 * k);
    set(this.rainG, (indoor ? 0.07 + outsideProx * 0.2 : 0.55) * (0.3 + 0.7 * k));
    this.rainLP.frequency.setTargetAtTime(indoor ? 900 : 9000, t, 0.4);
    set(this.windG, 0.05 * k + (indoor ? 0.04 : 0));
    this.muffle.frequency.setTargetAtTime(listen ? 900 : 20000, t, 0.12);
    // percussive pulse
    if (I > 1.4 && k > 0.3) {
      this.beatT -= dt; const bpm = I > 3.5 ? 150 : I > 2.5 ? 118 : 84;
      if (this.beatT <= 0) {
        this.beatT += 60 / bpm; const o = this.layers.pulse; set(o, Math.min(1, I - 1.4) * 0.8 * k);
        this.tone(o, { f: 70, f2: 38, dur: 0.25, gain: 0.8 }); if (I > 2.5) this.burst(o, { t: 30 / bpm, dur: 0.05, type: 'highpass', f: 5000, gain: 0.25 });
        if (I > 3.5) { this.burst(o, { t: 15 / bpm, dur: 0.08, f: 300, q: 2, gain: 0.5 }); this.tone(o, { t: 0.01, type: 'sawtooth', f: 55, dur: 0.2, gain: 0.12 }); }
      }
    } else this.beatT = 0;
  }
  silence(sec) { this.duckT = sec; }
}

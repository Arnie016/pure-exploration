// Public edition: original music tracks and the existing procedural WebAudio effects.
// Unverified sampled SFX are excluded from this bundle.
export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.intensity = 0; // 0 calm .. 1 chase
    this.step = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
    this.musicBus.connect(this.master);
    // Short city reverb on effects: synthetic impulse, 1.6 s decay.
    const irLen = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    this.sfxBus.connect(this.verb).connect(wet).connect(this.master);
    // Ambience bus (city bed), follows the SFX toggle.
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = this.sfxOn ? 1 : 0;
    this.ambBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
    this.loadSamples();
    if (this.wantAmb) this.ambience(this.wantAmb);
  }

  // ── recorded samples (assets/audio). Synth versions remain as fallbacks. ──
  loadSamples() {
    this.buffers = {};
    const names = ['music_intro', 'music_run'];
    for (const n of names) {
      fetch(`assets/audio/${n}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => {
          this.buffers[n] = buf;
          if (n === this.wantMusic) this.music(n);
        })
        .catch(() => {});
    }
  }

  sample(name, vol = 1, rate = 1, bus = this.sfxBus) {
    const buf = this.buffers?.[name];
    if (!this.ctx || !buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(bus);
    src.start();
    return true;
  }

  setRate(r) {
    if (this.track && Math.abs(this.track.src.playbackRate.value - r) > 0.01) {
      this.track.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.15);
    }
  }

  /** Crossfade to a looping music track (null = silence). */
  music(name) {
    this.wantMusic = name;
    if (!this.ctx) return;
    if (this.track?.name === name) return;
    const t = this.ctx.currentTime;
    if (this.track) {
      const old = this.track;
      old.gain.gain.setTargetAtTime(0.0001, t, 0.4);
      old.src.stop(t + 2);
      this.track = null;
    }
    const buf = name && this.buffers?.[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(1, t, 0.5);
    src.connect(g).connect(this.musicBus);
    src.start();
    this.track = { name, src, gain: g };
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
  }

  /** Looping zone bed: wind on the roofs, traffic downtown, rumble underground… */
  ambience(zone) {
    if (!this.ctx) {
      this.wantAmb = zone;
      return;
    }
    if (this.amb?.zone === zone) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.amb) {
      const old = this.amb;
      old.g.gain.setTargetAtTime(0.0001, t, 0.6);
      setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch {} }), 3000);
    }
    const P = {
      roof: { type: 'bandpass', f: 500, q: 0.6, vol: 0.09, lfo: 0.13, hum: 0 },
      street: { type: 'lowpass', f: 420, q: 0.7, vol: 0.12, lfo: 0.05, hum: 55 },
      park: { type: 'bandpass', f: 900, q: 0.4, vol: 0.05, lfo: 0.2, hum: 0 },
      subway: { type: 'lowpass', f: 160, q: 1.2, vol: 0.2, lfo: 0.08, hum: 48 },
      prison: { type: 'lowpass', f: 220, q: 1.5, vol: 0.13, lfo: 0.03, hum: 41 },
      office: { type: 'lowpass', f: 300, q: 0.5, vol: 0.05, lfo: 0, hum: 60 },
      rift: { type: 'bandpass', f: 1200, q: 4, vol: 0.05, lfo: 0.3, hum: 110 },
    }[zone] || { type: 'lowpass', f: 400, q: 0.7, vol: 0.08, lfo: 0.1, hum: 0 };
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(P.vol, t, 1.2);
    g.connect(this.ambBus);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = P.type;
    f.frequency.value = P.f;
    f.Q.value = P.q;
    src.connect(f).connect(g);
    src.start();
    const nodes = [src];
    if (P.lfo) {
      // Slow gusts.
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = P.lfo;
      lg.gain.value = P.f * 0.5;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      nodes.push(lfo);
    }
    if (P.hum) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = zone === 'rift' ? 'sine' : 'triangle';
      o.frequency.value = P.hum;
      og.gain.value = zone === 'rift' ? 0.04 : 0.03;
      o.connect(og).connect(g);
      o.start();
      nodes.push(o);
    }
    this.amb = { zone, g, nodes };
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ambBus) this.ambBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.1);
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  // ── building blocks ──
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  tone(type, f0, f1, dur, vol, bus = this.sfxBus, t = this.ctx.currentTime) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur, vol, type, f0, f1, q = 1, bus = this.sfxBus, t = this.ctx.currentTime, attack = 0.005) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + attack + 0.05);
  }

  // ── sound effects ──
  play(name, arg = 0) {
    if (!this.ctx || !this.sfxOn) return;
    const pick = (a, b) => (Math.random() < 0.5 ? a : b);
    const SAMPLE = {
      zap: ['line_shot', 0.55, 0.9 + Math.random() * 0.25],
      hit: ['impact', 0.9, 1],
      smash: [pick('wood-impact-01', 'wood-impact-02'), 0.8, 0.9 + Math.random() * 0.2],
      power: ['discovery-01', 0.7, 1],
      whoosh: [pick('glider-bank-01', 'glider-bank-02'), 0.55, 1.1],
      turn: ['glider-bank-02', 0.6, 1.2],
      lane: [pick('glider-bank-01', 'glider-bank-02'), 0.25, 1.5],
      shield: ['crystal-fracture-01', 0.7, 1.1],
      boom: ['shockwave', 0.9, 1],
      braam: ['braam', 0.8, 1],
      caught: ['braam', 0.9, 0.9],
      thunder: ['thunder', 0.8, 1],
      train: ['train', 0.8, 1],
      car: ['car_pass', 0.6, 1],
      slam: ['basalt-impact-01', 0.9, 0.8],
      glass: [pick('crystal-fracture-01', 'crystal-fracture-02'), 0.7, 1],
      rise: ['cinematic_rise', 0.8, 1],
      drone: ['dark_drone', 0.7, 1],
    };
    const smp = SAMPLE[name];
    if (smp && this.sample(smp[0], smp[1], smp[2])) {
      if (name === 'hit') this.tone('sine', 140, 40, 0.3, 0.3);
      return;
    }
    const t = this.ctx.currentTime;
    switch (name) {
      case 'siren': {
        // Two-tone NYC siren, far away (quiet, filtered).
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1600;
        o.type = 'sawtooth';
        for (let i = 0; i < 6; i++) {
          o.frequency.setValueAtTime(700, t + i * 0.55);
          o.frequency.linearRampToValueAtTime(1050, t + i * 0.55 + 0.27);
        }
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.6);
        g.gain.linearRampToValueAtTime(0.0, t + 3.3);
        o.connect(f).connect(g).connect(this.sfxBus);
        o.start(t);
        o.stop(t + 3.4);
        return;
      }
      case 'horn':
        this.tone('square', 392, 385, 0.35, 0.05);
        this.tone('square', 494, 490, 0.35, 0.04);
        return;
      case 'scream':
        this.hiss(0.5, 0.04, 'bandpass', 1400 + Math.random() * 600, 900, 6, this.sfxBus, t, 0.05);
        this.tone('sine', 900 + Math.random() * 300, 600, 0.45, 0.02);
        return;
      case 'birds':
        for (let i = 0; i < 6; i++) this.tone('sine', 2800 + Math.random() * 800, 3600, 0.07, 0.025, this.sfxBus, t + i * 0.09 + Math.random() * 0.05);
        return;
      case 'distantBoom': {
        const far = Math.min(1, (arg || 150) / 300);
        if (this.sample('thunder', 0.35 * (1 - far * 0.6), 0.7)) return;
        this.hiss(1.4, 0.12 * (1 - far * 0.6), 'lowpass', 200, 60, 1, this.sfxBus, t, 0.02);
        return;
      }
      case 'coin': {
        const f = 1318 * Math.pow(2, (arg % 8) / 24);
        this.tone('square', f, f, 0.06, 0.08);
        this.tone('sine', f * 1.5, f * 1.5, 0.14, 0.1, this.sfxBus, t + 0.05);
        break;
      }
      case 'zap':
        this.tone('sawtooth', 1800, 300, 0.12, 0.05);
        this.hiss(0.1, 0.12, 'highpass', 4000, 2500, 0.7);
        break;
      case 'whoosh':
        this.hiss(0.35, 0.18, 'bandpass', 400, 2200, 1.4, this.sfxBus, t, 0.08);
        break;
      case 'hop':
        this.tone('triangle', 300, 700, 0.16, 0.12);
        this.hiss(0.2, 0.08, 'bandpass', 800, 3000, 1.2);
        break;
      case 'dive':
        this.tone('triangle', 500, 160, 0.2, 0.12);
        this.hiss(0.25, 0.1, 'bandpass', 2500, 500, 1.2);
        break;
      case 'lane':
        this.hiss(0.18, 0.1, 'bandpass', 900, 1800, 2);
        break;
      case 'hit':
        this.tone('sine', 140, 40, 0.35, 0.5);
        this.hiss(0.3, 0.3, 'lowpass', 3000, 200, 0.8);
        this.tone('square', 90, 60, 0.2, 0.08);
        break;
      case 'smash':
        this.hiss(0.45, 0.35, 'lowpass', 5000, 300, 0.7);
        this.tone('sine', 110, 40, 0.4, 0.4);
        break;
      case 'roar': {
        const o = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o2.type = 'square';
        o.frequency.setValueAtTime(90, t);
        o.frequency.linearRampToValueAtTime(60, t + 1.3);
        o2.frequency.setValueAtTime(93, t);
        o2.frequency.linearRampToValueAtTime(58, t + 1.3);
        lfo.frequency.value = 22;
        lg.gain.value = 18;
        lfo.connect(lg).connect(o.frequency);
        f.type = 'lowpass';
        f.frequency.setValueAtTime(1400, t);
        f.frequency.linearRampToValueAtTime(400, t + 1.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(f);
        o2.connect(f);
        f.connect(g).connect(this.sfxBus);
        for (const x of [o, o2, lfo]) {
          x.start(t);
          x.stop(t + 1.5);
        }
        this.hiss(1.2, 0.2, 'bandpass', 600, 250, 1.5, this.sfxBus, t, 0.1);
        break;
      }
      case 'power':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.12, 0.07, this.sfxBus, t + i * 0.06));
        break;
      case 'shield':
        this.tone('sine', 900, 200, 0.4, 0.2);
        this.hiss(0.3, 0.15, 'highpass', 3000, 1500, 0.8);
        break;
      case 'boom':
        this.tone('sine', 80, 30, 0.8, 0.6);
        this.hiss(0.9, 0.35, 'lowpass', 2500, 80, 0.7);
        break;
      case 'turn':
        this.hiss(0.4, 0.16, 'bandpass', 1500, 500, 1.5, this.sfxBus, t, 0.05);
        break;
      case 'ui':
        this.tone('square', 880, 1320, 0.06, 0.06);
        break;
      case 'caught':
        [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 0.22, 0.08, this.sfxBus, t + i * 0.16));
        break;
      case 'unlock':
        [523, 784, 1046, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.1, this.sfxBus, t + i * 0.08));
        break;
    }
  }

  // ── music: 16-step loop at 124 BPM, denser while being chased ──
  schedule() {
    if (!this.ctx) return;
    const spb = 60 / 124 / 4;
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      if (this.musicOn && this.playing && !this.track) this.musicStep(this.step, this.nextNote);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  musicStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const bus = this.musicBus;
    if (s === 0 || s === 8 || (s === 11 && bar % 2) || (this.intensity > 0.5 && s === 14)) {
      this.tone('sine', 150, 42, 0.28, 0.55, bus, t);
    }
    if (s === 4 || s === 12) this.hiss(0.16, 0.22, 'bandpass', 2000, 1200, 0.8, bus, t);
    if (s % 2 === 0 || this.intensity > 0.5) this.hiss(0.04, s % 4 === 2 ? 0.07 : 0.035, 'highpass', 8000, 7000, 1, bus, t);
    // Bass line (minor, gritty).
    const roots = [55, 55, 65.4, 49];
    const pattern = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (pattern[s]) {
      const f = roots[bar % 4] * (s === 13 ? 2 : 1);
      const o = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(900 + this.intensity * 900, t);
      flt.frequency.exponentialRampToValueAtTime(180, t + 0.18);
      this.env(g, t, 0.005, 0.22, 0.2);
      o.connect(flt).connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.25);
    }
    // Synth stab on the offbeat.
    if (s === 6 || s === 14) {
      const chord = [[220, 261.6, 329.6], [220, 261.6, 329.6], [261.6, 329.6, 392], [196, 246.9, 293.7]][bar % 4];
      for (const f of chord) this.tone('square', f * 2, f * 2, 0.09, 0.025, bus, t);
    }
  }
}

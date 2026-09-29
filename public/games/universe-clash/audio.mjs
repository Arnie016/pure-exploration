const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createAudio() {
  let context = null, master = null, compressor = null, droneGain = null, droneFilter = null;
  let noiseBuffer = null, unlocked = false, muted = false, disposed = false, unlocking = null;
  let lastEvent = 0, lastTick = -1;
  let chargeTone = null, chargeGain = null, effectsGain = 1;
  const voices = new Set();
  const droneSources = [];
  const steps = Array(12).fill(0);
  let stepSide = 0;
  let lastZoneStep = 0, finalePlayed = false, environmentAt = 0;
  const audible = new Set([0, 1]);
  const clashCues = new Map();
  let adrenalineAt = 0;

  function volume() {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(muted || !unlocked ? 0 : 0.18, now, 0.035);
  }

  function unlock() {
    if (disposed) return Promise.resolve(false);
    if (unlocking) return unlocking;
    unlocking = (async () => {
      try {
        if (!context) {
          const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AudioContext) return false;
          context = new AudioContext({ latencyHint: 'interactive' });
          master = context.createGain(); master.gain.value = 0;
          compressor = context.createDynamicsCompressor();
          compressor.threshold.value = -20; compressor.knee.value = 16;
          compressor.ratio.value = 5; compressor.attack.value = 0.004; compressor.release.value = 0.16;
          master.connect(compressor); compressor.connect(context.destination);
          noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          let seed = 77839, brown = 0;
          for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const white = seed / 2147483648 - 1;
            brown = (brown + white * 0.025) / 1.025;
            data[i] = white * 0.67 + brown * 2.2;
          }
          droneGain = context.createGain(); droneGain.gain.value = 0;
          droneFilter = context.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 240;
          droneGain.connect(droneFilter); droneFilter.connect(master);
          for (const [frequency, type, amount] of [[55, 'sine', 0.43], [82.41, 'sine', 0.2], [110.17, 'triangle', 0.1]]) {
            const oscillator = context.createOscillator(), gain = context.createGain();
            oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = amount;
            oscillator.connect(gain); gain.connect(droneGain); oscillator.start();
            droneSources.push({ oscillator, gain });
          }
          chargeTone = context.createOscillator(); chargeTone.type = 'triangle'; chargeTone.frequency.value = 150;
          chargeGain = context.createGain(); chargeGain.gain.value = 0;
          chargeTone.connect(chargeGain); chargeGain.connect(master); chargeTone.start();
        }
        if (context.state === 'suspended') await context.resume();
        if (disposed) return false;
        unlocked = context.state === 'running';
        volume();
        if (unlocked) droneGain.gain.setTargetAtTime(0.042, context.currentTime, 1.5);
        return unlocked;
      } catch {
        unlocked = false;
        return false;
      }
    })().finally(() => { unlocking = null; });
    return unlocking;
  }

  function setMuted(value) {
    muted = !!value;
    volume();
  }

  function sound({ frequency = 160, end = 55, duration = 0.16, gain = 0.12, type = 'sine', noise = false, cutoff = 1600, filterType = 'lowpass', pan = 0, delay = 0, attack = 0.006 } = {}) {
    if (disposed || !unlocked || muted || context?.state !== 'running' || voices.size >= 28) return;
    const now = context.currentTime + delay;
    const source = noise ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain(), filter = context.createBiquadFilter();
    const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    if (panner.pan) panner.pan.value = clamp(pan, -0.7, 0.7);
    if (noise) {
      source.buffer = noiseBuffer;
      source.playbackRate.setValueAtTime(Math.max(0.2, frequency / 160), now);
      source.playbackRate.exponentialRampToValueAtTime(Math.max(0.1, end / 160), now + duration);
      source.loop = true;
    } else {
      source.type = type;
      source.frequency.setValueAtTime(Math.max(15, frequency), now);
      source.frequency.exponentialRampToValueAtTime(Math.max(15, end), now + duration);
    }
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(75, cutoff * 0.35), now + duration);
    filter.Q.value = filterType === 'bandpass' ? 0.7 : 0.4;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain * effectsGain, now + Math.min(attack, duration * 0.35));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    envelope.gain.linearRampToValueAtTime(0, now + duration + 0.02);
    source.connect(filter); filter.connect(envelope); envelope.connect(panner); panner.connect(master);
    const voice = { source, filter, envelope, panner };
    voices.add(voice);
    source.onended = () => {
      for (const node of Object.values(voice)) node.disconnect();
      voices.delete(voice);
    };
    source.start(now); source.stop(now + duration + 0.025);
  }

  function event(e) {
    if (!e || disposed) return;
    if (Number.isFinite(e.id)) {
      if (e.id <= lastEvent) return;
      lastEvent = e.id;
    }
    // Never queue effects before consent, or replay a burst when unmuting.
    if (!unlocked || muted) return;
    const pan = clamp((Number.isFinite(e.x) ? e.x : 0) / 14, -0.65, 0.65);
    if (e.type === 'clash') {
      if(e.kind==='boost') {
        sound({frequency:780,end:1140,type:'triangle',gain:.05,duration:.1,cutoff:2800,pan});
      } else if(e.kind==='start') {
        sound({noise:true,frequency:220,end:65,gain:.09,duration:.32,cutoff:2200,pan});
        sound({frequency:94,end:130,gain:.09,duration:.4,cutoff:500,pan});
      } else if(e.kind==='win') {
        sound({frequency:330,end:880,type:'triangle',gain:.07,duration:.24,cutoff:2800,pan});
        sound({noise:true,frequency:240,end:60,gain:.075,duration:.32,cutoff:1600,pan});
      } else if(e.kind==='draw'||e.kind==='break') {
        sound({noise:true,frequency:e.kind==='break'?180:110,end:35,gain:.065,duration:.24,cutoff:900,pan});
      }
    } else if(e.type==='explosion') {
      const strength=clamp((e.radius||1)/6,.15,1);
      sound({frequency:65,end:25,gain:.07+strength*.07,duration:.24+strength*.28,cutoff:400,pan});
      sound({noise:true,frequency:135,end:38,gain:.045+strength*.045,duration:.2+strength*.3,cutoff:1600,pan});
    } else if(e.type==='ricochet') {
      sound({frequency:1640,end:480,type:'triangle',gain:.055,duration:.12,cutoff:3100,pan});
    } else if(e.type==='emotion'&&['pressured','desperate','shocked'].includes(e.kind)) {
      sound({frequency:e.kind==='shocked'?920:e.kind==='desperate'?130:180,end:e.kind==='shocked'?230:65,gain:.05,duration:.22,cutoff:1200,pan});
    } else if(e.type==='attack'&&e.meteor===true) {
      // Telegraph only. The impact must be a real explosion, not a delayed guess
      // that still plays when an interrupt cancels the falling object.
      sound({frequency:310,end:620,type:'triangle',gain:.06,duration:.42,attack:.06,cutoff:2200,pan});
      sound({noise:true,frequency:60,end:150,gain:.035,duration:.5,attack:.12,cutoff:900,pan});
    } else if (e.type === 'ki' && ['guard', 'evade'].includes(e.kind) && e.power > 0) {
      sound({ frequency: e.kind === 'guard' ? 1480 : 960, end: 720, type: 'triangle', gain: .052, duration: .085, cutoff: 3200, pan });
      sound({ frequency: 190, end: 330, gain: .038, duration: .28, attack: .06, cutoff: 900, pan });
    } else if (e.type === 'dodge' && e.kind === 'evade') {
      const vanish = e.evadeKind === 'vanish';
      sound({ noise: true, frequency: vanish ? 390 : 150, end: vanish ? 65 : 90, gain: vanish ? .065 : .04, duration: vanish ? .18 : .13, cutoff: vanish ? 3600 : 1600, filterType: 'bandpass', pan });
      if (vanish) sound({ frequency: 620, end: 145, gain: .022, duration: .15, cutoff: 1500, pan });
    } else if (e.type === 'prop' || e.prop === true) {
      if (e.kind === 'respawn') return;
      const lift = e.kind === 'lift', throwing = e.kind === 'throw';
      sound({ frequency: lift ? 64 : throwing ? 95 : 78, end: lift ? 105 : 30, gain: lift ? .07 : throwing ? .085 : .14, duration: lift ? .3 : .2, cutoff: 460, attack: lift ? .04 : .004, pan });
      sound({ noise: true, frequency: throwing ? 240 : 90, end: 45, gain: lift ? .035 : .065, duration: throwing ? .18 : .26, cutoff: throwing ? 1700 : 950, pan });
    } else if (e.type === 'environment' && e.power > 0 && audible.has(e.owner)) {
      if (context.currentTime < environmentAt) return;
      environmentAt = context.currentTime + .3;
      sound({ noise: true, frequency: e.kind === 'fire' ? 125 : 70, end: 45, gain: .035, duration: .22, cutoff: e.kind === 'fire' ? 2200 : 420, pan });
    } else if (e.type === 'hit') {
      const strength = clamp((e.power || 60) / 140, 0.4, 1.8);
      sound({ frequency: 130 - strength * 14, end: 35, gain: 0.18 + strength * 0.025, duration: 0.16 + strength * 0.05, pan });
      sound({ noise: true, frequency: 180, end: 80, cutoff: 2400, gain: 0.095, duration: 0.105 + strength * 0.04, pan });
      if (['blast', 'beam', 'ultimate'].includes(e.kind)) {
        sound({ noise: true, frequency: 310, end: 135, cutoff: 1700, filterType: 'highpass', gain: .10, duration: .065, attack: .002, pan });
        sound({ frequency: e.kind === 'ultimate' ? 64 : 94, end: 27, gain: .17, duration: e.kind === 'ultimate' ? .55 : .25, cutoff: 260, delay: .012, pan });
      }
      if (e.kind === 'ultimate') sound({ noise: true, frequency: 70, end: 30, cutoff: 520, gain: 0.13, duration: 0.7, pan });
    } else if (e.type === 'block') {
      sound({ frequency: 1150, end: 590, type: 'triangle', gain: 0.085, duration: 0.13, pan });
      sound({ noise: true, frequency: 220, end: 100, cutoff: 3400, gain: 0.065, duration: 0.09, pan });
    } else if (e.type === 'attack') {
      if (e.kind === 'light' || e.kind === 'heavy' || e.kind === 'dash') {
        const heavy = e.kind === 'heavy';
        sound({ noise: true, frequency: heavy ? 90 : 170, end: heavy ? 220 : 90, cutoff: heavy ? 1700 : 2600, filterType: 'bandpass', gain: heavy ? 0.065 : 0.04, duration: heavy ? 0.28 : 0.12, attack: 0.03, pan });
      } else if (e.kind === 'blast') {
        const delay = Number.isFinite(e.windup) ? e.windup : .12;
        sound({ frequency: 230, end: 920, type: 'sine', gain: .055, duration: delay, attack: .025, cutoff: 2800, pan });
        sound({ frequency: 1040, end: 130, type: 'triangle', gain: .115, duration: .22, delay, cutoff: 3100, pan });
        sound({ noise: true, frequency: 270, end: 85, gain: .075, duration: .12, delay, cutoff: 4000, pan });
      } else if (e.kind === 'beam') {
        sound({ frequency: 140, end: 760, type: 'triangle', gain: 0.065, duration: 0.46, attack: 0.08, cutoff: 2400, pan });
        sound({ frequency: 240, end: 55, type: 'sawtooth', gain: 0.035, duration: 0.47, delay: 0.46, cutoff: 1500, pan });
        sound({ noise: true, frequency: 180, end: 50, gain: 0.065, duration: 0.52, delay: 0.46, cutoff: 2100, pan });
      } else if (e.kind === 'transform') {
        sound({ frequency: 70, end: 520, type: 'triangle', gain: 0.08, duration: .95, attack: .16, cutoff: 2100, pan });
        sound({ noise: true, frequency: 100, end: 330, gain: .045, duration: .85, attack: .2, cutoff: 1900, pan });
      } else if (e.kind === 'special') {
        sound({ frequency: 340, end: 920, type: 'triangle', gain: .065, duration: .2, cutoff: 2300, pan });
        sound({ noise: true, frequency: 210, end: 55, gain: .06, duration: .24, delay: .15, cutoff: 1700, pan });
      } else if (e.kind === 'ultimate') {
        sound({ frequency: 55, end: 440, type: 'triangle', gain: 0.085, duration: 0.88, attack: 0.2, cutoff: 2200, pan });
        sound({ frequency: 111, end: 885, gain: 0.035, duration: 0.88, attack: 0.3, cutoff: 2700, pan });
        sound({ frequency: 90, end: 28, gain: 0.2, duration: 0.6, delay: 0.9, cutoff: 400, pan });
        sound({ noise: true, frequency: 140, end: 45, gain: 0.08, duration: 0.7, delay: 0.9, cutoff: 2200, pan });
      }
    } else if (e.type === 'transform') {
      sound({ frequency: 80, end: 30, gain: .15, duration: .45, cutoff: 500, pan });
      for (const [index, frequency] of [330, 440, 660].entries()) sound({ frequency, end: frequency * 1.02, type: 'triangle', gain: .035, duration: .55, delay: index * .06, attack: .04, cutoff: 2500, pan });
    } else if (e.type === 'revert') {
      sound({ frequency: 480, end: 85, gain: .065, duration: .35, cutoff: 1500, pan });
    } else if (e.type === 'jump') {
      sound({ noise: true, frequency: 80, end: 210, cutoff: 1500, filterType: 'bandpass', gain: 0.045, duration: 0.18, pan });
    } else if (e.type === 'land') {
      sound({ frequency: e.kind === 'polished inlay' ? 185 : 115, end: 45, gain: 0.075, duration: 0.13, pan });
      sound({ noise: true, frequency: 110, end: 65, cutoff: e.kind === 'rubble' ? 2900 : 1300, gain: 0.045, duration: e.kind === 'rubble' ? 0.23 : 0.1, pan });
    } else if (e.type === 'round' || e.type === 'match') {
      for (const [i, frequency] of [220, 277.18, 329.63].entries()) sound({ frequency, end: frequency * 0.998, type: 'sine', gain: 0.055, duration: e.type === 'match' ? 1.25 : 0.65, delay: i * 0.085, attack: 0.04, cutoff: 2000 });
    }
  }

  function click() {
    sound({ frequency: 940, end: 680, gain: 0.065, duration: 0.055, cutoff: 2500, attack: 0.003 });
  }

  function tick(state, dt = 0, options = {}) {
    if (disposed) return;
    effectsGain = options.reduced ? .65 : 1;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const localSlot = Number.isInteger(options.localSlot) ? clamp(options.localSlot, 0, 11) : 0;
    audible.clear(); audible.add(localSlot); audible.add(Number.isInteger(state?.fighters?.[localSlot]?.target) ? state.fighters[localSlot].target : 1);
    if (state && Number.isFinite(state.tick)) {
      let ceiling = 0;
      for (const e of state.events || []) if (Number.isFinite(e.id)) ceiling = Math.max(ceiling, e.id);
      if (state.tick < lastTick || ceiling > 0 && ceiling < lastEvent) { lastEvent = 0; steps.fill(0); lastZoneStep = 0; finalePlayed = false; environmentAt = 0; clashCues.clear(); adrenalineAt=0; }
      lastTick = state.tick;
      for (const e of state.events || []) event(e);
    } else if (!state && lastTick >= 0) {
      lastTick = -1; lastEvent = 0; steps.fill(0); lastZoneStep = 0; finalePlayed = false; environmentAt = 0; clashCues.clear(); adrenalineAt=0;
    }
    const zoneStep = state?.zone?.active ? Math.floor(clamp(state.zone.progress || 0, 0, 1) * 4) : 0;
    const finale = state?.phase === 'matchOver' && state?.zone?.active;
    if ((zoneStep > lastZoneStep || finale && !finalePlayed) && unlocked && !muted) {
      sound({ noise: true, frequency: 58, end: 28, duration: .48, gain: .045, cutoff: 550 });
      sound({ frequency: 62, end: 29, duration: .4, gain: .04, cutoff: 240 });
    }
    // Consume milestones even while muted/locked; no queued burst after consent.
    lastZoneStep = zoneStep; finalePlayed = !!finale;
    const clashes=(Array.isArray(state?.clashes)?state.clashes:[]).slice(0,6).filter(c=>c&&c.remaining>0&&Number.isInteger(c.id));
    for(const id of clashCues.keys())if(!clashes.some(c=>c.id===id))clashCues.delete(id);
    for(const c of clashes){
      if((c.a===localSlot||c.b===localSlot)&&c.cue===true&&!clashCues.get(c.id))sound({frequency:1320,end:1320,gain:.045,duration:.075,cutoff:3000});
      clashCues.set(c.id,c.cue===true);
    }
    if (!unlocked || context?.state !== 'running') return;
    const fighters = state?.fighters || [];
    const charging = fighters.some((f) => ['charge', 'transform', 'ultimate', 'beam'].includes(f.action));
    const fighting = state?.phase === 'fight';
    droneGain.gain.setTargetAtTime(charging ? 0.085 : fighting ? 0.045 : 0.03, context.currentTime, 0.6);
    droneFilter.frequency.setTargetAtTime(charging ? 540 : 220, context.currentTime, 0.5);
    const local = fighters[localSlot];
    const clash=clashes.find(c=>c.a===localSlot||c.b===localSlot);
    // Optional UI preview is elapsed X-hold seconds, not a paid/committed attack.
    // Without UI state, committed actions and power charging still drive the layer.
    const held = options.shotCharge ?? state?.ui?.shotCharge;
    const preview = Number.isFinite(held) && held > 0 ? held : 0;
    const windup = local?.action === 'beam' && local.actionTime > .46 ? clamp((.94-local.actionTime)/.48,0,1)*.85
      : local?.action === 'ultimate' && local.actionTime > .6 ? clamp((1.5-local.actionTime)/.9,0,1)*1.5 : 0;
    const power = local?.action === 'charge' || local?.action === 'transform';
    const amount = clash ? 0 : Math.max(preview, windup, power ? .25 : 0);
    chargeGain.gain.setTargetAtTime(fighting && (amount > 0 || clash) && !muted ? (clash?.024:preview >= 1.2 ? .043 : .028)*effectsGain : 0, context.currentTime, .045);
    chargeTone.frequency.setTargetAtTime(clash?180+clamp(Number.isFinite(clash.progress)?clash.progress:0,-1,1)*(clash.a===localSlot?1:-1)*45:150 + clamp(amount/1.5,0,1)*440 + (preview>=1.2?110:preview>=.35?45:0), context.currentTime, .065);
    if(fighting&&local?.adrenaline>0&&dt>0&&context.currentTime>=adrenalineAt){
      adrenalineAt=context.currentTime+.75;
      sound({frequency:68,end:42,duration:.12,gain:.026,cutoff:220});
      if(!options.reduced)sound({frequency:58,end:36,duration:.11,gain:.018,cutoff:180,delay:.17});
    }
    for (let i = 0; i < Math.min(12, fighters.length); i++) {
      const f = fighters[i];
      if (!audible.has(i) || !fighting || !['run','walk'].includes(f.action) || f.flight || f.y > 0.02) { steps[i] = 0; continue; }
      const speed=Math.hypot(f.vx || 0, f.vz || 0),stride=.38+clamp((speed-2)/4,0,1)*.25;
      steps[i] += speed * dt;
      if (steps[i] >= stride) {
        steps[i] %= stride;
        const water = state.hazards?.some(h => h.kind === 'water' && Math.hypot(f.x - h.x, f.z - h.z) < h.radius);
        const polished = Math.abs(f.x) < 1.65, rubble = Math.abs(f.x) > 8;
        sound({ noise: true, frequency: (water ? 210 : 100) + (stepSide++ % 2) * 22, end: 55, gain: 0.024, duration: water ? .16 : rubble ? 0.095 : 0.055, cutoff: water ? 1300 : polished ? 1800 : rubble ? 2500 : 850, filterType: water ? 'bandpass' : 'lowpass', pan: f.x / 15 });
      }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true; unlocked = false;
    for (const { oscillator, gain } of droneSources) { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); }
    for (const voice of voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* A source may already have ended. */ }
      for (const node of Object.values(voice)) node.disconnect();
    }
    voices.clear(); droneSources.length = 0;
    clashCues.clear();
    if (chargeTone) { chargeTone.stop(); chargeTone.disconnect(); chargeGain.disconnect(); }
    droneGain?.disconnect(); droneFilter?.disconnect(); master?.disconnect(); compressor?.disconnect();
    if (context && context.state !== 'closed') context.close().catch(() => {});
    noiseBuffer = null;
  }
  return { unlock, setMuted, event, click, tick, dispose,
    stats: () => ({ unlocked, muted, disposed, voices: voices.size, voiceLimit: 28, context: context?.state || 'locked', lastEvent, lastZoneStep, clashCues:clashCues.size }) };
}

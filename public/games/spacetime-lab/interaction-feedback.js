export const FEEDBACK_STORAGE_KEY = 'light-years-from-home.feedback.v1';

function availableStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// Original synthesized cues. No downloaded audio or remote requests.
const CUES = Object.freeze({
  commit: { notes: [440], duration: .07, gain: .045, vibration: 10, cooldown: 180 },
  correct: { notes: [523.25, 783.99], duration: .11, gain: .065, vibration: [14, 35, 18], cooldown: 380 },
  retry: { notes: [220], duration: .1, gain: .035, vibration: 8, cooldown: 450 },
  complete: { notes: [523.25, 659.25, 783.99], duration: .14, gain: .065, vibration: [16, 45, 24], cooldown: 900 }
});

export function createInteractionFeedback({
  storage = availableStorage(),
  audioFactory = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  },
  vibrate = typeof globalThis.navigator?.vibrate === 'function'
    ? (pattern) => globalThis.navigator.vibrate(pattern) : null,
  now = () => Date.now(),
  isQuiet = () => globalThis.document?.hidden === true,
  onCue = () => {}
} = {}) {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(FEEDBACK_STORAGE_KEY) || '{}') || {}; } catch { /* settings are optional */ }
  let sound = saved.sound === true;
  let haptics = saved.haptics === true;
  let volume = Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .35;
  let context = null;
  let generation = 0;
  let lastCueAt = -Infinity;
  const lastByKind = new Map();
  const nodes = new Set();

  function persist() {
    try { storage?.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify({ sound, haptics, volume })); } catch { /* in-memory settings still work */ }
  }

  function stop() {
    generation += 1;
    for (const node of nodes) {
      try { node.oscillator.stop(); node.oscillator.disconnect(); node.gain.disconnect(); } catch { /* already ended */ }
    }
    nodes.clear();
    if (vibrate && haptics) { try { vibrate(0); } catch { /* unsupported hardware */ } }
  }

  async function unlock() {
    if (!sound || volume === 0) return false;
    try {
      context ||= audioFactory();
      if (!context || context.state === 'closed') return false;
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running';
    } catch { return false; }
  }

  async function cue(kind = 'commit') {
    const spec = CUES[kind];
    const stamp = now();
    if (!spec || isQuiet() || (!sound && !haptics)
      || stamp - lastCueAt < 120 || stamp - (lastByKind.get(kind) ?? -Infinity) < spec.cooldown) return false;
    lastCueAt = stamp;
    lastByKind.set(kind, stamp);
    stop();
    const token = generation;
    let tactile = false;
    if (haptics && vibrate) {
      try { tactile = vibrate(spec.vibration) !== false; } catch { /* remain visual */ }
    }
    const ready = await unlock();
    if (token !== generation || isQuiet()) return false;
    let audible = false;
    if (ready && sound && volume > 0) {
      try {
        const start = context.currentTime;
        spec.notes.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const node = { oscillator, gain };
          const at = start + index * .065;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(.0001, at);
          gain.gain.exponentialRampToValueAtTime(spec.gain * volume, at + .009);
          gain.gain.exponentialRampToValueAtTime(.0001, at + spec.duration);
          oscillator.connect(gain).connect(context.destination);
          oscillator.onended = () => { nodes.delete(node); oscillator.disconnect(); gain.disconnect(); };
          nodes.add(node);
          oscillator.start(at);
          oscillator.stop(at + spec.duration + .02);
        });
        audible = true;
      } catch { stop(); }
    }
    onCue({ kind, audioScheduled: audible, vibrationRequested: tactile });
    return audible || tactile;
  }

  return {
    get settings() { return { sound, haptics, volume, hapticsSupported: Boolean(vibrate) }; },
    setSound(value) { sound = Boolean(value); if (!sound) stop(); persist(); },
    setHaptics(value) { if (!value) stop(); haptics = Boolean(value); persist(); },
    setVolume(value) { if (Number.isFinite(Number(value))) volume = Math.max(0, Math.min(1, Number(value))); stop(); persist(); },
    cue, unlock, stop
  };
}

export function mountFeedbackSettings({ root = document, feedback }) {
  const sound = root.querySelector('#physics-sound');
  const haptics = root.querySelector('#physics-haptics');
  const volume = root.querySelector('#feedback-volume');
  const summary = root.querySelector('#feedback-settings summary');
  const settingsPanel = root.querySelector('#feedback-settings');
  function render() {
    const settings = feedback.settings;
    sound.setAttribute('aria-pressed', String(settings.sound));
    sound.textContent = settings.sound ? 'Sound on' : 'Sound off';
    haptics.setAttribute('aria-pressed', String(settings.haptics));
    haptics.disabled = !settings.hapticsSupported;
    haptics.textContent = settings.hapticsSupported ? (settings.haptics ? 'Haptics on' : 'Haptics off') : 'Haptics unavailable';
    volume.value = String(Math.round(settings.volume * 100));
    volume.disabled = !settings.sound;
    summary.dataset.enabled = String(settings.sound || settings.haptics);
  }
  sound.addEventListener('click', () => { feedback.setSound(!feedback.settings.sound); render(); void feedback.cue('commit'); });
  haptics.addEventListener('click', () => { feedback.setHaptics(!feedback.settings.haptics); render(); void feedback.cue('commit'); });
  volume.addEventListener('input', () => feedback.setVolume(Number(volume.value) / 100));
  volume.addEventListener('change', () => { void feedback.cue('commit'); });
  settingsPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsPanel.open) {
      event.preventDefault();
      event.stopPropagation();
      settingsPanel.open = false;
      summary.focus();
    }
  });
  root.addEventListener('pointerdown', (event) => {
    if (settingsPanel.open && !settingsPanel.contains(event.target)) settingsPanel.open = false;
  });
  render();
}

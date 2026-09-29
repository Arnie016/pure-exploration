import { PERSONAS, ROSTER } from './catalog.mjs';

export function createPersona({ onCaption = () => {}, onStatus = () => {} } = {}) {
  const synthesis = globalThis.speechSynthesis;
  let enabled = false, unlocked = false, muted = false, lastSpoken = -Infinity;
  let captionTimer, disposed = false, voices = [], spoken = 0;
  const names = Object.fromEntries(ROSTER.map((fighter) => [fighter.id, fighter.name]));
  const status = () => ({ enabled, unlocked, muted, available: voices.length, spoken, localOnly: true });
  function refresh() {
    voices = synthesis ? synthesis.getVoices().filter((voice) => voice.localService === true && /^en(?:[-_]|$)/i.test(voice.lang)) : [];
    onStatus(status());
  }
  function cancel() {
    if (synthesis && unlocked) synthesis.cancel();
    clearTimeout(captionTimer); onCaption(null);
  }
  function speak(id, kind = 'intro', force = false) {
    if (disposed || !PERSONAS[id]?.[kind]) return false;
    const now = performance.now();
    if (!force && now - lastSpoken < 7000) return false;
    const persona = PERSONAS[id], text = persona[kind];
    lastSpoken = now;
    clearTimeout(captionTimer);
    onCaption({ id, name: names[id], text });
    captionTimer = setTimeout(() => onCaption(null), 4300);
    if (!enabled || !unlocked || muted || !voices.length || !synthesis || document.hidden) return true;
    // Never let the browser choose a default voice: it could be a remote service.
    const index = ROSTER.findIndex((fighter) => fighter.id === id);
    const voice = voices[index % voices.length];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang;
    utterance.pitch = persona.pitch; utterance.rate = persona.rate; utterance.volume = .75;
    synthesis.cancel(); synthesis.speak(utterance); spoken++;
    return true;
  }
  synthesis?.addEventListener('voiceschanged', refresh);
  refresh();
  return {
    speak, cancel, status,
    unlock() { unlocked = true; refresh(); },
    setEnabled(value) { enabled = value === true; if (!enabled) cancel(); refresh(); },
    setMuted(value) { muted = value === true; if (muted) cancel(); },
    dispose() { disposed = true; cancel(); synthesis?.removeEventListener('voiceschanged', refresh); },
  };
}

const KEY = 'skyline-swing-save-v1';

const DEFAULT = {
  best: 0,
  bank: 0,
  unlocked: ['volt'],
  skin: 'volt',
  custom: { hoodie: '#19d3b5', pants: '#2b2640', accent: '#ff9a2e' },
  look: null, // Hero Studio look (null = default)
  unlockedPresets: ['volt', 'blonde'],
  seenIntro: false,
  quality: 'high',
  music: true,
  sfx: true,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode / storage blocked: progress just won't persist.
  }
}

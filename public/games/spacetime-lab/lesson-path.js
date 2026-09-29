export const LESSON_ACTIONS = Object.freeze([
  'sol-selected',
  'alpha-selected',
  'tau-selected',
  'barycenter-adjusted',
  'field-compared',
  'voice-explained'
]);
export const LESSON_PATH_STORAGE_KEY = 'light-years-from-home.lesson-path.v10';

export function lessonProgress(actions = []) {
  let completed = 0;
  for (const action of LESSON_ACTIONS) {
    if (actions[completed] !== action) break;
    completed += 1;
  }
  return { completed, total: LESSON_ACTIONS.length, complete: completed === LESSON_ACTIONS.length };
}

export function lessonProgressTitle(progress, nextActionLabel) {
  if (progress.complete) return `Journey complete · ${progress.total} checkpoints`;
  return `${progress.completed} / ${progress.total} COMPLETE · ${nextActionLabel}`;
}

export function recordLessonAction(actions = [], action) {
  const progress = lessonProgress(actions);
  return action === LESSON_ACTIONS[progress.completed] ? [...actions.slice(0, progress.completed), action] : actions.slice(0, progress.completed);
}

export function sentenceCount(text = '') {
  const normalized = typeof text === 'string' ? text.trim() : '';
  if (!normalized) return 0;
  return normalized.split(/(?<=[.!?])\s+/u).filter(Boolean).length;
}

export function voiceExplanationQualifies({ learnerSpeechObserved = false, transcript = '' } = {}) {
  const sentences = sentenceCount(transcript);
  return learnerSpeechObserved && sentences > 0 && sentences <= 3;
}

export function readLessonPath(storage = globalThis.localStorage) {
  try {
    const actions = JSON.parse(storage.getItem(LESSON_PATH_STORAGE_KEY) || '[]');
    return Array.isArray(actions) ? lessonProgress(actions) : lessonProgress();
  } catch {
    return lessonProgress();
  }
}

export function saveLessonAction(action, storage = globalThis.localStorage) {
  try {
    const actions = JSON.parse(storage.getItem(LESSON_PATH_STORAGE_KEY) || '[]');
    const next = recordLessonAction(Array.isArray(actions) ? actions : [], action);
    storage.setItem(LESSON_PATH_STORAGE_KEY, JSON.stringify(next));
    return lessonProgress(next);
  } catch {
    return lessonProgress();
  }
}

export function resetLessonPath(storage = globalThis.localStorage) {
  try {
    storage.removeItem(LESSON_PATH_STORAGE_KEY);
  } catch {
    // Keep the path usable when storage is unavailable or blocked.
  }
  return lessonProgress();
}

export const PHYSICS_COURSE_STORAGE_KEY = 'light-years-from-home.physics-course.v1';

const QUESTION_HINTS = Object.freeze({
  'gravity-moon-fall': 'Imagine throwing a ball faster and faster sideways. What changes about where it lands?',
  'gravity-distance': 'Gravity weakens with distance squared. What is 2 squared?',
  'gravity-mass': 'More mass means a stronger pull, but also more resistance to acceleration. Consider both.',
  'force-turning': 'A car can turn at a steady speed. Has its velocity stayed the same?',
  'force-engine-off': 'What force would slow it down if there is no air and the engine is off?',
  'force-action-reaction': 'Both forces come from the same interaction. Mass changes acceleration, not the matching force.',
  'geodesic-weightless': 'What would push against your feet if you and the floor were falling together?',
  'geodesic-meaning': 'Think about a straight path measured locally, even when the larger geometry is curved.',
  'geodesic-elevator': 'You, the elevator and the ball start with the same motion and share the same gravity.',
  'energy-negative': 'We call the energy at infinite separation zero. How much energy must be added to reach it?',
  'energy-zero': 'Zero is exactly the boundary between an orbit that returns and one that escapes.',
  'energy-boost': 'The engine adds kinetic energy. Does adding energy make a negative total more or less negative?',
  'orbit-sideways': 'Going straight up eventually brings you back down. Which direction helps you miss the ground?',
  'orbit-periapsis': 'As the satellite falls closer to the planet, potential energy becomes kinetic energy.',
  'orbit-higher-period': 'A higher orbit has a longer path and a lower circular speed. What happens to the time?',
  'satellite-geostationary': 'To stay above one place, the satellite must match both Earth’s direction and rotation rate.',
  'satellite-drag': 'Removing energy makes a bound orbit’s energy more negative. Think about a smaller orbit.',
  'satellite-transfer': 'The burn happens at the near side. Look for the change it makes on the far side.'
});

export const PHYSICS_TOPICS = Object.freeze([
  Object.freeze({ id: 'gravity', label: 'Gravity' }),
  Object.freeze({ id: 'force', label: 'Force' }),
  Object.freeze({ id: 'geodesics', label: 'Geodesics' }),
  Object.freeze({ id: 'energy', label: 'Energy' }),
  Object.freeze({ id: 'orbits', label: 'Orbits' }),
  Object.freeze({ id: 'satellites', label: 'Satellites' })
]);

function question(id, topic, prompt, choices, correctIndex, explanation, lessonId, visual, voicePrompt) {
  return Object.freeze({
    id,
    topic,
    prompt,
    choices: Object.freeze(choices),
    correctIndex,
    explanation,
    hint: QUESTION_HINTS[id],
    lessonId,
    visual,
    voicePrompt
  });
}

export const PHYSICS_QUESTIONS = Object.freeze([
  question(
    'gravity-moon-fall', 'gravity', 'Why does the Moon keep missing Earth?',
    ['Gravity stops beyond the atmosphere', 'Its sideways motion carries it around Earth as it falls', 'Centrifugal force switches gravity off', 'The Moon has no weight'],
    1,
    'Gravity keeps pulling the Moon toward Earth. The Moon also moves sideways, so Earth’s curved surface falls away beneath its path. It keeps falling and keeps missing.',
    'barycenter', 'moon',
    'I chose an answer for why the Moon keeps missing Earth. Ask me to defend it, then correct only the weakest part of my model.'
  ),
  question(
    'gravity-distance', 'gravity', 'Move a satellite to twice its distance. How strong is gravity there?',
    ['Twice as strong', 'Half as strong', 'One quarter as strong', 'Unchanged'],
    2,
    'At twice the distance, gravity is 1 ÷ 2² as strong. That is one quarter of the original pull.',
    'stable-orbit', 'distance',
    'Help me reason through the inverse-square law without revealing the answer first. Use one tiny numerical example.'
  ),
  question(
    'gravity-mass', 'gravity', 'Double a satellite’s mass in the same ideal orbit. What changes first?',
    ['Its free-fall acceleration doubles', 'Its orbital path is almost unchanged', 'Gravity disappears', 'Its orbital period halves'],
    1,
    'Gravity pulls twice as hard, but the satellite also has twice the inertia. In the test-particle limit, the acceleration and orbit stay almost unchanged.',
    'barycenter', 'mass',
    'Ask me why doubling a satellite mass does not double its free-fall acceleration, then connect gravitational force to inertia.'
  ),
  question(
    'force-turning', 'force', 'A force points sideways to a moving object. What can it change?',
    ['Only its speed', 'Only its mass', 'Its direction, even if speed stays nearly constant', 'Nothing until it stops'],
    2,
    'Force changes velocity, and velocity includes direction. A nearly perpendicular force can continuously bend a path without doing much work.',
    'stable-orbit', 'force',
    'Make me distinguish speed from velocity using the orbit on screen. Keep the explanation under twenty seconds.'
  ),
  question(
    'force-engine-off', 'force', 'A spacecraft turns its engine off far from everything. What happens?',
    ['It stops immediately', 'It keeps its velocity until another force acts', 'It falls downward on the screen', 'It loses mass and slows'],
    1,
    'Motion does not need a sustaining force. A net force is needed to change velocity, not to keep an object moving.',
    'everyday-physics', 'coast',
    'Challenge my intuition about coasting in space. Ask one question that separates force from motion.'
  ),
  question(
    'force-action-reaction', 'force', 'Earth pulls on the Moon. Which force is larger?',
    ['Earth’s pull on the Moon', 'The Moon’s pull on Earth', 'They are equal and opposite', 'Whichever body moves faster'],
    2,
    'The interaction forces are equal and opposite. Their accelerations differ because Earth and Moon have different masses.',
    'barycenter', 'pair',
    'Ask me to reconcile equal forces with unequal accelerations in the Earth–Moon system.'
  ),
  question(
    'geodesic-weightless', 'geodesics', 'Why does an astronaut feel weightless while gravity is still strong?',
    ['The station blocks gravity', 'Everything nearby is freely falling together', 'Space has no mass', 'Their speed cancels gravity'],
    1,
    'The astronaut and station share free fall, so there is almost no support force pressing the astronaut against a floor.',
    'stable-orbit', 'geodesic',
    'Use the distinction between gravity and support force to explain orbital weightlessness. Ask me what a scale would read.'
  ),
  question(
    'geodesic-meaning', 'geodesics', 'In general relativity, a freely falling object follows…',
    ['The locally straightest path through curved spacetime', 'A path drawn by a hidden engine', 'Only a perfect circle', 'A route away from all mass'],
    0,
    'A freely falling object follows a geodesic: the locally straightest path through spacetime. The orbit simulation here uses Newtonian gravity.',
    'frame-lens-comparison', 'spacetime',
    'Explain a geodesic with no rubber-sheet cliché. Also state clearly that this on-screen laboratory is Newtonian.'
  ),
  question(
    'geodesic-elevator', 'geodesics', 'Inside a sealed, freely falling elevator, a released ball initially…',
    ['Floats beside you', 'Slams into the ceiling', 'Falls faster than the elevator', 'Stops having inertia'],
    0,
    'You and the ball share nearly the same free-fall path, so the ball floats relative to you until tidal differences become noticeable.',
    'everyday-physics', 'elevator',
    'Quiz me on the falling-elevator thought experiment, then introduce tidal effects in one sentence.'
  ),
  question(
    'energy-negative', 'energy', 'An orbit’s total mechanical energy is negative. What does that tell you?',
    ['The object has negative speed', 'The orbit is gravitationally bound', 'Gravity is repulsive', 'The object must be falling inward'],
    1,
    'With zero energy defined at infinite separation, negative total energy means the object lacks enough energy to escape.',
    'stable-orbit', 'energy-well',
    'Ask me to interpret negative orbital energy physically, not as a sign that speed is negative.'
  ),
  question(
    'energy-zero', 'energy', 'At exactly zero total orbital energy, the ideal escape path is…',
    ['Circular', 'Parabolic', 'Stationary', 'Always collisional'],
    1,
    'Zero total energy is just enough to escape. In an ideal two-body system, the path is a parabola and the speed approaches zero far away.',
    'everyday-physics', 'escape',
    'Guide me from bound negative energy to the zero-energy escape boundary without giving a formula first.'
  ),
  question(
    'energy-boost', 'energy', 'Give a circular-orbit satellite a small forward boost. Its total energy becomes…',
    ['More negative, with a smaller orbit', 'Less negative, with a larger orbit', 'Exactly zero every time', 'Unchanged because gravity is conservative'],
    1,
    'The boost adds kinetic energy. If it remains bound, the new orbit has greater semi-major axis and less-negative total energy.',
    'everyday-physics', 'boost',
    'Ask me to predict what a forward impulse does to orbital energy and the opposite side of the orbit.'
  ),
  question(
    'orbit-sideways', 'orbits', 'Which launch direction is most useful for entering orbit from a high point?',
    ['Straight down', 'Mostly sideways', 'Straight away from the planet at any speed', 'Direction never matters'],
    1,
    'Orbit needs enough sideways velocity that the object keeps missing the surface while gravity bends its trajectory.',
    'stable-orbit', 'launch',
    'Make me predict a launch direction before we run the stable-orbit experiment.'
  ),
  question(
    'orbit-periapsis', 'orbits', 'Where does a satellite move fastest in an elliptical orbit?',
    ['At apoapsis', 'At periapsis', 'At both ends equally', 'Speed is constant everywhere'],
    1,
    'The satellite moves fastest at periapsis. As it falls inward, gravitational potential energy becomes kinetic energy.',
    'stable-orbit', 'ellipse',
    'Ask me to connect periapsis speed to energy conservation and area sweeping.'
  ),
  question(
    'orbit-higher-period', 'orbits', 'Compared with a low circular orbit, a higher circular orbit takes…',
    ['Less time per revolution', 'More time per revolution', 'The same time', 'No predictable amount of time'],
    1,
    'A higher orbit is larger and moves more slowly, so its orbital period is longer.',
    'stable-orbit', 'period',
    'Help me explain why a higher circular orbit is slower yet takes longer, using one contrast.'
  ),
  question(
    'satellite-geostationary', 'satellites', 'A geostationary satellite must orbit…',
    ['Over the equator, eastward, once per sidereal day', 'Over either pole once per hour', 'Anywhere at escape speed', 'In a low retrograde circle'],
    0,
    'Matching Earth’s rotation requires a circular, equatorial, prograde orbit with the same rotational period.',
    'stable-orbit', 'geostationary',
    'Ask me to derive the three defining conditions for a geostationary orbit from what “stationary” means.'
  ),
  question(
    'satellite-drag', 'satellites', 'Atmospheric drag removes energy from a low satellite. Its orbit generally…',
    ['Grows higher', 'Decays lower', 'Becomes geostationary', 'Stops feeling gravity'],
    1,
    'Drag makes total energy more negative and lowers the orbit. Counterintuitively, the satellite can move faster after descending before further drag removes more energy.',
    'everyday-physics', 'drag',
    'Explain the counterintuitive part of orbital decay: losing energy can place a satellite in a faster lower orbit.'
  ),
  question(
    'satellite-transfer', 'satellites', 'For a two-burn transfer to a higher circular orbit, the first forward burn…',
    ['Raises the opposite side of the orbit', 'Lowers the opposite side', 'Makes the current point the apoapsis', 'Stops the satellite'],
    0,
    'A forward burn at the low point raises the far side. A second forward burn at the high point circularizes the orbit.',
    'everyday-physics', 'transfer',
    'Have me narrate a two-burn transfer using only “near side,” “far side,” and velocity arrows.'
  )
]);

export function physicsQuestionById(id) {
  return PHYSICS_QUESTIONS.find((entry) => entry.id === id) || null;
}

export function createPhysicsCourseState(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const index = Number.isInteger(input.index) ? Math.max(0, Math.min(PHYSICS_QUESTIONS.length - 1, input.index)) : 0;
  const answers = {};
  for (const [id, answer] of Object.entries(input.answers || {})) {
    const entry = physicsQuestionById(id);
    if (!entry || !Number.isInteger(answer?.choiceIndex) || answer.choiceIndex < 0 || answer.choiceIndex >= entry.choices.length) continue;
    answers[id] = {
      choiceIndex: answer.choiceIndex,
      correct: answer.choiceIndex === entry.correctIndex,
      attempts: [...new Set([...(Array.isArray(answer.attempts) ? answer.attempts : []), answer.choiceIndex])]
        .filter((value) => Number.isInteger(value) && value >= 0 && value < entry.choices.length)
    };
  }
  return { version: 1, index, answers };
}

export function answerPhysicsQuestion(state, questionId, choiceIndex) {
  const entry = physicsQuestionById(questionId);
  if (!entry || !Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= entry.choices.length) return state;
  if (state.answers[questionId]?.correct) return state;
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: {
        choiceIndex, correct: choiceIndex === entry.correctIndex,
        attempts: [...new Set([...(state.answers[questionId]?.attempts || []), choiceIndex])]
      }
    }
  };
}

export function physicsCourseProgress(state) {
  const values = Object.entries(state?.answers || {}).filter(([id]) => physicsQuestionById(id));
  return {
    answered: values.length,
    correct: values.filter(([, value]) => value?.correct === true).length,
    total: PHYSICS_QUESTIONS.length
  };
}

function readState(storage) {
  try {
    return createPhysicsCourseState(JSON.parse(storage?.getItem(PHYSICS_COURSE_STORAGE_KEY) || '{}'));
  } catch {
    return createPhysicsCourseState();
  }
}

function saveState(storage, state) {
  try { storage?.setItem(PHYSICS_COURSE_STORAGE_KEY, JSON.stringify(state)); } catch { /* local-only fallback */ }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, r);
}

function drawArrow(context, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(x2 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
  context.lineTo(x2 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawVisual(canvas, entry, phase = 0) {
  if (!canvas || !entry) return;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = Math.max(280, Math.round(canvas.clientWidth || 380));
  const height = Math.max(170, Math.round(canvas.clientHeight || 220));
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const context = canvas.getContext('2d');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#07151c');
  background.addColorStop(.48, '#0b1820');
  background.addColorStop(1, '#130f24');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = .55;
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 71 + 13) % width;
    const y = (index * 41 + 17) % height;
    context.fillStyle = index % 5 === 0 ? '#baf6dd' : '#b5cada';
    context.fillRect(x, y, index % 7 === 0 ? 1.5 : 1, index % 7 === 0 ? 1.5 : 1);
  }
  context.globalAlpha = 1;

  const cx = width * .5;
  const cy = height * .51;
  const pulse = Math.sin(phase) * 2;
  const orbitColor = 'rgba(154, 225, 194, .48)';
  const accent = '#9ae1c2';
  const warm = '#f1bd77';

  if (['moon', 'distance', 'mass', 'pair', 'period', 'ellipse', 'geostationary'].includes(entry.visual)) {
    const orbitX = entry.visual === 'ellipse' ? width * .31 : width * .27;
    const orbitY = entry.visual === 'geostationary' ? height * .34 : height * .27;
    context.strokeStyle = orbitColor;
    context.lineWidth = 1.5;
    context.setLineDash([5, 7]);
    context.beginPath();
    context.ellipse(cx, cy, orbitX, orbitY, -.12, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    const planetGlow = context.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 42);
    planetGlow.addColorStop(0, '#d4f8ff');
    planetGlow.addColorStop(.35, '#6ca7be');
    planetGlow.addColorStop(1, '#193b4c');
    context.fillStyle = planetGlow;
    context.beginPath();
    context.arc(cx, cy, 32 + pulse * .15, 0, Math.PI * 2);
    context.fill();
    const theta = entry.visual === 'moon' ? phase * .18 - .5 : -.68;
    const sx = cx + Math.cos(theta) * orbitX;
    const sy = cy + Math.sin(theta) * orbitY;
    context.fillStyle = '#e7e1d6';
    context.shadowColor = accent;
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(sx, sy, 7, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    if (entry.visual === 'distance') {
      drawArrow(context, cx + 42, cy - 42, sx - 10, sy + 5, warm);
      context.fillStyle = warm;
      context.font = '600 10px ui-monospace, monospace';
      context.fillText('2r', (cx + sx) / 2, (cy + sy) / 2 - 10);
    }
    if (entry.visual === 'pair' || entry.visual === 'mass') {
      drawArrow(context, sx - 12, sy, cx + 38, cy, accent);
      drawArrow(context, cx + 38, cy + 12, sx - 12, sy + 12, warm);
    }
  } else if (['force', 'coast', 'launch', 'boost', 'transfer', 'drag'].includes(entry.visual)) {
    context.strokeStyle = 'rgba(154,225,194,.32)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(cx - 80, cy + 25, 40, 0, Math.PI * 2);
    context.stroke();
    const shipX = cx + 55 + Math.sin(phase * .25) * 8;
    const shipY = cy - 18;
    context.fillStyle = '#e7edf1';
    roundedRect(context, shipX - 19, shipY - 7, 38, 14, 7);
    context.fill();
    context.fillStyle = '#85bdd0';
    context.beginPath();
    context.moveTo(shipX + 12, shipY - 6);
    context.lineTo(shipX + 26, shipY);
    context.lineTo(shipX + 12, shipY + 6);
    context.closePath();
    context.fill();
    drawArrow(context, shipX, shipY - 18, shipX + 72, shipY - 18, warm);
    if (entry.visual === 'force' || entry.visual === 'launch') drawArrow(context, shipX, shipY + 17, shipX, shipY + 68, accent);
    if (entry.visual === 'boost' || entry.visual === 'transfer') {
      context.fillStyle = '#f38d63';
      context.beginPath();
      context.moveTo(shipX - 20, shipY - 4);
      context.lineTo(shipX - 38 - pulse, shipY);
      context.lineTo(shipX - 20, shipY + 4);
      context.fill();
    }
  } else if (['geodesic', 'spacetime', 'elevator'].includes(entry.visual)) {
    context.strokeStyle = 'rgba(145,177,222,.26)';
    context.lineWidth = 1;
    for (let row = -3; row <= 3; row += 1) {
      context.beginPath();
      for (let column = -6; column <= 6; column += 1) {
        const x = cx + column * 28;
        const bend = 20 * Math.exp(-Math.abs(column) / 2.6) * (1 - Math.abs(row) / 5);
        const y = cy + row * 23 + bend;
        if (column === -6) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.strokeStyle = accent;
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(cx - 150, cy - 54);
    context.bezierCurveTo(cx - 45, cy - 48, cx - 28, cy + 43, cx + 150, cy + 25);
    context.stroke();
    context.fillStyle = warm;
    context.shadowColor = warm;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(cx - 150 + ((phase * 8) % 300), cy - 54 + Math.sin(phase * .8) * 4, 5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  } else {
    const well = context.createRadialGradient(cx, cy + 18, 4, cx, cy + 18, width * .34);
    well.addColorStop(0, 'rgba(95,65,133,.78)');
    well.addColorStop(.35, 'rgba(43,52,93,.42)');
    well.addColorStop(1, 'rgba(7,21,28,0)');
    context.fillStyle = well;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(170,139,220,.42)';
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.ellipse(cx, cy + 18, 32 + index * 23, 12 + index * 8, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = accent;
    context.beginPath();
    context.arc(cx + 82, cy - 21 + pulse, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#b9a2dc';
    context.font = '600 12px ui-monospace, monospace';
    context.fillText(entry.visual === 'escape' ? 'E = 0' : 'E < 0', 22, 29);
  }

  const topic = PHYSICS_TOPICS.find((item) => item.id === entry.topic)?.label || entry.topic;
  context.fillStyle = 'rgba(230,240,243,.72)';
  context.font = '600 9px ui-monospace, monospace';
  context.letterSpacing = '1px';
  context.fillText(topic.toUpperCase(), 18, height - 18);
}

export function mountPhysicsCourse({
  root = document,
  storage = globalThis.localStorage,
  onRunLesson = () => {},
  onAskVoice = () => {},
  onMessage = () => {},
  interactionFeedback = { cue() {} }
} = {}) {
  const course = root.querySelector('#physics-course');
  if (!course) return null;
  const visual = root.querySelector('#physics-prompt-canvas');
  const prompt = root.querySelector('#physics-prompt');
  const options = root.querySelector('#physics-options');
  const feedback = root.querySelector('#physics-feedback');
  const next = root.querySelector('#physics-next');
  const run = root.querySelector('#physics-run');
  const ask = root.querySelector('#physics-ask');
  const actions = root.querySelector('#physics-actions');
  const progressText = root.querySelector('#physics-progress');
  const topicSelect = root.querySelector('#physics-topic-select');
  const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let state = readState(storage);
  let animationFrame = null;
  let phase = 0;

  function currentQuestion() {
    return PHYSICS_QUESTIONS[state.index];
  }

  function animate() {
    animationFrame = null;
    if (course.hidden || root.hidden || course.closest('[aria-hidden="true"]')) return;
    drawVisual(visual, currentQuestion(), phase);
    if (!motionQuery?.matches) {
      phase += .025;
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function resetAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    phase = 0;
    animate();
  }

  function render() {
    const entry = currentQuestion();
    const answer = state.answers[entry.id];
    const progress = physicsCourseProgress(state);
    course.dataset.questionId = entry.id;
    course.dataset.topic = entry.topic;
    course.dataset.answered = String(Boolean(answer?.correct));
    visual.setAttribute('aria-label', `Animated visual prompt for ${entry.prompt}`);
    prompt.textContent = entry.prompt;
    progressText.textContent = `${progress.correct} / ${progress.total}`;
    topicSelect.value = entry.topic;
    options.replaceChildren();
    entry.choices.forEach((choice, choiceIndex) => {
      const button = root.createElement('button');
      button.type = 'button';
      button.className = 'physics-option';
      button.dataset.choiceIndex = String(choiceIndex);
      button.innerHTML = `<span>${String.fromCharCode(65 + choiceIndex)}</span><strong></strong>`;
      button.querySelector('strong').textContent = choice;
      if (answer) {
        const tried = (answer.attempts || [answer.choiceIndex]).includes(choiceIndex);
        button.disabled = answer.correct || tried;
        button.classList.toggle('is-correct', answer.correct && choiceIndex === entry.correctIndex);
        button.classList.toggle('is-wrong', !answer.correct && tried);
        if (answer.correct && choiceIndex === entry.correctIndex) button.querySelector('span').textContent = '✓';
        if (!answer.correct && tried) button.querySelector('span').textContent = '×';
      }
      button.addEventListener('click', () => {
        state = answerPhysicsQuestion(state, entry.id, choiceIndex);
        saveState(storage, state);
        const completed = physicsCourseProgress(state).correct === PHYSICS_QUESTIONS.length;
        void interactionFeedback.cue(choiceIndex === entry.correctIndex ? (completed ? 'complete' : 'correct') : 'retry');
        render();
        feedback.scrollIntoView?.({ behavior: motionQuery?.matches ? 'auto' : 'smooth', block: 'nearest' });
        if (choiceIndex === entry.correctIndex) next.focus({ preventScroll: true });
        else options.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      });
      options.append(button);
    });
    feedback.hidden = !answer;
    feedback.classList.toggle('is-correct', Boolean(answer?.correct));
    feedback.querySelector('strong').textContent = answer?.correct
      ? (progress.correct === progress.total ? 'All 18 ideas explored.' : 'That’s the idea.') : 'Give it another try.';
    feedback.querySelector('p').textContent = answer ? (answer.correct ? entry.explanation : entry.hint) : '';
    actions.hidden = !answer;
    next.hidden = !answer?.correct;
    next.textContent = state.index === PHYSICS_QUESTIONS.length - 1 ? 'Keep exploring →' : 'Next question →';
    ask.disabled = !answer;
    run.disabled = !answer;
    resetAnimation();
  }

  next.addEventListener('click', () => {
    const remaining = PHYSICS_QUESTIONS.findIndex((entry, index) => index > state.index && !state.answers[entry.id]?.correct);
    const earlier = PHYSICS_QUESTIONS.findIndex((entry) => !state.answers[entry.id]?.correct);
    state = { ...state, index: remaining >= 0 ? remaining : earlier >= 0 ? earlier : (state.index + 1) % PHYSICS_QUESTIONS.length };
    saveState(storage, state);
    render();
    course.closest('.scientist-lesson')?.scrollTo({ top: 0, behavior: 'instant' });
    prompt.focus({ preventScroll: true });
  });
  run.addEventListener('click', () => {
    void interactionFeedback.cue('commit');
    onRunLesson(currentQuestion().lessonId, currentQuestion());
  });
  ask.addEventListener('click', () => onAskVoice(currentQuestion()));
  topicSelect.addEventListener('change', () => {
    const index = PHYSICS_QUESTIONS.findIndex((entry) => entry.topic === topicSelect.value);
    if (index < 0) return;
    state = { ...state, index };
    saveState(storage, state);
    render();
  });
  motionQuery?.addEventListener?.('change', resetAnimation);
  globalThis.addEventListener?.('resize', resetAnimation);
  root.addEventListener?.('visibilitychange', resetAnimation);
  if (globalThis.MutationObserver) {
    const observer = new MutationObserver(resetAnimation);
    observer.observe(course, { attributes: true, attributeFilter: ['hidden'] });
    const panel = course.closest('.scientist-lesson');
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
  render();
  onMessage('Choose one answer. Then test the idea in the simulation.');

  return {
    get question() { return currentQuestion(); },
    get state() { return state; },
    openQuestion(id) {
      const index = PHYSICS_QUESTIONS.findIndex((entry) => entry.id === id);
      if (index < 0) return false;
      state = { ...state, index };
      saveState(storage, state);
      render();
      return true;
    },
    refresh: render
  };
}

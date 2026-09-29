import {
  AU_M,
  C_M_S,
  DAY_S,
  NBodySystem,
  REFERENCE_MASS_KG,
  createSunEarthMoonPreset
} from './sim/nbody.js';
import { createHorizonsSolarSystemPreset } from './sim/solar-system-preset.js';
import { createFigureEightThreeBodyPreset } from './sim/three-body-presets.js';
import {
  OBJECT_PRESETS,
  createBlackHoleLensingPreset,
  createBlankCanvasPreset,
  createCompactBinaryInspiralPreset,
  createMiniGalaxySwirlPreset,
  createCircumbinaryPreset,
  createCometSweepPreset,
  createNeutronStarBinaryPreset,
  createEqualBinaryPreset,
  createHotJupiterPreset,
  createLagrangeTrianglePreset,
  createResonantChainPreset,
  createTiltedSystemPreset,
  createWorldCollisionPreset,
  droppedBodyRecord,
  minimumDropSeparationM
} from './sim/editor-presets.js';
import {
  darkMatterPreset,
  darkMatterModeComparison,
  dipoleFieldLines,
  gravityAccelerationBreakdown,
  gravityAccelerationField,
  compactBinaryInspiralGridRipple,
  lightWaveReadout,
  magneticPreset,
  seasonSnapshot,
  schwarzschildLightPath,
  weakFieldLightPath
} from './sim/experiments.js';
import { createSolarRenderer } from './scene/solar-renderer.js';
import { lessonProgressTitle, readLessonPath, resetLessonPath, saveLessonAction, voiceExplanationQualifies } from './lesson-path.js';
import { advanceVoiceReceipt, createVoiceReceipt, serializeVoiceReceipt } from './voice-receipt.js';
import {
  SYSTEM_WORKSPACE_LIMIT,
  activeSystemDocument,
  addSystemDocument,
  createSystemDocument,
  createSystemWorkspace,
  parseSystemWorkspace,
  replaceActiveSystemState,
  serializeSystemWorkspace,
  switchSystemDocument
} from './sim/system-workspace.js';
import { barycentricSystemView, cameraCenterInWorld } from './sim/view-fit.js';
import { rocketPositionBetween, simultaneityPlayback, simultaneitySnapshot } from './sim/relativity-experiment.js';
import { SCIENTIST_LESSONS, lessonVariableUnlockStep, mountScientistLesson } from './scientist-lesson.js';
import { mountPhysicsCourse } from './physics-course.js';
import { appendTrajectoryPoint, trimTrajectory } from './sim/trajectory-buffer.js';
import { createTrajectoryPreview } from './sim/trajectory-preview.js';
import { circularOrbitEdit, createBodyMove, recommendedOrbitStep } from './sim/orbit-edit.js';
import { planPlaybackFrame } from './sim/playback-budget.js';
import { mountLabShell } from './lab-shell.js';
import { createInteractionFeedback, mountFeedbackSettings } from './interaction-feedback.js';
import { renderLessonRelationship } from './lesson-relationships.js';

const developerMode = new URLSearchParams(window.location.search).get('dev') === '1';
document.documentElement.dataset.developerMode = developerMode ? 'true' : 'false';

const canvas = document.querySelector('#lab-canvas');
const context = canvas.getContext('2d', { alpha: true });
const laboratory = document.querySelector('.laboratory');
const solarRenderer = createSolarRenderer(document.querySelector('#space-canvas'));
const inspector = document.querySelector('#inspector');
const experimentCard = document.querySelector('#experiment-card');
const guideCard = document.querySelector('#guide-card');
const guideToggle = document.querySelector('#guide-toggle');
const guideQuestion = document.querySelector('#guide-question');
const voicePreflight = document.querySelector('#voice-preflight');
const voiceToggle = document.querySelector('#voice-toggle');
const voiceInterrupt = document.querySelector('#voice-interrupt');
const voiceStatus = document.querySelector('#voice-status');
const voiceReceiptElement = document.querySelector('#voice-receipt');
const copyVoiceReceiptButton = document.querySelector('#copy-voice-receipt');
const contentDrawer = document.querySelector('#content-drawer');
const workspaceStrip = document.querySelector('#workspace-strip');
const orientationGizmo = document.querySelector('#orientation-gizmo');
const orientationContext = orientationGizmo.getContext('2d');
const timeWarp = document.querySelector('#time-warp');
const massScale = document.querySelector('#mass-scale');
const massLessonTarget = document.querySelector('#mass-lesson-target');
const tiltControl = document.querySelector('#tilt-control');
const impulseMagnitude = document.querySelector('#impulse-magnitude');
const impulseOutput = document.querySelector('#impulse-output');
const impulseClearVelocity = document.querySelector('#impulse-clear-velocity');
const trails = new Map();
let persistentTrails = true;

let system = createHorizonsSolarSystemPreset({ stepSeconds: 1_800 });
let scenarioMode = 'jpl-system';
let selectedId = null;
let selectedBaseMassKg = 1;
let selectedBaseRadiusM = 1;
let running = true;
let daysPerSecond = 30;
let stepAccumulator = 0;
let pendingStepSeconds = 0;
let playbackLimited = false;
let previewEnabled = false;
let trajectoryPreview = null;
let previewSignature = '';
let bodyMove = null;
let lastFrameTime = null;
let lastTrailTime = -Infinity;
let scaleMode = 'system';
let returnScaleMode = 'system';
let scenarioWidthM = null;
let focusedId = null;
let approachOrigin = null;
let spawnCounter = 0;
let toastTimer = null;
let activeExperiment = null;
let fieldLayer = 'gravity';
let magneticMode = 'earth-like';
let darkMatterMode = 'none';
let lightImpactRadii = 1;
let lightVisualExaggeration = 10_000;
let lightLensId = null;
let scientistTutorial = null;
let physicsCourse = null;
let scientistTargetId = null;
let scientistMotionStartSeconds = null;
let scientistControlState = { lessonId: null, orbit: null, collision: null, values: {} };
let sceneViewport = { width: innerWidth, height: innerHeight };
let lightPulsePhase = 0;
let relativityVelocityFraction = .1;
let relativityPhase = 0;
let relativityWizardStep = 0;
let relativityShowSignalTravel = false;
const RELATIVITY_EVENT_IDS = Object.freeze({
  a: 'a',
  b: 'b'
});
const RELATIVITY_WIZARD_STEPS = Object.freeze(['setup', 'sun-frame', 'launch', 'rocket-frame', 'compare']);
const RELATIVITY_DEFAULT_EVENTS = Object.freeze({
  a: {
    label: 'EVENT A',
    name: 'Event A flash',
    equation: "t'_{A} = \\gamma(t_A - vx_A/c^2)",
    note: 'flash #1'
  },
  b: {
    label: 'EVENT B',
    name: 'Event B flash',
    equation: "t'_{B} = \\gamma(t_B - vx_B/c^2)",
    note: 'flash #2'
  }
});
let relativityPlacementTarget = null;
let relativityRocketBodyId = null;
let relativityActiveFrame = 'sun';
let relativityFrameCenterM = null;
let relativityFrameWidthM = null;
const RELATIVITY_FRAME_OPTIONS = Object.freeze({
  sun: 'Sun frame',
  rocket: 'Rocket frame',
  a: 'Event A frame',
  b: 'Event B frame'
});
let relativityEvents = {
  a: null,
  b: null
};
let seasonPhaseOverrideRad = null;
let voicePeer = null;
let voiceStream = null;
let voiceChannel = null;
let voiceStarting = false;
let voiceClosing = false;
let voiceCloseTimer = null;
let voiceTranscriptTimer = null;
let voiceResponseActive = false;
let voiceLearnerSpeechObserved = false;
let voiceInputTranscript = '';
let voiceOutputTranscript = '';
let voiceInputCaption = null;
let voiceOutputCaption = null;
let voicePendingModel = 'gpt-live-1';
let voiceInterruptEventId = null;
let voiceInterruptionCountedForOutput = false;
let voiceReceipt = null;
const lessonFieldLayersSeen = new Set();
const CAMERA_VIEWS = Object.freeze({
  eye: Object.freeze({ yaw: 0, tilt: 1.32, zoom: .72 }),
  orbit: Object.freeze({ yaw: -.55, tilt: .72, zoom: 1 }),
  ecliptic: Object.freeze({ yaw: -.42, tilt: 1.515, zoom: .9 }),
  top: Object.freeze({ yaw: 0, tilt: .015, zoom: 1 })
});
let cameraMode = 'eye';
let cameraOrbit = { ...CAMERA_VIEWS.eye };
let cameraTargetId = null;
let frameReferenceMode = 'barycentric';
let frameReferenceAnchor = [0, 0, 0];
let cameraDrag = null;
let orientationDrag = null;
let draggingPresetId = null;
let contentPointerDrag = null;
let suppressContentClick = false;
const TIME_WARP_VALUES = [.01, .1, 1, 10, 30, 90, 365, 1825];
const MAX_STEPS_PER_ANIMATION_TICK = 240;
const PLACEMENT_PROTECTION_FRAMES = Math.max(120, Math.ceil(MAX_STEPS_PER_ANIMATION_TICK * 2.5));
let bodySelectSignature = '';
const SYSTEM_WORKSPACE_STORAGE_KEY = 'light-years-from-home.system-workspace.v1';
const THOUGHT_NOTE_STORAGE_KEY = 'light-years-from-home.thought-notes.v2';
let systemWorkspace = null;
let drawerMode = 'objects';
const systemBuildJobs = new Map();
let resetWorkspaceArmedUntil = 0;
let resetWorkspaceTimer = null;
let thoughtNoteStore = null;

function setTimeWarp(value, { announce = true } = {}) {
  const next = Number(value);
  if (!TIME_WARP_VALUES.includes(next)) return;
  daysPerSecond = next;
  stepAccumulator = 0;
  timeWarp.value = String(next);
  if (announce) showToast(`Time flow set to ${timeWarp.selectedOptions[0].textContent}. Physics stays on the fixed integration step.`);
}

function nudgeTimeWarp(direction) {
  const currentIndex = Math.max(0, TIME_WARP_VALUES.indexOf(daysPerSecond));
  const nextIndex = Math.max(0, Math.min(TIME_WARP_VALUES.length - 1, currentIndex + direction));
  setTimeWarp(TIME_WARP_VALUES[nextIndex]);
}
let placementPresetId = null;
let placementResumeState = null;
let undoStack = [];
let massHistoryState = null;
let tiltHistoryState = null;
let velocityHistoryState = null;
let visualRadiusMode = 'readable';
let labelBounds = [];
let collisionEffects = [];
let processedCollisionEvents = new Set();
let lastCollisionEvent = null;

function renderLessonPath(progress = readLessonPath()) {
  const returningToAtlas = progress.completed < 3;
  const [nextActionLabel, copy] = progress.complete
    ? ['Journey complete', '6 / 6 actions recorded: atlas scale, tracked barycenter, force-layer comparison, and grounded Realtime explanation.']
    : returningToAtlas
      ? [
          ['Find Sol', 'Compare Alpha Centauri', 'Compare Tau Ceti'][progress.completed],
          'Select Sol, Alpha Centauri, and Tau Ceti before entering the laboratory.'
        ]
      : [
          ['Change Moon mass', 'Compare force layers', 'Ask the live guide'][progress.completed - 3],
          [
            'Moon is selected and tracked. Choose any non-default mass to move the shared balance point.',
            'Open Field. Observe computed Newtonian gravity, then switch to the labelled magnetic dipole toy model.',
            'Open the tutor and explain what you expect to happen in one short sentence.'
          ][progress.completed - 3]
        ];
  const title = lessonProgressTitle(progress, nextActionLabel);
  const path = document.querySelector('#lesson-path');
  const returnLink = document.querySelector('#lesson-path-return');
  const returnLabel = document.querySelector('#lesson-path-return-label');
  const restartButton = document.querySelector('#lesson-path-restart');
  path.dataset.complete = String(progress.complete);
  document.querySelector('#lesson-path-title').textContent = title;
  document.querySelector('#lesson-path-copy').textContent = copy;
  returnLabel.textContent = progress.completed === 0
    ? 'Return to atlas · find Sol'
    : progress.completed === 1
      ? 'Return to atlas · compare Alpha Centauri'
      : 'Return to atlas · compare Tau Ceti';
  returnLink.hidden = !returningToAtlas;
  restartButton.hidden = progress.completed === 0;
}

function recordBarycenterLessonAction(multiplier) {
  if (selectedId === 'moon' && multiplier !== 1) {
    if (readLessonPath().completed === 3) lessonFieldLayersSeen.clear();
    renderLessonPath(saveLessonAction('barycenter-adjusted'));
  }
}

function recordFieldLessonLayer(layer) {
  lessonFieldLayersSeen.add(layer);
  if (lessonFieldLayersSeen.has('gravity') && lessonFieldLayersSeen.has('magnetic')) {
    renderLessonPath(saveLessonAction('field-compared'));
  }
}

renderLessonPath();

document.querySelector('#lesson-path-restart').addEventListener('click', () => {
  renderLessonPath(resetLessonPath());
});

const views = {
  system: { center: [0, 0, 0], widthM: AU_M * 64, kicker: 'JPL SYSTEM FRAME', label: '64 AU WIDE' },
  solar: { center: [0, 0, 0], widthM: AU_M * 4.2, kicker: 'INNER PLANETS', label: '4.20 AU WIDE' },
  lunar: { center: null, widthM: 1_100_000_000, kicker: 'EARTH–MOON FRAME', label: '1.10 MILLION KM WIDE' }
};

const scenarioDefinitions = Object.freeze({
  'jpl-system': {
    create: () => createHorizonsSolarSystemPreset({ stepSeconds: 1_800 }),
    scaleMode: 'system',
    note: 'JPL DE441 INITIAL STATE · NEWTONIAN LIVE PROPAGATION · OSCULATING PATHS DERIVED · BODY RADII EXAGGERATED',
    toast: 'Pinned JPL Sun, Moon, and eight-planet state loaded.'
  },
  'sun-earth-moon': {
    create: () => createSunEarthMoonPreset({ stepSeconds: 3_600 }),
    scaleMode: 'solar',
    note: 'CANONICAL SUN–EARTH–MOON · BARYCENTRIC NEWTONIAN PRESET · BODY RADII EXAGGERATED',
    toast: 'Canonical Sun–Earth–Moon laboratory loaded.'
  },
  'figure-eight': {
    create: () => createFigureEightThreeBodyPreset({ stepSeconds: 1_800 }),
    scaleMode: 'solar',
    note: 'COMPUTED THREE-BODY CHOREOGRAPHY · EQUAL SOLAR MASSES · SCALED CHENCINER–MONTGOMERY INITIAL CONDITIONS',
    toast: 'Three equal stars now chase one another on a computed figure-eight choreography.'
  },
  'blank-canvas': {
    create: () => createBlankCanvasPreset(), scaleMode: 'solar',
    note: 'BLANK EDITOR CANVAS · ADD A STAR FIRST FOR COMPUTED CIRCULAR DROP VELOCITIES',
    toast: 'Blank live canvas ready. Open Content and drop a star onto the grid.'
  },
  'equal-binary': {
    create: () => createEqualBinaryPreset(), scaleMode: 'solar',
    note: 'HYPOTHETICAL EQUAL-MASS BINARY · BARYCENTRIC NEWTONIAN INITIAL STATE',
    toast: 'Equal-mass binary loaded live.'
  },
  circumbinary: {
    create: () => createCircumbinaryPreset(), scaleMode: 'solar',
    note: 'HYPOTHETICAL CIRCUMBINARY PLANET · COMPUTED NEWTONIAN INITIAL VELOCITIES',
    toast: 'Circumbinary teaching system loaded live.'
  },
  'lagrange-triangle': {
    create: () => createLagrangeTrianglePreset(), scaleMode: 'solar',
    note: 'HYPOTHETICAL LAGRANGE EQUILATERAL SOLUTION · THREE EQUAL NEWTONIAN MASSES',
    toast: 'Equilateral three-star solution loaded live.'
  },
  'tilted-system': {
    create: () => createTiltedSystemPreset(), scaleMode: 'solar',
    note: 'HYPOTHETICAL 3D ORBITAL PLANES · 0°, 18°, AND 35° INCLINATIONS',
    toast: 'Tilted orbital-plane comparison loaded live.'
  },
  'hot-jupiter': {
    create: () => createHotJupiterPreset(), scaleMode: 'solar', widthM: AU_M * .24,
    note: 'HYPOTHETICAL HOT JUPITER · 0.047 AU CIRCULAR NEWTONIAN START',
    toast: 'Hot-Jupiter teaching system loaded live.'
  },
  'neutron-binary': {
    create: () => createNeutronStarBinaryPreset(), scaleMode: 'solar',
    widthM: AU_M * 0.16,
    note: 'NEUTRON STAR BINARY · EXTREME MASS WITH CIRCULAR CLOSER-ORBIT START',
    toast: 'Neutron-star toy binary loaded. Compare curvature speed and period changes vs equal-star binary.'
  },
  'mini-galaxy-swarm': {
    create: () => createMiniGalaxySwirlPreset(), scaleMode: 'system', widthM: AU_M * 2,
    note: 'MINI GALAXY SWIRL · COMPACT ROTATION + TANGENTAL ORBITS ABOUT A CORE MASS',
    toast: 'Mini galaxy swirl loaded. Observe frame evolution across nested orbital planes.'
  },
  'resonant-chain': {
    create: () => createResonantChainPreset(), scaleMode: 'solar',
    note: 'HYPOTHETICAL 1:2:4:8 PERIOD CHAIN · CIRCULAR NEWTONIAN STARTS',
    toast: 'Resonant-chain teaching system loaded live.'
  },
  'comet-sweep': {
    create: () => createCometSweepPreset(), scaleMode: 'solar', widthM: AU_M * 11,
    note: 'HYPOTHETICAL MASSLESS COMET · VIS-VIVA APHELION START · NEWTONIAN PROPAGATION',
    toast: 'Comet perihelion sweep loaded live.'
  },
  'world-collision': {
    create: () => createWorldCollisionPreset(), scaleMode: 'solar', widthM: AU_M * .0013,
    startRunning: false, daysPerSecond: .01, frameKicker: 'WORLD COLLISION',
    note: 'WORLD COLLISION · COMPUTED MASS + MOMENTUM MERGE · ILLUSTRATIVE FLASH + DEBRIS · NO HYDRODYNAMICS',
    toast: 'World collision ready and paused. Run to observe a computed merge with illustrative impact cues.'
  },
  'black-hole-lensing': {
    create: () => createBlackHoleLensingPreset(), scaleMode: 'solar',
    widthM: OBJECT_PRESETS['black-hole'].radiusM * 80,
    startRunning: false, frameKicker: 'BLACK HOLE LIGHT LAB', daysPerSecond: .01,
    note: '10 M☉ BLACK HOLE · NEWTONIAN BODY MOTION · SCHWARZSCHILD LIGHT GEODESIC · ILLUSTRATIVE DISK + PHOTON RING',
    toast: 'Black-hole light lab ready and paused. Open Light path, then emit a signal.'
  },
  'compact-binary-inspiral': {
    create: () => createCompactBinaryInspiralPreset(), scaleMode: 'solar',
    widthM: AU_M * 0.21,
    note: 'NEWTONIAN COMPACT-MASS BINARY · GRAVITATIONAL-WAVE GRID RIPPLES · ILLUSTRATIVE/TOY',
    toast: 'Compact-binary inspiral demonstrator loaded. Open Light for an illustrative grid-ripple overlay.'
  }
});
let renderedView = { center: [...views.system.center], widthM: views.system.widthM };

function dedupeScenarioOptions() {
  const options = [...document.querySelectorAll('#scenario-select option')];
  const seen = new Set();
  for (const option of options) {
    const key = `${option.value}::${option.textContent.trim()}`;
    if (seen.has(key)) option.remove();
    else seen.add(key);
  }
}

dedupeScenarioOptions();


function showToast(message) {
  // Guided lessons explain actions inline; do not stack editor receipts on top.
  if (!developerMode && document.querySelector('#scientist-lesson')?.classList.contains('is-open')) return;
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function defaultFrameReferenceAnchor() {
  const fit = barycentricSystemView(system.bodies, {
    minimumWidthM: 1,
    maximumWidthM: Number.POSITIVE_INFINITY,
    singleBodyRadiusMultiplier: 1
  });
  if (fit?.center && fit.center.every((axis) => Number.isFinite(axis))) return fit.center;
  return [0, 0, 0];
}

function setFrameReferenceAnchor(anchor = defaultFrameReferenceAnchor()) {
  frameReferenceAnchor = [...anchor];
}

function setFrameReferenceMode(mode, { announce = true } = {}) {
  const nextMode = mode === 'galactocentric' || mode === 'heliocentric' || mode === 'barycentric'
    ? mode
    : 'barycentric';
  if (nextMode === frameReferenceMode) {
    document.querySelector('#frame-reference-select').value = frameReferenceMode;
    return;
  }
  frameReferenceMode = nextMode;
  if (frameReferenceMode === 'galactocentric') setFrameReferenceAnchor();
  if (announce) {
    const message = nextMode === 'barycentric'
      ? 'Frame set to live barycentric reference. Center follows mass distribution.'
      : nextMode === 'heliocentric'
        ? 'Frame set to heliocentric reference. Sun is held fixed as the origin.'
        : 'Frame set to galactocentric-style inertial reference. Origin is fixed after setup.';
    showToast(message);
  }
  updateReadouts();
}

function captureEditorState(label) {
  const snapshot = system.snapshot();
  return {
    label,
    scenarioMode,
    bodies: snapshot.bodies,
    timeSeconds: snapshot.timeSeconds,
    stepSeconds: snapshot.stepSeconds,
    collisionMode: system.collisionMode,
    uniformDensityKgM3: snapshot.fields.uniformDensityKgM3,
    uniformDensityOriginM: snapshot.fields.uniformDensityOriginM,
    running,
    daysPerSecond,
    scaleMode,
    returnScaleMode,
    scenarioWidthM,
    selectedId,
    cameraTargetId,
    cameraMode,
    cameraOrbit: { ...cameraOrbit },
    frameReferenceMode,
    frameReferenceAnchor: [...frameReferenceAnchor]
  };
}

function pushUndoState(state) {
  undoStack.push(state);
  if (undoStack.length > 24) undoStack.shift();
  document.querySelector('#undo-edit').disabled = false;
}

function pushUndo(label) {
  pushUndoState(captureEditorState(label));
}

function restoreEditorState(state, { reason = 'restore-system-document', announce = '' } = {}) {
  pendingStepSeconds = 0;
  previewSignature = '';
  cancelContentPlacement({ announce: false, restoreRunning: false });
  closeExperiment();
  closeGuide();
  closeInspector();
  system = new NBodySystem({
    bodies: state.bodies,
    stepSeconds: state.stepSeconds,
    collisionMode: state.collisionMode,
    uniformDensityKgM3: state.uniformDensityKgM3,
    uniformDensityOriginM: state.uniformDensityOriginM
  });
  system.timeSeconds = state.timeSeconds;
  system.rebaseline(reason);
  scenarioMode = state.scenarioMode;
  running = state.running;
  setTimeWarp(TIME_WARP_VALUES.includes(state.daysPerSecond) ? state.daysPerSecond : 30, { announce: false });
  scaleMode = state.scaleMode;
  returnScaleMode = state.returnScaleMode;
  scenarioWidthM = state.scenarioWidthM;
  const restoredSelectedId = state.selectedId && system.body(state.selectedId) ? state.selectedId : null;
  selectedId = null;
  velocityHistoryState = null;
  cameraTargetId = state.cameraTargetId && system.body(state.cameraTargetId) ? state.cameraTargetId : null;
  cameraMode = state.cameraMode;
  cameraOrbit = { ...state.cameraOrbit };
  focusedId = null;
  approachOrigin = null;
  stepAccumulator = 0;
  lastFrameTime = null;
  trails.clear();
  lastTrailTime = -Infinity;
  collisionEffects = [];
  processedCollisionEvents = new Set();
  lastCollisionEvent = null;
  laboratory.classList.remove('is-cinematic', 'is-season-view');
  setFrameReferenceMode(state.frameReferenceMode || frameReferenceMode || 'barycentric', { announce: false });
  frameReferenceAnchor = Array.isArray(state.frameReferenceAnchor) && state.frameReferenceAnchor.length === 3
    ? [...state.frameReferenceAnchor]
    : (frameReferenceMode === 'galactocentric'
      ? defaultFrameReferenceAnchor()
      : [0, 0, 0]);
  const definition = scenarioDefinitions[scenarioMode];
  document.querySelector('#scenario-select').value = scenarioMode;
  document.querySelector('#scenario-note').textContent = definition?.note || 'CUSTOM EDITOR STATE · NEWTONIAN LIVE PROPAGATION';
  const view = viewDefinition();
  renderedView = { center: [...view.center], widthM: view.widthM };
  if (restoredSelectedId) openInspector(restoredSelectedId, { track: false });
  else {
    document.querySelector('#selection-kicker').textContent = 'TARGET';
    document.querySelector('#selection-name').textContent = 'Click a body to inspect';
  }
  if (announce) showToast(announce);
  updateReadouts();
}

function undoLastEdit() {
  const state = undoStack.pop();
  if (!state) return;
  restoreEditorState(state, {
    reason: 'undo-editor-mutation',
    announce: `Undid ${state.label}. Live state restored.`
  });
  document.querySelector('#undo-edit').disabled = undoStack.length === 0;
}

function scenarioEditorState(nextMode, label = nextMode) {
  const definition = scenarioDefinitions[nextMode];
  if (!definition) throw new Error(`Unknown scenario: ${nextMode}`);
  const scenarioSystem = definition.create();
  const snapshot = scenarioSystem.snapshot();
  return {
    label,
    scenarioMode: nextMode,
    bodies: snapshot.bodies,
    timeSeconds: snapshot.timeSeconds,
    stepSeconds: snapshot.stepSeconds,
    collisionMode: scenarioSystem.collisionMode,
    uniformDensityKgM3: snapshot.fields.uniformDensityKgM3,
    uniformDensityOriginM: snapshot.fields.uniformDensityOriginM,
    running: definition.startRunning ?? nextMode !== 'blank-canvas',
    daysPerSecond: definition.daysPerSecond ?? 30,
    scaleMode: definition.scaleMode,
    returnScaleMode: definition.scaleMode,
    scenarioWidthM: definition.widthM || null,
    selectedId: null,
    cameraTargetId: null,
    cameraMode: 'eye',
    cameraOrbit: { ...CAMERA_VIEWS.eye },
    frameReferenceMode,
    frameReferenceAnchor: [...frameReferenceAnchor]
  };
}

function createDefaultSystemWorkspace() {
  return createSystemWorkspace({
    documents: [createSystemDocument({
      id: 'home-system',
      name: 'JPL Solar System',
      source: 'curated-jpl',
      state: scenarioEditorState('jpl-system', 'initial JPL system')
    })],
    activeId: 'home-system'
  });
}

function lessonJourneyHandoffRequested() {
  return new URLSearchParams(location.search).get('journey') === '1' && readLessonPath().completed >= 3;
}

function activateLandingSystemWorkspace() {
  const params = new URLSearchParams(location.search);
  const systemId = params.get('system');
  const requestedScenario = params.get('scenario');
  const preparedSystems = {
    alpha_centauri: {
      name: 'Alpha Centauri · binary teaching system',
      scenario: 'equal-binary',
      source: 'atlas-handoff:alpha-centauri',
      note: 'A reversible equal-mass binary teaching preset inspired by Alpha Centauri. It is not a reconstruction of the real triple system.'
    },
    tau_ceti: {
      name: 'Tau Ceti · multi-world teaching system',
      scenario: 'resonant-chain',
      source: 'atlas-handoff:tau-ceti',
      note: 'A hypothetical resonant multi-world teaching preset. It does not claim to reproduce Tau Ceti’s observed system.'
    }
  };
  const directScenarios = {
    'jpl-system': {
      name: 'JPL Solar System',
      scenario: 'jpl-system',
      source: 'mode-gateway:jpl-system',
      note: 'The curated Solar System opened paused at day zero. Press Run when you are ready to propagate its Newtonian orbits.'
    },
    'blank-canvas': {
      name: 'Blank canvas',
      scenario: 'blank-canvas',
      source: 'mode-gateway:blank-canvas',
      note: 'Blank canvas opened paused. Place a body, set its velocity, then press Run.'
    }
  };
  const prepared = preparedSystems[systemId];
  const direct = requestedScenario ? directScenarios[requestedScenario] : null;
  if (!prepared && !direct && !systemId) return false;
  const launch = prepared || direct;
  const scenario = launch?.scenario || 'blank-canvas';
  const readableSystem = systemId ? systemId.replaceAll('_', ' ') : 'Blank canvas';
  const name = launch?.name || (systemId ? `${readableSystem} · blank workspace` : 'Blank canvas');
  const state = scenarioEditorState(scenario, `atlas handoff · ${name}`);
  state.running = false;
  if (systemWorkspace.documents.length >= SYSTEM_WORKSPACE_LIMIT) {
    showToast('Your saved scenarios are preserved. Switch to an existing scenario to keep exploring.');
    history.replaceState({}, '', location.pathname);
    return true;
  }
  const baseId = systemId ? `atlas-${systemId}` : `mode-${scenario}`;
  let documentId = baseId;
  let suffix = 2;
  while (systemWorkspace.documents.some(entry => entry.id === documentId)) documentId = `${baseId}-${suffix++}`;
  const documentState = createSystemDocument({
    id: documentId,
    name,
    source: launch?.source || `atlas-handoff:${systemId || 'blank'}`,
    state
  });
  systemWorkspace = replaceActiveSystemState(systemWorkspace, captureEditorState('before new lab entry'));
  systemWorkspace = addSystemDocument(systemWorkspace, documentState);
  restoreEditorState(state, {
    reason: 'atlas-system-handoff',
    announce: launch?.note || `${name} opened paused. Add a star or choose a prepared Scenario.`
  });
  closeContentDrawer();
  // Consume the launch request once so refreshing resumes this new workspace.
  history.replaceState({}, '', location.pathname);
  return true;
}

function activateLessonJourneyWorkspace() {
  if (!lessonJourneyHandoffRequested()) return false;
  const id = 'five-minute-journey';
  const name = 'Five-minute journey';
  const state = scenarioEditorState('sun-earth-moon', 'five-minute journey handoff');
  state.running = false;
  state.selectedId = 'moon';
  state.cameraTargetId = 'moon';
  state.cameraMode = 'track';

  systemWorkspace = replaceActiveSystemState(systemWorkspace, captureEditorState('before five-minute journey'));
  const existing = systemWorkspace.documents.find((documentState) => documentState.id === id);
  if (existing) {
    const refreshed = createSystemDocument({ id, name, source: 'curated-five-minute-journey', state });
    refreshed.revision = existing.revision + 1;
    systemWorkspace = {
      ...systemWorkspace,
      activeId: id,
      documents: systemWorkspace.documents.map((documentState) => documentState.id === id ? refreshed : documentState)
    };
  } else {
    if (systemWorkspace.documents.length >= SYSTEM_WORKSPACE_LIMIT) {
      showToast('The journey needs one free Scenario slot. Remove or reset a local Scenario, then continue from the atlas again.');
      return false;
    }
    systemWorkspace = addSystemDocument(systemWorkspace, createSystemDocument({
      id,
      name,
      source: 'curated-five-minute-journey',
      state
    }));
  }

  undoStack = [];
  restoreEditorState(state, {
    reason: 'five-minute-journey-handoff',
    announce: 'Five-minute journey ready. Moon is selected and tracked; next, change its mass and compare the force layers.'
  });
  return true;
}

function persistSystemWorkspace() {
  try {
    localStorage.setItem(SYSTEM_WORKSPACE_STORAGE_KEY, serializeSystemWorkspace(systemWorkspace));
  } catch {
    showToast('System workspace could not be persisted in this browser.');
  }
}

function saveActiveSystemDocument() {
  if (!systemWorkspace) return;
  systemWorkspace = replaceActiveSystemState(systemWorkspace, captureEditorState('workspace autosave'));
  persistSystemWorkspace();
}

function renderWorkspaceStrip() {
  if (!systemWorkspace) return;
  workspaceStrip.replaceChildren();
  for (const documentState of systemWorkspace.documents) {
    const liveState = documentState.id === systemWorkspace.activeId ? captureEditorState('active system') : documentState.state;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.workspaceSystem = documentState.id;
    button.classList.toggle('is-active', documentState.id === systemWorkspace.activeId);
    button.setAttribute('aria-pressed', String(documentState.id === systemWorkspace.activeId));
    const name = document.createElement('span');
    const count = document.createElement('small');
    name.textContent = documentState.name;
    count.textContent = `${liveState.bodies.length} ${liveState.bodies.length === 1 ? 'body' : 'bodies'}`;
    button.append(name, count);
    button.addEventListener('click', () => switchWorkspaceSystem(documentState.id));
    workspaceStrip.append(button);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'workspace-add';
  add.setAttribute('aria-label', 'Create a new paused simulation scenario');
  add.textContent = '＋';
  add.addEventListener('click', createBlankWorkspaceSystem);
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'workspace-manage';
  manage.textContent = 'Scenarios';
  manage.addEventListener('click', () => openContentDrawer('systems'));
  workspaceStrip.append(add, manage);
}

function renderSystemsGrid() {
  const grid = document.querySelector('#systems-grid');
  grid.replaceChildren();
  const buildForm = document.createElement('form');
  buildForm.className = 'system-build-form';
  buildForm.innerHTML = '<span>AI BLUEPRINT</span><label for="system-build-prompt">Describe a system</label><input id="system-build-prompt" maxlength="240" placeholder="Three bodies with a compact object" required><button type="submit">Build in background</button><small>GPT-5.6 chooses a validated local recipe; nothing enters the live solver until you open it.</small>';
  buildForm.addEventListener('submit', submitSystemBuild);
  grid.append(buildForm);
  for (const job of systemBuildJobs.values()) grid.append(systemBuildCard(job));
  for (const documentState of systemWorkspace.documents) {
    const liveState = documentState.id === systemWorkspace.activeId ? captureEditorState('active system') : documentState.state;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.systemDocument = documentState.id;
    button.classList.toggle('is-active', documentState.id === systemWorkspace.activeId);
    button.setAttribute('aria-pressed', String(documentState.id === systemWorkspace.activeId));
    const kicker = document.createElement('span');
    const title = document.createElement('strong');
    const metadata = document.createElement('small');
    kicker.textContent = documentState.id === systemWorkspace.activeId ? 'ACTIVE SYSTEM' : `REVISION ${documentState.revision}`;
    title.textContent = documentState.name;
    metadata.textContent = `${liveState.bodies.length} bodies · ${(liveState.timeSeconds / DAY_S).toFixed(1)} days · ${liveState.cameraMode} camera`;
    button.append(kicker, title, metadata);
    button.addEventListener('click', () => switchWorkspaceSystem(documentState.id));
    grid.append(button);
  }
  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.id = 'new-blank-system';
  const createKicker = document.createElement('span');
  const createTitle = document.createElement('strong');
  const createMetadata = document.createElement('small');
  createKicker.textContent = 'NEW DOCUMENT';
  createTitle.textContent = '＋ Blank system';
  createMetadata.textContent = 'Independent physics time, bodies, and camera';
  createButton.append(createKicker, createTitle, createMetadata);
  createButton.addEventListener('click', createBlankWorkspaceSystem);
  grid.append(createButton);

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.id = 'reset-system-workspace';
  const resetKicker = document.createElement('span');
  const resetTitle = document.createElement('strong');
  const resetMetadata = document.createElement('small');
  const resetArmed = Date.now() < resetWorkspaceArmedUntil;
  resetButton.classList.toggle('is-danger', resetArmed);
  resetKicker.textContent = resetArmed ? 'CONFIRM RESET' : 'LOCAL RESET';
  resetTitle.textContent = resetArmed ? 'Click again to reset' : 'Reset test workspace';
  resetMetadata.textContent = resetArmed
    ? 'Clears systems + lesson path · cannot be undone'
    : 'Two-step local reset · no cloud data';
  resetButton.append(resetKicker, resetTitle, resetMetadata);
  resetButton.addEventListener('click', resetLocalTestWorkspace);
  grid.append(resetButton);
  renderWorkspaceStrip();
}

function systemBuildCard(job) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `system-build-job is-${job.status}`;
  const eta = job.etaSeconds ? `${job.etaSeconds.minimum}–${job.etaSeconds.maximum}s estimated` : 'ETA calibrating from local runs';
  button.innerHTML = `<span>${job.status.toUpperCase()}</span><strong>${job.blueprint?.title || 'Building system…'}</strong><small>${job.status === 'ready' ? `${job.blueprint.summary} · Open as a new paused document` : job.error || eta}</small>`;
  button.disabled = job.status !== 'ready';
  if (job.status === 'ready') button.addEventListener('click', () => acceptSystemBuild(job));
  return button;
}

async function submitSystemBuild(event) {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  const prompt = input.value.trim();
  if (!prompt) return;
  input.value = '';
  try {
    const response = await fetch('/api/lab/system-builds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt })
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || 'Build request failed.');
    systemBuildJobs.set(job.id, job);
    renderSystemsGrid();
    pollSystemBuild(job.id);
    showToast('System blueprint queued. Keep exploring; it will appear in this shelf when ready.');
  } catch (error) {
    showToast(error.message);
  }
}

async function pollSystemBuild(id) {
  try {
    const response = await fetch(`/api/lab/system-builds/${encodeURIComponent(id)}`);
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || 'Build status unavailable.');
    systemBuildJobs.set(id, job);
    if (drawerMode === 'systems' && contentDrawer.classList.contains('is-open')) renderSystemsGrid();
    if (!['ready', 'failed'].includes(job.status)) return setTimeout(() => pollSystemBuild(id), 900);
    showToast(job.status === 'ready' ? `${job.blueprint.title} is ready. Open it from Systems.` : job.error);
  } catch (error) {
    systemBuildJobs.set(id, { ...systemBuildJobs.get(id), status: 'failed', error: error.message });
    if (drawerMode === 'systems') renderSystemsGrid();
  }
}

function blueprintEditorState(blueprint) {
  const recipeMap = { 'compact-three-body': 'figure-eight' };
  const state = scenarioEditorState(recipeMap[blueprint.recipe] || blueprint.recipe, `AI blueprint: ${blueprint.title}`);
  state.running = false;
  if (blueprint.recipe === 'compact-three-body') {
    const compact = state.bodies[0];
    compact.name = 'Compact mass proxy';
    compact.massKg = 9.94235e30;
    compact.radiusM = 30_000;
    compact.visualRadiusM = 30_000;
    compact.color = '#b49cff';
    compact.flags = [...(compact.flags || []), 'newtonian-compact-proxy', 'no-general-relativity'];
  }
  return state;
}

function acceptSystemBuild(job) {
  saveActiveSystemDocument();
  let suffix = 1;
  let id = `ai-system-${suffix}`;
  while (systemWorkspace.documents.some((entry) => entry.id === id)) id = `ai-system-${++suffix}`;
  const documentState = createSystemDocument({ id, name: job.blueprint.title, source: `gpt-blueprint:${job.model}`, state: blueprintEditorState(job.blueprint) });
  systemWorkspace = addSystemDocument(systemWorkspace, documentState);
  systemBuildJobs.delete(job.id);
  restoreEditorState(documentState.state, { reason: 'open-ai-system-blueprint', announce: `${job.blueprint.title} opened paused. ${job.blueprint.caveat}` });
  persistSystemWorkspace();
  renderSystemsGrid();
}

function setDrawerMode(mode) {
  drawerMode = mode === 'systems' ? 'systems' : 'objects';
  const systems = drawerMode === 'systems';
  document.querySelector('#object-grid').hidden = systems;
  document.querySelector('#systems-grid').hidden = !systems;
  document.querySelector('#drawer-objects-tab').setAttribute('aria-selected', String(!systems));
  document.querySelector('#drawer-systems-tab').setAttribute('aria-selected', String(systems));
  document.querySelector('#drawer-kicker').textContent = systems ? 'SCENARIO NAVIGATOR' : 'OBJECT LIBRARY';
  document.querySelector('#drawer-title').textContent = systems ? 'Switch scenarios without losing state' : 'Drag to the grid or click to place';
  document.querySelector('#drawer-description').textContent = systems
    ? 'Each scenario preserves its own bodies, elapsed time, and camera intent.'
    : 'Placement holds time until Run; host velocity is computed when possible.';
  if (systems) renderSystemsGrid();
}

function switchWorkspaceSystem(nextId) {
  if (!systemWorkspace || nextId === systemWorkspace.activeId) return;
  const targetName = systemWorkspace.documents.find((documentState) => documentState.id === nextId)?.name || nextId;
  const switched = switchSystemDocument(systemWorkspace, nextId, captureEditorState('workspace switch'));
  systemWorkspace = switched.workspace;
  undoStack = [];
  restoreEditorState(switched.state, {
    reason: 'switch-system-document',
    announce: `${targetName} activated. Physics time and camera restored.`
  });
  persistSystemWorkspace();
  renderSystemsGrid();
}

function createGuidedLessonWorkspace(lessonId) {
  const definitions = {
    'stable-orbit': { name: 'Lesson · Stable Orbit', scenario: 'blank-canvas' },
    barycenter: { name: 'Lesson · Barycenter', scenario: 'sun-earth-moon' },
    'world-collision': { name: 'Lesson · World Collision', scenario: 'world-collision' },
    'solar-simultaneity': { name: 'Lesson · Solar Simultaneity', scenario: 'jpl-system' },
    'rocket-light-thought': { name: 'Lesson · Rocket and Light', scenario: 'jpl-system' },
    'frame-lens-comparison': { name: 'Lesson · Frame lens comparison', scenario: 'jpl-system' },
    'dual-explosion-simultaneity': { name: 'Lesson · Dual Explosions', scenario: 'jpl-system' },
    'everyday-physics': { name: 'Lesson · Everyday Physics', scenario: 'blank-canvas' },
    'dark-matter-comparison': { name: 'Lesson · Dark Matter Comparison', scenario: 'blank-canvas' },
    'reference-frame-comparison': { name: 'Lesson · Reference Frames', scenario: 'jpl-system' },
    'galactocentric-vehicle-lens': { name: 'Lesson · Vehicle and galactocentric lensing', scenario: 'jpl-system' }
  };
  const lesson = definitions[lessonId];
  if (!lesson) throw new Error(`Unknown guided lesson: ${lessonId}`);
  scientistControlState = { lessonId, orbit: null, collision: null, values: {} };
  massHistoryState = null;
  velocityHistoryState = null;
  saveActiveSystemDocument();
  const id = `directed-${lessonId}`;
  const state = scenarioEditorState(lesson.scenario, `start ${lesson.name}`);
  state.running = false;
  state.daysPerSecond = lessonId === 'world-collision' ? .01 : 1;
  if (lessonId === 'stable-orbit') {
    state.scenarioWidthM = AU_M * 1.2;
    state.cameraMode = 'eye';
    state.cameraTargetId = null;
  } else if (lessonId === 'barycenter') {
    state.scaleMode = 'lunar';
    state.returnScaleMode = 'lunar';
    state.selectedId = null;
    state.cameraTargetId = 'moon';
    state.cameraMode = 'track';
    state.cameraOrbit = { ...CAMERA_VIEWS.eye, zoom: 2.1 };
  } else if (
    lessonId === 'solar-simultaneity'
    || lessonId === 'dual-explosion-simultaneity'
    || lessonId === 'rocket-light-thought'
    || lessonId === 'frame-lens-comparison'
    || lessonId === 'reference-frame-comparison'
    || lessonId === 'galactocentric-vehicle-lens'
  ) {
    state.bodies = state.bodies.filter((body) => ['sun', 'earth', 'mars'].includes(body.id));
    state.scenarioWidthM = AU_M * 2.4;
    state.selectedId = null;
    state.cameraTargetId = null;
    state.cameraMode = 'orbit';
    state.cameraOrbit = { ...CAMERA_VIEWS.top };
  } else if (lessonId === 'everyday-physics') {
    state.scenarioWidthM = AU_M * 1.1;
    state.selectedId = null;
    state.cameraTargetId = null;
    state.cameraMode = 'eye';
  } else {
    state.selectedId = null;
    state.cameraTargetId = null;
    state.cameraMode = 'eye';
  }
  const existing = systemWorkspace.documents.find((documentState) => documentState.id === id);
  if (existing) {
    const refreshed = createSystemDocument({ id, name: lesson.name, source: `directed-lesson:${lessonId}`, state });
    refreshed.revision = existing.revision + 1;
    systemWorkspace = {
      ...systemWorkspace,
      activeId: id,
      documents: systemWorkspace.documents.map((documentState) => documentState.id === id ? refreshed : documentState)
    };
  } else {
    if (systemWorkspace.documents.length >= SYSTEM_WORKSPACE_LIMIT) throw new Error('Your saved experiments are full. Open an existing lesson to keep exploring.');
    systemWorkspace = addSystemDocument(systemWorkspace, createSystemDocument({
      id,
      name: lesson.name,
      source: `directed-lesson:${lessonId}`,
      state
    }));
  }
  scientistTargetId = lessonId === 'barycenter' ? 'moon' : null;
  scientistMotionStartSeconds = null;
  document.querySelector('#scientist-collision-evidence').hidden = true;
  undoStack = [];
  restoreEditorState(state, {
    reason: `directed-lesson-${lessonId}`,
    announce: `${lesson.name} prepared as a separate paused Scenario.`
  });
  persistSystemWorkspace();
  renderWorkspaceStrip();
  renderSystemsGrid();
}

function createBlankWorkspaceSystem() {
  saveActiveSystemDocument();
  let number = 0;
  let id;
  do { number += 1; id = `scenario-${number}`; } while (systemWorkspace.documents.some((entry) => entry.id === id || entry.name === `Scenario ${number}`));
  const name = `Scenario ${number}`;
  const documentState = createSystemDocument({
    id,
    name,
    source: 'learner',
    state: scenarioEditorState('blank-canvas', `create ${name}`)
  });
  systemWorkspace = addSystemDocument(systemWorkspace, documentState);
  undoStack = [];
  restoreEditorState(documentState.state, {
    reason: 'create-system-document',
    announce: `${name} created as an independent blank system.`
  });
  persistSystemWorkspace();
  renderSystemsGrid();
}

function resetLocalTestWorkspace() {
  if (Date.now() >= resetWorkspaceArmedUntil) {
    resetWorkspaceArmedUntil = Date.now() + 15_000;
    clearTimeout(resetWorkspaceTimer);
    resetWorkspaceTimer = setTimeout(() => {
      resetWorkspaceArmedUntil = 0;
      if (drawerMode === 'systems' && contentDrawer.classList.contains('is-open')) renderSystemsGrid();
    }, 15_050);
    renderSystemsGrid();
    showToast('Reset armed for 15 seconds. Click the red-labelled card again to confirm.');
    return;
  }
  resetWorkspaceArmedUntil = 0;
  clearTimeout(resetWorkspaceTimer);
  try { localStorage.removeItem(SYSTEM_WORKSPACE_STORAGE_KEY); } catch { /* local-only fallback */ }
  renderLessonPath(resetLessonPath());
  systemWorkspace = createDefaultSystemWorkspace();
  undoStack = [];
  restoreEditorState(activeSystemDocument(systemWorkspace).state, {
    reason: 'reset-local-test-workspace',
    announce: 'Local test state reset. Curated JPL Solar System restored.'
  });
  persistSystemWorkspace();
  setDrawerMode('systems');
  renderSystemsGrid();
}

function initializeSystemWorkspace() {
  const fallback = createDefaultSystemWorkspace();
  let serialized = null;
  try { serialized = localStorage.getItem(SYSTEM_WORKSPACE_STORAGE_KEY); } catch { /* local-only fallback */ }
  systemWorkspace = parseSystemWorkspace(serialized, fallback);
  systemWorkspace.documents = systemWorkspace.documents.map((documentState) => ({
    ...documentState,
    name: documentState.name.replace(/^Workshop (\d+)$/, 'Scenario $1')
  }));
  try {
    const active = activeSystemDocument(systemWorkspace);
    if (active) restoreEditorState(active.state, { reason: 'load-system-workspace' });
  } catch {
    systemWorkspace = fallback;
    restoreEditorState(activeSystemDocument(fallback).state, { reason: 'recover-system-workspace' });
    showToast('A damaged saved workspace was replaced with the curated Solar System.');
  }
  if (!activateLandingSystemWorkspace()) activateLessonJourneyWorkspace();
  persistSystemWorkspace();
  renderWorkspaceStrip();
}

function openContentDrawer(mode = drawerMode) {
  setDrawerMode(mode);
  contentDrawer.classList.add('is-open');
  laboratory.classList.add('drawer-open');
  contentDrawer.setAttribute('aria-hidden', 'false');
  contentDrawer.removeAttribute('inert');
  document.querySelector('#open-content').setAttribute('aria-expanded', 'true');
  scientistTutorial?.refresh();
}

function closeContentDrawer() {
  contentDrawer.classList.remove('is-open');
  laboratory.classList.remove('drawer-open');
  contentDrawer.setAttribute('aria-hidden', 'true');
  contentDrawer.setAttribute('inert', '');
  document.querySelector('#open-content').setAttribute('aria-expanded', 'false');
}

function loadScenario(nextMode, { announce = true, startRunning } = {}) {
  pendingStepSeconds = 0;
  previewSignature = '';
  const definition = scenarioDefinitions[nextMode];
  if (!definition) throw new Error(`Unknown scenario: ${nextMode}`);
  closeGuide();
  closeExperiment();
  closeInspector();
  closeContentDrawer();
  cancelContentPlacement({ announce: false, restoreRunning: false });
  system = definition.create();
  scenarioMode = nextMode;
  running = startRunning ?? definition.startRunning ?? nextMode !== 'blank-canvas';
  setTimeWarp(definition.daysPerSecond ?? 30, { announce: false });
  stepAccumulator = 0;
  lastFrameTime = null;
  darkMatterMode = 'none';
  seasonPhaseOverrideRad = null;
  lightPulsePhase = 0;
  lightLensId = null;
  lightImpactRadii = 1;
  trails.clear();
  lastTrailTime = -Infinity;
  collisionEffects = [];
  processedCollisionEvents = new Set();
  lastCollisionEvent = null;
  spawnCounter = 0;
  scaleMode = definition.scaleMode;
  returnScaleMode = definition.scaleMode;
  scenarioWidthM = definition.widthM || null;
  if (frameReferenceMode === 'galactocentric') setFrameReferenceAnchor();
  focusedId = null;
  approachOrigin = null;
  cameraTargetId = null;
  laboratory.classList.remove('is-cinematic', 'is-season-view');
  const view = viewDefinition();
  renderedView = { center: [...view.center], widthM: view.widthM };
  document.querySelector('#scenario-select').value = scenarioMode;
  document.querySelector('#scenario-note').textContent = definition.note;
  resetCamera({ announce: false });
  if (announce) showToast(definition.toast);
  if (systemWorkspace) renderWorkspaceStrip();
  updateReadouts();
}

function resize() {
  const pixelRatio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(innerWidth * pixelRatio);
  canvas.height = Math.round(innerHeight * pixelRatio);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const panel = document.querySelector('#scientist-lesson');
  const learning = panel?.classList.contains('is-open') && Boolean(panel.dataset.lessonId);
  const placing = laboratory.classList.contains('is-placing');
  sceneViewport = learning && !placing
    ? innerWidth <= 640
      ? { width: innerWidth, height: Math.max(150, innerHeight * .34) }
      : { width: Math.max(220, panel.getBoundingClientRect().left - 20), height: innerHeight }
    : { width: innerWidth, height: innerHeight };
  const spaceCanvas = document.querySelector('#space-canvas');
  spaceCanvas.style.width = `${sceneViewport.width}px`;
  spaceCanvas.style.height = `${sceneViewport.height}px`;
  solarRenderer.resize(sceneViewport.width, sceneViewport.height);
}

function viewDefinition() {
  if (bodyMove) return { ...views.solar, ...bodyMove.view };
  const frameCenter = (rawCenter) => cameraCenterInWorld(rawCenter, {
    reference: frameReferenceMode,
    starPosition: primaryStar()?.positionM,
    fixedOrigin: frameReferenceAnchor,
    focus: Boolean(cameraTargetId) || ['body', 'lunar', 'light'].includes(scaleMode)
  });

  if (activeExperiment === 'relativity' && scientistTutorial?.state?.lessonId && relativityEvents.a && relativityEvents.b) {
    const a = relativityEvents.a.positionM;
    const b = relativityEvents.b.positionM;
    return {
      ...views.solar,
      center: a.map((value, axis) => (value + b[axis]) / 2),
      widthM: Math.max(AU_M, Math.hypot(...a.map((value, axis) => value - b[axis])) * 1.8)
    };
  }

  if (scaleMode === 'system' || scaleMode === 'solar') {
    let base = scenarioWidthM && scaleMode === 'solar'
      ? { ...views.solar, widthM: scenarioWidthM, kicker: scenarioDefinitions[scenarioMode]?.frameKicker || views.solar.kicker }
      : views[scaleMode];
    if (scaleMode === 'solar' && !scenarioWidthM) {
      const fitted = barycentricSystemView(system.bodies, {
        minimumWidthM: 50_000_000,
        maximumWidthM: AU_M * 64
      });
      if (fitted) base = {
        ...base,
        center: fitted.center,
        widthM: fitted.widthM,
        kicker: 'LIVE BARYCENTRIC FRAME',
        label: formatFrameWidth(fitted.widthM)
      };
    }
    const target = cameraTargetId ? system.body(cameraTargetId) : null;
    const sun = system.body('sun');
    const earth = system.body('earth');
    let trackingWidthM = base.widthM;
    if (target?.id === 'sun') trackingWidthM = Math.min(base.widthM, AU_M * 4.2);
    else if (target?.id === 'moon' && earth) {
      const lunarDistanceM = Math.hypot(...target.positionM.map((value, axis) => value - earth.positionM[axis]));
      trackingWidthM = Math.min(base.widthM, Math.max(1_100_000_000, lunarDistanceM * 3));
    } else if (target?.type === 'planet' && sun) {
      const solarDistanceM = Math.hypot(...target.positionM.map((value, axis) => value - sun.positionM[axis]));
      trackingWidthM = Math.min(base.widthM, Math.max(AU_M * .6, solarDistanceM * 2.5));
    }
    return target
      ? { ...base, center: frameCenter(target.positionM), widthM: trackingWidthM, kicker: `TRACKING ${target.name.toUpperCase()}` }
      : { ...base, center: frameCenter(base.center) };
  }
  if (scaleMode === 'light') {
    const lens = lightLens();
    const blackHole = isBlackHoleBody(lens);
    return {
      center: frameCenter(lens ? lens.positionM : [0, 0, 0]),
      widthM: (lens?.radiusM || 695_700_000) * (blackHole ? 48 : 32),
      kicker: blackHole ? 'SCHWARZSCHILD LIGHT FRAME' : 'SOLAR GRAZING-RAY FRAME',
      label: ''
    };
  }
  if (scaleMode === 'body') {
    const body = system.body(focusedId);
    if (body) {
      return {
        center: frameCenter(body.positionM),
        widthM: Math.max(body.radiusM * 6.4, 1_000),
        kicker: `${body.name.toUpperCase()} APPROACH`,
        label: ''
      };
    }
  }
  const earth = system.body('earth');
  const moon = system.body('moon');
  const midpoint = earth && moon
    ? earth.positionM.map((value, axis) => (value + moon.positionM[axis]) * .5)
    : [0, 0, 0];
  return {
    ...views.lunar,
    center: frameCenter(midpoint)
  };
}

function formatFrameWidth(widthM) {
  if (widthM >= AU_M * .1) return `${(widthM / AU_M).toFixed(2)} AU WIDE`;
  if (widthM >= 1_000_000_000) return `${(widthM / 1_000_000_000).toFixed(2)} MILLION KM WIDE`;
  return `${Math.round(widthM / 1000).toLocaleString()} KM WIDE`;
}

function formatOrbitDistance(distanceM) {
  if (!Number.isFinite(distanceM)) return 'Unbounded';
  if (distanceM >= AU_M * .05) return `${(distanceM / AU_M).toFixed(4)} AU`;
  return `${Math.round(distanceM / 1000).toLocaleString()} km`;
}

function formatOrbitPeriod(periodSeconds) {
  if (!Number.isFinite(periodSeconds)) return 'Unbound';
  const days = periodSeconds / DAY_S;
  return days >= 730 ? `${(days / 365.25).toFixed(2)} years` : `${days.toFixed(days < 10 ? 2 : 1)} days`;
}

function orbitHostFor(body) {
  if (!body) return null;
  if (body.type === 'moon') {
    const planets = system.bodies.filter((candidate) => candidate.id !== body.id && candidate.type === 'planet' && candidate.massKg > 0);
    return planets.sort((a, b) => Math.hypot(...body.positionM.map((value, axis) => value - a.positionM[axis])) - Math.hypot(...body.positionM.map((value, axis) => value - b.positionM[axis])))[0] || primaryStar();
  }
  if (body.type !== 'star') return primaryStar();
  return system.bodies.filter((candidate) => candidate.id !== body.id && candidate.type === 'star' && candidate.massKg > 0).sort((a, b) => b.massKg - a.massKg)[0] || null;
}

function orbitForBody(body) {
  const host = orbitHostFor(body);
  if (!host) return null;
  try { return { host, elements: system.relativeOrbit(host.id, body.id) }; } catch { return null; }
}

function updateOrbitInspector(body) {
  const details = document.querySelector('#orbit-details');
  const orbit = orbitForBody(body);
  details.hidden = !orbit;
  const circularButton = document.querySelector('#circularize-selected');
  circularButton.hidden = !orbit;
  circularButton.disabled = Boolean(bodyMove);
  document.querySelector('#move-selected').textContent = `Move ${body.name}`;
  document.querySelector('#orbit-health').textContent = !orbit ? 'Move this object to try a different arrangement.'
    : orbit.elements.periapsisM <= orbit.host.radiusM + body.radiusM ? `This path may hit ${orbit.host.name}. Move it, or try a circular orbit.`
      : orbit.elements.eccentricity >= 1 ? `An escape path from ${orbit.host.name}. Try a circular orbit to keep it nearby.`
        : `Orbiting ${orbit.host.name} · ${formatOrbitPeriod(orbit.elements.periodSeconds)} per orbit`;
  if (!orbit) return;
  const { host, elements } = orbit;
  document.querySelector('#orbit-summary').textContent = `${host.name} · e ${elements.eccentricity.toFixed(4)}`;
  document.querySelector('#orbit-host').textContent = host.name;
  document.querySelector('#orbit-type').textContent = elements.orbitType;
  document.querySelector('#orbit-axis').textContent = formatOrbitDistance(elements.semiMajorAxisM);
  document.querySelector('#orbit-eccentricity').textContent = elements.eccentricity.toFixed(6);
  document.querySelector('#orbit-periapsis').textContent = formatOrbitDistance(elements.periapsisM);
  document.querySelector('#orbit-apoapsis').textContent = formatOrbitDistance(elements.apoapsisM);
  document.querySelector('#orbit-inclination').textContent = `${(elements.inclinationRad * 180 / Math.PI).toFixed(3)}°`;
  document.querySelector('#orbit-period').textContent = formatOrbitPeriod(elements.periodSeconds);
}

function setScientistWorkbenchSlider(value, { disabled = false, valueText = '' } = {}) {
  const slider = document.querySelector('#scientist-variable-slider');
  if (!slider) return;
  const min = Number(slider.min);
  const max = Number(slider.max);
  const bounded = Math.max(min, Math.min(max, Number(value)));
  slider.value = String(bounded);
  slider.disabled = disabled;
  const progress = max > min ? (bounded - min) / (max - min) * 100 : 0;
  slider.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, progress))}%`);
  if (valueText) slider.setAttribute('aria-valuetext', valueText);
  document.querySelector('#scientist-variable-decrease').disabled = disabled;
  document.querySelector('#scientist-variable-increase').disabled = disabled;
}

function collisionReadout() {
  if (system.bodies.length >= 2) {
    const [first, second] = system.bodies;
    const relativeSpeedMps = Math.hypot(...first.velocityMps.map((value, axis) => value - second.velocityMps[axis]));
    const reducedMassKg = first.massKg * second.massKg / (first.massKg + second.massKg);
    return { relativeSpeedMps, impactEnergyJ: .5 * reducedMassKg * relativeSpeedMps ** 2 };
  }
  const collision = latestCollisionEvidence();
  return collision ? { relativeSpeedMps: collision.relativeSpeedMps, impactEnergyJ: collision.impactEnergyJ } : null;
}

function updateScientistWorkbench() {
  const state = scientistTutorial?.state;
  if (!state || state.complete) return;
  const lesson = SCIENTIST_LESSONS[state.lessonId];
  const guide = lesson?.variableGuide;
  if (!guide?.control) return;
  if (scientistControlState.lessonId !== lesson.id) {
    scientistControlState = { lessonId: lesson.id, orbit: null, collision: null, values: {} };
  }
  const slider = document.querySelector('#scientist-variable-slider');
  const variableOutput = document.querySelector('#scientist-variable-current');
  const observationOutput = document.querySelector('#scientist-observation-current');
  const guidance = document.querySelector('#scientist-variable-state');
  if (!slider || !variableOutput || !observationOutput || !guidance) return;
  const control = guide.control;
  const step = lesson.steps[state.index];
  let value = Number(scientistControlState.values[control.key] ?? control.value);
  let valueText = '';
  let observation = 'Ready when you are';
  let status = guide.instruction;
  let locked = state.index < lessonVariableUnlockStep(lesson);

  if (control.key === 'orbit-speed') {
    const body = system.body(scientistTargetId) || system.body('earth') || system.bodies.find((candidate) => candidate.type === 'planet');
    const orbit = orbitForBody(body);
    locked ||= !body || running || state.index > 2;
    valueText = body ? `${value.toFixed(2)}× circular speed` : 'Add a world first';
    if (orbit) {
      const shape = orbit.elements.eccentricity < .02 ? 'Nearly circular' : orbit.elements.eccentricity < 1 ? 'An oval orbit' : 'An escape path';
      observation = `${shape}${Number.isFinite(orbit.elements.periodSeconds) ? ` · ${formatOrbitPeriod(orbit.elements.periodSeconds)}` : ''}`;
      status = Number.isFinite(orbit.elements.apoapsisM)
        ? `Closest ${formatOrbitDistance(orbit.elements.periapsisM)} · farthest ${formatOrbitDistance(orbit.elements.apoapsisM)}.`
        : `Closest ${formatOrbitDistance(orbit.elements.periapsisM)} · this path does not close.`;
    } else {
      observation = 'Waiting for an orbiting world';
      status = 'Add a star and a world to try different speeds.';
    }
  } else if (control.key === 'moon-mass') {
    const moon = system.body('moon');
    const earth = system.body('earth');
    if (moon) value = moon.massKg / REFERENCE_MASS_KG.moon;
    locked ||= !moon || !earth || state.index > 1;
    valueText = moon ? `${value.toFixed(2)}× normal` : 'Moon unavailable';
    if (moon && earth) {
      const barycenter = system.barycenter(['earth', 'moon']);
      const distanceM = Math.hypot(...barycenter.map((entry, axis) => entry - earth.positionM[axis]));
      observation = `${(distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km from Earth`;
      status = state.index === 1
        ? Math.abs(value - 2) <= .005 ? 'Exactly 2.00×. The new balance point is ready.' : 'Move to 2.00× and watch the balance point travel away from Earth.'
        : state.index > 1 ? 'Mass changed. The visible radius stayed fixed.' : 'First reveal the starting balance point.';
    }
  } else if (control.key === 'collision-speed') {
    const readout = collisionReadout();
    locked ||= running || state.index > 1 || system.bodies.length < 2;
    valueText = readout ? `${(readout.relativeSpeedMps / 1000).toFixed(1)} km/s` : `${value.toFixed(2)}× prepared speed`;
    observation = readout ? `${readout.impactEnergyJ.toExponential(2)} J` : 'Waiting for both worlds';
    status = readout
      ? `At ${value.toFixed(2)}× the starting speed, energy changes by ${(value ** 2).toFixed(2)}× before gravity accelerates the worlds.`
      : 'Restart this lesson to restore both approaching worlds.';
  } else if (control.key === 'relativity-speed') {
    locked ||= state.index === 0;
    value = relativityVelocityFraction;
    const readout = relativityThoughtSnapshot();
    valueText = `${readout.beta.toFixed(2)}c`;
    observation = readout.ready ? `Flash B is ${Math.abs(readout.rocketFrameDeltaSeconds).toFixed(1)} s ${readout.rocketFrameDeltaSeconds >= 0 ? 'earlier' : 'later'}` : 'Set up the two flashes first';
    status = readout.ready
      ? `The events stay fixed ${formatOrbitDistance(readout.separationM)} apart; only observer speed changes.`
      : 'Start the experiment to compare the two flashes.';
  } else if (control.key === 'impulse') {
    value = Number(impulseMagnitude.value);
    const body = system.body(scientistTargetId) || system.bodies.find((candidate) => candidate.flags?.includes('earth-scale-object'));
    valueText = `${value.toFixed(0)} m/s push`;
    observation = body ? `${(Math.hypot(...body.velocityMps) / 1000).toFixed(2)} km/s now` : `Next push adds ${value.toFixed(0)} m/s`;
    status = body ? 'Choose an amount, then apply the push once.' : 'Choose a push. Add the object to try it.';
  } else if (control.key === 'dark-matter-mode') {
    const modeIndex = { none: 0, 'local-estimate': 1, 'uniform-exaggerated': 2 }[darkMatterMode] ?? 0;
    const labels = ['Off', 'Local estimate', 'Exaggerated'];
    value = modeIndex;
    locked ||= state.index < 3 || state.index > 4;
    valueText = labels[modeIndex];
    const target = system.body(scientistTargetId) || system.body('earth') || system.bodies.find((candidate) => candidate.type !== 'star') || system.bodies[0];
    const comparison = target ? darkMatterModeComparison({ bodies: system.bodies, targetId: target.id, mode: darkMatterMode, uniformDensityOriginM: [0, 0, 0] }) : null;
    observation = comparison && modeIndex > 0
      ? modeIndex === 1 && comparison.deltaMagnitudeMps2 === 0
        ? 'Below simulation precision'
        : `+${comparison.deltaMagnitudeMps2.toExponential(2)} m/s²`
      : 'No added acceleration';
    status = step?.id === 'set-local' && modeIndex !== 1
      ? 'Move to Local first. Its tiny change is the realistic comparison.'
      : step?.id === 'set-exaggerated' && modeIndex !== 2
        ? 'Now move to Exaggerated to make the same relationship easy to see.'
        : modeIndex === 1 ? 'Local is physically small here; that subtlety is the result.' : modeIndex === 2 ? 'Exaggerated is a teaching contrast, not a Milky Way estimate.' : 'Off keeps the original Newtonian path.';
  }

  document.querySelector('#scientist-observation-name').textContent = guide.observation;
  const readingLight = activeExperiment === 'light';
  document.querySelector('.scientist-property-control').hidden = readingLight;
  const relationshipKey = readingLight ? 'light-frequency' : control.key;
  if (document.querySelector('#scientist-equation-expression').dataset.relationship !== relationshipKey) {
    renderLessonRelationship(document, relationshipKey, guide.equation);
  }
  document.querySelector('#scientist-equation-note').textContent = readingLight
    ? 'The source sends 456 THz light. Motion and gravity change the frequency that reaches the detector.'
    : guide.equationNote;
  if (activeExperiment === 'light') {
    const lens = lightLens();
    const participants = lens ? lightWaveParticipantBodies(lens) : {};
    const light = participants.source && participants.observer
      ? lightWaveReadout({ ...participants, lens, restFrequencyHz: 4.56e14 }) : null;
    if (light) {
      document.querySelector('#scientist-observation-name').textContent = 'Light reaching the observer';
      observation = `${(light.observedFrequencyHz / 1e12).toFixed(3)} THz`;
      status = `Emitted at 456 THz. ${participants.source.name} → ${participants.observer.name}.`;
    }
  }
  if (activeExperiment === 'magnetic' && fieldLayer === 'gravity') {
    const field = currentGravityField();
    const target = gravityTarget(field);
    if (target) {
      document.querySelector('#scientist-observation-name').textContent = 'Acceleration from gravity';
      observation = `${target.magnitudeMps2.toPrecision(3)} m/s²`;
      status = 'The arrow shows which way gravity changes the motion.';
    }
  }

  variableOutput.textContent = valueText;
  observationOutput.textContent = observation;
  guidance.textContent = status;
  setScientistWorkbenchSlider(value, { disabled: locked, valueText });
}

function applyScientistWorkbenchChange(controlKey, value, { lessonId } = {}) {
  const lesson = SCIENTIST_LESSONS[lessonId];
  if (!lesson || lesson.variableGuide?.control?.key !== controlKey) return;
  scientistControlState.values[controlKey] = value;

  if (controlKey === 'orbit-speed') {
    const body = system.body(scientistTargetId) || system.body('earth') || system.bodies.find((candidate) => candidate.type === 'planet');
    if (!body) throw new Error('Place the orbiting world before changing launch speed.');
    if (!scientistControlState.orbit || scientistControlState.orbit.bodyId !== body.id) {
      scientistControlState.orbit = { bodyId: body.id, velocityMps: [...body.velocityMps] };
    }
    system.editBody(body.id, { velocityMps: scientistControlState.orbit.velocityMps.map((entry) => entry * value) });
    system.rebaseline('lesson-orbit-speed');
    updateReadouts();
    return;
  }

  if (controlKey === 'moon-mass') {
    const moon = system.body('moon');
    if (!moon) throw new Error('Restart the lesson to restore the Moon.');
    selectedId = moon.id;
    selectedBaseMassKg = REFERENCE_MASS_KG.moon;
    selectedBaseRadiusM = moon.radiusM;
    massScale.value = String(Math.log10(value));
    massScale.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (controlKey === 'collision-speed') {
    if (system.bodies.length < 2) throw new Error('Restart the lesson to restore both worlds.');
    if (!scientistControlState.collision) {
      scientistControlState.collision = new Map(system.bodies.map((body) => [body.id, [...body.velocityMps]]));
    }
    for (const body of system.bodies) {
      const baseline = scientistControlState.collision.get(body.id);
      if (baseline) system.editBody(body.id, { velocityMps: baseline.map((entry) => entry * value) });
    }
    system.rebaseline('lesson-collision-speed');
    updateReadouts();
    return;
  }

  if (controlKey === 'relativity-speed') {
    const control = document.querySelector('#relativity-speed');
    control.value = String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    updateReadouts();
    return;
  }

  if (controlKey === 'impulse') {
    impulseMagnitude.value = String(value);
    impulseMagnitude.dispatchEvent(new Event('input', { bubbles: true }));
    updateReadouts();
    return;
  }

  if (controlKey === 'dark-matter-mode') {
    const modes = ['none', 'local-estimate', 'uniform-exaggerated'];
    const mode = modes[Math.round(value)] || 'none';
    const preset = setDarkMatterMode(mode);
    scientistTutorial?.record('dark-matter-mode-set', {
      mode,
      densityKgM3: preset.densityKgM3,
      ratioToSolarGravityAtOneAu: preset.ratioToSolarGravityAtOneAu
    });
    updateReadouts();
  }
}

function scienceObservationSnapshot() {
  const snapshot = system.snapshot();
  const collisionEvent = [...snapshot.events].reverse().find((event) => event.type === 'collision.merged') || null;
  const target = system.body(scientistTargetId) || (selectedId && system.body(selectedId)) || system.bodies.find((body) => body.type === 'planet') || system.bodies[0] || null;
  const orbit = orbitForBody(target);
  const field = target ? gravityAccelerationBreakdown({
    bodies: system.bodies,
    targetId: target.id,
    uniformDensityKgM3: snapshot.fields.uniformDensityKgM3,
    uniformDensityOriginM: snapshot.fields.uniformDensityOriginM
  }) : null;
  return {
    fidelity: 'computed',
    integrator: snapshot.integrator,
    scenarioMode,
    timeSeconds: snapshot.timeSeconds,
    running,
    stepSeconds: snapshot.stepSeconds,
    bodyCount: snapshot.bodies.length,
    target: target ? { id: target.id, name: target.name, type: target.type, massKg: target.massKg, positionM: [...target.positionM], velocityMps: [...target.velocityMps] } : null,
    orbit: orbit ? {
      hostId: orbit.host.id,
      hostName: orbit.host.name,
      type: orbit.elements.orbitType,
      semiMajorAxisM: Number.isFinite(orbit.elements.semiMajorAxisM) ? orbit.elements.semiMajorAxisM : null,
      eccentricity: orbit.elements.eccentricity,
      periapsisM: orbit.elements.periapsisM,
      apoapsisM: Number.isFinite(orbit.elements.apoapsisM) ? orbit.elements.apoapsisM : null,
      inclinationRad: orbit.elements.inclinationRad,
      periodSeconds: Number.isFinite(orbit.elements.periodSeconds) ? orbit.elements.periodSeconds : null
    } : null,
    gravity: field ? {
      targetId: field.targetId,
      totalVectorMps2: field.totalVectorMps2,
      totalMagnitudeMps2: field.totalMagnitudeMps2,
      contributions: field.contributions.slice(0, 8),
      equation: field.equation
    } : null,
    collision: collisionEvent ? {
      impactPositionM: [...collisionEvent.impactPositionM],
      impactNormal: [...collisionEvent.impactNormal],
      relativeVelocityMps: [...collisionEvent.relativeVelocityMps],
      relativeSpeedMps: collisionEvent.relativeSpeedMps,
      centerOfMassVelocityMps: [...collisionEvent.centerOfMassVelocityMps],
      reducedMassKg: collisionEvent.reducedMassKg,
      impactEnergyJ: collisionEvent.impactEnergyJ,
      totalMassKg: collisionEvent.totalMassKg,
      preImpact: collisionEvent.preImpact.map((body) => ({
        id: body.id,
        name: body.name,
        type: body.type,
        massKg: body.massKg,
        radiusM: body.radiusM,
        positionM: [...body.positionM],
        velocityMps: [...body.velocityMps]
      })),
      survivorId: collisionEvent.survivorId,
      absorbedId: collisionEvent.absorbedId,
      bodyCountAfter: snapshot.bodies.length,
      model: 'spherical momentum-conserving merge',
      presentation: collisionEvent.presentation
    } : null,
    relativity: activeExperiment === 'relativity' ? relativityThoughtSnapshot() : null,
    darkMatter: target ? darkMatterModeComparison({
      bodies: system.bodies,
      targetId: target.id,
      mode: darkMatterMode,
      uniformDensityOriginM: snapshot.fields.uniformDensityOriginM
    }) : null,
    diagnostics: {
      relativeEnergyDrift: snapshot.diagnostics.relativeEnergyDrift,
      relativeAngularMomentumDrift: snapshot.diagnostics.relativeAngularMomentumDrift
    },
    caveats: [
      snapshot.caveat,
      'Osculating elements are instantaneous two-body diagnostics inside a live n-body system.',
      'Visual body radii, trail opacity, and gravity-arrow length are presentation choices and do not alter SI physics.',
      'Collision flash, rings, and debris are illustrative; fragmentation, hydrodynamics, heating, and atmospheric loss are omitted.',
      'Relativity overlay values are a flat-spacetime simultaneity derivation and do not alter the Newtonian n-body integrator.'
    ]
  };
}

function recordScientistSimulationRun() {
  const recorded = scientistTutorial?.record('simulation-ran', {
    startTimeSeconds: system.timeSeconds,
    daysPerSecond
  });
  if (recorded) scientistMotionStartSeconds = system.timeSeconds;
  return recorded;
}

function updateScientistMotionObservation() {
  const step = scientistTutorial?.currentStep;
  if (!running || step?.event !== 'motion-observed' || scientistMotionStartSeconds === null) return;
  const elapsedDays = (system.timeSeconds - scientistMotionStartSeconds) / DAY_S;
  if (elapsedDays < step.minimumDays) return;
  if (scientistTutorial.record('motion-observed', { elapsedDays })) {
    running = false;
    pendingStepSeconds = 0;
    stepAccumulator = 0;
    showToast(`${elapsedDays.toFixed(1)} simulated days observed. Now connect the path to computed gravity.`);
  }
}

function latestCollisionEvidence() {
  return lastCollisionEvent || [...system.events].reverse().find((event) => event.type === 'collision.merged') || null;
}

function showScientistCollisionEvidence(event) {
  if (!event) throw new Error('Run the prepared worlds until computed contact before reviewing evidence.');
  document.querySelector('#scientist-impact-speed').textContent = `${(event.relativeSpeedMps / 1000).toFixed(2)} km/s`;
  document.querySelector('#scientist-impact-before').textContent = `${event.preImpact.length} Earth-mass worlds`;
  document.querySelector('#scientist-impact-after').textContent = `${system.bodies.length} merged body`;
  document.querySelector('#scientist-impact-mass').textContent = `${(event.totalMassKg / REFERENCE_MASS_KG.earth).toFixed(2)} M⊕`;
  document.querySelector('#scientist-impact-energy').textContent = `${event.impactEnergyJ.toExponential(3)} J`;
  document.querySelector('#scientist-collision-evidence').hidden = false;
}

function handleScientistLessonAction(action, { lessonId, detail } = {}) {
  if (action === 'frame-collision') {
    if (scenarioMode !== 'world-collision' || system.bodies.length !== 2) throw new Error('Restart the collision lesson to restore both original worlds.');
    closeInspector();
    closeExperiment();
    cameraTargetId = null;
    cameraMode = 'eye';
    cameraOrbit = { ...CAMERA_VIEWS.eye };
    scientistTutorial?.record('collision-ready', { scenarioMode, bodyCount: system.bodies.length });
    updateReadouts();
    showToast('Both worlds framed at day zero. Release them when you are ready to measure contact.');
    return;
  }
  if (action === 'run-collision') {
    if (scenarioMode !== 'world-collision' || system.bodies.length !== 2) throw new Error('Restart the collision lesson before running it again.');
    setTimeWarp(.01, { announce: false });
    running = true;
    cameraTargetId = null;
    cameraMode = 'eye';
    cameraOrbit = { ...CAMERA_VIEWS.eye };
    updateReadouts();
    recordScientistSimulationRun();
    showToast('Worlds released at fourteen simulated minutes per second. Waiting for computed contact.');
    return;
  }
  if (action === 'show-collision-evidence') {
    const collision = latestCollisionEvidence();
    running = false;
    showScientistCollisionEvidence(collision);
    scientistTutorial?.record('collision-evidence-inspected', {
      relativeSpeedMps: collision.relativeSpeedMps,
      impactEnergyJ: collision.impactEnergyJ,
      totalMassKg: collision.totalMassKg
    });
    updateReadouts();
    showToast('Computed impact evidence separated from the illustrative presentation layer.');
    return;
  }
  if (action === 'place-sun') {
    scaleMode = 'solar';
    scenarioWidthM = AU_M * 1.2;
    resetCamera({ announce: false });
    placeContentPreset('sun-like', [0, 0, 0]);
    return;
  }
  if (action === 'place-earth') {
    scaleMode = 'solar';
    const host = primaryStar();
    placeContentPreset('earth-analogue', [Number(host?.positionM[0] || 0) + AU_M, Number(host?.positionM[1] || 0), Number(host?.positionM[2] || 0)]);
    return;
  }
  if (action === 'place-vehicle') {
    scaleMode = 'solar';
    const preferredVehiclePreset = ['vehicle-car', 'vehicle-satellite', 'vehicle-rocketcraft', 'vehicle-asteroid', 'space-station']
      .find((presetId) => Object.hasOwn(OBJECT_PRESETS, presetId));
    const host = primaryStar();
    placeContentPreset(preferredVehiclePreset || 'vehicle-car', [Number(host?.positionM[0] || 0) + AU_M * .7, Number(host?.positionM[1] || 0) + AU_M * .2, Number(host?.positionM[2] || 0)]);
    return;
  }
  if (action === 'boost-vehicle') {
    const body = system.body(scientistTargetId)
      || system.bodies.find((candidate) => candidate.flags?.includes('preset:vehicle-car'))
      || null;
    if (!body) throw new Error('Place the vehicle before applying a boost.');
    selectedId = body.id;
    cameraTargetId = body.id;
    cameraMode = 'track';
    const targetImpulse = Number(impulseMagnitude?.value || 10);
    if (impulseMagnitude) {
      impulseMagnitude.value = String(targetImpulse);
      if (impulseOutput) impulseOutput.textContent = `${targetImpulse.toFixed(1)} m/s`;
    }
    applyImpulse(1, 1);
    return;
  }
  if (action === 'open-dark-matter') {
    closeInspector();
    openExperiment('dark-matter');
    closeContentDrawer();
    scientistTutorial?.record('dark-matter-opened', { experiment: 'dark-matter', mode: darkMatterMode, bodyCount: system.bodies.length });
    showToast(`Dark-matter panel open. OFF mode remains Newtonian acceleration until adjusted.`);
    return;
  }
  if (action === 'set-dark-matter-local') {
    const preset = setDarkMatterMode('local-estimate');
    scientistTutorial?.record('dark-matter-mode-set', {
      mode: darkMatterMode,
      densityKgM3: preset.densityKgM3,
      ratioToSolarGravityAtOneAu: preset.ratioToSolarGravityAtOneAu
    });
    showToast('Dark matter set to local Milky Way estimate. Compare side-by-side with OFF.');
    return;
  }
  if (action === 'set-dark-matter-exaggerated') {
    const preset = setDarkMatterMode('uniform-exaggerated');
    scientistTutorial?.record('dark-matter-mode-set', {
      mode: darkMatterMode,
      densityKgM3: preset.densityKgM3,
      ratioToSolarGravityAtOneAu: preset.ratioToSolarGravityAtOneAu
    });
    showToast('Dark matter set to exaggerated uniform field for contrast. Overlay is illustrative.');
    return;
  }
  if (action === 'review-dark-matter-comparison') {
    const comparison = darkMatterModeComparison({
      bodies: system.bodies,
      targetId: system.body(scientistTargetId)?.id || selectedId || system.body('earth')?.id || system.bodies[0]?.id,
      mode: darkMatterMode,
      uniformDensityOriginM: [0, 0, 0]
    });
    if (!comparison) throw new Error('Add bodies first, then open dark matter to review a comparison.');
    if (!activeExperiment || activeExperiment !== 'dark-matter') openExperiment('dark-matter');
    scientistTutorial?.record('dark-matter-comparison-reviewed', {
      mode: comparison.mode,
      targetName: comparison.targetName,
      targetId: comparison.targetId,
      offMagnitudeMps2: comparison.off?.magnitudeMps2,
      onMagnitudeMps2: comparison.on?.magnitudeMps2,
      deltaMagnitudeMps2: comparison.deltaMagnitudeMps2,
      baseMagnitudeMps2: comparison.baseMagnitudeMps2,
      deltaRatio: comparison.baseMagnitudeMps2 > 0 ? comparison.deltaMagnitudeMps2 / comparison.baseMagnitudeMps2 : 0
    });
    return;
  }
  if (action === 'open-thought-light') {
    const lens = lightLens();
    if (!lens) throw new Error('Add a star before opening the light experiment.');
    selectedId = lens.id;
    cameraTargetId = lens.id;
    cameraMode = 'track';
    openExperiment('light');
    scientistTutorial?.record('light-lab-opened', { experiment: 'light', lensId: lens.id });
    showToast(`Light experiment open for ${lens.name}.`);
    return;
  }
  if (action === 'emit-thought-light') {
    const lens = lightLens();
    if (!lens) throw new Error('Add a lensing source and press Open light first.');
    if (activeExperiment !== 'light') {
      openExperiment('light');
    }
    const emitter = document.querySelector('#emit-light-signal');
    if (!emitter) return;
    emitter.click();
    return;
  }
  if (action === 'inspect-orbit') {
    const body = system.body(scientistTargetId);
    if (!body) throw new Error('Place the Earth analogue before inspecting its orbit.');
    scenarioWidthM = null;
    cameraTargetId = null;
    cameraMode = 'eye';
    cameraOrbit = { ...CAMERA_VIEWS.eye };
    const orbit = orbitForBody(body);
    if (!orbit) throw new Error('This world does not yet have a host orbit to read.');
    scientistTutorial?.record('orbit-inspected', { bodyId: body.id });
    const workbench = document.querySelector('#scientist-variable-guide');
    workbench?.classList.remove('is-confirmed');
    requestAnimationFrame(() => workbench?.classList.add('is-confirmed'));
    updateReadouts();
    return;
  }
  if (action === 'frame-moon') {
    const moon = system.body('moon');
    if (!moon) throw new Error('The prepared Moon record is unavailable. Restart the lesson.');
    scientistTargetId = moon.id;
    scaleMode = 'lunar';
    selectedId = moon.id;
    cameraTargetId = moon.id;
    cameraMode = 'track';
    cameraOrbit = { ...CAMERA_VIEWS.eye, zoom: 2.1 };
    closeInspector({ clearSelection: false });
    scientistTutorial?.record('baseline-inspected', { bodyId: moon.id });
    updateReadouts();
    return;
  }
  if (action === 'open-mass') {
    const moon = system.body('moon');
    if (!moon) throw new Error('The prepared Moon record is unavailable. Restart the lesson.');
    scientistTargetId = moon.id;
    selectedId = moon.id;
    closeInspector({ clearSelection: false });
    updateReadouts();
    requestAnimationFrame(() => {
      document.querySelector('#scientist-variable-slider')?.focus({ preventScroll: true });
    });
    return;
  }
  if (action === 'run-system') {
    setTimeWarp(1, { announce: false });
    running = true;
    if (lessonId === 'stable-orbit') {
      scenarioWidthM = null;
      cameraTargetId = null;
      cameraMode = 'eye';
      cameraOrbit = { ...CAMERA_VIEWS.eye };
    } else if (lessonId === 'everyday-physics') {
      cameraTargetId = scientistTargetId || 'vehicle';
      cameraMode = 'track';
      cameraOrbit = { ...CAMERA_VIEWS.eye };
    } else {
      cameraTargetId = 'moon';
      cameraMode = 'track';
      cameraOrbit = { ...CAMERA_VIEWS.eye, zoom: 2.1 };
    }
    if (lessonId === 'barycenter') closeInspector({ clearSelection: false });
    updateReadouts();
    recordScientistSimulationRun();
    showToast('Simulation running at one day per second. Keep watching until the evidence step advances.');
    return;
  }
  if (action === 'show-gravity') {
    fieldLayer = 'gravity';
    document.querySelector('#field-layer').value = 'gravity';
    openExperiment('magnetic');
    if (lessonId === 'barycenter') scaleMode = 'lunar';
  }
  if (action === 'open-relativity') {
    closeInspector();
    relativityVelocityFraction = .1;
    ensureRelativityWorkspaceAndEvents({ announce: false });
    setRelativityWizardStep(0, { announce: false });
    relativityActiveFrame = 'sun';
    scenarioWidthM = AU_M * 2.4;
    cameraTargetId = null;
    cameraMode = 'orbit';
    cameraOrbit = { ...CAMERA_VIEWS.top };
    relativityShowSignalTravel = false;
    openExperiment('relativity');
    scientistTutorial?.record('relativity-opened', relativityThoughtSnapshot());
    showToast('Relativity open: deterministic Sun-Earth-Mars setup anchored at t = 0 in the Sun frame.');
    return;
  }
  if (action === 'set-reference-frame-heliocentric') {
    setFrameReferenceMode('heliocentric');
    scientistTutorial?.record('frame-reference-set', { mode: 'heliocentric' });
    return;
  }
  if (action === 'set-reference-frame-galactocentric') {
    setFrameReferenceMode('galactocentric');
    scientistTutorial?.record('frame-reference-set', { mode: 'galactocentric' });
    return;
  }
  if (action === 'relativity-advance-step') {
    if (typeof detail?.step === 'number') setRelativityWizardStep(detail.step);
    return;
  }
  if (action === 'relativity-frame-switch') {
    if (detail?.frame) setRelativityActiveFrame(detail.frame);
    return;
  }
  if (action === 'place-relativity-a') {
    selectedId = 'earth';
    anchorRelativityEventToSelectedBody('a');
    return;
  }
  if (action === 'place-relativity-b') {
    selectedId = 'mars';
    anchorRelativityEventToSelectedBody('b');
    return;
  }
  if (action === 'launch-relativity-rocket') {
    launchRelativityRocket();
    return;
  }
  if (action === 'review-relativity-equation') {
    const snapshot = relativityThoughtSnapshot();
    scientistTutorial?.record('relativity-equation-reviewed', snapshot);
    showToast(`Lorentz term reviewed: Mars is earlier by ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} seconds in the rocket frame.`);
  }
}

function worldToScreen(positionM) {
  const projected = solarRenderer.project(positionM);
  if (projected) return projected;
  const view = renderedView;
  const aspect = sceneViewport.width / sceneViewport.height;
  const widthM = view.widthM;
  const heightM = widthM / aspect;
  return [
    sceneViewport.width * 0.5 + (positionM[0] - view.center[0]) / widthM * sceneViewport.width,
    sceneViewport.height * 0.5 - (positionM[1] - view.center[1]) / heightM * sceneViewport.height
  ];
}

function markerRadius(body) {
  if (scaleMode === 'body') {
    const view = viewDefinition();
    return body.id === focusedId ? Math.max(18, innerWidth * body.radiusM / view.widthM) : 3;
  }
  if (body.type === 'tracer') return 2;
  if (visualRadiusMode === 'physical-ratio') {
    const largestRadiusM = scaleMode === 'lunar' && system.body('earth')
      ? system.body('earth').radiusM
      : Math.max(...system.bodies.map((candidate) => candidate.radiusM || 1));
    const anchorPx = scaleMode === 'system' ? 22 : scaleMode === 'lunar' ? 22 : 40;
    return Math.max(.65, anchorPx * body.radiusM / largestRadiusM) * cameraOrbit.zoom;
  }
  const earthRadiusM = 6_371_008.4;
  const earthMarkerPx = scaleMode === 'system' ? 3.5 : scaleMode === 'lunar' ? 21 : 7;
  const compressedRatio = Math.pow(Math.max(body.radiusM, 1) / earthRadiusM, .36);
  return THREElessClamp(earthMarkerPx * compressedRatio, 2, scaleMode === 'lunar' ? 42 : 40) * cameraOrbit.zoom;
}

function THREElessClamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function clearOverlay() {
  context.clearRect(0, 0, innerWidth, innerHeight);
  canvas.dataset.gravityVectors = '0';
}

function drawBarycenter() {
  if (scaleMode !== 'lunar' || !system.body('earth') || !system.body('moon')) return;
  const point = system.barycenter(['earth', 'moon']);
  const [x, y] = worldToScreen(point);
  context.save();
  context.strokeStyle = '#efc47f';
  context.fillStyle = '#efc47f';
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(x - 7, y); context.lineTo(x + 7, y); context.stroke();
  context.beginPath(); context.moveTo(x, y - 7); context.lineTo(x, y + 7); context.stroke();
  context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.stroke();
  context.font = '600 13px system-ui, sans-serif';
  context.fillText('Balance point', x + 12, y - 18);
  context.restore();
}

function drawMagneticOverlay() {
  if (activeExperiment !== 'magnetic' || fieldLayer !== 'magnetic' || magneticMode === 'none') return;
  const earth = system.body('earth');
  if (!earth) return;
  const multiplier = magneticPreset(magneticMode).multiplier;
  const lines = dipoleFieldLines({
    radiusM: earth.radiusM,
    tiltRad: earth.axialTiltRad,
    shells: multiplier > 1 ? [2.5, 4, 6, 8] : [2, 3, 4.5, 6]
  });
  context.save();
  context.strokeStyle = multiplier > 1 ? 'rgba(129,193,255,.68)' : 'rgba(116,214,255,.48)';
  context.lineWidth = multiplier > 1 ? 1.25 : .8;
  for (const line of lines) {
    context.beginPath();
    line.forEach((point, index) => {
      const [x, y] = worldToScreen([earth.positionM[0] + point[0], earth.positionM[1] + point[1], earth.positionM[2]]);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  }
  context.restore();
}

function currentGravityField() {
  const snapshot = system.snapshot();
  return gravityAccelerationField({
    bodies: system.bodies,
    uniformDensityKgM3: snapshot.fields.uniformDensityKgM3,
    uniformDensityOriginM: snapshot.fields.uniformDensityOriginM
  });
}

function gravityTarget(field) {
  const preferredId = selectedId && system.body(selectedId)
    ? selectedId
    : system.body('earth')?.id || system.bodies.find((body) => body.type !== 'star')?.id || system.bodies[0]?.id;
  return field.vectors.find((vector) => vector.id === preferredId) || field.vectors[0] || null;
}

function formatDarkMatterAcceleration(value) {
  return Number.isFinite(value)
    ? `${value.toExponential(3)} m/s²`
    : '— m/s²';
}

function drawGravityOverlay() {
  if (activeExperiment !== 'magnetic' || fieldLayer !== 'gravity' || system.bodies.length === 0) return;
  const field = currentGravityField();
  const positive = field.vectors.map((vector) => vector.magnitudeMps2).filter((value) => value > 0);
  const logMinimum = Math.log10(Math.min(...positive, 1));
  const logMaximum = Math.log10(Math.max(...positive, 1));
  const target = gravityTarget(field);
  context.save();
  context.lineWidth = 1.15;
  context.font = '7px ui-monospace, monospace';
  for (const vector of field.vectors) {
    if (vector.magnitudeMps2 <= 0) continue;
    const body = system.body(vector.id);
    if (!body) continue;
    const [startX, startY] = worldToScreen(body.positionM);
    if (startX < -60 || startX > innerWidth + 60 || startY < -60 || startY > innerHeight + 60) continue;
    const unit = vector.vectorMps2.map((value) => value / vector.magnitudeMps2);
    const directionPoint = body.positionM.map((value, axis) => value + unit[axis] * renderedView.widthM * .06);
    const [directionX, directionY] = worldToScreen(directionPoint);
    const screenMagnitude = Math.hypot(directionX - startX, directionY - startY);
    if (screenMagnitude < .25) continue;
    const normalized = logMaximum === logMinimum ? .5 : (Math.log10(vector.magnitudeMps2) - logMinimum) / (logMaximum - logMinimum);
    const length = 24 + normalized * 34;
    const directionScreenX = (directionX - startX) / screenMagnitude;
    const directionScreenY = (directionY - startY) / screenMagnitude;
    const endX = startX + directionScreenX * length;
    const endY = startY + directionScreenY * length;
    const isTarget = vector.id === target?.id;
    context.strokeStyle = isTarget ? '#73d7a6' : 'rgba(115,215,166,.48)';
    context.fillStyle = context.strokeStyle;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    const head = isTarget ? 6 : 4.5;
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - directionScreenX * head - directionScreenY * head * .55, endY - directionScreenY * head + directionScreenX * head * .55);
    context.lineTo(endX - directionScreenX * head + directionScreenY * head * .55, endY - directionScreenY * head - directionScreenX * head * .55);
    context.closePath();
    context.fill();
    if (isTarget) context.fillText(`${vector.magnitudeMps2.toExponential(2)} m/s²`, endX + 7, endY - 5);
  }
  canvas.dataset.gravityVectors = String(field.vectors.length);
  context.restore();
}

function drawDarkMatterOverlay() {
  if (activeExperiment !== 'dark-matter' || darkMatterMode === 'none') return;
  const preset = darkMatterPreset(darkMatterMode);
  const [originX, originY] = worldToScreen([0, 0, 0]);
  context.save();
  const exaggerated = darkMatterMode === 'uniform-exaggerated';
  context.strokeStyle = exaggerated ? 'rgba(166,145,239,.38)' : 'rgba(166,145,239,.16)';
  context.fillStyle = exaggerated ? 'rgba(166,145,239,.045)' : 'rgba(166,145,239,.018)';
  for (const fraction of [.22, .42, .62, .82]) {
    const edge = worldToScreen([AU_M * fraction, 0, 0]);
    const radius = Math.abs(edge[0] - originX);
    context.beginPath(); context.arc(originX, originY, radius, 0, Math.PI * 2); context.fill(); context.stroke();
  }
  context.fillStyle = exaggerated ? '#b5a3f5' : '#776aab';
  const guided = Boolean(scientistTutorial?.state?.lessonId);
  context.font = guided ? '500 12px system-ui, sans-serif' : '7px ui-monospace, monospace';
  context.fillText(
    guided ? (exaggerated ? 'Extra gravity · magnified' : 'Local estimate · a tiny effect')
      : (exaggerated ? 'EXAGGERATED UNIFORM DENSITY' : 'LOCAL ESTIMATE · EFFECT NEGLIGIBLE'),
    guided ? 16 : originX + 38, guided ? 26 : originY - 70
  );
  context.restore();
  void preset;
}

function isBlackHoleBody(body) {
  return Boolean(body?.flags?.includes('black-hole') || body?.flags?.includes('preset:black-hole'));
}

function isCompactBinaryToyScenario(body) {
  return Boolean(body && (body.flags?.includes('compact-binary-proxy') || scenarioMode === 'compact-binary-inspiral'));
}

function lightLens() {
  const pinned = lightLensId ? system.body(lightLensId) : null;
  if (pinned?.massKg > 0) return pinned;
  const selected = selectedId ? system.body(selectedId) : null;
  if (selected?.massKg > 0 && selected.type === 'star') return selected;
  return system.bodies.find(isBlackHoleBody) || system.body('sun') || system.bodies.find((body) => body.type === 'star' && body.massKg > 0) || null;
}

function lightPathForLens(lens) {
  if (!lens) return null;
  if (isBlackHoleBody(lens)) {
    const path = schwarzschildLightPath({
      massKg: lens.massKg,
      impactParameterM: lens.radiusM * lightImpactRadii,
      extentSchwarzschildRadii: 30,
      samples: 181
    });
    return { ...path, trueDeflection: path.deflection, unit: 'Rₛ', kind: 'schwarzschild' };
  }
  const path = weakFieldLightPath({
    massKg: lens.massKg,
    impactParameterM: lens.radiusM * lightImpactRadii,
    extentM: lens.radiusM * 8,
    visualExaggeration: lightVisualExaggeration
  });
  return { ...path, unit: 'R☉', kind: 'weak-field' };
}

function lightWaveParticipantBodies(lens) {
  const placed = system.bodies.filter((body) => body.id !== lens.id);
  if (placed.length === 0) return { source: null, observer: null };
  const selected = selectedId ? system.body(selectedId) : null;
  const source = selected && selected.id !== lens.id ? selected : placed[0];
  const cameraBody = cameraTargetId ? system.body(cameraTargetId) : null;
  let observer = (
    cameraBody
    && cameraBody.id !== lens.id
    && cameraBody.id !== source.id
  )
    ? cameraBody
    : placed.find((body) => body.id !== source.id) || null;
  if (!observer && scientistTutorial?.state?.lessonId === 'everyday-physics') {
    observer = {
      id: 'lesson-reference-detector', name: 'Stationary detector',
      positionM: [lens.positionM[0] + AU_M, lens.positionM[1] + AU_M, lens.positionM[2]],
      velocityMps: [...lens.velocityMps]
    };
  }
  return { source, observer };
}

function drawScreenWave(screenPoints, color, phase) {
  context.strokeStyle = color;
  context.lineWidth = 1.15;
  context.beginPath();
  screenPoints.forEach((point, index) => {
    const previous = screenPoints[Math.max(0, index - 1)];
    const next = screenPoints[Math.min(screenPoints.length - 1, index + 1)];
    const length = Math.max(1e-6, Math.hypot(next[0] - previous[0], next[1] - previous[1]));
    const normalX = -(next[1] - previous[1]) / length;
    const normalY = (next[0] - previous[0]) / length;
    const amplitude = Math.sin(index * .58 - lightPulsePhase * Math.PI * 14 + phase) * 2.8;
    const x = point[0] + normalX * amplitude;
    const y = point[1] + normalY * amplitude;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
}

function ringPulseAlpha(index, total) {
  const progress = 1 - index / (total + 1);
  return Math.max(0.32, Math.min(0.88, progress));
}

function ringRippleWave(index) {
  return Math.max(0.3, 1 - index * 0.16);
}

function drawLightOverlay() {
  if (activeExperiment !== 'light') return;
  const lens = lightLens();
  const path = lightPathForLens(lens);
  if (!lens || !path) return;
  const screenPoints = path.points.map((point) => worldToScreen([
    lens.positionM[0] + point[0], lens.positionM[1] + point[1], lens.positionM[2]
  ]));
  context.save();
  context.strokeStyle = isBlackHoleBody(lens) ? '#ffbd70' : '#fff4b2';
  context.shadowColor = '#fff4b2';
  context.shadowBlur = 8;
  context.lineWidth = 1.2;
  context.beginPath();
  screenPoints.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
  context.shadowBlur = 3;
  drawScreenWave(screenPoints, 'rgba(111,214,255,.82)', 0);
  drawScreenWave(screenPoints, 'rgba(255,193,92,.78)', Math.PI / 2);
  if (isCompactBinaryToyScenario(lens)) {
    const compactBodies = system.bodies.filter((body) => body.flags?.includes('compact-binary-proxy'));
    if (compactBodies.length >= 2) {
      const separationVector = compactBodies.map((body) => body.positionM);
      const separationX = separationVector[0][0] - separationVector[1][0];
      const separationY = separationVector[0][1] - separationVector[1][1];
      const separationZ = separationVector[0][2] - separationVector[1][2];
      const separationM = Math.hypot(separationX, separationY, separationZ);
      const centerM = [
        (separationVector[0][0] + separationVector[1][0]) / 2,
        (separationVector[0][1] + separationVector[1][1]) / 2,
        (separationVector[0][2] + separationVector[1][2]) / 2
      ];
      const grid = compactBinaryInspiralGridRipple({
        centerM,
        separationM,
        timeSeconds: system.timeSeconds,
        ringCount: 4,
        samples: 88
      });
      const rippleTextPoint = screenPoints[Math.floor(screenPoints.length * 0.15)];
      context.fillStyle = 'rgba(167,224,255,.84)';
      context.font = '7px ui-monospace, monospace';
      context.fillText(`3D GPU SPACETIME SHEET · ${grid.rings.length} ANALYTIC PHASE RINGS`, rippleTextPoint[0] + 8, rippleTextPoint[1] + 9);
      context.fillText('Illustrative geometry · no GR field or radiative back-reaction', rippleTextPoint[0] + 8, rippleTextPoint[1] + 18);
    }
  }
  const photonIndex = Math.min(path.points.length - 1, Math.floor(lightPulsePhase * path.points.length));
  const [photonX, photonY] = screenPoints[photonIndex];
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(photonX, photonY, 3.2, 0, Math.PI * 2);
  context.fill();
  canvas.dataset.lightPulse = lightPulsePhase.toFixed(4);
  canvas.dataset.lightModel = path.kind;
  context.shadowBlur = 0;
  if (scientistTutorial?.state?.lessonId) {
    context.textAlign = 'center';
    context.fillStyle = '#f4e5a5';
    context.font = '500 13px system-ui, sans-serif';
    context.fillText('Light bends near the star', sceneViewport.width / 2, 26);
    context.fillStyle = '#b9c9c3';
    context.font = '12px system-ui, sans-serif';
    context.fillText('Bend enlarged for visibility', sceneViewport.width / 2, sceneViewport.height - 18);
    context.restore();
    return;
  }
  const [labelX, labelY] = screenPoints[Math.floor(screenPoints.length * .88)];
  context.fillStyle = '#fff4b2';
  context.font = '7px ui-monospace, monospace';
  const deflectionLabel = isCompactBinaryToyScenario(lens)
    ? 'INSPIRAL GRID RIPPLE · TOY VISUALIZATION'
    : path.kind === 'schwarzschild'
    ? `${path.trueDeflection.degrees.toFixed(2)}° SCHWARZSCHILD DEFLECTION`
    : `${path.trueDeflection.arcseconds.toFixed(3)} ARCSEC · PATH ${lightVisualExaggeration.toLocaleString()}×`;
  context.fillText(deflectionLabel, labelX + 8, labelY - 15);
  if (!isCompactBinaryToyScenario(lens)) {
    context.fillStyle = 'rgba(151,220,255,.82)';
    context.fillText('EM OSCILLATION · FIELD AMPLITUDE ILLUSTRATIVE', labelX + 8, labelY - 3);
  }
  context.restore();
}

function relativityThoughtSnapshot() {
  return simultaneitySnapshot({
    eventA: relativityEvents.a,
    eventB: relativityEvents.b,
    beta: relativityVelocityFraction
  });
}

function resetRelativityEvents({ announce = true } = {}) {
  relativityEvents = { a: null, b: null };
  relativityPlacementTarget = null;
  relativityRocketBodyId = null;
  relativityWizardStep = 0;
  relativityPhase = 0;
  running = false;
  relativityActiveFrame = 'sun';
  setRelativityWizardStep(0, { announce: false });
  document.querySelectorAll('[data-relativity-event]').forEach((button) => button.classList.remove('is-armed'));
  updateRelativityExperiment();
  if (announce) showToast('Relativity events cleared. Place the Earth and Mars explosions again.');
}

function ensureRelativityWorkspaceAndEvents({ announce = true } = {}) {
  const hasAllBodies = system.body('sun') && system.body('earth') && system.body('mars');
  if (!hasAllBodies) {
    loadScenario('jpl-system', { announce: false, startRunning: false });
    if (announce) showToast('Deterministic Sun-Earth-Mars workspace loaded for relativity.');
  }
  const earth = system.body('earth');
  const mars = system.body('mars');
  if (!earth || !mars) return;
  relativityEvents = {
    a: {
      ...RELATIVITY_DEFAULT_EVENTS.a,
      positionM: [...earth.positionM],
      sunFrameTimeSeconds: 0,
      anchorBodyId: earth.id
    },
    b: {
      ...RELATIVITY_DEFAULT_EVENTS.b,
      positionM: [...mars.positionM],
      sunFrameTimeSeconds: 0,
      anchorBodyId: mars.id
    }
  };
  relativityPlacementTarget = null;
  relativityRocketBodyId = null;
  relativityPhase = 0;
  running = false;
  const snapshot = relativityThoughtSnapshot();
  scientistTutorial?.record('relativity-event-placed', { eventId: 'a', ...snapshot });
  scientistTutorial?.record('relativity-event-placed', { eventId: 'b', ...snapshot });
  if (announce) showToast('Events A and B anchored to Earth and Mars at Sun-frame t = 0.');
}

function runRelativityAutoExperiment({ announce = true } = {}) {
  if (activeExperiment !== 'relativity') {
    openExperiment('relativity');
    return runRelativityAutoExperiment({ announce: false });
  }
  ensureRelativityWorkspaceAndEvents({ announce: false });
  const earth = system.body('earth');
  const mars = system.body('mars');
  if (!earth || !mars) {
    showToast('Relativity auto-run needs Sun-Earth-Mars bodies. Try opening from the JPL system first.');
    return;
  }
  relativityVelocityFraction = Math.min(0.5, Math.max(0.01, relativityVelocityFraction || 0.1));
  setRelativityWizardStep(2, { announce: false });
  launchRelativityRocket();
  setRelativityActiveFrame('rocket');
  cameraTargetId = earth.id;
  cameraMode = 'track';
  cameraOrbit = { ...CAMERA_VIEWS.eye };
  stepAccumulator = 0;
  if (announce) {
    const delta = relativityThoughtSnapshot().rocketFrameDeltaSeconds;
    showToast(`Relativity auto-run started: Event B is earlier in the Rocket frame by ${delta.toFixed(1)} s.`);
  }
  updateReadouts();
}

function relativityCanAdvanceFromStep(stepKey, snapshot) {
  if (stepKey === 'setup') return snapshot.ready;
  if (stepKey === 'sun-frame') return snapshot.ready;
  if (stepKey === 'launch') return snapshot.ready && Boolean(relativityRocketBodyId);
  if (stepKey === 'rocket-frame') return snapshot.ready && Boolean(relativityRocketBodyId);
  return true;
}

function setRelativityWizardStep(nextIndex, { announce = false } = {}) {
  const safeIndex = Math.max(0, Math.min(RELATIVITY_WIZARD_STEPS.length - 1, Number.isFinite(nextIndex) ? nextIndex : 0));
  relativityWizardStep = safeIndex;
  const section = document.querySelector('[data-experiment-content="relativity"]');
  const current = RELATIVITY_WIZARD_STEPS[safeIndex];
  if (!section) return;
  const title = section.querySelector('#relativity-step-title');
  const copy = section.querySelector('#relativity-step-copy');
  const indexLabel = section.querySelector('#relativity-step-index');
  section.querySelectorAll('[data-relativity-step]').forEach((step) => {
    step.hidden = step.dataset.relativityStep !== current;
  });
  if (title) {
    title.textContent = current === 'setup'
      ? 'Setup'
      : current === 'sun-frame'
        ? 'Sun frame'
        : current === 'launch'
          ? 'Launch rocket'
          : current === 'rocket-frame'
            ? 'Rocket frame'
            : 'Compare';
  }
  if (copy) {
    copy.textContent = current === 'setup'
      ? 'Event A and Event B are pre-anchored at Sun-frame t = 0 by default.'
      : current === 'sun-frame'
        ? 'Keep Sun-frame order visible: both flashes are simultaneous at t = 0. Use selected-body or grid controls to redefine events.'
        : current === 'launch'
          ? 'Launch from Event A toward Event B and compare the two frames.'
          : current === 'rocket-frame'
            ? 'In the rocket frame, Event B appears first then Event A.'
            : 'Review both overlays and keep frame logic in mind.';
  }
  if (indexLabel) indexLabel.textContent = `${safeIndex + 1} / ${RELATIVITY_WIZARD_STEPS.length}`;
  if (current === 'sun-frame' && relativityActiveFrame !== 'sun') {
    setRelativityActiveFrame('sun');
  } else if (current === 'rocket-frame' && relativityActiveFrame !== 'rocket') {
    setRelativityActiveFrame('rocket');
  }
  if (announce) {
    showToast(`Relativity step: ${title ? title.textContent : current}`);
  }
  const snapshot = relativityThoughtSnapshot();
  const canContinue = relativityCanAdvanceFromStep(current, snapshot);
  const nextButton = section.querySelector(`#relativity-step-${current}-next`);
  if (nextButton) nextButton.disabled = !canContinue && current !== 'setup';
  if (nextButton) {
    if (current === 'setup') nextButton.textContent = 'Continue to Sun frame';
    else if (current === 'sun-frame') nextButton.textContent = 'Continue to Launch rocket';
    else if (current === 'launch') nextButton.textContent = 'Continue to Rocket frame';
    else if (current === 'rocket-frame') nextButton.textContent = 'Continue to Compare';
    else nextButton.textContent = 'Done';
  }
  updateRelativityExperiment();
}

function setRelativityActiveFrame(nextFrame) {
  if (nextFrame !== 'sun' && nextFrame !== 'rocket') return;
  relativityActiveFrame = nextFrame;
  const sunButton = document.querySelector('#relativity-frame-sun');
  const rocketButton = document.querySelector('#relativity-frame-rocket');
  if (sunButton) {
    sunButton.classList.toggle('is-active', nextFrame === 'sun');
    sunButton.setAttribute('aria-pressed', String(nextFrame === 'sun'));
  }
  if (rocketButton) {
    rocketButton.classList.toggle('is-active', nextFrame === 'rocket');
    rocketButton.setAttribute('aria-pressed', String(nextFrame === 'rocket'));
  }
  updateRelativityExperiment();
}

function armRelativityEventPlacement(eventId) {
  if (!RELATIVITY_EVENT_IDS[eventId]) return;
  if (placementPresetId) cancelContentPlacement({ announce: false });
  relativityPlacementTarget = eventId;
  relativityRocketBodyId = null;
  document.querySelectorAll('[data-relativity-event]').forEach((button) => {
    button.classList.toggle('is-armed', button.dataset.relativityEvent === eventId);
  });
  const eventName = RELATIVITY_DEFAULT_EVENTS[eventId].name;
  showToast(`${eventName} armed. Click a visible point on the 3D grid.`);
  updateRelativityExperiment();
}

function anchorRelativityEventToSelectedBody(eventId) {
  if (!RELATIVITY_EVENT_IDS[eventId]) return;
  const body = selectedId ? system.body(selectedId) : null;
  if (!body) {
    showToast('Select a body first, then anchor Event A/B to it.');
    return;
  }
  relativityEvents = {
    ...relativityEvents,
    [eventId]: {
      ...RELATIVITY_DEFAULT_EVENTS[eventId],
      positionM: [...body.positionM],
      sunFrameTimeSeconds: 0,
      anchorBodyId: body.id,
      anchorBodyName: body.name
    }
  };
  relativityPlacementTarget = null;
  relativityRocketBodyId = null;
  relativityPhase = 0;
  running = false;
  document.querySelectorAll('[data-relativity-event]').forEach((button) => button.classList.remove('is-armed'));
  const snapshot = relativityThoughtSnapshot();
  scientistTutorial?.record('relativity-event-placed', {
    eventId,
    anchorBodyName: body.name,
    ...snapshot
  });
  showToast(`${RELATIVITY_DEFAULT_EVENTS[eventId].name} now anchored to ${body.name}. ${snapshot.placedEventCount}/2 events ready.`);
  if (snapshot.ready && relativityWizardStep < 1) setRelativityWizardStep(1);
  updateRelativityExperiment();
}

function placeRelativityEvent(eventId, positionM) {
  if (!RELATIVITY_EVENT_IDS[eventId] || !Array.isArray(positionM)) return;
  relativityEvents = {
    ...relativityEvents,
    [eventId]: {
      ...RELATIVITY_DEFAULT_EVENTS[eventId],
      positionM: positionM.map(Number),
      sunFrameTimeSeconds: 0,
      anchorBodyId: null
    }
  };
  relativityPlacementTarget = null;
  relativityRocketBodyId = null;
  relativityPhase = 0;
  running = false;
  document.querySelectorAll('[data-relativity-event]').forEach((button) => button.classList.remove('is-armed'));
  const snapshot = relativityThoughtSnapshot();
  scientistTutorial?.record('relativity-event-placed', { eventId, ...snapshot });
  showToast(`${RELATIVITY_DEFAULT_EVENTS[eventId].name} placed at Sun-frame t = 0. ${snapshot.placedEventCount}/2 events ready.`);
  if (snapshot.ready && relativityWizardStep < 1) setRelativityWizardStep(1);
  updateRelativityExperiment();
}

function launchRelativityRocket() {
  const snapshot = relativityThoughtSnapshot();
  if (!snapshot.ready) return showToast('Place both explosions before launching the rocket.');
  relativityRocketBodyId = 'simultaneity-rocket';
  relativityPhase = 0;
  running = true;
  setRelativityWizardStep(3);
  updateReadouts();
  scientistTutorial?.record('relativity-rocket-launched', snapshot);
    showToast(`Rocket playback started at ${snapshot.beta.toFixed(2)}c in the Rocket frame. Event B is earlier by ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} seconds.`);
}

function updateRelativityExperiment() {
  const control = document.querySelector('#relativity-speed');
  if (control) control.value = String(relativityVelocityFraction.toFixed(2));
  const snapshot = relativityThoughtSnapshot();
  document.querySelector('#experiment-fidelity').textContent = 'DERIVED';
  document.querySelector('#relativity-speed-output').textContent = `${snapshot.beta.toFixed(2)}c`;
  document.querySelector('#relativity-distance').textContent = `${snapshot.ready ? '' : 'Preview · '}${(snapshot.separationM / 1e9).toFixed(1)} million km`;
  document.querySelector('#relativity-light-delay').textContent = `${snapshot.lightCrossingSeconds.toFixed(1)} s`;
  document.querySelector('#relativity-order').textContent = snapshot.ready
    ? `Event A/B order offset in rocket frame: ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} s`
    : 'Place both events to calculate';
  document.querySelector('#relativity-equation').textContent = [
    `t'_A = γ(t_A - vx_A/c²)`,
    `t'_B = γ(t_B - vx_B/c²)`,
    `Δt' = γ(vL/c²) = ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} s`,
    `γ = ${snapshot.gamma.toFixed(4)}`
  ].join('\n');
  const launchButton = document.querySelector('#relativity-launch');
  if (launchButton) {
    launchButton.disabled = !snapshot.ready;
    launchButton.textContent = relativityRocketBodyId ? 'Replay rocket' : 'Launch rocket';
  }
  const status = document.querySelector('#relativity-placement-status');
  const eventAStatus = document.querySelector('#relativity-event-a-status');
  const eventBStatus = document.querySelector('#relativity-event-b-status');
  const eventAName = system.body(relativityEvents.a?.anchorBodyId)?.name || relativityEvents.a?.anchorBodyName || 'point in space';
  const eventBName = system.body(relativityEvents.b?.anchorBodyId)?.name || relativityEvents.b?.anchorBodyName || 'point in space';
  if (eventAStatus) eventAStatus.textContent = relativityEvents.a
    ? `EVENT A: ${relativityEvents.a.anchorBodyId ? `anchored to ${eventAName}` : 'repositioned'} (${relativityEvents.a.anchorBodyName || eventAName})`
    : 'EVENT A: not set';
  if (eventBStatus) eventBStatus.textContent = relativityEvents.b
    ? `EVENT B: ${relativityEvents.b.anchorBodyId ? `anchored to ${eventBName}` : 'repositioned'} (${relativityEvents.b.anchorBodyName || eventBName})`
    : 'EVENT B: not set';
  if (status) {
    status.textContent = relativityPlacementTarget
      ? `Placement armed: click the 3D grid for ${RELATIVITY_DEFAULT_EVENTS[relativityPlacementTarget].name}.`
      : snapshot.ready && relativityRocketBodyId
        ? `${running ? 'PLAYING' : 'PAUSED'} · ${relativityActiveFrame === 'rocket' ? 'ROCKET FRAME' : 'SUN FRAME'} · Use the bottom ${running ? 'Pause' : 'Run'} control for this same playback.`
      : snapshot.ready
        ? '2/2 events anchored at Sun-frame t = 0. Continue the wizard.'
        : 'Preparing event anchors from the current system.';
  }
  canvas.dataset.relativityBeta = snapshot.beta.toFixed(2);
  canvas.dataset.relativityDeltaSeconds = snapshot.rocketFrameDeltaSeconds.toFixed(1);
  canvas.dataset.relativityPlayback = relativityRocketBodyId ? (running ? 'running' : 'paused') : 'ready';
  canvas.dataset.relativityFrame = relativityActiveFrame;
  canvas.dataset.relativityTimeline = 'ILLUSTRATIVE normalized event timeline; not signal-arrival timing';
  const rocketOrder = document.querySelector('#relativity-rocket-order');
  if (rocketOrder) {
    rocketOrder.textContent = snapshot.ready
      ? `Mars flash first by ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} s`
      : 'Launch the rocket to compute frame order.';
  }
  const sunSummary = document.querySelector('#relativity-sun-frame-summary');
  const rocketSummary = document.querySelector('#relativity-rocket-frame-summary');
  if (sunSummary) sunSummary.textContent = 'Event A and Event B are simultaneous in the Sun frame: t = 0.';
  if (rocketSummary) rocketSummary.textContent = snapshot.ready
    ? `Rocket-frame order: Event B first by Δt′ = ${snapshot.rocketFrameDeltaSeconds.toFixed(1)} s`
    : 'Compute from current event separation and β.';
  const signalCheckbox = document.querySelector('#relativity-show-signal-travel');
  if (signalCheckbox) relativityShowSignalTravel = signalCheckbox.checked;
  const frameButton = document.querySelector(`#relativity-step-${RELATIVITY_WIZARD_STEPS[Math.max(0, Math.min(RELATIVITY_WIZARD_STEPS.length - 1, relativityWizardStep))]}-next`);
  if (frameButton) {
    const current = RELATIVITY_WIZARD_STEPS[Math.max(0, Math.min(RELATIVITY_WIZARD_STEPS.length - 1, relativityWizardStep))];
    frameButton.disabled = !relativityCanAdvanceFromStep(current, snapshot);
  }
}

function drawPlacedRelativityRoute(snapshot) {
  if (!snapshot.ready) return;
  const timeline = simultaneityPlayback({ phase: relativityPhase, snapshot });
  const eventA = worldToScreen(relativityEvents.a.positionM);
  const eventB = worldToScreen(relativityEvents.b.positionM);
  const rocketPositionM = rocketPositionBetween(relativityEvents.a, relativityEvents.b, (relativityPhase * .92 + .04) % 1);
  const rocket = rocketPositionM ? worldToScreen(rocketPositionM) : null;
  const isRocketFrame = relativityActiveFrame === 'rocket';
  context.save();
  context.setLineDash([5, 6]);
  context.strokeStyle = 'rgba(246,160,255,.56)';
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(...eventA);
  context.lineTo(...eventB);
  context.stroke();
  context.setLineDash([]);
  [
    {
      point: eventA,
      color: '#83c7ff',
      label: isRocketFrame ? 'EVENT A · second' : 'EVENT A · t=0'
    },
    {
      point: eventB,
      color: '#efc47f',
      label: isRocketFrame ? 'EVENT B · first' : 'EVENT B · t=0'
    }
  ].forEach(({ point, color, label }, index) => {
    const flash = isRocketFrame
      ? (index === 0 ? timeline.rocket.earth : timeline.rocket.mars)
      : timeline.sun[index === 0 ? 'earth' : 'mars'];
    const burst = 8 + flash * 24;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 8 + flash * 30;
    context.beginPath();
    context.arc(point[0], point[1], burst, 0, Math.PI * 2);
    context.stroke();
    if (flash > 0) {
      context.globalAlpha = .16 + flash * .34;
      context.beginPath();
      context.arc(point[0], point[1], burst * 1.45, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    context.beginPath();
    context.arc(point[0], point[1], 3, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.font = scientistTutorial?.state?.lessonId ? '600 12px system-ui, sans-serif' : '600 9px ui-monospace, monospace';
    context.fillText(label, point[0] + 13, point[1] - 10);
  });
  if (rocket && relativityRocketBodyId) {
    context.translate(rocket[0], rocket[1]);
    context.fillStyle = '#f1eee7';
    context.beginPath();
    context.moveTo(11, 0);
    context.lineTo(-9, -6);
    context.lineTo(-6, 0);
    context.lineTo(-9, 6);
    context.closePath();
    context.fill();
    context.fillStyle = '#f6a0ff';
    context.fillText(`${snapshot.beta.toFixed(2)}c`, 14, -8);
  }
  context.restore();
}

function relativityRocketScreenPoint() {
  const snapshot = relativityThoughtSnapshot();
  if (!snapshot.ready || !relativityRocketBodyId) return null;
  const rocketPositionM = rocketPositionBetween(relativityEvents.a, relativityEvents.b, (relativityPhase * .92 + .04) % 1);
  return rocketPositionM ? worldToScreen(rocketPositionM) : null;
}

function drawRelativityOverlay() {
  if (activeExperiment !== 'relativity') return;
  const snapshot = relativityThoughtSnapshot();
  const timeline = simultaneityPlayback({ phase: relativityPhase, snapshot });
  const showSignals = Boolean(relativityShowSignalTravel);
  drawPlacedRelativityRoute(snapshot);
  // Lessons use the labelled 3D event pair. The second, editor-only timeline
  // duplicated those marks and overflowed narrow screens.
  if (scientistTutorial?.state?.lessonId && !developerMode) return;
  const width = innerWidth;
  const height = innerHeight;
  const leftX = Math.max(210, width * .24);
  const rightX = Math.min(width - 230, width * .76);
  const axisY = height * .51;
  const diagramTop = Math.max(115, height * .18);
  const diagramBottom = Math.min(height - 210, height * .75);
  const rocketX = leftX + (rightX - leftX) * ((relativityPhase * .72 + .08) % 1);
  const slope = -snapshot.beta * .38;
  const frameIsRocket = relativityActiveFrame === 'rocket';
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = 'rgba(132,177,208,.28)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(leftX, axisY);
  context.lineTo(rightX, axisY);
  context.stroke();

  for (const [index, event] of [
    { x: leftX, label: 'EARTH FLASH', color: '#83c7ff' },
    { x: rightX, label: 'MARS FLASH', color: '#efc47f' }
  ].entries()) {
    const flash = frameIsRocket
      ? (index === 0 ? timeline.rocket.earth : timeline.rocket.mars)
      : timeline.sun[index === 0 ? 'earth' : 'mars'];
    context.strokeStyle = event.color;
    context.fillStyle = event.color;
    context.shadowColor = event.color;
    context.shadowBlur = 7 + flash * 28;
    context.beginPath();
    context.moveTo(event.x, axisY - 38);
    context.lineTo(event.x, axisY + 38);
    context.stroke();
    context.beginPath();
    context.arc(event.x, axisY, 5 + flash * 13, 0, Math.PI * 2);
    context.fill();
    if (flash > 0) {
      context.globalAlpha = .16 + flash * .34;
      context.beginPath();
      context.arc(event.x, axisY, 13 + flash * 22, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    context.shadowBlur = 0;
    context.font = '600 8px ui-monospace, monospace';
    context.fillText(event.label, event.x - 42, axisY + 58);
  }

  if (showSignals) {
    const signalProgress = (relativityPhase * 1.35) % 1;
    const earthSignalX = leftX + (rocketX - leftX) * signalProgress;
    const marsSignalX = rightX - (rightX - rocketX) * signalProgress;
    context.strokeStyle = 'rgba(255,244,178,.76)';
    context.lineWidth = 1.1;
    for (const x of [earthSignalX, marsSignalX]) {
      context.beginPath();
      context.arc(x, axisY, 11, 0, Math.PI * 2);
      context.stroke();
    }
    context.strokeStyle = 'rgba(111,214,255,.58)';
    for (let index = 0; index < 9; index += 1) {
      const crest = rightX - ((rightX - rocketX + index * 30 + relativityPhase * 80) % Math.max(30, rightX - rocketX + 240));
      if (crest < rocketX || crest > rightX + 20) continue;
      context.beginPath();
      context.moveTo(crest, axisY - 18);
      context.lineTo(crest, axisY + 18);
      context.stroke();
    }
  }

  context.fillStyle = '#f1eee7';
  context.beginPath();
  context.moveTo(rocketX + 12, axisY);
  context.lineTo(rocketX - 10, axisY - 7);
  context.lineTo(rocketX - 7, axisY);
  context.lineTo(rocketX - 10, axisY + 7);
  context.closePath();
  context.fill();
  context.font = '600 8px ui-monospace, monospace';
  context.fillText(`ROCKET ${snapshot.beta.toFixed(2)}c`, rocketX + 15, axisY - 14);

  const centerX = (leftX + rightX) / 2;
  const centerY = diagramTop + 18;
  context.strokeStyle = 'rgba(115,215,166,.75)';
  context.lineWidth = 1.3;
  context.beginPath();
  context.moveTo(leftX, centerY + (leftX - centerX) * slope);
  context.lineTo(rightX, centerY + (rightX - centerX) * slope);
  context.stroke();
  context.fillStyle = '#73d7a6';
  context.fillText('ROCKET NOW SLICE TILTS ACROSS DISTANT SPACE', leftX, centerY - 14);

  context.strokeStyle = 'rgba(239,196,127,.34)';
  context.setLineDash([4, 5]);
  context.beginPath();
  context.moveTo(rightX, diagramTop);
  context.lineTo(rightX, diagramBottom);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#efc47f';
  context.fillText(`MARS EVENT: t' = -${snapshot.rocketFrameDeltaSeconds.toFixed(1)} s`, rightX - 90, centerY + (rightX - centerX) * slope + 25);

  context.fillStyle = 'rgba(241,238,231,.88)';
  context.font = '600 9px ui-monospace, monospace';
  context.fillText(frameIsRocket
    ? 'ROCKET FRAME: MARS FLASHES FIRST, EARTH SECOND'
    : 'SUN FRAME: BOTH FLASHES SIMULTANEOUS AT t = 0',
  leftX, axisY - 58);
  context.fillStyle = 'rgba(135,146,156,.92)';
  context.font = '8px ui-monospace, monospace';
  context.fillText(showSignals
    ? 'Yellow rings = light-arrival timing; cyan crests = signal cycle progression; green = simultaneity line.'
    : 'Green line = simultaneity line. Signal travel details are hidden.', leftX, axisY - 43);
  context.fillText('ILLUSTRATIVE normalized event timeline — not signal-arrival timing.', leftX, axisY - 29);
  context.restore();
}

function drawExperimentOverlay() {
  drawDarkMatterOverlay();
  drawLightOverlay();
  drawRelativityOverlay();
  drawGravityOverlay();
  drawMagneticOverlay();
}

function queueCollisionEffects(nowMs) {
  for (const event of system.events) {
    if (event.type !== 'collision.merged' || !event.impactPositionM) continue;
    const key = `${event.revision}:${event.timeSeconds}:${event.survivorId}:${event.absorbedId}`;
    if (processedCollisionEvents.has(key)) continue;
    processedCollisionEvents.add(key);
    lastCollisionEvent = event;
    collisionEffects.push({ ...event, key, startedAtMs: nowMs });
    const speedKmps = event.relativeSpeedMps / 1000;
    scientistTutorial?.record('collision-observed', {
      relativeSpeedMps: event.relativeSpeedMps,
      totalMassKg: event.totalMassKg,
      preImpactCount: event.preImpact?.length || 0,
      presentation: event.presentation
    });
    showToast(`Impact computed at ${speedKmps.toFixed(1)} km/s. Mass and momentum merged; flash and debris are illustrative.`);
  }
}

function drawCollisionEffects(nowMs) {
  const durationMs = 5_200;
  for (const effect of collisionEffects) {
    const ageMs = nowMs - effect.startedAtMs;
    if (ageMs < 0 || ageMs >= durationMs) continue;
    const progress = Math.max(0, Math.min(1, ageMs / durationMs));
    const alpha = (1 - progress) ** 1.7;
    const [x, y] = worldToScreen(effect.impactPositionM);
    if (progress < .76) {
      context.save();
      context.fillStyle = `rgba(255,232,190,${Math.min(1, alpha * 1.5)})`;
      context.font = '600 8px ui-monospace, monospace';
      context.fillText('ILLUSTRATIVE IMPACT CUE', x + 30, y - 32);
      context.fillStyle = `rgba(207,216,224,${alpha})`;
      context.font = '7px ui-monospace, monospace';
      context.fillText(`COMPUTED MERGE · ${(effect.relativeSpeedMps / 1000).toFixed(1)} KM/S`, x + 30, y - 20);
      context.restore();
    }
  }
}

function drawTrail(body) {
  const trail = trails.get(body.id);
  if (!trail || trail.length < 2) return;
  context.save();
  context.strokeStyle = `${body.color}55`;
  context.lineWidth = body.id === selectedId ? 1.5 : .8;
  context.beginPath();
  let drawing = false;
  for (const point of trail) {
    const [x, y] = worldToScreen(point);
    if (x < -100 || x > innerWidth + 100 || y < -100 || y > innerHeight + 100) {
      drawing = false;
      continue;
    }
    if (!drawing) { context.moveTo(x, y); drawing = true; }
    else context.lineTo(x, y);
  }
  context.stroke();
  context.restore();
}

function setPreviewEnabled(enabled) {
  previewEnabled = enabled;
  if (enabled) {
    running = false;
    pendingStepSeconds = 0;
    stepAccumulator = 0;
    closeContentDrawer();
    closeExperiment();
    closeGuide();
    closeInspector({ clearSelection: false });
  }
  trajectoryPreview = null;
  previewSignature = '';
  document.querySelector('#trajectory-preview').hidden = !enabled;
  document.querySelector('#preview-paths').setAttribute('aria-pressed', String(enabled));
}

function updateTrajectoryPreview() {
  if (!previewEnabled || running || pendingStepSeconds > 0 || bodyMove) return;
  const signature = JSON.stringify([system.timeSeconds, system.stepSeconds, system.collisionMode, system.fieldOptions(), system.bodies]);
  if (signature !== previewSignature) {
    previewSignature = signature;
    const maxSteps = Math.max(128, Math.floor(4096 * Math.min(1, 100 / Math.max(1, system.bodies.length ** 2))));
    try {
      trajectoryPreview = createTrajectoryPreview(system, {
        durationSeconds: Number(document.querySelector('#preview-duration').value) * DAY_S, maxSteps
      });
    } catch {
      trajectoryPreview = null;
    }
  }
  const result = document.querySelector('#preview-result');
  const retry = document.querySelector('#preview-retry');
  if (!trajectoryPreview) {
    result.textContent = 'The path could not be calculated. Move an object, then recalculate.';
    retry.hidden = false;
    return;
  }
  // Cooperative batches retain a responsive camera even for short physical steps.
  if (!trajectoryPreview.done) trajectoryPreview.advance(Math.max(2, Math.floor(64 * Math.min(1, 100 / Math.max(1, system.bodies.length ** 2)))));
  const days = trajectoryPreview.durationSeconds / DAY_S;
  const duration = days < .1 ? `${(days * 24).toFixed(2)} hours` : `${days.toFixed(1)} days`;
  retry.hidden = !trajectoryPreview.error;
  result.textContent = trajectoryPreview.error ? 'The path became too extreme to calculate. Reposition an object and try again.'
    : !trajectoryPreview.done
    ? `Calculating… ${Math.round(trajectoryPreview.progress * 100)}%`
    : trajectoryPreview.collision
      ? `Contact predicted in ${duration} · preview ends at impact`
      : `${duration} ahead${trajectoryPreview.limited ? ' · shorter preview for this close orbit' : ''}`;
}

function drawTrajectoryPreview() {
  if (!previewEnabled || running || !trajectoryPreview || scaleMode === 'body') return;
  context.save();
  context.setLineDash([6, 5]);
  for (const path of trajectoryPreview.paths) {
    context.strokeStyle = path.color;
    context.globalAlpha = selectedId && path.id !== selectedId ? .28 : .85;
    context.lineWidth = path.id === selectedId ? 1.8 : 1.2;
    context.beginPath();
    let drawing = false;
    for (const point of path.points) {
      const [x, y] = worldToScreen(point);
      if (!Number.isFinite(x + y) || x < -100 || x > innerWidth + 100 || y < -100 || y > innerHeight + 100) { drawing = false; continue; }
      if (!drawing) { context.moveTo(x, y); drawing = true; } else context.lineTo(x, y);
    }
    context.stroke();
  }
  if (trajectoryPreview.collision) {
    const [x, y] = worldToScreen(trajectoryPreview.collision.impactPositionM);
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.strokeStyle = '#efc47f';
    context.lineWidth = 1.5;
    context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#efc47f';
    context.font = '11px system-ui, sans-serif';
    context.fillText('Predicted contact', x + 14, y - 14);
  }
  context.restore();
}

function drawBody(body) {
  const [x, y] = worldToScreen(body.positionM);
  if (x < -80 || x > sceneViewport.width + 80 || y < -80 || y > sceneViewport.height + 80) return;
  const radius = markerRadius(body);
  context.save();

  if (body.id === selectedId && scaleMode !== 'body') {
    context.strokeStyle = '#efc47f';
    context.lineWidth = 1;
    context.setLineDash([4, 5]);
    context.beginPath(); context.arc(x, y, radius + 9, 0, Math.PI * 2); context.stroke();
    context.setLineDash([]);
  }

  if (body.axialTiltRad && body.type !== 'star' && (scaleMode === 'lunar' || scaleMode === 'body' || body.id === selectedId)) {
    const axisLength = radius + 7;
    const angle = -Math.PI * .5 + body.axialTiltRad;
    context.strokeStyle = 'rgba(240,246,251,.6)';
    context.beginPath();
    context.moveTo(x - Math.cos(angle) * axisLength, y - Math.sin(angle) * axisLength);
    context.lineTo(x + Math.cos(angle) * axisLength, y + Math.sin(angle) * axisLength);
    context.stroke();
  }

  if ((scaleMode === 'solar' || scaleMode === 'system') && body.id === 'moon') {
    context.restore();
    return;
  }
  if (scaleMode === 'system' && ['mercury', 'venus', 'mars'].includes(body.id)) {
    context.restore();
    return;
  }
  if (scaleMode === 'light') {
    context.restore();
    return;
  }
  context.fillStyle = body.id === selectedId ? '#f3eee4' : 'rgba(211,222,229,.72)';
  const guided = Boolean(scientistTutorial?.state?.lessonId);
  context.font = guided ? '600 13px system-ui, sans-serif' : body.id === selectedId ? '500 11px ui-monospace, monospace' : '9px ui-monospace, monospace';
  context.letterSpacing = guided ? '0px' : '1px';
  const label = guided && body.id === 'earth'
    ? 'EARTH'
    : scaleMode === 'system' && body.id === 'earth'
    ? 'INNER PLANETS'
    : scaleMode === 'solar' && body.id === 'earth'
      ? 'EARTH + MOON'
      : body.name.toUpperCase();
  const labelWidth = context.measureText(label).width;
  const preferredSide = x > sceneViewport.width * .68 ? -1 : 1;
  const offsets = [0, -18, 18, -36, 36, -54, 54, -72, 72];
  let placement = null;
  for (const side of [preferredSide, -preferredSide]) {
    for (const offset of offsets) {
      const labelX = side > 0 ? x + radius + 11 : x - radius - 11 - labelWidth;
      const labelY = y + 3 + offset;
      const bounds = { left: labelX - 3, right: labelX + labelWidth + 3, top: labelY - 11, bottom: labelY + 5 };
      const overlaps = labelBounds.some((occupied) => !(bounds.right < occupied.left || bounds.left > occupied.right || bounds.bottom < occupied.top || bounds.top > occupied.bottom));
      if (!overlaps && bounds.left >= 8 && bounds.right <= sceneViewport.width - 8 && bounds.top >= 8 && bounds.bottom <= sceneViewport.height - 8) {
        placement = { labelX, labelY, bounds, side, offset };
        break;
      }
    }
    if (placement) break;
  }
  if (placement) {
    labelBounds.push(placement.bounds);
    if (placement.offset !== 0 || placement.side !== preferredSide) {
      context.strokeStyle = 'rgba(160,180,194,.36)';
      context.lineWidth = .7;
      context.beginPath();
      context.moveTo(x + placement.side * (radius + 3), y);
      context.lineTo(placement.side > 0 ? placement.labelX - 4 : placement.labelX + labelWidth + 4, placement.labelY - 3);
      context.stroke();
    }
    context.fillText(label, placement.labelX, placement.labelY);
  }
  context.restore();
}

function recordTrails() {
  if (system.timeSeconds - lastTrailTime < DAY_S * (scaleMode === 'system' ? 8 : scaleMode === 'solar' ? 2 : scaleMode === 'body' ? .03 : .15)) return;
  lastTrailTime = system.timeSeconds;
  for (const body of system.bodies) {
    if (!trails.has(body.id)) trails.set(body.id, []);
    const trail = trails.get(body.id);
    appendTrajectoryPoint(trail, body.positionM, { persistent: persistentTrails });
  }
}

function installTrailControls() {
  const controls = document.createElement('div');
  controls.className = 'trail-controls';
  controls.setAttribute('aria-label', 'Trajectory display controls');

  const persistenceButton = document.createElement('button');
  persistenceButton.type = 'button';
  persistenceButton.className = 'trail-persistence is-active';
  persistenceButton.setAttribute('aria-pressed', 'true');
  persistenceButton.textContent = 'Trails: persistent';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Clear trails';

  persistenceButton.addEventListener('click', () => {
    persistentTrails = !persistentTrails;
    persistenceButton.classList.toggle('is-active', persistentTrails);
    persistenceButton.setAttribute('aria-pressed', String(persistentTrails));
    persistenceButton.textContent = persistentTrails ? 'Trails: persistent' : 'Trails: recent';
    if (!persistentTrails) {
      for (const trail of trails.values()) trimTrajectory(trail, { persistent: false });
    }
    showToast(persistentTrails
      ? 'Persistent trails enabled. Paths retain up to 4,096 samples per body.'
      : 'Recent trails enabled. Paths retain the latest 280 samples per body.');
  });

  clearButton.addEventListener('click', () => {
    trails.clear();
    lastTrailTime = -Infinity;
    showToast('All trajectory trails cleared.');
  });

  controls.append(persistenceButton, clearButton);
  laboratory.append(controls);
}

function installRelativityTeachingPanel() {
  const section = document.querySelector('[data-experiment-content="relativity"]');
  if (!section) return;
  const signal = section.querySelector('#relativity-show-signal-travel');
  if (signal) signal.checked = Boolean(relativityShowSignalTravel);
  setRelativityActiveFrame(relativityActiveFrame);
  setRelativityWizardStep(relativityWizardStep, { announce: false });
}

function scientific(value, digits = 2) {
  return Number.isFinite(value) ? value.toExponential(digits) : '—';
}

function preferredPresetId(body) {
  return (body.flags || []).find((flag) => flag.startsWith('preset:'))?.replace('preset:', '') || '';
}

function readThoughtNoteStore(storage = globalThis.localStorage) {
  if (thoughtNoteStore) return thoughtNoteStore;
  try {
    const value = storage.getItem(THOUGHT_NOTE_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      thoughtNoteStore = { schemaVersion: 1, notes: {} };
      return thoughtNoteStore;
    }
    thoughtNoteStore = {
      schemaVersion: Number(parsed.schemaVersion) || 1,
      notes: parsed.notes && typeof parsed.notes === 'object' && !Array.isArray(parsed.notes) ? parsed.notes : {}
    };
    return thoughtNoteStore;
  } catch {
    thoughtNoteStore = { schemaVersion: 1, notes: {} };
    return thoughtNoteStore;
  }
}

function flushThoughtNoteStore(storage = globalThis.localStorage) {
  if (!thoughtNoteStore) return;
  try {
    storage.setItem(THOUGHT_NOTE_STORAGE_KEY, JSON.stringify(thoughtNoteStore));
  } catch {
    // local-only failure is expected in restricted environments and should not block interaction.
  }
}

function bodyThoughtNoteKey(body) {
  const presetId = preferredPresetId(body || {});
  const type = body?.type || 'object';
  const hasDarkHoleFlag = (body?.flags || []).some((flag) => flag === 'black-hole' || flag === 'preset:black-hole');
  const base = [];
  if (body?.id) base.push(`id:${body.id}`);
  if (presetId) base.push(`preset:${presetId}`);
  base.push(`type:${type}`);
  if (hasDarkHoleFlag) base.push('role:black-hole');
  return base;
}

function baseThoughtNoteTemplate(body) {
  const flags = new Set(body?.flags || []);
  const presetId = preferredPresetId(body || {});
  if (isBlackHoleBody(body)) {
    return {
      title: 'Black-hole thought experiment',
      formula: '\\alpha \\approx \\frac{4GM}{bc^2}\\qquad \\Delta f / f \\approx -\\frac{GM}{rc^2}',
      context: 'Computed light-path deflection and frequency text are toy/illustrative overlays. Bodies evolve under Newtonian dynamics only.'
    };
  }
  if (flags.has('event-marker')) {
    return {
      title: 'Event marker',
      formula: 'x(t)=x_0+v_0 t+\\int_0^t\\!\\int_0^\\tau a(u)\\,du\\,d\\tau\\a_i \\approx \\sum_j Gm_j\\frac{\\vec r_j-\\vec r_i}{|\\vec r_j-\\vec r_i|^3}',
      context: 'Event markers carry negligible mass and do not affect trajectories; they visualize where an experiment anchor is placed.'
    };
  }
  if (flags.has('earth-scale-object') || presetId === 'vehicle-car') {
    return {
      title: 'Everyday object experiment',
      formula: 'F = ma \\quad p = mv \\quad E_k = \\frac12 mv^2',
      context: 'Everyday objects are simulated with the same live integrator as planets, so drag and impulse are explicit and frame-tracked.'
    };
  }
  if (body?.type === 'tracer') {
    return {
      title: 'Tracer probe',
      formula: '\\vec a_i \\approx \\sum_j Gm_j\\frac{\\vec r_j-\\vec r_i}{|\\vec r_j-\\vec r_i|^3}',
      context: 'Tracer probes receive field acceleration in the same direction the simulation computes for massive bodies.'
    };
  }
  if (body?.type === 'star' || body?.type === 'planet' || body?.type === 'moon') {
    return {
      title: 'Orbit and gravity',
      formula: 'F = G\\frac{m_1 m_2}{r^2} \\quad v_\\text{esc}=\\sqrt{\\frac{2GM}{r}} \\quad P \\approx 2\\pi\\sqrt{\\frac{a^3}{GM}}',
      context: 'Trajectories come from live Newtonian point-mass integration. Relativity, atmosphere, tides, and deformation are illustrated separately.'
    };
  }
  return {
    title: 'Thought experiment',
    formula: '\\text{State evolution depends on } d\\mathbf s / dt = \\mathbf f(\\mathbf s, \\mathbf F_{\\text{field}}, t)',
    context: 'Use this panel to save what you are measuring, then replay those notes while changing the live setup.'
  };
}

function readBodyThoughtNote(body) {
  const keys = bodyThoughtNoteKey(body);
  const noteStore = readThoughtNoteStore();
  const fallback = baseThoughtNoteTemplate(body || {});
  for (const key of keys) {
    const note = noteStore.notes[key];
    if (note && typeof note === 'object') {
      return {
        source: key,
        title: note.title || fallback.title,
        formula: note.formula || fallback.formula,
        context: note.context || fallback.context
      };
    }
  }
  return {
    source: 'default',
    ...fallback
  };
}

function writeBodyThoughtNote(body, nextNote) {
  const key = body?.id ? `id:${body.id}` : bodyThoughtNoteKey(body)[0];
  if (!key) return;
  if (!thoughtNoteStore) thoughtNoteStore = { schemaVersion: 1, notes: {} };
  const template = baseThoughtNoteTemplate(body);
  const sameAsDefault = nextNote && nextNote.title === template.title && nextNote.formula === template.formula && nextNote.context === template.context;
  if (sameAsDefault) {
    delete thoughtNoteStore.notes[key];
    flushThoughtNoteStore();
    return;
  }
  thoughtNoteStore.notes[key] = {
    title: nextNote?.title || '',
    formula: nextNote?.formula || '',
    context: nextNote?.context || '',
    updatedAt: new Date().toISOString(),
    sourceBodyId: body?.id || null
  };
  flushThoughtNoteStore();
}

function updateThoughtNotes(body) {
  const panel = document.querySelector('#thought-equation-notes');
  if (!panel) return;
  const title = panel.querySelector('#thought-title-input');
  const formula = panel.querySelector('#thought-formula-input');
  const context = panel.querySelector('#thought-context-input');
  const status = panel.querySelector('#thought-equation-status');
  const source = panel.querySelector('#thought-note-source');
  if (!body) {
    panel.hidden = true;
    if (status) status.textContent = 'Select a body to review thought experiment equations and assumptions.';
    if (source) source.textContent = 'No note source loaded yet.';
    return;
  }
  panel.hidden = false;
  const note = readBodyThoughtNote(body);
  if (title) title.value = note.title;
  if (formula) formula.value = note.formula;
  if (context) context.value = note.context;
  if (status) status.textContent = `Editing live note for ${body.name || 'selected body'}.`;
  if (source) source.textContent = note.source === 'default'
    ? 'Source: default experiment template'
    : `Source: custom note (${note.source})`;
}

function updateReadouts() {
  const snapshot = system.snapshot();
  const collisionOccurred = snapshot.events.some((event) => event.type === 'collision.merged');
  document.querySelector('#elapsed-value').textContent = `${(snapshot.timeSeconds / DAY_S).toFixed(snapshot.timeSeconds < DAY_S * 10 ? 2 : 1)} days`;
  document.querySelector('#energy-value').textContent = scientific(snapshot.diagnostics.relativeEnergyDrift);
  document.querySelector('#angular-value').textContent = scientific(snapshot.diagnostics.relativeAngularMomentumDrift);
  document.querySelector('#energy-label').textContent = collisionOccurred ? 'Energy change*' : 'Energy drift';
  document.querySelector('#angular-label').textContent = collisionOccurred ? 'Angular change*' : 'Angular drift';
  document.querySelector('#simulation-diagnostics').title = collisionOccurred
    ? 'The spherical merge conserves mass and linear momentum. Energy becomes unresolved heat/deformation, and orbital angular momentum is not transferred into modeled spin or ejecta.'
    : 'Relative numerical change from the scenario baseline.';
  document.querySelector('#body-count').textContent = String(snapshot.bodies.length);
  updateScientistWorkbench();
  document.querySelector('#scenario-select').value = scenarioMode;
  const bodySelect = document.querySelector('#body-select');
  const nextBodySelectSignature = snapshot.bodies.map((body) => `${body.id}:${body.name}`).join('|');
  if (nextBodySelectSignature !== bodySelectSignature) {
    bodySelectSignature = nextBodySelectSignature;
    bodySelect.replaceChildren(new Option('All placed objects', ''));
    for (const body of snapshot.bodies) bodySelect.add(new Option(`${body.name} · ${body.type}`, body.id));
  }
  bodySelect.value = selectedId && system.body(selectedId) ? selectedId : '';
  const hasEarth = Boolean(system.body('earth'));
  const hasSun = Boolean(system.body('sun'));
  const contextualExperiments = [
    [document.querySelector('[data-experiment="seasons"]'), !hasEarth, 'Add an Earth analogue or open JPL Solar System'],
    [document.querySelector('[data-experiment="magnetic"]'), system.bodies.length === 0, 'Add a body to inspect its gravity field'],
    [document.querySelector('[data-experiment="light"]'), !hasSun, 'Add a Sun-like star or open JPL Solar System']
  ];
  for (const [button, unavailable, hint] of contextualExperiments) {
    button.disabled = false;
    button.classList.toggle('requires-context', unavailable);
    button.removeAttribute('aria-disabled');
    button.dataset.requiresContext = String(unavailable);
    button.title = unavailable ? hint : '';
  }
  document.querySelector('#scale-kicker').textContent = viewDefinition().kicker;
  document.querySelector('#scale-value').textContent = formatFrameWidth(renderedView.widthM);
  document.querySelector('#season-globe').textContent = scaleMode === 'body' && approachOrigin === 'seasons'
    ? 'Return to Solar comparison'
    : 'View illumination on globe';
  const tiltDegrees = cameraOrbit.tilt * 180 / Math.PI;
  const cameraLabel = cameraMode === 'eye' ? 'EYE VIEW' : cameraMode === 'top' ? 'TOP VIEW' : cameraMode === 'orbit' ? 'ORBIT VIEW' : cameraMode === 'ecliptic' ? 'ECLIPTIC CRUISE' : cameraMode === 'track' ? 'TRACK VIEW' : `${tiltDegrees.toFixed(0)}° CUSTOM`;
  const frameLabel = frameReferenceMode === 'barycentric'
    ? 'REF BARYCENTER'
    : frameReferenceMode === 'heliocentric'
      ? 'REF HELIOCENTRIC'
      : 'REF GALACTO-CENTRIC';
  const trackingLabel = cameraTargetId && system.body(cameraTargetId) ? ` · TRACKING ${system.body(cameraTargetId).name.toUpperCase()}` : '';
  const closeUpExitLabel = scaleMode === 'body' ? ' · TAP ANYWHERE TO EXIT' : '';
  document.querySelector('#camera-value').textContent = `${cameraLabel} · ${frameLabel} · PERSPECTIVE · ${cameraOrbit.zoom.toFixed(2)}×${trackingLabel}${closeUpExitLabel}`;
  const cameraSelect = document.querySelector('#camera-select');
  cameraSelect.querySelector('option[value="track"]').disabled = !selectedId;
  cameraSelect.value = ['eye', 'orbit', 'ecliptic', 'top', 'track'].includes(cameraMode) ? cameraMode : 'custom';
  document.querySelector('#frame-reference-select').value = frameReferenceMode;
  document.querySelector('#return-system-view').hidden = scaleMode !== 'body';
  document.querySelector('#play-toggle').textContent = running ? 'Pause' : 'Run';
  document.querySelector('#preview-paths').disabled = system.bodies.length === 0;
  document.querySelector('#step-day').disabled = pendingStepSeconds > 0;
  if (document.querySelector('#playback-state')) {
    document.querySelector('#playback-state').textContent = pendingStepSeconds > 0 ? 'Stepping…' : running ? 'Running' : 'Paused';
    document.querySelector('#playback-state').dataset.running = String(running);
    document.querySelector('#scene-count').textContent = `${system.bodies.length} ${system.bodies.length === 1 ? 'object' : 'objects'}`;
    document.querySelector('#scene-time').textContent = document.querySelector('#elapsed-value').textContent;
    document.querySelector('#playback-performance').textContent = running && playbackLimited ? 'Speed limited by compute capacity' : '';
  }
  document.querySelector('#undo-edit').disabled = undoStack.length === 0;
  const radiusToggle = document.querySelector('#radius-mode-toggle');
  const physicalRatio = visualRadiusMode === 'physical-ratio';
  radiusToggle.setAttribute('aria-pressed', String(physicalRatio));
  document.querySelector('#radius-mode-label').textContent = physicalRatio ? 'TRUE BODY RATIO' : 'READABLE RADII';
  radiusToggle.querySelector('small').textContent = physicalRatio
    ? 'Tiny bodies become points'
    : 'Physics still uses SI radius';

  if (selectedId) {
    const body = system.body(selectedId);
    if (!body) return closeInspector();
    const speed = Math.hypot(...body.velocityMps);
    const distance = Math.hypot(...body.positionM);
    document.querySelector('#selected-mass').textContent = `${body.massKg.toExponential(3)} kg`;
    document.querySelector('#selected-radius').textContent = `${(body.radiusM / 1000).toLocaleString(undefined, { maximumFractionDigits: body.radiusM < 1000 ? 3 : 0 })} km`;
    document.querySelector('#selected-speed').textContent = `${(speed / 1000).toFixed(2)} km/s`;
    document.querySelector('#selected-distance').textContent = distance > AU_M * .05
      ? `${(distance / AU_M).toFixed(3)} AU`
      : `${(distance / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
    document.querySelector('#focus-selected span').textContent = `Frame ${body.name} in camera`;
    document.querySelector('#approach-selected').textContent = `Open ${body.name} at physical scale`;
    document.querySelector('#tilt-output').textContent = `${(body.axialTiltRad * 180 / Math.PI).toFixed(1)}°`;
    massScale.setAttribute('aria-valuetext', `${document.querySelector('#mass-output').textContent} of ${body.name}'s starting mass`);
    document.querySelector('#mass-journey-guidance').textContent = body.id === 'moon' && scientistTutorial?.state?.lessonId === 'barycenter'
      ? 'Try 2.00×. Watch the Earth-Moon balance point update above.'
      : 'Move the slider to test how mass changes gravity.';
    const isBarycenterMoon = body.id === 'moon' && scientistTutorial?.state?.lessonId === 'barycenter';
    document.querySelector('#physics-editor-label').textContent = isBarycenterMoon ? 'Moon mass control' : 'Edit physics';
    document.querySelector('#physics-summary').textContent = isBarycenterMoon
      ? `${document.querySelector('#mass-output').textContent} · only mass changes in this lesson`
      : isBlackHoleBody(body)
        ? `${document.querySelector('#mass-output').textContent} mass · Schwarzschild radius scales with mass · n-body motion remains Newtonian`
        : `${document.querySelector('#mass-output').textContent} mass · ${(body.axialTiltRad * 180 / Math.PI).toFixed(1)}° tilt`;
    if (impulseOutput) {
      impulseOutput.textContent = `${Number(impulseMagnitude.value).toFixed(1)} m/s`;
    }
    for (const button of document.querySelectorAll('[data-impulse-axis]')) {
      button.disabled = false;
    }
    impulseClearVelocity.disabled = false;
    const barycenterFact = document.querySelector('#barycenter-fact');
    const earth = system.body('earth');
    const moon = system.body('moon');
    const showBarycenter = Boolean(earth && moon && (body.id === 'earth' || body.id === 'moon'));
    barycenterFact.hidden = !showBarycenter;
    if (showBarycenter) {
      const barycenter = system.barycenter(['earth', 'moon']);
      const distanceFromEarthM = Math.hypot(...barycenter.map((value, axis) => value - earth.positionM[axis]));
      document.querySelector('#barycenter-distance').textContent = `${(distanceFromEarthM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km from Earth`;
    }
    updateOrbitInspector(body);
    updateThoughtNotes(body);
  } else {
    updateThoughtNotes(null);
    for (const button of document.querySelectorAll('[data-impulse-axis]')) {
      button.disabled = true;
    }
    impulseClearVelocity.disabled = true;
  }

  updateExperimentReadouts();
}

const experimentDefinitions = {
  seasons: { title: 'Seasonal light', fidelity: 'DERIVED', scale: 'solar' },
  magnetic: { title: 'Field laboratory', fidelity: 'COMPUTED', scale: 'solar' },
  'dark-matter': { title: 'Dark-matter region', fidelity: 'TOY MODEL', scale: 'solar' },
  light: { title: 'Light path', fidelity: 'TOY MODEL', scale: 'light' },
  relativity: { title: 'Solar simultaneity', fidelity: 'DERIVED', scale: 'solar' }
};

function closeExperiment({ clearActive = true } = {}) {
  experimentCard.classList.remove('is-open');
  experimentCard.setAttribute('aria-hidden', 'true');
  if (clearActive) {
    if (activeExperiment === 'light' && scaleMode === 'light') scaleMode = 'solar';
    document.querySelectorAll('[data-experiment]').forEach((button) => button.classList.remove('is-active'));
    activeExperiment = null;
  }
}

function receiptLatency(value) {
  return Number.isFinite(value) ? `${value} ms` : '—';
}

function renderVoiceReceipt() {
  const state = voiceReceipt?.state || 'not-started';
  voiceReceiptElement.dataset.state = state;
  document.querySelector('#voice-receipt-state').textContent = state.replaceAll('-', ' ').toUpperCase();
  document.querySelector('#voice-receipt-permission').textContent = voiceReceipt
    ? voiceReceipt.permission[0].toUpperCase() + voiceReceipt.permission.slice(1)
    : 'Not requested';
  document.querySelector('#voice-receipt-connection').textContent = voiceReceipt
    ? `${receiptLatency(voiceReceipt.connectionLatencyMs)}${voiceReceipt.model ? ` · ${voiceReceipt.model}` : ''}`
    : '—';
  document.querySelector('#voice-receipt-response').textContent = voiceReceipt
    ? `${receiptLatency(voiceReceipt.responseStartedLatencyMs)}${Number.isFinite(voiceReceipt.firstTranscriptLatencyMs) ? ` · transcript ${voiceReceipt.firstTranscriptLatencyMs} ms` : ''}`
    : '—';
  const manualInterruptions = voiceReceipt?.manualInterruptions || 0;
  const voiceInterruptions = voiceReceipt?.voiceInterruptions || 0;
  document.querySelector('#voice-receipt-interruptions').textContent = `${manualInterruptions + voiceInterruptions} · ${manualInterruptions} button / ${voiceInterruptions} voice`;
  document.querySelector('#voice-receipt-usage').textContent = Number.isFinite(voiceReceipt?.usageSeconds)
    ? `${voiceReceipt.usageSeconds.toFixed(1)} s${voiceReceipt.usageConfirmed ? ' · confirmed' : ' · live'}`
    : '—';
  copyVoiceReceiptButton.disabled = !voiceReceipt;
}

function updateVoiceReceipt(event) {
  voiceReceipt = advanceVoiceReceipt(voiceReceipt, event);
  renderVoiceReceipt();
}

function releaseVoiceTransport(status = 'Microphone off', { receiptEvent = null } = {}) {
  const hadSession = Boolean(voiceReceipt && !['stopped', 'error'].includes(voiceReceipt.state));
  clearTimeout(voiceCloseTimer);
  clearTimeout(voiceTranscriptTimer);
  if (voiceChannel) voiceChannel.close();
  if (voicePeer) voicePeer.close();
  if (voiceStream) voiceStream.getTracks().forEach((track) => track.stop());
  voiceChannel = null;
  voicePeer = null;
  voiceStream = null;
  voiceStarting = false;
  voiceClosing = false;
  voiceResponseActive = false;
  voiceCloseTimer = null;
  voiceTranscriptTimer = null;
  voiceInterruptEventId = null;
  document.querySelector('#guide-audio').srcObject = null;
  document.querySelector('#guide-audio').muted = false;
  voiceToggle.classList.remove('is-live');
  voiceToggle.disabled = false;
  voiceToggle.querySelector('span').textContent = 'Talk';
  voiceInterrupt.disabled = true;
  voiceStatus.textContent = status;
  if (hadSession && receiptEvent) updateVoiceReceipt(receiptEvent);
  else renderVoiceReceipt();
}

function stopVoice(status = 'Microphone off', { receiptState = 'stopped' } = {}) {
  const canCloseGracefully = receiptState !== 'error'
    && voiceChannel?.readyState === 'open'
    && voiceReceipt?.state === 'live';
  if (canCloseGracefully) {
    if (voiceClosing) return;
    voiceClosing = true;
    voiceToggle.disabled = true;
    voiceInterrupt.disabled = true;
    voiceStatus.textContent = 'Ending…';
    voiceChannel.send(JSON.stringify({ type: 'session.close' }));
    voiceCloseTimer = setTimeout(() => {
      releaseVoiceTransport('Conversation ended.', {
        receiptEvent: { type: 'error', message: 'GPT-Live close timed out before session.closed.' }
      });
    }, 15_000);
    return;
  }
  releaseVoiceTransport(status, {
    receiptEvent: hadActiveVoiceReceipt()
      ? (receiptState === 'error' ? { type: 'error', message: status } : { type: 'stopped' })
      : null
  });
}

function hadActiveVoiceReceipt() {
  return Boolean(voiceReceipt && !['stopped', 'error'].includes(voiceReceipt.state));
}

function interruptVoice() {
  if (!voiceChannel || voiceChannel.readyState !== 'open') {
    voiceStatus.textContent = 'Nothing is playing.';
    return;
  }
  voiceInterruptEventId = `learner-interrupt-${Date.now()}`;
  const audio = document.querySelector('#guide-audio');
  audio.muted = true;
  voiceChannel.send(JSON.stringify({
    type: 'session.instructions.append',
    event_id: voiceInterruptEventId,
    delegation_id: null,
    content: 'Stop speaking now. Pause and listen for the learner’s correction or question.'
  }));
  voiceResponseActive = false;
  voiceInterrupt.disabled = true;
  updateVoiceReceipt({ type: 'manual-interrupt' });
  voiceStatus.textContent = 'Paused · speak when you’re ready';
  setTimeout(() => { audio.muted = false; }, 900);
}

async function copyVoiceReceipt() {
  const serialized = serializeVoiceReceipt(voiceReceipt);
  if (!serialized || !navigator.clipboard?.writeText) {
    voiceStatus.textContent = 'Receipt copy is unavailable in this browser.';
    return;
  }
  try {
    await navigator.clipboard.writeText(serialized);
    voiceStatus.textContent = 'Receipt copied · no audio or transcript text included';
  } catch {
    voiceStatus.textContent = 'Receipt could not be copied.';
  }
}

function closeGuide({ stopAudio = true, restoreFocus = false } = {}) {
  guideCard.classList.remove('is-open');
  guideCard.setAttribute('aria-hidden', 'true');
  guideCard.setAttribute('inert', '');
  guideToggle.setAttribute('aria-expanded', 'false');
  if (stopAudio) stopVoice();
  if (restoreFocus) guideToggle.focus({ preventScroll: true });
}

function openGuide() {
  inspector.classList.remove('is-open');
  inspector.setAttribute('aria-hidden', 'true');
  closeExperiment({ clearActive: false });
  guideCard.classList.add('is-open');
  guideCard.setAttribute('aria-hidden', 'false');
  guideCard.removeAttribute('inert');
  guideToggle.setAttribute('aria-expanded', 'true');
  updateGuideContext();
  guideQuestion.focus({ preventScroll: true });
}

function openExperiment(name) {
  const definition = experimentDefinitions[name];
  if (!definition) return;
  const requestedLightLens = name === 'light' ? lightLens() : null;
  if (name === 'seasons' && !system.body('earth')) {
    showToast('Seasons is unavailable here. Add an Earth analogue or open JPL Solar System.');
    return;
  }
  if (name === 'magnetic' && system.bodies.length === 0) {
    showToast('Field view is unavailable on an empty canvas. Add one body first.');
    return;
  }
  if (name === 'light' && !requestedLightLens) {
    showToast('Light path is unavailable here. Add a star or black hole first.');
    return;
  }
  setPreviewEnabled(false);
  if (scaleMode === 'body') leaveBodyApproach({ reopenInspector: false, announce: false });
  closeContentDrawer();
  closeInspector({ clearSelection: false });
  closeGuide();
  activeExperiment = name;
  if (name === 'light') {
    lightLensId = requestedLightLens.id;
    lightPulsePhase = 0;
    if (isBlackHoleBody(requestedLightLens) && lightImpactRadii < 2.7) lightImpactRadii = 4;
  }
  if (name === 'relativity') {
    running = false;
    relativityPhase = 0;
    relativityWizardStep = 0;
    relativityShowSignalTravel = false;
    scenarioWidthM = AU_M * 2.4;
    ensureRelativityWorkspaceAndEvents({ announce: false });
    setRelativityWizardStep(0, { announce: false });
    setRelativityActiveFrame('sun');
  }
  if (name === 'magnetic') recordFieldLessonLayer(fieldLayer);
  scaleMode = definition.scale;
  if (name === 'seasons') {
    running = false;
    stepAccumulator = 0;
    showToast('Seasonal frame frozen so tilt presets compare the same orbital phase.');
  }
  document.querySelector('#experiment-fidelity').textContent = name === 'light' && isBlackHoleBody(requestedLightLens)
    ? 'COMPUTED LIGHT PATH'
    : definition.fidelity;
  document.querySelector('#experiment-title').textContent = name === 'light' && isBlackHoleBody(requestedLightLens)
    ? 'Black-hole light path'
    : definition.title;
  document.querySelectorAll('[data-experiment-content]').forEach((section) => {
    section.hidden = section.dataset.experimentContent !== name;
  });
  document.querySelectorAll('[data-experiment]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.experiment === name);
  });
  experimentCard.classList.add('is-open');
  experimentCard.setAttribute('aria-hidden', 'false');
  trails.clear();
  lastTrailTime = -Infinity;
  updateReadouts();
  if (name === 'magnetic' && fieldLayer === 'gravity') scientistTutorial?.record('gravity-inspected');
  if (name === 'relativity') updateRelativityExperiment();
}

function currentSeasonPhaseRad() {
  const earth = system.body('earth');
  const sun = system.body('sun');
  if (!earth || !sun) return 0;
  const relative = earth.positionM.map((value, axis) => value - sun.positionM[axis]);
  const orbitalLongitudeRad = Math.atan2(relative[1], relative[0]);
  return seasonPhaseOverrideRad ?? orbitalLongitudeRad;
}

function updateSeasonExperiment() {
  const earth = system.body('earth');
  const sun = system.body('sun');
  if (!earth || !sun) return;
  const relative = earth.positionM.map((value, axis) => value - sun.positionM[axis]);
  const displayLongitudeRad = currentSeasonPhaseRad();
  const snapshot = seasonSnapshot({
    axialTiltRad: earth.axialTiltRad,
    orbitalLongitudeRad: displayLongitudeRad,
    distanceM: Math.hypot(...relative)
  });
  const tiltDegrees = earth.axialTiltRad * 180 / Math.PI;
  document.querySelector('#season-tilt').value = String(tiltDegrees);
  document.querySelector('#season-tilt-output').textContent = `${tiltDegrees.toFixed(1)}°`;
  document.querySelector('#subsolar-value').textContent = `${snapshot.solarDeclinationDeg.toFixed(1)}°`;
  document.querySelector('#orbital-phase-value').textContent = `${((displayLongitudeRad * 180 / Math.PI + 360) % 360).toFixed(1)}°${seasonPhaseOverrideRad === null ? '' : ' · derived'}`;
  const maximum = Math.max(...snapshot.samples.map((sample) => sample.dailyMeanInsolationWm2), 1);
  document.querySelector('#insolation-bars').innerHTML = snapshot.samples.map((sample) => `
    <div class="insolation-row">
      <span>${sample.latitudeDeg > 0 ? '+' : ''}${sample.latitudeDeg}°</span>
      <i><b style="width:${(sample.dailyMeanInsolationWm2 / maximum * 100).toFixed(1)}%"></b></i>
      <strong>${sample.dailyMeanInsolationWm2.toFixed(0)} W/m² · ${sample.daylightHours.toFixed(1)}h</strong>
    </div>
  `).join('');
}

function updateMagneticExperiment() {
  const gravityPanel = document.querySelector('#gravity-field-panel');
  const magneticPanel = document.querySelector('#magnetic-field-panel');
  document.querySelector('#field-layer').value = fieldLayer;
  gravityPanel.hidden = fieldLayer !== 'gravity';
  magneticPanel.hidden = fieldLayer !== 'magnetic';
  document.querySelector('#experiment-fidelity').textContent = fieldLayer === 'gravity' ? 'COMPUTED' : 'TOY MODEL';
  if (fieldLayer === 'gravity') {
    const snapshot = system.snapshot();
    const target = gravityTarget(currentGravityField());
    document.querySelector('#gravity-target').textContent = target?.name || 'No body';
    document.querySelector('#gravity-acceleration').textContent = target
      ? `${target.magnitudeMps2.toExponential(3)} m/s²`
      : '— m/s²';
    const list = document.querySelector('#gravity-contributor-list');
    list.replaceChildren();
    if (target) {
      const breakdown = gravityAccelerationBreakdown({
        bodies: system.bodies,
        targetId: target.id,
        uniformDensityKgM3: snapshot.fields.uniformDensityKgM3,
        uniformDensityOriginM: snapshot.fields.uniformDensityOriginM
      });
      for (const contribution of breakdown.contributions.slice(0, 5)) {
        const item = document.createElement('li');
        const name = document.createElement('span');
        const magnitude = document.createElement('strong');
        name.textContent = contribution.name;
        magnitude.textContent = `${contribution.magnitudeMps2.toExponential(2)} m/s²`;
        item.append(name, magnitude);
        list.append(item);
      }
    }
    if (!list.childElementCount) {
      const item = document.createElement('li');
      item.textContent = 'No external gravity source';
      list.append(item);
    }
  }
  const preset = magneticPreset(magneticMode);
  document.querySelector('#magnetic-preset').value = magneticMode;
  document.querySelector('#magnetic-moment').textContent = preset.momentA_M2 === 0
    ? '0 A·m²'
    : `${preset.momentA_M2.toExponential(2)} A·m²`;
}

function updateDarkMatterExperiment() {
  const preset = darkMatterPreset(darkMatterMode);
  const comparison = darkMatterModeComparison({
    bodies: system.bodies,
    targetId: selectedId && system.body(selectedId) ? selectedId : system.body('earth')?.id || system.bodies.find((body) => body.type !== 'star')?.id || system.bodies[0]?.id,
    mode: darkMatterMode
  });
  document.querySelector('#dark-matter-preset').value = darkMatterMode;
  const offMode = 'No added dark matter';
  document.querySelector('#dark-off-mode').textContent = `OFF · ${offMode}`;
  document.querySelector('#dark-on-mode').textContent = `ON · ${preset.label}`;
  document.querySelector('#dark-off-density').textContent = '0 kg/m³';
  document.querySelector('#dark-on-density').textContent = preset.densityKgM3 === 0
    ? '0 kg/m³'
    : `${preset.densityKgM3.toExponential(3)} kg/m³`;
  document.querySelector('#dark-off-ratio').textContent = '0';
  document.querySelector('#dark-on-ratio').textContent = preset.ratioToSolarGravityAtOneAu === 0
    ? '0'
    : preset.ratioToSolarGravityAtOneAu.toExponential(3);
  document.querySelector('#dark-off-target').textContent = comparison?.targetName || 'No body';
  document.querySelector('#dark-on-target').textContent = comparison?.targetName || 'No body';
  document.querySelector('#dark-off-acceleration').textContent = comparison
    ? formatDarkMatterAcceleration(comparison.off?.magnitudeMps2)
    : '— m/s²';
  document.querySelector('#dark-on-acceleration').textContent = comparison
    ? formatDarkMatterAcceleration(comparison.on?.magnitudeMps2)
    : '— m/s²';
  const delta = comparison ? comparison.deltaMagnitudeMps2 : NaN;
  const deltaRatio = comparison && comparison.baseMagnitudeMps2 > 0
    ? comparison.deltaMagnitudeMps2 / comparison.baseMagnitudeMps2
    : NaN;
  document.querySelector('#dark-matter-acceleration-delta').textContent = formatDarkMatterAcceleration(delta);
  document.querySelector('#dark-matter-delta-ratio').textContent = Number.isFinite(deltaRatio)
    ? `${deltaRatio.toExponential(3)}`
    : 'n/a';
  document.querySelector('#dark-off-caveat').textContent = 'TOY MODEL · OFF view keeps only Newtonian n-body acceleration from the live mass state.';
  document.querySelector('#dark-on-caveat').textContent = `TOY MODEL · ${preset.caveat} The dark-matter overlay is illustrative and is not the light path solver.`;
}

function setDarkMatterMode(nextMode, { announce = false } = {}) {
  darkMatterMode = nextMode;
  const preset = darkMatterPreset(darkMatterMode);
  system.setUniformDensity(preset.densityKgM3, [0, 0, 0]);
  trails.clear();
  lastTrailTime = -Infinity;
  updateReadouts();
  if (announce) {
    showToast(`Dark matter switched to ${preset.label}. ${preset.caveat}`);
  }
  return preset;
}

function updateLightExperiment() {
  const lens = lightLens();
  if (!lens) return;
  const blackHole = isBlackHoleBody(lens);
  const compactBinaryDemo = isCompactBinaryToyScenario(lens);
  const impactControl = document.querySelector('#impact-parameter');
  if (blackHole && lightImpactRadii < 2.7) lightImpactRadii = 4;
  impactControl.min = blackHole ? '2.7' : '1';
  impactControl.max = blackHole ? '12' : '10';
  impactControl.step = blackHole ? '.05' : '.1';
  impactControl.value = String(lightImpactRadii);
  const path = lightPathForLens(lens);
  document.querySelector('#impact-output').textContent = `${lightImpactRadii.toFixed(blackHole ? 2 : 1)} ${path.unit}`;
  document.querySelector('#light-lens').textContent = lens.name;
  document.querySelector('#light-model').textContent = compactBinaryDemo
    ? 'Inspiral grid-ripple (toy)'
    : (blackHole ? 'Schwarzschild geodesic' : 'Weak-field spherical lens');
  const exaggeration = document.querySelector('#light-exaggeration');
  exaggeration.disabled = blackHole;
  exaggeration.value = blackHole ? '1' : String(lightVisualExaggeration);
  document.querySelector('#light-angle').textContent = blackHole
    ? `${path.trueDeflection.degrees.toFixed(2)}°`
    : `${path.trueDeflection.arcseconds.toFixed(3)} arcsec`;
  document.querySelector('#light-visual').textContent = blackHole ? '1× computed path' : `${lightVisualExaggeration.toLocaleString()}×`;
  document.querySelector('#light-caveat').textContent = compactBinaryDemo
    ? 'TOY GRID-RIPPLE DEMONSTRATOR · BODIES ARE COMPACT-MASS PROXIES, not black holes; paths are Newtonian and the ripples are illustrative, not computed gravitational-wave merger physics.'
    : (blackHole
    ? 'COMPUTED LIGHT PATH · Non-rotating Schwarzschild null geodesic. The live body orbit remains Newtonian; disk, photon ring, background lensing, spin, and plasma are illustrative or omitted.'
    : `TOY PATH DRAWING · ${path.caveat}`);
  const participants = lightWaveParticipantBodies(lens);
  const restFrequencyHz = 4.56e14;
  const readout = participants.source && participants.observer
    ? lightWaveReadout({
      source: participants.source,
      observer: participants.observer,
      lens,
      restFrequencyHz
    })
    : null;
  document.querySelector('#light-wave-body-pair').textContent = participants.source && participants.observer
    ? `${participants.source.name} → ${participants.observer.name}`
    : 'select source + observer';
  const safeFrequency = (value) => Number.isFinite(value) ? `${value.toExponential(3)} Hz` : '— Hz';
  const safeDimensionless = (value, fallback = '—') => Number.isFinite(value) ? value.toFixed(3) : fallback;
  const safeRadial = (value, fallback = '—') => Number.isFinite(value) ? `${value.toFixed(2)} km/s` : fallback;
  document.querySelector('#light-rest-frequency').textContent = safeFrequency(restFrequencyHz);
  document.querySelector('#light-observed-frequency').textContent = safeFrequency(readout ? readout.observedFrequencyHz : null);
  document.querySelector('#light-relative-speed').textContent = safeRadial(readout ? readout.doppler.radialSpeedKmPerS : null);
  document.querySelector('#light-doppler-factor').textContent = safeDimensionless(readout ? readout.doppler.factor : null);
  document.querySelector('#light-gravity-factor').textContent = safeDimensionless(readout?.gravity?.factor ?? 1);
  document.querySelector('#light-wavelength-shift').textContent = safeDimensionless(readout ? readout.wavelengthShift : 1);
  document.querySelector('#light-redshift').textContent = safeDimensionless(readout ? readout.redshift : 0);
}

function updateExperimentReadouts() {
  if (!activeExperiment) return;
  if (activeExperiment === 'seasons') updateSeasonExperiment();
  else if (activeExperiment === 'magnetic') updateMagneticExperiment();
  else if (activeExperiment === 'dark-matter') updateDarkMatterExperiment();
  else if (activeExperiment === 'light') updateLightExperiment();
  else if (activeExperiment === 'relativity') updateRelativityExperiment();
}

function currentExperimentState() {
  const earth = system.body('earth');
  const darkPreset = darkMatterPreset(darkMatterMode);
  const magnetic = magneticPreset(magneticMode);
  const lens = lightLens();
  const lightPath = lens ? lightPathForLens(lens) : null;
  const lightParticipants = activeExperiment === 'light' && lens ? lightWaveParticipantBodies(lens) : {};
  const lightReadout = lens && lightParticipants.source && lightParticipants.observer
    ? lightWaveReadout({
      source: lightParticipants.source,
      observer: lightParticipants.observer,
      lens,
      restFrequencyHz: 4.56e14
    })
    : null;
  return {
    season: {
      axialTiltDeg: earth ? earth.axialTiltRad * 180 / Math.PI : null,
      derivedOrbitalPhaseDeg: seasonPhaseOverrideRad === null ? null : seasonPhaseOverrideRad * 180 / Math.PI
    },
    magnetic: { mode: magneticMode, momentA_M2: magnetic.momentA_M2, fidelity: magnetic.fidelity },
    gravityField: (() => {
      const field = currentGravityField();
      const target = gravityTarget(field);
      return target ? {
        targetId: target.id,
        vectorMps2: target.vectorMps2,
        magnitudeMps2: target.magnitudeMps2,
        equation: field.equation,
        fidelity: field.fidelity
      } : null;
    })(),
    darkMatter: {
      mode: darkMatterMode,
      densityKgM3: darkPreset.densityKgM3,
      ratioToSolarGravityAtOneAu: darkPreset.ratioToSolarGravityAtOneAu,
      fidelity: darkPreset.fidelity
    },
    lightPath: lightPath ? {
      lensId: lens.id,
      lensName: lens.name,
      model: lightPath.model || 'leading-order weak-field',
      impactLensRadii: lightImpactRadii,
      trueDeflectionArcseconds: lightPath.trueDeflection.arcseconds,
      trueDeflectionDegrees: lightPath.trueDeflection.degrees ?? lightPath.trueDeflection.radians * 180 / Math.PI,
      visualExaggeration: lightPath.visualExaggeration,
      fidelity: lightPath.fidelity,
      sourceId: lightParticipants.source?.id || null,
      observerId: lightParticipants.observer?.id || null,
      frequency: lightReadout ? {
        restFrequencyHz: lightReadout.restFrequencyHz,
        observedFrequencyHz: lightReadout.observedFrequencyHz,
        redshift: lightReadout.redshift,
        wavelengthShift: lightReadout.wavelengthShift,
        dopplerFactor: lightReadout.doppler.factor,
        gravityFactor: lightReadout.gravity?.factor ?? 1
      } : null
    } : null,
    relativity: activeExperiment === 'relativity' ? relativityThoughtSnapshot() : null
  };
}

function guideSnapshot() {
  const snapshot = system.snapshot();
  return {
    selectedId,
    scenarioMode,
    activeExperiment: activeExperiment || 'none',
    courseQuestionId: document.querySelector('#physics-course')?.dataset.questionId || null,
    timeSeconds: snapshot.timeSeconds,
    running,
    scaleMode,
    bodies: snapshot.bodies.map((body) => ({
      id: body.id,
      name: body.name,
      type: body.type,
      massKg: body.massKg,
      radiusM: body.radiusM,
      positionM: body.positionM,
      velocityMps: body.velocityMps,
      axialTiltRad: body.axialTiltRad
    })),
    experimentState: currentExperimentState()
  };
}

function updateGuideContext() {
  const body = selectedId ? system.body(selectedId) : null;
  const experimentLabel = activeExperiment ? experimentDefinitions[activeExperiment].title : 'computed n-body state';
  document.querySelector('#guide-context').textContent = `${body ? body.name : 'No body selected'} · ${experimentLabel}`;
}

function appendGuideMessage(kind, text) {
  const message = document.createElement('p');
  message.className = `guide-message ${kind}`;
  message.textContent = text;
  const log = document.querySelector('#guide-log');
  log.append(message);
  log.scrollTop = log.scrollHeight;
}

function updateVoiceCaption(kind, delta) {
  if (!delta) return;
  const isLearner = kind === 'learner';
  if (isLearner) voiceInputTranscript += delta;
  else voiceOutputTranscript += delta;
  let caption = isLearner ? voiceInputCaption : voiceOutputCaption;
  if (!caption) {
    caption = document.createElement('p');
    caption.className = `guide-message ${isLearner ? 'learner' : 'guide'} live-caption`;
    document.querySelector('#guide-log').append(caption);
    if (isLearner) voiceInputCaption = caption;
    else voiceOutputCaption = caption;
  }
  caption.textContent = isLearner ? voiceInputTranscript : voiceOutputTranscript;
  const log = document.querySelector('#guide-log');
  log.scrollTop = log.scrollHeight;
}

function settleVoiceOutputCaption() {
  clearTimeout(voiceTranscriptTimer);
  voiceTranscriptTimer = setTimeout(() => {
    const transcript = voiceOutputTranscript;
    voiceResponseActive = false;
    voiceInterrupt.disabled = true;
    if (transcript) {
      if (voiceExplanationQualifies({ learnerSpeechObserved: voiceLearnerSpeechObserved, transcript })) {
        renderLessonPath(saveLessonAction('voice-explained'));
      } else if (voiceLearnerSpeechObserved) {
        voiceStatus.textContent = 'Keep the next explanation to three short sentences.';
      }
    }
    voiceOutputTranscript = '';
    voiceOutputCaption = null;
  }, 1_100);
}

async function waitForIceGathering(peer) {
  if (peer.iceGatheringState === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onState);
      reject(new Error('Timed out while gathering WebRTC candidates.'));
    }, 10_000);
    function onState() {
      if (peer.iceGatheringState !== 'complete') return;
      clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onState);
      resolve();
    }
    peer.addEventListener('icegatheringstatechange', onState);
    onState();
  });
}

async function startVoice() {
  if (voicePeer || voiceStarting) return stopVoice();
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    voiceStatus.textContent = 'Voice isn’t supported in this browser.';
    return;
  }
  const capturedSnapshot = guideSnapshot();
  voiceLearnerSpeechObserved = false;
  voiceInputTranscript = '';
  voiceOutputTranscript = '';
  voiceInputCaption = null;
  voiceOutputCaption = null;
  voiceClosing = false;
  voiceReceipt = createVoiceReceipt({
    selectedId: capturedSnapshot.selectedId,
    activeExperiment: capturedSnapshot.activeExperiment
  });
  renderVoiceReceipt();
  voiceStarting = true;
  voiceToggle.querySelector('span').textContent = 'Connecting…';
  voiceInterrupt.disabled = true;
  voiceStatus.textContent = 'Allow microphone access to talk.';
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    updateVoiceReceipt({ type: 'permission-granted' });
    voicePeer = new RTCPeerConnection();
    voiceStream.getTracks().forEach((track) => voicePeer.addTrack(track, voiceStream));
    voicePeer.ontrack = (event) => {
      document.querySelector('#guide-audio').srcObject = event.streams[0];
      updateVoiceReceipt({ type: 'audio-track' });
    };
    voicePeer.onconnectionstatechange = () => {
      if (!voiceClosing && ['failed', 'closed', 'disconnected'].includes(voicePeer?.connectionState)) {
        stopVoice('Connection lost. Try again.', { receiptState: 'error' });
      }
    };
    voiceChannel = voicePeer.createDataChannel('oai-events');
    voiceChannel.onopen = () => {
      voiceStatus.textContent = 'Connecting…';
    };
    voiceChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'session.started') {
          voiceStarting = false;
          voiceToggle.classList.add('is-live');
          voiceToggle.querySelector('span').textContent = 'End conversation';
          voiceStatus.textContent = 'Listening · speak naturally';
          updateVoiceReceipt({ type: 'connected', model: message.session?.model || voicePendingModel });
          voiceChannel.send(JSON.stringify({
            type: 'session.commentary.append',
            event_id: `course-opening-${Date.now()}`,
            delegation_id: null,
            content: 'Begin now. Ask the learner to defend their prediction for the visible prompt in one short sentence, then pause and listen.'
          }));
        }
        if (message.type === 'session.output_transcript.delta') {
          if (!voiceResponseActive) {
            updateVoiceReceipt({ type: 'response-started' });
            voiceInputCaption = null;
            voiceInputTranscript = '';
            voiceInterruptionCountedForOutput = false;
          }
          voiceResponseActive = true;
          voiceInterrupt.disabled = false;
          updateVoiceCaption('guide', message.delta || '');
          updateVoiceReceipt({ type: 'transcript-observed' });
          settleVoiceOutputCaption();
        }
        if (message.type === 'session.input_transcript.delta') {
          if (message.delta) {
            if (voiceResponseActive && !voiceInterruptionCountedForOutput) {
              updateVoiceReceipt({ type: 'voice-interrupt' });
              voiceInterruptionCountedForOutput = true;
            }
            voiceLearnerSpeechObserved = true;
            updateVoiceCaption('learner', message.delta);
          }
        }
        if (message.type === 'session.instructions.appended' && message.client_event_id === voiceInterruptEventId) {
          updateVoiceReceipt({ type: 'interrupt-acknowledged' });
        }
        if (message.type === 'session.usage.updated') {
          updateVoiceReceipt({ type: 'usage-updated', seconds: message.usage?.seconds });
        }
        if (message.type === 'session.closed') {
          updateVoiceReceipt({ type: 'closed', seconds: message.usage?.seconds, reason: message.reason });
          releaseVoiceTransport('Conversation ended.');
        }
        if (message.type === 'error') {
          voiceStatus.textContent = 'Voice paused. Try again.';
        }
      } catch {
        // Ignore non-JSON transport diagnostics.
      }
    };
    voiceChannel.onclose = (event) => {
      if (event.target !== voiceChannel || voiceClosing || ['stopped', 'error'].includes(voiceReceipt?.state)) return;
      releaseVoiceTransport('Connection lost. Try again.', {
        receiptEvent: { type: 'error', message: 'GPT-Live data channel closed before session.closed.' }
      });
    };
    const offer = await voicePeer.createOffer();
    await voicePeer.setLocalDescription(offer);
    await waitForIceGathering(voicePeer);
    const sdp = voicePeer.localDescription?.sdp;
    if (!sdp) throw new Error('The browser did not create a WebRTC offer.');
    const response = await fetch('/api/live/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp, snapshot: capturedSnapshot })
    });
    if (!response.ok) {
      await response.json().catch(() => ({}));
      throw new Error('Voice is unavailable right now. You can still ask by text.');
    }
    const result = await response.json();
    if (!result?.transport?.sdp) throw new Error('Voice is unavailable right now. You can still ask by text.');
    voicePendingModel = response.headers.get('X-Live-Model') || result.session?.model || 'gpt-live-1';
    await voicePeer.setRemoteDescription({ type: 'answer', sdp: result.transport.sdp });
    voiceStatus.textContent = 'Connecting…';
  } catch (error) {
    const message = error?.name === 'NotAllowedError'
      ? 'Microphone permission was denied. Allow microphone access in the browser, then try again.'
      : error?.name === 'NotFoundError'
        ? 'No microphone was found. Connect an input device, then try again.'
        : error?.message || 'Voice is unavailable right now. You can still ask by text.';
    stopVoice(message, { receiptState: 'error' });
  }
}

async function checkVoiceReadiness() {
  if (voicePeer || voiceStarting) {
    voiceStatus.textContent = 'GPT-Live is already active or connecting.';
    return;
  }
  voicePreflight.disabled = true;
  voicePreflight.textContent = 'Checking…';
  voiceStatus.textContent = 'Checking local setup · microphone stays off…';
  try {
    const response = await fetch('/api/live/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot: guideSnapshot() })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'GPT-Live setup check failed.');
    voiceStatus.textContent = `Configured · ${body.model} + ${body.backendModel} · no session started`;
    appendGuideMessage('system', 'Setup is valid. No microphone permission, network session, or billable voice time was used by this check.');
  } catch (error) {
    voiceStatus.textContent = error.message || 'GPT-Live setup check failed.';
  } finally {
    voicePreflight.disabled = false;
    voicePreflight.textContent = 'Check voice setup';
  }
}

function openInspector(id, { track = true } = {}) {
  const body = system.body(id);
  if (!body) return;
  if (scaleMode === 'body' && approachOrigin === 'seasons') {
    showToast(id === 'earth'
      ? 'Seasonal globe remains locked to Earth.'
      : 'Leave the seasonal globe before approaching another body.');
    return;
  }
  closeContentDrawer();
  closeExperiment();
  closeGuide();
  inspector.classList.remove('is-barycenter-lesson');
  if (massLessonTarget) massLessonTarget.hidden = true;
  selectedId = id;
  if (track) {
    cameraTargetId = id;
    cameraMode = 'track';
  }
  selectedBaseMassKg = Math.max(body.massKg, 1);
  selectedBaseRadiusM = Math.max(body.radiusM, 1);
  velocityHistoryState = null;
  if (impulseOutput) {
    impulseOutput.textContent = `${Number(impulseMagnitude.value).toFixed(0)} m/s`;
  }
  document.querySelector('#selected-type').textContent = isBlackHoleBody(body) ? 'BLACK HOLE' : body.type.toUpperCase();
  document.querySelector('#selected-name').textContent = body.name;
  document.querySelector('#selection-kicker').textContent = 'SELECTED';
  document.querySelector('#selection-name').textContent = body.name;
  massScale.value = '0';
  document.querySelector('#mass-output').textContent = '1.00×';
  tiltControl.value = String(body.axialTiltRad * 180 / Math.PI);
  if (scaleMode === 'body') {
    focusedId = id;
    const trackedView = viewDefinition();
    renderedView = { center: [...trackedView.center], widthM: trackedView.widthM };
    inspector.classList.remove('is-open');
    inspector.setAttribute('aria-hidden', 'true');
    trails.clear();
    lastTrailTime = -Infinity;
    showToast(`Approach retargeted to ${body.name}.`);
    updateReadouts();
    return;
  }
  if (track) {
    const trackedView = viewDefinition();
    renderedView = { center: [...trackedView.center], widthM: trackedView.widthM };
  }
  inspector.classList.add('is-open');
  inspector.setAttribute('aria-hidden', 'false');
  updateReadouts();
}

function trackPlacedBody(id, { openInspectorPanel = true } = {}) {
  const body = system.body(id);
  if (!body) return;
  selectedId = body.id;
  selectedBaseMassKg = Math.max(body.massKg, 1);
  selectedBaseRadiusM = Math.max(body.radiusM, 1);
  velocityHistoryState = null;
  cameraTargetId = body.id;
  cameraMode = 'track';
  const trackedView = viewDefinition();
  renderedView = { center: [...trackedView.center], widthM: trackedView.widthM };
  if (openInspectorPanel) {
    openInspector(body.id, { track: false });
    return;
  }
  trails.clear();
  lastTrailTime = -Infinity;
  updateReadouts();
}

function closeInspector({ clearSelection = true } = {}) {
  const selectedBody = selectedId ? system.body(selectedId) : null;
  if (clearSelection) selectedId = null;
  inspector.classList.remove('is-open');
  inspector.classList.remove('is-barycenter-lesson');
  if (massLessonTarget) massLessonTarget.hidden = true;
  inspector.setAttribute('aria-hidden', 'true');
  document.querySelector('#selection-kicker').textContent = clearSelection || !selectedBody ? 'TARGET' : 'SELECTED';
  document.querySelector('#selection-name').textContent = clearSelection || !selectedBody
    ? 'Click a body to inspect'
    : selectedBody?.name || 'Selected body';
  velocityHistoryState = null;
}

function sanitizeThoughtField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function saveThoughtNoteForSelectedBody() {
  if (!selectedId) return;
  const body = system.body(selectedId);
  if (!body) return;
  const panel = document.querySelector('#thought-equation-notes');
  if (!panel) return;
  const titleInput = panel.querySelector('#thought-title-input');
  const formulaInput = panel.querySelector('#thought-formula-input');
  const contextInput = panel.querySelector('#thought-context-input');
  const status = panel.querySelector('#thought-equation-status');
  const source = panel.querySelector('#thought-note-source');
  const nextNote = {
    title: sanitizeThoughtField(titleInput?.value),
    formula: sanitizeThoughtField(formulaInput?.value),
    context: sanitizeThoughtField(contextInput?.value)
  };
  if (!nextNote.title && !nextNote.formula && !nextNote.context) {
    return;
  }
  writeBodyThoughtNote(body, nextNote);
  if (status) status.textContent = `Saved note for ${body.name}.`;
  if (source) source.textContent = `Source: custom note (id:${body.id})`;
  updateThoughtNotes(body);
}

function resetThoughtNoteForSelectedBody() {
  const panel = document.querySelector('#thought-equation-notes');
  if (!panel || !selectedId) return;
  const body = system.body(selectedId);
  if (!body) return;
  const titleInput = panel.querySelector('#thought-title-input');
  const formulaInput = panel.querySelector('#thought-formula-input');
  const contextInput = panel.querySelector('#thought-context-input');
  const status = panel.querySelector('#thought-equation-status');
  const source = panel.querySelector('#thought-note-source');
  const noteKey = `id:${body.id}`;
  const store = readThoughtNoteStore();
  if (store.notes && store.notes[noteKey]) {
    delete store.notes[noteKey];
    flushThoughtNoteStore();
  }
  const template = baseThoughtNoteTemplate(body);
  if (titleInput) titleInput.value = template.title;
  if (formulaInput) formulaInput.value = template.formula;
  if (contextInput) contextInput.value = template.context;
  if (status) status.textContent = 'Reverted to body-specific defaults.';
  if (source) source.textContent = 'Source: default experiment template';
}

function focusSelected() {
  const body = selectedId ? system.body(selectedId) : null;
  if (!body) {
    showToast('Select a body before framing it.');
    return;
  }
  if (scaleMode === 'body') leaveBodyApproach({ reopenInspector: false, announce: false });
  cameraTargetId = body.id;
  cameraOrbit.zoom = Math.max(cameraOrbit.zoom, 1.35);
  cameraMode = 'track';
  showToast(`Camera framed around ${body.name} and follows its live position. Physics and velocity are unchanged.`);
  updateReadouts();
}

function approachSelected() {
  const body = selectedId ? system.body(selectedId) : null;
  if (!body) {
    showToast('Select a body before opening physical-scale view.');
    return;
  }
  enterBodyApproach(body.id);
}

function enterBodyApproach(id, { origin = 'inspector' } = {}) {
  const body = system.body(id);
  if (!body) return;
  if (scaleMode !== 'body') returnScaleMode = scaleMode;
  focusedId = body.id;
  cameraTargetId = body.id;
  selectedId = body.id;
  approachOrigin = origin;
  scaleMode = 'body';
  if (origin !== 'seasons') closeExperiment();
  closeGuide();
  inspector.classList.remove('is-open');
  inspector.setAttribute('aria-hidden', 'true');
  laboratory.classList.add('is-cinematic');
  laboratory.classList.toggle('is-season-view', origin === 'seasons');
  if (origin === 'seasons') {
    activeExperiment = 'seasons';
    experimentCard.classList.add('is-open');
    experimentCard.setAttribute('aria-hidden', 'false');
  }
  cameraMode = 'orbit';
  cameraOrbit = { yaw: -.28, tilt: .5, zoom: 1.08 };
  trails.clear();
  lastTrailTime = -Infinity;
  showToast(origin === 'seasons'
    ? 'Derived sunlight shell active. Gold is incidence; blue marks the terminator.'
    : `${body.name} physical-scale close-up opened. Frame width now tracks physical radius; this is not a flight path.`);
  updateReadouts();
}

function leaveBodyApproach({ reopenInspector = true, announce = true } = {}) {
  if (scaleMode !== 'body') return;
  const previousFocusedId = focusedId;
  const previousOrigin = approachOrigin;
  scaleMode = returnScaleMode === 'body' ? 'system' : returnScaleMode;
  focusedId = null;
  approachOrigin = null;
  cameraTargetId = null;
  laboratory.classList.remove('is-cinematic');
  laboratory.classList.remove('is-season-view');
  resetCamera({ announce: false });
  trails.clear();
  lastTrailTime = -Infinity;
  if (previousOrigin === 'seasons') {
    selectedId = null;
    document.querySelector('#selection-kicker').textContent = 'TARGET';
    document.querySelector('#selection-name').textContent = 'Click a body to inspect';
    experimentCard.classList.add('is-open');
    experimentCard.setAttribute('aria-hidden', 'false');
  } else if (reopenInspector && previousFocusedId && system.body(previousFocusedId)) {
    openInspector(previousFocusedId);
  }
  if (announce) showToast('Returned to the system reference frame.');
  updateReadouts();
}

function hitTest(clientX, clientY) {
  const canvasBounds = canvas.getBoundingClientRect();
  const canvasX = clientX - canvasBounds.left;
  const canvasY = clientY - canvasBounds.top;
  let best = null;
  let bestDistance = Infinity;
  for (const body of system.bodies) {
    const [x, y] = worldToScreen(body.positionM);
    const distance = Math.hypot(canvasX - x, canvasY - y);
    const threshold = Math.max(14, markerRadius(body) + 8);
    if (distance <= threshold && distance < bestDistance) {
      best = body;
      bestDistance = distance;
    }
  }
  return best;
}

function uniqueId(prefix) {
  spawnCounter += 1;
  return `${prefix}-${spawnCounter}`;
}

function primaryStar() {
  return system.body('sun') || system.bodies.find((body) => body.type === 'star' && body.massKg > 0) || null;
}

function spawn(type) {
  try {
    const phase = (spawnCounter * 1.71 + .7) % (Math.PI * 2);
    const hostStar = primaryStar();
    if (!hostStar) throw new Error('A massive star is required before spawning this preset.');
    if (type === 'star') {
      const id = uniqueId('star');
      const body = system.spawnCircular({
        id,
        name: `Companion ${spawnCounter}`,
        type: 'star',
        hostId: hostStar.id,
        distanceM: AU_M * (1.7 + spawnCounter * .08),
        massKg: REFERENCE_MASS_KG.sun * .25,
        radiusM: 330_000_000,
        phaseRad: phase,
        color: '#ff9c6c',
        provenance: { source: 'user-spawned hypothetical preset', id: 'hypothetical-star' }
      });
      trackPlacedBody(body.id);
      system.rebaseline('spawn-star');
      showToast('Hypothetical companion star spawned. The system may become unstable.');
    } else if (type === 'planet') {
      const id = uniqueId('planet');
      const body = system.spawnCircular({
        id,
        name: `Planet ${spawnCounter}`,
        type: 'planet',
        hostId: hostStar.id,
        distanceM: AU_M * (1.25 + spawnCounter * .09),
        massKg: REFERENCE_MASS_KG.earth * .107,
        radiusM: 3_389_500,
        phaseRad: phase,
        axialTiltRad: 25.2 * Math.PI / 180,
        color: '#d8835f',
        provenance: { source: 'user-spawned Mars-mass hypothetical preset', id: 'hypothetical-planet' }
      });
      trackPlacedBody(body.id);
      system.rebaseline('spawn-planet');
      showToast('Mars-mass hypothetical planet spawned in a circular starting orbit.');
    } else if (type === 'moon') {
      const host = selectedId && system.body(selectedId)?.type === 'planet' ? system.body(selectedId) : system.body('earth');
      const id = uniqueId('moon');
      const body = system.spawnCircular({
        id,
        name: `Moon ${spawnCounter}`,
        type: 'moon',
        hostId: host.id,
        distanceM: 520_000_000 + spawnCounter * 25_000_000,
        massKg: REFERENCE_MASS_KG.moon * .1,
        radiusM: 900_000,
        phaseRad: phase,
        color: '#b9c2c9',
        provenance: { source: 'user-spawned hypothetical preset', id: 'hypothetical-moon' }
      });
      trackPlacedBody(body.id);
      system.rebaseline('spawn-moon');
      scaleMode = host.id === 'earth' ? 'lunar' : scaleMode;
      showToast(`Hypothetical moon spawned around ${host.name}.`);
    } else {
      const id = uniqueId('tracer');
      const body = system.spawnCircular({
        id,
        name: `Tracer ${spawnCounter}`,
        type: 'tracer',
        hostId: hostStar.id,
        distanceM: AU_M * (.55 + spawnCounter * .035),
        massKg: 0,
        radiusM: 1,
        phaseRad: phase,
        color: '#8de3ff',
        provenance: { source: 'massless numerical test particle', id: 'test-particle' }
      });
      trackPlacedBody(body.id);
      showToast('Massless tracer spawned. It feels gravity but does not perturb other bodies.');
    }
    trails.clear();
    lastTrailTime = -Infinity;
    updateReadouts();
  } catch (error) {
    showToast(error.message);
  }
}

function setCameraView(mode, { announce = true, clearTarget = true } = {}) {
  const preset = CAMERA_VIEWS[mode];
  if (!preset) return;
  cameraMode = mode;
  cameraOrbit = { ...preset };
  if (clearTarget) cameraTargetId = null;
  if (announce) showToast(mode === 'eye'
    ? 'Eye view restored: level horizon, world +Z up.'
    : mode === 'ecliptic'
      ? 'Ecliptic cruise active: the camera moves near the orbital plane; body physics is unchanged.'
      : `${mode[0].toUpperCase()}${mode.slice(1)} camera view active.`);
  updateReadouts();
}

function resetCamera({ announce = true } = {}) {
  setCameraView('eye', { announce, clearTarget: true });
}

function drawOrientationGizmo() {
  const size = 84;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  if (orientationGizmo.width !== size * ratio || orientationGizmo.height !== size * ratio) {
    orientationGizmo.width = size * ratio;
    orientationGizmo.height = size * ratio;
  }
  orientationContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  orientationContext.clearRect(0, 0, size, size);
  const center = size / 2;
  const radius = 30;
  orientationContext.strokeStyle = 'rgba(150, 181, 204, .18)';
  orientationContext.lineWidth = 1;
  orientationContext.beginPath();
  orientationContext.arc(center, center, radius, 0, Math.PI * 2);
  orientationContext.stroke();
  orientationContext.beginPath();
  orientationContext.ellipse(center, center, radius, radius * .34, 0, 0, Math.PI * 2);
  orientationContext.stroke();
  orientationContext.beginPath();
  orientationContext.ellipse(center, center, radius * .34, radius, 0, 0, Math.PI * 2);
  orientationContext.stroke();

  const sinTilt = Math.sin(cameraOrbit.tilt);
  const position = [Math.sin(cameraOrbit.yaw) * sinTilt, -Math.cos(cameraOrbit.yaw) * sinTilt, Math.cos(cameraOrbit.tilt)];
  const forward = position.map((value) => -value);
  let right = [forward[1], -forward[0], 0];
  let rightLength = Math.hypot(...right);
  if (rightLength < .0001) { right = [1, 0, 0]; rightLength = 1; }
  right = right.map((value) => value / rightLength);
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0]
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const axes = [
    { label: 'X', vector: [1, 0, 0], color: '#ef8078' },
    { label: 'Y', vector: [0, 1, 0], color: '#73d7a6' },
    { label: 'Z', vector: [0, 0, 1], color: '#83c7ff' }
  ].map((axis) => ({
    ...axis,
    x: dot(axis.vector, right),
    y: -dot(axis.vector, up),
    depth: dot(axis.vector, forward)
  })).sort((a, b) => a.depth - b.depth);
  for (const axis of axes) {
    const endX = center + axis.x * radius;
    const endY = center + axis.y * radius;
    orientationContext.globalAlpha = axis.depth < 0 ? .38 : 1;
    orientationContext.strokeStyle = axis.color;
    orientationContext.fillStyle = axis.color;
    orientationContext.beginPath();
    orientationContext.moveTo(center, center);
    orientationContext.lineTo(endX, endY);
    orientationContext.stroke();
    orientationContext.beginPath();
    orientationContext.arc(endX, endY, axis.depth > 0 ? 3 : 2, 0, Math.PI * 2);
    orientationContext.fill();
    if (axis.depth >= -.15) {
      orientationContext.font = '600 8px ui-monospace, monospace';
      orientationContext.fillText(axis.label, endX + 5, endY + 3);
    }
  }
  orientationContext.globalAlpha = 1;
}

function dropHost(presetId) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) return null;
  if (preset.flags?.includes('free-placement')) return primaryStar();
  if (preset.type === 'moon') {
    const selected = selectedId ? system.body(selectedId) : null;
    if (selected?.type === 'planet') return selected;
    return system.body('earth') || primaryStar();
  }
  return primaryStar();
}

function nearestMassiveBody(positionM, bodies = []) {
  let nearest = null;
  let nearestDistanceM = Infinity;
  for (const body of bodies) {
    if (!body || body.massKg <= 0) continue;
    const dx = positionM[0] - body.positionM[0];
    const dy = positionM[1] - body.positionM[1];
    const dz = positionM[2] - body.positionM[2];
    const distanceM = Math.hypot(dx, dy, dz);
    if (distanceM < nearestDistanceM) {
      nearestDistanceM = distanceM;
      nearest = body;
    }
  }
  return nearest;
}

function resolvePlacementHost(presetId, explicitHost, positionM) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) return explicitHost || null;
  if (!preset.flags?.includes('free-placement')) return explicitHost || dropHost(presetId);
  const selectedBody = selectedId ? system.body(selectedId) : null;
  if (selectedBody && selectedBody.massKg > 0) return selectedBody;
  if (explicitHost && explicitHost.massKg > 0) return explicitHost;
  if (positionM && Array.isArray(system.bodies) && system.bodies.length > 0) {
    const nearest = nearestMassiveBody(positionM, system.bodies);
    if (nearest) return nearest;
  }
  return explicitHost || dropHost(presetId);
}

function shiftDropPositionAwayFrom(presetId, candidatePositionM, bodies = []) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset || !candidatePositionM) return null;
  let positionM = [...candidatePositionM];
  const movablePresetMassKg = Number(preset.massKg) || 0;
  const obstacleBodies = Array.isArray(bodies) ? bodies.filter((body) => body && body.massKg > 0) : [];

  const isFarEnoughFromAll = (position) => {
    for (const obstacle of obstacleBodies) {
      if (!obstacle?.positionM) continue;
      if (!Number.isFinite(obstacle.radiusM) || !Number.isFinite(obstacle.massKg) || obstacle.massKg <= 0) continue;
      const minimumDistanceM = minimumDropSeparationM(presetId, obstacle);
      if (!Number.isFinite(minimumDistanceM)) continue;
      const dx = position[0] - obstacle.positionM[0];
      const dy = position[1] - obstacle.positionM[1];
      const dz = position[2] - obstacle.positionM[2];
      const distanceM = Math.hypot(dx, dy, dz);
      if (distanceM < minimumDistanceM) return false;
    }
    return true;
  };

  for (let attempt = 0; attempt < 16; attempt += 1) {
    let corrected = false;
    for (const candidate of obstacleBodies) {
      if (!candidate?.positionM) continue;
      const minimumDistanceM = minimumDropSeparationM(presetId, candidate);
      if (!Number.isFinite(minimumDistanceM)) continue;
      const dx = positionM[0] - candidate.positionM[0];
      const dy = positionM[1] - candidate.positionM[1];
      const dz = positionM[2] - candidate.positionM[2];
      const distanceM = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(distanceM) || distanceM >= minimumDistanceM) continue;
      let direction = [dx, dy, dz];
      if (!Number.isFinite(distanceM) || distanceM < 1e-6) {
        direction = [1, 0, 0];
      } else {
        direction = direction.map((axis) => axis / distanceM);
      }
      const clearance = minimumDistanceM - distanceM + Math.max(.25 * minimumDistanceM, 1_000);
      positionM = [
        positionM[0] + direction[0] * clearance,
        positionM[1] + direction[1] * clearance,
        positionM[2] + direction[2] * clearance
      ];
      corrected = true;
    }
    if (!corrected) return positionM;
  }

  if (movablePresetMassKg === 0) return positionM;
  if (isFarEnoughFromAll(positionM)) return positionM;

  const nearest = nearestMassiveBody(positionM, obstacleBodies) || null;
  const nearestAnchor = nearest?.positionM || [0, 0, 0];
  const nearestDistanceM = nearest ? minimumDropSeparationM(presetId, nearest) : null;
  if (!Number.isFinite(nearestDistanceM) || !nearestAnchor) return null;
  let direction = [
    positionM[0] - nearestAnchor[0],
    positionM[1] - nearestAnchor[1],
    positionM[2] - nearestAnchor[2]
  ];
  if (!direction.every(Number.isFinite) || direction.every((axis) => axis === 0)) {
    direction = [1, 0, 0];
  }
  const directionLength = Math.hypot(...direction);
  const normalizedDirection = directionLength ? direction.map((axis) => axis / directionLength) : [1, 0, 0];
  const baseOffsetM = Math.max(nearestDistanceM * 1.12, nearestDistanceM + 2_000_000);
  const perpendicularA = Math.abs(normalizedDirection[0]) < .75
    ? [1, 0, 0]
    : [0, 1, 0];
  const basisX = [
    normalizedDirection[1] * perpendicularA[2] - normalizedDirection[2] * perpendicularA[1],
    normalizedDirection[2] * perpendicularA[0] - normalizedDirection[0] * perpendicularA[2],
    normalizedDirection[0] * perpendicularA[1] - normalizedDirection[1] * perpendicularA[0]
  ];
  const basisXLen = Math.hypot(...basisX);
  const basisN = basisXLen ? basisX.map((axis) => axis / basisXLen) : [0, 0, 1];
  const basisY = [
    normalizedDirection[1] * basisN[2] - normalizedDirection[2] * basisN[1],
    normalizedDirection[2] * basisN[0] - normalizedDirection[0] * basisN[2],
    normalizedDirection[0] * basisN[1] - normalizedDirection[1] * basisN[0]
  ];
  const basisYLen = Math.hypot(...basisY);
  const basisM = basisYLen ? basisY.map((axis) => axis / basisYLen) : [0, 1, 0];

  for (let ring = 1; ring <= 8; ring += 1) {
    const scale = Math.pow(1.5, ring) * baseOffsetM;
    for (let sector = 0; sector < 12; sector += 1) {
      const theta = (Math.PI * 2 * sector) / 12;
      const swirl = [
        basisN[0] * Math.cos(theta) + basisM[0] * Math.sin(theta),
        basisN[1] * Math.cos(theta) + basisM[1] * Math.sin(theta),
        basisN[2] * Math.cos(theta) + basisM[2] * Math.sin(theta)
      ];
      const probe = [
        nearestAnchor[0] + normalizedDirection[0] * (scale * .75) + swirl[0] * (scale * .25),
        nearestAnchor[1] + normalizedDirection[1] * (scale * .75) + swirl[1] * (scale * .25),
        nearestAnchor[2] + normalizedDirection[2] * (scale * .75) + swirl[2] * (scale * .25)
      ];
      if (isFarEnoughFromAll(probe)) return probe;
    }
  }
  return null;
}

function safeDroppedBodyRecord(presetId, payload) {
  const sanitizeVector3 = (value, label) => {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
      throw new TypeError(`${label} must be a finite [x, y, z] vector`);
    }
    return [...value];
  };
  const fallbackHostAnchor = (candidatePositionM, bodies = []) => {
    const hostCandidate = payload.host || nearestMassiveBody(candidatePositionM, bodies);
    if (hostCandidate?.positionM) return [...hostCandidate.positionM];
    return [0, 0, 0];
  };
  const fallbackDistance = (candidateBody) => {
    const preset = OBJECT_PRESETS[presetId];
    if (!preset || !candidateBody) return null;
    const minimumDistanceM = minimumDropSeparationM(presetId, candidateBody);
    if (!Number.isFinite(minimumDistanceM)) return null;
    return Math.max(minimumDistanceM * 1.8, minimumDistanceM + 1_000_000);
  };

  try {
    payload.positionM = sanitizeVector3(payload.positionM, 'Body position');
    return droppedBodyRecord(presetId, payload);
  } catch (error) {
    if (!(error instanceof RangeError) || !payload?.positionM) throw error;
    const bodies = Array.isArray(payload.existingBodies) ? payload.existingBodies : [];
    const shifted = shiftDropPositionAwayFrom(presetId, payload.positionM, bodies);
    if (!shifted) throw error;
    if (shifted[0] !== payload.positionM[0] || shifted[1] !== payload.positionM[1] || shifted[2] !== payload.positionM[2]) {
      showToast(`Placement was blocked; moved to nearest stable radius around nearby masses.`);
    }
    try {
      return droppedBodyRecord(presetId, { ...payload, positionM: shifted });
  } catch (fallbackError) {
      const anchor = fallbackHostAnchor(payload.positionM, bodies);
      const closest = nearestMassiveBody(payload.positionM, bodies);
      const clearance = fallbackDistance(closest);
      if (!(fallbackError instanceof RangeError) || !closest || !Number.isFinite(clearance)) throw fallbackError;
      let direction = [
        payload.positionM[0] - anchor[0],
        payload.positionM[1] - anchor[1],
        payload.positionM[2] - anchor[2]
      ];
      if (!Number.isFinite(direction[0]) || !Number.isFinite(direction[1]) || !Number.isFinite(direction[2])) {
        direction = [1, 0, 0];
      }
      const directionMagnitude = Math.hypot(...direction);
      if (!directionMagnitude) direction = [1, 0, 0];
      else direction = direction.map((axis) => axis / directionMagnitude);
      const fallbackPosition = [
        anchor[0] + direction[0] * clearance,
        anchor[1] + direction[1] * clearance,
        anchor[2] + direction[2] * clearance
      ];
      const stableFallback = fallbackPosition;
      showToast(`Placement was extremely constrained. Forced final fallback shell placement was applied.`);
      return droppedBodyRecord(presetId, { ...payload, positionM: stableFallback });
    }
  }
}

function placementProtectionFramesForRecord(record) {
  const flags = Array.isArray(record.flags) ? record.flags : [];
  if (flags.includes('no-collision') || flags.includes('event-marker') || record.massKg <= 0) return 0;
  return PLACEMENT_PROTECTION_FRAMES;
}

function placeContentPreset(presetId, positionM) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) return;
  try {
    running = false;
    pendingStepSeconds = 0;
    stepAccumulator = 0;
    const id = uniqueId(preset.type === 'tracer' ? 'tracer' : preset.type);
    const host = resolvePlacementHost(presetId, null, positionM);
    const record = safeDroppedBodyRecord(presetId, {
      id,
      positionM,
      host,
      existingBodies: system.bodies
    });
    record.placementProtectionFrames = placementProtectionFramesForRecord(record);
    const matchingNames = system.bodies.filter((body) => body.flags?.includes(`preset:${presetId}`)).length;
    record.name = matchingNames === 0 ? preset.name : `${preset.name} ${matchingNames + 1}`;
    pushUndo(`add ${preset.name}`);
    system.addBody(record);
    system.stepSeconds = recommendedOrbitStep(system.bodies, system.stepSeconds);
    trackPlacedBody(id);
    selectedId = id;
    cameraTargetId = id;
    if (scaleMode !== 'body') {
      cameraMode = 'track';
      scenarioWidthM = null;
      cameraOrbit = { ...CAMERA_VIEWS.eye };
    }
    system.rebaseline('content-drawer-drop');
    trails.clear();
    lastTrailTime = -Infinity;
    showToast(`${preset.name} placed and held at day ${(system.timeSeconds / DAY_S).toFixed(2)}. Press Run when the arrangement is ready.`);
    cancelContentPlacement({ announce: false, restoreRunning: false });
    openInspector(id);
    closeInspector({ clearSelection: false });
    if (presetId === 'sun-like' && scientistTutorial?.record('sun-placed', { presetId, bodyId: id })) {
      cameraTargetId = id;
      cameraMode = 'track';
      cameraOrbit = { ...CAMERA_VIEWS.eye };
      scenarioWidthM = AU_M * 1.2;
    }
    if (presetId === 'earth-analogue') {
      scientistTargetId = id;
      if (scientistTutorial?.record('earth-placed', { presetId, bodyId: id })) {
        scenarioWidthM = null;
      }
    }
    if (OBJECT_PRESETS[presetId]?.flags?.includes('earth-scale-object')) {
      scientistTargetId = id;
      if (scientistTutorial?.record('vehicle-placed', { presetId, bodyId: id })) {
        cameraTargetId = id;
      }
    }
    renderWorkspaceStrip();
    updateReadouts();
  } catch (error) {
    showToast(error.message);
  }
}

function armContentPlacement(presetId) {
  const preset = OBJECT_PRESETS[presetId];
  if (!preset) return;
  const host = resolvePlacementHost(presetId, null, null);
  if (!placementPresetId) placementResumeState = running;
  running = false;
  pendingStepSeconds = 0;
  stepAccumulator = 0;
  placementPresetId = presetId;
  closeContentDrawer();
  inspector.classList.remove('is-open');
  inspector.setAttribute('aria-hidden', 'true');
  laboratory.classList.add('is-placing');
  const hud = document.querySelector('#placement-hud');
  hud.classList.add('is-active');
  hud.setAttribute('aria-hidden', 'false');
  document.querySelector('#placement-name').textContent = preset.name;
  document.querySelector('#placement-host').textContent = host
    ? preset.flags?.includes('free-placement')
      ? `Host: ${host.name} · zero initial velocity · time held`
      : `Host: ${host.name} · computed tangential start · time held`
    : 'No host · zero initial velocity · time held until Run';
  document.querySelectorAll('[data-object-preset]').forEach((button) => button.classList.toggle('is-armed', button.dataset.objectPreset === presetId));
  document.querySelector('#selection-kicker').textContent = 'PLACE OBJECT';
  document.querySelector('#selection-name').textContent = `${preset.name} · click the grid`;
  canvas.focus({ preventScroll: true });
  showToast(`${preset.name} armed${host ? ` around ${host.name}` : ''}. Click its exact position on the 3D grid; Esc or Cancel.`);
  updateReadouts();
}

function cancelContentPlacement({ announce = true, restoreRunning = true } = {}) {
  if (!placementPresetId) return;
  placementPresetId = null;
  if (restoreRunning && placementResumeState !== null) running = placementResumeState;
  placementResumeState = null;
  laboratory.classList.remove('is-placing');
  const hud = document.querySelector('#placement-hud');
  hud.classList.remove('is-active');
  hud.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('[data-object-preset]').forEach((button) => button.classList.remove('is-armed'));
  if (selectedId && system.body(selectedId)) {
    document.querySelector('#selection-kicker').textContent = 'SELECTED';
    document.querySelector('#selection-name').textContent = system.body(selectedId).name;
  } else {
    document.querySelector('#selection-kicker').textContent = 'TARGET';
    document.querySelector('#selection-name').textContent = 'Click a body to inspect';
  }
  if (announce) showToast('Object placement cancelled.');
  updateReadouts();
}

function contentDropPosition(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null;
  if (contentDrawer.classList.contains('is-open') && clientY >= contentDrawer.getBoundingClientRect().top) return null;
  return solarRenderer.unprojectToPlane(clientX - bounds.left, clientY - bounds.top, 0);
}

function clearToBlankCanvas() {
  cancelContentPlacement({ announce: false, restoreRunning: false });
  pushUndo('clear canvas');
  loadScenario('blank-canvas', { startRunning: false });
}

function markCameraCustom() {
  cameraMode = cameraTargetId ? 'track' : 'custom';
  updateReadouts();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) return;
  if (relativityPlacementTarget) {
    event.preventDefault();
    const positionM = contentDropPosition(event.clientX, event.clientY);
    if (positionM) placeRelativityEvent(relativityPlacementTarget, positionM);
    else showToast('Choose a visible point on the 3D grid.');
    return;
  }
  if (activeExperiment === 'relativity' && relativityRocketBodyId) {
    const point = relativityRocketScreenPoint();
    if (point) {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (Math.hypot(x - point[0], y - point[1]) < 22) {
        event.preventDefault();
        setRelativityActiveFrame('rocket');
        showToast('Switched to rocket frame. You can switch back to Sun frame with the controls.');
        return;
      }
    }
  }
  if (placementPresetId) {
    event.preventDefault();
    const positionM = contentDropPosition(event.clientX, event.clientY);
    if (positionM) placeContentPreset(placementPresetId, positionM);
    else showToast('Choose a visible point on the 3D grid.');
    return;
  }
  const body = scaleMode === 'body' ? null : hitTest(event.clientX, event.clientY);
  cameraDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    distance: 0,
    bodyId: body?.id || null,
    bodyZ: body?.positionM[2] || 0,
    editingBody: false,
    beforeEdit: body ? captureEditorState(`move ${body.name}`) : null,
    wasRunning: running
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
});

canvas.addEventListener('pointermove', (event) => {
  if (!cameraDrag || cameraDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - cameraDrag.lastX;
  const dy = event.clientY - cameraDrag.lastY;
  cameraDrag.lastX = event.clientX;
  cameraDrag.lastY = event.clientY;
  cameraDrag.distance = Math.max(cameraDrag.distance, Math.hypot(event.clientX - cameraDrag.startX, event.clientY - cameraDrag.startY));
  if (cameraDrag.distance <= 4) return;
  if (cameraDrag.bodyId) {
    const bounds = canvas.getBoundingClientRect();
    const positionM = solarRenderer.unprojectToPlane(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      cameraDrag.bodyZ
    );
    if (positionM) {
      if (!cameraDrag.editingBody) {
        cameraDrag.editingBody = true;
        pushUndoState(cameraDrag.beforeEdit);
        running = false;
        selectedId = cameraDrag.bodyId;
        showToast('Direct edit: position changes; the current velocity is retained.');
      }
      system.editBody(cameraDrag.bodyId, { positionM });
      trails.clear();
      lastTrailTime = -Infinity;
      canvas.style.cursor = 'move';
    }
    return;
  }
  cameraOrbit.yaw += dx * .006;
  cameraOrbit.tilt = Math.max(.01, Math.min(Math.PI * .485, cameraOrbit.tilt + dy * .006));
  cameraMode = cameraTargetId ? 'track' : 'custom';
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('pointerup', (event) => {
  if (!cameraDrag || cameraDrag.pointerId !== event.pointerId) return;
  const wasDrag = cameraDrag.distance > 4;
  const editedBodyId = cameraDrag.editingBody ? cameraDrag.bodyId : null;
  const resumeAfterEdit = cameraDrag.wasRunning;
  cameraDrag = null;
  canvas.style.cursor = 'crosshair';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (editedBodyId) {
    system.rebaseline('direct-position-edit');
    running = resumeAfterEdit;
    showToast(resumeAfterEdit
      ? 'Body released. Live gravity resumed with its previous velocity.'
      : 'Body released. Simulation remains paused; its previous velocity is retained.');
    openInspector(editedBodyId);
    updateReadouts();
    return;
  }
  if (wasDrag) {
    updateReadouts();
    return;
  }
  if (scaleMode === 'body') {
    leaveBodyApproach({ reopenInspector: false });
    return;
  }
  const body = hitTest(event.clientX, event.clientY);
  if (body) {
    openInspector(body.id);
  } else {
    if (cameraTargetId) {
      cameraTargetId = null;
      cameraMode = 'eye';
    }
    closeInspector();
    updateReadouts();
  }
});

canvas.addEventListener('pointercancel', (event) => {
  if (cameraDrag?.pointerId === event.pointerId) {
    if (cameraDrag.editingBody) {
      system.rebaseline('cancelled-direct-position-edit');
      running = cameraDrag.wasRunning;
    }
    cameraDrag = null;
  }
  canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraOrbit.zoom = Math.max(.04, Math.min(80, cameraOrbit.zoom * Math.exp(-event.deltaY * .001)));
  markCameraCustom();
}, { passive: false });

orientationGizmo.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  orientationDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    yaw: cameraOrbit.yaw,
    tilt: cameraOrbit.tilt
  };
  orientationGizmo.setPointerCapture(event.pointerId);
  orientationGizmo.focus({ preventScroll: true });
});

orientationGizmo.addEventListener('pointermove', (event) => {
  if (!orientationDrag || orientationDrag.pointerId !== event.pointerId) return;
  cameraOrbit.yaw = orientationDrag.yaw + (event.clientX - orientationDrag.startX) * .012;
  cameraOrbit.tilt = Math.max(.01, Math.min(Math.PI * .485, orientationDrag.tilt + (event.clientY - orientationDrag.startY) * .012));
  cameraTargetId = null;
  cameraMode = 'custom';
});

function endOrientationDrag(event) {
  if (!orientationDrag || orientationDrag.pointerId !== event.pointerId) return;
  orientationDrag = null;
  if (orientationGizmo.hasPointerCapture(event.pointerId)) orientationGizmo.releasePointerCapture(event.pointerId);
  updateReadouts();
}

orientationGizmo.addEventListener('pointerup', endOrientationDrag);
orientationGizmo.addEventListener('pointercancel', endOrientationDrag);
orientationGizmo.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
  event.preventDefault();
  if (key === 'arrowleft') cameraOrbit.yaw -= .08;
  if (key === 'arrowright') cameraOrbit.yaw += .08;
  if (key === 'arrowup') cameraOrbit.tilt = Math.max(.01, cameraOrbit.tilt - .06);
  if (key === 'arrowdown') cameraOrbit.tilt = Math.min(Math.PI * .485, cameraOrbit.tilt + .06);
  cameraTargetId = null;
  cameraMode = 'custom';
  updateReadouts();
});

canvas.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  let handled = true;
  if (key === 'arrowleft') { cameraOrbit.yaw -= .08; markCameraCustom(); }
  else if (key === 'arrowright') { cameraOrbit.yaw += .08; markCameraCustom(); }
  else if (key === 'arrowup') { cameraOrbit.tilt = Math.max(.01, cameraOrbit.tilt - .06); markCameraCustom(); }
  else if (key === 'arrowdown') { cameraOrbit.tilt = Math.min(Math.PI * .485, cameraOrbit.tilt + .06); markCameraCustom(); }
  else if (key === '+' || key === '=') { cameraOrbit.zoom = Math.min(80, cameraOrbit.zoom * 1.12); markCameraCustom(); }
  else if (key === '-' || key === '_') { cameraOrbit.zoom = Math.max(.04, cameraOrbit.zoom / 1.12); markCameraCustom(); }
  else if (key === '[') nudgeTimeWarp(-1);
  else if (key === ']') nudgeTimeWarp(1);
  else if (key === 'r' || key === '0') resetCamera();
  else if (key === 'e') setCameraView('ecliptic');
  else if (key === '7') setCameraView('top');
  else if (key === '1') openInspector('sun');
  else if (key === '2') openInspector('earth');
  else if (key === '3') openInspector('moon');
  else if (key === 'f') focusSelected();
  else if (key === 'escape' && placementPresetId) cancelContentPlacement();
  else if (key === 'escape' && scaleMode === 'body') leaveBodyApproach();
  else handled = false;
  if (handled) {
    event.preventDefault();
    updateReadouts();
  }
});

document.querySelector('#close-inspector').addEventListener('click', closeInspector);
document.querySelector('#focus-selected').addEventListener('click', focusSelected);
document.querySelector('#approach-selected').addEventListener('click', approachSelected);
document.querySelector('#return-system-view').addEventListener('click', () => leaveBodyApproach());
document.querySelector('#close-experiment').addEventListener('click', () => {
  if (scaleMode === 'body' && approachOrigin === 'seasons') leaveBodyApproach({ reopenInspector: false, announce: false });
  closeExperiment();
});
document.querySelector('#season-globe').addEventListener('click', () => {
  if (scaleMode === 'body' && approachOrigin === 'seasons') leaveBodyApproach({ reopenInspector: false });
  else enterBodyApproach('earth', { origin: 'seasons' });
});
document.querySelector('#close-guide').addEventListener('click', () => closeGuide({ restoreFocus: true }));
guideToggle.addEventListener('click', () => {
  if (guideCard.classList.contains('is-open')) closeGuide({ restoreFocus: true });
  else openGuide();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && guideCard.classList.contains('is-open')) {
    event.preventDefault();
    closeGuide({ restoreFocus: true });
  }
});
voicePreflight.addEventListener('click', checkVoiceReadiness);
voiceToggle.addEventListener('click', startVoice);
voiceInterrupt.addEventListener('click', interruptVoice);
copyVoiceReceiptButton.addEventListener('click', copyVoiceReceipt);
renderVoiceReceipt();

document.querySelector('#guide-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const questionInput = document.querySelector('#guide-question');
  const question = questionInput.value.trim();
  if (!question) return;
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  appendGuideMessage('learner', question);
  questionInput.value = '';
  submit.disabled = true;
  submit.textContent = 'Thinking…';
  try {
    const response = await fetch('/api/lab/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, snapshot: guideSnapshot() })
    });
    const body = await response.json();
    appendGuideMessage('guide', response.ok ? body.answer : 'The tutor is resting right now. Try again in a moment.');
  } catch {
    appendGuideMessage('guide', 'The tutor is resting right now. Try again in a moment.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Ask';
  }
});
document.querySelectorAll('[data-experiment]').forEach((button) => {
  button.addEventListener('click', () => {
    if (activeExperiment === button.dataset.experiment && experimentCard.classList.contains('is-open')) closeExperiment();
    else openExperiment(button.dataset.experiment);
  });
});

document.querySelectorAll('[data-tilt-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const degrees = Number(button.dataset.tiltPreset);
    pushUndo('change Earth spin-axis tilt');
    system.editBody('earth', { axialTiltRad: degrees * Math.PI / 180 });
    updateReadouts();
  });
});

document.querySelectorAll('[data-season-phase]').forEach((button) => {
  button.addEventListener('click', () => {
    seasonPhaseOverrideRad = Number(button.dataset.seasonPhase) * Math.PI / 180;
    updateReadouts();
  });
});

document.querySelector('#season-tilt').addEventListener('input', (event) => {
  const degrees = Number(event.target.value);
  system.editBody('earth', { axialTiltRad: degrees * Math.PI / 180 });
  updateReadouts();
});

document.querySelector('#magnetic-preset').addEventListener('change', (event) => {
  magneticMode = event.target.value;
  updateReadouts();
});

document.querySelector('#field-layer').addEventListener('change', (event) => {
  const nextLayer = event.target.value;
  if (nextLayer === 'magnetic' && !system.body('earth')) {
    event.target.value = 'gravity';
    showToast('The dipole layer needs an Earth record. Newtonian gravity remains available for this system.');
    return;
  }
  fieldLayer = nextLayer;
  recordFieldLessonLayer(fieldLayer);
  scaleMode = fieldLayer === 'magnetic' ? 'lunar' : 'solar';
  trails.clear();
  lastTrailTime = -Infinity;
  updateReadouts();
});

document.querySelector('#dark-matter-preset').addEventListener('change', (event) => {
  setDarkMatterMode(event.target.value);
  scientistTutorial?.record('dark-matter-mode-set', { mode: darkMatterMode });
});

document.querySelector('#impact-parameter').addEventListener('input', (event) => {
  lightImpactRadii = Number(event.target.value);
  updateReadouts();
});

document.querySelector('#light-exaggeration').addEventListener('change', (event) => {
  lightVisualExaggeration = Number(event.target.value);
  updateReadouts();
});
document.querySelector('#relativity-speed').addEventListener('input', (event) => {
  const value = Number(event.target.value);
  if (!Number.isFinite(value)) return;
  relativityVelocityFraction = Math.max(.01, Math.min(.5, value));
  updateRelativityExperiment();
  scientistTutorial?.record('relativity-speed-changed', relativityThoughtSnapshot());
});
document.querySelector('#relativity-anchor-selected-a').addEventListener('click', () => anchorRelativityEventToSelectedBody('a'));
document.querySelector('#relativity-anchor-selected-b').addEventListener('click', () => anchorRelativityEventToSelectedBody('b'));
document.querySelector('#relativity-reposition-earth').addEventListener('click', () => armRelativityEventPlacement('a'));
document.querySelector('#relativity-reposition-mars').addEventListener('click', () => armRelativityEventPlacement('b'));
document.querySelector('#relativity-auto-run').addEventListener('click', () => runRelativityAutoExperiment());
document.querySelector('#relativity-launch').addEventListener('click', launchRelativityRocket);
document.querySelector('#relativity-reset').addEventListener('click', () => resetRelativityEvents());
document.querySelector('#relativity-step-setup-next').addEventListener('click', () => setRelativityWizardStep(1));
document.querySelector('#relativity-step-sun-frame-next').addEventListener('click', () => setRelativityWizardStep(2));
document.querySelector('#relativity-step-launch-next').addEventListener('click', () => {
  if (!relativityRocketBodyId) return showToast('Launch the rocket before moving to the Rocket-frame step.');
  setRelativityWizardStep(3);
});
document.querySelector('#relativity-step-rocket-frame-next').addEventListener('click', () => setRelativityWizardStep(4));
document.querySelector('#relativity-frame-sun').addEventListener('click', () => setRelativityActiveFrame('sun'));
document.querySelector('#relativity-frame-rocket').addEventListener('click', () => setRelativityActiveFrame('rocket'));
document.querySelector('#relativity-show-signal-travel').addEventListener('change', (event) => {
  relativityShowSignalTravel = Boolean(event.target.checked);
  updateRelativityExperiment();
});
document.querySelector('#emit-light-signal').addEventListener('click', () => {
  lightPulsePhase = 0;
  running = true;
  const lens = lightLens();
  if (!lens) {
    showToast('Add a star or black hole before emitting a light signal.');
    return;
  }
  const readout = currentExperimentState()?.lightPath?.frequency;
  scientistTutorial?.record('light-signaled', {
    experiment: 'light',
    lensId: lens.id,
    deltaSpeedKmPerS: 0,
    relativeSpeedKmPerS: Number(readout?.dopplerFactor ?? 0),
    dopplerFactor: Number(readout?.dopplerFactor ?? 1),
    gravityFactor: Number(readout?.gravityFactor ?? 1),
    restFrequencyHz: Number(readout?.restFrequencyHz ?? 0),
    observedFrequencyHz: Number(readout?.observedFrequencyHz ?? 0),
    redshift: Number(readout?.redshift ?? 0)
  });
  showToast(`Light signal emitted past ${lens.name}.`);
  updateReadouts();
});
document.querySelector('#play-toggle').addEventListener('click', () => {
  if (activeExperiment === 'relativity' && !relativityRocketBodyId) {
    showToast('Launch the rocket first. Run/Pause will then control the same relativity playback.');
    return;
  }
  running = !running;
  pendingStepSeconds = 0;
  stepAccumulator = 0;
  if (running) setPreviewEnabled(false);
  updateReadouts();
  if (activeExperiment === 'relativity') updateRelativityExperiment();
  if (running) recordScientistSimulationRun();
});
document.querySelector('#step-day').addEventListener('click', () => {
  running = false;
  setPreviewEnabled(false);
  stepAccumulator = 0;
  pendingStepSeconds = Math.max(1, Math.round(DAY_S / system.stepSeconds)) * system.stepSeconds;
  updateReadouts();
});
document.querySelector('#preview-paths').addEventListener('click', () => setPreviewEnabled(!previewEnabled));
document.querySelector('#close-preview').addEventListener('click', () => setPreviewEnabled(false));
document.querySelector('#preview-duration').addEventListener('change', () => { previewSignature = ''; });
document.querySelector('#undo-edit').addEventListener('click', undoLastEdit);
document.querySelector('#reset-system').addEventListener('click', () => {
  pushUndo('reset scenario');
  const restartPaused = scenarioMode === 'world-collision' || scenarioMode === 'blank-canvas';
  loadScenario(scenarioMode, { startRunning: restartPaused ? false : running, announce: false });
  showToast(restartPaused
    ? `Restarted ${document.querySelector('#scenario-select').selectedOptions[0].textContent} clean and paused.`
    : `Restarted ${document.querySelector('#scenario-select').selectedOptions[0].textContent} from its original preset.`);
});
document.querySelector('#scenario-select').addEventListener('change', (event) => {
  pushUndo('change scenario');
  loadScenario(event.target.value, { startRunning: false });
  const documentState = activeSystemDocument(systemWorkspace);
  if (documentState) documentState.name = event.target.selectedOptions[0].textContent;
  saveActiveSystemDocument();
  renderWorkspaceStrip();
  showToast('Scenario ready and paused. Preview its paths or press Run.');
});
timeWarp.addEventListener('change', (event) => setTimeWarp(event.target.value));
document.querySelector('#time-slower').addEventListener('click', () => nudgeTimeWarp(-1));
document.querySelector('#time-faster').addEventListener('click', () => nudgeTimeWarp(1));
document.querySelector('#camera-select').addEventListener('change', (event) => {
  if (event.target.value === 'track') focusSelected();
  else setCameraView(event.target.value);
});
document.querySelector('#frame-reference-select').addEventListener('change', (event) => {
  setFrameReferenceMode(event.target.value);
});
document.querySelector('#radius-mode-toggle').addEventListener('click', () => {
  visualRadiusMode = visualRadiusMode === 'readable' ? 'physical-ratio' : 'readable';
  showToast(visualRadiusMode === 'physical-ratio'
    ? 'True body-to-body radius ratios active. Small planets may appear as points; hit targets remain accessible.'
    : 'Readable radii active. Physical radius, gravity, collisions, and measurements are unchanged.');
  updateReadouts();
});
document.querySelector('#body-select').addEventListener('change', (event) => {
  const id = event.target.value;
  if (id) return openInspector(id);
  if (scaleMode === 'body') leaveBodyApproach({ reopenInspector: false, announce: false });
  closeExperiment();
  closeInspector();
  cameraTargetId = null;
  scaleMode = scenarioDefinitions[scenarioMode].scaleMode;
  setCameraView('eye', { announce: false, clearTarget: true });
  trails.clear();
  lastTrailTime = -Infinity;
  showToast('Showing all placed objects in the scenario eye view.');
  updateReadouts();
});
document.querySelector('#orbit-details').addEventListener('toggle', (event) => {
  if (event.target.open) scientistTutorial?.record('orbit-inspected');
});
const thoughtTitleInput = document.querySelector('#thought-title-input');
const thoughtFormulaInput = document.querySelector('#thought-formula-input');
const thoughtContextInput = document.querySelector('#thought-context-input');
const thoughtSaveButton = document.querySelector('#thought-note-save');
const thoughtResetButton = document.querySelector('#thought-note-reset');
if (thoughtSaveButton) {
  thoughtSaveButton.addEventListener('click', saveThoughtNoteForSelectedBody);
}
if (thoughtResetButton) {
  thoughtResetButton.addEventListener('click', resetThoughtNoteForSelectedBody);
}
for (const field of [thoughtTitleInput, thoughtFormulaInput, thoughtContextInput]) {
  if (!field) continue;
  field.addEventListener('input', () => {
    const panel = document.querySelector('#thought-equation-notes');
    const status = panel?.querySelector('#thought-equation-status');
    if (status) status.textContent = 'Unsaved change · click Save note to persist for this body.';
  });
}
document.querySelector('#grid-opacity').addEventListener('input', (event) => {
  solarRenderer.setPresentation({ gridOpacity: Number(event.target.value) });
});
document.querySelector('#constellation-opacity').addEventListener('input', (event) => {
  solarRenderer.setPresentation({ constellationOpacity: Number(event.target.value) });
});
const renderQualityControl = document.querySelector('#render-quality');
const initialRenderQuality = solarRenderer.setQuality(renderQualityControl.value);
renderQualityControl.querySelector('option[value="auto"]').textContent = `Auto · ${initialRenderQuality}`;
renderQualityControl.addEventListener('change', (event) => {
  const resolved = solarRenderer.setQuality(event.target.value);
  renderQualityControl.querySelector('option[value="auto"]').textContent = `Auto · ${resolved}`;
  showToast(`GPU quality: ${event.target.value === 'auto' ? `Auto → ${resolved}` : resolved}. Collision particles and pixel density updated.`);
});
document.querySelector('#open-content').addEventListener('click', () => {
  if (!contentDrawer.classList.contains('is-open')) {
    drawerMode = 'objects';
    openContentDrawer();
  } else if (drawerMode === 'objects') closeContentDrawer();
  else setDrawerMode('objects');
});
document.querySelector('#close-content').addEventListener('click', closeContentDrawer);
document.querySelector('#drawer-objects-tab').addEventListener('click', () => setDrawerMode('objects'));
document.querySelector('#drawer-systems-tab').addEventListener('click', () => setDrawerMode('systems'));
document.querySelector('#cancel-placement').addEventListener('click', () => cancelContentPlacement());
document.querySelector('#clear-canvas').addEventListener('click', clearToBlankCanvas);

document.querySelectorAll('[data-object-preset]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    button.draggable = false;
    contentPointerDrag = {
      pointerId: event.pointerId,
      presetId: button.dataset.objectPreset,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('dragstart', (event) => {
    draggingPresetId = button.dataset.objectPreset;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-light-years-object', draggingPresetId);
    event.dataTransfer.setData('text/plain', draggingPresetId);
  });
  button.addEventListener('dragend', () => {
    draggingPresetId = null;
    canvas.classList.remove('is-drop-target');
  });
  button.addEventListener('click', () => {
    if (!suppressContentClick) armContentPlacement(button.dataset.objectPreset);
  });
});

document.addEventListener('pointermove', (event) => {
  if (!contentPointerDrag || contentPointerDrag.pointerId !== event.pointerId) return;
  if (Math.hypot(event.clientX - contentPointerDrag.startX, event.clientY - contentPointerDrag.startY) <= 7) return;
  contentPointerDrag.dragging = true;
  canvas.classList.toggle('is-drop-target', Boolean(contentDropPosition(event.clientX, event.clientY)));
});

document.addEventListener('pointerup', (event) => {
  if (!contentPointerDrag || contentPointerDrag.pointerId !== event.pointerId) return;
  const drag = contentPointerDrag;
  contentPointerDrag = null;
  canvas.classList.remove('is-drop-target');
  const sourceButton = document.querySelector(`[data-object-preset="${drag.presetId}"]`);
  if (sourceButton?.hasPointerCapture(event.pointerId)) sourceButton.releasePointerCapture(event.pointerId);
  if (sourceButton) sourceButton.draggable = true;
  suppressContentClick = true;
  setTimeout(() => { suppressContentClick = false; }, 0);
  if (!drag.dragging) {
    armContentPlacement(drag.presetId);
    return;
  }
  const positionM = contentDropPosition(event.clientX, event.clientY);
  if (positionM) placeContentPreset(drag.presetId, positionM);
  else showToast('Release the object on the visible reference grid.');
});

document.addEventListener('pointercancel', (event) => {
  if (!contentPointerDrag || contentPointerDrag.pointerId !== event.pointerId) return;
  const sourceButton = document.querySelector(`[data-object-preset="${contentPointerDrag.presetId}"]`);
  contentPointerDrag = null;
  if (sourceButton) sourceButton.draggable = true;
  canvas.classList.remove('is-drop-target');
});

canvas.addEventListener('dragenter', (event) => {
  if (!draggingPresetId && !event.dataTransfer.types.includes('application/x-light-years-object')) return;
  event.preventDefault();
  canvas.classList.add('is-drop-target');
});
canvas.addEventListener('dragover', (event) => {
  if (!draggingPresetId && !event.dataTransfer.types.includes('application/x-light-years-object')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  canvas.classList.add('is-drop-target');
});
canvas.addEventListener('dragleave', (event) => {
  if (event.relatedTarget && canvas.contains(event.relatedTarget)) return;
  canvas.classList.remove('is-drop-target');
});
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  canvas.classList.remove('is-drop-target');
  const presetId = event.dataTransfer.getData('application/x-light-years-object') || event.dataTransfer.getData('text/plain') || draggingPresetId;
  const positionM = contentDropPosition(event.clientX, event.clientY);
  if (!positionM) return showToast('Drop on the visible reference grid.');
  placeContentPreset(presetId, positionM);
});

function applyMassScale() {
  if (!selectedId) return;
  const editedBody = system.body(selectedId);
  if (!massHistoryState) massHistoryState = { snapshot: captureEditorState(`change ${system.body(selectedId)?.name || 'body'} mass`), pushed: false };
  if (!massHistoryState.pushed) {
    pushUndoState(massHistoryState.snapshot);
    massHistoryState.pushed = true;
  }
  const multiplier = 10 ** Number(massScale.value);
  const changes = {
    massKg: selectedBaseMassKg * multiplier,
    radiusM: isBlackHoleBody(editedBody) ? selectedBaseRadiusM * multiplier : selectedBaseRadiusM,
  };
  system.editBody(selectedId, changes);
  system.rebaseline('mass-edit');
  document.querySelector('#mass-output').textContent = `${multiplier.toFixed(multiplier < 10 ? 2 : 1)}×`;
  if (massLessonTarget && Math.abs(multiplier - 2) <= .05) massLessonTarget.hidden = true;
  recordBarycenterLessonAction(multiplier);
  const lessonAdvanced = scientistTutorial?.record('moon-mass-changed', {
    bodyId: editedBody?.id,
    bodyType: editedBody?.type,
    multiplier
  });
  if (lessonAdvanced && editedBody?.id === 'moon') closeInspector({ clearSelection: false });
  updateReadouts();
}

function applyImpulse(axisIndex, sign = 1) {
  if (!selectedId) return;
  const editedBody = system.body(selectedId);
  if (!editedBody) return;
  const delta = Number(impulseMagnitude.value);
  if (!Number.isFinite(delta) || delta < 0) return;
  const nextVelocity = [...editedBody.velocityMps];
  if (!Number.isFinite(nextVelocity[axisIndex])) nextVelocity[axisIndex] = 0;
  nextVelocity[axisIndex] += delta * sign;
  if (!velocityHistoryState) velocityHistoryState = { snapshot: captureEditorState(`apply ${editedBody.name} impulse`), pushed: false };
  if (!velocityHistoryState.pushed) {
    pushUndoState(velocityHistoryState.snapshot);
    velocityHistoryState.pushed = true;
  }
  system.editBody(selectedId, { velocityMps: nextVelocity });
  const step = scientistTutorial?.currentStep;
  if (step?.event === 'thrust-applied' && (editedBody.flags || []).includes('earth-scale-object')) {
    scientistTutorial.record('thrust-applied', {
      bodyId: editedBody.id,
      bodyType: editedBody.type,
      deltaMps: delta,
      axisIndex,
      sign
    });
  }
  showToast(`${editedBody.name}: velocity adjusted by ${(sign * delta).toFixed(1)} m/s on axis ${['X', 'Y', 'Z'][axisIndex]}.`);
  updateReadouts();
}

function clearSelectedVelocity() {
  if (!selectedId) return;
  const editedBody = system.body(selectedId);
  if (!editedBody) return;
  if (!velocityHistoryState) velocityHistoryState = { snapshot: captureEditorState(`zero ${editedBody.name} velocity`), pushed: false };
  if (!velocityHistoryState.pushed) {
    pushUndoState(velocityHistoryState.snapshot);
    velocityHistoryState.pushed = true;
  }
  system.editBody(selectedId, { velocityMps: [0, 0, 0] });
  showToast(`${editedBody.name} velocity set to zero for launch-state inspection.`);
  updateReadouts();
}

massScale.addEventListener('input', applyMassScale);
massScale.addEventListener('change', applyMassScale);
document.querySelector('#mass-decrease').addEventListener('click', () => {
  massScale.value = String(Math.max(Number(massScale.min), Number(massScale.value) - 0.1));
  applyMassScale();
});
document.querySelector('#mass-increase').addEventListener('click', () => {
  massScale.value = String(Math.min(Number(massScale.max), Number(massScale.value) + 0.1));
  applyMassScale();
});
massLessonTarget?.addEventListener('click', () => {
  if (selectedId !== 'moon') return;
  massScale.value = String(Math.log10(2));
  applyMassScale();
  massScale.focus({ preventScroll: true });
});

tiltControl.addEventListener('input', () => {
  if (!selectedId) return;
  if (!tiltHistoryState) tiltHistoryState = { snapshot: captureEditorState(`change ${system.body(selectedId)?.name || 'body'} spin-axis tilt`), pushed: false };
  if (!tiltHistoryState.pushed) {
    pushUndoState(tiltHistoryState.snapshot);
    tiltHistoryState.pushed = true;
  }
  const degrees = Number(tiltControl.value);
  system.editBody(selectedId, { axialTiltRad: degrees * Math.PI / 180 });
  document.querySelector('#tilt-output').textContent = `${degrees.toFixed(1)}°`;
  updateReadouts();
});

for (const control of [massScale, tiltControl]) {
  control.addEventListener('pointerdown', () => {
    if (control === massScale) massHistoryState = { snapshot: captureEditorState(`change ${system.body(selectedId)?.name || 'body'} mass`), pushed: false };
    else tiltHistoryState = { snapshot: captureEditorState(`change ${system.body(selectedId)?.name || 'body'} spin-axis tilt`), pushed: false };
  });
  control.addEventListener('change', () => {
    if (control === massScale) massHistoryState = null;
    else tiltHistoryState = null;
  });
}

impulseMagnitude.addEventListener('input', () => {
  if (!impulseOutput) return;
  impulseOutput.textContent = `${Number(impulseMagnitude.value).toFixed(1)} m/s`;
});
document.querySelector('#impulse-decrease').addEventListener('click', () => {
  impulseMagnitude.value = String(Math.max(Number(impulseMagnitude.min), Number(impulseMagnitude.value) - 1));
  if (!impulseOutput) return;
  impulseOutput.textContent = `${Number(impulseMagnitude.value).toFixed(1)} m/s`;
});
document.querySelector('#impulse-increase').addEventListener('click', () => {
  impulseMagnitude.value = String(Math.min(Number(impulseMagnitude.max), Number(impulseMagnitude.value) + 1));
  if (!impulseOutput) return;
  impulseOutput.textContent = `${Number(impulseMagnitude.value).toFixed(1)} m/s`;
});
document.querySelector('#impulse-clear-velocity').addEventListener('click', clearSelectedVelocity);
for (const button of document.querySelectorAll('[data-impulse-axis]')) {
  button.addEventListener('click', () => {
    if (!selectedId) return;
    const axisMap = { x: 0, y: 1, z: 2 };
    const axis = axisMap[button.dataset.impulseAxis];
    const sign = Number(button.dataset.impulseSign);
    if (axis === undefined || !Number.isFinite(sign)) return;
    applyImpulse(axis, sign);
  });
}


function animate(time) {
  requestAnimationFrame(animate);
  const deltaSeconds = lastFrameTime === null ? 0 : Math.min((time - lastFrameTime) / 1000, .1);
  lastFrameTime = time;
  if (cameraMode === 'ecliptic') cameraOrbit.yaw = (cameraOrbit.yaw + deltaSeconds * .055) % (Math.PI * 2);
  if (running && activeExperiment === 'relativity' && relativityRocketBodyId) {
    relativityPhase = (relativityPhase + deltaSeconds * .18) % 1;
  }
  if (running) {
    lightPulsePhase = (lightPulsePhase + deltaSeconds * .24) % 1;
  }
  if (running || pendingStepSeconds > 0) {
    const plan = planPlaybackFrame({ elapsedSeconds: deltaSeconds, rateSecondsPerSecond: daysPerSecond * DAY_S,
      stepSeconds: system.stepSeconds, remainder: stepAccumulator, maxSteps: MAX_STEPS_PER_ANIMATION_TICK });
    const steps = pendingStepSeconds > 0
      ? Math.min(MAX_STEPS_PER_ANIMATION_TICK, Math.ceil(pendingStepSeconds / system.stepSeconds)) : plan.steps;
    playbackLimited = plan.limited;
    stepAccumulator = running ? plan.remainder : 0;
    if (steps > 0) {
      // Sample during the batch: high time warp should still draw curved trails.
      for (let remaining = steps; remaining > 0;) {
        const batch = Math.min(8, remaining);
        system.step(batch);
        recordTrails();
        remaining -= batch;
      }
      pendingStepSeconds = Math.max(0, pendingStepSeconds - steps * system.stepSeconds);
      queueCollisionEffects(time);
      updateScientistMotionObservation();
    }
  }
  updateTrajectoryPreview();
  const targetView = viewDefinition();
  const transition = deltaSeconds === 0 ? 1 : 1 - Math.exp(-deltaSeconds * 4.2);
  if (scaleMode === 'body') {
    for (let axis = 0; axis < 3; axis += 1) renderedView.center[axis] = targetView.center[axis] || 0;
  } else {
    for (let axis = 0; axis < 3; axis += 1) {
      renderedView.center[axis] += ((targetView.center[axis] || 0) - renderedView.center[axis]) * transition;
    }
  }
  renderedView.widthM *= Math.exp(Math.log(targetView.widthM / renderedView.widthM) * transition);
  solarRenderer.update({
    bodies: system.bodies,
    centerM: [...renderedView.center],
    widthM: renderedView.widthM,
    scaleMode,
    visualRadiusMode,
    selectedId,
    activeExperiment,
    guided: Boolean(scientistTutorial?.state?.lessonId),
    seasonPhaseRad: currentSeasonPhaseRad(),
    elapsedSeconds: system.timeSeconds,
    cameraState: cameraOrbit,
    collisionEffects,
    nowMs: time
  });
  clearOverlay();
  drawExperimentOverlay();
  drawCollisionEffects(time);
  for (const body of system.bodies) drawTrail(body);
  drawTrajectoryPreview();
  drawBarycenter();
  labelBounds = [];
  const labelOrder = [...system.bodies].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  for (const body of labelOrder) drawBody(body);
  drawOrientationGizmo();
  updateReadouts();
}

addEventListener('resize', resize);
addEventListener('beforeunload', saveActiveSystemDocument);
initializeSystemWorkspace();
const interactionFeedback = createInteractionFeedback({
  isQuiet: () => document.hidden || voiceStarting || Boolean(voicePeer) || voiceClosing,
  onCue: (receipt) => {
    const settings = document.querySelector('#feedback-settings');
    settings.dataset.lastCue = receipt.kind;
    settings.dataset.audioScheduled = String(receipt.audioScheduled);
    settings.dataset.vibrationRequested = String(receipt.vibrationRequested);
  }
});
mountFeedbackSettings({ feedback: interactionFeedback });
document.addEventListener('visibilitychange', () => { if (document.hidden) interactionFeedback.stop(); });
scientistTutorial = mountScientistLesson({
  onPrepare: createGuidedLessonWorkspace,
  onAction: handleScientistLessonAction,
  onVariableChange: applyScientistWorkbenchChange,
  getSnapshot: scienceObservationSnapshot,
  onMessage: showToast,
  interactionFeedback
});
physicsCourse = mountPhysicsCourse({
  interactionFeedback,
  onRunLesson: (lessonId) => scientistTutorial?.start(lessonId),
  onAskVoice: () => {
    scientistTutorial?.close();
    openGuide();
    guideQuestion.value = '';
    guideQuestion.placeholder = 'What part feels confusing?';
    guideQuestion.focus({ preventScroll: true });
    voiceStatus.textContent = 'Microphone off';
  },
  onMessage: () => {}
});
if (new URLSearchParams(location.search).get('course') === 'orbital-intuition') {
  scientistTutorial?.open();
}
const lessonViewportObserver = new MutationObserver(resize);
lessonViewportObserver.observe(document.querySelector('#scientist-lesson'), { attributes: true, attributeFilter: ['class', 'data-lesson-id'] });
lessonViewportObserver.observe(laboratory, { attributes: true, attributeFilter: ['class'] });
resize();
installTrailControls();
mountLabShell();
installRelativityTeachingPanel();
updateReadouts();
requestAnimationFrame(animate);

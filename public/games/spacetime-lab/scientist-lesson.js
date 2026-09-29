import { renderLessonRelationship } from './lesson-relationships.js';

export const SCIENTIST_LESSON_STORAGE_KEY = 'light-years-from-home.directed-lesson.v2';
export const SCIENCE_NOTEBOOK_STORAGE_KEY = 'light-years-from-home.science-notebook.v2';
export const SCIENTIST_COMPLETIONS_STORAGE_KEY = 'light-years-from-home.lesson-completions.v1';

export const SCIENTIST_LESSONS = Object.freeze({
  'stable-orbit': Object.freeze({
    id: 'stable-orbit',
    title: 'Build an orbit',
    duration: '3 MIN',
    outcome: 'Sideways motion carries the world forward. Gravity keeps bending its path toward the star.',
    setup: 'blank-canvas',
    variableGuide: Object.freeze({
      object: 'Earth around a Sun-like star',
      variable: 'Sideways launch speed',
      observation: 'Shape of the orbit',
      equation: 'v = √(GM / r)',
      equationNote: 'At the same distance, sideways speed decides whether the world falls inward, loops around, or stretches outward.',
      instruction: 'Place the star and world first. Then reshape the orbit with one control.',
      control: Object.freeze({ key: 'orbit-speed', min: .65, max: 1.35, step: .01, value: 1, low: 'Falls inward', high: 'Stretches outward', unlockStep: 2 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'place-star', event: 'sun-placed', title: 'Start with a star', copy: 'The star supplies the pull. Add it at the center of your experiment.', action: 'place-sun', actionLabel: 'Add the star', target: '#scientist-action' }),
      Object.freeze({ id: 'place-earth', event: 'earth-placed', title: 'Give it a world', copy: 'Add an Earth-like world one Earth–Sun distance away, already moving sideways.', action: 'place-earth', actionLabel: 'Add the world', target: '#scientist-action' }),
      Object.freeze({ id: 'inspect-orbit', event: 'orbit-inspected', title: 'What if it moved faster?', copy: 'Try a slower or faster launch. Watch how the orbit changes before you let time run.', action: 'inspect-orbit', actionLabel: 'Try this orbit', target: '#scientist-action' }),
      Object.freeze({ id: 'run', event: 'simulation-ran', title: 'Let it move', copy: 'One second here is one day in the experiment.', action: 'run-system', actionLabel: 'Start the orbit', target: '#scientist-action' }),
      Object.freeze({ id: 'observe', event: 'motion-observed', title: 'Watch the path bend', copy: 'The world moves forward while the star pulls it inward. Watch three days pass.', action: null, actionLabel: '', target: '#scientist-waiting', minimumDays: 3 }),
      Object.freeze({ id: 'gravity', event: 'gravity-inspected', title: 'What keeps it turning?', copy: 'The gravity arrow points toward the star. That inward pull changes the world’s direction.', action: 'show-gravity', actionLabel: 'Show the pull', target: '#scientist-action' })
    ])
  }),
  barycenter: Object.freeze({
    id: 'barycenter',
    title: 'Make the Moon heavier',
    duration: '2 MIN',
    outcome: 'Both Earth and Moon move around a shared balance point. A heavier Moon shifts that point farther from Earth.',
    setup: 'sun-earth-moon',
    variableGuide: Object.freeze({
      object: 'Moon',
      variable: 'Gravitational mass',
      observation: 'Earth-Moon balance point',
      equation: 'rᵦ = d × mMoon / (mEarth + mMoon)',
      equationNote: 'A heavier Moon pulls the shared balance point farther from Earth while the Moon’s visible size stays fixed.',
      instruction: 'Start at 1.00×, then move the Moon to exactly 2.00×.',
      control: Object.freeze({ key: 'moon-mass', min: .5, max: 3, step: .05, value: 1, low: '0.50× Moon', high: '3.00× Moon', unlockStep: 1 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'baseline', event: 'baseline-inspected', title: 'Where do they balance?', copy: 'Earth and the Moon both move. Their shared balance point starts inside Earth.', action: 'frame-moon', actionLabel: 'Show the balance point', target: '#scientist-action' }),
      Object.freeze({ id: 'change-mass', event: 'moon-mass-changed', title: 'Change the Moon’s mass', copy: 'Move the mass control below from 1.00× to 2.00×. The Moon’s physical size stays fixed.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the mass slider to 2.00×.' }),
      Object.freeze({ id: 'run', event: 'simulation-ran', title: 'Let the heavier Moon move', copy: 'The balance point has shifted. Now watch how the pair moves around it.', action: 'run-system', actionLabel: 'Start the orbit', target: '#scientist-action' }),
      Object.freeze({ id: 'observe', event: 'motion-observed', title: 'Watch them respond', copy: 'Keep an eye on the balance point as two days pass.', action: null, actionLabel: '', target: '#scientist-waiting', minimumDays: 2 }),
      Object.freeze({ id: 'gravity', event: 'gravity-inspected', title: 'Follow the pull', copy: 'Earth pulls on the Moon, and the Moon pulls back. Reveal the gravity arrows.', action: 'show-gravity', actionLabel: 'Show the pull', target: '#scientist-action' })
    ])
  }),
  'world-collision': Object.freeze({
    id: 'world-collision',
    title: 'Crash two worlds',
    duration: '1 MIN',
    outcome: 'Faster worlds carry much more collision energy. Doubling their relative speed multiplies that energy by four.',
    setup: 'world-collision',
    variableGuide: Object.freeze({
      object: 'Two approaching worlds',
      variable: 'Approach speed',
      observation: 'Relative kinetic energy',
      equation: 'Eimpact = ½ μv²',
      equationNote: 'Impact energy grows with speed squared: a small speed increase creates a much larger collision.',
      instruction: 'Choose the approach speed before you release the worlds.',
      control: Object.freeze({ key: 'collision-speed', min: .5, max: 1.5, step: .05, value: 1, low: 'Gentler', high: 'Harder', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'collision-ready', event: 'collision-ready', title: 'How hard will they collide?', copy: 'Two worlds are approaching. Change their speed and compare the energy they carry.', action: 'frame-collision', actionLabel: 'Show both worlds', target: '#scientist-action' }),
      Object.freeze({ id: 'run-collision', event: 'simulation-ran', title: 'Release the worlds', copy: 'Gravity speeds them up as they approach. Watch their final impact.', action: 'run-collision', actionLabel: 'Let them collide', target: '#scientist-action' }),
      Object.freeze({ id: 'observe-collision', event: 'collision-observed', title: 'Here they come', copy: 'Watch the gap close until the worlds touch.', action: null, actionLabel: '', target: '#scientist-waiting', waitLabel: 'Watching for contact…' }),
      Object.freeze({ id: 'review-collision', event: 'collision-evidence-inspected', title: 'What changed at impact?', copy: 'This model merges the worlds and preserves their combined mass and momentum. The debris is an illustration.', action: 'show-collision-evidence', actionLabel: 'See the impact result', target: '#scientist-action' })
    ])
  }),
  'solar-simultaneity': Object.freeze({
    id: 'solar-simultaneity',
    title: 'What does “at the same time” mean?',
    duration: '2 MIN',
    outcome: 'Flashes that happen together in the Sun’s frame need not happen together in a moving rocket’s frame.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'Rocket between Earth and Mars',
      variable: 'Rocket speed',
      observation: 'Difference in event time',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'Changing the observer’s speed changes which distant flash is earlier in that observer’s frame.',
      instruction: 'Move the rocket speed and watch the time difference respond.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Can “at the same time” change?', copy: 'Two flashes happen together, one near Earth and one near Mars. A moving observer can assign them different times.', action: 'open-relativity', actionLabel: 'Set up the flashes', target: '#scientist-action' }),
      Object.freeze({ id: 'place-earth-event', event: 'relativity-event-placed', title: 'The first flash', copy: 'Keep flash A near Earth as the starting point.', action: 'place-relativity-a', actionLabel: 'Set flash A', target: '#scientist-action', eventId: 'a' }),
      Object.freeze({ id: 'place-mars-event', event: 'relativity-event-placed', title: 'The second flash', copy: 'Set flash B near Mars. Both flashes happen at time zero in the Sun’s frame.', action: 'place-relativity-b', actionLabel: 'Set flash B', target: '#scientist-action', eventId: 'b' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Take a moving viewpoint', copy: 'Send an observer from A toward B. Compare the times assigned to those same flashes.', action: 'launch-relativity-rocket', actionLabel: 'Launch the observer', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Try a different velocity', copy: 'Move the rocket-speed slider below. The event-time difference responds immediately.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the slider to continue.' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Same flashes, different times', copy: 'The flashes did not move. Changing the observer’s speed changed their assigned times.', action: 'review-relativity-equation', actionLabel: 'Finish the experiment', target: '#scientist-action' })
    ])
  }),
  'dual-explosion-simultaneity': Object.freeze({
    id: 'dual-explosion-simultaneity',
    title: 'Which flash came first?',
    duration: '3 MIN',
    outcome: 'The same two flashes can have different assigned times for observers moving at different speeds.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'Two distant flashes',
      variable: 'Observer speed',
      observation: 'Which flash is earlier',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'The flashes stay fixed. Only the moving observer changes, so the ordering shift has one clear cause.',
      instruction: 'Vary the probe speed and compare the two event times.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Open the thought lab', copy: 'Open the dual-explosion lab. It loads Sun-Earth-Mars with two default explosions at t = 0.', action: 'open-relativity', actionLabel: 'Open simultaneity lab', target: '#scientist-action' }),
      Object.freeze({ id: 'place-explosion-a', event: 'relativity-event-placed', title: 'Set Explosion A', copy: 'Mark Explosion A on the grid or keep the default Earth-anchored placement.', action: 'place-relativity-a', actionLabel: 'Set Explosion A', target: '#scientist-action', eventId: 'a' }),
      Object.freeze({ id: 'place-explosion-b', event: 'relativity-event-placed', title: 'Set Explosion B', copy: 'Mark Explosion B on the grid or keep the default Mars-anchored placement.', action: 'place-relativity-b', actionLabel: 'Set Explosion B', target: '#scientist-action', eventId: 'b' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Launch observer probe', copy: 'Launch the observer and hold both explosions in view for frame-dependent ordering comparison.', action: 'launch-relativity-rocket', actionLabel: 'Launch probe', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Adjust probe speed', copy: 'Move the speed slider below and compare the order change in the rocket frame.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the slider to continue.' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Review simultaneity equation', copy: 'Review the Lorentz timing shift and lock the lesson state.', action: 'review-relativity-equation', actionLabel: 'Review Lorentz equation', target: '#scientist-action' })
    ])
  }),
  'everyday-physics': Object.freeze({
    id: 'everyday-physics',
    title: 'One push in space',
    duration: '3 MIN',
    outcome: 'A push changes velocity. Motion continues after the push ends, and motion along the line of sight changes the frequency a detector receives.',
    setup: 'blank-canvas',
    variableGuide: Object.freeze({
      object: 'Everyday object',
      variable: 'Next velocity change',
      observation: 'Object speed after the push',
      equation: 'vafter = vbefore + Δv',
      equationNote: 'The slider chooses the size of one push. The lesson button applies that change in the +Y direction.',
      instruction: 'Choose a push, then apply it once and watch the path bend.',
      control: Object.freeze({ key: 'impulse', min: 1, max: 500, step: 1, value: 10, low: '1 m/s', high: '500 m/s', unlockStep: 2 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'place-star', event: 'sun-placed', title: 'Set the scene', copy: 'Add a star to give this experiment a source of gravity.', action: 'place-sun', actionLabel: 'Add the star', target: '#scientist-action' }),
      Object.freeze({ id: 'place-vehicle', event: 'vehicle-placed', title: 'Add something small', copy: 'An everyday object obeys the same gravity as a planet. Place one near the star, initially at rest.', action: 'place-vehicle', actionLabel: 'Add the object', target: '#scientist-action' }),
      Object.freeze({ id: 'thrust-vehicle', event: 'thrust-applied', title: 'Give it an impulse', copy: 'Choose the size of the push below, then apply it once. The object keeps that new velocity.', action: 'boost-vehicle', actionLabel: 'Apply this +Y push', target: '#scientist-action' }),
      Object.freeze({ id: 'run', event: 'simulation-ran', title: 'What happens after the push?', copy: 'The push has ended. The object keeps moving while gravity bends its path.', action: 'run-system', actionLabel: 'Let it move', target: '#scientist-action' }),
      Object.freeze({ id: 'observe', event: 'motion-observed', title: 'It keeps going', copy: 'Watch one day pass. A force changes motion; it is not needed to keep motion going.', action: null, actionLabel: '', target: '#scientist-waiting', minimumDays: 1 }),
      Object.freeze({ id: 'open-light', event: 'light-lab-opened', title: 'Send a light signal', copy: 'A stationary detector compares the light it receives with the light the moving object sends.', action: 'open-thought-light', actionLabel: 'Set up the detector', target: '#scientist-action' }),
      Object.freeze({ id: 'emit-light', event: 'light-signaled', title: 'Does the frequency change?', copy: 'Send one pulse. Motion along the line of sight changes the frequency reaching the detector.', action: 'emit-thought-light', actionLabel: 'Send the pulse', target: '#scientist-action' })
  ])
  }),
  'dark-matter-comparison': Object.freeze({
    id: 'dark-matter-comparison',
    title: 'An extra pull',
    duration: '2 MIN',
    outcome: 'The added field is tiny at the local estimate. Exaggerating it makes the effect visible, but does not make that larger field realistic.',
    setup: 'blank-canvas',
    variableGuide: Object.freeze({
      object: 'Same world, same starting path',
      variable: 'Extra gravity model',
      observation: 'Change in acceleration',
      equation: 'aon = aNewton + aextra',
      equationNote: 'The world and path stay the same while the additional field changes from none to a small or exaggerated value.',
      instruction: 'Open the comparison, then move through Off, Local, and Exaggerated.',
      control: Object.freeze({ key: 'dark-matter-mode', min: 0, max: 2, step: 1, value: 0, low: 'Off', high: 'Exaggerated', unlockStep: 3 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'place-star', event: 'sun-placed', title: 'Start with familiar gravity', copy: 'Add a star. Its pull gives us a starting point for comparison.', action: 'place-sun', actionLabel: 'Add the star', target: '#scientist-action' }),
      Object.freeze({ id: 'place-earth', event: 'earth-placed', title: 'Add a world to compare', copy: 'We will keep this world in the same place while changing the extra gravity.', action: 'place-earth', actionLabel: 'Add the world', target: '#scientist-action' }),
      Object.freeze({ id: 'open', event: 'dark-matter-opened', title: 'Could there be another pull?', copy: 'Start with ordinary gravity. Then compare a small added field with a much larger one.', action: 'open-dark-matter', actionLabel: 'Start the comparison', target: '#scientist-action' }),
      Object.freeze({ id: 'set-local', event: 'dark-matter-mode-set', title: 'Try the local estimate', copy: 'Move the model control to Local. The difference is intentionally small.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the model slider to Local.' }),
      Object.freeze({ id: 'set-exaggerated', event: 'dark-matter-mode-set', title: 'Make the contrast visible', copy: 'Move the same control to Exaggerated and compare it with the local estimate.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the model slider to Exaggerated.' }),
      Object.freeze({ id: 'review', event: 'dark-matter-comparison-reviewed', title: 'Small can be the right result', copy: 'The local estimate is tiny at this scale. Exaggeration helps us see the pattern, but is not a realistic prediction.', action: 'review-dark-matter-comparison', actionLabel: 'Finish the comparison', target: '#scientist-action' })
    ])
  }),
  'rocket-light-thought': Object.freeze({
    id: 'rocket-light-thought',
    title: 'Chase a light signal',
    duration: '3 MIN',
    outcome: 'Event timing and received light frequency are different measurements. The first depends on the observer’s frame; the second also depends on the source and detector’s motion.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'Rocket, two flashes, one light signal',
      variable: 'Rocket speed',
      observation: 'Frame-time offset',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'The same speed that changes the rocket’s time ordering also changes the moving source-observer setup.',
      instruction: 'Change the speed once, then compare timing and light frequency.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Open simultaneity lab', copy: 'Open the thought experiment with Sun-Earth-Mars anchors at t = 0.', action: 'open-relativity', actionLabel: 'Open relativity lab', target: '#scientist-action' }),
      Object.freeze({ id: 'place-event-a', event: 'relativity-event-placed', title: 'Place Event A', copy: 'Anchor Event A on the grid or keep the default.', action: 'place-relativity-a', actionLabel: 'Set Event A', target: '#scientist-action', eventId: 'a' }),
      Object.freeze({ id: 'place-event-b', event: 'relativity-event-placed', title: 'Place Event B', copy: 'Anchor Event B to create a separable baseline.', action: 'place-relativity-b', actionLabel: 'Set Event B', target: '#scientist-action', eventId: 'b' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Launch probe playback', copy: 'Launch the relativity playback and watch frame ordering in the live panel.', action: 'launch-relativity-rocket', actionLabel: 'Launch rocket', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Change probe speed', copy: 'Move the speed control below and watch the frame-time difference change.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the slider to continue.' }),
      Object.freeze({ id: 'open-thought-light', event: 'light-lab-opened', title: 'Open light path', copy: 'Open Light path for the active star and compare source-observer frequency.', action: 'open-thought-light', actionLabel: 'Open light experiment', target: '#scientist-action' }),
      Object.freeze({ id: 'emit-light', event: 'light-signaled', title: 'Emit a probe signal', copy: 'Emit one light signal and read the Doppler / gravity estimate from the active pair.', action: 'emit-thought-light', actionLabel: 'Emit light signal', target: '#scientist-action' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Review the equation', copy: 'Review the simultaneity equation with the active measured numbers.', action: 'review-relativity-equation', actionLabel: 'Review equation', target: '#scientist-action' })
    ])
  }),
  'frame-lens-comparison': Object.freeze({
    id: 'frame-lens-comparison',
    title: 'One signal, two viewpoints',
    duration: '3 MIN',
    outcome: 'Changing the coordinate origin changes the view, not the physical signal. Source and detector motion still determine the frequency shift.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'One signal seen from two frames',
      variable: 'Observer speed',
      observation: 'Event timing shift',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'Keep both events fixed while the observer speed changes the measured time separation.',
      instruction: 'Use the same speed control as you switch frames.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Open relativity lab', copy: 'Open the thought lab with Sun-Earth-Mars anchors and active event pair.', action: 'open-relativity', actionLabel: 'Open relativity lab', target: '#scientist-action' }),
      Object.freeze({ id: 'set-heliocentric', event: 'frame-reference-set', title: 'Set heliocentric', copy: 'Hold the Sun as your origin and check the frame label in the status readout.', action: 'set-reference-frame-heliocentric', actionLabel: 'Set heliocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'set-galactocentric', event: 'frame-reference-set', title: 'Set galactocentric', copy: 'Switch to a fixed galactic-style frame and keep the same event setup.', action: 'set-reference-frame-galactocentric', actionLabel: 'Set galactocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Launch observer', copy: 'Launch the observer and keep both frames visible.', action: 'launch-relativity-rocket', actionLabel: 'Launch observer', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Vary observer speed', copy: 'Move the speed control below and watch the timing offset update.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the speed slider to continue.' }),
      Object.freeze({ id: 'open-thought-light', event: 'light-lab-opened', title: 'Open light path', copy: 'Open light on the active lens to compare the frequency in the current frame.', action: 'open-thought-light', actionLabel: 'Open light experiment', target: '#scientist-action' }),
      Object.freeze({ id: 'emit-light', event: 'light-signaled', title: 'Emit comparison pulse', copy: 'Emit one pulse and capture observed frequency and source frequency.', action: 'emit-thought-light', actionLabel: 'Emit light signal', target: '#scientist-action' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Review the frame equation', copy: 'Review the Lorentz output and close the thought experiment.', action: 'review-relativity-equation', actionLabel: 'Review Lorentz equation', target: '#scientist-action' })
    ])
  }),
  'galactocentric-vehicle-lens': Object.freeze({
    id: 'galactocentric-vehicle-lens',
    title: 'Motion, gravity and light',
    duration: '4 MIN',
    outcome: 'A push changes an object’s motion. A change of viewpoint describes that motion differently without applying another push.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'Vehicle and moving observer',
      variable: 'Observer speed',
      observation: 'Probe-frame time offset',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'The vehicle remains part of the gravity scene; this control changes only the observer used for the timing comparison.',
      instruction: 'Vary the observer speed and keep the vehicle’s motion separate.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Open thought experiment', copy: 'Open relativity with a Sun-Earth-Mars setup and default event anchors.', action: 'open-relativity', actionLabel: 'Open relativity workspace', target: '#scientist-action' }),
      Object.freeze({ id: 'place-earth-event', event: 'relativity-event-placed', title: 'Set Event A', copy: 'Anchor Event A (default Earth position is acceptable).', action: 'place-relativity-a', actionLabel: 'Set Event A', target: '#scientist-action', eventId: 'a' }),
      Object.freeze({ id: 'place-mars-event', event: 'relativity-event-placed', title: 'Set Event B', copy: 'Anchor Event B (default Mars is acceptable).', action: 'place-relativity-b', actionLabel: 'Set Event B', target: '#scientist-action', eventId: 'b' }),
      Object.freeze({ id: 'place-vehicle', event: 'vehicle-placed', title: 'Add a small object', copy: 'Place an object in the same scene. Next, give it a single push.', action: 'place-vehicle', actionLabel: 'Add the object', target: '#scientist-action' }),
      Object.freeze({ id: 'thrust-vehicle', event: 'thrust-applied', title: 'Impulse the vehicle', copy: 'Give the vehicle one push so it departs with a visible motion of its own.', action: 'boost-vehicle', actionLabel: 'Apply vehicle push', target: '#scientist-action' }),
      Object.freeze({ id: 'set-heliocentric', event: 'frame-reference-set', title: 'Set heliocentric frame', copy: 'Evaluate simultaneity and timing in the Sun-centered frame.', action: 'set-reference-frame-heliocentric', actionLabel: 'Set heliocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'set-galactocentric', event: 'frame-reference-set', title: 'Set galactocentric frame', copy: 'Switch to fixed galactic-style frame and keep the same event pair and vehicle.', action: 'set-reference-frame-galactocentric', actionLabel: 'Set galactocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Launch observer', copy: 'Launch the probe from Event A toward Event B and keep both frames in the live readout.', action: 'launch-relativity-rocket', actionLabel: 'Launch observer', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Vary probe speed', copy: 'Move the speed slider below so the frame-order offset changes visibly.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the speed slider to continue.' }),
      Object.freeze({ id: 'open-light', event: 'light-lab-opened', title: 'Open light lab', copy: 'Open the light experiment and select the same active lens/source context.', action: 'open-thought-light', actionLabel: 'Open light path', target: '#scientist-action' }),
      Object.freeze({ id: 'emit-light', event: 'light-signaled', title: 'Emit signal', copy: 'Emit a pulse and capture source/observer frequencies.', action: 'emit-thought-light', actionLabel: 'Emit light signal', target: '#scientist-action' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Review the simultaneity equation', copy: 'Review the Lorentz timing and frequency result before finishing the experiment.', action: 'review-relativity-equation', actionLabel: 'Review equation', target: '#scientist-action' })
    ])
  }),
  'reference-frame-comparison': Object.freeze({
    id: 'reference-frame-comparison',
    title: 'Change your viewpoint',
    duration: '3 MIN',
    outcome: 'Moving the coordinate origin is not the same as changing observer velocity. The velocity changes distant simultaneity; the origin alone does not.',
    setup: 'jpl-system',
    variableGuide: Object.freeze({
      object: 'Same flashes, different reference',
      variable: 'Observer speed',
      observation: 'Ordering in the moving frame',
      equation: 'Δt′ = γ(Δt − vΔx / c²)',
      equationNote: 'The flashes do not move. Changing the observer speed reveals why distant simultaneity depends on the frame.',
      instruction: 'Switch the reference, then vary the observer speed.',
      control: Object.freeze({ key: 'relativity-speed', min: .01, max: .5, step: .01, value: .1, low: '0.01c', high: '0.50c', unlockStep: 0 })
    }),
    steps: Object.freeze([
      Object.freeze({ id: 'open-relativity', event: 'relativity-opened', title: 'Open simultaneity scenario', copy: 'Open the thought lab with Sun-Earth-Mars flashes anchored at t = 0.', action: 'open-relativity', actionLabel: 'Open Solar simultaneity', target: '#scientist-action' }),
      Object.freeze({ id: 'set-heliocentric', event: 'frame-reference-set', title: 'Set heliocentric reference', copy: 'Hold the Sun as the origin and note how the simultaneity line is evaluated in that frame.', action: 'set-reference-frame-heliocentric', actionLabel: 'Set heliocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'set-galactocentric', event: 'frame-reference-set', title: 'Set galactocentric reference', copy: 'Switch to a fixed galactic-style inertial origin and keep the same events unchanged.', action: 'set-reference-frame-galactocentric', actionLabel: 'Set galactocentric', target: '#scientist-action' }),
      Object.freeze({ id: 'launch-rocket', event: 'relativity-rocket-launched', title: 'Launch observer', copy: 'Launch the rocket and let it carry the same event pair through both references.', action: 'launch-relativity-rocket', actionLabel: 'Launch rocket', target: '#scientist-action' }),
      Object.freeze({ id: 'set-speed', event: 'relativity-speed-changed', title: 'Try a second speed', copy: 'Move the speed slider below and compare the order in the Sun and rocket frames.', action: null, actionLabel: '', target: '#scientist-variable-slider', waitLabel: 'Move the slider to continue.' }),
      Object.freeze({ id: 'review-equation', event: 'relativity-equation-reviewed', title: 'Review frame equation', copy: 'Review the simultaneity transform and record the current frame notes before finishing.', action: 'review-relativity-equation', actionLabel: 'Review Lorentz equation', target: '#scientist-action' })
    ])
  })
});

export function lessonVariableUnlockStep(lesson) {
  const control = lesson?.variableGuide?.control;
  if (!control) return Infinity;
  if (control.key === 'relativity-speed') {
    const index = lesson.steps.findIndex((step) => step.id === 'set-speed');
    return index < 0 ? Infinity : index;
  }
  return control.unlockStep;
}

export function createScientistLessonState(lessonId = 'stable-orbit') {
  if (!SCIENTIST_LESSONS[lessonId]) throw new RangeError(`Unknown directed lesson: ${lessonId}`);
  return { version: 2, lessonId, index: 0, complete: false, events: [] };
}

function eventMatchesStep(step, event, detail) {
  if (event !== step.event) return false;
  if (step.id === 'place-star') return detail.presetId === 'sun-like';
  if (step.id === 'place-earth') return detail.presetId === 'earth-analogue';
  if (step.id === 'change-mass') return detail.bodyType === 'moon' && Math.abs(Number(detail.multiplier) - 2) <= .005;
  if (step.id === 'observe') return Number(detail.elapsedDays) >= step.minimumDays;
  if (step.id === 'collision-ready') return Number(detail.bodyCount) === 2 && detail.scenarioMode === 'world-collision';
  if (step.id === 'observe-collision') {
    return Number(detail.relativeSpeedMps) > 0
      && Number(detail.totalMassKg) > 0
      && Number(detail.preImpactCount) === 2
      && detail.presentation === 'illustrative-debris-only';
  }
  if (step.id === 'set-speed') return Number(detail.beta) > 0 && Number(detail.rocketFrameDeltaSeconds) > 0 && detail.classification === 'spacelike-separated events';
  if (step.id === 'place-earth-event' || step.id === 'place-mars-event') return detail.eventId === step.eventId && Number(detail.placedEventCount) > 0;
  if (step.id === 'place-explosion-a' || step.id === 'place-explosion-b') return detail.eventId === step.eventId && Number(detail.placedEventCount) > 0;
  if (step.id === 'launch-rocket') return detail.ready === true && Number(detail.separationM) > 0;
  if (step.id === 'review-equation') return Number(detail.rocketFrameDeltaSeconds) > 0 && /Lorentz/.test(detail.model || '');
  if (step.id === 'place-vehicle') return ['vehicle-car', 'vehicle-satellite', 'vehicle-asteroid', 'vehicle-rocketcraft', 'space-station', 'satellite', 'car'].includes(detail.presetId) || Boolean(detail.earthScaleObject);
  if (step.id === 'thrust-vehicle') return Number(detail.deltaMps) > 0;
  if (step.id === 'open-light') return detail.experiment === 'light';
  if (step.id === 'emit-light') return Number(detail.observedFrequencyHz) > 0 && Number(detail.restFrequencyHz) > 0;
  if (step.id === 'open') return detail.experiment === 'dark-matter';
  if (step.id === 'set-local') return detail.mode === 'local-estimate';
  if (step.id === 'set-exaggerated') return detail.mode === 'uniform-exaggerated';
  if (step.id === 'review') return Number(detail.deltaMagnitudeMps2) > 0;
  if (step.id === 'set-heliocentric') return detail.mode === 'heliocentric';
  if (step.id === 'set-galactocentric') return detail.mode === 'galactocentric';
  return true;
}

export function advanceScientistLesson(state, event, detail = {}) {
  const lesson = SCIENTIST_LESSONS[state?.lessonId];
  const current = lesson?.steps[state?.index || 0];
  if (!lesson || !current || state.complete || !eventMatchesStep(current, event, detail)) return state;
  const events = [...state.events, { event, detail: { ...detail } }];
  const nextIndex = state.index + 1;
  return {
    version: 2,
    lessonId: state.lessonId,
    index: Math.min(nextIndex, lesson.steps.length - 1),
    complete: nextIndex >= lesson.steps.length,
    events
  };
}

export function buildLessonCompletion({ lessonId, snapshot, completedAt = new Date().toISOString() }) {
  const lesson = SCIENTIST_LESSONS[lessonId];
  if (!lesson) throw new RangeError(`Unknown directed lesson: ${lessonId}`);
  if (!snapshot || snapshot.fidelity !== 'computed') throw new TypeError('A computed laboratory snapshot is required');
  return {
    schemaVersion: 2,
    lessonId,
    lessonTitle: lesson.title,
    status: 'SUCCESS',
    completedAt,
    evidence: snapshot,
    privacy: 'Local browser record only. No free-form prompt, audio, transcript, credentials, SDP, or API payloads.'
  };
}

export function readScienceNotebook(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(SCIENCE_NOTEBOOK_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function readScientistCompletions(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(SCIENTIST_COMPLETIONS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLessonCompletion(record, storage = globalThis.localStorage) {
  const notebook = [record, ...readScienceNotebook(storage)].slice(0, 20);
  const completions = {
    ...readScientistCompletions(storage),
    [record.lessonId]: { status: record.status, completedAt: record.completedAt }
  };
  storage.setItem(SCIENCE_NOTEBOOK_STORAGE_KEY, JSON.stringify(notebook));
  storage.setItem(SCIENTIST_COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
}

const SHARED_ACTION_GUIDANCE = Object.freeze({
  'open-relativity': { title: 'Two flashes, one question', copy: 'The flashes happen together in the Sun’s frame. Will a moving observer assign them the same time?', label: 'Set up the flashes' },
  'place-relativity-a': { title: 'Set the first flash', copy: 'Place flash A near Earth. This fixes one end of the experiment.', label: 'Set flash A' },
  'place-relativity-b': { title: 'Set the second flash', copy: 'Place flash B near Mars, at the same original time as A.', label: 'Set flash B' },
  'launch-relativity-rocket': { title: 'Take a moving viewpoint', copy: 'Send an observer from A toward B and compare the times they assign to the flashes.', label: 'Launch the observer' },
  'set-reference-frame-heliocentric': { title: 'Start from the Sun', copy: 'Use the Sun as the origin for measuring positions.', label: 'Use the Sun’s viewpoint' },
  'set-reference-frame-galactocentric': { title: 'Change the reference point', copy: 'Use a fixed reference point. The same objects and flashes stay in place; only the coordinates change.', label: 'Switch the reference' },
  'open-thought-light': { title: 'Follow a light signal', copy: 'Compare the frequency sent by the source with the frequency reaching the detector.', label: 'Set up the light signal' },
  'emit-thought-light': { title: 'What reaches the detector?', copy: 'Send one pulse. Compare the received frequency with the original 456 THz.', label: 'Send the pulse' },
  'review-relativity-equation': { title: 'What changed?', copy: 'The flashes stayed fixed. The observer’s motion changed the time gap assigned to them.', label: 'Finish the experiment' }
});

export function mountScientistLesson({ root = document, storage = globalThis.localStorage, onPrepare, onAction, onVariableChange = () => {}, getSnapshot, onMessage = () => {}, interactionFeedback = { cue() {} } }) {
  const panel = root.querySelector('#scientist-lesson');
  const toggle = root.querySelector('#scientist-toggle');
  const close = root.querySelector('#scientist-close');
  const catalog = root.querySelector('#scientist-catalog');
  const course = root.querySelector('#physics-course');
  const library = root.querySelector('#scientist-library');
  const lessonView = root.querySelector('#scientist-active');
  const success = root.querySelector('#scientist-success');
  const action = root.querySelector('#scientist-action');
  const restart = root.querySelector('#scientist-reset');
  const back = root.querySelector('#scientist-back');
  const variableGuide = root.querySelector('#scientist-variable-guide');
  const variableSlider = root.querySelector('#scientist-variable-slider');
  const variableDecrease = root.querySelector('#scientist-variable-decrease');
  const variableIncrease = root.querySelector('#scientist-variable-increase');
  let state = null;
  let open = false;
  let active = false;
  let variableChanged = false;
  const errorNotice = root.querySelector('#scientist-error');
  function reportError(message) {
    if (errorNotice) { errorNotice.textContent = message; errorNotice.hidden = false; }
    onMessage(message);
  }

  function updateSliderFill() {
    if (!variableSlider) return;
    const min = Number(variableSlider.min);
    const max = Number(variableSlider.max);
    const value = Number(variableSlider.value);
    const progress = max > min ? (value - min) / (max - min) * 100 : 0;
    variableSlider.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, progress))}%`);
  }

  function changeVariable(nextValue) {
    const lesson = state ? SCIENTIST_LESSONS[state.lessonId] : null;
    const step = lesson && !state.complete ? lesson.steps[state.index] : null;
    const control = lesson?.variableGuide?.control;
    if (!active || !step || !control || variableSlider?.disabled) return;
    const value = Math.max(control.min, Math.min(control.max, Number(nextValue)));
    if (!Number.isFinite(value)) return;
    variableSlider.value = String(value);
    updateSliderFill();
    try {
      onVariableChange(control.key, value, { lessonId: lesson.id, stepId: step.id });
      variableChanged = true;
    } catch (error) {
      reportError(error.message || 'The value could not be changed. Try again.');
    }
  }

  function clearHighlight() {
    root.querySelectorAll('.scientist-focus').forEach((element) => element.classList.remove('scientist-focus'));
  }

  function renderRecord() {
    const notebook = readScienceNotebook(storage);
    const notebookPanel = root.querySelector('#scientist-notebook');
    notebookPanel.hidden = notebook.length === 0;
    root.querySelector('#scientist-record-count').textContent = `${notebook.length} EVIDENCE RECORD${notebook.length === 1 ? '' : 'S'}`;
    if (!notebook[0]) return;
    const latest = notebook[0];
  const orbit = latest.evidence?.orbit;
  const gravity = latest.evidence?.gravity;
  const collision = latest.evidence?.collision;
  const relativity = latest.evidence?.relativity;
  const darkMatter = latest.evidence?.darkMatter;
    root.querySelector('#scientist-latest-record').textContent = [
      `${latest.status} · ${latest.lessonTitle}`,
      latest.completedAt,
      orbit ? `ORBIT   ${orbit.type} · e ${orbit.eccentricity.toFixed(5)} · ${orbit.periodSeconds ? (orbit.periodSeconds / 86400).toFixed(1) + ' days' : 'unbound'}` : 'ORBIT   unavailable',
      gravity ? `GRAVITY ${gravity.totalMagnitudeMps2.toExponential(3)} m/s² · ${gravity.contributions.length} source${gravity.contributions.length === 1 ? '' : 's'}` : 'GRAVITY unavailable',
      relativity ? `RELATIVITY β ${relativity.beta.toFixed(2)} · Mars earlier ${relativity.rocketFrameDeltaSeconds.toFixed(1)} s` : 'RELATIVITY unavailable',
      darkMatter
        ? `DARK MATTER ${darkMatter.mode} · Δ ${Number.isFinite(darkMatter.deltaMagnitudeMps2) ? `${darkMatter.deltaMagnitudeMps2.toExponential(3)} m/s²` : '—'} · ratio ${Number.isFinite(darkMatter.deltaRatio) ? darkMatter.deltaRatio.toExponential(3) : 'n/a'}`
        : 'DARK MATTER unavailable',
      ...(collision ? [`IMPACT  ${(collision.relativeSpeedMps / 1000).toFixed(2)} km/s · ${collision.preImpact.length} → ${collision.bodyCountAfter} body · spherical merge`] : []),
      'LOCAL · COMPUTED SNAPSHOT · NO PROMPT OR AUDIO'
    ].join('\n');
  }

  function renderCatalogStatus() {
    const completions = readScientistCompletions(storage);
    root.querySelectorAll('[data-scientist-lesson]').forEach((button) => {
      const completion = completions[button.dataset.scientistLesson];
      button.classList.toggle('is-complete', completion?.status === 'SUCCESS');
      const status = button.querySelector('[data-lesson-status]');
      status.textContent = completion?.status === 'SUCCESS' ? '✓ COMPLETE' : 'START LESSON';
    });
  }

  function render() {
    const lesson = state ? SCIENTIST_LESSONS[state.lessonId] : null;
    const step = lesson && !state.complete ? lesson.steps[state.index] : null;
    panel.dataset.lessonId = lesson?.id || '';
    panel.dataset.stepId = step?.id || (state?.complete ? 'complete' : '');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    catalog.hidden = Boolean(state);
    if (course) course.hidden = Boolean(state);
    if (library) library.hidden = Boolean(state);
    lessonView.hidden = !state || state.complete;
    if (variableGuide) {
      const unlockStep = lessonVariableUnlockStep(lesson);
      variableGuide.hidden = !lesson?.variableGuide || Boolean(state?.complete) || state.index < unlockStep;
      if (lesson?.variableGuide) {
        const guide = lesson.variableGuide;
        const control = guide.control;
        root.querySelector('#scientist-variable-object').textContent = guide.object;
        root.querySelector('#scientist-variable-name').textContent = guide.variable;
        root.querySelector('#scientist-observation-name').textContent = guide.observation;
        renderLessonRelationship(root, control.key, guide.equation);
        root.querySelector('#scientist-equation-note').textContent = guide.equationNote;
        root.querySelector('#scientist-variable-low').textContent = control.low;
        root.querySelector('#scientist-variable-high').textContent = control.high;
        variableGuide.dataset.control = control.key;
        if (variableSlider) {
          const newLesson = variableSlider.dataset.lessonId !== lesson.id;
          variableSlider.min = String(control.min);
          variableSlider.max = String(control.max);
          variableSlider.step = String(control.step);
          if (newLesson) variableSlider.value = String(control.value);
          variableSlider.dataset.lessonId = lesson.id;
          variableSlider.disabled = state.index < unlockStep;
          variableSlider.setAttribute('aria-label', guide.variable);
          variableSlider.setAttribute('aria-description', `Changes ${guide.variable}. Watch ${guide.observation}.`);
          updateSliderFill();
        }
        if (variableDecrease) variableDecrease.disabled = variableSlider?.disabled ?? true;
        if (variableIncrease) variableIncrease.disabled = variableSlider?.disabled ?? true;
        root.querySelector('#scientist-variable-state').textContent = guide.instruction;
      }
    }
    success.hidden = !state?.complete;
    restart.hidden = !state?.complete;
    back.hidden = !state;
    if (!state) {
      root.querySelector('#scientist-step').textContent = 'ORBITAL INTUITION';
      root.querySelector('#scientist-title').textContent = 'Trust your curiosity';
      root.querySelector('#scientist-copy').textContent = 'Make a prediction. See what happens.';
    } else if (state.complete) {
      root.querySelector('#scientist-step').textContent = '✓ LESSON COMPLETE';
      root.querySelector('#scientist-title').textContent = lesson.title;
      root.querySelector('#scientist-copy').textContent = lesson.outcome;
      root.querySelector('#scientist-success-title').textContent = 'You tested the idea.';
    } else {
      const presentation = SHARED_ACTION_GUIDANCE[step.action];
      root.querySelector('#scientist-step').textContent = `Step ${state.index + 1} of ${lesson.steps.length}`;
      root.querySelector('#scientist-title').textContent = presentation?.title || step.title;
      root.querySelector('#scientist-copy').textContent = presentation?.copy || step.copy;
      root.querySelector('#scientist-progress-fill').style.width = `${state.index / lesson.steps.length * 100}%`;
      action.hidden = !step.action;
      action.textContent = presentation?.label || step.actionLabel;
      root.querySelector('#scientist-waiting').hidden = Boolean(step.action) || step.target === '#scientist-variable-slider';
      root.querySelector('#scientist-waiting span').textContent = step.waitLabel || 'Watch the path change…';
    }
    const collisionEvidence = root.querySelector('#scientist-collision-evidence');
    if (collisionEvidence && (!state || state.lessonId !== 'world-collision')) collisionEvidence.hidden = true;
    clearHighlight();
    if (open && active && step) {
      const target = root.querySelector(step.target);
      if (target && !target.hidden) target.classList.add('scientist-focus');
    }
    renderCatalogStatus();
    renderRecord();
  }

  function startLesson(lessonId) {
    const lesson = SCIENTIST_LESSONS[lessonId];
    if (!lesson) return;
    try {
      onPrepare(lessonId);
      if (errorNotice) errorNotice.hidden = true;
      state = createScientistLessonState(lessonId);
      if (variableSlider) variableSlider.dataset.lessonId = '';
      active = true;
      open = true;
      try { storage.setItem(SCIENTIST_LESSON_STORAGE_KEY, JSON.stringify({ lessonId, startedAt: new Date().toISOString() })); } catch { /* local-only fallback */ }
      render();
      panel.scrollTop = 0;
    } catch (error) {
      reportError(error.message || 'This experiment could not be opened. Try another lesson.');
    }
  }

  function record(event, detail = {}) {
    if (!active || !state) return false;
    const next = advanceScientistLesson(state, event, detail);
    if (next === state) return false;
    state = next;
    if (state.complete) {
      const completion = buildLessonCompletion({ lessonId: state.lessonId, snapshot: getSnapshot() });
      let saved = true;
      try { saveLessonCompletion(completion, storage); } catch { saved = false; }
      root.querySelector('#scientist-save-status').textContent = saved
        ? 'Progress saved on this device.' : 'Lesson complete. This browser could not save your progress.';
      active = false;
      try { storage.removeItem(SCIENTIST_LESSON_STORAGE_KEY); } catch { /* local-only fallback */ }
      onMessage(`${completion.lessonTitle} complete.`);
    }
    void interactionFeedback.cue(state.complete ? 'complete' : 'commit');
    render();
    panel.scrollTop = 0;
    return true;
  }

  toggle.addEventListener('click', () => { open = !open; render(); if (open) panel.scrollTop = 0; });
  close.addEventListener('click', () => { open = false; render(); toggle.focus({ preventScroll: true }); });
  root.querySelectorAll('[data-scientist-lesson]').forEach((button) => {
    button.addEventListener('click', () => startLesson(button.dataset.scientistLesson));
  });
  action.addEventListener('click', () => {
    const lesson = state ? SCIENTIST_LESSONS[state.lessonId] : null;
    const step = lesson && !state.complete ? lesson.steps[state.index] : null;
    if (!step?.action) return;
    if (errorNotice) errorNotice.hidden = true;
    try { onAction(step.action, { lessonId: state.lessonId, stepId: step.id }); } catch (error) { reportError(error.message); }
    render();
  });
  variableSlider?.addEventListener('input', (event) => changeVariable(event.target.value));
  variableSlider?.addEventListener('change', () => {
    if (variableChanged) { void interactionFeedback.cue('commit'); variableChanged = false; }
  });
  variableDecrease?.addEventListener('click', () => {
    if (!variableSlider) return;
    changeVariable(Number(variableSlider.value) - Number(variableSlider.step));
    if (variableChanged) { void interactionFeedback.cue('commit'); variableChanged = false; }
  });
  variableIncrease?.addEventListener('click', () => {
    if (!variableSlider) return;
    changeVariable(Number(variableSlider.value) + Number(variableSlider.step));
    if (variableChanged) { void interactionFeedback.cue('commit'); variableChanged = false; }
  });
  restart.addEventListener('click', () => { if (state) startLesson(state.lessonId); });
  back.addEventListener('click', () => {
    const wasActive = active;
    state = null;
    active = false;
    render();
    panel.scrollTop = 0;
    if (wasActive) onMessage('Lesson closed. Its Scenario remains available, but no success mark was awarded.');
  });
  render();

  return {
    record,
    open() { open = true; render(); },
    close() { open = false; render(); },
    refresh() { render(); },
    start: startLesson,
    get active() { return active; },
    get state() { return state; },
    get currentStep() {
      const lesson = state ? SCIENTIST_LESSONS[state.lessonId] : null;
      return active && lesson ? lesson.steps[state.index] : null;
    }
  };
}

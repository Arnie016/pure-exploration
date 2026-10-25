# Gravitational Wave Observatory

An original, interactive Three.js teaching world at `/gravity-waves`.

## Playable experiments

1. Rotate the procedural interferometer, compare a two-arm laser path, and follow deliberately slowed light pulses.
2. Inject a stylized gravitational-wave chirp or turn it off.
3. Change peak strain (0.1–5 × 10⁻²¹), arm length (250–4000 m), laser wavelength (532/1064 nm), display magnification and simulated noise.
4. Observe the actual equation outputs for differential arm length, round-trip optical phase, round-trip light travel time and ideal dark-port power.
5. Inspect a signed, display-amplified waveform and seeded noise. Scrub the time series and compare the waveform-template cosine similarity.
6. Load four structured hypotheses: quiet ripple, larger chirp, shorter arms, and shorter wavelength.

No account, data feed, model API, paid provider, asset pack or backend connection is required.

## Physics model and limits

For a plus-polarized plane wave passing perpendicular to the instrument plane, aligned with two orthogonal equal-length arms, in the long-wavelength approximation:

- Arm displacements are +hL/2 and −hL/2.
- Differential arm length: `ΔL = hL`.
- Relative round-trip optical phase: `Δφ = 4πΔL/λ`.
- Ideal un-biased dark-port intensity relative to input: `sin²(Δφ/2)`.
- Single-arm return flight time: `2L/c`.

For h = 10⁻²¹, L = 4,000 m and λ = 1,064 nm, differential length is 4 × 10⁻¹⁸ m and phase shift about 4.72 × 10⁻¹¹ rad. Real power is essentially zero at this simplistic dark port; to see a response at all we plot `sin(displayGain × Δφ)`, a **conceptual signed quadrature monitor**, not the real photodiode power. Display gain never enters the physical phase or intensity.

The waveform is **invented**: f(t) increases quadratically from 24 to 160 Hz, with analytic phase integration, a smooth early envelope and short damped ringdown. This is not a calibrated compact-binary inspiral waveform or parameter-estimation model. No actual astrophysical source is simulated.

Noise is a reproducible pseudorandom illustration. The displayed template-alignment number is normalized cosine similarity, **not** a statistically calibrated signal-to-noise ratio, detection likelihood or false-alarm probability. No filtering for instrument spectral density is performed.

The real LIGO interferometers use Fabry–Perot arm cavities, power/signal recycling, sophisticated feedback, seismic isolation and calibrated data analysis. **Our single-reflection educational Michelson omits all of those.**

## Rendering, performance and accessibility

- One WebGL renderer, OrbitControls, instanced star decorations and shared static materials, with resize/visibility observers.
- A 30 fps maximum frame cadence and device-pixel-ratio cap of 1.5; only redraws when the scene changes or playback is active.
- Static geometry is created once per mounted world. GPU geometry and materials are released on unmount.
- Disabled-animation default when reduced-motion is requested; a useful inline SVG instrument appears when WebGL is unavailable.
- Native semantic buttons, range sliders, select fields, a keyboard-operable timeline and descriptive labels. The SVG trace is backed by numerical readouts.
- No changes to the garden renderer, other projects or server APIs. The world is searchable by its natural language title, description and tags in `app/projects.ts`.

The 3D proportions are **not to physical scale**. Mirror travel is magnified by about 10¹⁹ for visibility; moving lights are slowed by many orders of magnitude. The arms are drawn as four model units, not 4 km of rendered geometry. Animated rings are aesthetic illustrations, not simulated curvature of a spacetime metric.

## Reproducible checks

```sh
npm ci
node --test tests/gravity-waves.test.mjs
npm test
npm run typecheck
npm run build
npm run dev -- --port 4317
```

Visit `/gravity-waves`, inspect orbit and presets, pause/scrub, compare h = 0 with a nonzero wave, test a narrow viewport, and verify the reduced-motion and WebGL fallback experiences manually. Check `gravity`, `interferometer`, `spacetime` in the Portals search after deployment.

## References and provenance

Physics reference, *not copied source or assets*:

- [LIGO Laboratory: LIGO's Interferometer](https://www.ligo.caltech.edu/MIT/page/ligos-ifo), explaining Michelson topology and the additional Fabry–Perot cavity physics.
- [LIGO Scientific Collaboration FAQ](https://ligo.org/faq/), describing the opposite stretching and compression of two perpendicular arms.
- [Gravitational Wave Open Science Center tutorials](https://gwosc.org/tutorials/), for how real signals, templates and real data differ from this toy.
- [GWOSC Find an Inspiral](https://gwosc.org/tutorial06/), a separate tutorial for template searches.

Authorship: original UI, geometry, educational chirp and deterministic model built for Pure Exploration. No external 3D models, trademarks, media files or third-party assets are included. Human visual acceptance and live deployment are separate follow-up steps.

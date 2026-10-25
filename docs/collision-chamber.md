# Collision Chamber: what the browser computes

This is a first-party, original interactive learning world at `/particle-chamber`. It visualizes the circular transverse trajectories of two stable, oppositely charged particles in an ideal uniform solenoidal magnetic field. Visitors can change total centre-of-mass energy, particle species, magnetic field, elevation and azimuth. Three cylindrical sensor layers mark first geometric crossings; a 2D XY projection remains useful if WebGL is unavailable.

## Physics, not magic graphics

The selected species supplies its rest energy `m` in GeV. The user chooses total centre-of-mass energy `sqrt(s)`. Each product gets half, `E = sqrt(s) / 2`. A pair can exist only when `sqrt(s) > 2m` in this simplified model. Relativistic momentum magnitude (with `c=1`) is

```
p [GeV/c] = sqrt(E² - m²)
pT = p cos(elevation)
pz = ± p sin(elevation)
r [m] = pT / (0.299792458 |q| B[T])
```

The positive and negative particle are initialized with exactly opposite 3-momenta. For transverse arc length `s`, azimuth `phi` and signed curvature `k = q × 0.299792458 × B / pT`:

```
x(s) = (sin(phi + k s) - sin(phi)) / k
y(s) = (cos(phi) - cos(phi + k s)) / k
z(s) = s pz / pT
```

The 3D renderer maps this model's `z` to screen-space vertical. Each trajectory stops on leaving the ideal chamber's radius (3.65 m), end cap (|z| ≈ 2.35 m) or the bounded sampling window. Detector radii are 0.55 m, 1.45 m and 3.1 m. The first crossing of each is linearly interpolated between integration-free analytic samples.

**Important:** These are analytic paths of stable test particles in a homogeneous magnetic field. No particle interactions with material, decays, bremsstrahlung, showers, detector noise, event generators, trigger probabilities, beam optics, reconstruction or live data are represented. The particles do not actually collide in the scene. A hypothetical two-body interaction at the origin is the starting condition, not an actual simulated scattering amplitude or production cross-section. The model has no connection to CERN infrastructure. A ring crossing is not a measured hit. The camera, luminous dots, track colors and playback are instructional graphics, not scientific measurements.

## Reproducibility and efficiency

- The physics engine is browser-side JavaScript, deterministic for the same controls and seed, with no provider keys or backend calls.
- Scene objects and geometries are built once. On parameter change the old track geometry and materials are explicitly disposed.
- The 3D view uses shared reusable detector geometry, stops rendering when outside the viewport or when the document is hidden, caps draws near 30 fps and limits device pixel ratio to 1.5.
- Browser animation only unveils the same analytic track; the particle trajectory does not change in response to animation speed. A static accessible XY projection and visible readouts expose the important ideas without relying on color or WebGL.
- The geometry is deliberately simplified to keep mobile GPU and memory costs bounded.

## Try it

1. Load **Muon arcs** and identify three sensor crossings.
2. Keep energy constant and increase the magnetic field. The radius should shrink.
3. Keep the field fixed and raise energy. The track should straighten.
4. Load **Missing protons** and raise the total energy through approximately 1.877 GeV. The pair appears above threshold. This alone does **not** calculate the probability that a real collision produces that pair.
5. Increase the elevation. Watch one or both tracks escape the end cap without reaching the outer barrel.

## Development checks

```sh
npm ci
node --test tests/collision-chamber.test.mjs
npm test
npm run typecheck
npm run build
npm run dev -- --port 4317
```

Before merging, inspect the world in a real browser on desktop and narrow mobile. Test the fallback with WebGL disabled, reduced-motion preferences, the Portals navigation and energy below threshold. If the rendered world cannot be checked, say so explicitly.

## References

- [Particle Data Group: Review of Particle Physics](https://pdg.lbl.gov/) for rest masses and particle definitions.
- [CERN: The Standard Model](https://home.cern/science/physics/standard-model) for educational context around particle species.
- [OpenStax University Physics Vol. 2, Motion of a Charged Particle in a Magnetic Field](https://openstax.org/books/university-physics-volume-2/pages/11-3-motion-of-a-charged-particle-in-a-magnetic-field) for the underlying Lorentz-force curvature relationship.

All visual assets are procedural, created for this repository without third-party models, downloaded textures or user data.

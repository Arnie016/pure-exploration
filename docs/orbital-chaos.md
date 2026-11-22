# Three-Body Chaos Lab

First-party route: `/orbital-chaos`, listed in `app/projects.ts`.

## Investigate

1. Select **Triangle**, equal masses, zero ghost velocity change: compare the two identical solutions.
2. Increase ghost velocity by 0.001 and run. Watch the third-body separation accumulate, even though both integrations use exactly the same deterministic force law.
3. Select **Close encounter** and alter the visitor mass. Compare trajectories and the total-energy error shown in the instrument console.
4. Press **Step +0.12** to inspect integration without autoplay. Use drag, scroll and arrow keys to orbit the camera.

## Numerical method and scope

A deliberately compact, **dimensionless** three-body simulation with `G = 1` and no calibrated astronomical lengths or times. Each body experiences the softened Newtonian pair potential

`U_ij = -G m_i m_j / sqrt(|r_i - r_j|^2 + epsilon^2)`.

The force follows analytically from this potential and is equal/opposite for every pair. Integration uses velocity Verlet with `dt=0.006` simulation-time units, capped at 25 steps per rendered frame. Rendering is capped near 30 fps; the loop stops while paused or offscreen. One system has its third body's x-velocity perturbed by a user-controlled amount. The white ghost trail makes this counterfactual inspectable. Total energy and signed relative energy drift are computed from the same softened potential.

**Limits:** softening changes the physical force at small separations. Close encounters can produce large integration errors, especially at low epsilon; inspect drift before interpreting the trajectory. There is no merging, collision detection, finite stellar radius, spin, relativity, radiation, live ephemeris data or physical units. The figure-eight preset borrows known equal-mass initial conditions, but softening and unequal masses generally destroy exact periodicity. The triangle preset's velocity is exact only for equal masses in this softened model.

## Efficiency and accessibility

Three.js is dynamically imported only on the laboratory route. Reuse sphere geometry, pre-allocate trail buffers, cap pixel ratio, render on demand while paused, suspend offscreen and destroy GPU resources on unmount. Keyboard orbit/zoom controls are included. When WebGL is missing, the controls can still advance the numerical values through **Step**.

## Reproduce checks

- `node --experimental-strip-types --test tests/orbital-chaos.test.mjs`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`

Only the first command can be executed in an offline dependency-free Node environment. The complete application commands require installed dependencies and an appropriate hosting build environment. Browser appearance and WebGL performance need manual review.

Sources for further reading: Chenciner & Montgomery (2000), `A remarkable periodic solution of the three-body problem in the case of equal masses`, Annals of Mathematics; Hairer, Lubich & Wanner, `Geometric Numerical Integration`.

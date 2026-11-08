# Radio Sky: model and verification notes

This proposed world is a self-contained educational experiment at `/radio-sky`, listed in `app/projects.ts`. It uses no backend, login, payment, data feed or remote model. It is not claiming to receive real radio signals.

## What you can change

- Four receivers arranged along east-west and north-south baselines, 6–48 metres apart along each axis.
- A distant source direction (azimuth), digital beam steering angle and shared elevation.
- Carrier frequency 80–400 MHz. Source and steering direction share the chosen elevation.
- A real-time 181-sample azimuth response plot, relative geometric delay A → B, wavelength, residual complex phases and \(\lambda/B\) angular scale.

The array and response are recomputed deterministically in the browser; no GPU benchmark or synthetic observations are reported as measurements.

## Mathematical definition

Positions are measured in metres on a flat ground plane, with \(+z\) north and \(+x\) east. Source direction \(\hat s\) points from the array to the celestial source:

\[
\hat s=(\sin a\cos e,\ \sin e,\ \cos a\cos e)
\]

where \(a\) is azimuth and \(e\) is elevation. For a plane wave propagating toward the array, the geometric arrival-time difference between receivers 1 and 2 is

\[
t_2-t_1=-\frac{(\mathbf r_2-\mathbf r_1)\cdot\hat s}{c}.
\]

With digital time-delay steering to direction \(\hat s_0\), the residual phase at antenna \(j\) is

\[
\phi_j=\frac{2\pi}{\lambda}\mathbf r_j\cdot(\hat s-\hat s_0),\qquad \lambda=\frac{c}{f}.
\]

For four equal-amplitude ideal scalar voltages, normalized delay-and-sum power is

\[
P(\hat s_0)=\left|\frac1{4}\sum_{j=1}^4e^{i\phi_j}\right|^2.
\]

The power is exactly one for matched source and steering direction, and bounded between zero and one. Side lobes and grating lobes are genuine features of sparse array geometry, **not** multiple sources. The vertical scale on the scan plot is normalized coherent power, not antenna sensitivity in watts or an estimated source probability.

\(\lambda/B\) gives an order-of-magnitude angular scale. It is **not** the measured synthesized-beam FWHM of this array and its off-axis performance depends on baseline projection and sidelobes.

## Model boundaries

This is a **single-frequency array-factor simulation**, not a complete radio interferometry correlator or astronomical visibility inversion. It assumes identical isotropic receiving elements, a far-field narrowband plane wave and coherent timing. It omits sky brightness synthesis, polarization, primary-beam attenuation, propagation media, receiver noise, spectral bandwidth, calibration and Earth rotation. Actual ALMA-style aperture synthesis correlates antenna voltages and uses Fourier-plane coverage to reconstruct images. The ground geometry and translucent wavefront planes are drawn for pedagogy and are not to scale in electromagnetic wavelength.

Sources:

- ALMA Observatory, [Interferometry](https://www.almaobservatory.org/en/about-alma/how-alma-works/technologies/interferometry/)
- NRAO ALMA Science Portal, [ALMA Basics](https://almascience.nrao.edu/about-alma/alma-basics)

## Performance and safety

The Three.js renderer is loaded lazily through a React suspense boundary. An orbit-control event or changed control schedules a single render, not a continuous requestAnimationFrame loop. Pixel ratio is capped at 1.5. It shares dish geometry/materials between receivers; the scene disposes geometries, materials, textures, controls, renderer and ResizeObserver on exit. A WebGL failure leaves the numeric model usable. The app stores no personal information.

## Verification checklist

1. `npm ci` on Node >=22.13.
2. `node --test tests/radio-sky.test.mjs`
3. `npm run typecheck && npm run lint && npm test && npm run build`
4. Open `/radio-sky`: changing digital pointing updates the scan indicator and the phasors.
5. Click *Align all four phases*: normalized power should become 100%.
6. Change source azimuth, frequency and baseline. Check the waveform positions and the scan response change coherently.
7. Orbit and zoom the 3D array. Check mobile scrolling and reduced-motion settings.
8. Disable WebGL: controls and scan should remain available with a visible fallback.

Browser visual acceptance and production deployment remain separate from source-code publication. Do not mark either verified until actually tested.

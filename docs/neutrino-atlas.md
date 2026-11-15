# Neutrino Oscillation Atlas

An interactive same-origin Three.js world at /neutrino, integrated into the Pure Exploration catalog. This is a probability simulator and visual experiment, **not** a detector event display.

## Physical model

The source is an electron, muon or tau flavour state. A unitary three-flavour PMNS matrix mixes that source into three mass eigenstates. Each mass state accumulates a phase in vacuum. The detector probability is:

P(να → νβ) = |Σᵢ Uβᵢ U*αᵢ exp[-i (mᵢ² − m₁²)L/(2E)]|².

For km, GeV and eV² units, the amplitude phase is -2 × 1.2669328 × Δm²[eV²] × L[km] / E[GeV]. The antineutrino toggle complex-conjugates U. The model uses exact complex amplitudes, not a two-flavour shortcut or artificial noise.

Reference teaching parameters, **normal ordering**:

- sin²θ₁₂ = 0.3047, sin²θ₁₃ = 0.02218, sin²θ₂₃ = 0.491
- Δm²₂₁ = 7.465 × 10⁻⁵ eV²
- Δm²₃₁ = (2.4720 × 10⁻³ + Δm²₂₁/2) eV²
- δCP = 1.19π by default, adjustable by visitor

Provenance: [Bari global analysis, preliminary release 2026.a](https://global-nu.org/), dated 15 October 2026. Preliminary fitted values are not final results. Rounding is for teaching, not an assertion of experimental precision.

## What is deliberately excluded

This is strictly coherent vacuum propagation, with no Earth matter effects (MSW potential), energy spectrum convolution, decoherence, uncertainty or detector flavour-dependent efficiencies. The short, medium and long baseline presets do not claim to reproduce any measured experiment.

The luminous 3D tubes plot each flavour's **probability versus distance** with vertical displacement. They are not spatial neutrino paths or literal wavefunctions. Moving lights represent scanning the graph. The detector cards and accessible SVG chart share the numerical model with the scene.

## Explore and check

1. Set baseline to 0 km: the source flavour probability is 100%.
2. Increase distance at fixed energy: probabilities oscillate but sum to one.
3. Increase energy and baseline by the same factor: unchanged vacuum probabilities because L/E is unchanged.
4. Set δCP to 0°, toggle neutrino/antineutrino: equal probabilities in vacuum.
5. Set nonzero δCP, compare off-diagonal flavour transitions for neutrinos and antineutrinos.

On Node 22.13+, run: node --experimental-strip-types --test tests/neutrino.test.mjs. On supported Node 24+, the normal repository npm test includes the new suite. The six model tests cover PMNS unitarity, zero-baseline identity, conservation, L/E scaling, CP relations and finite chart samples.

Browser review before merging: rotate scene, drag controls, inspect mobile overflow and keyboard access, test WebGL fallback and reduced motion, verify the cover, check console errors. A passing unit test is not visual acceptance.

## Rendering budget

Three.js and orbit controls initialize only on this route. Geometry rebuilds when the sampled probability array changes, not when the detector moves or animation is toggled. Pixel ratio is capped (1 mobile, 1.5 desktop). The flight renderer targets 30 fps, suspends when out of view or document-hidden and respects reduced motion. Renderer, materials, geometries, controls, observers and animation callbacks are disposed on unmount.

# Attention Observatory

A playable, browser-local transformer **attention teaching instrument** at /attention.

## What can visitors investigate?

- Type up to eight tokens, select any query token, switch between two fixed synthetic heads.
- Inspect the exact scaled dot product Q_i · K_j / (sqrt(4) × T), where T is a user-controlled softmax temperature.
- Toggle autoregressive (causal) masking and see future attention probabilities become exactly zero.
- Step through deterministic token/position embeddings, Q/K comparison, softmax and weighted V mixing.
- Rotate and zoom the Three.js scene. The numerical heatmap and vector readouts remain usable if WebGL is absent.
- Compare illustrative projection/attention operation counts, a 4-byte attention buffer estimate and one-head K/V storage.

## Scientific boundary

The model uses a seeded four-dimensional embedding and **untrained** fixed projection matrices. Token hashes are not semantic embeddings; there is no optimizer, pretrained checkpoint, network request or GPU training. All reported values are calculated from the displayed local model and the same numbers drive the beams. The 3D canvas renders with WebGL, but the mathematical calculations happen on the JavaScript CPU. Operation counts are rough scalar multiply-add terms, not a measured hardware throughput statistic. Buffer estimates exclude parameters, system allocations, autograd state, padding and kernel workspace. The world must not be presented as a hardware benchmark.

## Implementation and performance

The dependency-free attention model lives in app/attention/model.js and is importable directly by Node tests. The view in app/attention/workspace.tsx dynamically loads Three.js only on this route. One renderer and one scene are retained while parameter changes rebuild only the small, bounded scene group. Geometry, material and text textures are explicitly disposed on update; render calls happen on state changes, camera orbit interactions or resize, not on a perpetual 60fps animation loop. Pixel ratio is capped at 1.5 and sequence length at 8.

## Verification

Run: node --test tests/attention-lab.test.mjs

A scoped GitHub Actions workflow for the pull request performs npm ci, the model tests, typecheck and production build. Human mobile/WebGL visual acceptance is still required.

## Related work

The existing GPU training lab is an independent unmerged pull request (#8). Attention Observatory teaches the forward attention operator without duplicating the GPU training world's optimizer, gradients or hardware-floor visualization. The two could cross-link when both are merged.

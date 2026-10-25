# Inside a Training Run: implementation and scientific boundaries

## What actually runs

The \`/gpu-training\` route uses a deterministic 2-input, 6-tanh-hidden-unit,
1-sigmoid-output multilayer perceptron with **25 learned parameters** to solve
the four-input XOR task. Source: \`app/gpu-training/model.ts\`. Initial weights
come from a local seeded pseudorandom generator. There is no remote model
endpoint, user account or paid inference provider.

A real training update uses the selected batch, binary cross-entropy, analytic
backpropagation and either SGD or Adam. The loss chart evaluates all four XOR
inputs after each weight update, rather than showing an arbitrary decreasing
function. The gradient norm is the actual batch-average L2 norm and the
weight-update norm comes from the parameter difference. Each update is done in
ordinary **JavaScript floating-point arithmetic on the browser CPU**.

\`app/gpu-training/scene.tsx\` presents the network above a stylized GPU
compute floor using Three.js. Colored links encode the *current sign and
magnitude* of genuine model weights. Node colors correspond to the selected
sample's activations, while pulses depict the direction of the currently
selected conceptual stage. The floor's instanced tiles represent the idea of
parallel arithmetic lanes and change with batch size; they are not NVIDIA,
AMD or Apple GPU execution traces.

## Important distinctions

- A GPU's tensor-core scheduling, occupancy, memory coalescing, launch
  latency, gradient all-reduce and kernel fusion are **not simulated**.
- The displayed Float32 byte subtotal counts 25 parameters, 25 gradients,
  optional two Adam moment arrays and illustrative per-example activation
  and delta tensors. The actual toy uses JavaScript Number (Float64); the
  byte display does **not** measure JS heap, VRAM, shared memory, optimizer
  buffers beyond these arrays or any hardware allocation.
- The displayed MAC-equivalent count is a teaching arithmetic estimate,
  **not** observed FLOPS or GPU throughput.
- Batch sizes 1, 2, 4 and 8 cycle deterministically through the four
  training examples. Values above four repeat examples, not new data.
- Accuracy reports correct classification of four training examples.
  No holdout set or generalization metric is claimed.
- Adam/SGD switches restart with the same initial seed to permit a fair
  side-by-side comparison; LR and batch size changes apply on the next step.
- The app stops stepping while the tab is hidden. Its 3D viewport caps device
  pixel ratio at 1.5, renders at at most roughly 30 FPS, skips offscreen
  rendering, uses one instanced mesh for the 96 compute tiles and disposes
  geometries/materials when it unmounts.
- Browser audio, cloud GPU training, power consumption and real-time profiling
  are outside this version's scope.

## Reproduce and check

Requires the repository's Node 24 toolchain and dependencies.

\`\`\`sh
npm ci
node --test tests/gpu-training.test.mjs
npm run typecheck
npm run build
npm run dev -- --port 4317
\`\`\`

Open \`http://localhost:4317/gpu-training\`, then run the same seed under
both optimizers and watch the actual loss trace. The separate CI workflow
attempts automated verification. A passing build does not replace browser
testing on touchscreens, reduced-motion devices or lower-end GPUs.

## Design and provenance

The lesson equations (tanh, sigmoid, binary cross-entropy, chain-rule
gradients and Adam) are standard descriptions, implemented locally rather than
copied from an external game. The 3D die, labels, styling, shaders and network
structure are original to Pure Exploration. No outside assets, tracking keys
or model weights are loaded.

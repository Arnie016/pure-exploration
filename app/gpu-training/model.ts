/** A real, seeded 2 -> 6 -> 1 neural network trained entirely in the browser.
 * Its arithmetic runs on the JavaScript CPU. The GPU display is a teaching
 * visualization, NOT a real GPU kernel, profiler or memory measurement. */
export const HIDDEN = 6;
export const PARAMS = 2 * HIDDEN + HIDDEN + HIDDEN + 1;
export type Optimizer = 'sgd' | 'adam';
export type TrainConfig = { batchSize: number; learningRate: number; optimizer: Optimizer };
export type Sample = { input: [number, number]; target: 0 | 1; name: string };
export const SAMPLES: readonly Sample[] = [
  { input: [-1, -1], target: 0, name: '0 XOR 0' },
  { input: [-1, 1], target: 1, name: '0 XOR 1' },
  { input: [1, -1], target: 1, name: '1 XOR 0' },
  { input: [1, 1], target: 0, name: '1 XOR 1' },
];
export type TrainingState = {
  weights: number[];
  firstMoment: number[];
  secondMoment: number[];
  gradient: number[];
  step: number;
  cursor: number;
  updateNorm: number;
  history: number[];
};
export type Probe = {
  sample: Sample;
  prediction: number;
  hidden: number[];
  hiddenDelta: number[];
  outputDelta: number;
  sampleLoss: number;
};
const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
const crossEntropy = (p: number, y: number) => {
  const q = Math.max(1e-9, Math.min(1 - 1e-9, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
};
const length = (values: number[]) => Math.hypot(...values);

export function forward(weights: readonly number[], input: readonly [number, number]) {
  const hidden = Array.from({ length: HIDDEN }, (_, h) =>
    Math.tanh(weights[h * 2] * input[0] + weights[h * 2 + 1] * input[1] + weights[12 + h]));
  const z = hidden.reduce((sum, value, h) => sum + value * weights[18 + h], weights[24]);
  return { hidden, prediction: sigmoid(z) };
}
export function inspect(state: TrainingState, index: number): Probe {
  const sample = SAMPLES[((Math.trunc(index) % SAMPLES.length) + SAMPLES.length) % SAMPLES.length];
  const { hidden, prediction } = forward(state.weights, sample.input);
  const outputDelta = prediction - sample.target;
  const hiddenDelta = hidden.map((h, i) => (1 - h * h) * state.weights[18 + i] * outputDelta);
  return { sample, prediction, hidden, outputDelta, hiddenDelta,
    sampleLoss: crossEntropy(prediction, sample.target) };
}
export function metrics(state: TrainingState) {
  const probes = SAMPLES.map((_, i) => inspect(state, i));
  return {
    loss: probes.reduce((total, p) => total + p.sampleLoss, 0) / probes.length,
    correct: probes.filter(p => Number(p.prediction >= .5) === p.sample.target).length,
    gradientNorm: length(state.gradient),
    updateNorm: state.updateNorm,
  };
}
export function makeTrainingState(seed = 317): TrainingState {
  let x = seed >>> 0;
  const random = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const weights = Array.from({ length: PARAMS }, (_, i) => (random() * 2 - 1) * (
    i < 12 ? .95 : i < 18 ? .12 : i < 24 ? .8 : .12
  ));
  const state = { weights, firstMoment: Array(PARAMS).fill(0), secondMoment: Array(PARAMS).fill(0),
    gradient: Array(PARAMS).fill(0), step: 0, cursor: 0, updateNorm: 0, history: [] } satisfies TrainingState;
  return { ...state, history: [metrics(state).loss] };
}
export function trainBatch(state: TrainingState, config: TrainConfig): TrainingState {
  const batch = [1, 2, 4, 8].includes(config.batchSize) ? config.batchSize : 4;
  const rate = Number.isFinite(config.learningRate) ? Math.max(.001, Math.min(1, config.learningRate)) : .06;
  const gradient = Array(PARAMS).fill(0) as number[];
  for (let i = 0; i < batch; i++) {
    const { sample, hidden, outputDelta, hiddenDelta } = inspect(state, state.cursor + i);
    for (let h = 0; h < HIDDEN; h++) {
      gradient[h * 2] += hiddenDelta[h] * sample.input[0];
      gradient[h * 2 + 1] += hiddenDelta[h] * sample.input[1];
      gradient[12 + h] += hiddenDelta[h];
      gradient[18 + h] += outputDelta * hidden[h];
    }
    gradient[24] += outputDelta;
  }
  for (let j = 0; j < PARAMS; j++) gradient[j] /= batch;
  const step = state.step + 1;
  const firstMoment = state.firstMoment.slice();
  const secondMoment = state.secondMoment.slice();
  let totalUpdateSquared = 0;
  const weights = state.weights.map((w, j) => {
    const g = gradient[j];
    let delta = rate * g;
    if (config.optimizer === 'adam') {
      firstMoment[j] = .9 * firstMoment[j] + .1 * g;
      secondMoment[j] = .999 * secondMoment[j] + .001 * g * g;
      const mHat = firstMoment[j] / (1 - Math.pow(.9, step));
      const vHat = secondMoment[j] / (1 - Math.pow(.999, step));
      delta = rate * mHat / (Math.sqrt(vHat) + 1e-8);
    }
    totalUpdateSquared += delta * delta;
    return w - delta;
  });
  const next: TrainingState = { weights, firstMoment, secondMoment, gradient,
    step, cursor: (state.cursor + batch) % SAMPLES.length,
    updateNorm: Math.sqrt(totalUpdateSquared), history: state.history };
  return { ...next, history: [...state.history.slice(-95), metrics(next).loss] };
}
/** Float32 *hypothetical tensors* only. No browser GPU allocation is measured. */
export function illustrativeMemory(batchSize: number, optimizer: Optimizer) {
  const parameters = PARAMS * 4;
  const gradients = PARAMS * 4;
  const optimizerState = optimizer === 'adam' ? PARAMS * 8 : 0;
  const activationsAndDeltas = batchSize * (2 + HIDDEN + 1 + HIDDEN + 1) * 4;
  return { parameters, gradients, optimizerState, activationsAndDeltas,
    total: parameters + gradients + optimizerState + activationsAndDeltas };
}
/** Rough multiply-accumulate count for one batch, not GPU throughput. */
export function illustrativeMacs(batchSize: number) { return batchSize * (2 * HIDDEN + HIDDEN + 2 * HIDDEN + HIDDEN); }

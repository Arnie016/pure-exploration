import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAMS, SAMPLES, makeTrainingState, forward, inspect, metrics,
  trainBatch, illustrativeMemory, illustrativeMacs,
} from '../app/gpu-training/model.ts';

test('seeded initialization is deterministic without shared state', () => {
  const a = makeTrainingState(317), b = makeTrainingState(317);
  assert.deepEqual(a, b);
  assert.equal(a.weights.length, PARAMS);
  assert.equal(a.history.length, 1);
  a.weights[0] = 999;
  assert.notEqual(a.weights[0], b.weights[0]);
});

test('forward pass and probe use bounded probabilities and valid XOR labels', () => {
  const state = makeTrainingState();
  for (let i = 0; i < SAMPLES.length; i++) {
    const p = inspect(state, i);
    assert.equal(p.hidden.length, 6);
    assert.equal(p.hiddenDelta.length, 6);
    assert.ok(p.prediction > 0 && p.prediction < 1);
    assert.ok(Number.isFinite(p.sampleLoss));
    assert.equal(p.sample.target, SAMPLES[i].target);
    assert.equal(forward(state.weights, p.sample.input).prediction, p.prediction);
  }
});

test('analytic batch gradient agrees with numerical finite differences', () => {
  const state = makeTrainingState();
  const next = trainBatch(state, { batchSize: 4, learningRate: .02, optimizer: 'sgd' });
  const epsilon = 1e-5;
  for (const j of [0, 3, 11, 12, 17, 18, 23, 24]) {
    const plus = { ...state, weights: [...state.weights] };
    const minus = { ...state, weights: [...state.weights] };
    plus.weights[j] += epsilon;
    minus.weights[j] -= epsilon;
    const numerical = (metrics(plus).loss - metrics(minus).loss) / (2 * epsilon);
    assert.ok(Math.abs(numerical - next.gradient[j]) < 1e-6,
      'bad gradient for parameter ' + j + ': ' + numerical + ' vs ' + next.gradient[j]);
    assert.ok(Math.abs(next.weights[j] - (state.weights[j] - .02 * next.gradient[j])) < 1e-11);
  }
});

test('updates are immutable and all optimizer state stays finite', () => {
  const start = makeTrainingState();
  const original = structuredClone(start);
  let adam = start;
  for (let i = 0; i < 35; i++) adam = trainBatch(adam, { batchSize: 2, learningRate: .06, optimizer: 'adam' });
  assert.deepEqual(start, original);
  assert.equal(adam.step, 35);
  assert.ok(adam.gradient.every(Number.isFinite));
  assert.ok(adam.weights.every(Number.isFinite));
  assert.ok(adam.firstMoment.every(Number.isFinite));
  assert.ok(adam.secondMoment.every(Number.isFinite));
  assert.ok(adam.history.every(Number.isFinite));
});

test('neural network genuinely reduces XOR loss through training', () => {
  let state = makeTrainingState();
  const initialLoss = metrics(state).loss;
  for (let i = 0; i < 500; i++) {
    state = trainBatch(state, { batchSize: 4, learningRate: .06, optimizer: 'adam' });
  }
  assert.ok(metrics(state).loss < initialLoss * .6,
    '500 updates should meaningfully reduce the real XOR loss');
  assert.ok(metrics(state).correct >= 3);
  assert.ok(state.history.length <= 96);
  assert.equal(state.step, 500);
});

test('batch arithmetic and estimated storage explicitly use toy assumptions', () => {
  assert.equal(illustrativeMacs(8), 8 * 36);
  assert.deepEqual(illustrativeMemory(4, 'adam'), {
    parameters: 100, gradients: 100, optimizerState: 200,
    activationsAndDeltas: 256, total: 656,
  });
  assert.equal(illustrativeMemory(8, 'sgd').total, 712);
});

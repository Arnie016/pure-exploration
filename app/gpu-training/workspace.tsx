'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { WorldDock } from '../components/world-dock';
import { CaptureControls } from '../components/capture';
import { track, usePulse } from '../activity';
import GpuTrainingScene from './scene';
import {
  HIDDEN, SAMPLES, inspect, illustrativeMacs, illustrativeMemory,
  makeTrainingState, metrics, trainBatch, type Optimizer, type TrainConfig,
} from './model';
import './style.css';

const stages = [
  { name: 'Forward', title: 'Predictions begin as guesses.',
    formula: 'h = tanh(W₁x + b₁)   ·   p = σ(W₂h + b₂)',
    detail: 'Each input is multiplied by learned weights. Six hidden neurons transform the numbers. The output sigmoid returns a probability between 0 and 1.' },
  { name: 'Loss', title: 'Measure how wrong the guess was.',
    formula: 'L = −y log(p) − (1 − y) log(1 − p)',
    detail: 'Binary cross-entropy penalizes confident mistakes. The chart shows the average loss across all four XOR inputs after each optimizer update.' },
  { name: 'Backward', title: 'Send the error back through the network.',
    formula: 'δout = p − y   ·   δh = (1 − h²) W₂ δout',
    detail: 'Backpropagation uses the chain rule to compute how much each weight contributed to the error. Orange particles travel backward conceptually; the gradients are calculated for real in JavaScript.' },
  { name: 'Update', title: 'Change the weights, then try again.',
    formula: 'SGD: w ← w − η∇L   ·   Adam: moment-adjusted ∇L',
    detail: 'An optimizer moves the weights opposite the gradient. Adam tracks first and second moments; SGD uses the batch-average gradient directly.' },
] as const;

function lossPath(history: number[]) {
  const peak = Math.max(1, ...history);
  const points = history.map((v, i) => {
    const x = 8 + (i / Math.max(1, history.length - 1)) * 584;
    const y = 124 - Math.min(1, v / peak) * 106;
    return x.toFixed(2) + ',' + y.toFixed(2);
  });
  return points.length === 1 ? 'M 8 ' + points[0].split(',')[1] + ' L 592 ' + points[0].split(',')[1]
    : points.map((p, i) => (i === 0 ? 'M ' : 'L ') + p.replace(',', ' ')).join(' ');
}
const fixed = (x: number, places = 3) => Number.isFinite(x) ? x.toFixed(places) : '—';

export default function GpuTrainingWorld() {
  const [model, setModel] = useState(() => makeTrainingState());
  const [config, setConfig] = useState<TrainConfig>({ batchSize: 4, learningRate: .06, optimizer: 'adam' });
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [probeIndex, setProbeIndex] = useState(1);
  const [selectedNode, setSelectedNode] = useState('Hidden 1');
  const [feedback, setFeedback] = useState('');
  const { pulse, favorite } = usePulse('gpu-training');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      setModel(previous => trainBatch(previous, config));
      setPhase(p => (p + 1) % stages.length);
    }, 220);
    return () => clearInterval(id);
  }, [running, config]);
  const probe = inspect(model, probeIndex);
  const report = metrics(model);
  const memory = illustrativeMemory(config.batchSize, config.optimizer);
  const curve = useMemo(() => lossPath(model.history), [model.history]);
  const stagesCount = SAMPLES.length;
  const step = () => {
    setModel(previous => trainBatch(previous, config));
    setPhase(p => (p + 1) % stages.length);
    track('first_interaction', 'gpu-training');
  };
  const reset = () => {
    setRunning(false);
    setPhase(0);
    setModel(makeTrainingState());
    setFeedback('Weights reset to the same seed. A fair comparison starts here.');
  };
  const changeOptimizer = (optimizer: Optimizer) => {
    setConfig(current => ({ ...current, optimizer }));
    setRunning(false);
    setModel(makeTrainingState());
    setPhase(0);
    setFeedback('Optimizer changed. Both methods restart from the same weights.');
  };
  const chooseNode = (node: string) => {
    setSelectedNode(node);
    track('first_interaction', 'gpu-training');
  };
  const nodeInfo = selectedNode === 'Output'
    ? 'p = ' + fixed(probe.prediction) + '  ·  error signal δ = ' + fixed(probe.outputDelta)
    : selectedNode.startsWith('Input')
      ? 'x' + selectedNode.slice(-1) + ' = ' + probe.sample.input[Number(selectedNode.slice(-1)) - 1]
      : 'activation = ' + fixed(probe.hidden[Math.max(0, Number(selectedNode.split(' ')[1]) - 1)]) +
        '  ·  δ = ' + fixed(probe.hiddenDelta[Math.max(0, Number(selectedNode.split(' ')[1]) - 1)]);

  return <main className="gpu-page">
    <a className="gpu-skip" href="#gpu-controls">Skip the 3D view to training controls</a>
    <header className="gpu-masthead">
      <a className="gpu-back-link" href="/?walk=1"><ArrowLeft size={15} /> Back to the garden</a>
      <span>PURE EXPLORATION / EXPERIMENT 016</span>
      <a className="gpu-source" href="https://github.com/Arnie016/pure-exploration" target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={13} /></a>
    </header>
    <div className="gpu-intro">
      <div><span className="gpu-eyebrow"><i /> A WORKING NEURAL NETWORK INSIDE A CONCEPTUAL GPU</span>
        <h1>Inside a <em>training run.</em></h1>
        <p>What does an AI actually do when it learns? Change a weight, follow the error backwards, watch a tiny network teach itself XOR. The math is real. The silicon is a visualization.</p>
      </div>
      <div className="gpu-intro-id"><strong>02 → 06 → 01</strong><span>INPUTS / HIDDEN NEURONS / OUTPUT</span><small>25 learnable parameters · four XOR examples</small></div>
    </div>

    <section className="gpu-theater" aria-label="Interactive GPU training experiment">
      <div className="gpu-viewport">
        <GpuTrainingScene model={model} probeIndex={probeIndex} phase={phase} running={running} batchSize={config.batchSize} onInspect={chooseNode} />
        <div className="gpu-view-top"><span><i /> CONCEPTUAL GPU DIE / 3D VIEW</span><span>{running ? 'TRAINING' : 'PAUSED'} · STEP {model.step.toString().padStart(4, '0')}</span></div>
        <div className="gpu-view-labels" aria-hidden="true"><span>INPUT</span><span>HIDDEN</span><span>OUTPUT</span></div>
        <div className="gpu-view-bottom"><span>DRAG TO ORBIT · SCROLL TO ZOOM · TAP A NEURON</span><span>TEAL + / AMBER − WEIGHT</span></div>
      </div>
      <aside className="gpu-console" id="gpu-controls">
        <div className="gpu-console-heading"><span>TRAINING CONSOLE</span><b><i className={running ? 'is-live' : ''} /> {running ? 'ACTIVE' : 'READY'}</b></div>
        <div className="gpu-stats">
          <div><small>DATASET LOSS</small><strong>{fixed(report.loss)}</strong><span>real cross-entropy</span></div>
          <div><small>XOR ACCURACY</small><strong>{report.correct}/{stagesCount}</strong><span>real predictions</span></div>
        </div>
        <div className="gpu-actions"><button className="gpu-run" onClick={() => { setRunning(value => !value); track('first_interaction', 'gpu-training'); }}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause' : 'Run training'}</button><button onClick={() => { setRunning(false); step(); }} aria-label="One optimizer update" title="One optimizer update"><SkipForward size={16} /></button><button onClick={reset} aria-label="Reset to seeded weights" title="Reset to seeded weights"><RotateCcw size={16} /></button></div>
        <p className="gpu-hint">Each step does one genuine mini-batch forward pass, backpropagation and weight update on the browser CPU.</p>
        <label className="gpu-range">LEARNING RATE <output>{fixed(config.learningRate, 3)}</output><input aria-label="Learning rate" type="range" min=".005" max=".3" step=".005" value={config.learningRate} onChange={event => setConfig(current => ({ ...current, learningRate: Number(event.target.value) }))} /><small>Smaller learns cautiously. Too large can overshoot.</small></label>
        <label className="gpu-select">BATCH SIZE <select value={config.batchSize} onChange={event => setConfig(current => ({ ...current, batchSize: Number(event.target.value) }))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} example{n > 1 ? 's' : ''}</option>)}</select></label>
        <div className="gpu-segment-title">OPTIMIZER</div>
        <div className="gpu-segmented" role="group" aria-label="Optimizer">
          {(['adam', 'sgd'] as const).map(o => <button key={o} aria-pressed={config.optimizer === o} onClick={() => changeOptimizer(o)}>{o === 'adam' ? 'Adam' : 'SGD'}</button>)}
        </div>
        <p className="gpu-hint">Switching optimizers resets to identical initial weights for comparison. Changing batch size or learning rate takes effect on the next step.</p>
        {feedback && <p className="gpu-feedback" role="status">{feedback}</p>}
      </aside>
    </section>

    <section className="gpu-readout" aria-label="Training measurements">
      <div><small>WEIGHT UPDATE</small><strong>{fixed(report.updateNorm, 5)}</strong><span>real L2 norm</span></div>
      <div><small>BATCH GRADIENT</small><strong>{fixed(report.gradientNorm, 4)}</strong><span>real L2 norm</span></div>
      <div><small>TENSOR MEMORY*</small><strong>{memory.total.toLocaleString()} <i>B</i></strong><span>illustrative Float32 only</span></div>
      <div><small>MATH PER BATCH*</small><strong>{illustrativeMacs(config.batchSize)}</strong><span>estimated MAC-equivalents</span></div>
    </section>

    <section className="gpu-workbench">
      <article className="gpu-loss-panel"><div className="gpu-panel-head"><span>01 / LOSS OVER TIME</span><strong>{model.step} updates</strong></div>
        <h2>Is it <em>learning?</em></h2>
        <p>The gold trace is measured from all four XOR examples, not a decorative curve. Watch what changes when you alter the optimizer or learning rate.</p>
        <svg className="gpu-loss-chart" viewBox="0 0 600 144" role="img" aria-label={'Training loss from ' + fixed(model.history[0]) + ' to ' + fixed(report.loss) + ' after ' + model.step + ' optimizer steps.'}>
          {[26, 62, 98, 134].map(y => <line key={y} x1="8" x2="592" y1={y} y2={y} stroke="#ffffff16" strokeWidth="1" />)}
          <path d={curve} fill="none" stroke="#efd299" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="gpu-chart-caption"><span>START · {fixed(model.history[0])}</span><span>LAST 96 UPDATES · {fixed(report.loss)}</span></div>
        <p className="gpu-note">XOR cannot be separated by one linear decision boundary. The six tanh hidden neurons make nonlinear learning possible. A small stochastic batch may temporarily increase full-dataset loss.</p>
      </article>

      <article className="gpu-phase-panel"><div className="gpu-panel-head"><span>02 / FOUR STAGES OF AN OPTIMIZER STEP</span><strong>INSPECT THE PIPELINE</strong></div>
        <div className="gpu-phase-tabs" role="group" aria-label="Training stage">{stages.map((s, i) => <button key={s.name} aria-pressed={phase === i} onClick={() => setPhase(i)}><small>0{i + 1}</small>{s.name}</button>)}</div>
        <h2>{stages[phase].title}</h2><code>{stages[phase].formula}</code><p>{stages[phase].detail}</p>
        <div className="gpu-probe">
          <label>PROBE AN XOR INPUT<select value={probeIndex} onChange={event => setProbeIndex(Number(event.target.value))}>{SAMPLES.map((sample, i) => <option key={sample.name} value={i}>{sample.name} · target {sample.target}</option>)}</select></label>
          <div><span>NETWORK PREDICTION</span><strong>{fixed(probe.prediction)}</strong></div>
          <div><span>TRUE LABEL</span><strong>{probe.sample.target}</strong></div>
          <div><span>THIS SAMPLE'S LOSS</span><strong>{fixed(probe.sampleLoss)}</strong></div>
        </div>
        <div className="gpu-neuron-inspector"><span>SELECTED NEURON · {selectedNode}</span><strong>{nodeInfo}</strong><small>Tap any node in the 3D network. Probe selection does not change the training data order.</small></div>
      </article>
    </section>

    <section className="gpu-explain"><div><span className="gpu-eyebrow">03 / WHAT THE GPU WOULD DO AT SCALE</span><h2>Thousands of lanes.<br /><em>One chain rule.</em></h2><p>Real GPU training groups these operations into large tensor kernels. Many arithmetic lanes process different tensor elements in parallel; gradients from each batch are then combined before the optimizer changes weights.</p></div>
      <div className="gpu-explain-grid"><div><span>PARALLELISM</span><p>The illuminated floor tiles represent conceptual parallel work. Their pattern follows your batch setting, but it is not a real GPU occupancy map.</p></div><div><span>MEMORY</span><p>Parameters, gradients, activations and Adam moments occupy storage. The byte count shown here is an illustrative Float32 tensor subtotal. It excludes framework overhead, allocator padding and kernel workspaces.</p></div><div><span>THROUGHPUT</span><p>A larger batch offers more parallel work but requires more activation storage. This toy is CPU-powered JavaScript: it does not measure tokens/sec, FLOPS or GPU utilization.</p></div><div><span>REAL TRAINING</span><p>The network really performs forward propagation, binary cross-entropy, analytic backpropagation and SGD or Adam parameter updates. All results remain in your browser.</p></div></div></section>
    <footer className="gpu-footer"><span>Original interactive lab · Pure Exploration</span><span>*Illustrative hardware concepts, not GPU telemetry. No account or model download required.</span></footer>
    <CaptureControls project="gpu-training" title="Inside a training run · Pure Exploration" selector=".gpu-scene canvas" />
    <WorldDock current="gpu-training" pulse={pulse} onFavorite={id => { void favorite(id).catch(() => setFeedback('Favorites are temporarily unavailable.')); }} />
  </main>;
}

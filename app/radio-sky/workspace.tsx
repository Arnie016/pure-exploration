'use client';

import { lazy, Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Crosshair, RadioTower, SlidersHorizontal } from 'lucide-react';
import { angularScan, antennaStations, arrivalDelayNs, beamPower, residualPhaseRad, wavelengthMeters } from './physics';
import './radio-sky.css';

const RadioSkyScene = lazy(() => import('./scene'));

const deg = (v: number) => `${v.toFixed(0)}°`;
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

export default function RadioSkyLab() {
  const [baseline, setBaseline] = useState(24);
  const [frequency, setFrequency] = useState(150);
  const [sourceAz, setSourceAz] = useState(44);
  const [steerAz, setSteerAz] = useState(69);
  const [elevation, setElevation] = useState(35);
  const [showWavefronts, setShowWavefronts] = useState(true);

  const antennas = useMemo(() => antennaStations(baseline), [baseline]);
  const scan = useMemo(() => angularScan(antennas, frequency, sourceAz, elevation), [antennas, frequency, sourceAz, elevation]);
  const power = beamPower(antennas, frequency, sourceAz, steerAz, elevation);
  const delay = arrivalDelayNs(antennas[0], antennas[1], sourceAz, elevation);
  const lambda = wavelengthMeters(frequency);
  const resolutionScaleDeg = (lambda / baseline) * 180 / Math.PI;
  const path = scan.map((item, i) => `${i ? 'L' : 'M'}${item.azimuth * 4} ${(180 - item.power * 153).toFixed(2)}`).join(' ');
  const phasors = antennas.map(station => ({ id: station.id, phase: residualPhaseRad(station, frequency, sourceAz, steerAz, elevation) }));
  const scenario = power > 0.98 ? 'Coherent alignment' : power > 0.45 ? 'Partially combined' : 'Signals mostly cancel';

  return <main className="radio-sky-world">
    <header className="radio-sky-topbar">
      <Link href="/?walk=1" prefetch={false} className="radio-sky-back"><ArrowLeft size={15} /> Back to the garden</Link>
      <span className="radio-sky-kicker"><RadioTower size={14} /> PURE EXPLORATION / FIELD EXPERIMENT 016</span>
      <span className="radio-sky-status">LOCAL PHYSICS • NO LIVE RECEIVER</span>
    </header>
    <section className="radio-sky-heading" aria-labelledby="radio-sky-title">
      <div>
        <p className="radio-sky-eyebrow">THE INVISIBLE SKY / EXPERIMENT 01</p>
        <h1 id="radio-sky-title">Build a telescope <em>from distance.</em></h1>
        <p>One wave, four antennas, many arrival times. Move the receivers apart and digitally steer their signals. The sky changes even when the dishes stay still.</p>
      </div>
      <div className="radio-sky-head-stamp"><span>4</span><small>RECEIVERS<br/>ONE ARRAY</small></div>
    </section>
    <section className="radio-sky-grid">
      <div className="radio-sky-main">
        <div className="radio-sky-view-heading"><span>01 / ARRAY IN THREE DIMENSIONS</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
        <Suspense fallback={<div className="radio-sky-scene radio-sky-scene-loading">Preparing the array geometry…</div>}>
          <RadioSkyScene baseline={baseline} sourceAz={sourceAz} steerAz={steerAz} elevation={elevation} wavefronts={showWavefronts}/>
        </Suspense>
        <div className="radio-sky-under-scene">
          <span>Amber vector: true source · Cyan vector: electronic pointing</span>
          <label><input type="checkbox" checked={showWavefronts} onChange={event => setShowWavefronts(event.target.checked)}/> Show wavefront planes</label>
        </div>
        <div className="radio-sky-scan-heading"><span>02 / FIND THE SOURCE</span><span>COHERENT POWER, NORMALIZED TO 1</span></div>
        <div className="radio-sky-scan" role="group" aria-label="Beam response by steering angle">
          <svg viewBox="0 0 720 215" role="img" aria-label={`Coherent beam response over pointing angles zero to 180 degrees. True source direction ${sourceAz} degrees. Current pointing ${steerAz} degrees and normalized power ${power.toFixed(3)}.`}>
            <defs><linearGradient id="radio-sky-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#60dceb" stopOpacity=".27"/><stop offset="1" stopColor="#60dceb" stopOpacity="0"/></linearGradient></defs>
            {[0, .25, .5, .75, 1].map(value => <g key={value}><line x1="0" x2="720" y1={180 - value * 153} y2={180 - value * 153} className="radio-sky-grid-line"/><text x="4" y={173 - value * 153} className="radio-sky-plot-label">{value.toFixed(2)}</text></g>)}
            <path d={path + ' L720 180 L0 180 Z'} fill="url(#radio-sky-fill)"/>
            <path d={path} className="radio-sky-scan-line"/>
            <line x1={sourceAz * 4} x2={sourceAz * 4} y1="12" y2="180" className="radio-sky-source-mark"/>
            <line x1={steerAz * 4} x2={steerAz * 4} y1="12" y2="180" className="radio-sky-steer-mark"/>
            <circle cx={steerAz * 4} cy={180 - power * 153} r="5" className="radio-sky-steer-point"/>
            {[0, 45, 90, 135, 180].map(value => <text key={value} x={value * 4} y="207" textAnchor={value === 0 ? 'start' : value === 180 ? 'end' : 'middle'} className="radio-sky-plot-label">{value}°</text>)}
          </svg>
          <div className="radio-sky-scan-caption"><span><i className="source-dot"/> True source: {sourceAz}°</span><span><i className="steer-dot"/> Pointing: {steerAz}°</span></div>
        </div>
        <div className="radio-sky-explanation">
          <h2>What's happening?</h2>
          <p>The same wave reaches different antennas at slightly different times. A digital delay removes the expected timing offset for one chosen direction. When that direction matches the source, the four wave amplitudes add coherently. When it does not, their phases can cancel. Peaks elsewhere are <strong>ambiguities from this sparse array</strong>, not additional discovered sources.</p>
          <p className="radio-sky-caveat">Model boundary: far-field monochromatic plane waves, four ideal identical receivers and a fixed elevation. The plot shows a delay-and-sum array factor, not an interferometric sky image, measured flux or verified instrument sensitivity.</p>
        </div>
      </div>
      <aside className="radio-sky-console" aria-label="Radio telescope controls and readings">
        <div className="radio-sky-console-title"><SlidersHorizontal size={16}/> OBSERVATION DESK <span>LIVE MODEL</span></div>
        <div className="radio-sky-meter">
          <span>POWER AT CHOSEN DIRECTION</span>
          <strong>{(100 * power).toFixed(1)}<small>%</small></strong>
          <div className="radio-sky-meter-track"><div style={{width:`${power * 100}%`}}/></div>
          <p>{scenario}. This number measures phase coherence, not probability of detecting a source.</p>
        </div>
        <div className="radio-sky-controls">
          <h2>Change the experiment</h2>
          <label htmlFor="radio-sky-source">Source azimuth <output>{deg(sourceAz)}</output></label>
          <input id="radio-sky-source" type="range" min="0" max="180" step="1" value={sourceAz} onChange={e => setSourceAz(Number(e.target.value))}/>
          <label htmlFor="radio-sky-point">Digital pointing <output>{deg(steerAz)}</output></label>
          <input id="radio-sky-point" type="range" min="0" max="180" step="1" value={steerAz} onChange={e => setSteerAz(Number(e.target.value))}/>
          <button type="button" className="radio-sky-align" onClick={() => setSteerAz(sourceAz)}><Crosshair size={16}/> Align all four phases <ArrowRight size={15}/></button>
          <label htmlFor="radio-sky-baseline">Longest E–W / N–S baseline <output>{baseline} m</output></label>
          <input id="radio-sky-baseline" type="range" min="6" max="48" step="2" value={baseline} onChange={e => setBaseline(Number(e.target.value))}/>
          <label htmlFor="radio-sky-frequency">Frequency <output>{frequency} MHz</output></label>
          <input id="radio-sky-frequency" type="range" min="80" max="400" step="5" value={frequency} onChange={e => setFrequency(Number(e.target.value))}/>
          <label htmlFor="radio-sky-elevation">Elevation <output>{deg(elevation)}</output></label>
          <input id="radio-sky-elevation" type="range" min="10" max="80" step="5" value={elevation} onChange={e => setElevation(Number(e.target.value))}/>
        </div>
        <div className="radio-sky-readings" aria-label="Derived radio quantities">
          <div><span>WAVELENGTH</span><strong>{lambda.toFixed(2)} m</strong></div>
          <div><span>A → B ARRIVAL DIFFERENCE</span><strong>{signed(delay)} ns</strong></div>
          <div><span>λ / B ANGULAR SCALE</span><strong>{resolutionScaleDeg.toFixed(1)}°</strong></div>
        </div>
        <div className="radio-sky-phasors">
          <div className="radio-sky-section-label">03 / SIGNALS AFTER STEERING</div>
          <svg viewBox="0 0 280 108" role="img" aria-label="Four signal phasor arrows showing their phase after digital steering. Aligned arrows give maximum coherence.">
            {phasors.map((p,i) => {
              const cx = 35 + i * 70, cy = 44;
              return <g key={p.id}>
                <circle cx={cx} cy={cy} r="23" fill="none" stroke="#345163" strokeWidth="1"/>
                <line x1={cx - 25} y1={cy} x2={cx + 25} y2={cy} stroke="#2d4557" strokeWidth="1"/>
                <line x1={cx} y1={cy - 25} x2={cx} y2={cy + 25} stroke="#2d4557" strokeWidth="1"/>
                <line x1={cx} y1={cy} x2={cx + Math.cos(p.phase) * 21} y2={cy - Math.sin(p.phase) * 21} stroke="#91e0e6" strokeWidth="3" strokeLinecap="round"/>
                <circle cx={cx + Math.cos(p.phase) * 21} cy={cy - Math.sin(p.phase) * 21} r="3" fill="#ffd08c"/>
                <text x={cx} y="92" textAnchor="middle" className="radio-sky-plot-label">{p.id}</text>
              </g>;
            })}
          </svg>
          <p>These arrows represent electric-field phase after steering. The stronger their alignment, the higher the coherent sum.</p>
        </div>
        <div className="radio-sky-challenge">
          <strong>FIELD CHALLENGE</strong>
          <p>Align the source, then double the baseline. Does the central peak become narrower? Why do extra peaks remain?</p>
        </div>
      </aside>
    </section>
    <footer className="radio-sky-footer">
      <span>MODEL: IDEAL PLANE WAVES / FOUR-ANTENNA DELAY-AND-SUM / NO HARDWARE DATA</span>
      <a href="https://www.almaobservatory.org/en/about-alma/how-alma-works/technologies/interferometry/" target="_blank" rel="noreferrer">Learn how real interferometers work ↗</a>
    </footer>
  </main>;
}

'use client';
import {useMemo,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Pause,Play,RotateCcw,SlidersHorizontal} from 'lucide-react';
import NeutrinoScene from './neutrino-scene';
import {COLORS,FLAVORS,MIXING,probabilities,sampleProbabilities,type Flavor} from './physics';
import {WorldDock} from '../components/world-dock';
import {track,usePulse} from '../activity';
import './neutrino.css';
const MAX_KM=1600;
type Settings={initial:Flavor;energyGeV:number;baselineKm:number;deltaDeg:number;antineutrino:boolean};
const DEFAULT:Settings={initial:1,energyGeV:2.5,baselineKm:1300,deltaDeg:MIXING.defaultDelta,antineutrino:false};
const PRESETS=[{name:'Short baseline',energyGeV:.6,baselineKm:295},{name:'Medium baseline',energyGeV:2,baselineKm:810},{name:'Long baseline',energyGeV:2.5,baselineKm:1300}];
function Control({label,value,min,max,step=1,unit,change}:{label:string;value:number;min:number;max:number;step?:number;unit:string;change:(n:number)=>void}){
 const id='nu-'+label.toLowerCase().replace(/[^a-z]+/g,'-');
 return <label className="nu-slider" htmlFor={id}><span>{label}<output htmlFor={id}>{Number.isInteger(value)?value:value.toFixed(1)} <small>{unit}</small></output></span><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e=>change(Number(e.currentTarget.value))}/></label>;
}
function ProbabilityChart({samples,baselineKm}:{samples:ReturnType<typeof sampleProbabilities>;baselineKm:number}){
 const left=33,top=19,width=702,height=150;
 const points=(f:number)=>samples.map(s=>(left+s.km/MAX_KM*width).toFixed(2)+','+(top+(1-s.p[f])*height).toFixed(2)).join(' ');
 const cursor=left+baselineKm/MAX_KM*width;
 return <div className="nu-chart"><div className="nu-chart-heading"><span>FLAVOUR PROBABILITY ALONG THE FLIGHT</span><span>0–1,600 KM · VACUUM</span></div><svg viewBox="0 0 780 220" role="img" aria-label="Three calculated probability curves over distance. Golden electron, blue muon and violet tau. Current detector distance is marked with a dashed vertical line.">
  {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={left} x2={left+width} y1={top+(1-v)*height} y2={top+(1-v)*height} stroke="#6d8ba0" opacity=".2"/><text x="24" y={top+(1-v)*height+3} textAnchor="end" fill="#a8bdcb" fontSize="10">{v.toFixed(v===0||v===1?0:2)}</text></g>)}
  {[0,400,800,1200,1600].map(k=><text key={k} x={left+k/MAX_KM*width} y="198" textAnchor="middle" fill="#8fa8bb" fontSize="11">{k}</text>)}
  {[0,1,2].map(f=><polyline key={f} points={points(f)} stroke={COLORS[f]} strokeWidth="2.8" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}
  <line x1={cursor} x2={cursor} y1={top} y2={top+height} stroke="#f6f5e7" strokeWidth="1.5" strokeDasharray="5 5"/>
  <text x={Math.min(cursor+7,700)} y="12" fill="#fff4e2" fontSize="11">Detector</text>
  <text x="742" y="213" textAnchor="end" fill="#8fa8bb" fontSize="11">km</text>
 </svg><div className="nu-legend">{FLAVORS.map((flavor,i)=><span key={flavor}><i style={{background:COLORS[i]}}/>{flavor}</span>)}</div></div>;
}
export default function NeutrinoWorld(){
 const [settings,setSettings]=useState<Settings>(DEFAULT),[running,setRunning]=useState(true),[notes,setNotes]=useState(false);
 const {pulse,favorite}=usePulse('neutrino');const touched=useRef(false);
 const change=(patch:Partial<Settings>)=>{setSettings(current=>({...current,...patch}));if(!touched.current){track('first_interaction','neutrino');touched.current=true;}};
 const input=useMemo(()=>({initial:settings.initial,energyGeV:settings.energyGeV,deltaDeg:settings.deltaDeg,antineutrino:settings.antineutrino}),[settings.initial,settings.energyGeV,settings.deltaDeg,settings.antineutrino]);
 const samples=useMemo(()=>sampleProbabilities(input,MAX_KM,160),[input]);
 const p=useMemo(()=>probabilities({...input,baselineKm:settings.baselineKm}),[input,settings.baselineKm]);
 const mode=settings.antineutrino?'antineutrino':'neutrino';
 return <main className="nu-world"><a href="#nu-controls" className="nu-skip">Skip to experiment controls</a>
  <header className="nu-top"><a href="/?walk=1" className="nu-brand"><ArrowLeft size={17}/> PURE EXPLORATION</a><span>WORLD 016 / THE PARTICLE ATLAS</span><span className="nu-top-tag">THREE-FLAVOUR PHYSICS · VACUUM</span></header>
  <div className="nu-layout"><section className="nu-view"><div className="nu-intro"><p className="nu-eyebrow">FIELD NOTES / 01 <span>·</span> NEUTRINO OSCILLATIONS</p><h1>A particle,<br/><em>three identities.</em></h1><p>Send a neutrino across a landscape. Its mass states drift out of phase, changing which flavour a distant detector might observe.</p></div>
   <NeutrinoScene points={samples} baselineKm={settings.baselineKm} running={running}/>
   <div className="nu-scene-actions"><button onClick={()=>setRunning(v=>!v)} aria-pressed={running}>{running?<Pause size={15}/>:<Play size={15}/>} {running?'Pause flight':'Animate flight'}</button><span>Coloured trajectories show the calculated probability for each flavour. Height is probability, not physical displacement.</span></div>
  </section>
  <aside className="nu-console" id="nu-controls"><div className="nu-console-head"><span><SlidersHorizontal size={15}/> EXPERIMENT CONTROLS</span><button aria-label="Reset neutrino experiment" onClick={()=>{change(DEFAULT);setRunning(true);}}><RotateCcw size={15}/></button></div>
   <div className="nu-control-block"><span className="nu-label">1 / CHOOSE THE FLAVOUR AT THE SOURCE</span><div className="nu-segment" role="group" aria-label="Initial neutrino flavour">{FLAVORS.map((name,i)=><button key={name} onClick={()=>change({initial:i as Flavor})} aria-pressed={settings.initial===i}>{name}</button>)}</div>
    <p className="nu-control-hint">Source: a pure {FLAVORS[settings.initial].toLowerCase()} {mode}. Measurement: a probability, not a predetermined transition.</p></div>
   <div className="nu-control-block"><span className="nu-label">2 / MOVE THE DETECTOR & SET THE ENERGY</span><Control label="Distance" value={settings.baselineKm} min={0} max={MAX_KM} step={5} unit="km" change={baselineKm=>change({baselineKm})}/><Control label="Energy" value={settings.energyGeV} min={.4} max={8} step={.1} unit="GeV" change={energyGeV=>change({energyGeV})}/><div className="nu-presets">{PRESETS.map(pr=><button key={pr.name} onClick={()=>change(pr)}>{pr.name}</button>)}</div><p className="nu-control-hint">Presets use illustrative baselines, not calibrated predictions for real detectors in Earth matter.</p></div>
   <div className="nu-control-block"><span className="nu-label">3 / TEST THE CP PHASE</span><Control label="CP phase" value={settings.deltaDeg} min={0} max={360} step={.1} unit="degrees" change={deltaDeg=>change({deltaDeg})}/><label className="nu-toggle"><input type="checkbox" checked={settings.antineutrino} onChange={e=>change({antineutrino:e.currentTarget.checked})}/><span>Use antineutrinos</span><small>Complex-conjugates the mixing matrix</small></label><p className="nu-control-hint">Compare the blue and gold readouts with antineutrinos. Differences are a vacuum CP effect; material interactions are excluded.</p></div>
  </aside></div>
  <section className="nu-analysis"><div className="nu-summary"><div><p className="nu-eyebrow">DETECTOR READING <span>·</span> {settings.baselineKm.toLocaleString('en-US')} KM</p><h2>What might arrive?</h2><p>For many identical neutrinos, these probabilities predict the relative flavour outcomes. A single detection produces one flavour.</p></div><div className="nu-probabilities">{FLAVORS.map((name,i)=><div key={name} className="nu-probability" style={{borderColor:COLORS[i]}}><span>{name}</span><strong>{(100*p[i]).toFixed(1)}%</strong><div className="nu-bar"><i style={{background:COLORS[i],width:Math.max(0,Math.min(100,100*p[i]))+'%'}}/></div></div>)}</div></div>
   <ProbabilityChart samples={samples} baselineKm={settings.baselineKm}/>
   <section className="nu-debrief"><div><p className="nu-eyebrow">WHY THE FLAVOUR CHANGES</p><h2>Mass travels.<br/><em>Flavour interferes.</em></h2></div><div><p>Each flavour is a coherent mixture of three mass states. The states acquire different quantum phases while travelling, so the amplitudes for electron, muon and tau detection interfere differently at each distance.</p><div className="nu-equation" aria-label="Transition amplitude equals the sum over mass eigenstates of U beta i times U alpha i conjugate times the phase factor">A<sub>α→β</sub> = Σ<sub>i</sub> U<sub>βi</sub> U<sup>*</sup><sub>αi</sub> e<sup>−i m²<sub>i</sub>L / 2E</sup></div><p>The displayed probabilities are the squared magnitudes of those amplitudes. Only mass-squared differences matter. There is no flavour-changing interaction required along the flight.</p><button className="nu-notes-toggle" aria-expanded={notes} onClick={()=>setNotes(v=>!v)}><BookOpen size={16}/> {notes?'Hide scientific assumptions':'Read scientific assumptions'}</button>
    {notes&&<div className="nu-notes"><p><strong>Model:</strong> exact unitary three-flavour vacuum oscillation, normal mass ordering and coherent propagation. No matter potential, wave-packet separation, finite energy resolution, detector cross sections or experimental uncertainty.</p><p><strong>Parameters:</strong> sin²θ₁₂ = {MIXING.sin2theta12}, sin²θ₁₃ = {MIXING.sin2theta13}, sin²θ₂₃ = {MIXING.sin2theta23}, Δm²₂₁ = {MIXING.dm21} eV² and Δm²₃₁ = {MIXING.dm31.toFixed(7)} eV². They are illustrative rounded values from preliminary <a href="https://global-nu.org/" target="_blank" rel="noreferrer">Bari 2026.a</a>, not a current-fit claim about any particular experiment. CP phase defaults to 1.19π.</p><p><strong>Visual encoding:</strong> the 3D lanes, vertical displacement and animated light particles represent computed probabilities. They do not depict neutrino trajectories, literal wavelength or a measured detector count. The values in the detector cards and graph come from the same numerical model.</p><p><strong>Explore:</strong> At 0 km the source flavour is certain. Scale energy and distance together to keep L/E unchanged. Switch particle ↔ antiparticle at CP phase 0°; the probabilities should agree. These are testable properties of the equations.</p></div>}
   </div></section>
  </section><footer className="nu-footer">An original interactive physics experiment for Pure Exploration. <a href="https://global-nu.org/" target="_blank" rel="noreferrer">Parameter provenance</a> · <a href="/?walk=1">Back to the garden</a></footer>
  <WorldDock current="neutrino" pulse={pulse} onFavorite={id=>{void favorite(id).catch(()=>{});}}/>
 </main>;
}

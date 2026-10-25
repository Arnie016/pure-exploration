'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Pause,Play,RotateCcw,Radio,Waves} from 'lucide-react';
import ObservatoryScene from './scene';
import {CHIRP_SECONDS,TOTAL_SECONDS,DEFAULT_SETTINGS,instantaneousFrequency,instrumentAt,sampleTrace} from './model.js';
import {WorldDock} from '../components/world-dock';
import {usePulse,track} from '../activity';
import './style.css';

function Slider({name,value,onChange,min,max,step,unit,detail}:{
 name:string;value:number;onChange:(n:number)=>void;min:number;max:number;step:number;unit:string;detail:string;
}){
 return <label className="gw-slider"><span><strong>{name}</strong><output>{value.toLocaleString('en-US',{maximumFractionDigits:2})} {unit}</output></span>
  <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/>
  <small>{detail}</small></label>;
}
type Trace=ReturnType<typeof sampleTrace>;
function Waveform({trace,time,onSeek}:{trace:Trace;time:number;onSeek:(t:number)=>void}){
 const WIDTH=728,HEIGHT=228,TOP=17,BOTTOM=207;
 const x=(t:number)=>t/TOTAL_SECONDS*WIDTH;
 const y=(v:number)=>(TOP+BOTTOM)/2-Math.max(-1.4,Math.min(1.4,v))*(BOTTOM-TOP)/2.8;
 const line=(field:'observed'|'ideal')=>trace.points.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(2)+','+y(p[field]).toFixed(2)).join(' ');
 return <div className="gw-chart">
  <div className="gw-chart-head"><div><span className="gw-eyebrow">SIGNAL ANALYSIS / SLOWED PLAYBACK</span><h3>Find the chirp.</h3></div>
   <div className="gw-chart-legend"><span><i className="gw-observed"/>readout + noise</span><span><i className="gw-template"/>known waveform</span></div>
  </div>
  <svg viewBox={'0 0 '+WIDTH+' '+HEIGHT} role="img" aria-label="Signal waveform with a known chirp template overlaid on a deterministic noisy readout. Use the time slider to move the cursor.">
   <rect width={WIDTH} height={HEIGHT} fill="#0c2029" rx="6"/>
   {[.25,.5,.75].map(a=><line key={a} x1="0" y1={TOP+(BOTTOM-TOP)*a} x2={WIDTH} y2={TOP+(BOTTOM-TOP)*a} stroke="#34535b" strokeDasharray="4 7" strokeWidth="1"/>)}
   {[0,1,2,TOTAL_SECONDS].map(t=><g key={t}><line x1={x(t)} x2={x(t)} y1={TOP} y2={BOTTOM} stroke="#294a54" strokeWidth="1"/><text x={Math.max(10,Math.min(WIDTH-22,x(t)))} y="222" fill="#819ca3" fontSize="12">{t.toFixed(t===TOTAL_SECONDS?2:0)} s</text></g>)}
   <path d={line('ideal')} stroke="#eabd83" strokeWidth="1.8" opacity=".95" fill="none"/>
   <path d={line('observed')} stroke="#74dfd7" strokeWidth="1.55" opacity=".83" fill="none"/>
   <line x1={x(time)} x2={x(time)} y1={TOP} y2={BOTTOM} stroke="#f5f4e7" strokeWidth="1.2"/>
   <circle cx={x(time)} cy={y(trace.points[Math.min(trace.points.length-1,Math.max(0,Math.round(time/TOTAL_SECONDS*(trace.points.length-1))))].observed)} r="4" fill="#f5f4e7" stroke="#1b3e49" strokeWidth="1.5"/>
  </svg>
  <label className="gw-scrub">SAMPLE TIME <strong>{time.toFixed(3)} s</strong>
   <input type="range" value={time} min="0" max={TOTAL_SECONDS} step=".005" onChange={e=>onSeek(Number(e.target.value))} aria-label="Scrub waveform playback time"/>
  </label>
  <div className="gw-correlation"><strong>{Math.round(trace.alignment*100)}%</strong><p><b>Template alignment</b><br/>Cosine similarity between the ideal amplified waveform and the noisy readout. This is not a probability of a gravitational-wave detection or a calibrated signal-to-noise ratio.</p></div>
 </div>;
}
function Meter({label,value,sub}:{label:string;value:string;sub:string}){
 return <div className="gw-meter"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
const presets=[
 {title:'A faint ripple',description:'A weak strain buried under an illustrative noise floor.',peak:0.2,arm:4000,light:1064,gain:1e10,noise:.55},
 {title:'Hear the chirp',description:'Amplify the demonstration readout to find the sweep.',peak:1.4,arm:4000,light:1064,gain:3e10,noise:.17},
 {title:'Short-arm detector',description:'Keep the wave, shrink both arms and compare the phase.',peak:1.4,arm:250,light:1064,gain:3e10,noise:.17},
 {title:'Shorter wavelength',description:'Same wave and arms, but a different laser wavelength.',peak:1.4,arm:4000,light:532,gain:3e10,noise:.17}
] as const;

export default function GravitationalWaveObservatory(){
 const[peak,setPeak]=useState(1.2),[arm,setArm]=useState(4000),[light,setLight]=useState(1064);
 const[gain,setGain]=useState(1e10),[noise,setNoise]=useState(.22),[hasWave,setHasWave]=useState(true);
 const[time,setTime]=useState(.76),[playing,setPlaying]=useState(false),[notes,setNotes]=useState(false);
 const{pulse,favorite}=usePulse('gravity-waves');
 const settings=useMemo(()=>({...DEFAULT_SETTINGS,peakStrain:hasWave?peak*1e-21:0,armLengthM:arm,
  wavelengthNm:light,displayGain:gain,noiseLevel:noise}),[peak,arm,light,gain,noise,hasWave]);
 const current=useMemo(()=>instrumentAt(time,settings),[time,settings]);
 const trace=useMemo(()=>sampleTrace(settings,240),[settings]);
 useEffect(()=>{
  if(!playing)return;
  const id=setInterval(()=>{
   if(!document.hidden)setTime(t=>{
    const next=t+.008;
    return next>=TOTAL_SECONDS?0:next;
   });
  },50);
  return()=>clearInterval(id);
 },[playing]);
 useEffect(()=>{
  const query=window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{if(query.matches)setPlaying(false);};
  stop();query.addEventListener('change',stop);
  return()=>query.removeEventListener('change',stop);
 },[]);
 function interact(){track('first_interaction','gravity-waves');}
 function load(p:typeof presets[number]){
  setPeak(p.peak);setArm(p.arm);setLight(p.light);setGain(p.gain);setNoise(p.noise);
  setHasWave(true);setTime(.76);setPlaying(false);interact();
 }
 function change(fn:(n:number)=>void,value:number){fn(value);interact();}
 const snapshot={strain:current.strain,timeSeconds:time,displayQuadrature:current.displayQuadrature,playing};
 const physical= current.physicalPhaseRad;
 return <main className="gw-page">
  <a className="skip-link" href="#gw-controls">Skip to gravitational-wave controls</a>
  <div className="gw-shell">
   <header className="gw-header"><div><span className="gw-eyebrow"><Waves size={15}/> PURE EXPLORATION / SPACETIME / WORLD EXPERIMENT</span>
    <h1>Listen to <em>spacetime.</em></h1>
    <p>Two perpendicular corridors of light. One nearly imperceptible stretch of space. Become the operator of a laser interferometer and discover how astronomers listen for distant collisions.</p>
   </div><span className="gw-stamp">INVISIBLE STRAIN.<br/>VISIBLE EVIDENCE.<br/>EVERY NUMBER EXPLAINED.</span></header>
   <section className="gw-main" aria-label="Interactive gravitational wave observatory">
    <div className="gw-stage">
     <div className="gw-stage-top"><span><i/> CONCEPTUAL MICHELSON INTERFEROMETER</span><span>ARM LENGTHS SHOWN COMPRESSED</span></div>
     <ObservatoryScene snapshot={snapshot}/>
     <div className="gw-stage-bottom"><span>LASER → BEAM SPLITTER → TWO ARMS → RECOMBINATION</span><span>DRAG TO INSPECT</span></div>
    </div>
    <aside className="gw-controls" id="gw-controls">
     <span className="gw-eyebrow"><Radio size={14}/> LIVE EXPERIMENT SETTINGS</span><h2>Stretch the rules.</h2>
     <div className="gw-run"><button className="gw-play" onClick={()=>{setPlaying(!playing);interact();}} aria-pressed={playing}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause experiment':'Play the chirp'}</button>
      <button aria-label="Restart chirp from the beginning" onClick={()=>{setTime(0);setPlaying(false);}}><RotateCcw size={16}/></button></div>
     <Slider name="Peak spacetime strain" value={peak} min={0.1} max={5} step={.1} unit="× 10⁻²¹" detail="Peak dimensionless strain of the invented signal." onChange={n=>change(setPeak,n)}/>
     <Slider name="Interferometer arm" value={arm} min={250} max={4000} step={250} unit="m" detail="Equal nominal arm lengths, each physically scaled." onChange={n=>change(setArm,n)}/>
     <label className="gw-select">LASER WAVELENGTH <select value={light} onChange={e=>change(setLight,Number(e.target.value))}>
      <option value={1064}>1,064 nm / infrared</option><option value={532}>532 nm / green</option>
     </select><small>Shorter wavelengths produce a larger phase shift for identical motion.</small></label>
     <label className="gw-select">DISPLAY-ONLY PHASE MAGNIFICATION
      <select value={gain} onChange={e=>change(setGain,Number(e.target.value))}>
       <option value={1e10}>10 billion ×</option><option value={3e10}>30 billion ×</option><option value={1e11}>100 billion ×</option>
      </select><small>Changes only the teaching monitor, never the physical detector reading.</small></label>
     <Slider name="Illustrative noise floor" value={noise} min={0} max={.85} step={.05} unit="relative" detail="Reproducible synthetic noise. Not real seismic, thermal or quantum noise." onChange={n=>change(setNoise,n)}/>
     <label className="gw-toggle"><input type="checkbox" checked={hasWave} onChange={e=>{setHasWave(e.target.checked);interact();}}/>Inject gravitational wave <span>{hasWave?'ON':'OFF'}</span></label>
    </aside>
   </section>
   <section className="gw-readings" aria-label="Physical calculations">
    <div className="gw-readings-header"><span className="gw-eyebrow">WHAT THE DEVICE WOULD MEASURE</span><p>Real equation outputs from an idealized single-round-trip interferometer. Neither the signal nor the chart comes from real equipment.</p></div>
    <div className="gw-meter-grid">
     <Meter label="INSTANTANEOUS STRAIN h" value={(current.strain/1e-21).toFixed(3)+' × 10⁻²¹'} sub="Fractional difference, not metres"/>
     <Meter label="DIFFERENTIAL ARM LENGTH" value={(current.differentialMetres/1e-18).toFixed(3)+' am'} sub="Attometres; 1 am = 10⁻¹⁸ m"/>
     <Meter label="ROUND-TRIP PHASE SHIFT" value={(physical/1e-11).toFixed(3)+' × 10⁻¹¹ rad'} sub="Computed before visualization gain"/>
     <Meter label="LIGHT ROUND TRIP" value={(current.roundTripSeconds*1e6).toFixed(2)+' μs'} sub="Laser path 2L / speed of light"/>
    </div>
    <div className="gw-formula"><span>BEHIND THE INTERFERENCE</span><strong>ΔL = hL &nbsp; · &nbsp; Δφ = 4πΔL / λ</strong><p>For an optimally aligned plus-polarized wave, one arm stretches as the other contracts. In this ideal, equal-arm one-bounce model, the returning beams acquire a relative phase. The dark-port intensity fraction is sin²(Δφ/2), approximately {current.darkPortFraction.toExponential(2)} at the current sample. The bright glow and moving mirrors are deliberately exaggerated.</p></div>
   </section>
   <section className="gw-bottom">
    <Waveform trace={trace} time={time} onSeek={t=>{setTime(t);setPlaying(false);interact();}}/>
    <div className="gw-questions"><span className="gw-eyebrow">A SCIENTIST'S PLAYGROUND</span><h2>Change one thing.<br/><em>Watch what survives.</em></h2>
     <p>Each experiment preserves or alters a specific physical quantity. See whether the phase scales as the equation predicts.</p>
     <div className="gw-presets">{presets.map(p=><button key={p.title} onClick={()=>load(p)}><span>LOAD EXPERIMENT <ArrowRight size={13}/></span><strong>{p.title}</strong><small>{p.description}</small></button>)}</div>
     <div className="gw-tip"><strong>CURRENT SWEEP</strong><span>{instantaneousFrequency(time).toFixed(1)} Hz <small>invented chirp frequency</small></span><p>Playback is deliberately slowed. Optical travel is represented symbolically rather than simulated at light speed. The chart uses physical sample times.</p></div>
    </div>
   </section>
   <div className="gw-notes"><button aria-expanded={notes} onClick={()=>setNotes(!notes)}><BookOpen size={17}/>{notes?'Close field notes':'What is real and what is invented?'}<ArrowRight size={16}/></button>
    {notes&&<div className="gw-notes-body"><p><b>Real physics:</b> The tiny arm-length difference, round-trip phase and ideal dark-port intensity are calculated directly from the gravitational-wave strain, arm length and wavelength. A longer arm gives a proportionally larger phase response in this simplified model.</p>
     <p><b>Teaching visuals:</b> The detector arms are compressed to a few 3D units, mirror motion is magnified by roughly 10¹⁹, and photon flight is slowed. The plot uses a signed quadrature monitor with an artificial gain: it is not actual dark-port power, detector noise, a realistic Fabry–Perot cavity response or a calibrated strain measurement.</p>
     <p><b>Waveform:</b> A hand-designed chirp sweeps from 24 to 160 Hz with a short damped tail. It is not a general-relativity binary-merger solution, a real catalog event or astrophysical parameter estimation. The noisy readout uses a deterministic seeded pattern, and template alignment is cosine similarity, not detection confidence.</p>
     <p>Explore the model source and reproducible tests in the <a href="https://github.com/Arnie016/pure-exploration/tree/feat/gravitational-wave-observatory-20261025" target="_blank" rel="noreferrer">open repository branch</a>. Nothing here transmits measurements or uses a paid API.</p>
    </div>}</div>
   <p className="gw-disclaimer">Educational, local-first model. Based on the idealized long-wavelength Michelson approximation. Not an operating gravitational-wave observatory, LIGO data product, calibrated detector or alert system. <span>Chart cursor: {time.toFixed(2)} s / {CHIRP_SECONDS} s inspiral + ringdown.</span></p>
  </div><WorldDock current="gravity-waves" pulse={pulse} onFavorite={favorite}/>
 </main>;
}

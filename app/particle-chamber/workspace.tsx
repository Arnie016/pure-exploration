'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Atom,BookOpen,Pause,Play,RotateCcw,Shuffle} from 'lucide-react';
import {collision,detectorRadii,species} from './model.js';
import ChamberScene from './scene';
import {WorldDock} from '../components/world-dock';
import {usePulse,track} from '../activity';
import './style.css';

const kinds=['electron','muon','pion','proton'] as const;
type Kind=(typeof kinds)[number];
type Preset={name:string;kind:Kind;energy:number;field:number;elevation:number;description:string};
const presets:Preset[]=[
 {name:'Muon arcs',kind:'muon',energy:3,field:1.6,elevation:18,description:'A clean pair leaving both inner and outer sensors.'},
 {name:'Tight spirals',kind:'pion',energy:.85,field:3.6,elevation:8,description:'A strong field wraps low-momentum particles inward.'},
 {name:'Missing protons',kind:'proton',energy:1.6,field:1.6,elevation:10,description:'Below the proton-antiproton creation threshold.'},
 {name:'High-energy tracks',kind:'electron',energy:8.5,field:.75,elevation:32,description:'High momentum makes near-straight trajectories.'}
];
function NumberSlider({label,value,onChange,min,max,step,unit,help}:{label:string;value:number;onChange:(n:number)=>void;min:number;max:number;step:number;unit:string;help:string}){
 return <label className="pc-slider"><span><strong>{label}</strong><output>{value.toFixed(step<1?1:0)} {unit}</output></span>
 <input type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/>
 <small>{help}</small></label>;
}
function TopView({data}:{data:ReturnType<typeof collision>}){
 const scale=32;
 return <div className="pc-topview"><div className="pc-topview-heading"><span>XY PROJECTION</span><small>top down • ±3.8 m</small></div>
 <svg viewBox="-128 -128 256 256" role="img" aria-label="XY cross-section showing the magnetic bending of oppositely charged tracks">
 <circle r="123" fill="#10232b" stroke="#66858d" strokeWidth="1" strokeDasharray="2 6"/>
 {detectorRadii.map((r:number)=><circle key={r} r={r*scale} fill="none" stroke="#4c717a" strokeWidth="1"/>)}
 {data.tracks.map(t=><g key={t.id}><polyline points={t.points.map(p=>(p.x*scale).toFixed(2)+','+(-p.y*scale).toFixed(2)).join(' ')} stroke={t.color} strokeWidth="2" fill="none" strokeLinecap="round"/>
 {t.hits.map((h,i)=><circle key={i} cx={h.x*scale} cy={-h.y*scale} r="3.5" fill={t.color} stroke="#092028" strokeWidth=".6"/>)}</g>)}
 <circle r="3.5" fill="#fff0c8"/></svg>
 <div className="pc-legend"><span><i className="pc-plus"/>positive charge</span><span><i className="pc-minus"/>negative charge</span></div></div>;
}
export default function CollisionChamber(){
 const[kind,setKind]=useState<Kind>('muon'),[energy,setEnergy]=useState(3),[field,setField]=useState(1.6),[elevation,setElevation]=useState(18),[seed,setSeed]=useState(0);
 const[progress,setProgress]=useState(1),[running,setRunning]=useState(false),[speed,setSpeed]=useState(1),[layers,setLayers]=useState(true),[notes,setNotes]=useState(false);
 const{pulse,favorite}=usePulse('particle-chamber');
 const data=useMemo(()=>collision({species:kind,sqrtS:energy,fieldTesla:field,elevationDeg:elevation,seed}),[kind,energy,field,elevation,seed]);
 const current=species[kind];
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>{if(!document.hidden)setProgress(p=>Math.min(1,p+.009*speed));},50);return()=>clearInterval(timer);},[running,speed]);
 useEffect(()=>{if(running&&progress>=1)setRunning(false);},[progress,running]);
 function changed(){setRunning(false);setProgress(1);track('first_interaction','particle-chamber');}
 function replay(){if(!data.available)return;if(running){setRunning(false);return;}if(progress>=1)setProgress(0);setRunning(true);track('first_interaction','particle-chamber');}
 function choose(p:Preset){setKind(p.kind);setEnergy(p.energy);setField(p.field);setElevation(p.elevation);changed();}
 function nextEvent(){setSeed(s=>s+1);setRunning(false);setProgress(1);track('first_interaction','particle-chamber');}
 return <main className="pc-page">
  <a className="skip-link" href="#pc-controls">Skip to particle experiment controls</a>
  <div className="pc-shell">
   <header className="pc-header"><div><span className="pc-eyebrow"><Atom size={15}/> PURE EXPLORATION / A PHYSICS EXPERIMENT / WORLD 016</span>
    <h1>The Collision <em>Chamber.</em></h1><p>What if you could watch the invisible? Fire two charged particles out of an imagined collision. Change their energy, bend their paths and read the tracks they leave.</p></div>
    <span className="pc-stamp">THE MAGNET DOES NOT<br/>ADD ENERGY. IT CHANGES<br/>DIRECTION.</span></header>
   <section className="pc-main" aria-label="Interactive detector experiment">
    <div className="pc-stage"><div className="pc-stage-top"><span><i/> IDEAL SOLENOIDAL DETECTOR</span><span>FIELD +Y (UP) • CONCEPTUAL GEOMETRY</span></div>
     <ChamberScene data={data} progress={progress} layers={layers}/>
     {!data.available&&<div className="pc-threshold" role="status"><span>NOT ENOUGH ENERGY</span><strong>No pair can form.</strong><p>This simplified reaction needs at least {data.thresholdGeV.toFixed(3)} GeV for {current.name.toLowerCase()}. Raise the collision energy and watch the tracks appear.</p></div>}
     <div className="pc-stage-bottom"><span>2 CHARGED PARTICLES · ONE VERTEX</span><span>{data.available?data.tracks.reduce((n,t)=>n+t.hits.length,0)+' RECORDED LAYER CROSSINGS':'NO TRACKS'}</span></div>
    </div>
    <aside className="pc-panel" id="pc-controls"><span className="pc-section-label">YOUR EXPERIMENT</span><h2>Make a collision.</h2>
     <label className="pc-select-label">WHAT APPEARS?
       <select value={kind} onChange={e=>{setKind(e.target.value as Kind);changed();}}>{kinds.map(k=><option value={k} key={k}>{species[k].name}</option>)}</select>
     </label>
     <p className="pc-species-detail">{current.description}</p>
     <NumberSlider label="Collision energy √s" unit="GeV" value={energy} min={.4} max={10} step={.1} onChange={n=>{setEnergy(n);changed();}} help="Total energy available for both outgoing particles."/>
     <NumberSlider label="Magnetic field" unit="T" value={field} min={.25} max={4} step={.05} onChange={n=>{setField(n);changed();}} help="More tesla means tighter curvature for the same momentum."/>
     <NumberSlider label="Angle from detector plane" unit="°" value={elevation} min={0} max={65} step={1} onChange={n=>{setElevation(n);changed();}} help="Steeper tracks exit the detector's end before crossing the outer layers."/>
     <label className="pc-layer-toggle"><input type="checkbox" checked={layers} onChange={e=>setLayers(e.target.checked)}/>Show detector layers <span>3 radial layers</span></label>
     <div className="pc-buttons"><button className="pc-primary" disabled={!data.available} onClick={replay}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'Pause tracks':progress>=1?'Replay collision':'Continue tracks'}</button>
      <button onClick={nextEvent} title="Rotate the collision axis and preserve the collision energy"><Shuffle size={16}/>New angle</button>
      <button onClick={()=>{setProgress(1);setRunning(false);}} aria-label="Reveal complete particle trajectories"><RotateCcw size={15}/></button></div>
     <div className="pc-progress"><label htmlFor="pc-timeline">Track playback <output>{Math.round(progress*100)}%</output></label><input id="pc-timeline" type="range" min="0" max="1" step=".01" value={progress} onChange={e=>{setRunning(false);setProgress(Number(e.target.value));}}/><div role="group" aria-label="Playback speed">{[.5,1,2].map(s=><button key={s} aria-pressed={speed===s} onClick={()=>setSpeed(s)}>{s}×</button>)}</div></div>
    </aside>
   </section>
   <section className="pc-lower"><div className="pc-data"><span className="pc-section-label">WHAT THE TRACKS TELL YOU</span><div className="pc-readings">
     <div><span>PAIR THRESHOLD</span><strong>{data.thresholdGeV.toFixed(3)} <small>GeV</small></strong><p>Minimum energy to make this particle-antiparticle pair.</p></div>
     <div><span>EACH PARTICLE'S MOMENTUM</span><strong>{data.available?data.momentumGeV.toFixed(3):'—'} <small>GeV/c</small></strong><p>Computed from relativistic energy and rest mass.</p></div>
     <div><span>TRANSVERSE CURVATURE RADIUS</span><strong>{data.available?data.radiusM.toFixed(2):'—'} <small>m</small></strong><p>Smaller radius means a more sharply bent track.</p></div>
     <div><span>LAYER CROSSINGS</span><strong>{data.tracks.reduce((n,t)=>n+t.hits.length,0)} <small>of 6 possible</small></strong><p>First idealized intercept at each of three cylindrical layers.</p></div>
    </div><div className="pc-equation"><span>TRY TO BREAK THE RULE</span><strong>p<sub>T</sub> = 0.299792458 · |q| · B · r</strong><p>Transverse momentum in GeV/c, field in tesla, radius in metres, charge in elementary-charge units. Double the field without changing momentum. What happens to the radius?</p></div></div>
    <TopView data={data}/></section>
   <section className="pc-explore"><div className="pc-explore-head"><span className="pc-section-label">QUICK EXPERIMENTS</span><h2>Different particles. Different stories.</h2><p>All examples are idealized two-body particle-antiparticle production at rest in the centre-of-mass frame.</p></div><div className="pc-presets">{presets.map(p=><button key={p.name} onClick={()=>choose(p)}><span>LOAD EXPERIMENT <ArrowRight size={14}/></span><strong>{p.name}</strong><small>{p.description}</small></button>)}</div></section>
   <section className="pc-notes"><button aria-expanded={notes} onClick={()=>setNotes(!notes)}><BookOpen size={17}/>{notes?'Hide field notes':'What is actually being simulated?'}<ArrowRight size={15}/></button>
    {notes&&<div className="pc-notes-copy"><p><strong>The calculation is real, the detector is illustrative.</strong> Every track is sampled from the magnetic Lorentz-force solution for a charged particle in a uniform solenoid. Each pair has equal rest mass, equal energy and exactly opposite initial momentum.</p><p>We compute p = √(E² − m²), using units with c = 1, then derive the radius from the transverse momentum. Changing the azimuth rotates the same event. A charged track is curved, but the field does no work, so momentum magnitude stays constant.</p><p>The cylinders represent ideal measurement layers. Markers are geometric intersections, not simulated ionization or photodetector signals. No material interactions, particle decay, energy loss, backgrounds, reconstruction uncertainty or realistic event distributions are modeled. The geometry, colors and particle motion are teaching aids.</p><p>Read the <a href="https://github.com/Arnie016/pure-exploration/blob/main/docs/collision-chamber.md" target="_blank" rel="noreferrer">model notes and equations</a> after this branch is merged. This is an original physics lab, not a digital twin of CERN.</p></div>}
   </section>
   <p className="pc-footnote">Educational model. No live accelerator feed, measured detector events or GPU compute is involved. Particles outside the chamber are not displayed. Drag or touch to rotate the 3D scene.</p>
  </div><WorldDock current="particle-chamber" pulse={pulse} onFavorite={favorite}/>
 </main>;
}

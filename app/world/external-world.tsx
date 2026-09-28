'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,LoaderCircle,RotateCcw,Expand,ChevronUp,ChevronDown,Play} from 'lucide-react';
import {type Project} from '../projects';
import {usePulse,track} from '../activity';
import {CaptureControls} from '../components/capture';
import {WorldDock} from '../components/world-dock';
import './external-world.css';

export default function ExternalWorld({project}:{project:Project}){
 const {pulse,favorite}=usePulse(project.id),[attempt,setAttempt]=useState(0),[phase,setPhase]=useState<'loading'|'loaded'|'slow'>('loading'),[notice,setNotice]=useState(''),[help,setHelp]=useState(false),[preview,setPreview]=useState(false);
 const frame=useRef<HTMLIFrameElement|null>(null);const embedded=project.embed==='frame';
 useEffect(()=>{if(!embedded)return;const poll=setInterval(()=>{try{const d=frame.current?.contentDocument;if(d&&d.URL!=='about:blank'&&d.readyState==='complete'){setPhase('loaded');clearInterval(poll);}}catch{/* Cross-origin worlds use the frame load event. */}},300);const timer=setTimeout(()=>{clearInterval(poll);setPhase(p=>p==='loaded'?p:'slow');},18000);return()=>{clearTimeout(timer);clearInterval(poll);};},[attempt,embedded]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
 const onFavorite=async(id:string)=>{try{const saved=await favorite(id);setNotice(saved?'A little wonder, saved.':'Removed from your favorites.');}catch(e){setNotice((e as Error).message);}};
 const openOriginal=()=>track('project_open',project.id);
 return <main className={`external-world ${embedded?'embedded-world':'showcase-world'}`}>
  {embedded?<div className="external-frame-wrap"><iframe key={attempt} ref={frame} className={`external-frame ${phase==='loading'?'is-loading':''}`} title={project.title} src={project.url} allow="autoplay; clipboard-write; gamepad" referrerPolicy="no-referrer" onLoad={()=>{setPhase('loaded');}} onError={()=>setPhase('slow')}/>
   {phase!=='loaded'&&<div className="world-arrival" aria-live="polite"><div className="arrival-orbit"/>{phase==='loading'&&<LoaderCircle className="arrival-spinner" size={24}/>}<span className="eyebrow">ANOTHER DOOR OPENS</span><h1>{project.title}</h1><p>{phase==='loading'?'Bringing the world into view…':'This world is taking longer to answer.'}</p>{phase==='slow'&&<div className="arrival-actions"><button onClick={()=>(setPhase('loading'),setAttempt(v=>v+1))}><RotateCcw size={15}/>Try again</button><a href={project.url} target="_blank" rel="noreferrer" onClick={openOriginal}>Open original <ArrowUpRight size={15}/></a></div>}</div>}
  </div>:<div className={`external-showcase art-${project.art}`}><div className="showcase-orbits"><i/><i/><i/></div><div className="showcase-grain"/>{project.trailer?<video className="showcase-film" src={project.trailer} autoPlay={preview} muted loop playsInline controls={preview}/>:project.image?<img className="showcase-film" src={project.image} alt=""/>:null}<article className="showcase-story"><span className="eyebrow">{project.tag}</span><h1>{project.title}</h1><p>{project.subtitle}</p>{project.edition&&<p className="world-edition">{project.edition}</p>}<a className="showcase-enter" href={project.url} target="_blank" rel="noreferrer" onClick={openOriginal}>{project.kind==='showcase'?'Watch the original film':project.id==='tokenbar'?'Explore the source': 'Open this world'} <ArrowUpRight size={19}/></a><small>{project.kind==='showcase'?'The film opens on X. Your next door stays here.':'Opens in another tab. Come back here to continue your journey.'}</small>{project.trailer&&<button className="showcase-preview" onClick={()=>setPreview(v=>!v)}><Play size={15}/>{preview?'Pause trailer':'Play the trailer'}</button>}</article></div>}
  {embedded&&<aside className={`world-frame-tools ${help?'expanded':''}`}><button className="frame-name" aria-expanded={help} onClick={()=>setHelp(v=>!v)}><span>{project.title}</span>{help?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>{help&&<div>{project.edition&&<p className="world-edition">{project.edition}</p>}<p>The original world is running inside this window. If it stays blank or asks for a separate window, open the original.</p><button onClick={()=>{(setPhase('loading'),setAttempt(v=>v+1));setHelp(false);}}><RotateCcw size={14}/>Reload world</button><a href={project.url} target="_blank" rel="noreferrer" onClick={openOriginal}>Open original <ArrowUpRight size={14}/></a><button onClick={e=>e.currentTarget.closest('main')?.requestFullscreen?.().catch(()=>setNotice('Fullscreen is unavailable in this browser.'))}><Expand size={14}/>Fullscreen world</button></div>}</aside>}
  {embedded&&<CaptureControls project={project.id} title={project.title} sourceKind="tab"/>}
  <WorldDock current={project.id} pulse={pulse} onFavorite={onFavorite}/>
  {notice&&<div className="toast" role="status">{notice}</div>}
 </main>;
}

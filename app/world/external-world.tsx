'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,LoaderCircle,RotateCcw,Play} from 'lucide-react';
import {type Project} from '../projects';
import {usePulse,track} from '../activity';
import {CaptureControls} from '../components/capture';
import {WorldDock} from '../components/world-dock';
import './external-world.css';

export default function ExternalWorld({project}:{project:Project}){
 const {pulse,favorite}=usePulse(project.id),[attempt,setAttempt]=useState(0),[phase,setPhase]=useState<'loading'|'loaded'|'slow'>('loading'),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false);
 const local=project.url?.startsWith('/games/');
 const frame=useRef<HTMLIFrameElement|null>(null);const trailer=useRef<HTMLVideoElement|null>(null);const embedded=project.embed==='frame';
 useEffect(()=>{if(!embedded)return;const poll=setInterval(()=>{try{const d=frame.current?.contentDocument;if(d&&d.URL!=='about:blank'&&d.readyState!=='loading'&&d.body?.childElementCount){setPhase('loaded');clearInterval(poll);}}catch{/* Cross-origin worlds use the frame load event. */}},300);const timer=setTimeout(()=>{clearInterval(poll);setPhase(p=>p==='loaded'?p:'slow');},18000);return()=>{clearTimeout(timer);clearInterval(poll);};},[attempt,embedded]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
 // Keep the pirate world's informational HUD quiet while retaining sailing controls.
 useEffect(()=>{
  if(project.id!=='tides'||phase!=='loaded')return;
  const doc=frame.current?.contentDocument;if(!doc)return;
  const style=doc.createElement('style');style.textContent=`#hud-layer .topbar,#heading-ribbon,#crew-chat{transition:opacity .6s}.pe-hub-rest #hud-layer .topbar:not(:hover):not(:focus-within),.pe-hub-rest #heading-ribbon:not(:hover),.pe-hub-rest #crew-chat:not(:hover):not(:focus-within){opacity:.2}@media(prefers-reduced-motion:reduce){#hud-layer .topbar,#heading-ribbon,#crew-chat{transition:none}}`;doc.head.appendChild(style);
  const sync=()=>doc.documentElement.classList.toggle('pe-hub-rest',document.body.classList.contains('hud-resting'));
  const wake=()=>window.dispatchEvent(new Event('pe-hud-wake'));
  const edge=(e:PointerEvent)=>{const h=doc.defaultView?.innerHeight||0;if(e.clientY<110||e.clientY>h-110)wake();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Tab'||e.key==='Escape')wake();};
  const observer=new MutationObserver(sync);observer.observe(document.body,{attributes:true,attributeFilter:['class']});sync();doc.addEventListener('pointermove',edge,{passive:true});doc.addEventListener('keydown',key);
  return()=>{observer.disconnect();style.remove();doc.documentElement.classList.remove('pe-hub-rest');doc.removeEventListener('pointermove',edge);doc.removeEventListener('keydown',key);};
 },[project.id,phase,attempt]);
 useEffect(()=>{const reset=(e:Event)=>{if((e as CustomEvent).detail?.worldId===project.id){setPhase('loading');setAttempt(v=>v+1);}};window.addEventListener('pe-reset-world',reset);return()=>window.removeEventListener('pe-reset-world',reset);},[project.id]);
 const onFavorite=async(id:string)=>{try{const saved=await favorite(id);setNotice(saved?'A little wonder, saved.':'Removed from your favorites.');}catch(e){setNotice((e as Error).message);}};
 const openOriginal=()=>track('project_open',project.id);
 const togglePreview=()=>{const video=trailer.current;if(!video)return;if(video.paused){void video.play().catch(()=>setPreview(false));}else{video.pause();}};
 return <main className={`external-world ${embedded?'embedded-world':'showcase-world'}`}>
  {embedded?<div className="external-frame-wrap"><iframe key={attempt} ref={frame} className={`external-frame ${phase==='loading'?'is-loading':''}`} title={project.title} src={project.url} allow="autoplay; clipboard-write; gamepad" referrerPolicy="no-referrer" onLoad={()=>{setPhase('loaded');}} onError={()=>setPhase('slow')}/>
   {phase!=='loaded'&&<div className="world-arrival" aria-live="polite">{project.image&&<img className="arrival-image" src={project.image} alt=""/>}<div className="arrival-curtain"/><div className="arrival-orbit"/>{phase==='loading'&&<LoaderCircle className="arrival-spinner" size={24}/>}<span className="eyebrow">ENTERING YOUR NEXT WORLD</span><h1>{project.title}</h1><p>{phase==='loading'?'Opening the scene…':'This world is taking longer to answer.'}</p>{phase==='slow'&&<div className="arrival-actions"><button onClick={()=>(setPhase('loading'),setAttempt(v=>v+1))}><RotateCcw size={15}/>Try again</button><a href={project.url} target="_blank" rel="noreferrer" onClick={openOriginal}>Open original <ArrowUpRight size={15}/></a></div>}</div>}
  </div>:<div className={`external-showcase art-${project.art}`}><div className="showcase-orbits"><i/><i/><i/></div><div className="showcase-grain"/>{project.trailer?<video ref={trailer} className="showcase-film" src={project.trailer} preload="metadata" muted loop playsInline controls={preview} onPlay={()=>setPreview(true)} onPause={()=>setPreview(false)}/>:project.image?<img className="showcase-film" src={project.image} alt=""/>:null}<article className="showcase-story"><span className="eyebrow">{project.tag}</span><h1>{project.title}</h1><p>{project.subtitle}</p>{project.edition&&<p className="world-edition">{project.edition}</p>}<a className="showcase-enter" href={project.url} target="_blank" rel="noreferrer" onClick={openOriginal}>{project.kind==='showcase'?'Watch the original film':project.id==='tokenbar'?'Explore the source': 'Open this world'} <ArrowUpRight size={19}/></a><small>{project.kind==='showcase'?'The film opens on X. Your next door stays here.':'Opens in another tab. Come back here to continue your journey.'}</small>{project.trailer&&<button className="showcase-preview" aria-pressed={preview} onClick={togglePreview}><Play size={15}/>{preview?'Pause trailer':'Play the trailer'}</button>}</article></div>}
  {embedded&&<CaptureControls project={project.id} title={project.title} sourceKind={local?'canvas':'tab'} selector={local?'iframe-world':undefined}/>}
  <WorldDock current={project.id} pulse={pulse} onFavorite={onFavorite}/>
  {notice&&<div className="toast" role="status">{notice}</div>}
 </main>;
}

'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,Bookmark,ChevronLeft,ChevronRight,Eye,Share2,ThumbsUp} from 'lucide-react';
import {worldHref,type Project} from '../projects';
import {track,type Pulse} from '../activity';
import {ProjectArt} from './collection';
import './world-cinema.css';

export const worldCategories=[
 {id:'Understand',label:'Science & systems',description:'Look closer. Change one thing and see what follows.'},
 {id:'Play',label:'Games & adventures',description:'Cities, storms, open seas. Take the controls.'},
 {id:'Watch',label:'Films & stories',description:'Enter a story and stay for the next scene.'},
] as const;
export const compactCount=(n:number|null|undefined)=>n==null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
let previewOwner:HTMLVideoElement|null=null;
const previewChanged='pe-cinema-preview';
export const worldCounts=(pulse:Pulse|null,world:string)=>({
 views:pulse?pulse.ranking.find(p=>p.project===world)?.visits??0:null,
 favorites:pulse?pulse.favorites.find(p=>p.project===world)?.favorites??0:null,
 shares:pulse?pulse.ranking.find(p=>p.project===world)?.shares??0:null,
 likes:pulse?.likes?pulse.likes.find(p=>p.project===world)?.likes??0:null,
});

export function CinemaPreview({project,active=false,className=''}:{project:Project;active?:boolean;className?:string}){
 const video=useRef<HTMLVideoElement>(null),[playing,setPlaying]=useState(false);
 useEffect(()=>{
  const v=video.current;if(!v)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false;
  const pause=()=>{v.pause();setPlaying(false);if(previewOwner===v)previewOwner=null;};
  const update=()=>{if(active&&visible&&!media.matches&&!document.hidden){previewOwner=v;document.dispatchEvent(new Event(previewChanged));void v.play().catch(()=>setPlaying(false));}else pause();};
  const yieldPreview=()=>{if(previewOwner!==v){v.pause();setPlaying(false);}};
  const observer=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting&&entries[0].intersectionRatio>=.15;if(!visible){pause();if(v.readyState>0)v.currentTime=0;}else update();},{threshold:.15});
  observer.observe(v);document.addEventListener(previewChanged,yieldPreview);document.addEventListener('visibilitychange',update);media.addEventListener('change',update);
  return()=>{pause();observer.disconnect();document.removeEventListener(previewChanged,yieldPreview);document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};
 },[active,project.id]);
 return <div className={`cinema-preview ${playing?'is-playing':''} ${className}`}><ProjectArt project={project}/>{project.trailer&&<video ref={video} src={project.trailer} muted playsInline loop preload="none" tabIndex={-1} aria-hidden="true" onPlaying={e=>{if(previewOwner===e.currentTarget)setPlaying(true);else e.currentTarget.pause();}} onPause={()=>setPlaying(false)} onError={()=>setPlaying(false)}/>}</div>;
}

function WorldFilm({project,pulse,current,rank,onFavorite}:{project:Project;pulse:Pulse|null;current?:string;rank?:number;onFavorite?:(id:string)=>void}){
 const [preview,setPreview]=useState(false),[focused,setFocused]=useState(false),[message,setMessage]=useState('');
 const here=project.id===current,counts=worldCounts(pulse,project.id),saved=!!pulse?.saved.includes(project.id);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),3000);return()=>clearTimeout(timer);},[message]);
 return <article className={`world-film ${here?'is-here':''}`} onPointerEnter={()=>setPreview(true)} onPointerLeave={()=>setPreview(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
  <a className="world-film-door" href={worldHref(project)} onClick={()=>track('project_open',project.id)} aria-label={`${here?'Return to':'Enter'} ${project.title}`}><CinemaPreview project={project} active={preview||focused}/><span className="world-film-shade"/><span className="world-film-tag">{here?'YOU ARE HERE':project.tag}</span>{rank!=null&&<span className="world-film-rank" aria-label={`Rank ${rank}`}>{rank}</span>}<span className="world-film-name"><strong>{project.title}</strong><ArrowUpRight size={19}/></span>{project.trailer&&<span className="world-film-preview-hint">Hover to preview</span>}</a>
  <p className="world-film-description">{project.subtitle}</p>
  <div className="world-film-counts" aria-label={`Activity for ${project.title}`}>
   <span title="Views over the last 30 days"><Eye size={13}/><strong>{compactCount(counts.views)}</strong><small>Views</small></span>
   <span title={counts.likes==null?'Likes have not connected yet':'Active likes'}><ThumbsUp size={13}/><strong>{compactCount(counts.likes)}</strong><small>Likes</small></span>
   {onFavorite?<button title="Active favorites" aria-label={`${saved?'Remove':'Add'} ${project.title} ${saved?'from':'to'} favorites`} aria-pressed={saved} disabled={!pulse} onClick={()=>onFavorite(project.id)}><Bookmark size={13} fill={saved?'currentColor':'none'}/><strong>{compactCount(counts.favorites)}</strong><small>Favorites</small></button>:<span title="Active favorites"><Bookmark size={13}/><strong>{compactCount(counts.favorites)}</strong><small>Favorites</small></span>}
   <button title="Copy this world’s link" aria-label={`Copy link to ${project.title}`} onClick={async()=>{try{await navigator.clipboard.writeText(new URL(worldHref(project),location.origin).href);track('share',project.id);setMessage('World link copied.');}catch{setMessage('Open this world, then copy its address to share.');}}}><Share2 size={13}/><strong>{compactCount(counts.shares)}</strong><small>Shares</small></button>
  </div>
  {project.tokens!=null&&project.tokenUsage?<details className="world-film-build"><summary>Recorded AI usage: {compactCount(project.tokens)} processed tokens</summary><span className="world-film-usage-caveat">Includes cache reuse · partial history</span><dl><div><dt>Input</dt><dd>{project.tokenUsage.input.toLocaleString('en-US')}</dd></div><div><dt>Output</dt><dd>{project.tokenUsage.output.toLocaleString('en-US')}</dd></div><div><dt>Cache read</dt><dd>{project.tokenUsage.cacheRead.toLocaleString('en-US')}</dd></div><div><dt>Cache write</dt><dd>{project.tokenUsage.cacheWrite.toLocaleString('en-US')}</dd></div><div><dt>Recorded responses</dt><dd>{project.tokenUsage.responses.toLocaleString('en-US')}</dd></div></dl><p>{project.tokenUsage.scope}</p></details>:<div className="world-film-build is-unrecorded">Build usage not recorded</div>}
  {message&&<span className="world-film-message" role="status">{message}</span>}
 </article>;
}

export function WorldCinemaRail({title,description,worlds,pulse,current,ranks,onFavorite}:{title:string;description?:string;worlds:Project[];pulse:Pulse|null;current?:string;ranks?:Record<string,number>;onFavorite?:(id:string)=>void}){
 const rail=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({before:false,after:false}),id=useId();
 useEffect(()=>{const el=rail.current;if(!el)return;const update=()=>setEdges({before:el.scrollLeft>3,after:el.scrollLeft+el.clientWidth<el.scrollWidth-3});const resize=new ResizeObserver(update);resize.observe(el);el.addEventListener('scroll',update,{passive:true});update();return()=>{resize.disconnect();el.removeEventListener('scroll',update);};},[worlds.length]);
 const move=(direction:number)=>{const el=rail.current;if(!el)return;el.scrollBy({left:direction*Math.max(260,el.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <section className="world-cinema-rail" aria-label={title}><header className="world-rail-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><div className="world-rail-arrows"><button aria-label={`Previous in ${title.toLowerCase()}`} aria-controls={id} disabled={!edges.before} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button aria-label={`Next in ${title.toLowerCase()}`} aria-controls={id} disabled={!edges.after} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></header><div className="world-film-strip" id={id} ref={rail} role="group" aria-label={`${title} carousel`}>{worlds.map(p=><WorldFilm key={p.id} project={p} pulse={pulse} current={current} rank={ranks?.[p.id]} onFavorite={onFavorite}/>)}</div></section>;
}

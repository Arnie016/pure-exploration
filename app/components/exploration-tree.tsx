'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,Check,Cloud,Orbit,Plus,Minus,Maximize,X} from 'lucide-react';
import {projects,worldHref,type Project} from '../projects';
import {track,type Pulse} from '../activity';
import {achievements,addProgress,emptyProgress,mergeVisited,readProgress,PROGRESS_KEY,type ExplorationProgress,type ProgressEvent} from '../achievement-model';
import {ProjectArt} from './collection';
import {worldCategories} from './world-cinema';
import './exploration-tree.css';
const eligible=projects.filter(p=>p.featured!==false&&p.url&&p.category!=='Tools').map(p=>p.id);
const readTrail=()=>readProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'),eligible);
function useExplorationTrail(pulse:Pulse|null){
 const [progress,setProgress]=useState<ExplorationProgress|null>(null),[readFailed,setReadFailed]=useState(false),live=useRef(emptyProgress());
 useEffect(()=>{
  const apply=(next:ExplorationProgress)=>{live.current=next;setProgress(next);};
  const read=()=>{try{apply(readTrail());setReadFailed(false);}catch{apply(live.current);setReadFailed(true);}};
  read();
  const changed=(e:Event)=>{const data=(e as CustomEvent<ProgressEvent>).detail;if(!data)return;const result=addProgress(live.current,data,eligible);if(result.progress!==live.current)apply(result.progress);};
  const merge=(e:Event)=>{const data=(e as CustomEvent<{visited?:string[]}>).detail;if(Array.isArray(data?.visited))apply(mergeVisited(live.current,data.visited,eligible));};
  const erase=()=>apply(emptyProgress()),storage=(e:StorageEvent)=>{if(e.key===PROGRESS_KEY||e.key===null)read();};
  window.addEventListener('pe-progress',changed);window.addEventListener('pe-journey-sync',merge);window.addEventListener('pe-forget-progress',erase);window.addEventListener('storage',storage);
  return()=>{window.removeEventListener('pe-progress',changed);window.removeEventListener('pe-journey-sync',merge);window.removeEventListener('pe-forget-progress',erase);window.removeEventListener('storage',storage);};
 },[]);
 useEffect(()=>{if(!pulse)return;const next=mergeVisited(live.current,pulse.journey.filter(j=>j.visits>0).map(j=>j.project),eligible);live.current=next;setProgress(next);},[pulse]);
 return{progress,readFailed};
}
// The tree is a place to explore, rather than a set of directory columns.
const MAP_WIDTH=2000,MAP_HEIGHT=1500,ROOT={x:1000,y:750};
const branchPoints=[{x:650,y:490},{x:1390,y:710},{x:835,y:1110}];
const leafPoints=[
 [{x:320,y:310},{x:565,y:200},{x:850,y:215},{x:1100,y:285},{x:290,y:590},{x:480,y:760},{x:735,y:365},{x:180,y:890}],
 [{x:1370,y:280},{x:1670,y:410},{x:1770,y:680},{x:1650,y:970},{x:1390,y:1170},{x:1235,y:965},{x:1565,y:1350},{x:1860,y:1120}],
 [{x:570,y:1230},{x:850,y:1370},{x:300,y:1100},{x:1070,y:1310}]
];
type Point={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function ExplorationTree({worlds,pulse,current,onOpenAchievements}:{worlds:Project[];pulse:Pulse|null;current:string;onOpenAchievements:()=>void}){
 const {progress,readFailed}=useExplorationTrail(pulse),[selected,setSelected]=useState<Project|null>(null),id=useId(),viewport=useRef<HTMLDivElement>(null);
 const [camera,setCamera]=useState({x:0,y:0,zoom:.7}),[size,setSize]=useState({width:0,height:0}),[dragging,setDragging]=useState(false);
 const pointers=useRef(new Map<number,Point>()),gesture=useRef<{point:Point;distance:number}|null>(null),buttons=useRef(new Map<string,HTMLButtonElement>());
 const badges=progress?achievements(progress,eligible):[],visited=new Set(progress?.visit||[]),earned=badges.filter(b=>b.award).length;
 const visible=new Set(worlds.map(world=>world.id));
 const nodes=worldCategories.flatMap((category,branch)=>projects.filter(p=>p.featured!==false&&p.category===category.id).map((world,index)=>({world,branch,point:leafPoints[branch][index]||{x:branchPoints[branch].x+(index%2?160:-160),y:180+index*145}}))).filter(node=>visible.has(node.world.id));
 const fit=(width=size.width,height=size.height)=>{const zoom=clamp(Math.min(width/MAP_WIDTH,(height-110)/MAP_HEIGHT),.16,1);setCamera({x:(width-MAP_WIDTH*zoom)/2,y:(height-MAP_HEIGHT*zoom)/2,zoom});};
 useEffect(()=>{const el=viewport.current;if(!el)return;const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setSize({width,height});const zoom=width<650?.54:clamp(Math.min(width/MAP_WIDTH,(height-110)/MAP_HEIGHT),.16,1);setCamera({x:width/2-ROOT.x*zoom,y:height/2-ROOT.y*zoom,zoom});});observer.observe(el);return()=>observer.disconnect();},[]);
 const zoomAt=(factor:number,point:Point)=>setCamera(c=>{const zoom=clamp(c.zoom*factor,.16,1.8);return{x:point.x-(point.x-c.x)*zoom/c.zoom,y:point.y-(point.y-c.y)*zoom/c.zoom,zoom};});
 useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const rect=el.getBoundingClientRect();zoomAt(Math.exp(-clamp(e.deltaY,-100,100)*.003),{x:e.clientX-rect.left,y:e.clientY-rect.top});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 const focusNode=(world:Project,point:Point)=>{setSelected(world);setCamera(c=>({...c,x:size.width/2-point.x*c.zoom,y:size.height/2-point.y*c.zoom}));buttons.current.get(world.id)?.focus({preventScroll:true});};
 const nodeKey=(e:React.KeyboardEvent,world:Project,point:Point)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;const next=nodes.filter(n=>n.world.id!==world.id&&(n.point.x-point.x)*dx+(n.point.y-point.y)*dy>0).sort((a,b)=>{const score=(p:Point)=>{const x=p.x-point.x,y=p.y-point.y;return Math.hypot(x,y)+Math.abs(x*dy-y*dx)*1.5;};return score(a.point)-score(b.point);})[0];if(next)focusNode(next.world,next.point);};
 const gestureState=()=>{const points=[...pointers.current.values()];return{point:{x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length},distance:points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0};};
 const stop=(e:React.PointerEvent)=>{pointers.current.delete(e.pointerId);gesture.current=pointers.current.size?gestureState():null;setDragging(pointers.current.size>0);};
 return <div className="exploration-map">
  <div className="exploration-map-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Exploration map. Drag to move, scroll or pinch to zoom. Arrow keys move the map; plus and minus zoom; Home returns to the centre."
   onPointerDown={e=>{if((e.target as HTMLElement).closest('button,a'))return;e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture.current=gestureState();setDragging(true);}}
   onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=gestureState(),old=gesture.current;gesture.current=next;if(!old)return;const rect=e.currentTarget.getBoundingClientRect();setCamera(c=>{const zoom=clamp(old.distance&&next.distance?c.zoom*next.distance/old.distance:c.zoom,.16,1.8),x=next.point.x-rect.left,y=next.point.y-rect.top;return{x:x-(old.point.x-rect.left-c.x)*zoom/c.zoom,y:y-(old.point.y-rect.top-c.y)*zoom/c.zoom,zoom};});}}
   onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setCamera(c=>({...c,x:c.x+(e.key==='ArrowLeft'?90:e.key==='ArrowRight'?-90:0),y:c.y+(e.key==='ArrowUp'?90:e.key==='ArrowDown'?-90:0)}));}else if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();zoomAt(e.key==='-'?.8:1.25,{x:size.width/2,y:size.height/2});}else if(e.key==='0'){e.preventDefault();fit();}else if(e.key==='Home'){e.preventDefault();setCamera(c=>({...c,x:size.width/2-ROOT.x*c.zoom,y:size.height/2-ROOT.y*c.zoom}));}}}
   data-dragging={dragging}>
   <div className="exploration-map-space" style={{width:MAP_WIDTH,height:MAP_HEIGHT,transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`}}>
    <svg className="exploration-map-paths" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true">{worldCategories.map((c,i)=><path className="map-main-branch" key={c.id} d={`M ${ROOT.x} ${ROOT.y} Q ${branchPoints[i].x} ${ROOT.y} ${branchPoints[i].x} ${branchPoints[i].y}`}/>)}{nodes.map(({world,branch,point})=><path key={world.id} className={visited.has(world.id)?'is-lit':''} d={`M ${branchPoints[branch].x} ${branchPoints[branch].y} Q ${(branchPoints[branch].x+point.x)/2} ${branchPoints[branch].y} ${point.x} ${point.y}`}/>)}{badges.map((b,i)=>{const angle=i*Math.PI*2/6-.8,point={x:ROOT.x+Math.cos(angle)*205,y:ROOT.y+Math.sin(angle)*175};return <path key={b.id} className={b.award?'is-lit':''} d={`M ${ROOT.x} ${ROOT.y} Q ${ROOT.x} ${point.y} ${point.x} ${point.y}`}/>;})}</svg>
    <button className="map-origin" style={{left:ROOT.x,top:ROOT.y}} onClick={()=>fit()} aria-label="Pure Exploration. Fit all worlds on the map"><Orbit size={42}/><strong>Pure Exploration</strong><small>{progress?`${visited.size} discoveries · ${earned} mementos`:'Reading your trail…'}</small></button>
    {worldCategories.map((category,index)=><div key={category.id} className="map-branch-label" style={{left:branchPoints[index].x,top:branchPoints[index].y}}><span>{category.id==='Understand'?'✧':category.id==='Play'?'◈':'☾'}</span><strong>{category.label}</strong></div>)}
    {nodes.map(({world,point})=>{const explored=visited.has(world.id);return <button ref={el=>{if(el)buttons.current.set(world.id,el);else buttons.current.delete(world.id);}} key={world.id} className={`map-world ${explored?'is-explored':'is-clouded'} ${selected?.id===world.id?'is-selected':''}`} style={{left:point.x,top:point.y}} onFocus={()=>{const x=camera.x+point.x*camera.zoom,y=camera.y+point.y*camera.zoom;if(x<70||x>size.width-70||y<90||y>size.height-100)setCamera(c=>({...c,x:size.width/2-point.x*c.zoom,y:size.height/2-point.y*c.zoom}));}} onClick={()=>setSelected(world)} onKeyDown={e=>nodeKey(e,world,point)} aria-controls={id} aria-expanded={selected?.id===world.id} aria-label={`${world.title}, ${explored?'visited':'unexplored'}. Reveal world`}><span className="map-world-orb"><ProjectArt project={world}/>{!explored&&<span className="map-cloud" aria-hidden="true"/>}{explored&&<i aria-hidden="true"><Check size={15}/></i>}</span><strong>{world.title}</strong><small>{world.id===current?'You are here':explored?'Visited':'Unexplored'}</small></button>;})}
    {badges.map((badge,index)=>{const angle=index*Math.PI*2/6-.8;return <button key={badge.id} className={`map-memento ${badge.award?'is-earned':''}`} style={{left:ROOT.x+Math.cos(angle)*205,top:ROOT.y+Math.sin(angle)*175}} onClick={onOpenAchievements} aria-label={`${badge.title}, ${badge.award?'collected':`${Math.min(badge.current,badge.target)} of ${badge.target}`}. Open achievements`}><span>{badge.symbol}{badge.award&&<i><Check size={12}/></i>}</span><strong>{badge.title}</strong></button>;})}
   </div>
  </div>
  <div className="map-controls" role="group" aria-label="Map navigation"><button onClick={()=>zoomAt(1.25,{x:size.width/2,y:size.height/2})} aria-label="Zoom in"><Plus size={18}/></button><button onClick={()=>zoomAt(.8,{x:size.width/2,y:size.height/2})} aria-label="Zoom out"><Minus size={18}/></button><button onClick={()=>fit()} aria-label="Fit all worlds"><Maximize size={17}/></button><button onClick={()=>{setCamera(c=>({...c,x:size.width/2-ROOT.x*c.zoom,y:size.height/2-ROOT.y*c.zoom}));}} aria-label="Return to map centre"><Orbit size={18}/></button></div>
  {!selected&&<div className="map-hint"><span>Drag to explore · scroll or pinch to zoom</span><span><Check size={12}/>Visited <Cloud size={13}/>Unexplored</span>{readFailed&&<small>Saved progress could not be read on this visit.</small>}</div>}
  {selected&&<aside id={id} className="map-preview" aria-label="Selected world"><button className="map-preview-close" onClick={()=>setSelected(null)} aria-label="Close world preview"><X size={16}/></button><div className="map-preview-art"><ProjectArt project={selected}/></div><div><small>{selected.tag}</small><h3>{selected.title}</h3><p>{selected.subtitle}</p><a href={worldHref(selected)} onClick={()=>track('project_open',selected.id)}>Enter world<ArrowUpRight size={16}/></a></div></aside>}
 </div>;
}

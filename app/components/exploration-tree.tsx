'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,Check,Cloud,Orbit,Sparkles} from 'lucide-react';
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
export function ExplorationTree({worlds,pulse,current,onOpenAchievements}:{worlds:Project[];pulse:Pulse|null;current:string;onOpenAchievements:()=>void}){
 const {progress,readFailed}=useExplorationTrail(pulse),[selected,setSelected]=useState<Project|null>(null),inspector=useRef<HTMLElement>(null),id=useId();
 const badges=progress?achievements(progress,eligible):[],visited=new Set(progress?.visit||[]),earned=badges.filter(b=>b.award).length;
 const reveal=(world:Project)=>{setSelected(world);inspector.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="exploration-constellation"><header className="constellation-origin"><div className="constellation-origin-orb" aria-hidden="true"><Orbit size={32}/><i/><i/></div><div><span>YOUR TRAIL OF WONDER</span><h3>A constellation of discoveries.</h3><p role="status">{progress?`${visited.size} of ${eligible.length} worlds visited · ${earned} of ${badges.length} mementos collected`:'Reading your trail…'}</p></div><div className="constellation-key"><span><Check size={12}/>Visited</span><span><Cloud size={13}/>Unexplored</span></div></header>
  <aside id={id} className={`constellation-discovery ${selected?'is-revealed':''}`} ref={inspector} aria-label="Selected world details">{selected?<><div className="constellation-discovery-art"><ProjectArt project={selected}/></div><div><small>{selected.tag}</small><h4>{selected.title}</h4><p>{selected.subtitle}</p></div><a href={worldHref(selected)} onClick={()=>track('project_open',selected.id)}>Enter this world<ArrowUpRight size={15}/></a></>:<p><Sparkles size={17}/>Choose a world star to reveal what waits inside. Every portal is open to you.</p>}</aside>
  <div className="constellation-branches">{worldCategories.map(category=>{const branch=worlds.filter(p=>p.category===category.id);if(!branch.length)return null;const count=branch.filter(p=>visited.has(p.id)).length;return <section className="constellation-branch" key={category.id} aria-label={`${category.label} exploration branch`}><header><span className="constellation-category-star" aria-hidden="true">{category.id==='Understand'?'✧':category.id==='Play'?'◈':'☾'}</span><div><h4>{category.label}</h4><p>{progress?`${count} of ${branch.length} visited`:'Trail loading'}</p></div></header><div className="constellation-world-path" style={{height:branch.length*130}}><svg className="constellation-thread" viewBox={`0 0 110 ${branch.length*130}`} aria-hidden="true">{branch.map((p,index)=>{const x=index%2?78:52,previous=index===0?55:(index-1)%2?78:52,y=index*130+36,prior=index===0?0:(index-1)*130+36;return <path key={p.id} className={visited.has(p.id)?'is-lit':''} d={`M ${previous} ${prior} C ${previous} ${prior+55}, ${x} ${y-55}, ${x} ${y}`}/>;})}</svg>{branch.map((world,index)=>{const explored=visited.has(world.id),here=world.id===current;return <button className={`constellation-world ${explored?'is-explored':'is-clouded'} ${selected?.id===world.id?'is-selected':''}`} style={{top:index*130,left:index%2?42:16}} key={world.id} onClick={()=>reveal(world)} aria-controls={id} aria-expanded={selected?.id===world.id} aria-label={`Reveal ${world.title}, ${progress?explored?'visited':'unexplored':'trail loading'}`}><span className="constellation-world-orb"><ProjectArt project={world}/>{!explored&&<span className="constellation-cloud" aria-hidden="true"/>}{explored?<i className="constellation-visited" aria-hidden="true"><Check size={12}/></i>:<i className="constellation-new" aria-hidden="true">✦</i>}</span><span className="constellation-world-label"><strong>{world.title}</strong><small>{here?'YOU ARE HERE':progress?explored?'Visited':'Unexplored':'Reading trail'}</small></span></button>;})}</div></section>;})}</div>
  <section className="constellation-mementos" aria-label="Achievement constellation"><header><span>ALONG THE WAY</span><h3>Mementos on your trail.</h3><p>Visit a world, try a control, or keep a discovery. Your actions light these stars.</p></header><div className="constellation-achievement-path">{badges.map(badge=><button className={`constellation-achievement ${badge.award?'is-earned':''}`} key={badge.id} onClick={onOpenAchievements} aria-label={`${badge.title}, ${badge.award?'collected':`${Math.min(badge.current,badge.target)} of ${badge.target}`}. Open achievement details`}><span className="constellation-achievement-orb" aria-hidden="true">{badge.symbol}{badge.award&&<i><Check size={11}/></i>}</span><strong>{badge.title}</strong><small>{badge.award?'Collected':`${Math.min(badge.current,badge.target)} / ${badge.target}`}</small></button>)}</div></section>
  <p className="constellation-local">{readFailed?'This browser could not read saved progress. Showing the trail available for this visit.':'Your personal trail is saved on this browser. Clearing site data resets it.'} Mementos celebrate exploration; they do not lock worlds or grant paid account access.</p>
 </div>;
}

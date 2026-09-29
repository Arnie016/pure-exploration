'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {type Project,worldHref} from '../projects';
import {track} from '../activity';
import {ProjectArt} from './collection';

export const TURN_MS=680;
export function deckPosition(index:number,offset:number,count:number){return (index-offset+count)%count;}
export function useDeckTurn(count:number,current:string){
 const [offset,setOffset]=useState(0),[turn,setTurn]=useState<{from:number;to:number;direction:number}|null>(null);
 const offsetRef=useRef(0),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function reset(index:number){offsetRef.current=index;setOffset(index);setTurn(null);busy.current=false;}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(timer.current)clearTimeout(timer.current);reset(0);},[current]);
 function advance(direction:number){
  if(busy.current||count<2)return;
  const from=offsetRef.current,to=(from+direction+count)%count;
  offsetRef.current=to;setOffset(to);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  busy.current=true;setTurn({from,to,direction});
  timer.current=setTimeout(()=>{setTurn(null);busy.current=false;timer.current=null;},TURN_MS);
 }
 return {offset,turn,advance,reset};
}

export function WorldCardDeck({worlds,offset,turn,collapsed}:{worlds:Project[];offset:number;turn:{from:number;to:number;direction:number}|null;collapsed:boolean}){
 return <div className={`world-card-stack turning-deck ${collapsed?'deck-folded':''}`} aria-hidden={collapsed} inert={collapsed}>
  {worlds.map((project,index)=>{
   const rank=deckPosition(index,offset,worlds.length);
   const departing=turn?.direction===1&&index===turn.from;
   const returning=turn?.direction===-1&&index===turn.to;
   const visible=rank<3||departing;
   return <a key={project.id} href={worldHref(project)} data-world={project.id} data-slot={Math.min(rank,3)}
    className={`world-ticket deck-card ${departing?'deck-departing':''} ${returning?'deck-returning':''}`}
    aria-hidden={!visible} tabIndex={!collapsed&&rank===0?0:-1} inert={!visible||collapsed}
    onMouseEnter={e=>{if(rank===0)void e.currentTarget.querySelector('video')?.play().catch(()=>{});}}
    onMouseLeave={e=>e.currentTarget.querySelector('video')?.pause()}
    onFocus={e=>void e.currentTarget.querySelector('video')?.play().catch(()=>{})}
    onBlur={e=>e.currentTarget.querySelector('video')?.pause()}
    onClick={()=>track('project_open',project.id)} aria-label={`${project.kind==='showcase'?'Watch':'Enter'} ${project.title}`}>
    <ProjectArt project={project}/>
    {project.trailer&&<video className="ticket-trailer" src={rank<3?project.trailer:undefined} muted loop playsInline preload="none"/>}
    <span className="ticket-shade"/><span className="ticket-copy"><small>{project.category==='Watch'?'CINEMATIC STORY':project.tag}</small><strong>{project.title}</strong><span>{project.kind==='showcase'?'Watch the showcase':'Step inside'} <ArrowUpRight size={13}/></span></span>
   </a>;
  })}
 </div>;
}

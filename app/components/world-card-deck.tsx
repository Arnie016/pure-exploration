'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {type Project,worldHref} from '../projects';
import {track} from '../activity';
import {ProjectArt} from './collection';
import './world-card-deck.css';

export const TURN_MS=520;
export function deckPosition(index:number,offset:number,count:number){return count>0?((index-offset)%count+count)%count:0;}
export function useDeckTurn(count:number,current:string){
 const [offset,setOffset]=useState(0),[turn,setTurn]=useState<{from:number;to:number;direction:number}|null>(null);
 const offsetRef=useRef(0),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function reset(index:number){if(timer.current)clearTimeout(timer.current);timer.current=null;offsetRef.current=index;setOffset(index);setTurn(null);busy.current=false;}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{reset(0);},[current]);
 function advance(direction:number){
  if(busy.current||count<2)return;
  const from=offsetRef.current,to=deckPosition(from+direction,0,count);
  offsetRef.current=to;setOffset(to);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  busy.current=true;setTurn({from,to,direction});
  timer.current=setTimeout(()=>{setTurn(null);busy.current=false;timer.current=null;},TURN_MS);
 }
 return {offset,turn,advance,reset};
}

export function WorldCardDeck({worlds,offset,turn,collapsed,onExpand}:{worlds:Project[];offset:number;turn:{from:number;to:number;direction:number}|null;collapsed:boolean;onExpand:()=>void}){
 const [choice,setChoice]=useState<{offset:number;id:string}|null>(null),stack=useRef<HTMLDivElement>(null);
 const selected=choice?.offset===offset?choice.id:worlds[offset]?.id;
 useEffect(()=>{stack.current?.querySelectorAll('video').forEach(video=>video.pause());},[offset,collapsed]);
 const preview=(element:HTMLElement)=>{if(!collapsed&&!matchMedia('(prefers-reduced-motion: reduce)').matches)void element.querySelector('video')?.play().catch(()=>{});};
 return <div ref={stack} className={`world-card-stack turning-deck split-deck ${collapsed?'deck-folded':''}`} role="group" aria-label={collapsed?'Two worlds to explore':'Choose your next world'}>
  {worlds.map((project,index)=>{
   const rank=deckPosition(index,offset,worlds.length),departing=turn?.direction===1&&index===turn.from,returning=turn?.direction===-1&&index===turn.to;
   const visible=rank<2,active=selected===project.id;
   return <article key={project.id} data-world={project.id} data-slot={Math.min(rank,3)}
    className={`world-ticket deck-card ${active?'is-selected':''} ${departing?'deck-departing':''} ${returning?'deck-returning':''}`}
    aria-hidden={!visible} inert={!visible}
    onMouseEnter={e=>preview(e.currentTarget)} onMouseLeave={e=>e.currentTarget.querySelector('video')?.pause()}
    onFocus={e=>preview(e.currentTarget)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.querySelector('video')?.pause();}}>
    <ProjectArt project={project}/>
    {project.trailer&&<video className="ticket-trailer" src={visible?project.trailer:undefined} muted loop playsInline preload="none"/>}
    <span className="ticket-shade"/>
    <button className="deck-preview" aria-label={`${collapsed?'Show':'Preview'} ${project.title}`} aria-pressed={active&&!collapsed} tabIndex={visible?0:-1} onClick={()=>{setChoice({offset,id:project.id});onExpand();window.dispatchEvent(new Event('pe-hud-wake'));}}>
     <span className="ticket-copy"><small>{project.category==='Watch'?'CINEMATIC STORY':project.tag}</small><strong>{project.title}</strong><span className="ticket-description">{project.subtitle}</span></span>
    </button>
    <a className="deck-enter" href={worldHref(project)} tabIndex={visible&&!collapsed?0:-1} inert={collapsed||!visible} aria-label={`${project.kind==='showcase'?'Watch':'Enter'} ${project.title}`} onClick={()=>track('project_open',project.id)}>{project.kind==='showcase'?'Watch':'Enter world'}<ArrowUpRight size={14}/></a>
   </article>;
  })}
 </div>;
}

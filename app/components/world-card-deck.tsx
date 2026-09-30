'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import {type Project,worldHref} from '../projects';
import {track} from '../activity';
import {PROGRESS_KEY,readProgress} from '../achievement-model';
import {ProjectArt} from './collection';
import './world-card-deck.css';

export const TURN_MS=480;
export function deckPosition(index:number,offset:number,count:number){return count>0?((index-offset)%count+count)%count:0;}
export function useDeckTurn(count:number,current:string){
 const [offset,setOffset]=useState(0),[turn,setTurn]=useState<{from:number;to:number;direction:number}|null>(null);
 const offsetRef=useRef(0),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),bag=useRef<number[]>([]);
 function reset(index:number){if(timer.current)clearTimeout(timer.current);timer.current=null;offsetRef.current=index;setOffset(index);setTurn(null);busy.current=false;bag.current=[];}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{reset(0);},[current]);
 function advance(direction:number){
  if(busy.current||count<2)return;
  const from=offsetRef.current,to=deckPosition(from+direction,0,count);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){offsetRef.current=to;setOffset(to);return;}
  busy.current=true;setTurn({from,to,direction});
  timer.current=setTimeout(()=>{offsetRef.current=to;setOffset(to);timer.current=setTimeout(()=>{setTurn(null);busy.current=false;timer.current=null;},TURN_MS/2);},TURN_MS/2);
 }
 function random(){if(busy.current||count<2)return;if(!bag.current.length)bag.current=Array.from({length:count},(_,i)=>i).filter(i=>i!==offsetRef.current);const pick=Math.floor(Math.random()*bag.current.length),to=bag.current.splice(pick,1)[0];if(to===offsetRef.current){random();return;}advance(to-offsetRef.current);}
 return {offset,turn,advance,random,reset};
}

export function WorldCardDeck({worlds,offset,turn,collapsed,view='pair',onAdvance}:{worlds:Project[];offset:number;turn:{from:number;to:number;direction:number}|null;collapsed:boolean;view?:'pair'|'stack';onAdvance:(direction:number)=>void}){
 const stack=useRef<HTMLDivElement>(null),pointer=useRef<{id:number;x:number;y:number;slot:number;capture:HTMLElement;moved:boolean}|null>(null),swiped=useRef(false),[drag,setDrag]=useState<{slot:number;x:number;y:number}|null>(null),[visited,setVisited]=useState<string[]>([]);
 useEffect(()=>{const read=()=>{try{setVisited(readProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'),worlds.map(w=>w.id)).visit);}catch{}};read();window.addEventListener('pe-progress',read);window.addEventListener('pe-journey-sync',read);window.addEventListener('pe-forget-progress',read);window.addEventListener('storage',read);return()=>{window.removeEventListener('pe-progress',read);window.removeEventListener('pe-journey-sync',read);window.removeEventListener('pe-forget-progress',read);window.removeEventListener('storage',read);};},[worlds.map(w=>w.id).join('|')]);
 useEffect(()=>{stack.current?.querySelectorAll('video').forEach(video=>video.pause());},[offset,collapsed,view]);
 useEffect(()=>{const cancel=()=>{swiped.current=!!pointer.current?.moved;pointer.current=null;setDrag(null);};window.addEventListener('blur',cancel);const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};},[]);
 const preview=(element:HTMLElement)=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)void element.querySelector('video')?.play().catch(()=>{});};
 const slots=Array.from({length:Math.min(worlds.length,view==='stack'?3:2)},(_,slot)=>({project:worlds[deckPosition(offset+slot,0,worlds.length)],slot}));
 return <div ref={stack} className={`world-card-stack split-deck ${view==='stack'?'stacked-deck':''} ${collapsed?'deck-folded':''} ${turn?offset===turn.from?'deck-dissolving':'deck-reforming':''}`} role="group" aria-label={view==='stack'?'World card stack. Swipe or use arrow keys to browse.':'Two worlds to explore'}
  onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onAdvance(e.key==='ArrowLeft'?-1:1);}}}
  onDragStart={e=>e.preventDefault()}
  onPointerDown={e=>{if(!e.isPrimary||e.button!==0||turn)return;const anchor=(e.target as Element).closest<HTMLElement>('.deck-preview');if(!anchor)return;const slot=Number(anchor.closest<HTMLElement>('[data-slot]')?.dataset.slot||0);swiped.current=false;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,slot,capture:anchor,moved:false};anchor.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{const start=pointer.current;if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){start.moved=true;setDrag({slot:start.slot,x:dx,y:dy*.15});}}}
  onPointerUp={e=>{const start=pointer.current;pointer.current=null;setDrag(null);if(!start||start.id!==e.pointerId)return;swiped.current=start.moved;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(start.capture.hasPointerCapture(e.pointerId))start.capture.releasePointerCapture(e.pointerId);if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){swiped.current=true;onAdvance(1);}}}
  onLostPointerCapture={()=>{if(pointer.current){swiped.current=pointer.current.moved;pointer.current=null;setDrag(null);}}}
  onPointerCancel={()=>{swiped.current=!!pointer.current?.moved;pointer.current=null;setDrag(null);}}
  onClickCapture={e=>{if(swiped.current||turn){e.preventDefault();e.stopPropagation();swiped.current=false;}}}>
  {slots.map(({project,slot})=>{
   const visible=view==='pair'||slot===0,explored=visited.includes(project.id);
   return <article key={slot} data-world={project.id} data-slot={slot} style={drag?.slot===slot?{translate:`${drag.x}px ${drag.y}px`,rotate:`${Math.max(-12,Math.min(12,drag.x/16))}deg`}:undefined} className={`world-ticket deck-card ${drag?.slot===slot?'is-dragging':''} ${slot===0?'is-selected':''}`} aria-hidden={!visible} inert={!visible}
    onMouseEnter={e=>preview(e.currentTarget)} onMouseLeave={e=>e.currentTarget.querySelector('video')?.pause()} onFocus={e=>preview(e.currentTarget)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.querySelector('video')?.pause();}}>
    <ProjectArt project={project}/>{project.trailer&&visible&&<video className="ticket-trailer" src={project.trailer} muted loop playsInline preload="none"/>}<span className="ticket-shade"/>
    <a draggable={false} className="deck-preview" href={worldHref(project)} tabIndex={visible?0:-1} aria-label={`${project.kind==='showcase'?'Watch':'Enter'} ${project.title}${explored?', visited':''}`} onClick={()=>track('project_open',project.id)}>
     {explored&&<span className="deck-visited" title="Visited"><Check size={11}/><span>Visited</span></span>}
     <span className="ticket-copy"><small>{project.category==='Watch'?'CINEMATIC STORY':project.tag}</small><strong>{project.title}</strong>{!collapsed&&<span className="ticket-description">{project.subtitle}</span>}</span><ArrowUpRight className="deck-entry-mark" size={14} aria-hidden="true"/>
    </a>
   </article>;
  })}
 </div>;
}

'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {X,Sparkles} from 'lucide-react';
import {projects} from '../projects';
import {reflectionTick} from '../reflection-timing';
import DiscoveryFeedback from './discovery-feedback';
import './explorer-invitation.css';

export default function ExplorerInvitation(){
 const path=usePathname(),project=projects.find(p=>path===`/world/${p.id}`||path===p.url&&!p.url.startsWith('/games/'));
 const [invite,setInvite]=useState(false),[reflect,setReflect]=useState(false);
 useEffect(()=>{
  setInvite(false);setReflect(false);if(!project)return;
  let active=0,lastInput=0,actions=0,visible=false,suppressed=false;
  try{suppressed=sessionStorage.getItem('pe-quiet-reflections')==='1';}catch{}
  if(suppressed)return;
  const input=()=>{lastInput=Date.now();actions++;};
  const docs=new Set<Document>();
  const bind=(doc:Document)=>{if(docs.has(doc))return;docs.add(doc);doc.addEventListener('pointerdown',input,{passive:true});doc.addEventListener('keydown',input);};
  bind(document);
  const timer=setInterval(()=>{
   // Same-origin worlds can report local input. No click history or counts
   // leave the browser; activity is only a rough invitation timing signal.
   for(const frame of document.querySelectorAll('iframe')){try{if(frame.contentDocument)bind(frame.contentDocument);}catch{}}
   const tick=reflectionTick({activeSeconds:active,actions,lastInput},Date.now(),!suppressed&&!document.hidden&&!visible&&!document.querySelector('[role="dialog"]'));
   active=tick.state.activeSeconds;if(tick.invite){visible=true;setInvite(true);}
  },15000);
  const reset=(e:Event)=>{visible=false;active=0;actions=0;lastInput=0;if((e as CustomEvent).detail?.quiet)suppressed=true;};
  window.addEventListener('pe-reflection-dismissed',reset);
  return()=>{clearInterval(timer);window.removeEventListener('pe-reflection-dismissed',reset);for(const doc of docs){doc.removeEventListener('pointerdown',input);doc.removeEventListener('keydown',input);}};
 },[path,project?.id]);
 const dismiss=(quiet=false)=>{setInvite(false);if(quiet){try{sessionStorage.setItem('pe-quiet-reflections','1');}catch{}}window.dispatchEvent(new CustomEvent('pe-reflection-dismissed',{detail:{quiet}}));};
 if(!project)return null;
 return <>{invite&&<aside className="explorer-invitation" aria-label="Optional reflection"><button className="invitation-close" aria-label="Dismiss reflection invitation" onClick={()=>dismiss()}><X size={14}/></button><Sparkles size={16}/><p>Enjoying {project.title}?</p><button onClick={()=>{dismiss();setReflect(true);}}>Share a thought · 15 seconds</button><button className="invitation-quiet" onClick={()=>dismiss(true)}>Keep this session quiet</button></aside>}{reflect&&<DiscoveryFeedback world={project.id} title={project.title} onClose={()=>setReflect(false)}/>}</>;
}

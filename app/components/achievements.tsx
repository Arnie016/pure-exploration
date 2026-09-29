'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Download,Library,Share2,X} from 'lucide-react';
import {projects} from '../projects';
import {achievements,addProgress,emptyProgress,readProgress,mergeVisited,achievementCaption,PROGRESS_KEY,type ExplorationProgress,type ProgressEvent,type Achievement} from '../achievement-model';
import {renderAchievementCard} from '../achievements/achievement-card';
import './achievements.css';
const eligible=projects.filter(p=>p.featured!==false&&p.url&&p.category!=='Tools').map(p=>p.id);
const sourceUrl='https://github.com/Arnie016/pure-exploration';
const courseUrl='https://www.udemy.com/course/openai-codex-ai-agent-workflows/?referralCode=9394549FD2DB6B765A06';
export function Achievements(){
 const [progress,setProgress]=useState<ExplorationProgress>(emptyProgress),[open,setOpen]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[storageFailed,setStorageFailed]=useState(false);
 const live=useRef(progress),dialog=useRef<HTMLDivElement>(null),previous=useRef<HTMLElement|null>(null),currentWorld=useRef('garden');
 const persist=useCallback((next:ExplorationProgress)=>{live.current=next;setProgress(next);try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(next));setStorageFailed(false);}catch{setStorageFailed(true);}},[]);
 useEffect(()=>{
  try{const next=readProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'),eligible);live.current=next;setProgress(next);}catch{setStorageFailed(true);}
  const update=(e:Event)=>{const data=(e as CustomEvent<ProgressEvent>).detail;if(!data)return;currentWorld.current=data.worldId;const result=addProgress(live.current,data,eligible);if(result.progress!==live.current)persist(result.progress);if(result.unlocked.length)window.dispatchEvent(new CustomEvent('pe-achievement-earned',{detail:{ids:result.unlocked}}));};
  const show=()=>{setOpen(true);setStatus('');};
  const merge=(e:Event)=>{const data=(e as CustomEvent<{visited?:string[]}>).detail;if(data&&Array.isArray(data.visited))persist(mergeVisited(live.current,data.visited,eligible));};
  const erase=()=>{live.current=emptyProgress();setProgress(live.current);try{localStorage.removeItem(PROGRESS_KEY);}catch{}};
  window.addEventListener('pe-progress',update);window.addEventListener('pe-open-achievements',show);window.addEventListener('pe-journey-sync',merge);window.addEventListener('pe-forget-progress',erase);
  return()=>{window.removeEventListener('pe-progress',update);window.removeEventListener('pe-open-achievements',show);window.removeEventListener('pe-journey-sync',merge);window.removeEventListener('pe-forget-progress',erase);};
 },[persist]);
 useEffect(()=>{if(!open)return;previous.current=document.activeElement as HTMLElement;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],summary,[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous.current?.focus();};},[open]);
 const badges=achievements(progress,eligible),earned=badges.filter(b=>b.award);
 async function imageAction(badge:Achievement,action:'download'|'library'|'share'){
  setBusy(true);setStatus('');
  try{const blob=await renderAchievementCard(badge);if(action==='library'){window.dispatchEvent(new CustomEvent('pe-save-achievement',{detail:{blob,title:badge.title,achievementId:badge.id,worldId:eligible.includes(currentWorld.current)?currentWorld.current:progress.visit[0]||'garden'}}));}
   else if(action==='share'&&navigator.canShare?.({files:[new File([blob],`pure-exploration-${badge.id}.png`,{type:'image/png'})]})){await navigator.share({files:[new File([blob],`pure-exploration-${badge.id}.png`,{type:'image/png'})],text:achievementCaption(badge),title:badge.title});}
   else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pure-exploration-${badge.id}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setStatus('Your image download is ready. Attach it to any post you like.');}
  }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setStatus(error instanceof Error?error.message:'The image could not be created. Try again.');}finally{setBusy(false);}
 }
 return <>
 {open&&<div className="achievement-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><div className="achievement-collection" role="dialog" aria-modal="true" aria-labelledby="achievement-title" ref={dialog}>
 <button className="achievement-close" aria-label="Close your collection" onClick={()=>setOpen(false)}><X size={20}/></button>
 <header><span className="achievement-eyebrow">YOUR TRAIL OF WONDER</span><h2 id="achievement-title">Little things to be proud of.</h2><p>Explore a branch, try a control, or keep a discovery. Each step leaves a memento.</p><span className="achievement-count">{earned.length} of {badges.length} collected · {progress.visit.length} of {eligible.length} worlds visited</span></header>
 <div className="achievement-badges">{badges.map(badge=><article key={badge.id} className={`achievement-badge ${badge.award?'earned':''}`}><span className="achievement-symbol" aria-hidden="true">{badge.symbol}</span><div><span className="achievement-state">{badge.award?'COLLECTED':`${Math.min(badge.current,badge.target)} / ${badge.target}`}</span><h3>{badge.title}</h3><p>{badge.description}</p>{!badge.award&&<progress value={Math.min(badge.current,badge.target)} max={Math.max(badge.target,1)} aria-label={`${badge.title}: ${Math.min(badge.current,badge.target)} of ${badge.target}`}/>} {badge.id==='every-door'&&badge.award&&badge.current<badge.target&&<p className="achievement-extra">Collected when there were {badge.award.worlds} worlds. There are new doors to find.</p>}
 {badge.award&&<div className="achievement-actions"><button disabled={busy} aria-label={`Save ${badge.title} to library`} title="Save to library" onClick={()=>void imageAction(badge,'library')}><Library size={15}/><span>Keep</span></button><button disabled={busy} aria-label={`Download ${badge.title} image`} title="Download image" onClick={()=>void imageAction(badge,'download')}><Download size={15}/></button><button disabled={busy} aria-label={`Share ${badge.title} image`} title="Share image" onClick={()=>void imageAction(badge,'share')}><Share2 size={15}/></button><a href={`https://x.com/intent/tweet?text=${encodeURIComponent(achievementCaption(badge))}`} target="_blank" rel="noopener noreferrer" title="Write a post on X">𝕏</a></div>}</div></article>)}</div>
 <p className="achievement-status" role="status">{status}</p>
 {progress.awards['curious-hands']&&<details className="achievement-resources"><summary>Follow your curiosity a little further <ArrowUpRight size={15}/></summary><p>Enjoyed taking things apart? Explore how these worlds are made.</p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">Explore the public source <ArrowUpRight size={15}/></a><a href={courseUrl} target="_blank" rel="sponsored noopener noreferrer">Arnav’s Codex course on Udemy <ArrowUpRight size={15}/></a><small>The course link is a referral link and may support Arnav. Check Udemy for the current price and availability. No discount or free credits are promised.</small></details>}
 <footer><p>{storageFailed?'Your browser could not save this collection. It will last for this visit only.':'Saved on this browser. Clearing site data resets your collection; other devices have their own.'}</p><p>These are personal mementos, not verified game scores or redeemable credits. Posts are always yours to edit. To share an image on X, download it and attach it to your post.</p><button onClick={()=>{window.dispatchEvent(new CustomEvent('pe-open-library'));setOpen(false);}}>Open your library <ArrowUpRight size={14}/></button></footer>
 </div></div>}</>;
}

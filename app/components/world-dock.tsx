'use client';
import{useEffect,useState}from'react';
import{ArrowUpRight,Shuffle,Pause,Play,Heart,Share2,Search,X,Trophy,HelpCircle,ChevronDown,ChevronLeft,ChevronRight,Footprints,Orbit,Library,GitBranch}from'lucide-react';
import{projects,type Project}from'../projects';
import{type Pulse,track}from'../activity';
import{About,Membership}from'./about';
import{Feedback}from'./feedback';
import DiscoveryFeedback from './discovery-feedback';
import{SoundToggle}from'./soundscape';
import{WorldCardDeck,useDeckTurn}from'./world-card-deck';
import{PortalDirectory}from'./portal-directory';
const garden:Project={id:'garden',title:'The in-between',subtitle:'Find a fox. Follow a door.',category:'Play',url:'/',art:'reef',tag:'THE SHARED GARDEN',image:'/covers/garden.jpg'};
export function WorldDock({current,pulse,onFavorite}:{current:string;pulse:Pulse|null;onFavorite:(id:string)=>void}){
 const worlds=projects.filter(p=>p.id!==current&&p.featured!==false),[paused,setPaused]=useState(false),[hovered,setHovered]=useState(false),[panel,setPanel]=useState(''),[collapsed,setCollapsed]=useState(true),[message,setMessage]=useState(''),[burst,setBurst]=useState(0),[newAchievement,setNewAchievement]=useState(false);
 const{offset,turn,advance,random,reset}=useDeckTurn(worlds.length,current),saved=!!pulse?.saved.includes(current),title=[garden,...projects].find(p=>p.id===current)?.title||'This world';
 useEffect(()=>{if(hovered||panel||collapsed)return;const t=setTimeout(()=>setCollapsed(true),10000);return()=>clearTimeout(t);},[current,hovered,panel,collapsed]);
 useEffect(()=>setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches),[]);
 useEffect(()=>{try{const next=sessionStorage.getItem('pe-next-door');const i=worlds.findIndex(p=>p.id===next);if(i>=0)reset(i);}catch{}},[current]);
 useEffect(()=>{try{if(worlds[offset])sessionStorage.setItem('pe-next-door',worlds[offset].id);}catch{}},[offset,current]);
 useEffect(()=>{if(paused||hovered||panel||collapsed)return;const id=setInterval(()=>{if(!document.hidden)random();},4000);return()=>clearInterval(id);},[paused,hovered,panel,collapsed,worlds.length]);
 useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(id);},[message]);
 useEffect(()=>{const loved=(e:Event)=>{if((e as CustomEvent).detail?.worldId===current){setBurst(n=>n+1);}};window.addEventListener('pe-favorited',loved);return()=>window.removeEventListener('pe-favorited',loved);},[current]);
 useEffect(()=>{const earned=()=>setNewAchievement(true);window.addEventListener('pe-achievement-earned',earned);return()=>window.removeEventListener('pe-achievement-earned',earned);},[]);
 const close=()=>setPanel('');
 return <><aside className={`world-dock ${collapsed?'folded':''}`} aria-label="Discover another world" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setHovered(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHovered(false);}}>
  <span className="dock-live" title="Browsers active within the last 90 seconds"><i/>Live · {pulse?pulse.active:'—'}<span className="dock-views" title="Deduplicated visits to this world over the last 30 days">{pulse?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(pulse.ranking.find(r=>r.project===current)?.visits||0):'—'} views · 30d</span></span>
  <div className="dock-heading"><span>NEXT WORLD <small>{offset+1}/{worlds.length}</small></span><div>
   <button aria-label="Find a world" onClick={()=>setPanel('worlds')}><Search size={14}/></button>
   <button aria-label={paused?'Resume automatic shuffle':'Pause automatic shuffle'} aria-pressed={paused} onClick={()=>{setPaused(!paused);if(paused)setCollapsed(false);}}>{paused?<Play size={13}/>:<Pause size={13}/>}</button>
   <button aria-label="Previous world card" onClick={()=>advance(-1)}><ChevronLeft size={15}/></button>
   <button aria-label="Next world card" onClick={()=>advance(1)}><ChevronRight size={15}/></button>
   <button aria-label="Shuffle world cards randomly" title="Surprise me" onClick={random}><Shuffle size={14}/></button>
   <button data-dock-toggle aria-label={collapsed?'Show card details':'Hide card details'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><ChevronDown size={14}/></button>
  </div></div>
  <WorldCardDeck worlds={worlds} offset={offset} turn={turn} collapsed={collapsed} onExpand={()=>setCollapsed(false)}/>
  <div className="dock-social"><button aria-label={saved?'Open favorites and feedback':'Favorite this world'} aria-pressed={saved} onClick={()=>saved?setPanel('favorite'):onFavorite(current)}><span className="heart-wrap">{burst>0&&<span className="heart-burst" key={burst} aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{'--a':`${i*360/7}deg`} as React.CSSProperties}/>)}</span>}<Heart size={16} fill={saved?'currentColor':'none'}/></span><span>{pulse?pulse.favorites.find(p=>p.project===current)?.favorites||0:'—'}</span></button><a className="leaderboard-link" aria-label="World leaderboard" title="World leaderboard" href="/leaderboard"><Trophy size={16}/></a><button aria-label="Share this world" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);track('share',current);setMessage('World link copied.');}catch{setMessage('Copy this page’s address to share.');}}}><Share2 size={16}/></button><a href="https://x.com/itsArnz" target="_blank" rel="noreferrer" onClick={()=>track('follow',current)}>𝕏 <span>Follow Arnav</span></a></div>
 </aside>
 <a className="world-back" href="/?walk=1" aria-label="To lobby"><Footprints size={16}/><span>To lobby</span></a>
 <button className="portal-shortcut" aria-label="Open all world portals" onClick={()=>setPanel('worlds')}><Orbit size={17}/><span>Portals</span></button>
 <div className="world-utilities"><SoundToggle/><button className={`tree-utility ${newAchievement?'has-new-achievement':''}`} aria-label="Open exploration and achievement tree" title="Your exploration tree" onClick={()=>{setNewAchievement(false);setPanel('tree');}}><GitBranch size={17}/>{newAchievement&&<i aria-hidden="true"/>}</button><button className="library-utility" aria-label="Open your discovery library" title="Your library & achievements" onClick={()=>window.dispatchEvent(new CustomEvent('pe-open-library',{detail:{worldId:current}}))}><Library size={17}/></button><button aria-label="About Arnav" title="About & source" onClick={()=>setPanel('about')}><HelpCircle size={18}/></button></div>
 {panel==='favorite'&&<div className="modal-backdrop"><section className="studio-modal favorite-details" role="dialog" aria-modal="true" aria-label="Your favorite world"><button className="close-modal" aria-label="Close favorites" onClick={close}><X size={18}/></button><span className="eyebrow">IN YOUR FAVORITES</span><h2>{title}</h2><button className="outline-button" onClick={()=>setPanel('reflection')}>What did you love? · 15 seconds <ArrowUpRight size={14}/></button><Feedback project={current}/><button className="text-button" onClick={()=>{onFavorite(current);close();}}>Remove from favorites</button></section></div>}
 {panel==='reflection'&&<DiscoveryFeedback world={current} title={title} onClose={close}/>}
 {panel==='about'&&<About onClose={close} onRemix={()=>setPanel('remix')}/>}
 {panel==='remix'&&<Membership onClose={close} world={title}/>}
 {(panel==='worlds'||panel==='tree')&&<PortalDirectory current={current} onClose={close} pulse={pulse} onFavorite={onFavorite} initialView={panel==='tree'?'constellation':'shelves'}/>}
 {message&&<div className="toast" role="status">{message}</div>}
 </>;
}

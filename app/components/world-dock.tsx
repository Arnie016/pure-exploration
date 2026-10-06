'use client';
import{useEffect,useState}from'react';
import{ArrowUpRight,Shuffle,Layers,Columns2,Heart,Share2,X,Trophy,HelpCircle,ChevronDown,ChevronLeft,ChevronRight,Footprints,Orbit,Library}from'lucide-react';
import{projects,type Project}from'../projects';
import{type Pulse,track}from'../activity';
import{About,Membership}from'./about';
import{Feedback}from'./feedback';
import DiscoveryFeedback from './discovery-feedback';
import{SoundToggle}from'./soundscape';
import{WorldCardDeck,useDeckTurn}from'./world-card-deck';
import{WorldHelp}from'./world-help';
import{PortalDirectory}from'./portal-directory';
const garden:Project={id:'garden',title:'The in-between',subtitle:'Find a fox. Follow a door.',category:'Play',url:'/',art:'reef',tag:'THE SHARED GARDEN',image:'/covers/garden.jpg'};
export function WorldDock({current,pulse,onFavorite}:{current:string;pulse:Pulse|null;onFavorite:(id:string)=>void}){
 const worlds=projects.filter(p=>p.id!==current&&p.featured!==false),[deckView,setDeckView]=useState<'pair'|'stack'>('pair'),[hovered,setHovered]=useState(false),[panel,setPanel]=useState(''),[collapsed,setCollapsed]=useState(true),[message,setMessage]=useState(''),[burst,setBurst]=useState(0),[newAchievement,setNewAchievement]=useState(false);
 const{offset,turn,advance,random,reset}=useDeckTurn(worlds.length,current),saved=!!pulse?.saved.includes(current),title=[garden,...projects].find(p=>p.id===current)?.title||'This world';
 useEffect(()=>{if(hovered||panel||collapsed)return;const t=setTimeout(()=>setCollapsed(true),10000);return()=>clearTimeout(t);},[current,hovered,panel,collapsed]);
 useEffect(()=>{try{if(localStorage.getItem('pe-deck-view')==='stack')setDeckView('stack');}catch{}},[]);
 const toggleView=()=>{const next=deckView==='pair'?'stack':'pair';setDeckView(next);try{localStorage.setItem('pe-deck-view',next);}catch{}};
 useEffect(()=>{try{const next=sessionStorage.getItem('pe-next-door');const i=worlds.findIndex(p=>p.id===next);if(i>=0)reset(i);}catch{}},[current]);
 useEffect(()=>{try{if(worlds[offset])sessionStorage.setItem('pe-next-door',worlds[offset].id);}catch{}},[offset,current]);

 useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(id);},[message]);
 useEffect(()=>{const loved=(e:Event)=>{if((e as CustomEvent).detail?.worldId===current){setBurst(n=>n+1);}};window.addEventListener('pe-favorited',loved);return()=>window.removeEventListener('pe-favorited',loved);},[current]);
 useEffect(()=>{const earned=()=>setNewAchievement(true);window.addEventListener('pe-achievement-earned',earned);return()=>window.removeEventListener('pe-achievement-earned',earned);},[]);
 const close=()=>setPanel('');
 return <><aside id="world-navigation" tabIndex={-1} className={`world-dock ${collapsed?'folded':''} ${deckView==='stack'?'stack-view':''}`} aria-label="Discover another world" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setHovered(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHovered(false);}}>
  <span className="dock-live" title="Browsers active within the last 90 seconds"><i/>Live · {pulse?pulse.active:'—'}<span className="dock-views" title="Deduplicated visits to this world over the last 30 days">{pulse?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(pulse.ranking.find(r=>r.project===current)?.visits||0):'—'} views · 30d</span></span>
  <div className="dock-heading"><span>NEXT WORLD <small>{offset+1}/{worlds.length}</small></span><div>
   <button aria-label={deckView==='pair'?'Switch to stacked cards':'Switch to two cards'} title={deckView==='pair'?'Stack of cards':'Two cards'} aria-pressed={deckView==='stack'} onClick={toggleView}>{deckView==='pair'?<Layers size={15}/>:<Columns2 size={15}/>}</button>
   <button aria-label="Previous world card" onClick={()=>advance(-1)}><ChevronLeft size={15}/></button>
   <button aria-label="Next world card" onClick={()=>advance(1)}><ChevronRight size={15}/></button>
   <button aria-label="Shuffle world cards randomly" title="Surprise me" onClick={random}><Shuffle size={14}/></button>
   <button data-dock-toggle aria-label={collapsed?'Show card details':'Hide card details'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><ChevronDown size={14}/></button>
  </div></div>
  <WorldCardDeck worlds={worlds} offset={offset} turn={turn} collapsed={collapsed} view={deckView} onAdvance={advance}/>
  <div className="dock-social"><a className="leaderboard-link" aria-label="Explorer leaderboard" title="Explorer leaderboard" href="/leaderboard"><Trophy size={16}/></a><button aria-label="Share this world" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);track('share',current);setMessage('World link copied.');}catch{setMessage('Copy this page’s address to share.');}}}><Share2 size={16}/></button><a href="https://x.com/itsArnz" target="_blank" rel="noreferrer" onClick={()=>track('follow',current)}>𝕏 <span>Follow Arnav</span></a></div>
 </aside>
 <a className="world-back" href="/?walk=1" aria-label="To lobby"><Footprints size={16}/><span>To lobby</span></a>
 <button className="portal-shortcut" aria-label="Open all world portals" onClick={()=>setPanel('worlds')}><Orbit size={17}/><span>Portals</span></button>
 <div className="world-utilities">{current!=='garden'&&<button className="world-favorite-utility" title="Like this world · feedback" aria-label={saved?'Open favorites and feedback':'Favorite this world'} aria-pressed={saved} onClick={()=>saved?setPanel('favorite'):onFavorite(current)}><span className="heart-wrap">{burst>0&&<span className="heart-burst" key={burst} aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{'--a':`${i*360/7}deg`} as React.CSSProperties}/>)}</span>}<Heart size={16} fill={saved?'currentColor':'none'}/></span><span>{pulse?pulse.favorites.find(p=>p.project===current)?.favorites||0:'—'}</span></button>}<button className="membership-utility" aria-label="Explore Pure Exploration memberships" title="Memberships · current games stay free" onClick={()=>setPanel('remix')}><Heart size={15}/><span>Support</span></button><SoundToggle/><button className={`tree-utility ${newAchievement?'has-new-achievement':''}`} aria-label="Open exploration and achievement tree" title="Your exploration tree" onClick={()=>{setNewAchievement(false);setPanel('tree');}}><svg className="exploration-tree-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20V12M12 12 5 7M12 12l7-5M12 12V4"/><circle cx="12" cy="3" r="2"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="12" cy="21" r="2"/><circle cx="12" cy="12" r="2.5"/></svg><span className="utility-label">Tree</span>{newAchievement&&<i aria-hidden="true"/>}</button><button className="library-utility" aria-label="Open your discovery library" title="Your library & achievements" onClick={()=>window.dispatchEvent(new CustomEvent('pe-open-library',{detail:{worldId:current}}))}><Library size={17}/></button><button className="help-utility" aria-label="Help and resources" title="How to play & resources" onClick={()=>setPanel('help')}><HelpCircle size={19}/><span className="utility-label">Help</span></button></div>
 {panel==='favorite'&&<div className="modal-backdrop"><section className="studio-modal favorite-details" role="dialog" aria-modal="true" aria-label="Your favorite world"><button className="close-modal" aria-label="Close favorites" onClick={close}><X size={18}/></button><span className="eyebrow">IN YOUR FAVORITES</span><h2>{title}</h2><button className="outline-button" onClick={()=>setPanel('reflection')}>What did you love? · 15 seconds <ArrowUpRight size={14}/></button><Feedback project={current}/><button className="text-button" onClick={()=>{onFavorite(current);close();}}>Remove from favorites</button></section></div>}
 {panel==='reflection'&&<DiscoveryFeedback world={current} title={title} onClose={close}/>}
 {panel==='help'&&<WorldHelp project={[garden,...projects].find(p=>p.id===current)||garden} onClose={close}/>}
 {panel==='about'&&<About onClose={close} onRemix={()=>setPanel('remix')}/>}
 {panel==='remix'&&<Membership onClose={close} world={title}/>}
 {(panel==='worlds'||panel==='tree')&&<PortalDirectory current={current} onClose={close} pulse={pulse} onFavorite={onFavorite} initialView='constellation'/>}
 {message&&<div className="toast" role="status">{message}</div>}
 </>;
}

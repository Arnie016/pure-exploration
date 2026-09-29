'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {ArrowUpRight,Heart,Eye,Share2,Search,Trophy,RefreshCw} from 'lucide-react';
import {projects,worldHref,type Project} from '../projects';
import {usePulse,track} from '../activity';
import {WorldDock} from '../components/world-dock';
import {ProjectArt} from '../components/collection';
import './leaderboard.css';

const metrics=[
 {id:'visits',label:'Views',period:'last 30 days',icon:Eye},
 {id:'favorites',label:'Favorites',period:'active favorites',icon:Heart},
 {id:'shares',label:'Shares',period:'last 30 days',icon:Share2},
] as const;
type Metric=typeof metrics[number]['id'];
const categories=[{id:'All',label:'Every world'},{id:'Understand',label:'Science & systems'},{id:'Play',label:'Games & adventures'},{id:'Watch',label:'Films & stories'}] as const;
type Category=typeof categories[number]['id'];
type RankedWorld=Project&{visits:number;shares:number;favorites:number};
const format=(n:number)=>new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(n);
const countLabel=(n:number,singular:string)=>`${format(n)} ${singular}${n===1?'':'s'}`;

export default function Leaderboard(){
 const {pulse,error,favorite}=usePulse('leaderboard');
 const [metric,setMetric]=useState<Metric>('visits'),[category,setCategory]=useState<Category>('All'),[query,setQuery]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState<string|null>(null);
 const allWorlds=useMemo<RankedWorld[]>(()=>projects.filter(p=>p.featured!==false&&p.category!=='Tools').map(project=>{
  const count=pulse?.ranking.find(p=>p.project===project.id);
  return {...project,visits:count?.visits??0,shares:count?.shares??0,favorites:pulse?.favorites.find(p=>p.project===project.id)?.favorites??0};
 }),[pulse]);
 const ranked=useMemo(()=>allWorlds.filter(p=>(category==='All'||p.category===category)&&(p.title+' '+p.subtitle+' '+p.tag).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b[metric]-a[metric]||a.title.localeCompare(b.title)),[allWorlds,metric,category,query]);
 const leading=ranked[0],metricInfo=metrics.find(m=>m.id===metric)!,total=(m:Metric)=>allWorlds.reduce((n,r)=>n+r[m],0),max=leading?.[metric]||1;
 const hasActivity=!!pulse&&!!leading&&leading[metric]>0;
 const tiedAtTop=hasActivity?ranked.filter(p=>p[metric]===leading[metric]).length:0;
 const saveWorld=async(id:string)=>{
  if(saving)return;
  setSaving(id);
  try{const active=await favorite(id);setMessage(active?'Added to your favorites.':'Removed from your favorites.');}catch(e){setMessage((e as Error).message);}finally{setSaving(null);}
 };
 const enter=(id:string)=>track('project_open',id);
 return <main className="constellation-board">
  <div className="board-atmosphere" aria-hidden="true">{leading&&<ProjectArt project={leading}/>}<div className="board-horizon"/><div className="board-orbit"/><div className="board-orbit second"/></div>
  <div className="board-scroll">
   <header className="board-intro"><span className="eyebrow"><Trophy size={13}/> THE WORLD LEADERBOARD</span><h1>Where curiosity <em>takes us.</em></h1><p>Follow the worlds people explore, share, and keep coming back to.</p>
    <div className="board-totals" aria-label="Community activity">{metrics.map(m=><div key={m.id}><m.icon size={14}/><strong title={pulse?total(m.id).toLocaleString():undefined}>{pulse?format(total(m.id)):'—'}</strong><span>{m.label}<small>{m.period}</small></span></div>)}</div>
    <div className={`board-live ${error?'paused':''}`} role="status"><i/>{error?<><span>{pulse?'Live counts paused. Showing the last update.':'Live counts could not connect.'}</span><button onClick={()=>window.dispatchEvent(new Event('pe-refresh'))}><RefreshCw size={12}/>Retry</button></>:<span>{pulse?`Live · ${pulse.active.toLocaleString()} ${pulse.active===1?'explorer':'explorers'} across Pure Exploration`:'Connecting to the live counts…'}</span>}</div>
   </header>
   <div className="board-landscape">
    <aside className="board-spotlight" aria-label={hasActivity?'Leading world':'World to discover'}>
     {leading?<><div className="spotlight-art"><ProjectArt project={leading}/><span className="spotlight-glow"/><div className="spotlight-mark"><Trophy size={20}/><span>{hasActivity?'01':'✧'}</span></div></div><div className="spotlight-copy"><span className="spotlight-label">{hasActivity?(tiedAtTop>1?'SHARING THE LEAD':'LEADING IN '+metricInfo.label.toUpperCase()):'A DOOR WORTH OPENING'}</span><h2>{leading.title}</h2><p>{leading.subtitle}</p>{pulse&&<div className="spotlight-metric"><strong>{leading[metric].toLocaleString()}</strong><span>{metricInfo.label.toLowerCase()}<small>{metricInfo.period}</small></span></div>}<a href={worldHref(leading)} onClick={()=>enter(leading.id)} className="spotlight-enter">Enter this world <ArrowUpRight size={18}/></a></div></>:<div className="spotlight-no-match"><span>✧</span><h2>A different direction?</h2><p>Clear your search to find another world.</p><button onClick={()=>{setQuery('');setCategory('All');}}>Show every world</button></div>}
    </aside>
    <section className="board-ranking" aria-label="World rankings">
     <div className="board-categories" role="group" aria-label="Filter world categories">{categories.map(c=><button key={c.id} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.label}</button>)}</div>
     <div className="board-controls"><div className="board-sort" role="group" aria-label="Rank worlds by">{metrics.map(m=><button key={m.id} aria-pressed={metric===m.id} onClick={()=>setMetric(m.id)}><m.icon size={14}/>{m.label}</button>)}</div><label className="board-search"><Search size={15}/><input aria-label="Search ranked worlds" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a world…"/></label></div>
     <div className="board-list-heading"><span>{ranked.length} {ranked.length===1?'WORLD':'WORLDS'}<small> · {metricInfo.period.toUpperCase()}</small></span><span>{metricInfo.label.toUpperCase()}</span></div>
     {pulse&&leading&&!hasActivity&&<p className="board-empty">These worlds are waiting for their first {metric==='visits'?'explorers':metric==='shares'?'shares':'favorites'}. Open a door and start something.</p>}
     <ol className="world-rank-list">{ranked.map((p,i)=>{
      const rank=ranked.findIndex(r=>r[metric]===p[metric])+1,selected=pulse?.saved.includes(p.id);
      return <li className={`world-rank ${rank===1&&hasActivity?'leading':''}`} key={p.id} style={{'--rank-fill':`${p[metric]/max*100}%`,'--rank-delay':`${Math.min(i,8)*30}ms`} as CSSProperties}>
       <span className="rank-number" aria-label={pulse&&p[metric]>0?`Rank ${rank}`:'Not ranked yet'}>{pulse&&p[metric]>0?String(rank).padStart(2,'0'):'—'}</span>
       <a href={worldHref(p)} onClick={()=>enter(p.id)} className="rank-world"><div className="rank-art"><ProjectArt project={p}/></div><div className="rank-copy"><small>{p.tag}</small><strong>{p.title}</strong><span className="rank-secondary">{pulse?`${countLabel(p.visits,'view')} · ${countLabel(p.favorites,'favorite')} · ${countLabel(p.shares,'share')}`:'Waiting for live counts'}</span></div></a>
       <div className="rank-value"><strong title={pulse?p[metric].toLocaleString():undefined}>{pulse?format(p[metric]):'—'}</strong><span className="rank-trace" aria-hidden="true"><i/></span></div>
       <button className={`rank-save ${selected?'saved':''}`} aria-label={`${selected?'Remove':'Add'} ${p.title} ${selected?'from':'to'} favorites`} aria-pressed={!!selected} disabled={!pulse||saving!==null} onClick={()=>saveWorld(p.id)}><Heart size={17} fill={selected?'currentColor':'none'}/></button>
       <a className="rank-enter" aria-label={`Enter ${p.title}`} href={worldHref(p)} onClick={()=>enter(p.id)}><ArrowUpRight size={18}/></a>
      </li>;
     })}</ol>
     {!ranked.length&&<div className="board-no-results"><h3>No worlds match that search.</h3><p>Try another name, or look across every category.</p><button onClick={()=>{setQuery('');setCategory('All');}}>Show every world</button></div>}
     <footer className="board-footnote"><span>Counts refresh every 30 seconds. Tied worlds share a rank.</span><details><summary>How the counts work</summary><p>Views and shares count once per browser activity session, per world, per day, over the last 30 days. Favorites stay counted until removed. Live explorers are active browsers across the site within the last 90 seconds. These are visits here, not traffic reported by other sites.</p><a href="/privacy">Privacy & your data <ArrowUpRight size={12}/></a></details></footer>
    </section>
   </div>
  </div>
  <WorldDock current="leaderboard" pulse={pulse} onFavorite={saveWorld}/>
  {message&&<button className="toast" onClick={()=>setMessage('')} role="status">{message}</button>}
 </main>;
}

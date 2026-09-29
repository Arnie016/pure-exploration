'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Bookmark,Eye,RefreshCw,Search,Share2,ThumbsUp,Trophy} from 'lucide-react';
import {projects,worldHref} from '../projects';
import {usePulse,track} from '../activity';
import {WorldDock} from '../components/world-dock';
import {CinemaPreview,WorldCinemaRail,compactCount,worldCategories,worldCounts} from '../components/world-cinema';
import './leaderboard.css';
const metrics=[{id:'views',label:'Views',icon:Eye},{id:'likes',label:'Likes',icon:ThumbsUp},{id:'favorites',label:'Favorites',icon:Bookmark},{id:'shares',label:'Shares',icon:Share2}] as const;
type Metric=typeof metrics[number]['id'];
const connected=projects.filter(p=>p.featured!==false&&p.category!=='Tools');
export default function Leaderboard(){
 const {pulse,error,favorite}=usePulse('leaderboard');
 const [metric,setMetric]=useState<Metric>('views'),[query,setQuery]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),4000);return()=>clearTimeout(timer);},[message]);
 const worlds=useMemo(()=>connected.filter(p=>(p.title+' '+p.subtitle+' '+p.tag).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(worldCounts(pulse,b.id)[metric]??0)-(worldCounts(pulse,a.id)[metric]??0)||a.title.localeCompare(b.title)),[pulse,query,metric]);
 const leading=worlds[0],leaderCount=leading?worldCounts(pulse,leading.id)[metric]:null;
 const ranks=Object.fromEntries(worlds.filter(p=>(worldCounts(pulse,p.id)[metric]??0)>0).map(p=>[p.id,worlds.findIndex(r=>worldCounts(pulse,r.id)[metric]===worldCounts(pulse,p.id)[metric])+1]));
 const totals=Object.fromEntries(metrics.map(m=>[m.id,pulse&&(m.id!=='likes'||pulse.likes)?connected.reduce((sum,p)=>sum+(worldCounts(pulse,p.id)[m.id]??0),0):null]));
 const buildTokens=connected.filter(p=>p.tokens!=null&&p.tokenUsage).reduce((sum,p)=>sum+(p.tokens??0),0),recordedBuilds=connected.filter(p=>p.tokens!=null&&p.tokenUsage).length;
 const saveWorld=async(id:string)=>{try{const active=await favorite(id);setMessage(active?'Added to your favorites.':'Removed from your favorites.');}catch(e){setMessage((e as Error).message);}};
 return <main className="cinema-leaderboard"><div className="cinema-board-scroll">
  <section className="cinema-board-hero" onPointerEnter={()=>setPreview(true)} onPointerLeave={()=>setPreview(false)} onFocusCapture={()=>setPreview(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPreview(false);}}>
   {leading&&<CinemaPreview project={leading} active={preview} className="cinema-board-backdrop"/>}<div className="cinema-board-vignette"/>
   <div className="cinema-board-intro"><span className="cinema-kicker"><Trophy size={14}/>WORLD LEADERBOARD</span><h1>{leading?.title||'Every world starts somewhere.'}</h1><p>{leading?.subtitle||'Try another name to find your next world.'}</p>{leading&&<><span className="cinema-leading">{leaderCount!=null&&leaderCount>0?`#1 in ${metric} · ${compactCount(leaderCount)} ${metric}`:'Explore a world. Start a story.'}</span><a className="cinema-board-enter" href={worldHref(leading)} onClick={()=>track('project_open',leading.id)}>Enter this world<ArrowUpRight size={17}/></a></>}</div>
   <div className="cinema-board-overview" aria-label="Community activity"><span>ACROSS THE UNIVERSE</span><div>{metrics.map(m=><section key={m.id} title={m.id==='likes'&&totals[m.id]==null?'Likes are waiting for a live count':m.id==='favorites'?'Active favorites':m.id==='likes'?'Active likes':'Last 30 days'}><m.icon size={15}/><strong>{compactCount(totals[m.id])}</strong><small>{m.label}</small></section>)}</div><p className={error?'counts-paused':''} role="status"><i/>{error?<>{pulse?'Counts paused. Showing the last update.':'Counts could not connect.'}<button onClick={()=>window.dispatchEvent(new Event('pe-refresh'))}><RefreshCw size={12}/>Retry</button></>:pulse?`Live · ${pulse.active.toLocaleString()} ${pulse.active===1?'explorer':'explorers'}`:'Connecting to live counts…'}</p>{recordedBuilds>0&&<small className="cinema-build-total">{compactCount(buildTokens)} processed AI tokens · {recordedBuilds} recorded worlds<span>Includes cache reuse · partial history. See each world’s usage.</span></small>}</div>
  </section>
  <div className="cinema-board-content"><div className="cinema-board-controls"><div role="group" aria-label="Rank worlds by">{metrics.map(m=><button key={m.id} aria-pressed={metric===m.id} onClick={()=>setMetric(m.id)}><m.icon size={14}/>{m.label}</button>)}</div><label><Search size={16}/><input aria-label="Search ranked worlds" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a world…"/></label></div>
   {worlds.length>0?<><WorldCinemaRail title="Leading worlds" description={`The community’s ${metric}. Tied worlds share a rank.`} worlds={worlds.slice(0,8)} pulse={pulse} ranks={ranks} onFavorite={saveWorld}/>{worldCategories.map(c=>{const group=worlds.filter(p=>p.category===c.id);return group.length?<WorldCinemaRail key={c.id} title={c.label} description={c.description} worlds={group} pulse={pulse} ranks={ranks} onFavorite={saveWorld}/>:null;})}</>:<div className="cinema-board-empty"><h2>No worlds match that search.</h2><button onClick={()=>setQuery('')}>Show every world</button></div>}
   <details className="cinema-count-notes"><summary>How the counts work</summary><p>Views and shares count once per browser activity session, per world, per day, over the last 30 days. Likes and favorites stay counted until removed. Live explorers are active browsers across Pure Exploration in the last 90 seconds. Counts refresh every 30 seconds.</p><a href="/privacy">Privacy & your data<ArrowUpRight size={12}/></a></details>
  </div>
 </div><WorldDock current="leaderboard" pulse={pulse} onFavorite={saveWorld}/>{message&&<div className="toast" role="status">{message}</div>}</main>;
}

'use client';
import {useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Compass,Footprints,Medal,RefreshCw,Trophy,Users} from 'lucide-react';
import {projects} from '../projects';
import {usePulse} from '../activity';
import {achievements,readProgress,PROGRESS_KEY} from '../achievement-model';
import {PortalDirectory} from '../components/portal-directory';
import {Participation,type ExplorerRow,type BoardState} from './participation';
import './leaderboard.css';
const eligible=projects.filter(p=>p.featured!==false&&p.url&&p.category!=='Tools').map(p=>p.id);
function badgeCount(){try{const progress=readProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'),eligible);return achievements(progress,eligible).filter(b=>b.award).length;}catch{return null;}}
function subscribeBadges(changed:()=>void){const update=()=>queueMicrotask(changed);window.addEventListener('pe-progress',update);window.addEventListener('pe-forget-progress',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('pe-progress',update);window.removeEventListener('pe-forget-progress',update);window.removeEventListener('storage',update);};}
const noBadgeSnapshot=()=>null;
export default function Leaderboard(){
 const {pulse,error,favorite}=usePulse('leaderboard');
 const [ranked,setRanked]=useState<ExplorerRow[]>([]),[board,setBoard]=useState<BoardState>({state:'loading',configured:null});
 const [shelves,setShelves]=useState(false),[message,setMessage]=useState(''),localBadges=useSyncExternalStore(subscribeBadges,badgeCount,noBadgeSnapshot);
 const visited=pulse?new Set(pulse.journey.filter(p=>eligible.includes(p.project)&&(p.visits>0||p.opens>0)).map(p=>p.project)).size:null;
 const sharedDiscoveries=ranked.reduce((total,row)=>total+row.worlds,0);
 const saveWorld=async(id:string)=>{try{await favorite(id);}catch(e){setMessage(e instanceof Error?e.message:'Your favorite could not be saved. Try again.');}};
 const retry=()=>window.dispatchEvent(new Event('pe-explorers-refresh'));
 return <main className="explorer-board">
  <nav className="explorer-board-nav" aria-label="Exploration navigation"><Link href="/?walk=1" prefetch={false}><Footprints size={16}/>To lobby</Link><button onClick={()=>setShelves(true)}><Compass size={16}/>Browse worlds</button></nav>
  <div className="explorer-board-body">
   <header className="explorer-board-heading"><span><Trophy size={16} aria-hidden="true"/> DISCOVERY RANKINGS</span><h1>Explorer leaderboard</h1><p>Discover worlds. Share your trail if you want to compete. No account is needed to play.</p></header>
   <dl className="explorer-board-stats" aria-label="Leaderboard overview"><div><dt>Explorers shown</dt><dd>{board.state==='ready'||ranked.length?ranked.length:'—'}</dd></div><div><dt>Shared discoveries</dt><dd>{board.state==='ready'||ranked.length?sharedDiscoveries:'—'}</dd></div><div><dt>Worlds to explore</dt><dd>{eligible.length}</dd></div></dl>
   <div className="explorer-board-columns"><section className="explorer-ranks" aria-labelledby="explorer-ranks-title"><div className="explorer-ranks-heading"><h2 id="explorer-ranks-title">Public explorers</h2><span>Most worlds discovered first</span></div><p className="explorer-rank-rule">Each different world counts once. Equal counts share a rank.</p>
    {board.state==='error'&&ranked.length>0&&<p className="explorer-board-alert" role="status">Rankings could not refresh. Showing the last update. <button onClick={retry}><RefreshCw size={13}/>Retry</button></p>}
    {ranked.length>0?<div className="explorer-table-wrap"><table><caption className="explorer-sr-only">Up to 100 public explorers ranked by distinct worlds discovered. Equal counts share a rank.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Explorer</th><th scope="col">Worlds discovered</th></tr></thead><tbody>{ranked.map(r=><tr key={r.id}><td><span className={`explorer-rank-number ${r.rank<=3?'is-leading':''}`}>#{r.rank}</span></td><th scope="row">{r.alias}</th><td><span className="explorer-world-count"><strong>{r.worlds}</strong><span> / {eligible.length}</span></span><progress value={r.worlds} max={Math.max(eligible.length,r.worlds,1)} aria-label={`${r.alias}: ${r.worlds} worlds discovered out of ${eligible.length}`}/></td></tr>)}</tbody></table></div>:<div className="explorer-ranks-empty" role="status"><Users size={25} aria-hidden="true"/><div><strong>{board.state==='loading'?'Loading public rankings…':board.state==='error'?'Rankings could not connect.':'No public explorers yet.'}</strong><p>{board.state==='loading'?'Checking the board for shared discoveries.':board.state==='error'?'Your private trail and every world are still available.':board.configured===false?'Joining is unavailable right now. Every world is still open to explore.':'Be the first to share your discoveries, or keep your journey private.'}</p>{board.state==='error'?<button onClick={retry}><RefreshCw size={13}/>Retry rankings</button>:<button onClick={()=>setShelves(true)}>Explore a world<ArrowUpRight size={14}/></button>}</div></div>}
    <p className="explorer-rank-scope">Public board · up to 100 explorers · discovery milestones, not game scores</p>
   </section><Participation onRows={setRanked} onBoardState={setBoard}/></div>
   <section className="explorer-personal" aria-labelledby="explorer-personal-title"><div><span>YOUR PRIVATE TRAIL</span><h2 id="explorer-personal-title">{pulse?.me.alias||'Your browser journey'}</h2>{error?<p role="status">{pulse?'Your trail could not refresh. Showing its last update.':'Your trail could not connect.'} <button className="explorer-inline-action" onClick={()=>window.dispatchEvent(new Event('pe-refresh'))}><RefreshCw size={12}/>Retry</button></p>:pulse?<p><strong>{visited}</strong> worlds discovered{localBadges!==null?<> · <strong>{localBadges}</strong> badges on this device</>:''}. Visible only to you.</p>:<p role="status">Loading your private trail…</p>}</div><button className="explorer-inline-action" onClick={()=>window.dispatchEvent(new Event('pe-open-achievements'))}><Medal size={16}/>Your badges</button></section>
   <details className="explorer-participation"><summary>Privacy and participation</summary><p>Signing in alone does not put you on the board. Joining shares your chosen name and distinct world count. Your email, captures, notes and local badges stay private.</p><p>Your fox belongs to this browser. X or GitHub links on a fox are self-declared. Clearing site data can reset your local badges.</p><Link href="/privacy">Privacy & your data <ArrowUpRight size={13}/></Link></details>
   {message&&<p role="status" className="explorer-message">{message}</p>}
  </div>
  {shelves&&<PortalDirectory current="leaderboard" onClose={()=>setShelves(false)} pulse={pulse} onFavorite={saveWorld} initialView="shelves"/>}
 </main>;
}

'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Compass,Footprints,Medal,RefreshCw,Trophy,Users} from 'lucide-react';
import {projects} from '../projects';
import {usePulse} from '../activity';
import {achievements,readProgress,PROGRESS_KEY} from '../achievement-model';
import {PortalDirectory} from '../components/portal-directory';
import './leaderboard.css';
import {Participation,type ExplorerRow} from './participation';
const eligible=projects.filter(p=>p.featured!==false&&p.url&&p.category!=='Tools').map(p=>p.id);
export default function Leaderboard(){
 const {pulse,error,favorite}=usePulse('leaderboard');
 const [ranked,setRanked]=useState<ExplorerRow[]>([]);
 const [shelves,setShelves]=useState(false),[localBadges,setLocalBadges]=useState<number|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{try{const progress=readProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'),eligible);setLocalBadges(achievements(progress,eligible).filter(b=>b.award).length);}catch{setLocalBadges(null);}},[]);
 const visited=pulse?new Set(pulse.journey.filter(p=>eligible.includes(p.project)&&(p.visits>0||p.opens>0)).map(p=>p.project)).size:null;
 const saveWorld=async(id:string)=>{try{await favorite(id);}catch(e){setMessage(e instanceof Error?e.message:'Your favorite could not be saved. Try again.');}};
 return <main className="explorer-board">
  <nav className="explorer-board-nav" aria-label="Exploration navigation"><a href="/?walk=1"><Footprints size={16}/>To lobby</a><button onClick={()=>setShelves(true)}><Compass size={16}/>Browse worlds</button></nav>
  <div className="explorer-board-body">
   <header className="explorer-board-heading"><span><Trophy size={17} aria-hidden="true"/> EXPLORER LEADERBOARD</span><h1>People who follow their curiosity.</h1><p>Play first. A place on the public board will always be optional.</p></header>
   <section className="explorer-ranks" aria-labelledby="explorer-ranks-title"><div className="explorer-ranks-heading"><h2 id="explorer-ranks-title">The explorers</h2><span>{ranked.length?`${ranked.length} explorers · discoveries shared by choice`:"No public explorers yet"}</span></div>
    <div className="explorer-table-wrap"><table><caption className="explorer-sr-only">Public explorer discovery rankings. Matching world counts share a rank.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Explorer</th><th scope="col">Worlds</th><th scope="col">Trail</th></tr></thead><tbody>{ranked.map(r=><tr key={r.id}><td>{r.rank}</td><th scope="row">{r.alias}</th><td>{r.worlds}</td><td><Medal size={18} aria-label={r.worlds>=eligible.length?"Every world":r.worlds>=3?"Branch explorer":r.worlds>=1?"First discovery":"Setting out"}/></td></tr>)}{!ranked.length&&<tr><td colSpan={4}><div className="explorer-ranks-empty"><Users size={27} aria-hidden="true"/><strong>Your discoveries stay yours.</strong><p>Explore freely. Only people who choose to join will appear here.</p><a href="/?walk=1">Keep exploring <ArrowUpRight size={15}/></a></div></td></tr>}</tbody></table></div>
   </section>
   <Participation onRows={setRanked}/>
   <section className="explorer-personal" aria-labelledby="explorer-personal-title"><div className="explorer-fox-mark" aria-hidden="true"><Compass size={24}/></div><div><span>YOUR BROWSER FOX · PRIVATE</span><h2 id="explorer-personal-title">{pulse?.me.alias||'Your trail of discoveries'}</h2>{error?<p role="status">{pulse?'Your browser profile could not refresh. Showing its last update.':'Your browser profile could not connect.'} <button className="explorer-inline-action" onClick={()=>window.dispatchEvent(new Event('pe-refresh'))}><RefreshCw size={12}/>Retry</button></p>:pulse?<p>{visited} {visited===1?'world':'worlds'} discovered in your browser journey{localBadges!==null?` · ${localBadges} ${localBadges===1?'badge':'badges'} on this device`:''}. This is not a public score.</p>:<p role="status">Connecting to your browser fox…</p>}<button className="explorer-inline-action" onClick={()=>window.dispatchEvent(new Event('pe-open-achievements'))}><Medal size={15}/>Your badges</button></div></section>
   <details className="explorer-participation"><summary>About optional participation</summary><p>Explore every current world without signing in. Sign-in is only for people who choose to share discoveries on the board.</p><p>Your fox belongs to this browser. A public X or GitHub link on a fox is self-declared, not account verification. Personal discovery badges are saved on this device and do not count as verified game scores.</p><a href="/privacy">Privacy & your data <ArrowUpRight size={13}/></a></details>
   <footer className="explorer-board-footer"><span>Looking for the games?</span><button onClick={()=>setShelves(true)}>Open the world shelves <ArrowUpRight size={15}/></button></footer>
   {message&&<p role="status" className="explorer-message">{message}</p>}
  </div>
  {shelves&&<PortalDirectory current="leaderboard" onClose={()=>setShelves(false)} pulse={pulse} onFavorite={saveWorld} initialView="shelves"/>}
 </main>;
}

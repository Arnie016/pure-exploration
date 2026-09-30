'use client';
import {useEffect,useRef,useState} from 'react';
import {loadExplorerClerk,type ExplorerClerk} from './sign-in';
export type ExplorerRow={id:string;alias:string;worlds:number;rank:number};
type Profile={id:string;alias:string;visible:number}|null;
export function Participation({onRows}:{onRows:(rows:ExplorerRow[])=>void}){
 const [key,setKey]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[signed,setSigned]=useState(false),[profile,setProfile]=useState<Profile>(null),[alias,setAlias]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const clerk=useRef<ExplorerClerk|null>(null),unlisten=useRef<(()=>void)|null>(null),rowsHandler=useRef(onRows);rowsHandler.current=onRows;
 useEffect(()=>{let live=true;fetch('/api/explorers').then(async r=>{if(!r.ok)throw new Error();return r.json() as Promise<{rows:ExplorerRow[];publishableKey:string|null}>;}).then(data=>{if(!live)return;rowsHandler.current(data.rows);setKey(data.publishableKey);setLoaded(true);}).catch(()=>{if(live){setLoaded(true);setMessage('The board could not connect. Reload to try again.');}});return()=>{live=false;unlisten.current?.();};},[]);
 async function action(kind:string){
  const token=await clerk.current?.session?.getToken();if(!token)throw new Error('Sign in to manage your profile.');
  const r=await fetch('/api/explorers',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:kind,...(kind==='join'?{alias}: {})})});const data=await r.json() as {error?:string;profile:Profile;rows?:ExplorerRow[]};if(!r.ok)throw new Error(data.error||'Your profile could not update.');setProfile(data.profile);if(data.profile)setAlias(data.profile.alias);if(data.rows)rowsHandler.current(data.rows);
 }
 async function signIn(){setBusy(true);setMessage('');try{
  if(!key)throw new Error('Optional sign-in is not connected yet.');
  if(!clerk.current){const instance=await loadExplorerClerk(key);clerk.current=instance;unlisten.current=instance.addListener(({session})=>{setSigned(!!session);if(session)void action('status').catch(e=>setMessage(e.message));else setProfile(null);});}
  if(clerk.current.session){setSigned(true);await action('status');}else clerk.current.openSignIn({fallbackRedirectUrl:'/leaderboard'});
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function manage(kind:string){setBusy(true);setMessage('');try{await action(kind);setMessage(kind==='leave'?'You are hidden from the board.':kind==='delete'?'Your public profile and shared discoveries were deleted.':kind==='join'?'You joined the board.':'Your discoveries are up to date.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="explorer-opt-in" aria-labelledby="participate-title"><h2 id="participate-title">Join if you feel like competing.</h2><p>Every world is open without an account. Joining shares your chosen name and the worlds you have discovered. Your email, notes and captures stay off the board.</p>
 {!signed?<><button disabled={busy||!key} onClick={()=>void signIn()}>{busy?'Opening sign-in…':'Sign in to join'}</button>{loaded&&!key&&<p className="explorer-connection">Optional sign-in is being connected. Keep exploring in the meantime.</p>}</>:<>
 {profile?.visible?<div className="explorer-membership"><strong>On the board as {profile.alias}</strong><button disabled={busy} onClick={()=>void manage('sync')}>Share latest discoveries</button><button disabled={busy} onClick={()=>void manage('leave')}>Leave the board</button></div>:<form onSubmit={e=>{e.preventDefault();if(consent)void manage('join');}}><label>Explorer name<input required minLength={2} maxLength={28} value={alias} onChange={e=>setAlias(e.target.value)} autoComplete="nickname"/></label><label className="explorer-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Show my name and discovery count on the public board.</label><button disabled={busy||!consent} type="submit">Join the board</button></form>}
 <div className="explorer-account-actions">{profile&&<button disabled={busy} onClick={()=>void manage('delete')}>Delete shared profile</button>}<button disabled={busy} onClick={()=>void clerk.current?.signOut().then(()=>{setSigned(false);setProfile(null);})}>Sign out</button></div></>}
 {message&&<p role="status">{message}</p>}<details><summary>How ranks work</summary><p>Each distinct world discovered counts once. Matching counts share a rank. These are exploration milestones, not competitive game scores. Use “Share latest discoveries” to add this browser’s latest visits. Leaving hides your profile; deleting removes its shared discoveries. Signing out alone does not hide your place.</p></details></section>;
}

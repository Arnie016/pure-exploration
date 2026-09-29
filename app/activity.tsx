'use client';
import{trackOptionalAnalytics}from'./components/google-analytics';
import{useEffect,useState}from'react';import{Activity,Eye,ArrowUpRight,Heart}from'lucide-react';
export type Person={id:string;alias:string;color:string;link:string;x?:number;z?:number};
export type Pulse={active:number;visits:number;shares:number;explorations:number;ranking:{project:string;visits:number;opens:number;shares:number}[];favorites:{project:string;favorites:number}[];saved:string[];journey:{project:string;visits:number;opens:number;updated:number}[];me:Person};
let sessionReady:Promise<unknown>|null=null;
export async function api<T=Record<string,unknown>>(route:string,data:unknown):Promise<T>{const r=await fetch('/api/'+route,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json() as T&{error?:string};if(!r.ok)throw new Error(result.error||'Connection interrupted. Please try again.');return result;}
export function track(name:string,project='telescope'){if(typeof window==='undefined')return;trackOptionalAnalytics(name,project);void(sessionReady||Promise.resolve()).then(()=>api('event',{name,project})).catch(()=>{});}
export function usePulse(project='telescope'){
 const[pulse,setPulse]=useState<Pulse|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;const update=async()=>{if(document.hidden)return;try{sessionReady=api<Pulse>('pulse',{project});const data=await sessionReady as Pulse;if(live){setPulse(data);setError(false);}}catch{if(live)setError(true);}};void update();const timer=setInterval(update,30000);document.addEventListener('visibilitychange',update);window.addEventListener('pe-refresh',update);return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('pe-refresh',update);};},[project]);
 async function favorite(id:string){if(!pulse)throw new Error('Wait for the world to connect.');const data=await api<Pulse>('favorite',{project:id,active:!pulse.saved.includes(id)});setPulse(data);trackOptionalAnalytics(data.saved.includes(id)?'favorite':'unfavorite',id);return data.saved.includes(id);}
 return{pulse,error,favorite};
}
export function Favorite({id,pulse,onFavorite}:{id:string;pulse:Pulse|null;onFavorite:(id:string)=>void}){const selected=pulse?.saved?.includes(id),count=pulse?.favorites?.find(f=>f.project===id)?.favorites;return <button className="favorite" aria-label={selected?'Remove from favorites':'Favorite this world'} aria-pressed={!!selected} onClick={()=>onFavorite(id)}><Heart size={15} fill={selected?'currentColor':'none'}/><span>{count??'—'}</span></button>;}

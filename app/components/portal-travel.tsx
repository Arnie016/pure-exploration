'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {projects,worldHref} from '../projects';
const trailKey='pe-world-trail';
export function travelTo(href:string){window.dispatchEvent(new CustomEvent('pe-travel',{detail:href}));}
export function previousWorld(){try{const trail=JSON.parse(sessionStorage.getItem(trailKey)||'[]') as string[];trail.pop();sessionStorage.setItem(trailKey,JSON.stringify(trail));return trail.at(-1)||'/?walk=1';}catch{return '/?walk=1';}}
export default function PortalTravel(){
 const route=usePathname();
 const [destination,setDestination]=useState<{title:string;image?:string}|null>(null);
 useEffect(()=>{
  setDestination(null);
  const path=location.pathname+location.search;
  try{const trail=JSON.parse(sessionStorage.getItem(trailKey)||'[]') as string[];if(trail.at(-1)!==path){trail.push(path);sessionStorage.setItem(trailKey,JSON.stringify(trail.slice(-30)));}}catch{/* Navigation does not depend on storage. */}
  let leaving=false,timer:ReturnType<typeof setTimeout>|undefined;
  const depart=(href:string)=>{if(leaving)return;const target=new URL(href,location.origin);if(target.origin!==location.origin)return;leaving=true;const project=projects.find(p=>worldHref(p).split('?')[0]===target.pathname);window.dispatchEvent(new CustomEvent('pe-sound',{detail:{kind:'portal',worldId:project?.id||'garden'}}));setDestination({title:project?.title||(target.pathname==='/'?'The lobby':'The curiosity index'),image:project?.image});timer=setTimeout(()=>location.assign(target.href),matchMedia('(prefers-reduced-motion: reduce)').matches?0:520);};
  const click=(e:MouseEvent)=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=(e.target as Element)?.closest?.('a');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;const url=new URL(a.href,location.origin);if(url.origin!==location.origin||url.href===location.href)return;if(url.pathname==='/'||url.pathname==='/leaderboard'||projects.some(p=>worldHref(p).split('?')[0]===url.pathname)){e.preventDefault();depart(url.pathname+url.search+url.hash);}};
  const custom=(e:Event)=>depart((e as CustomEvent<string>).detail);const reset=()=>{leaving=false;setDestination(null);};document.addEventListener('click',click);window.addEventListener('pe-travel',custom);window.addEventListener('pageshow',reset);
  return()=>{if(timer)clearTimeout(timer);document.removeEventListener('click',click);window.removeEventListener('pe-travel',custom);window.removeEventListener('pageshow',reset);};
 },[route]);
 return destination?<div className="portal-transit" role="status" aria-live="polite">{destination.image&&<img src={destination.image} alt=""/>}<div className="transit-aperture"><i/><i/><i/></div><div className="transit-caption"><small>THROUGH THE PORTAL</small><strong>{destination.title}</strong></div></div>:null;
}

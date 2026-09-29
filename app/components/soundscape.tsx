'use client';
import{useEffect,useRef,useState}from'react';
import{usePathname}from'next/navigation';
import{Volume2,VolumeX}from'lucide-react';
import{SoundDirector}from'../audio/director';
import{defaultSoundSettings,readSoundSettings,soundStorageKey,type SoundSettings}from'../audio/score';

export function SoundToggle(){
 const[enabled,setEnabled]=useState(false);
 useEffect(()=>{try{setEnabled(readSoundSettings(localStorage.getItem(soundStorageKey)).enabled);}catch{}const sync=(event:Event)=>setEnabled(!!(event as CustomEvent).detail?.enabled);window.addEventListener('pe-sound-state',sync);return()=>window.removeEventListener('pe-sound-state',sync);},[]);
 return <button aria-label={enabled?'Mute sound':'Unmute sound'} title={enabled?'Mute sound':'Unmute sound'} aria-pressed={enabled} onClick={()=>window.dispatchEvent(new Event('pe-toggle-sound'))}>{enabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>;
}
/** One master switch for the hub and same-origin game soundtracks. */
export default function Soundscape(){
 const path=usePathname()||'/',director=useRef<SoundDirector|null>(null),settingsRef=useRef<SoundSettings>(defaultSoundSettings),pathRef=useRef(path),[error,setError]=useState('');
 useEffect(()=>{
  const audio=new SoundDirector();director.current=audio;let saved=defaultSoundSettings;try{saved=readSoundSettings(localStorage.getItem(soundStorageKey));}catch{}settingsRef.current=saved;audio.setSettings(saved);audio.setRoute(pathRef.current);
  const publish=()=>{window.dispatchEvent(new CustomEvent('pe-sound-state',{detail:{enabled:settingsRef.current.enabled}}));for(const frame of document.querySelectorAll('iframe')){try{if(frame.contentWindow&&new URL(frame.src,location.href).origin===location.origin)frame.contentWindow.postMessage({type:'pe-master-sound',enabled:settingsRef.current.enabled},location.origin);}catch{}}};
  const toggle=()=>{setError('');const next={...settingsRef.current,enabled:!settingsRef.current.enabled};settingsRef.current=next;audio.setSettings(next);try{localStorage.setItem(soundStorageKey,JSON.stringify(next));}catch{}publish();if(next.enabled)void audio.unlock().then(ok=>{if(!ok)setError('Sound could not start. Tap unmute again when this tab is active.');});};
  const gesture=(event:Event)=>{if(event.isTrusted&&settingsRef.current.enabled&&!audio.running)void audio.unlock();};
  const sound=(event:Event)=>{const kind=(event as CustomEvent).detail?.kind;if(typeof kind==='string')audio.cue(kind);};
  const proximity=(event:Event)=>{const detail=(event as CustomEvent).detail;if(typeof detail?.worldId==='string'&&typeof detail.distance==='number'&&pathRef.current==='/')audio.proximity(detail.worldId,detail.distance);};
  const visibility=()=>{void audio.setHidden(document.hidden);};
  const media=()=>audio.setDucked([...document.querySelectorAll<HTMLMediaElement>('audio,video')].some(el=>!el.paused&&!el.ended&&!el.muted&&el.volume>0));
  window.addEventListener('pe-toggle-sound',toggle);window.addEventListener('pe-sound',sound);window.addEventListener('pe-portal-proximity',proximity);window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);document.addEventListener('visibilitychange',visibility);document.addEventListener('load',publish,true);for(const name of['play','pause','ended','volumechange'])document.addEventListener(name,media,true);publish();visibility();
  return()=>{window.removeEventListener('pe-toggle-sound',toggle);window.removeEventListener('pe-sound',sound);window.removeEventListener('pe-portal-proximity',proximity);window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('load',publish,true);for(const name of['play','pause','ended','volumechange'])document.removeEventListener(name,media,true);audio.dispose();director.current=null;};
 },[]);
 useEffect(()=>{pathRef.current=path;director.current?.setRoute(path);},[path]);
 useEffect(()=>{if(!error)return;const timer=setTimeout(()=>setError(''),5000);return()=>clearTimeout(timer);},[error]);
 return error?<div className="toast" role="status">{error}</div>:null;
}

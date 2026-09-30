'use client';
import{useEffect,useRef,useState}from'react';
import{usePathname}from'next/navigation';
import{createPortal}from'react-dom';
import{Volume2,VolumeX,X,Music,Sparkles}from'lucide-react';
import './soundscape.css';
import{SoundDirector}from'../audio/director';
import{defaultSoundSettings,readSoundSettings,soundStorageKey,type SoundSettings}from'../audio/score';

export function SoundToggle(){
 const[settings,setSettings]=useState(defaultSoundSettings),[open,setOpen]=useState(false);
 useEffect(()=>{try{setSettings(readSoundSettings(localStorage.getItem(soundStorageKey)));}catch{}const sync=(event:Event)=>{const detail=(event as CustomEvent).detail;setSettings(old=>({...old,...detail}));};window.addEventListener('pe-sound-state',sync);return()=>window.removeEventListener('pe-sound-state',sync);},[]);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open]);
 const change=(key:'music'|'effects',value:number)=>window.dispatchEvent(new CustomEvent('pe-sound-settings',{detail:{[key]:value}}));
 return <><button aria-label="Sound settings" title="Sound settings" aria-expanded={open} onClick={()=>setOpen(true)}>{settings.enabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>{open&&createPortal(<div className="sound-backdrop"><button className="sound-scrim" aria-label="Close sound settings" onClick={()=>setOpen(false)}/><section className="sound-panel" role="dialog" aria-modal="true" aria-label="Sound settings"><button className="sound-close" aria-label="Close sound settings" onClick={()=>setOpen(false)}><X size={17}/></button><span className="sound-eyebrow">THE SOUND OF EXPLORING</span><h2>Let the world breathe.</h2><p>One sound switch for the garden and its games.</p><button className="sound-toggle" aria-pressed={settings.enabled} onClick={()=>window.dispatchEvent(new Event('pe-toggle-sound'))}>{settings.enabled?<Volume2/>:<VolumeX/>}<span>{settings.enabled?'Sound is on':'Turn sound on'}<small>{settings.enabled?'Tap to rest quietly':'Your world starts quietly'}</small></span></button>{(['music','effects'] as const).map(key=><label className="sound-level" key={key}><span>{key==='music'?<Music size={15}/>:<Sparkles size={15}/>} {key==='music'?'Music':'Little sounds'}<output>{Math.round(settings[key]*100)}%</output></span><input aria-label={key==='music'?'Music volume':'Sound effects volume'} type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}<p className="sound-footnote">Sound rests when you leave the tab. Each game keeps its own mix.</p></section></div>,document.body)}</>;
}
/** One master switch for the hub and same-origin game soundtracks. */
export default function Soundscape(){
 const path=usePathname()||'/',director=useRef<SoundDirector|null>(null),settingsRef=useRef<SoundSettings>(defaultSoundSettings),pathRef=useRef(path),[error,setError]=useState('');
 useEffect(()=>{
  const audio=new SoundDirector();director.current=audio;let saved=defaultSoundSettings;try{saved=readSoundSettings(localStorage.getItem(soundStorageKey));}catch{}settingsRef.current=saved;audio.setSettings(saved);audio.setRoute(pathRef.current);
  const publish=()=>{window.dispatchEvent(new CustomEvent('pe-sound-state',{detail:{...settingsRef.current}}));for(const frame of document.querySelectorAll('iframe')){try{if(frame.contentWindow&&new URL(frame.src,location.href).origin===location.origin)frame.contentWindow.postMessage({type:'pe-master-sound',...settingsRef.current},location.origin);}catch{}}};
  const toggle=()=>{setError('');const next={...settingsRef.current,enabled:!settingsRef.current.enabled};settingsRef.current=next;audio.setSettings(next);try{localStorage.setItem(soundStorageKey,JSON.stringify(next));}catch{}publish();if(next.enabled)void audio.unlock().then(ok=>{if(!ok)setError('Sound could not start. Tap unmute again when this tab is active.');});};
  const update=(event:Event)=>{const detail=(event as CustomEvent).detail,next=readSoundSettings(JSON.stringify({...settingsRef.current,...detail}));settingsRef.current=next;audio.setSettings(next);try{localStorage.setItem(soundStorageKey,JSON.stringify(next));}catch{}publish();};
  const gesture=(event:Event)=>{if(event.isTrusted&&settingsRef.current.enabled&&!audio.running)void audio.unlock();};
  const sound=(event:Event)=>{const kind=(event as CustomEvent).detail?.kind;if(typeof kind==='string')audio.cue(kind);};
  const proximity=(event:Event)=>{const detail=(event as CustomEvent).detail;if(typeof detail?.worldId==='string'&&typeof detail.distance==='number'&&pathRef.current==='/')audio.proximity(detail.worldId,detail.distance);};
  const visibility=()=>{void audio.setHidden(document.hidden);};
  const media=()=>audio.setDucked([...document.querySelectorAll<HTMLMediaElement>('audio,video')].some(el=>!el.paused&&!el.ended&&!el.muted&&el.volume>0));
  window.addEventListener('pe-sound-settings',update);window.addEventListener('pe-toggle-sound',toggle);window.addEventListener('pe-sound',sound);window.addEventListener('pe-portal-proximity',proximity);window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);document.addEventListener('visibilitychange',visibility);document.addEventListener('load',publish,true);for(const name of['play','pause','ended','volumechange'])document.addEventListener(name,media,true);publish();visibility();
  return()=>{window.removeEventListener('pe-sound-settings',update);window.removeEventListener('pe-toggle-sound',toggle);window.removeEventListener('pe-sound',sound);window.removeEventListener('pe-portal-proximity',proximity);window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('load',publish,true);for(const name of['play','pause','ended','volumechange'])document.removeEventListener(name,media,true);audio.dispose();director.current=null;};
 },[]);
 useEffect(()=>{pathRef.current=path;director.current?.setRoute(path);},[path]);
 useEffect(()=>{if(!error)return;const timer=setTimeout(()=>setError(''),5000);return()=>clearTimeout(timer);},[error]);
 return error?<div className="toast" role="status">{error}</div>:null;
}

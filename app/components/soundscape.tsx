'use client';
import{useEffect,useRef,useState}from'react';
import{usePathname}from'next/navigation';
import{Volume2,VolumeX,X,Music2,Sparkles}from'lucide-react';
import{SoundDirector}from'../audio/director';
import{defaultSoundSettings,moodForWorld,moodNames,musicAllowed,portalBlend,readSoundSettings,soundStorageKey,type SoundMood,type SoundSettings}from'../audio/score';
import'./soundscape.css';

/** Mount once in the root layout. Sound is created only after a trusted gesture. */
export default function Soundscape(){
 const path=usePathname()||'/',director=useRef<SoundDirector|null>(null),settingsRef=useRef<SoundSettings>(defaultSoundSettings),pathRef=useRef(path);
 const[settings,setSettings]=useState<SoundSettings>(defaultSoundSettings),[open,setOpen]=useState(false),[ready,setReady]=useState(false),[mood,setMood]=useState<SoundMood>('garden'),[error,setError]=useState('');
 useEffect(()=>{
  const audio=new SoundDirector();director.current=audio;let saved=defaultSoundSettings;try{saved=readSoundSettings(localStorage.getItem(soundStorageKey));}catch{/* Private browsing still supports sound during this visit. */}settingsRef.current=saved;audio.setSettings(saved);audio.setRoute(pathRef.current);
  const gesture=(event:Event)=>{if(event.isTrusted&&settingsRef.current.enabled&&!audio.running)void audio.unlock().then(setReady);};
  const reveal=()=>{setSettings(settingsRef.current);setReady(audio.running);setOpen(true);};
  const sound=(event:Event)=>{const kind=(event as CustomEvent<{kind?:string}>).detail?.kind;if(typeof kind==='string')audio.cue(kind);};
  const proximity=(event:Event)=>{const detail=(event as CustomEvent<{worldId?:string;distance?:number}>).detail;if(typeof detail?.worldId!=='string'||typeof detail.distance!=='number'||pathRef.current!=='/')return;audio.proximity(detail.worldId,detail.distance);setMood(portalBlend(detail.distance)>.15?moodForWorld(detail.worldId):'garden');};
  const visibility=()=>{void audio.setHidden(document.hidden).then(()=>setReady(audio.running));};
  const media=()=>{const playing=[...document.querySelectorAll<HTMLMediaElement>('audio,video')].some(el=>!el.paused&&!el.ended&&!el.muted&&el.volume>0);audio.setDucked(playing);};
  window.addEventListener('pe-open-sound',reveal);window.addEventListener('pe-sound',sound);window.addEventListener('pe-portal-proximity',proximity);window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);document.addEventListener('visibilitychange',visibility);for(const name of['play','pause','ended','volumechange'])document.addEventListener(name,media,true);visibility();
  return()=>{window.removeEventListener('pe-open-sound',reveal);window.removeEventListener('pe-sound',sound);window.removeEventListener('pe-portal-proximity',proximity);window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);document.removeEventListener('visibilitychange',visibility);for(const name of['play','pause','ended','volumechange'])document.removeEventListener(name,media,true);audio.dispose();director.current=null;};
 },[]);
 useEffect(()=>{pathRef.current=path;director.current?.setRoute(path);},[path]);
 const update=(next:SoundSettings)=>{settingsRef.current=next;setSettings(next);director.current?.setSettings(next);try{localStorage.setItem(soundStorageKey,JSON.stringify(next));}catch{/* Preferences remain available in this visit. */}};
 const toggle=async()=>{setError('');if(settings.enabled&&ready){update({...settings,enabled:false});setReady(false);return;}update({...settings,enabled:true});const unlocked=await director.current?.unlock();setReady(!!unlocked);if(!unlocked)setError('Sound could not start. Try again when this tab is active.');};
 if(!open)return null;
 return <div className="sound-backdrop"><button className="sound-scrim" aria-label="Close sound panel" onClick={()=>setOpen(false)}/><section className="sound-panel" role="dialog" aria-modal="true" aria-labelledby="sound-title">
  <button className="close-modal sound-close" aria-label="Close sound settings" onClick={()=>setOpen(false)}><X size={19}/></button>
  <span className="sound-eyebrow">THE SOUND OF EXPLORING</span><h2 id="sound-title">Let the world breathe.</h2>
  <p>Soft flute in the garden. A new feeling as you approach each portal.</p>
  <button className="sound-toggle" onClick={()=>void toggle()} aria-pressed={settings.enabled&&ready}>{settings.enabled&&ready?<Volume2 size={19}/>:<VolumeX size={19}/>}<span>{settings.enabled&&ready?'Sound is on':settings.enabled?'Resume sound':'Turn sound on'}<small>{settings.enabled&&ready?'Tap to quiet everything':'Your world starts quietly'}</small></span><span className={'sound-indicator '+(settings.enabled&&ready?'active':'')}/></button>
  <label className="sound-level"><span><Music2 size={15}/>Music<output>{Math.round(settings.music*100)}%</output></span><input aria-label="Music volume" type="range" min="0" max="100" value={Math.round(settings.music*100)} onChange={e=>update({...settings,music:Number(e.target.value)/100})}/></label>
  <label className="sound-level"><span><Sparkles size={15}/>Little sounds<output>{Math.round(settings.effects*100)}%</output></span><input aria-label="Sound effects volume" type="range" min="0" max="100" value={Math.round(settings.effects*100)} onChange={e=>update({...settings,effects:Number(e.target.value)/100})}/></label>
  <div className="sound-now"><span>{musicAllowed(path)?moodNames[path==='/telescope'?'curiosity':mood]:'This world keeps its own soundtrack'}</span><button disabled={!settings.enabled||!ready} onClick={()=>director.current?.cue('favorite')}>Try a chime</button></div>
  {error&&<p className="sound-error" role="status">{error}</p>}
  <p className="sound-footnote">Sound rests when you leave the tab. Every cue has a visible companion.</p>
 </section></div>;
}

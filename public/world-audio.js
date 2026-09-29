/* Shared master mute for local worlds. No tracking or network requests. */
(()=>{
 if(window.parent===window)return;
 let enabled=false;try{enabled=JSON.parse(localStorage.getItem('pure-exploration-sound-v1')||'{}').enabled===true;}catch{}
 const contexts=new Set(),held=new Set(),media=new Set(),intent=new WeakMap();
 for(const name of['AudioContext','webkitAudioContext']){
  const Original=window[name];if(!Original)continue;
  window[name]=class extends Original{
   constructor(...args){super(...args);contexts.add(this);if(!enabled){held.add(this);void super.suspend().catch(()=>{});}}
   resume(){if(!enabled){held.add(this);return Promise.resolve();}held.delete(this);return super.resume();}
   suspend(){held.delete(this);return super.suspend();}
   close(){contexts.delete(this);held.delete(this);return super.close();}
   masterMute(){if(this.state==='running'){held.add(this);void super.suspend().catch(()=>{});}}
   masterResume(){if(held.has(this)){held.delete(this);void super.resume().catch(()=>{});}}
  };
 }
 const muted=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'muted');
 if(muted?.get&&muted?.set){
  Object.defineProperty(HTMLMediaElement.prototype,'muted',{...muted,set(value){intent.set(this,!!value);media.add(this);muted.set.call(this,enabled?!!value:true);}});
  document.addEventListener('play',event=>{const el=event.target;if(el instanceof HTMLMediaElement){media.add(el);if(!intent.has(el))intent.set(el,muted.get.call(el));if(!enabled)muted.set.call(el,true);}},true);
 }
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='pe-master-sound'||typeof event.data.enabled!=='boolean')return;
  enabled=event.data.enabled;
  for(const ctx of contexts)enabled?ctx.masterResume():ctx.masterMute();
  if(muted?.set)for(const el of media)muted.set.call(el,enabled?(intent.get(el)??false):true);
 });
})();

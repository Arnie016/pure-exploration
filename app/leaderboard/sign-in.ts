// Clerk loads only after the explorer explicitly chooses sign-in.
export interface ExplorerClerk {
 session:null|{getToken():Promise<string|null>};
 load(options:{ui:{ClerkUI:unknown}}):Promise<void>;
 openSignIn(options:{fallbackRedirectUrl:string}):void;
 signOut():Promise<void>;
 addListener(listener:(data:{session:ExplorerClerk['session']})=>void):()=>void;
}
let loading:Promise<ExplorerClerk>|null=null;
export function loadExplorerClerk(key:string){
 if(loading)return loading;
 loading=(async()=>{
  const host=atob(key.split('_')[2]||'').slice(0,-1);
  if(!/^[a-z0-9.-]+$/i.test(host)||!host.includes('.'))throw new Error('Sign-in configuration needs attention.');
  const win=window as unknown as {Clerk?:ExplorerClerk;__internal_ClerkUICtor?:unknown};
  async function script(path:string,publishable=false){await new Promise<void>((resolve,reject)=>{const tag=document.createElement('script');tag.src=`https://${host}/npm/${path}`;tag.async=true;tag.crossOrigin='anonymous';if(publishable)tag.setAttribute('data-clerk-publishable-key',key);const timer=setTimeout(()=>{tag.remove();reject(new Error('Sign-in timed out. Try again.'));},15000);tag.onload=()=>{clearTimeout(timer);resolve();};tag.onerror=()=>{clearTimeout(timer);tag.remove();reject(new Error('Sign-in could not load. Try again.'));};document.head.appendChild(tag);});}
  if(!win.__internal_ClerkUICtor)await script('@clerk/ui@1/dist/ui.browser.js');
  if(!win.Clerk)await script('@clerk/clerk-js@6/dist/clerk.browser.js',true);
  if(!win.Clerk||!win.__internal_ClerkUICtor)throw new Error('Sign-in could not load. Try again.');
  await win.Clerk.load({ui:{ClerkUI:win.__internal_ClerkUICtor}});return win.Clerk;
 })().catch(e=>{loading=null;throw e;});return loading;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import './google-analytics.css';

export const GA_MEASUREMENT_ID='G-2S2XBBNT6N';
export const ANALYTICS_ORIGIN='https://pure-exploration.arnz.chatgpt.site';
export const CONSENT_KEY='pe-optional-analytics-v1';
export type AnalyticsChoice='accepted'|'declined'|null;
const preferenceEvent='pe-analytics-preference';
const worlds=new Set(['garden','telescope','airport','spacetime','lightning','skyline','galevein','aeolith','universe-clash','tides','edge-universe','poe','fable-flight']);
const publicPages=new Set(['/','/telescope','/airport','/spacetime','/leaderboard','/privacy']);
const events:Record<string,string>={project_open:'world_open',first_interaction:'world_interaction',share:'world_share',follow:'follow_x_click',clip:'capture_video',screenshot:'capture_image',chapter:'lesson_open',tour:'tour_start',favorite:'world_favorite',unfavorite:'world_unfavorite'};
export function analyticsPage(path:string):string|null{const clean=path.split(/[?#]/)[0];if(publicPages.has(clean))return ANALYTICS_ORIGIN+clean;const slug=clean.match(/^\/world\/([a-z0-9-]+)$/)?.[1];return slug&&worlds.has(slug)?ANALYTICS_ORIGIN+clean:null;}
export function analyticsEvent(name:string,world:string){return Object.hasOwn(events,name)&&worlds.has(world)?{name:events[name],world_id:world}:null;}
export function privacySignal(nav:{globalPrivacyControl?:boolean;doNotTrack?:string|null},windowDnt?:string|null){return nav.globalPrivacyControl===true||['1','yes'].includes(nav.doNotTrack||'')||['1','yes'].includes(windowDnt||'');}
export function analyticsAllowed(choice:AnalyticsChoice,origin:string,blocked:boolean,id=GA_MEASUREMENT_ID){return choice==='accepted'&&origin===ANALYTICS_ORIGIN&&!blocked&&/^G-[A-Z0-9]+$/.test(id);}

type Gtag=(...args:unknown[])=>void;
type AnalyticsWindow=Window&{dataLayer?:unknown[];gtag?:Gtag;doNotTrack?:string;[key:`ga-disable-${string}`]:boolean};
let memoryChoice:AnalyticsChoice=null,configured=false,loaded=false,lastPage:string|null=null;
function windowState(){return window as unknown as AnalyticsWindow;}
function blockedByBrowser(){return privacySignal(navigator as Navigator&{globalPrivacyControl?:boolean},windowState().doNotTrack);}
export function readAnalyticsChoice():AnalyticsChoice{if(typeof window==='undefined')return null;try{const value=localStorage.getItem(CONSENT_KEY);return value==='accepted'||value==='declined'?value:null;}catch{return memoryChoice;}}
function allowed(){return typeof window!=='undefined'&&analyticsAllowed(readAnalyticsChoice(),location.origin,blockedByBrowser())&&analyticsPage(location.pathname)!==null;}
function removeAnalyticsCookies(){if(location.origin!==ANALYTICS_ORIGIN)return;for(const cookie of document.cookie.split(';')){const name=cookie.trim().split('=')[0];if(!/^_ga(?:_|$)/.test(name))continue;document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;document.cookie=`${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=Lax; Secure`;}}
function disable(){if(typeof window==='undefined')return;windowState()[`ga-disable-${GA_MEASUREMENT_ID}`]=true;lastPage=null;removeAnalyticsCookies();if(!loaded){const script=document.getElementById('pe-google-analytics');script?.remove();windowState().dataLayer?.splice(0);configured=false;}}
export function setAnalyticsChoice(choice:Exclude<AnalyticsChoice,null>){memoryChoice=choice;try{localStorage.setItem(CONSENT_KEY,choice);}catch{/* The choice still applies to this open page. */}if(choice==='declined'||blockedByBrowser())disable();window.dispatchEvent(new Event(preferenceEvent));}
function initialize(page:string){
 const w=windowState();w[`ga-disable-${GA_MEASUREMENT_ID}`]=false;if(configured)return;
 configured=true;w.dataLayer=w.dataLayer||[];w.gtag=function(..._args:unknown[]){w.dataLayer!.push(arguments);};
 w.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 w.gtag('js',new Date());
 w.gtag('config',GA_MEASUREMENT_ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:page,page_referrer:'',page_title:'Pure Exploration',cookie_domain:location.hostname,cookie_path:'/',cookie_expires:7776000,cookie_flags:'SameSite=Lax;Secure'});
 const script=document.createElement('script');script.id='pe-google-analytics';script.async=true;script.referrerPolicy='no-referrer';script.src=`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
 script.onload=()=>{loaded=true;if(!allowed())disable();};script.onerror=()=>{configured=false;script.remove();};document.head.appendChild(script);
}
function pageView(path:string){const page=analyticsPage(path);if(!allowed()||!page){disable();return;}initialize(page);if(lastPage===page)return;lastPage=page;const params={page_location:page,page_referrer:'',page_title:'Pure Exploration'};windowState().gtag?.('set',params);windowState().gtag?.('event','page_view',{...params,send_to:GA_MEASUREMENT_ID});}
export function trackOptionalAnalytics(name:string,world:string){const event=analyticsEvent(name,world);if(!event||!allowed()||!configured)return;windowState().gtag?.('event',event.name,{world_id:event.world_id,send_to:GA_MEASUREMENT_ID,page_location:analyticsPage(location.pathname),page_referrer:'',page_title:'Pure Exploration'});}

function usePreference(){const[choice,setChoice]=useState<AnalyticsChoice>(null),[blocked,setBlocked]=useState(false),[ready,setReady]=useState(false);useEffect(()=>{const refresh=()=>{setChoice(readAnalyticsChoice());setBlocked(blockedByBrowser());setReady(true);};refresh();window.addEventListener(preferenceEvent,refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener(preferenceEvent,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};},[]);return{choice,blocked,ready};}
export function AnalyticsPreferences(){const{choice,blocked,ready}=usePreference();return <section className="analytics-preferences" aria-label="Optional analytics preferences"><h3>Optional Google Analytics</h3><p role="status">{!ready?'Checking this browser’s choice…':blocked?'Off — your browser’s privacy signal takes priority.':choice==='accepted'?'You have allowed optional analytics.':choice==='declined'?'Off — you chose not to share optional analytics.':'Off — you haven’t opted in.'}</p><p>This choice affects Google Analytics only. Favorites, the shared garden and site counts still work.</p><div className="analytics-choice-actions"><button disabled={!ready||blocked} aria-pressed={choice==='accepted'&&!blocked} onClick={()=>setAnalyticsChoice('accepted')}>Allow analytics</button><button disabled={!ready} aria-pressed={choice==='declined'||blocked} onClick={()=>setAnalyticsChoice('declined')}>Keep analytics off</button></div></section>;}
export default function GoogleAnalytics(){const path=usePathname(),{choice,blocked,ready}=usePreference(),pathRef=useRef(path);pathRef.current=path;
 useEffect(()=>{if(!ready)return;pageView(path||'/');},[path,choice,blocked,ready]);
 useEffect(()=>{const refresh=()=>pageView(pathRef.current||'/');window.addEventListener(preferenceEvent,refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener(preferenceEvent,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};},[]);
 if(!ready||choice!==null||blocked||location.origin!==ANALYTICS_ORIGIN||!GA_MEASUREMENT_ID||!analyticsPage(path||'/')||path==='/privacy')return null;
 return <aside className="analytics-consent" aria-label="Optional analytics"><strong>A little insight?</strong><p>Allow Google Analytics to help Arnav improve these worlds? Exploring works either way.</p><div className="analytics-choice-actions"><button onClick={()=>setAnalyticsChoice('accepted')}>Accept</button><button onClick={()=>setAnalyticsChoice('declined')}>No thanks</button></div><a href="/privacy">Privacy & change your choice</a></aside>;
}

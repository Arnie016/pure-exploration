'use client';
import {useEffect,useRef,useState} from 'react';
export function captureSource(selector:string):HTMLCanvasElement|HTMLVideoElement|null {
 if(selector!=='iframe-world')return document.querySelector<HTMLCanvasElement>(selector);
 try{return [...(document.querySelector<HTMLIFrameElement>('.external-frame')?.contentDocument?.querySelectorAll<HTMLCanvasElement|HTMLVideoElement>('canvas,video')||[])].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0;}).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0]||null;}catch{return null;}
}
export function sourceSize(source:HTMLCanvasElement|HTMLVideoElement|ImageBitmap){return typeof ImageBitmap!=='undefined'&&source instanceof ImageBitmap?[source.width,source.height]:'tagName' in source&&source.tagName==='VIDEO'?[(source as HTMLVideoElement).videoWidth,(source as HTMLVideoElement).videoHeight]:[source.width,source.height];}
type BufferedFrame={at:number;blob:Blob};
/** A bounded, compressed ten-second cache. It never leaves this browser. */
export function useReplayBuffer(selector:string,enabled:boolean,world=''){
 const frames=useRef<BufferedFrame[]>([]),[ready,setReady]=useState(false);
 useEffect(()=>{frames.current=[];setReady(false);if(!enabled)return;let disposed=false,busy=false;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;canvas.width=matchMedia('(max-width:600px)').matches?480:640;canvas.height=Math.round(canvas.width*9/16);const tick=setInterval(()=>{if(disposed||busy||document.hidden)return;const source=captureSource(selector);if(!source)return;const [w,h]=sourceSize(source);if(!w||!h)return;busy=true;try{ctx.fillStyle='#071117';ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/w,canvas.height/h);ctx.drawImage(source,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);const at=performance.now();canvas.toBlob(blob=>{busy=false;if(disposed||!blob)return;if(frames.current.length&&at-frames.current.at(-1)!.at>750)frames.current=[];frames.current.push({at,blob});frames.current=frames.current.filter(f=>f.at>=at-10000).slice(-72);setReady((frames.current.at(-1)!.at-frames.current[0].at)>9400);},'image/jpeg',.8);}catch{busy=false;}},150);return()=>{disposed=true;clearInterval(tick);frames.current=[];};},[selector,enabled,world]);
 const snapshot=()=>{const now=performance.now();const copy=frames.current.filter(f=>now-f.at<=10200);if(copy.length<2||copy.at(-1)!.at-copy[0].at<9000)throw new Error('Stay in this world for ten seconds to save a replay.');return copy;};
 return{ready,snapshot};
}

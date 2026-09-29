'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
export type HoleView={inclination:number;spin:number;brightness:number;lensing:boolean;paused:boolean;quality:'balanced'|'detail'};
const fragment=`
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;
uniform float uTime,uInclination,uYaw,uSpin,uBrightness,uLensing;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 sky(vec3 d){
 float fog=noise(d*3.4)*.5+noise(d*9.)*.25;float gal=pow(max(0.,1.-abs(d.y*.8+d.x*.32)),12.);
 vec3 color=vec3(.006,.012,.023)+vec3(.035,.037,.067)*fog*gal;
 vec3 grid=floor(d*280.);vec3 f=fract(d*280.)-.5;float star=pow(max(0.,1.-length(f)*2.5),10.)*step(.989,hash(grid));
 float warm=hash(grid+30.);color+=star*mix(vec3(.6,.78,1.15),vec3(1.5,1.12,.67),warm)*2.5;
 return color;
}
vec4 disk(vec3 p,vec3 ray){
 float r=length(p.xz);if(r<3.02||r>12.8)return vec4(0.);
 float angle=atan(p.z,p.x),rotation=uTime*(.15+uSpin*.65)/pow(r/3.,1.5);
 float filament=sin(r*36.+sin(angle*9.-rotation*7.)*.6+noise(vec3(p.x*.8,p.z*.8,uTime*.07))*2.);
 float lanes=.62+.2*filament+.18*sin(r*14.-angle*2.+rotation*5.);
 float edge=smoothstep(3.02,3.32,r)*(1.-smoothstep(10.,12.8,r));
 float heat=pow(3.1/r,1.2);vec3 tint=mix(vec3(.57,.11,.028),vec3(1.6,1.08,.54),heat);
 vec3 tangent=normalize(vec3(-p.z,0.,p.x));float beaming=1.+dot(tangent,-normalize(ray))*.58*uSpin;
 float texture=noise(vec3(cos(angle-rotation)*r*.8,sin(angle-rotation)*r*.8,r*1.4));
 float energy=lanes*(.8+.45*texture)*edge*(.55+heat*1.25)*beaming*uBrightness;
 return vec4(tint*energy,edge*.88);
}
void main(){
 vec2 screen=(vUv-.5)*2.;screen.x*=uSize.x/uSize.y;screen.y+=.03;
 float inc=radians(uInclination);vec3 origin=vec3(sin(inc)*sin(uYaw),cos(inc),sin(inc)*cos(uYaw))*27.;
 vec3 forward=normalize(-origin),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
 vec3 ray=normalize(forward+screen.x*.41*right+screen.y*.41*up),p=origin,v=ray;
 float angular=length(cross(p,v)),L2=angular*angular;vec3 color=vec3(0.);float transmission=1.,minimumRadius=50.;bool captured=false;
 for(int i=0;i<230;i++){
  float r=length(p);minimumRadius=min(minimumRadius,r);if(r<1.015){captured=true;break;}if(r>42.)break;
  float ds=clamp(r*.062,.025,.8);vec3 acceleration=-1.5*L2*p/pow(r,5.)*uLensing;
  vec3 next=p+v*ds+.5*acceleration*ds*ds;float nr=length(next);vec3 nextA=-1.5*L2*next/pow(nr,5.)*uLensing;
  if(p.y*next.y<0.){float fraction=abs(p.y)/(abs(p.y)+abs(next.y));vec3 hit=mix(p,next,fraction);vec4 emission=disk(hit,v);color+=emission.rgb*emission.a*transmission;transmission*=1.-emission.a;if(transmission<.035)break;}
  v+=(acceleration+nextA)*ds*.5;p=next;
 }
 if(!captured)color+=sky(normalize(v))*transmission;
 // A deliberately softened glow makes the thin ray-traced ring readable on small screens.
 float b=angular;float critical=2.598;float rim=exp(-abs(b-critical)*27.)*uLensing;
 color+=vec3(1.,.53,.16)*rim*.21*uBrightness;
 color=1.-exp(-color*1.24);color=pow(color,vec3(.84));
 float vignette=1.-smoothstep(.35,1.6,length((vUv-.5)*1.5))*.35;
 gl_FragColor=vec4(color*vignette,1.);
}`;
export default function BlackHoleScene({view,onInclination}:{view:HoleView;onInclination:(n:number)=>void}){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(view),engine=useRef<{uniforms:Record<string,{value:any}>;resize:()=>void}|null>(null),change=useRef(onInclination),[error,setError]=useState(false);latest.current=view;change.current=onInclination;
 useEffect(()=>{
  if(!mount.current)return;const host=mount.current;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});}catch{setError(true);return;}
  renderer.domElement.setAttribute('aria-label','Accretion disk and bent starlight around a black hole. Drag to orbit.');renderer.domElement.setAttribute('role','img');host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.Camera(),uniforms={uSize:{value:new T.Vector2(1,1)},uTime:{value:0},uInclination:{value:view.inclination},uYaw:{value:0},uSpin:{value:view.spin},uBrightness:{value:view.brightness},uLensing:{value:1}};
  const material=new T.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}',fragmentShader:fragment}),geometry=new T.PlaneGeometry(2,2);scene.add(new T.Mesh(geometry,material));
  const resize=()=>{renderer.setPixelRatio(latest.current.quality==='detail'?Math.min(devicePixelRatio,1.35):Math.min(devicePixelRatio,.8));renderer.setSize(host.clientWidth,host.clientHeight);uniforms.uSize.value.set(host.clientWidth,host.clientHeight);};const ro=new ResizeObserver(resize);ro.observe(host);resize();engine.current={uniforms,resize};
  let pointer:number|null=null,px=0,py=0;const down=(e:PointerEvent)=>{pointer=e.pointerId;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};const move=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;uniforms.uYaw.value-=(e.clientX-px)*.004;const next=Math.max(5,Math.min(87,latest.current.inclination+(e.clientY-py)*.12));change.current(next);px=e.clientX;py=e.clientY;};const end=()=>{pointer=null;};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',end);
  let frame=0,last=0,time=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const loop=(now:number)=>{frame=requestAnimationFrame(loop);const delta=Math.min((now-last)/1000,.05);if(document.hidden){last=now;return;}if(now-last<40)return;last=now;if(!latest.current.paused&&!reduce)time+=delta;uniforms.uTime.value=time;uniforms.uInclination.value=latest.current.inclination;uniforms.uSpin.value=latest.current.spin;uniforms.uBrightness.value=latest.current.brightness;uniforms.uLensing.value=latest.current.lensing?1:0;renderer.render(scene,camera);};frame=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',end);renderer.domElement.removeEventListener('pointercancel',end);geometry.dispose();material.dispose();renderer.dispose();renderer.domElement.remove();engine.current=null;};
 },[]);
 useEffect(()=>engine.current?.resize(),[view.quality]);
 return <div className="spacetime-canvas scene" ref={mount}>{error&&<div className="hole-render-error"><h2>This sky needs WebGL.</h2><p>The light-path diagram and numerical controls still work.</p></div>}</div>;
}

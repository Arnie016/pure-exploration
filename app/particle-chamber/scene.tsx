'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {detectorRadii} from './model.js';

type Hit={layer:number;x:number;y:number;z:number;s:number};
type Sample={x:number;y:number;z:number;s:number};
type Track={id:string;color:string;charge:number;points:Sample[];hits:Hit[]};
export type ChamberEvent={tracks:Track[];available:boolean};
type RenderTrack={line:T.Line;head:T.Mesh;points:T.Vector3[];hits:{mesh:T.Mesh;at:number}[]};
type Controller={load:(data:ChamberEvent)=>void;update:(progress:number,layers:boolean)=>void};

function FlatDetector({data,progress,layers}:{data:ChamberEvent;progress:number;layers:boolean}){
 return <div className="pc-fallback"><svg viewBox="-4 -4 8 8" role="img" aria-label="Top-down particle detector with charged tracks and concentric measurement layers">
 {layers&&detectorRadii.map((r:number)=><circle key={r} cx="0" cy="0" r={r} stroke="#4d7382" strokeWidth=".018" fill="none"/>)}
 {data.tracks.map(t=><g key={t.id}><polyline points={t.points.slice(0,Math.max(1,Math.round(t.points.length*progress))).map(p=>p.x+','+(-p.y)).join(' ')} fill="none" stroke={t.color} strokeWidth=".05" strokeLinecap="round"/>
 {t.hits.filter(h=>h.s<=t.points.at(-1)!.s*progress).map((h,i)=><circle key={i} cx={h.x} cy={-h.y} r=".09" fill={t.color}/>)}</g>)}
 <circle cx="0" cy="0" r=".06" fill="#fff0c8"/></svg><p>2D detector view. This browser could not initialize WebGL, but the physics model and controls still work.</p></div>;
}

export default function ChamberScene({data,progress,layers}:{data:ChamberEvent;progress:number;layers:boolean}){
 const host=useRef<HTMLDivElement>(null),controller=useRef<Controller|null>(null);
 const[failed,setFailed]=useState(false);
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
  catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','Interactive particle detector. Drag to rotate; use the labeled controls to change physical parameters.');
  mount.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(41,1,.1,100);
  camera.position.set(7.4,6.7,9.5);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=6;controls.maxDistance=18;controls.enablePan=false;
  controls.target.set(0,0,0);controls.maxPolarAngle=Math.PI-.2;controls.update();
  scene.add(new T.HemisphereLight(0x82b9c8,0x0a1727,1.5));
  const glow=new T.PointLight(0xf6ba85,35,13);glow.position.set(0,1,0);scene.add(glow);
  const ringGroup=new T.Group(),tracksGroup=new T.Group();
  scene.add(ringGroup,tracksGroup);
  const staticGeo:T.BufferGeometry[]=[],staticMat:T.Material[]=[];
  const register=(geometry:T.BufferGeometry,material:T.Material)=>{staticGeo.push(geometry);staticMat.push(material);return new T.Mesh(geometry,material);};
  const shellMaterial=new T.MeshBasicMaterial({color:0x2a7280,side:T.DoubleSide,transparent:true,opacity:.035,depthWrite:false});
  ringGroup.add(register(new T.CylinderGeometry(3.67,3.67,4.7,96,1,true),shellMaterial));
  detectorRadii.forEach((radius:number,index:number)=>{
   const tint=[0x67c3c6,0xa5b7bc,0xb2a07a][index];
   const ringMaterial=new T.MeshBasicMaterial({color:tint,transparent:true,opacity:.4});
   const rodMaterial=new T.MeshBasicMaterial({color:tint,transparent:true,opacity:.2});
   for(const h of[-2.3,-1.15,0,1.15,2.3]){
    const torus=register(new T.TorusGeometry(radius,.013,5,96),ringMaterial);
    torus.rotation.x=Math.PI/2;torus.position.y=h;ringGroup.add(torus);
   }
   for(let k=0;k<12;k++){
    const a=k*Math.PI/6,rod=register(new T.CylinderGeometry(.009,.009,4.6,5),rodMaterial);
    rod.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);ringGroup.add(rod);
   }
  });
  const railMat=new T.LineBasicMaterial({color:0x49717f,transparent:true,opacity:.35});staticMat.push(railMat);
  for(let k=0;k<20;k++){
   const a=k*Math.PI/10;
   const points=[new T.Vector3(0,-2.36,0),new T.Vector3(Math.cos(a)*3.65,-2.36,Math.sin(a)*3.65)];
   const geometry=new T.BufferGeometry().setFromPoints(points);staticGeo.push(geometry);
   scene.add(new T.Line(geometry,railMat));
  }
  const core=register(new T.SphereGeometry(.12,20,16),new T.MeshBasicMaterial({color:0xfff1cc}));
  scene.add(core);
  const particleSphere=new T.SphereGeometry(.07,12,8),hitSphere=new T.SphereGeometry(.067,10,7);
  staticGeo.push(particleSphere,hitSphere);
  let visible=true,dirty=true,frame=0,previous=0,current:RenderTrack[]=[];
  const createdGeo:T.BufferGeometry[]=[],createdMat:T.Material[]=[];
  function clearTracks(){
   tracksGroup.clear();createdGeo.splice(0).forEach(g=>g.dispose());createdMat.splice(0).forEach(m=>m.dispose());current=[];
  }
  function load(event:ChamberEvent){
   clearTracks();
   event.tracks.forEach(track=>{
    const points=track.points.map(p=>new T.Vector3(p.x,p.z,p.y));
    if(points.length<2)return;
    const geometry=new T.BufferGeometry().setFromPoints(points),material=new T.LineBasicMaterial({color:track.color,transparent:true,opacity:.98});
    createdGeo.push(geometry);createdMat.push(material);
    const line=new T.Line(geometry,material);tracksGroup.add(line);
    const particleMaterial=new T.MeshBasicMaterial({color:track.color});
    createdMat.push(particleMaterial);
    const head=new T.Mesh(particleSphere,particleMaterial);tracksGroup.add(head);
    const hits=track.hits.map(h=>{
     const marker=new T.Mesh(hitSphere,particleMaterial);marker.position.set(h.x,h.z,h.y);tracksGroup.add(marker);
     return {mesh:marker,at:h.s/Math.max(.000001,track.points.at(-1)!.s)};
    });
    current.push({line,head,points,hits});
   });
   dirty=true;
  }
  function update(progress:number,layers:boolean){
   const t=Math.max(0,Math.min(1,progress));ringGroup.visible=layers;
   current.forEach(({line,head,points,hits})=>{
    const index=t*(points.length-1),a=Math.floor(index),b=Math.min(points.length-1,a+1);
    const count=Math.max(0,Math.min(points.length,Math.floor(index)+1));
    line.geometry.setDrawRange(0,count);
    head.visible=t>0;head.position.copy(points[a]).lerp(points[b],index-a);
    hits.forEach(h=>{h.mesh.visible=t>=h.at;});
   });
   dirty=true;
  }
  controller.current={load,update};
  const size=()=>{const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};
  const resize=new ResizeObserver(size);resize.observe(mount);size();
  const intersect=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;dirty=true;});
  intersect.observe(mount);
  const changed=()=>{dirty=true;};controls.addEventListener('change',changed);
  const loop=(time:number)=>{
   frame=requestAnimationFrame(loop);
   if(document.hidden||!visible||time-previous<33)return;
   previous=time;controls.update();
   if(!dirty)return;
   renderer.render(scene,camera);dirty=false;
  };
  frame=requestAnimationFrame(loop);
  load(data);update(progress,layers);
  return ()=>{
   cancelAnimationFrame(frame);intersect.disconnect();resize.disconnect();controls.removeEventListener('change',changed);controls.dispose();
   clearTracks();staticGeo.forEach(g=>g.dispose());staticMat.forEach(m=>m.dispose());
   renderer.dispose();renderer.domElement.remove();controller.current=null;
  };
 // Scene lifecycle is intentionally independent from playback rerenders.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{controller.current?.load(data);controller.current?.update(progress,layers);},[data]);
 useEffect(()=>{controller.current?.update(progress,layers);},[progress,layers]);
 return <div className="pc-webgl" ref={host}>{failed&&<FlatDetector data={data} progress={progress} layers={layers}/>}<div className="pc-scene-caption" aria-hidden="true">SOLENOID B ↑ &nbsp; • &nbsp; ORBIT TO INSPECT &nbsp; • &nbsp; DIMENSIONS IN METRES</div></div>;
}

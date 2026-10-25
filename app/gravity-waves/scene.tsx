'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export type InstrumentSnapshot={
 strain:number;timeSeconds:number;displayQuadrature:number;playing:boolean;
};

function ObservatoryFallback({snapshot}:{snapshot:InstrumentSnapshot}){
 const w=Math.max(-16,Math.min(16,snapshot.strain*3e21));
 return <div className="gw-fallback"><svg viewBox="0 0 540 410" role="img" aria-label="Top-down laser interferometer. A splitter sends light along two perpendicular arms, reflects it at two mirrors, and recombines it at a photodetector.">
  <defs><linearGradient id="gwFallbackBeam"><stop stopColor="#edbb76"/><stop offset="1" stopColor="#7ee7e6"/></linearGradient></defs>
  <path d="M85 300 H270 V75 M270 300 H467" fill="none" stroke="#e9be82" strokeWidth="10" strokeLinecap="round" opacity=".28"/>
  <path d="M85 300 H270 V75 M270 300 H467" fill="none" stroke="url(#gwFallbackBeam)" strokeWidth="3"/>
  <rect x={253+w/5} y="55" width="34" height="12" rx="3" fill="#d2f1ef"/>
  <rect x={450+w} y="282" width="12" height="35" rx="3" fill="#d2f1ef"/>
  <rect x="255" y="285" width="30" height="30" rx="4" transform="rotate(45 270 300)" fill="#a5f0e1" opacity=".8"/>
  <circle cx="85" cy="300" r="28" fill="#132e38" stroke="#e8b778" strokeWidth="3"/><circle cx="85" cy="300" r="10" fill="#e8b778"/>
  <text x="52" y="353" fill="#e6bf86" fontSize="14">LASER</text>
  <text x="281" y="49" fill="#bddbdc" fontSize="14">Y ARM</text>
  <text x="391" y="347" fill="#bddbdc" fontSize="14">X ARM</text>
  <text x="270" y="367" fill="#bddbdc" fontSize="13" textAnchor="middle">BEAM SPLITTER</text>
  <circle cx="270" cy="383" r="11" fill="#8fded6"/>
 </svg><p>2D instrument fallback. The physical calculations and controls still work without WebGL.</p></div>;
}

export default function ObservatoryScene({snapshot}:{snapshot:InstrumentSnapshot}){
 const host=useRef<HTMLDivElement>(null),controller=useRef<((s:InstrumentSnapshot)=>void)|null>(null);
 const latest=useRef(snapshot),[failed,setFailed]=useState(false);
 latest.current=snapshot;
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
  catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Orbitable 3D Michelson interferometer. Drag to rotate, scroll or pinch to zoom. Use accessible sliders to change the experiment.');
  mount.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#06121e');scene.fog=new T.FogExp2(0x06121e,.024);
  const camera=new T.PerspectiveCamera(42,1,.1,70);
  camera.position.set(8.5,8.2,10.5);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;
  controls.minDistance=6.3;controls.maxDistance=24;controls.maxPolarAngle=Math.PI/2.03;
  controls.target.set(0,.55,-.1);controls.update();
  const geometries:T.BufferGeometry[]=[],materials:T.Material[]=[],textures:T.Texture[]=[];
  const add=(geometry:T.BufferGeometry,material:T.Material,container:T.Group|T.Scene=scene)=>{
   geometries.push(geometry);if(!materials.includes(material))materials.push(material);
   const m=new T.Mesh(geometry,material);container.add(m);return m;
  };
  const bronze=new T.MeshStandardMaterial({color:0x9d7952,metalness:.78,roughness:.34});
  const darkMetal=new T.MeshStandardMaterial({color:0x203441,metalness:.78,roughness:.32});
  const rim=new T.MeshStandardMaterial({color:0x7daeb9,metalness:.76,roughness:.3,emissive:0x11252b});
  const cyan=new T.MeshBasicMaterial({color:0x6de0d8,transparent:true,opacity:.78,depthWrite:false});
  const gold=new T.MeshBasicMaterial({color:0xffc37c,transparent:true,opacity:.9,depthWrite:false});
  const translucent=new T.MeshPhysicalMaterial({color:0xa6ffed,metalness:.1,roughness:.08,transparent:true,opacity:.36,depthWrite:false,side:T.DoubleSide});
  materials.push(bronze,darkMetal,rim,cyan,gold,translucent);
  scene.add(new T.HemisphereLight(0x9bc5df,0x0a1524,1.55));
  const lamp=new T.PointLight(0x6be3da,25,12);lamp.position.set(0,2,0);scene.add(lamp);
  const warm=new T.PointLight(0xe7a969,33,8);warm.position.set(-2,2,1);scene.add(warm);

  const pedestal=add(new T.CylinderGeometry(1.05,1.2,.25,64),darkMetal);
  pedestal.position.y=-.05;
  const plinth=add(new T.CylinderGeometry(.63,.8,.35,64),bronze);
  plinth.position.y=.2;
  const disk=add(new T.CylinderGeometry(.64,.64,.05,64),rim);
  disk.position.y=.4;
  const splitter=add(new T.BoxGeometry(.43,.43,.43),translucent);
  splitter.position.y=.7;splitter.rotation.y=Math.PI/4;

  const floor=add(new T.CircleGeometry(8.6,100),new T.MeshBasicMaterial({color:0x092332,side:T.DoubleSide}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.23;
  const grid=new T.GridHelper(16,40,0x285e6a,0x18343e);
  grid.position.y=-.21;scene.add(grid);

  const circular=new T.Group();scene.add(circular);
  for(let j=0;j<5;j++){
   const ring=add(new T.TorusGeometry(1.35+j*1.32,.015,6,128),
    new T.MeshBasicMaterial({color:j%2?0x315564:0x6b5b49,transparent:true,opacity:.28,depthWrite:false}),circular);
   ring.rotation.x=Math.PI/2;ring.position.y=-.18;
  }
  // Real 4 km arms compressed to a four-unit exhibition object.
  function arm(xAxis:boolean){
   const g=new T.Group();scene.add(g);
   const tube=add(new T.CylinderGeometry(.11,.11,4.25,16,1,true),
    new T.MeshBasicMaterial({color:0x38606a,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false}),g);
   const bar=add(new T.CylinderGeometry(.022,.022,4.25,10),xAxis?gold:cyan,g);
   const brace=add(new T.CylinderGeometry(.085,.085,4.24,12,1,true),rim,g);
   brace.material.transparent=true;(brace.material as T.MeshStandardMaterial).opacity=.18;
   for(const m of[tube,bar,brace]){m.position.y=.7;m.rotation.z=xAxis?Math.PI/2:0;
    if(!xAxis)m.rotation.x=Math.PI/2;}
   const mount=add(new T.BoxGeometry(.58,.26,.58),darkMetal,g);
   mount.position.y=.34;
   const reflector=add(new T.CylinderGeometry(.29,.29,.12,48),bronze,g);
   reflector.rotation.z=xAxis?Math.PI/2:0;
   if(!xAxis)reflector.rotation.x=Math.PI/2;
   reflector.position.y=.7;
   const glass=add(new T.CylinderGeometry(.24,.24,.13,48),rim,g);
   glass.rotation.copy(reflector.rotation);glass.position.y=.7;
   return{g,tube,bar,brace,mount,reflector,glass};
  }
  const armX=arm(true),armZ=arm(false);
  const laser=add(new T.CylinderGeometry(.29,.29,1.18,32),bronze);laser.rotation.z=Math.PI/2;
  laser.position.set(-1.62,.7,0);
  const aperture=add(new T.CylinderGeometry(.18,.18,.10,32),gold);aperture.rotation.z=Math.PI/2;
  aperture.position.set(-.96,.7,0);
  const incoming=add(new T.CylinderGeometry(.025,.025,1,9),gold);
  incoming.rotation.z=Math.PI/2;incoming.position.set(-.5,.7,0);
  const sensor=add(new T.CylinderGeometry(.29,.29,.13,36),darkMetal);
  sensor.rotation.x=Math.PI/2;sensor.position.set(0,.7,1.45);
  const diode=add(new T.CylinderGeometry(.22,.22,.14,36),
   new T.MeshBasicMaterial({color:0x6ed8ca,transparent:true,opacity:.8}));
  diode.rotation.copy(sensor.rotation);diode.position.set(0,.7,1.37);
  const output=add(new T.CylinderGeometry(.022,.022,1.35,8),cyan);
  output.rotation.x=Math.PI/2;output.position.set(0,.7,.68);

  const photonGeo=new T.SphereGeometry(.08,12,10);geometries.push(photonGeo);
  const xPhoton=new T.Mesh(photonGeo,gold),zPhoton=new T.Mesh(photonGeo,cyan);
  scene.add(xPhoton,zPhoton);
  const waveGroup=new T.Group();scene.add(waveGroup);
  const ripples:T.Mesh[]=[];
  for(let i=0;i<7;i++){
   const g=new T.TorusGeometry(3.3,.015,5,96);
   const m=new T.MeshBasicMaterial({color:i%2?0x68c9c5:0xe0b47d,transparent:true,opacity:.12,depthWrite:false});
   const ring=add(g,m,waveGroup);ring.rotation.x=Math.PI/2;ring.position.y=2.2+i*.6;
   ripples.push(ring);
  }

  const starGeo=new T.SphereGeometry(.025,4,3);geometries.push(starGeo);
  const starMat=new T.MeshBasicMaterial({color:0x7ebbc0});materials.push(starMat);
  const stars=new T.InstancedMesh(starGeo,starMat,180);
  const pos=new T.Object3D();
  let n=0;
  for(let i=0;i<180;i++){
   const a=i*2.3999632297,r=7.5+(i%17)*.55;
   pos.position.set(Math.cos(a)*r,.4+(i*17%70)*.11,Math.sin(a)*r);
   pos.scale.setScalar(.5+(i%5)*.15);pos.updateMatrix();stars.setMatrixAt(n++,pos.matrix);
  }
  stars.instanceMatrix.needsUpdate=true;scene.add(stars);
  let frame=0,visible=true,dirty=true,lastFrame=0;
  function update(s:InstrumentSnapshot){
   const warp=Math.max(-.14,Math.min(.14,s.strain*3e19));
   armX.mount.position.set(4.25+warp,.34,0);
   armX.reflector.position.set(4.25+warp,.7,0);
   armX.glass.position.set(4.18+warp,.7,0);
   armZ.mount.position.set(0,.34,-4.25+warp);
   armZ.reflector.position.set(0,.7,-4.25+warp);
   armZ.glass.position.set(0,.7,-4.18+warp);
   for(const m of[armX.tube,armX.bar,armX.brace]){m.position.x=(4.25+warp)/2;m.scale.y=(4.25+warp)/4.25;}
   for(const m of[armZ.tube,armZ.bar,armZ.brace]){m.position.z=-(4.25-warp)/2;m.scale.y=(4.25-warp)/4.25;}
   const phase=((s.timeSeconds*2.8)%2+2)%2;
   const ratio=phase>1?2-phase:phase;
   xPhoton.position.set((4.25+warp)*ratio,.7,0);
   zPhoton.position.set(0,.7,-(4.25-warp)*ratio);
   const intensity=.18+.82*Math.abs(s.displayQuadrature);
   diode.material.opacity=Math.min(.97,intensity);
   lamp.intensity=12+35*intensity;
   ripples.forEach((ring,i)=>{
    const breath=1+.065*Math.sin(s.timeSeconds*8-i*.7);
    ring.scale.set(breath,breath,breath);
    ring.material.opacity=.04+.12*Math.abs(s.displayQuadrature);
   });
   dirty=true;
  }
  controller.current=update;
  const resize=()=>{const width=Math.max(1,mount.clientWidth),height=Math.max(1,mount.clientHeight);
   renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  const intersection=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true;dirty=true;});
  intersection.observe(mount);
  const invalidate=()=>{dirty=true;};controls.addEventListener('change',invalidate);
  const contextLost=(event:Event)=>{event.preventDefault();setFailed(true);};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const animate=(now:number)=>{
   frame=requestAnimationFrame(animate);
   if(document.hidden||!visible||now-lastFrame<33)return;
   lastFrame=now;
   controls.update();
   if(latest.current.playing||dirty){renderer.render(scene,camera);dirty=false;}
  };
  update(latest.current);frame=requestAnimationFrame(animate);
  return()=>{
   cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();
   controls.removeEventListener('change',invalidate);controls.dispose();
   renderer.domElement.removeEventListener('webglcontextlost',contextLost);
   for(const geometry of new Set(geometries))geometry.dispose();
   for(const material of new Set(materials))material.dispose();
   for(const texture of textures)texture.dispose();
   renderer.dispose();renderer.domElement.remove();controller.current=null;
  };
 },[]);
 useEffect(()=>{controller.current?.(snapshot);},[snapshot]);
 return <div ref={host} className="gw-scene">{failed&&<ObservatoryFallback snapshot={snapshot}/>}
  <div className="gw-scene-caption" aria-hidden="true">DRAG TO ORBIT · PHOTONS SLOWED · ARM MOTION EXAGGERATED ~10¹⁹×</div>
 </div>;
}

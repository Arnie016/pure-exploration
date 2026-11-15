'use client';
import {useEffect,useRef,useState} from 'react';
import type {OscillationPoint} from './physics';
import {COLORS} from './physics';
import type * as THREE from 'three';

/** One WebGL renderer per mounted world, recreated only on navigation. Traces update in place. */
export default function NeutrinoScene({points,baselineKm,running}:{points:OscillationPoint[];baselineKm:number;running:boolean}){
 const host=useRef<HTMLDivElement>(null),runtime=useRef<null|{update:()=>void}>(null);
 const latest=useRef({points,baselineKm,running});latest.current={points,baselineKm,running};
 const [error,setError]=useState(false);
 useEffect(()=>{runtime.current?.update();},[points,baselineKm,running]);
 useEffect(()=>{
  let cancelled=false,dispose=()=>{};
  async function start(){
   try{
    const [T,{OrbitControls}]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]);
    if(cancelled||!host.current)return;
    const mount=host.current,scene=new T.Scene();scene.background=new T.Color('#070d21');scene.fog=new T.FogExp2(0x070d21,.025);
    const camera=new T.PerspectiveCamera(43,1,.1,100);camera.position.set(1.3,5.4,14.8);
    const renderer=new T.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mount.clientWidth<650?1:1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Orbitable 3D graph: three coloured neutrino flavour probabilities vary along a 1,600 kilometre baseline. The numerical graph and controls below provide the same data.');
    const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=7;controls.maxDistance=27;controls.maxPolarAngle=Math.PI*.82;controls.target.set(0,0,0);
    const staticGroup=new T.Group(),plot=new T.Group();scene.add(staticGroup,plot);
    const stage=new T.GridHelper(14,18,0x243651,0x17253f);stage.position.y=-3.12;staticGroup.add(stage);
    const dust=new Float32Array(300*3);for(let j=0;j<300;j++){
      const s=Math.sin(j*24.71+1)*43758.5453, t=Math.sin(j*10.97+2)*24634.634;
      dust[3*j]=(s-Math.floor(s)-.5)*28;dust[3*j+1]=(t-Math.floor(t)-.5)*16;dust[3*j+2]=-9+(j%23)*.3;
    }
    const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.Float32BufferAttribute(dust,3));
    staticGroup.add(new T.Points(dustGeometry,new T.PointsMaterial({color:0x8594c5,size:.025,transparent:true,opacity:.46})));
    const ringMaterial=new T.MeshBasicMaterial({color:0xaecfee,transparent:true,opacity:.22,side:T.DoubleSide});
    for(const x of [-4.9,4.9]){const ring=new T.Mesh(new T.TorusGeometry(2.93,.016,6,96),ringMaterial);ring.rotation.y=Math.PI/2;ring.position.x=x;staticGroup.add(ring);}
    let shapes:THREE.Object3D[]=[],travellers:THREE.Mesh[]=[],curves:THREE.CatmullRomCurve3[]=[],beacons:THREE.Mesh[]=[],detector:THREE.Mesh|null=null,lastPoints:OscillationPoint[]|null=null;
    const clearPlot=()=>{for(const item of shapes){plot.remove(item);item.traverse(node=>{if(node instanceof T.Mesh||node instanceof T.Line){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>m.dispose());}});}shapes=[];travellers=[];curves=[];beacons=[];detector=null;};
    function rebuild(){
      clearPlot();const data=latest.current.points;
      const insert=(object:THREE.Object3D)=>{plot.add(object);shapes.push(object);};
      for(let f=0;f<3;f++){
        const color=COLORS[f],y0=(1-f)*1.63;
        const coords=data.map((p,j)=>new T.Vector3(-4.8+9.6*p.km/1600,y0+(p.p[f]-.5)*1.06,.1+Math.sin(j*.19+f*2.1)*.17*(.4+p.p[f])));
        const curve=new T.CatmullRomCurve3(coords,false,'centripetal');curves.push(curve);
        insert(new T.Mesh(new T.TubeGeometry(curve,Math.max(120,data.length),.11,5,false),new T.MeshBasicMaterial({color,transparent:true,opacity:.09,depthWrite:false})));
        insert(new T.Mesh(new T.TubeGeometry(curve,Math.max(120,data.length),.028,7,false),new T.MeshBasicMaterial({color,transparent:true,opacity:.94})));
        const guideGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(-4.8,y0-.53,-.12),new T.Vector3(4.8,y0-.53,-.12)]);
        const guide=new T.Line(guideGeo,new T.LineDashedMaterial({color,transparent:true,opacity:.24,dashSize:.17,gapSize:.15}));guide.computeLineDistances();insert(guide);
        const beacon=new T.Mesh(new T.SphereGeometry(.16,14,12),new T.MeshBasicMaterial({color}));insert(beacon);beacons.push(beacon);
        const traveler=new T.Mesh(new T.SphereGeometry(.075,10,8),new T.MeshBasicMaterial({color}));insert(traveler);travellers.push(traveler);
      }
      const det=new T.Mesh(new T.BoxGeometry(.026,6.4,.035),new T.MeshBasicMaterial({color:0xdcecf5,transparent:true,opacity:.65}));insert(det);detector=det;lastPoints=data;moveDetector();
    }
    function moveDetector(){
      const {points:data,baselineKm:b}=latest.current,cursorX=-4.8+9.6*b/1600;
      for(let f=0;f<3;f++){
        const p=data[Math.max(0,Math.min(data.length-1,Math.round(b/1600*(data.length-1))))].p[f];
        beacons[f].position.set(cursorX,(1-f)*1.63+(p-.5)*1.06,.15);
        beacons[f].scale.setScalar(.8+p*.8);
      }
      detector?.position.set(cursorX,0,.18);
    }
    let frame=0,lastPaint=-Infinity,visible=true;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paint=(ms:number)=>{frame=0;if(document.hidden||!visible)return;
      if(latest.current.running&&!reduced&&ms-lastPaint<33){invalidate();return;}lastPaint=ms;
      if(latest.current.running&&!reduced){const phase=(ms*.00012)%1;travellers.forEach((mesh,i)=>mesh.position.copy(curves[i].getPointAt(phase)));}
      else travellers.forEach((mesh,i)=>mesh.position.copy(curves[i].getPointAt(.02)));
      renderer.render(scene,camera);if(latest.current.running&&!reduced)invalidate();};
    function invalidate(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(paint);}
    const resize=()=>{const width=mount.clientWidth,height=Math.max(280,mount.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);invalidate();};
    const ro=new ResizeObserver(resize),io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;invalidate();},{threshold:.01});
    ro.observe(mount);io.observe(mount);controls.addEventListener('change',invalidate);
    const visibility=()=>invalidate();document.addEventListener('visibilitychange',visibility);
    runtime.current={update:()=>{if(latest.current.points!==lastPoints)rebuild();else moveDetector();invalidate();}};runtime.current.update();resize();
    dispose=()=>{runtime.current=null;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',visibility);controls.removeEventListener('change',invalidate);controls.dispose();clearPlot();scene.remove(staticGroup);staticGroup.traverse(node=>{if(node instanceof T.Mesh||node instanceof T.Line||node instanceof T.Points){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
   }catch{if(!cancelled)setError(true);}
  }
  void start();return()=>{cancelled=true;dispose();};
 },[]);
 return <div className="nu-scene" ref={host}>{error&&<p role="status" className="nu-webgl-error">3D is unavailable on this device. The probability graph and experiment controls still work.</p>}<span className="nu-scene-note">DRAG TO ORBIT · SCROLL TO ZOOM · FLAVOUR PROBABILITY IS HEIGHT</span></div>;
}

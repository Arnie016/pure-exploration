'use client';
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import Link from 'next/link';
import {createPair,DEFAULT_SETTINGS,energyDrift,separation,step,totalEnergy,type Settings} from './physics';
import './orbital-chaos.css';

const COLORS=['#ffb17f','#79d8ff','#d3a7ff'];
type Pair=ReturnType<typeof createPair>;
const presetCopy={
  eight:'Near figure-eight: three equal masses can share an extraordinary looping orbit. Changing masses or softening disrupts its exact symmetry.',
  triangle:'Triangular dance: equal masses start at the vertices of an equilateral triangle. Perturb one velocity and watch the symmetry unfold.',
  visitor:'Close encounter: a third body approaches a binary pair. Gravity can exchange orbital energy without any physical collision.'
};
type Stats={time:number;divergence:number;energy:number;drift:number};
function measure(pair:Pair,softening:number):Stats{
 return {time:pair.original.time,divergence:separation(pair.original,pair.shadow),energy:totalEnergy(pair.original.bodies,softening),drift:energyDrift(pair.original,softening)};
}
function OrbitalScene({pair,settings,playing,speed,onStats}:{pair:MutableRefObject<Pair>;settings:MutableRefObject<Settings>;playing:MutableRefObject<boolean>;speed:MutableRefObject<number>;onStats:(stats:Stats)=>void}){
 const mount=useRef<HTMLDivElement>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const host=mount.current;
  if(!host)return;
  let disposed=false;
  let destroy:()=>void=()=>{};
  void (async()=>{
   try{
    const THREE=await import('three');
    if(disposed)return;
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.setClearColor(0x040917,0);
    renderer.domElement.setAttribute('aria-hidden','true');
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(43,1,0.05,90);
    let yaw=.35,pitch=.25,zoom=7.4,drag=false,px=0,py=0;
    const cameraMove=()=>{camera.position.set(zoom*Math.sin(yaw)*Math.cos(pitch),zoom*Math.sin(pitch),zoom*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(0,0,0);};
    cameraMove();
    scene.add(new THREE.AmbientLight('#b5cbff',1.7));
    const light=new THREE.PointLight('#fbdbba',45,22);light.position.set(3,4,7);scene.add(light);
    const grid=new THREE.GridHelper(11,22,'#41607b','#182b45');
    grid.rotation.x=Math.PI/2;
    const gm=Array.isArray(grid.material)?grid.material:[grid.material];
    gm.forEach(m=>{m.transparent=true;m.opacity=.21;});scene.add(grid);
    const dots:number[]=[];
    for(let i=0;i<180;i++){const a=i*2.39996,z=1-2*(i+.5)/180,r=15+(i*29%43)/4;dots.push(r*Math.cos(a)*Math.sqrt(1-z*z),r*Math.sin(a)*Math.sqrt(1-z*z),r*z);}
    const skyGeometry=new THREE.BufferGeometry();
    skyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dots,3));
    const skyMaterial=new THREE.PointsMaterial({size:.07,color:'#b2bfe3',opacity:.62,transparent:true});
    scene.add(new THREE.Points(skyGeometry,skyMaterial));
    const geometry=new THREE.SphereGeometry(1,24,16);
    const spheres=COLORS.map(color=>{
      const material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.4,roughness:.35});
      const sphere=new THREE.Mesh(geometry,material);scene.add(sphere);return sphere;
    });
    const ghost=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#ffffff',wireframe:true,transparent:true,opacity:.6,depthWrite:false}));
    scene.add(ghost);
    const trails=COLORS.concat('#f5f5ea').map((color,i)=>{
      const positions=new Float32Array(360*3);
      const geom=new THREE.BufferGeometry();
      geom.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
      geom.setDrawRange(0,0);
      const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:i===3?.3:.83,depthWrite:false});
      const line=new THREE.Line(geom,material);line.frustumCulled=false;scene.add(line);
      return {positions,geom,material,count:0};
    });
    let oldPair=pair.current;
    let last=0,drawn=0,sampled=0,reported=0,remaining=0,frame=0,visible=true,dirty=true;
    const append=()=>{
      const bodies=[...pair.current.original.bodies.map(b=>b.position),pair.current.shadow.bodies[2].position];
      trails.forEach((t,i)=>{
        if(t.count>=360)t.positions.copyWithin(0,3);else t.count++;
        t.positions.set(bodies[i],(t.count-1)*3);
        t.geom.setDrawRange(0,t.count);
        t.geom.attributes.position.needsUpdate=true;
      });
    };
    const update=()=>{
      if(oldPair!==pair.current){oldPair=pair.current;remaining=0;trails.forEach(t=>{t.count=0;t.geom.setDrawRange(0,0);});append();}
      pair.current.original.bodies.forEach((b,i)=>{spheres[i].position.set(...b.position);spheres[i].scale.setScalar(.13*Math.cbrt(b.mass));});
      ghost.position.set(...pair.current.shadow.bodies[2].position);
      ghost.scale.setScalar(.14*Math.cbrt(pair.current.shadow.bodies[2].mass));
      ghost.visible=settings.current.perturbation>0;
      trails[3].material.opacity=ghost.visible?.3:0;
    };
    const schedule=()=>{if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(render);};
    const render=(now:number)=>{
      frame=0;
      if(disposed||!visible||document.hidden)return;
      if(playing.current&&now-drawn<33){schedule();return;}
      const elapsed=last?Math.min((now-last)/1000,.12):0;last=now;drawn=now;
      if(playing.current){
        remaining+=elapsed*speed.current*.8;
        let n=0;
        while(remaining>=.006&&n<25){
          step(pair.current.original,.006,settings.current.softening);
          step(pair.current.shadow,.006,settings.current.softening);
          remaining-=.006;n++;
        }
        if(n===25)remaining=0;
        if(now-sampled>90){append();sampled=now;}
        if(now-reported>300){onStats(measure(pair.current,settings.current.softening));reported=now;}
      }
      if(dirty||playing.current){update();renderer.render(scene,camera);dirty=false;}
      if(playing.current)schedule();
    };
    const invalidate=()=>{dirty=true;last=0;schedule();};
    const changed=()=>{update();append();onStats(measure(pair.current,settings.current.softening));invalidate();};
    const resize=()=>{
      const w=Math.max(host.clientWidth,1),h=Math.max(host.clientHeight,1);
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();
    };
    const down=(e:PointerEvent)=>{drag=true;px=e.clientX;py=e.clientY;host.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(!drag)return;yaw-=(e.clientX-px)*.007;pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-py)*.007));px=e.clientX;py=e.clientY;cameraMove();invalidate();};
    const up=()=>{drag=false;};
    const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=Math.max(2.3,Math.min(19,zoom*Math.exp(e.deltaY*.001)));cameraMove();invalidate();};
    const key=(e:KeyboardEvent)=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;
      e.preventDefault();
      if(e.key==='ArrowLeft')yaw+=.14;
      if(e.key==='ArrowRight')yaw-=.14;
      if(e.key==='ArrowUp')pitch=Math.min(1.35,pitch+.14);
      if(e.key==='ArrowDown')pitch=Math.max(-1.35,pitch-.14);
      if(e.key==='+')zoom=Math.max(2.3,zoom*.9);
      if(e.key==='-')zoom=Math.min(19,zoom*1.1);
      cameraMove();invalidate();
    };
    const visibility=()=>{last=0;if(!document.hidden)invalidate();};
    const watch=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;last=0;if(visible)invalidate();},{threshold:.05});watch.observe(host);
    const observer=new ResizeObserver(resize);observer.observe(host);
    host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);
    host.addEventListener('wheel',wheel,{passive:false});host.addEventListener('keydown',key);
    window.addEventListener('orbital-chaos-update',changed);document.addEventListener('visibilitychange',visibility);
    append();resize();
    destroy=()=>{
      cancelAnimationFrame(frame);watch.disconnect();observer.disconnect();
      host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);
      host.removeEventListener('wheel',wheel);host.removeEventListener('keydown',key);
      window.removeEventListener('orbital-chaos-update',changed);document.removeEventListener('visibilitychange',visibility);
      trails.forEach(t=>{t.geom.dispose();t.material.dispose();});spheres.forEach(s=>s.material.dispose());
      ghost.material.dispose();geometry.dispose();grid.geometry.dispose();gm.forEach(m=>m.dispose());
      skyGeometry.dispose();skyMaterial.dispose();renderer.dispose();renderer.domElement.remove();
    };
   }catch{if(!disposed)setError(true);}
  })();
  return()=>{disposed=true;destroy();};
 },[pair,settings,playing,speed,onStats]);
 return <div className="oc-stage" ref={mount} tabIndex={0} role="group" aria-label="Three-body orbit viewer. Drag to orbit, scroll to zoom, arrow keys to rotate.">
  <div className="oc-stage-note">GRAVITY ENGINE · G = 1 <span>WHITE = PERTURBED THIRD BODY</span></div>
  {error&&<p className="oc-fallback" role="status">WebGL is unavailable. Use the Step button to explore the numerical results without 3D.</p>}
  <div className="oc-stage-instructions">DRAG TO ORBIT · SCROLL TO ZOOM · ARROWS TO ROTATE</div>
 </div>;
}
export default function OrbitalChaosLab(){
 const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS);
 const [playing,setPlaying]=useState(false);
 const [speed,setSpeed]=useState(1);
 const sim=useRef<Pair>(createPair(DEFAULT_SETTINGS));
 const currentSettings=useRef(settings),isPlaying=useRef(playing),rate=useRef(speed);
 const [stats,setStats]=useState<Stats>(()=>measure(sim.current,settings.softening));
 currentSettings.current=settings;isPlaying.current=playing;rate.current=speed;
 const notify=()=>window.dispatchEvent(new Event('orbital-chaos-update'));
 useEffect(notify,[playing,speed,settings]);
 const configure=(patch:Partial<Settings>)=>{
   const next={...currentSettings.current,...patch};currentSettings.current=next;
   sim.current=createPair(next);setSettings(next);setPlaying(false);isPlaying.current=false;
   setStats(measure(sim.current,next.softening));notify();
 };
 const reset=()=>{sim.current=createPair(currentSettings.current);setPlaying(false);isPlaying.current=false;setStats(measure(sim.current,currentSettings.current.softening));notify();};
 const singleStep=()=>{setPlaying(false);isPlaying.current=false;for(let k=0;k<20;k++){step(sim.current.original,.006,currentSettings.current.softening);step(sim.current.shadow,.006,currentSettings.current.softening);}setStats(measure(sim.current,currentSettings.current.softening));notify();};
 return <main className="orbital-chaos">
  <header className="oc-header"><Link href="/?walk=1">← BACK TO THE GARDEN</Link><span>PURE EXPLORATION / FIELD EXPERIMENT 016</span></header>
  <section className="oc-lead"><div><p className="oc-panel-label">CELESTIAL MECHANICS / INTERACTIVE OBSERVATORY</p><h1>Three bodies.<br/><em>Infinite possibilities.</em></h1><p className="oc-deck">A tiny change at the beginning can redraw an entire gravitational future. Run two almost identical universes side by side.</p></div><div className="oc-legend">{['Amber','Cyan','Violet','Ghost'].map((name,i)=><span key={name}><i style={{background:i===3?'transparent':COLORS[i],border:i===3?'1px solid white':undefined}}/>{name}</span>)}</div></section>
  <div className="oc-workspace"><section className="oc-visual">
    <OrbitalScene pair={sim} settings={currentSettings} playing={isPlaying} speed={rate} onStats={setStats}/>
    <div className="oc-transport"><button className="oc-primary" onClick={()=>setPlaying(p=>!p)}>{playing?'Ⅱ Pause':'▶ Run universe'}</button><button onClick={singleStep}>Step +0.12</button><button onClick={reset}>↺ Reset</button><label>TIME RATE <output>{speed.toFixed(1)}×</output><input aria-label="Time rate" type="range" min=".3" max="3" step=".1" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label></div>
   </section><aside className="oc-console"><p className="oc-panel-label">01 / INITIAL CONDITIONS</p><h2>Change the future.</h2>
    <div className="oc-preset" role="group" aria-label="Starting arrangement">{(['eight','triangle','visitor'] as const).map((p,i)=><button key={p} aria-pressed={settings.preset===p} onClick={()=>configure({preset:p})}>{['Figure-eight','Triangle','Close encounter'][i]}</button>)}</div>
    <p className="oc-description">{presetCopy[settings.preset]}</p>
    <label className="oc-field">Mass of violet body <output>{settings.thirdMass.toFixed(2)}</output><input type="range" min=".2" max="2.5" step=".05" value={settings.thirdMass} onChange={e=>configure({thirdMass:Number(e.target.value)})}/></label>
    <label className="oc-field">Ghost velocity change <output>{settings.perturbation.toFixed(3)}</output><input type="range" min="0" max=".08" step=".001" value={settings.perturbation} onChange={e=>configure({perturbation:Number(e.target.value)})}/></label>
    <label className="oc-field">Gravity softening ε <output>{settings.softening.toFixed(3)}</output><input type="range" min=".005" max=".08" step=".005" value={settings.softening} onChange={e=>configure({softening:Number(e.target.value)})}/></label>
    <p className="oc-subtle">Changing a starting condition restarts both universes. The white wireframe follows the perturbed third body.</p><hr/>
    <p className="oc-panel-label">02 / LIVE MEASUREMENTS</p><div className="oc-metrics"><div><span>Simulation time</span><strong>{stats.time.toFixed(2)}</strong><small>dimensionless</small></div><div><span>Ghost separation</span><strong>{stats.divergence.toFixed(4)}</strong><small>coordinate units</small></div><div><span>Total energy</span><strong>{stats.energy.toFixed(3)}</strong><small>G = 1 units</small></div><div><span>Energy drift</span><strong>{(Math.abs(stats.drift)*100).toFixed(4)}%</strong><small>numerical error check</small></div></div>
   </aside></div>
  <footer className="oc-bottom"><section><p className="oc-panel-label">THE EXPERIMENT</p><h2>Chaos is not randomness.</h2><p>Every body obeys the same deterministic gravitational rule. A minuscule difference in one initial velocity can grow into very different trajectories. The white outline lets you see the divergence directly.</p></section><section><p className="oc-panel-label">MODEL BOUNDARIES</p><p>Three point masses follow softened Newtonian gravity with G = 1 using fixed-step velocity Verlet integration. Softening replaces the gravitational 1/r potential with 1/√(r² + ε²), preventing singular forces at close approaches. There are no collisions or relativistic corrections. The numbers are dimensionless educational results, not observed astronomical measurements.</p><p><strong>Try:</strong> Select Triangle, use mass 1.00 and zero ghost perturbation. Then change the ghost velocity slightly and watch the symmetry break.</p></section></footer>
 </main>;
}
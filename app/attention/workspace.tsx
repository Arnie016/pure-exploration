'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {STARTER,HEADS,tokenize,attentionAt,approximateOperations} from './model';
import './style.css';

type Reading=ReturnType<typeof attentionAt>;
const phases=[
 {title:'01 Encode',detail:'Every word and its position become four numbers.'},
 {title:'02 Compare',detail:'A query is compared with the permitted keys using Q · K / √4.'},
 {title:'03 Normalize',detail:'Softmax turns scores into attention weights that sum to 100%.'},
 {title:'04 Mix values',detail:'The weighted value vectors are added into one output vector.'}
];
const fmt=(value:number)=>value.toFixed(2);
const vector=(values:number[])=>'['+values.map(fmt).join(', ')+']';

function AttentionScene({reading,phase}:{reading:Reading;phase:number}){
 const host=useRef<HTMLDivElement>(null);
 const update=useRef<((data:Reading,phase:number)=>void)|null>(null);
 const latest=useRef({reading,phase});
 const [unavailable,setUnavailable]=useState(false);
 latest.current={reading,phase};

 useEffect(()=>{
  let mounted=true;
  let cleanup=()=>{};
  void (async()=>{
   try{
    const T=await import('three');
    const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    if(!mounted||!host.current)return;
    const mount=host.current;
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.2;
    renderer.domElement.setAttribute('aria-hidden','true');
    mount.appendChild(renderer.domElement);
    const scene=new T.Scene();
    scene.background=new T.Color('#07131e');
    scene.fog=new T.Fog('#07131e',16,32);
    const camera=new T.PerspectiveCamera(44,1,.1,80);
    camera.position.set(8,5.2,13);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,-.45,0);
    controls.enableDamping=false;
    controls.enablePan=false;
    controls.minDistance=7;
    controls.maxDistance=24;
    controls.maxPolarAngle=Math.PI*.83;
    controls.update();
    scene.add(new T.AmbientLight('#c8e7ff',1.8));
    const light=new T.PointLight('#72ebf0',85,30);light.position.set(1,6,6);scene.add(light);
    const light2=new T.PointLight('#ffbe87',40,25);light2.position.set(-6,0,-4);scene.add(light2);
    const group=new T.Group();scene.add(group);
    const grid=new T.GridHelper(14,14,'#30556b','#1a3244');
    grid.position.y=-3.05;scene.add(grid);
    const disposable:Array<{dispose:()=>void}>=[];
    const paint=()=>renderer.render(scene,camera);
    const release=()=>{group.clear();for(const item of disposable)item.dispose();disposable.length=0;};
    const sphere=(x:number,y:number,z:number,color:string,r=.24)=>{
     const geometry=new T.SphereGeometry(r,20,14);
     const material=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2,roughness:.28,metalness:.42});
     disposable.push(geometry,material);
     const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);
    };
    const label=(value:string,x:number,y:number,z:number,color='#dfeaf0')=>{
     const canvas=document.createElement('canvas');canvas.width=300;canvas.height=64;
     const context=canvas.getContext('2d');if(!context)return;
     context.fillStyle=color;context.font='600 29px sans-serif';
     context.textAlign='center';context.fillText(value.slice(0,18),150,42,282);
     const texture=new T.CanvasTexture(canvas);
     const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
     disposable.push(texture,material);
     const sprite=new T.Sprite(material);sprite.position.set(x,y,z);sprite.scale.set(1.75,.38,1);group.add(sprite);
    };
    const beam=(start:T.Vector3,end:T.Vector3,color:string,alpha:number)=>{
     if(alpha<=0)return;
     const direction=end.clone().sub(start);
     const length=direction.length();if(length<.001)return;
     const geometry=new T.CylinderGeometry(.013+alpha*.025,.013+alpha*.025,length,7);
     const material=new T.MeshBasicMaterial({color,transparent:true,opacity:Math.min(.92,alpha),depthWrite:false});
     disposable.push(geometry,material);
     const mesh=new T.Mesh(geometry,material);
     mesh.position.copy(start).addScaledVector(direction,.5);
     mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
     group.add(mesh);
    };
    const draw=(data:Reading,step:number)=>{
     release();
     const count=data.tokens.length;
     const spacing=Math.min(1.65,11/Math.max(count,2));
     const x=(index:number)=>(index-(count-1)/2)*spacing;
     const tone=data.head===HEADS[0].name?'#78e3ef':'#ffbf87';
     for(let i=0;i<count;i++){
      const xx=x(i);
      sphere(xx,1.8,-1,i===data.focus?'#ffe0a4':'#587a9c',i===data.focus?.34:.22);
      sphere(xx,0,-.2,data.causal&&i>data.focus?'#3e4a54':tone,.24);
      sphere(xx,-1.8,.9,'#c3a9ec',.24);
      label(data.tokens[i],xx,2.35,-1,i===data.focus?'#ffe0a4':'#deebf5');
      label('K'+(i+1),xx,.47,-.2);
      label('V'+(i+1),xx,-2.3,.9);
     }
     label('QUERIES',-5.5,1.8,-1,'#90adc2');
     label('KEYS',-5.5,0,-.2,'#90adc2');
     label('VALUES',-5.5,-1.8,.9,'#90adc2');
     const start=new T.Vector3(x(data.focus),1.8,-1);
     for(let i=0;i<count;i++){
      const score=data.scores[i];if(score===null)continue;
      if(step>=1){
       const intensity=step===1?Math.max(.15,Math.min(.75,.3+score*.25)):.11+data.weights[i]*1.8;
       beam(start,new T.Vector3(x(i),0,-.2),tone,intensity);
      }
      if(step>=3&&data.weights[i]>.001){
       beam(new T.Vector3(x(i),-1.8,.9),new T.Vector3(0,-3,2.25),'#c9b5ff',.12+data.weights[i]*1.8);
      }
     }
     if(step>=3){sphere(0,-3,2.25,'#ffe1a9',.36);label('OUTPUT',0,-3.62,2.25,'#ffe7bd');}
     paint();
    };
    update.current=draw;
    const resize=()=>{
     const w=Math.max(2,mount.clientWidth),h=Math.max(2,mount.clientHeight);
     renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();paint();
    };
    const observer=new ResizeObserver(resize);
    observer.observe(mount);
    controls.addEventListener('change',paint);
    resize();
    draw(latest.current.reading,latest.current.phase);
    cleanup=()=>{
     update.current=null;observer.disconnect();controls.removeEventListener('change',paint);
     controls.dispose();release();grid.geometry.dispose();
     const materials=Array.isArray(grid.material)?grid.material:[grid.material];
     materials.forEach(material=>material.dispose());
     renderer.dispose();renderer.domElement.remove();
    };
   }catch{
    if(mounted)setUnavailable(true);
   }
  })();
  return()=>{mounted=false;cleanup();};
 },[]);
 useEffect(()=>{update.current?.(reading,phase);},[reading,phase]);
 return <div className="ao-scene" ref={host} role="img" aria-label={'An interactive 3D diagram with '+reading.tokens.length+' query, key and value token nodes. Select a token or phase to inspect the calculations.'}>
  {unavailable&&<div className="ao-fallback">3D is unavailable on this device. The exact numeric attention table and controls below still work.</div>}
  <span className="ao-orbit-hint">DRAG TO ORBIT · SCROLL TO ZOOM · RENDERED ON DEMAND</span>
 </div>;
}

export default function AttentionWorkspace(){
 const [sentence,setSentence]=useState(STARTER);
 const [selected,setSelected]=useState(3);
 const [head,setHead]=useState(0);
 const [temperature,setTemperature]=useState(1);
 const [causal,setCausal]=useState(true);
 const [phase,setPhase]=useState(2);
 const tokens=useMemo(()=>tokenize(sentence),[sentence]);
 const focus=Math.min(selected,tokens.length-1);
 const rows=useMemo(()=>tokens.map((_,i)=>attentionAt(tokens,i,head,temperature,causal)),[tokens,head,temperature,causal]);
 const reading=rows[focus];
 const strongest=reading.weights.indexOf(Math.max(...reading.weights));
 const activationBytes=(3*tokens.length*4+tokens.length*tokens.length)*4;
 const cacheBytes=2*tokens.length*4*4;
 return <main className="attention-lab">
  <header className="ao-header">
   <a href="/" className="ao-back">← RETURN TO THE GARDEN</a>
   <span className="ao-eyebrow">PURE EXPLORATION / COMPUTATION / WORLD 016</span>
   <h1>Attention <em>Observatory.</em></h1>
   <p>Step inside a transformer head. Every beam represents a number you can inspect, not an animation pretending to be AI.</p>
  </header>
  <div className="ao-layout">
   <section className="ao-main" aria-label="3D attention experiment">
    <div className="ao-scene-bar"><span><i/> INSTRUMENT 01 / ATTENTION CHAMBER</span><span>4D · {tokens.length} TOKENS · {HEADS[head].name.toUpperCase()}</span></div>
    <AttentionScene reading={reading} phase={phase}/>
    <div className="ao-phases" role="group" aria-label="Attention calculation stage">
     {phases.map((item,index)=><button type="button" key={item.title} className={index===phase?'active':''} onClick={()=>setPhase(index)} aria-pressed={index===phase}>{item.title}</button>)}
    </div>
    <div className="ao-stage-text" aria-live="polite"><strong>{phases[phase].title}</strong><p>{phases[phase].detail}</p></div>
   </section>
   <aside className="ao-instruments" aria-label="Experiment controls">
    <div className="ao-panel">
     <span className="ao-kicker">CONTROL DECK / 01</span>
     <label htmlFor="ao-sentence">Your sequence</label>
     <input id="ao-sentence" maxLength={120} value={sentence} onChange={event=>{setSentence(event.target.value);setPhase(2);}} spellCheck={false}/>
     <p className="ao-muted">Up to 8 tokens. Editing changes deterministic token vectors. These are not language-trained embeddings.</p>
     <label>Inspect the query token</label>
     <div className="ao-token-list" role="group" aria-label="Select query token">
      {tokens.map((word,index)=><button type="button" key={index} className={index===focus?'active':''} onClick={()=>setSelected(index)} aria-pressed={index===focus}>{index+1}. {word}</button>)}
     </div>
     <label>Attention head</label>
     <div className="ao-segment" role="group" aria-label="Attention head">
      {HEADS.map((item,index)=><button type="button" key={item.name} onClick={()=>setHead(index)} aria-pressed={head===index}>{item.name}</button>)}
     </div>
     <label htmlFor="ao-temperature">Softmax temperature <output>{temperature.toFixed(2)}</output></label>
     <input id="ao-temperature" type="range" min=".2" max="3" step=".05" value={temperature} onChange={event=>setTemperature(Number(event.target.value))}/>
     <div className="ao-explain">Lower temperature sharpens the attention distribution. Higher temperature spreads it out. The underlying Q and K vectors do not change.</div>
     <label className="ao-check"><input type="checkbox" checked={causal} onChange={event=>setCausal(event.target.checked)}/> Causal mask: block future tokens</label>
     <button className="ao-reset" type="button" onClick={()=>{setSentence(STARTER);setSelected(3);setHead(0);setTemperature(1);setCausal(true);setPhase(2);}}>Reset experiment ↺</button>
    </div>
    <div className="ao-panel ao-numbers">
     <span className="ao-kicker">LIVE READOUT / 02</span>
     <div><span>Query</span><strong>{reading.tokens[focus]}</strong></div>
     <div><span>Largest share</span><strong>{reading.tokens[strongest]} · {(reading.weights[strongest]*100).toFixed(1)}%</strong></div>
     <div><span>Attention entropy</span><strong>{reading.entropy.toFixed(3)} nats</strong></div>
     <div><span>Q vector</span><code>{vector(reading.queries[focus])}</code></div>
     <div><span>Mixed output</span><code>{vector(reading.output)}</code></div>
     <p className="ao-muted">Numbers are calculated locally using seeded, fixed matrices and real softmax arithmetic. This toy model has not learned word meaning.</p>
    </div>
   </aside>
  </div>
  <section className="ao-bottom" aria-label="Attention table and computational budget">
   <div className="ao-panel ao-map">
    <div className="ao-section-heading"><div><span className="ao-kicker">DATA VIEW / 03</span><h2>The attention map</h2></div><span className="ao-muted">ROWS = QUERIES · COLUMNS = KEYS</span></div>
    <div className="ao-matrix-scroll"><table className="ao-matrix"><thead><tr><th scope="col">Query ↓ / Key →</th>{tokens.map((word,i)=><th scope="col" key={i}>{word}</th>)}</tr></thead><tbody>
     {rows.map((row,i)=><tr key={i}><th scope="row"><button type="button" onClick={()=>setSelected(i)} aria-pressed={focus===i}>{row.tokens[i]}</button></th>
      {row.weights.map((weight,j)=><td key={j}><button type="button" className={focus===i?'row-active':''} onClick={()=>{setSelected(i);setPhase(2);}} style={{backgroundColor:'rgba(92, 210, 218, '+(.055+weight*.75)+')'} as CSSProperties} aria-label={row.tokens[i]+' pays '+(100*weight).toFixed(1)+' percent attention to '+tokens[j]}>{row.scores[j]===null?'×':Math.round(weight*100)+'%'}</button></td>)}
     </tr>)}
    </tbody></table></div>
    <p className="ao-muted">Rows sum to 100%. × means masked, not a tiny probability. Selecting a row updates the 3D beams.</p>
   </div>
   <div className="ao-panel ao-budget">
    <span className="ao-kicker">COMPUTE NOTEBOOK / 04</span><h2>What grows with context?</h2>
    <div className="ao-budget-metric"><span>Q/K/V projection and attention multiply-adds</span><strong>{approximateOperations(tokens.length).toLocaleString()}</strong><small>Estimated scalar multiply-add terms, for one 4D head across all tokens</small></div>
    <div className="ao-budget-metric"><span>4-byte toy Q/K/V + attention buffers</span><strong>{activationBytes} B</strong><small>Illustrative buffer sizes. Not actual GPU VRAM consumption.</small></div>
    <div className="ao-budget-metric"><span>4-byte K/V cache, one head</span><strong>{cacheBytes} B</strong><small>2 × sequence length × 4 dimensions × 4 bytes</small></div>
    <p>Double the token count: the attention-score grid grows roughly fourfold. K/V storage for one head grows linearly. Real transformer implementations add many layers, heads, matrix sizes and optimized kernels.</p>
   </div>
  </section>
  <footer className="ao-footer"><strong>THE MODEL BOUNDARY</strong><p>This is genuine scaled dot-product attention with a causal mask, temperature and value mixing. The 4D embeddings and two projection heads are deterministic teaching data, not pretrained weights. The scene visualizes CPU-side arithmetic; it does not measure a GPU, train a model or infer semantic relationships. Nothing is sent to a server.</p><a href="/">Continue exploring worlds ↗</a></footer>
 </main>;
}

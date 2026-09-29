import*as T from'three';import{kit,material,textSprite}from'./three-kit';import{shrinePortals,SHRINE_RADIUS}from'./garden-shrines';
/** Original environment. A 10× wider walkable footprint gives 100× the area. */
export function landscape(scene:T.Scene){const motionClock={value:0};const world=new T.Group();scene.add(world);const{box,cyl,ball,rod}=kit(world),basalt=material(0x1c3439,.92),moss=material(0x315a48,.92),bark=material(0x4d5146),silver=material(0x648d89,.3,.7),gold=material(0xb5a272,.32,.6),water=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:motionClock},vertexShader:`uniform float time;varying vec3 vWorld;void main(){vec3 p=position;p.y+=sin(p.x*.42+time*.35)*sin(p.z*.32-time*.22)*.035;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`uniform float time;varying vec3 vWorld;void main(){float w=sin(vWorld.x*.9+time*.65+sin(vWorld.z*.38))*sin(vWorld.z*1.3-time*.42);float ripple=pow(.5+.5*w,12.);float band=pow(.5+.5*sin(length(vWorld.xz-vec2(0.,-47.))*.72-time*.5),18.)*.11;vec3 c=mix(vec3(.025,.12,.15),vec3(.23,.46,.43),ripple*.52+band);gl_FragColor=vec4(c,.88);}`}),glow=new T.MeshBasicMaterial({color:0x83d4d0});
 cyl(0,-1.15,0,120,1.8,basalt,120,128);cyl(0,-.23,0,119,.04,material(0x18302e,.96),119,128);const lake=cyl(0,-.15,-54,25,.06,water,25,96);lake.scale.x=1.65;
 // Two waterfalls step from the sky gardens into a broad lake.
 const flow=motionClock;const cascade=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:flow},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){float strands=sin(vUv.x*89.+sin(vUv.y*19.+time*2.)*.3)*.5+.5;float falls=sin(vUv.y*75.+time*9.+vUv.x*11.)*.5+.5;float edge=smoothstep(0.,.07,vUv.x)*smoothstep(1.,.93,vUv.x);vec3 c=mix(vec3(.16,.47,.51),vec3(.67,.92,.88),strands*.55+falls*.22);gl_FragColor=vec4(c,edge*(.43+strands*.28));}`});
 const falls:T.Mesh[]=[];for(const sign of[-1,1]){for(let t=0;t<4;t++){const x=sign*(38+t*7),z=-48-t*5,h=4+t*3;const rock=cyl(x,h/2-.2,z,10-t, h,basalt,7-t*.6,9);rock.rotation.y=t*.4;cyl(x,h+.05,z,7-t*.6,.1,moss,7-t*.6,32);const sheet=box(x,h/2,z+10-t+.12,4.1,h,.14,cascade);const basin=cyl(x,.02,z+11-t,3.4,.08,water,3.4,48);basin.scale.z=.6;falls.push(sheet);for(let j=0;j<8;j++){const strand=box(x-1.7+j*.48,h/2,z+10.16-t,.025,h,.01,glow);strand.material=new T.MeshBasicMaterial({color:0x95d9d3,transparent:true,opacity:.18});falls.push(strand);}for(let j=0;j<4;j++)ball(x-2+j*1.4,h+.3,z-2,1.8,moss);}}
 // Rings of paths and cultivated terraces connect the central sanctuary to the landscape.
 for(const radius of[15,SHRINE_RADIUS,52,83]){const path=new T.Mesh(new T.RingGeometry(radius-1.5,radius+1.5,180),material(0x3d5a57));path.rotation.x=-Math.PI/2;path.position.y=-.12;world.add(path);const seam=new T.Mesh(new T.TorusGeometry(radius+.8,.025,6,200),glow);seam.rotation.x=Math.PI/2;seam.position.y=-.09;world.add(seam);}
 // Every active world receives a clear approach; empty catalog slots remain garden.
 for(const portal of shrinePortals){const a=Math.atan2(portal.x,portal.z),middle=(12+SHRINE_RADIUS)/2,length=SHRINE_RADIUS-12;const bridge=box(Math.sin(a)*middle,-.1,Math.cos(a)*middle,3.4,.14,length,material(0x415651,.68,.16));bridge.rotation.y=a;for(const side of[-1,1])rod(new T.Vector3(Math.sin(a)*12+Math.cos(a)*side*1.45,-.02,Math.cos(a)*12-Math.sin(a)*side*1.45),new T.Vector3(Math.sin(a)*(SHRINE_RADIUS-3.6)+Math.cos(a)*side*1.45,-.02,Math.cos(a)*(SHRINE_RADIUS-3.6)-Math.sin(a)*side*1.45),.024,gold);}
 // Inlaid basalt segments make the constellation readable from both camera heights.
 const tesserae=new T.InstancedMesh(new T.BoxGeometry(1,.14,1),material(0x223d40,.63,.35),192),tile=new T.Object3D();for(let i=0;i<192;i++){const a=i/192*Math.PI*2;tile.position.set(Math.sin(a)*(SHRINE_RADIUS-4.1),-.06,Math.cos(a)*(SHRINE_RADIUS-4.1));tile.rotation.y=a;tile.scale.set(.28,1,1.35);tile.updateMatrix();tesserae.setMatrixAt(i,tile.matrix);}world.add(tesserae);
 // Low garden islands sit between the avenues, preserving a wide path to every shrine.
 const fernGeo=new T.SphereGeometry(1,8,5),ferns=new T.InstancedMesh(fernGeo,material(0x427462,.85),shrinePortals.length*36),fern=new T.Object3D();let fernIndex=0;
 for(let i=0;i<shrinePortals.length;i++){const a=Math.PI+(i+.5)/shrinePortals.length*Math.PI*2,r=22,x=Math.sin(a)*r,z=Math.cos(a)*r;const island=cyl(x,-.025,z,3.1,.18,basalt,3.1,32);island.scale.z=.7;for(let j=0;j<36;j++){const f=j*2.399,radius=.3+Math.sqrt(j/36)*2.65;fern.position.set(x+Math.sin(f)*radius,.22+(j%5)*.085,z+Math.cos(f)*radius*.67);fern.rotation.set(.12,f,.25);fern.scale.set(.38,.55+(j%3)*.2,.19);fern.updateMatrix();ferns.setMatrixAt(fernIndex++,fern.matrix);}const lamp=box(x,.57,z,.16,1.1,.16,silver);box(x,1.15,z,.21,.12,.21,glow);}
 world.add(ferns);
 // Efficient groves with instanced trunks and layered canopies.
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.25,.4,4,7),bark,170),crowns=new T.InstancedMesh(new T.SphereGeometry(1,12,7),moss,510),d=new T.Object3D();let seed=721;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<170;i++){let x=0,z=0;do{const a=rand()*Math.PI*2,r=49+rand()*59;x=Math.cos(a)*r;z=Math.sin(a)*r;}while((Math.abs(x)<53&&z<5&&z>-69)||Math.abs(x)<4||Math.abs(z)<4);const s=.7+rand()*.9;d.position.set(x,1.7*s,z);d.scale.set(s,s,s);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);for(let k=0;k<3;k++){d.position.set(x+Math.sin(k*2.4),s*(3.7+k*.7),z+Math.cos(k*2.4));d.scale.set(2.6*s,1.2*s,2.6*s);d.updateMatrix();crowns.setMatrixAt(i*3+k,d.matrix);}}world.add(trunks,crowns);
 // Poseidon-inspired guardian, sculpted from original primitives: armour, crest and trident.
 const statue=new T.Group();statue.position.set(0,0,-47);world.add(statue);const s=kit(statue);s.cyl(0,.6,0,4,1.2,basalt,3.7);s.cyl(0,1.24,0,3.7,.05,gold);for(const x of[-.75,.75]){s.box(x,2,0,.72,1.8,.85,silver);s.box(x,1.4,.3,1,.5,1.4,basalt);}s.cyl(0,4.1,0,1.4,2.5,silver,.85,8);s.ball(0,6.1,0,.82,silver);s.box(0,6,.69,.8,.2,.07,glow);for(const x of[-1.4,1.4]){s.ball(x,4.9,0,.8,gold);s.rod(new T.Vector3(x,4.8,0),new T.Vector3(x*1.5,3.7,.2),.31,silver);}for(let i=-2;i<=2;i++){const crown=new T.Mesh(new T.ConeGeometry(.14,1+Math.abs(i)*.15,4),gold);crown.position.set(i*.3,7.02,.05);statue.add(crown);}s.rod(new T.Vector3(2.2,1,.2),new T.Vector3(2.2,8.5,.2),.075,gold);for(const dx of[-.65,0,.65]){s.rod(new T.Vector3(2.2,7.5,.2),new T.Vector3(2.2+dx,8.3,.2),.065,gold);s.rod(new T.Vector3(2.2+dx,8.3,.2),new T.Vector3(2.2+dx,9,.2),.065,glow);}const name=textSprite('THE TIDAL GUARDIAN','#e3d9b4',5.6);name.position.set(0,10,0);statue.add(name);
 // Solar arches and quiet technology embedded in the park.
 for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*65,z=Math.sin(a)*65;cyl(x,2,z,.12,4,silver);const panel=box(x,4.2,z,6,.1,3,material(0x284751,.25,.5));panel.rotation.z=.16;for(let k=0;k<6;k++)box(x-2.5+k,4.26,z,.03,.03,2.7,glow);}
 // A distant broken moon-ring frames the waterfalls without adding another destination.
 const moon=new T.Mesh(new T.SphereGeometry(7.5,40,24),new T.MeshBasicMaterial({color:0xc3d7d2}));moon.position.set(-24,48,-116);world.add(moon);
 const skyArch=new T.Mesh(new T.TorusGeometry(24,.35,7,96,Math.PI*1.65),material(0x35505a,.5,.65));skyArch.position.set(0,23,-88);skyArch.rotation.z=-.32;world.add(skyArch);
 for(const sign of[-1,1]){const ruin=box(sign*22,7,-88,2.3,14,3.2,basalt);ruin.rotation.z=-sign*.08;box(sign*22,14.2,-87.9,2.6,.15,3.6,gold);}
 const stars=[];for(let i=0;i<460;i++){const a=rand()*Math.PI*2,r=140+rand()*35;stars.push(Math.cos(a)*r,18+rand()*115,Math.sin(a)*r);}const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));const starField=new T.Points(starGeo,new T.PointsMaterial({color:0xc4e2dc,size:.2,transparent:true,opacity:.55,sizeAttenuation:true,depthWrite:false}));world.add(starField);
 // A single soft-particle pass gathers rising mist at the actual waterfall feet.
 const mistGeo=new T.BufferGeometry(),pts=[];for(let i=0;i<640;i++)pts.push(rand(),rand(),i%8);mistGeo.setAttribute('position',new T.Float32BufferAttribute(pts,3));
 const mist=new T.Points(mistGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:motionClock},vertexShader:`uniform float time;varying float alpha;void main(){float tier=mod(position.z,4.);float side=position.z<4.?-1.:1.;float life=fract(position.x+time*.045);float angle=position.y*6.28318;float spread=.7+life*3.;vec3 p=vec3(side*(38.+tier*7.)+cos(angle)*spread,.12+sin(life*3.14159)*(1.+position.y*2.),-37.-tier*6.+sin(angle)*spread*.6);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((120.+life*180.)/-mv.z,1.,30.);alpha=sin(life*3.14159)*.16;}`,fragmentShader:`varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.55,.88,.83,exp(-r*r*5.)*alpha);}`}));mist.frustumCulled=false;world.add(mist);
 // Low, luminous wave fronts spread from each cascade without individual particle meshes.
 const ripples=new T.InstancedMesh(new T.RingGeometry(.9,1,48),new T.MeshBasicMaterial({color:0x80b9b2,transparent:true,opacity:.13,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}),24),rippleObject=new T.Object3D();world.add(ripples);ripples.instanceMatrix.setUsage(T.DynamicDrawUsage);

 let ripplesReady=false;return(t:number,motion:boolean)=>{if(!motion&&ripplesReady)return;const stamp=motion?t:0;flow.value=stamp*.001;falls.forEach((f,i)=>{if(i%9!==0)(f.material as T.MeshBasicMaterial).opacity=.09+.12*(.5+.5*Math.sin(stamp*.003+i));});for(let i=0;i<24;i++){const tier=Math.floor(i/3)%4,side=i<12?-1:1,phase=(stamp*.00013+i/3)%1;rippleObject.position.set(side*(38+tier*7),.09,-37-tier*6);rippleObject.rotation.x=-Math.PI/2;rippleObject.scale.setScalar(.5+phase*3.2);rippleObject.updateMatrix();ripples.setMatrixAt(i,rippleObject.matrix);}ripples.instanceMatrix.needsUpdate=true;ripplesReady=true;};
}

// Collision footprints stay independent of decorative meshes and camera detail.
export type GardenPoint={x:number;z:number};
type Obstacle={x:number;z:number;r:number}|{x:number;z:number;halfX:number;halfZ:number};
export const gardenObstacles:Obstacle[]=[
 ...shrinePortals.flatMap(p=>{const a=Math.atan2(-p.x,-p.z);return[-1,1].map(sign=>({x:p.x+Math.cos(a)*sign*2.85,z:p.z-Math.sin(a)*sign*2.85,r:.61}));}),
 {x:0,z:0,r:3.62}, {x:-4,z:-1,r:1.65},{x:4.3,z:1,r:1.5},{x:-.7,z:4.4,r:1.2},{x:4.9,z:-8.5,r:1.35},{x:-5,z:-8.2,r:1.35},
 {x:-8,z:-6.85,halfX:1.35,halfZ:1.1},{x:8,z:-6.85,halfX:1.35,halfZ:1.1},
 {x:-5,z:4,halfX:1.25,halfZ:.85},{x:5,z:4,halfX:1.25,halfZ:.85},{x:0,z:-47,r:4.12},
 ...[-1,1].flatMap(sign=>Array.from({length:4},(_,tier)=>({x:sign*(38+tier*7),z:-48-tier*5,r:10-tier})))
];
const actorRadius=.36;
export function gardenWalkable(x:number,z:number){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x< -90||x>90||z< -70||z>80)return false;
 return !gardenObstacles.some(o=>'r'in o?Math.hypot(x-o.x,z-o.z)<o.r+actorRadius:Math.abs(x-o.x)<o.halfX+actorRadius&&Math.abs(z-o.z)<o.halfZ+actorRadius);
}
export function resolveGardenPosition(position:GardenPoint):GardenPoint{
 const p={x:Math.max(-90,Math.min(90,Number.isFinite(position.x)?position.x:0)),z:Math.max(-70,Math.min(80,Number.isFinite(position.z)?position.z:6.3))};
 for(let pass=0;pass<5;pass++)for(const o of gardenObstacles){
  const dx=p.x-o.x,dz=p.z-o.z;
  if('r'in o){const radius=o.r+actorRadius+.015,d=Math.hypot(dx,dz);if(d<radius){p.x=o.x+(d>.0001?dx/d:1)*radius;p.z=o.z+(d>.0001?dz/d:0)*radius;}}
  else{const hx=o.halfX+actorRadius+.015,hz=o.halfZ+actorRadius+.015;if(Math.abs(dx)<hx&&Math.abs(dz)<hz){if(hx-Math.abs(dx)<hz-Math.abs(dz))p.x=o.x+Math.sign(dx||1)*hx;else p.z=o.z+Math.sign(dz||1)*hz;}}
 }
 return p;
}
function clearWalk(a:GardenPoint,b:GardenPoint){const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35);for(let i=1;i<=steps;i++){const u=i/steps;if(!gardenWalkable(a.x+(b.x-a.x)*u,a.z+(b.z-a.z)*u))return false;}return true;}
/** Bounded one-metre navigation grid, then line-of-sight smoothing. No network route service. */
export function gardenPath(start:GardenPoint,requested:GardenPoint):GardenPoint[]{
 const goal=resolveGardenPosition(requested);if(clearWalk(start,goal))return[goal];
 const width=181,encode=(x:number,z:number)=>(z+70)*width+x+90,decode=(key:number)=>({x:key%width-90,z:Math.floor(key/width)-70});
 const nearest=(p:GardenPoint)=>{const x=Math.round(p.x),z=Math.round(p.z);for(let ring=0;ring<7;ring++)for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++)if(Math.max(Math.abs(dx),Math.abs(dz))===ring&&gardenWalkable(x+dx,z+dz))return encode(x+dx,z+dz);return -1;};
 const from=nearest(start),to=nearest(goal);if(from<0||to<0)return[];
 const target=decode(to),heap:[number,number][]=[],score=new Map<number,number>([[from,0]]),came=new Map<number,number>(),closed=new Set<number>();
 const push=(key:number,cost:number)=>{heap.push([key,cost]);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(heap[parent][1]<=cost)break;[heap[parent],heap[i]]=[heap[i],heap[parent]];i=parent;}};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){const a=i*2+1,b=a+1;if(a>=heap.length)break;const j=b<heap.length&&heap[b][1]<heap[a][1]?b:a;if(heap[i][1]<=heap[j][1])break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return first[0];};
 const heuristic=(x:number,z:number)=>Math.hypot(x-target.x,z-target.z);push(from,heuristic(start.x,start.z));
 while(heap.length&&closed.size<22000){const key=pop();if(closed.has(key))continue;if(key===to){const path:GardenPoint[]=[goal];let cursor=to;while(cursor!==from){path.unshift(decode(cursor));cursor=came.get(cursor)!;}const smooth:GardenPoint[]=[];let anchor=start,index=0;while(index<path.length){let far=path.length-1;while(far>index&&!clearWalk(anchor,path[far]))far--;smooth.push(path[far]);anchor=path[far];index=far+1;}return smooth;}
  closed.add(key);const at=decode(key);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const x=at.x+dx,z=at.z+dz;if(!gardenWalkable(x,z)||(dx&&dz&&(!gardenWalkable(at.x+dx,at.z)||!gardenWalkable(at.x,at.z+dz))))continue;const next=encode(x,z),cost=score.get(key)!+Math.hypot(dx,dz);if(cost<(score.get(next)??Infinity)){score.set(next,cost);came.set(next,key);push(next,cost+heuristic(x,z));}}
 }
 return[];
}

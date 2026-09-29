import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {kit,material,textSprite,disposeScene} from './three-kit';
import {shrinePortals} from './garden-shrines';

type Placement={p:[number,number,number];s:[number,number,number];r?:[number,number,number]};
export const gardenPavilions=[{x:-18,z:44},{x:18,z:44}];
export const discoveriesCourt={x:-18,z:44};
export const gardenLotusBeds=[{x:-27,z:44},{x:27,z:44}];
const landmark=(id:string)=>{const portal=shrinePortals.find(p=>p.id===id);if(!portal)return null;const a=Math.atan2(portal.x,portal.z);return{x:Math.sin(a)*40,z:Math.cos(a)*40};};
const skylineLandmark=landmark('skyline'),arenaLandmark=landmark('universe-clash'),reefLandmark=landmark('coral-memory');
/** Ground-level footprints only: open pavilion interiors remain usable. */
export const gardenArchitectureObstacles=[
 ...gardenPavilions.flatMap(p=>[-1,1].flatMap(dx=>[-1,1].map(dz=>({x:p.x+dx*2.1,z:p.z+dz*2.1,r:.31})))),
 ...gardenLotusBeds.map(p=>({...p,r:2.7})),
 {...discoveriesCourt,r:1.28},
 {x:-18,z:5,r:2.4},
 ...[skylineLandmark,arenaLandmark].filter((p):p is {x:number;z:number}=>!!p).map(p=>({...p,r:3.05})),
 ...(reefLandmark?[{...reefLandmark,halfX:2.4,halfZ:.7}]:[])
];
export const gardenArchitectureClearings=[...gardenPavilions,...gardenLotusBeds,...[skylineLandmark,arenaLandmark,reefLandmark].filter((p):p is {x:number;z:number}=>!!p)];

/** Original garden architecture: a distant moonlit palace and small world-specific landmarks. */
export function gardenArchitecture(parent:T.Group){
 const root=new T.Group();root.name='moonwater-architecture';parent.add(root);
 const stone=material(0x819991,.62,.12),dark=material(0x20393f,.68,.15),bronze=material(0x9c875c,.37,.55),inlay=new T.MeshBasicMaterial({color:0x7dbfb6}),warm=new T.MeshBasicMaterial({color:0xdab07c}),night=new T.MeshBasicMaterial({color:0x0d242e});
 const batches=new Map<string,{geometry:T.BufferGeometry;material:T.Material;items:Placement[]}>();
 const add=(key:string,geometry:T.BufferGeometry,mat:T.Material,p:Placement['p'],s:Placement['s'],r?:Placement['r'])=>{if(!batches.has(key))batches.set(key,{geometry,material:mat,items:[]});batches.get(key)!.items.push({p,s,r});};
 const cube=new T.BoxGeometry(1,1,1),column=new T.CylinderGeometry(1,1,1,16),arch=new T.TorusGeometry(1,.13,6,32,Math.PI),spire=new T.ConeGeometry(1,1,12);
 const profile=[[0,0],[.79,0],[.98,.2],[1,.45],[.87,.76],[.61,1.04],[.29,1.33],[.07,1.59],[0,1.7]].map(([x,y])=>new T.Vector2(x,y));
 const dome=new T.LatheGeometry(profile,36);
 const block=(p:Placement['p'],s:Placement['s'],mat=stone)=>add(mat===dark?'dark-blocks':mat===bronze?'bronze-blocks':'palace-stone',cube,mat,p,s);
 const shaft=(p:Placement['p'],s:Placement['s'],mat=stone)=>add(mat===bronze?'bronze-columns':'stone-columns',column,mat,p,s);
 const cupola=(x:number,y:number,z:number,r:number)=>{shaft([x,y+.28,z],[r*.83,.56,r*.83]);add('domes',dome,stone,[x,y+.55,z],[r,r,r]);shaft([x,y+r*1.7+.77,z],[.065,.65,.065],bronze);};

 // The palace remains beyond the existing walk boundary: it frames the lake, never a portal avenue.
 block([0,.25,-88],[65,.6,24],dark);block([0,.59,-88],[64,.09,23],bronze);
 block([0,5.2,-88],[15,9.2,15]);block([-17,3.9,-88],[19,6.6,15]);block([17,3.9,-88],[19,6.6,15]);
 cupola(0,9.8,-88,5.3);
 for(const x of[-20,-10,10,20]){
  for(const dx of[-1.6,1.6])for(const dz of[-1.6,1.6])shaft([x+dx,8.3,-88+dz],[.16,2.4,.16]);
  cupola(x,9.5,-88,2.35);
 }
 for(const x of[-30,30])for(const z of[-80,-98]){
  shaft([x,7.6,z],[.7,14,.7]);shaft([x,2.2,z],[1.13,.34,1.13]);shaft([x,11.7,z],[1.03,.25,1.03]);shaft([x,14.6,z],[1.25,.28,1.25]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;shaft([x+Math.sin(a)*.87,15.4,z+Math.cos(a)*.87],[.095,1.5,.095]);}
  cupola(x,16.1,z,1.42);
 }
 // Recessed arches and a repeated jali lattice read as architecture at both camera distances.
 for(let i=-6;i<=6;i++){
  const x=i*4.25,h=i===0?6.1:4.5,w=i===0?2.15:1.45;
  add('shadowed-recesses',cube,night,[x,1.9,-80.44],[w*1.75,3,.03]);
  add('arcades',arch,stone,[x,h-1.1,-80.31],[w,w,1]);
  for(const side of[-1,1])shaft([x+side*w,(h-1.1)/2+.5,-80.28],[.14,h-1.1,.14]);
  for(let k=0;k<5;k++)add('jali',cube,bronze,[x+(k-2)*w*.31,2.03,-80.18],[.045,2.55,.045]);
  for(let k=0;k<5;k++)add('jali',cube,bronze,[x,1.0+k*.48,-80.17],[w*1.44,.04,.04]);
  for(const side of[-1,1])add('warm-garden-lights',cube,warm,[x+side*w*.83,3.05,-80.1],[.065,.78,.035]);
 }
 for(const x of[-17,17])block([x,7.27,-88],[19.6,.22,15.6],bronze);

 // Open chhatris bring the palace's language into the walkable garden. The floor is
 // level with the paths, and only the four slender columns interrupt movement.
 for(const {x,z} of gardenPavilions){
  block([x,-.11,z],[5.6,.08,5.6],dark);block([x,-.056,z],[5.15,.035,5.15],stone);
  for(const dx of[-1,1])for(const dz of[-1,1]){
   shaft([x+dx*2.1,1.62,z+dz*2.1],[.25,3.4,.25]);
   shaft([x+dx*2.1,.02,z+dz*2.1],[.32,.16,.32],bronze);
   shaft([x+dx*2.1,3.27,z+dz*2.1],[.38,.18,.38],bronze);
  }
  for(const dz of[-1,1])add('arcades',arch,stone,[x,2.02,z+dz*2.1],[2.1,1.25,1]);
  for(const dx of[-1,1])add('arcades',arch,stone,[x+dx*2.1,2.02,z],[2.1,1.25,1],[0,Math.PI/2,0]);
  block([x,3.38,z],[5.35,.22,5.35],bronze);block([x,3.56,z],[5.55,.14,5.55]);
  for(const dz of[-1,1])add('warm-garden-lights',cube,warm,[x,3.27,z+dz*2.14],[3.35,.045,.035]);
  for(const dx of[-1,1])add('warm-garden-lights',cube,warm,[x+dx*2.14,3.27,z],[.035,.045,3.35]);
  cupola(x,3.6,z,2.7);
  for(const dx of[-1,1])for(const dz of[-1,1])cupola(x+dx*2.35,3.62,z+dz*2.35,.48);
  // A recessed brass compass at foot level links architecture to the sky/technology theme.
  shaft([x,-.031,z],[.78,.018,.78],bronze);
  for(const dz of[-1,1])block([x,3.44,z+dz*2.69],[4.9,.065,.085],bronze);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;add('garden-inlay',cube,inlay,[x+Math.sin(a)*1.12,-.025,z+Math.cos(a)*1.12],[.035,.01,.44],[0,a,0]);}
 }

 // Landmarks sit behind selected portals. Their original silhouettes hint at the next world.
 const skyline=shrinePortals.find(p=>p.id==='skyline');
 if(skyline){const a=Math.atan2(skyline.x,skyline.z),cx=Math.sin(a)*40,cz=Math.cos(a)*40;
  for(let i=-2;i<=2;i++){const h=4.1+(2-Math.abs(i))*1.2,x=cx+Math.cos(a)*i*1.08,z=cz-Math.sin(a)*i*1.08;
   add('skyline-towers',cube,dark,[x,h/2,z],[.82,h,.86],[0,a,0]);
   for(let j=0;j<5;j++)add('skyline-windows',cube,inlay,[x+Math.sin(a)*.45,1+j*.75,z+Math.cos(a)*.45],[.35,.17,.02],[0,a,0]);
  }
  add('skyline-beacon',spire,bronze,[cx,7.7,cz],[.22,2,.22]);
 }
 const arena=shrinePortals.find(p=>p.id==='universe-clash');
 if(arena){const a=Math.atan2(arena.x,arena.z),x=Math.sin(a)*40,z=Math.cos(a)*40;
  shaft([x,.28,z],[2.6,.5,2.6],bronze);
  const ring=new T.TorusGeometry(2.0,.075,7,48);
  for(const tilt of[-.65,.65])add('arena-energy-rings',ring,inlay,[x,3.05,z],[1,1,1],[tilt,a,0]);
  add('arena-core',new T.IcosahedronGeometry(.64,1),inlay,[x,3.05,z],[1,1.35,1]);
  for(let k=0;k<4;k++){const theta=k*Math.PI/2;add('arena-pylons',spire,stone,[x+Math.sin(theta)*2.5,1.5,z+Math.cos(theta)*2.5],[.4,3,.4]);}
 }

 const transform=new T.Object3D();
 for(const[name,batch]of batches){const mesh=new T.InstancedMesh(batch.geometry,batch.material,batch.items.length);mesh.name=name;
  batch.items.forEach(({p,s,r},index)=>{transform.position.set(...p);transform.scale.set(...s);transform.rotation.set(...(r||[0,0,0]));transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);});
  mesh.computeBoundingSphere();mesh.receiveShadow=true;root.add(mesh);
 }

 // Small original Blender exports from the user's local FAB ASSETS library, never marketplace stand-ins.
 let disposed=false;const mixers:T.AnimationMixer[]=[];const loader=new GLTFLoader();
 const load=(url:string,name:string,x:number,z:number,width:number)=>loader.load(url,gltf=>{
  if(disposed){disposeScene(gltf.scene);return;}
  const asset=gltf.scene,bounds=new T.Box3().setFromObject(asset),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=width/Math.max(size.x,size.z,.001);asset.scale.setScalar(scale);asset.position.set(x-center.x*scale,-bounds.min.y*scale,z-center.z*scale);asset.name=name;root.add(asset);
  asset.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=true;}});
  if(gltf.animations.length){const mixer=new T.AnimationMixer(asset);gltf.animations.forEach(clip=>mixer.clipAction(clip).play());mixers.push(mixer);}
 },undefined,()=>{/* Decorative asset is optional; the whole garden remains usable. */});
 load('/models/garden/wind-shrine.glb','original-wind-shrine',-18,5,4.5);
 const reef=shrinePortals.find(p=>p.id==='coral-memory');
 if(reef){const a=Math.atan2(reef.x,reef.z);load('/models/garden/modular-portal-arch.glb','original-reef-observation-arch',Math.sin(a)*40,Math.cos(a)*40,4.5);}
 const court=new T.Group();court.name='discoveries-court';court.position.set(discoveriesCourt.x,0,discoveriesCourt.z);root.add(court);
 const trophy=kit(court),award=material(0xc6a267,.26,.78);
 trophy.cyl(0,.12,0,1.2,.3,dark,1.2,24);trophy.cyl(0,.32,0,1.05,.1,bronze,1.05,24);
 trophy.cyl(0,.54,0,.74,.35,stone,.82,16);trophy.cyl(0,.82,0,.5,.15,award,.6,16);
 trophy.cyl(0,1.17,0,.16,.55,award,.2,16);
 const cupProfile=[[.16,0],[.36,.06],[.66,.42],[.69,.68],[.63,.71],[.58,.41],[.3,.11],[.15,.08]].map(([x,y])=>new T.Vector2(x,y));
 const cup=new T.Mesh(new T.LatheGeometry(cupProfile,32),award);cup.position.y=1.37;court.add(cup);
 for(const sign of[-1,1]){const handle=new T.Mesh(new T.TorusGeometry(.36,.055,6,24,Math.PI*1.45),award);handle.position.set(sign*.64,1.73,0);handle.rotation.z=sign<0?Math.PI*.28:-Math.PI*.72;court.add(handle);}
 const spark=new T.Mesh(new T.OctahedronGeometry(.18),warm);spark.position.set(0,2.14,0);court.add(spark);
 const courtTitle=textSprite('DISCOVERIES COURT','#ecd6ac',4.9);courtTitle.position.set(0,3.05,2.86);court.add(courtTitle);
 const courtHint=textSprite('LEADERBOARD','#cdbf9e',3.2);courtHint.position.set(0,2.55,2.87);court.add(courtHint);
 const viewSign=textSprite('VIEWS · 30D  —','#e2cfaa',2.35),favoriteSign=textSprite('FAVORITES  —','#e2cfaa',2.35);
 viewSign.position.set(-2.06,1.47,-.3);favoriteSign.position.set(2.06,1.47,-.3);court.add(viewSign,favoriteSign);
 const leaderboardPickables:T.Object3D[]=[];court.traverse(o=>{o.userData.leaderboard=true;if(o instanceof T.Mesh||o instanceof T.Sprite)leaderboardPickables.push(o);});
 let countKey='';
 const updateCounts=(counts:{views:number|null;favorites:number|null})=>{const format=(value:number|null)=>value===null?'—':new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(value),views=`VIEWS · 30D  ${format(counts.views)}`,favorites=`FAVORITES  ${format(counts.favorites)}`,key=views+'|'+favorites;if(key===countKey)return;countKey=key;
  for(const [sprite,label]of[[viewSign,views],[favoriteSign,favorites]] as const){const canvas=sprite.material.map!.image as HTMLCanvasElement,ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(22,30,29,.84)';ctx.beginPath();ctx.roundRect(12,18,canvas.width-24,canvas.height-36,20);ctx.fill();ctx.fillStyle='#e2cfaa';ctx.font='500 35px system-ui';ctx.textAlign='center';ctx.fillText(label,canvas.width/2,canvas.height*.62);sprite.material.map!.needsUpdate=true;}
 };
 return{leaderboardPickables,updateCounts,animate(dt:number,motion:boolean){if(motion){mixers.forEach(m=>m.update(dt));spark.rotation.y+=dt*.3;}},dispose(){disposed=true;mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});}};
}

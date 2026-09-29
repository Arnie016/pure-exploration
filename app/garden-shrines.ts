import*as T from'three';
import{projects}from'./projects';
import{material,textSprite}from'./three-kit';

// Twenty-four possible places, populated only by real, playable catalog worlds.
export const SHRINE_CAPACITY=24;
export const SHRINE_RADIUS=32;
const colors:Record<string,number>={telescope:0xe8c58c,airport:0x89d9e7,lightning:0xbbadf0,aeolith:0xe6a6be,'fable-flight':0xb5d5a1,galevein:0x8edbc5,'universe-clash':0xefb287,spacetime:0xf2c78d,poe:0xc2b2dd,tides:0x8edacb,skyline:0xf0a9a2};
export const shrinePortals=projects.filter(p=>!!p.url).slice(0,SHRINE_CAPACITY).map((p,i,list)=>{const angle=Math.PI+i/list.length*Math.PI*2;return{id:p.id,title:p.title,category:p.category,image:p.image,color:colors[p.id]||0xa9d8cf,x:Math.sin(angle)*SHRINE_RADIUS,z:Math.cos(angle)*SHRINE_RADIUS};});
export type ShrinePortal=typeof shrinePortals[number];

function stoneTexture(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;g.fillStyle='#aab5b0';g.fillRect(0,0,256,256);let seed=73;for(let i=0;i<6000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;const y=seed%256;g.fillStyle=i%3?'#8e9d9819':'#d4dbd628';g.fillRect(x,y,1+(i%4),1);}for(let i=0;i<7;i++){g.strokeStyle='#526d6917';g.beginPath();g.moveTo(i*43,0);g.bezierCurveTo(i*43+35,80,i*43-20,160,i*43+12,256);g.stroke();}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,4);t.colorSpace=T.SRGBColorSpace;return t;}
function emblem(id:string,color:string){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;c.translate(128,128);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=8;c.lineCap='round';c.lineJoin='round';c.shadowColor=color;c.shadowBlur=16;const path=(pts:number[][],close=false)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();c.stroke();};const circle=(r:number,x=0,y=0)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();};
 switch(id){case'telescope':circle(48);c.save();c.rotate(-.65);c.scale(1.55,.45);circle(61);c.restore();c.beginPath();c.arc(58,-58,8,0,Math.PI*2);c.fill();break;
 case'airport':case'fable-flight':path([[0,-78],[17,-13],[74,21],[74,35],[14,21],[12,64],[32,80],[0,68],[-32,80],[-12,64],[-14,21],[-74,35],[-74,21],[-17,-13],[0,-78]]);break;
 case'lightning':path([[18,-82],[-43,7],[0,7],[-20,83],[47,-15],[5,-15],[18,-82]],true);break;
 case'skyline':for(let i=0;i<8;i++){const a=i*Math.PI/4;path([[0,0],[Math.cos(a)*83,Math.sin(a)*83]]);}for(const r of[30,58,82]){c.beginPath();for(let i=0;i<=8;i++){const a=i*Math.PI/4,x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}break;
 case'tides':path([[0,79],[0,-73]]);path([[-62,-66],[-60,-5],[0,26],[60,-5],[62,-66]]);for(const x of[-62,0,62])path([[x-12,-46],[x,-73],[x+12,-46]]);break;
 case'poe':path([[-80,23],[-38,-25],[0,-8],[36,-58],[68,-42],[44,-20],[76,10],[20,8],[-13,46],[-35,30],[-80,23]],true);break;
 case'galevein':path([[-80,48],[-62,-47],[-24,-14],[0,-74],[24,-14],[62,-47],[80,48],[33,17],[0,65],[-33,17],[-80,48]],true);break;
 case'spacetime':circle(37);c.save();c.rotate(-.45);c.scale(1.45,.42);circle(65);c.restore();break;
 case'universe-clash':path([[-60,-73],[48,62],[65,76]]);path([[60,-73],[-48,62],[-65,76]]);path([[-68,41],[-33,73]]);path([[68,41],[33,73]]);circle(20);break;
 default:path([[0,-83],[55,-13],[23,64],[0,84],[-23,64],[-55,-13],[0,-83]],true);path([[0,-83],[0,84]]);}
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;}

export function buildShrines(scene:T.Scene,portals:ShrinePortal[]){const root=new T.Group();root.name='constellation-shrines';scene.add(root);const clock={value:0},textures:T.Texture[]=[];let disposed=false;const pickables:T.Object3D[]=[];const stoneMap=stoneTexture();textures.push(stoneMap);const dark=new T.MeshStandardMaterial({color:0x15292e,map:stoneMap,roughness:.75,metalness:.18}),stone=new T.MeshStandardMaterial({color:0x526d68,map:stoneMap,roughness:.64,metalness:.25}),brass=material(0x9e865c,.32,.78),black=material(0x081820,.55,.5),garden=material(0x264e40,.92);
 const boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,24),capGeo=new T.ConeGeometry(1,1,5),archGeo=new T.TorusGeometry(2.5,.18,8,64,Math.PI),innerGeo=new T.CircleGeometry(2.24,64),haloGeo=new T.PlaneGeometry(7.6,8.6),ringGeo=new T.TorusGeometry(2.25,.045,6,96);
 const fx:{halo:T.Mesh;orbit:T.Group;glyph:T.Mesh;phase:number}[]=[];
 const seeds=[];for(let i=0;i<84;i++)seeds.push(i/84,((i*37)%84)/84,0);const traceGeo=new T.BufferGeometry();traceGeo.setAttribute('position',new T.Float32BufferAttribute(seeds,3));
 const loader=new T.TextureLoader();
 portals.forEach((p,index)=>{const gate=new T.Group();gate.position.set(p.x,-.1,p.z);gate.rotation.y=Math.atan2(-p.x,-p.z);root.add(gate);const color=new T.Color(p.color),glow=new T.MeshBasicMaterial({color:p.color}),metal=new T.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.35,roughness:.23,metalness:.75});
 const shape=(geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1,rz=0)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;m.receiveShadow=true;gate.add(m);return m;};
 // Broad tiered plinths and an avenue-facing staircase give the doors architectural weight.
 shape(cylGeo,dark,0,.12,0,3.65,.3,3.65);shape(cylGeo,stone,0,.31,0,3.25,.12,3.25);shape(cylGeo,brass,0,.4,0,3.14,.055,3.14);shape(cylGeo,dark,0,.47,0,3.06,.1,3.06);
 for(let step=0;step<3;step++)shape(boxGeo,stone,0,.06+step*.08,3.12-step*.35,4.9-step*.15,.12,.7);
 for(const sign of[-1,1]){const column=shape(boxGeo,dark,sign*2.85,2.65,0,.58,4.5,.95);column.castShadow=true;shape(boxGeo,stone,sign*2.85,.83,0,.95,.7,1.2);shape(boxGeo,brass,sign*2.85,4.84,0,.85,.14,1.12);shape(boxGeo,glow,sign*2.855,2.75,.485,.065,3.4,.022);shape(capGeo,stone,sign*2.85,5.4,0,.65,1.04,.65);for(let rune=0;rune<3;rune++)shape(boxGeo,brass,sign*2.852,1.12+rune*1.2,.505,.5,.07,.035);}
 const arch=shape(archGeo,stone,0,3.08,0);arch.scale.x=1.15;shape(archGeo,brass,0,3.08,.03,1.23,1.05,1);shape(boxGeo,dark,0,5.62,-.22,1.5,.66,.7);shape(boxGeo,brass,0,5.27,.16,1.8,.085,.12);
 const ring=shape(ringGeo,metal,0,2.89,.08);ring.scale.set(1,1.04,1);
 // A portal image is recessed into animated glass, not displayed as a floating card.
 const veil=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock,tint:{value:color},cover:{value:null},hasCover:{value:0},phase:{value:index}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float phase;uniform vec3 tint;uniform sampler2D cover;uniform float hasCover;void main(){vec2 q=vUv-.5;float r=length(q)*2.;float a=atan(q.y,q.x);float rim=pow(smoothstep(.64,1.,r),4.);float ripple=sin(r*24.-time*.7+phase)*.004*(1.-r);vec2 uv=clamp(vUv+normalize(q+vec2(.0001))*ripple,0.,1.);vec3 scene=texture2D(cover,uv).rgb;scene=mix(tint*.13,scene*.68,hasCover);float veil=pow(.5+.5*sin(a*3.+r*11.-time*.32+phase),12.);scene+=tint*(rim*.72+veil*.12);float edge=1.-smoothstep(.96,1.,r);gl_FragColor=vec4(scene,edge*.96);}`});
 const inner=shape(innerGeo,veil,0,2.9,.055);inner.scale.y=1.04;
 if(p.image?.startsWith('/')){const texture=loader.load(p.image,image=>{if(disposed){image.dispose();return;}image.colorSpace=T.SRGBColorSpace;veil.uniforms.cover.value=image;veil.uniforms.hasCover.value=1;},undefined,()=>{});textures.push(texture);}
 const icon=emblem(p.id,'#'+color.getHexString());textures.push(icon);const glyph=shape(new T.PlaneGeometry(1.48,1.48),new T.MeshBasicMaterial({map:icon,transparent:true,depthWrite:false,side:T.DoubleSide}),0,5.77,.25);
 // Each destination changes the silhouette of its shrine.
 if(['telescope','spacetime'].includes(p.id)){const orbit=new T.Mesh(new T.TorusGeometry(3.32,.035,6,96),brass);orbit.position.set(0,3,.15);orbit.rotation.set(.18,.28,-.3);gate.add(orbit);shape(cylGeo,glow,-3.08,3.8,.4,.12,.16,.12);}
 if(['airport','fable-flight'].includes(p.id)){for(const sign of[-1,1])shape(boxGeo,stone,sign*2.15,6.08,-.1,3.9,.18,1.25,-sign*.18);shape(boxGeo,glow,0,5.83,.56,4.6,.035,.02);}
 if(['galevein','tides'].includes(p.id)){for(const sign of[-1,1]){shape(capGeo,metal,sign*3.13,5.93,-.05,.42,2.4,.48,-sign*.24);shape(boxGeo,garden,sign*3.25,.85,-.6,.85,.62,1.4);}if(p.id==='tides')for(const dx of[-.6,0,.6])shape(capGeo,brass,dx,6.92,0,.11,1.2,.11);}
 if(['poe','lightning'].includes(p.id)){for(const sign of[-1,1])shape(capGeo,black,sign*2.85,6.14,0,.59,2.4,.6);shape(capGeo,metal,0,6.61,-.1,.16,1.5,.2);}
 if(p.id==='skyline'){for(let n=0;n<5;n++){const h=1.2+(n%3)*.45;shape(boxGeo,stone,(n-2)*.45,6.1+h*.25,-.16,.32,h,.36);shape(boxGeo,glow,(n-2)*.45,6.1+h*.25,.035,.06,h*.65,.018);}}
 if(['aeolith','universe-clash'].includes(p.id)){for(const sign of[-1,1])shape(capGeo,metal,sign*3.35,3.72,0,.42,4.15,.7,-sign*.21);}
 // Halo and trace are shader passes; no added point lights or postprocessing buffers.
 const halo=new T.Mesh(haloGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{tint:{value:color}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform vec3 tint;void main(){vec2 q=(vUv-.5)*vec2(1.,1.12);float r=length(q);float a=exp(-pow((r-.29)*13.,2.))*.095;gl_FragColor=vec4(tint,a);}`}));halo.position.set(0,3.05,-.08);gate.add(halo);
 const orbit=new T.Group();orbit.position.set(0,2.9,.13);const arcGeo=new T.TorusGeometry(2.41,.02,5,40,Math.PI*.5);for(let n=0;n<3;n++){const arc=new T.Mesh(arcGeo,glow);arc.rotation.z=n*Math.PI*2/3;orbit.add(arc);}gate.add(orbit);fx.push({halo,orbit,glyph,phase:index});
 const tracers=new T.Points(traceGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:clock,tint:{value:color},phase:{value:index}},vertexShader:`uniform float time;uniform float phase;varying float alpha;void main(){float a=position.x*6.283185+time*.13+phase;float r=2.34+position.y*.24;vec3 p=vec3(cos(a)*r,2.9+sin(a)*r,.16+sin(a*2.)*.06);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(70./-mv.z,1.,5.);alpha=.2+.65*pow(.5+.5*sin(a-time*.4),4.);}`,fragmentShader:`uniform vec3 tint;varying float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(tint,pow(max(0.,1.-d),2.)*alpha);}`}));tracers.frustumCulled=false;gate.add(tracers);
 const title=textSprite(p.title,'#eef1e4',5.15);title.position.set(0,7.6,0);gate.add(title);const category=textSprite(p.category==='Watch'?'STORY SHRINE':p.category==='Understand'?'DISCOVERY SHRINE':'ADVENTURE SHRINE','#b9d0ce',2.8);category.position.set(0,7.02,.05);gate.add(category);
 // A flat emissive pool catches each doorway's color on the floor.
 const pool=new T.Mesh(new T.CircleGeometry(3.35,48),new T.MeshBasicMaterial({color:p.color,transparent:true,opacity:.065,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.position.set(0,.535,0);gate.add(pool);
 gate.traverse(o=>{o.userData.portal=p.id;if(o instanceof T.Mesh)pickables.push(o);});
 });
 return{root,pickables,animate:(t:number,motion:boolean)=>{if(!motion)return;clock.value=t*.001;for(const f of fx){f.orbit.rotation.z=t*.00005+f.phase;f.glyph.position.y=5.77+Math.sin(t*.0006+f.phase)*.045;}},dispose:()=>{disposed=true;textures.forEach(t=>t.dispose());}};
}

import * as T from 'three';
import {kit,material} from './three-kit';

/** A bounded decorative fountain: fixed jets and 96 droplets, no fluid simulation. */
export function buildGardenFountain(parent:T.Group,_water:T.Material){
 const root=new T.Group();root.name='central-water-fountain';parent.add(root);
 const clock={value:0};
 const poolWater=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`uniform float time;varying vec3 vWorld;void main(){vec2 p=vWorld.xz;float r=length(p);float wave=sin(p.x*6.+time*1.4)*cos(p.y*7.-time*1.1);vec3 n=normalize(vec3(cos(p.x*6.+time*1.4)*.055,1.,sin(p.y*7.-time*1.1)*.055));float ripple=0.;for(int i=0;i<8;i++){float a=float(i)*.785398;float d=length(p-vec2(sin(a),cos(a))*2.78);ripple+=sin(d*24.-time*4.)*exp(-d*3.2)*.014;}n.xz+=vec2(ripple);vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(n,eye),0.),3.);float spec=pow(max(dot(reflect(-normalize(vec3(-.4,1.,.3)),n),eye),0.),100.);float caustic=pow(max(0.,sin(p.x*8.+wave)+cos(p.y*9.-time*.8))*.5,5.);vec3 col=mix(vec3(.012,.13,.15),vec3(.13,.32,.4),fresnel*.8)+vec3(.16,.42,.34)*caustic*.13+vec3(.8,.95,1.)*spec*.5;float foam=smoothstep(2.5,2.85,r)*(.018+max(0.,ripple)*.9);gl_FragColor=vec4(col+foam,.91);}`});poolWater.name='fountain-ripple-water';
 const {cyl,ball}=kit(root),stone=material(0x9fafaa,.55,.2),brass=material(0xbca16d,.3,.6);
 cyl(0,.21,0,3.45,.42,stone);cyl(0,.45,0,3.2,.09,brass);cyl(0,.48,0,3.08,.025,poolWater);
 cyl(0,1.25,0,.3,1.55,stone,.22);cyl(0,1.88,0,1.3,.18,stone,1.5);cyl(0,2.01,0,1.4,.035,poolWater);
 cyl(0,2.28,0,.17,.58,brass,.12);const finial=ball(0,2.65,0,.17,brass);finial.scale.y=1.35;
 const jet=(u:number,i:number)=>{const a=i/8*Math.PI*2,r=.33+u*2.45;return new T.Vector3(Math.sin(a)*r,2.55+Math.sin(u*Math.PI)*1.45-u*2.03,Math.cos(a)*r);};
 const jetMaterial=new T.MeshPhysicalMaterial({color:0x9bd5dc,transparent:true,opacity:.36,roughness:.15,metalness:0,clearcoat:1,depthWrite:false});
 for(let i=0;i<8;i++){const curve=new T.CatmullRomCurve3(Array.from({length:25},(_,j)=>jet(j/24,i)));const stream=new T.Mesh(new T.TubeGeometry(curve,24,.025,4,false),jetMaterial);stream.castShadow=false;root.add(stream);}
 const overflow=new T.Mesh(new T.CylinderGeometry(1.4,1.32,1.45,48,1,true),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec2 vUv;void main(){float strand=pow(.5+.5*sin(vUv.x*180.+sin(vUv.y*7.-time*2.)),5.);float rush=.5+.5*sin(vUv.y*38.+time*5.);gl_FragColor=vec4(.3,.62,.65,(.045+strand*.09)*smoothstep(0.,.2,vUv.y)+rush*.016);}`}));overflow.position.y=1.27;root.add(overflow);
 const seeds=new T.Float32BufferAttribute(Array.from({length:96},(_,i)=>[i/96,i%8,0]).flat(),3);
 const drops=new T.BufferGeometry();drops.setAttribute('position',seeds);
 root.add(new T.Points(drops,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:clock},vertexShader:`uniform float time;varying float alpha;void main(){float u=fract(position.x+time*.27);float a=position.y*.785398;float r=.33+u*2.45;vec3 p=vec3(sin(a)*r,2.55+sin(u*3.14159)*1.45-u*2.03,cos(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(48./-mv.z,1.,4.);alpha=sin(u*3.14159);}`,fragmentShader:`varying float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.67,.94,.9,max(0.,1.-d)*alpha*.8);}`})));
 const ripples:T.Mesh[]=[];for(let i=0;i<3;i++){const m=new T.Mesh(new T.RingGeometry(1,1.015,64),new T.MeshBasicMaterial({color:0xb6e9da,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=.51;root.add(m);ripples.push(m);}
 let elapsed=0,last:number|null=null;return{root,animate(t:number,motion:boolean){const dt=last===null?0:Math.max(0,Math.min(.06,(t-last)/1000));last=t;if(motion)elapsed+=dt;clock.value=elapsed;ripples.forEach((m,i)=>{const phase=(elapsed*.24+i/3)%1;m.scale.setScalar(.8+phase*2.2);(m.material as T.MeshBasicMaterial).opacity=(1-phase)*.22;});}};
}

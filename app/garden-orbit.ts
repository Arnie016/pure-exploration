import * as T from 'three';

/** Procedural 360-degree scenery: five draw calls, no textures or post-processing. */
export function buildOrbitalBackdrop(scene:T.Scene){
 const root=new T.Group();root.name='orbital-garden-backdrop';scene.add(root);const clock={value:0},daylight={value:.45},sunDirection=new T.Vector3(-.4,.7,.3).normalize();
 const sky=new T.Mesh(new T.SphereGeometry(740,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{time:clock,daylight,sunDirection:{value:sunDirection}},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 direction;uniform float time;uniform float daylight;uniform vec3 sunDirection;
 float cloud(vec3 p){return sin(p.x*3.+sin(p.y*5.))*sin(p.y*4.+cos(p.z*3.))*.5+.5;}
 float galaxy(vec3 d,vec3 center,float turn){
  vec3 right=normalize(cross(center,vec3(0.,1.,0.))),up=cross(right,center);
  vec2 q=vec2(dot(d,right),dot(d,up)*2.4);float r=length(q),a=atan(q.y,q.x)+r*19.+turn;
  float arms=pow(.5+.5*cos(a*2.),7.)*exp(-r*17.);float nucleus=exp(-r*r*950.);
  return max(dot(d,center),0.)*(arms*.3+nucleus*.48)*(1.-smoothstep(.1,.3,r));
 }
 void main(){vec3 d=normalize(direction);float night=1.-daylight;
  float band=exp(-pow((d.y*.7+d.x*.35-.27)*3.3,2.));
  float dust=cloud(d*4.+vec3(time*.002,0.,0.))*cloud(d*9.);
  float veil=cloud(d*7.-vec3(0.,time*.001,0.));
  float halo=pow(max(0.,dot(d,normalize(vec3(-.5,.4,-.8)))),18.);
  vec3 nightSky=vec3(.004,.007,.021)+band*dust*vec3(.082,.037,.13)+halo*vec3(.038,.065,.09)+veil*band*vec3(.014,.034,.04);
  float horizon=pow(1.-abs(d.y),5.);float warmth=pow(max(dot(d,sunDirection),0.),8.);
  vec3 daySky=mix(vec3(.016,.042,.075),vec3(.072,.135,.165),max(0.,d.y)) + horizon*vec3(.07,.038,.019)+warmth*vec3(.17,.077,.025);
  vec3 col=mix(nightSky,daySky,daylight*.85);
  float galaxies=galaxy(d,normalize(vec3(.64,.46,-.7)),.8)+galaxy(d,normalize(vec3(-.58,.28,.78)),-.7);
  col+=galaxies*vec3(.46,.36,.31)*(.4+night*.6);
  gl_FragColor=vec4(col,1.);}`}));sky.renderOrder=-20;root.add(sky);
 let seed=194;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const positions:number[]=[],colors:number[]=[];
 for(let i=0;i<1500;i++){const y=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-y*y),brightness=.45+rand()*.55;positions.push(Math.cos(a)*r*670,y*670,Math.sin(a)*r*670);colors.push(brightness*(i%3===0?.77:1),brightness*(i%3===1?.83:1),brightness);}
 const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));starGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const stars=new T.Points(starGeo,new T.PointsMaterial({vertexColors:true,size:.9,sizeAttenuation:true,transparent:true,opacity:.88,depthWrite:false,fog:false}));stars.renderOrder=-19;root.add(stars);
 const planet=new T.Mesh(new T.SphereGeometry(125,64,32),new T.ShaderMaterial({fog:false,uniforms:{time:clock},vertexShader:`varying vec3 vNormal;varying vec3 vLocal;void main(){vNormal=normalize(normalMatrix*normal);vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vNormal;varying vec3 vLocal;uniform float time;void main(){vec3 p=normalize(vLocal);float bands=sin(p.y*26.+sin(p.x*8.+p.z*11.)*.9);float cloud=sin(p.x*19.+sin(p.z*15.))*sin(p.y*31.+p.z*9.);vec3 surface=mix(vec3(.035,.082,.14),vec3(.24,.34,.39),smoothstep(-.3,.7,bands+cloud*.3));float sunlight=max(0.,dot(normalize(vNormal),normalize(vec3(-.7,.35,1.))));float rim=pow(1.-max(0.,vNormal.z),3.);gl_FragColor=vec4(surface*(.035+sunlight*.92)+rim*vec3(.026,.064,.09),1.);}`}));planet.position.set(-185,115,-450);planet.rotation.z=.2;root.add(planet);
 const air=new T.Mesh(new T.SphereGeometry(129,48,24),new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,fog:false,blending:T.AdditiveBlending,vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 eye;void main(){float glow=pow(1.-abs(dot(normalize(n),normalize(eye))),3.);gl_FragColor=vec4(.16,.4,.57,glow*.4);}`}));air.position.copy(planet.position);root.add(air);
 const orbitPoints:T.Vector3[]=[];for(let i=0;i<=160;i++){const a=i/160*Math.PI*2;orbitPoints.push(new T.Vector3(Math.cos(a)*190,Math.sin(a)*35,Math.sin(a)*170));}const orbit=new T.LineLoop(new T.BufferGeometry().setFromPoints(orbitPoints),new T.LineBasicMaterial({color:0x91b7be,transparent:true,opacity:.13,depthWrite:false,fog:false}));orbit.position.copy(planet.position);orbit.rotation.z=.26;root.add(orbit);
 let elapsed=0,last:number|null=null;return{root,sunDirection,get daylight(){return daylight.value;},animate(t:number,motion:boolean,camera:T.Camera){const dt=last===null?0:Math.min(.06,Math.max(0,(t-last)/1000));last=t;if(motion)elapsed+=dt;clock.value=elapsed;
  // One eight-minute cycle drives the sky, scene lights and water. Motion off freezes it.
  const angle=(elapsed/480+.43)*Math.PI*2,altitude=Math.sin(angle);daylight.value=T.MathUtils.smoothstep(altitude,-.2,.8);
  sunDirection.set(Math.cos(angle)*.8,Math.max(.28,altitude*.85),Math.sin(angle*.6)*.5).normalize();
  (stars.material as T.PointsMaterial).opacity=.9-daylight.value*.7;
  sky.position.copy(camera.position);stars.position.copy(camera.position);stars.rotation.y=elapsed*.00035;planet.rotation.y=elapsed*.003;
 }};
}

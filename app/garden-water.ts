import * as T from 'three';

/** Art-directed surface, falling sheets and impact foam. No fluid solver or buoyancy. */
export function gardenWater(clock:{value:number}){
 const surface=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},
  vertexShader:`uniform float time;varying vec3 vWorld;void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.);w.y+=sin(w.x*.47+time*.62)*sin(w.z*.38-time*.41)*.035;vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform float time;varying vec3 vWorld;
   void main(){vec2 p=vWorld.xz;float a=p.x*.47+time*.62,b=p.y*.38-time*.41;
    vec3 n=normalize(vec3(-.14*cos(a)*sin(b),1.,-.12*sin(a)*cos(b)));
    n.x+=sin(p.y*2.3-time*.82)*.025;n.z+=cos(p.x*1.8+time*.71)*.025;n=normalize(n);
    vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(n,eye),0.),3.);
    float spec=pow(max(dot(reflect(-normalize(vec3(-.4,1.,.3)),n),eye),0.),80.);
    float caustic=pow(.5+.5*sin(p.x*.91+sin(p.y*.72-time*.3)+time*.2)*sin(p.y*1.24-time*.48),13.);
    vec3 deep=vec3(.018,.095,.105),sky=vec3(.13,.26,.29);
    vec3 color=mix(deep,sky,.18+fresnel*.7)+vec3(.15,.36,.28)*caustic*.38+vec3(.65,.87,.77)*spec*.7;
    gl_FragColor=vec4(color,.93);
   }`});
 const curtain=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},
  vertexShader:`uniform float time;varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec3 p=position;float fall=1.-uv.y;p.z+=sin(uv.x*23.+time*2.1+uv.y*7.)*.08*fall;p.x+=sin(time*1.4+uv.y*9.)*.035*fall;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform float time;varying vec2 vUv;varying vec3 vWorld;
   void main(){float down=1.-vUv.y;float phase=sqrt(down+.05)*10.-time*3.4+vWorld.x*.071;
    float strands=pow(.5+.5*sin(vUv.x*116.+sin(down*19.-time*1.7)*.55),3.);
    float rush=pow(.5+.5*sin(phase*7.+vUv.x*23.),6.);
    float veil=.5+.5*sin(vUv.x*39.+phase*1.6);
    float edges=smoothstep(0.,.055,vUv.x)*(1.-smoothstep(.945,1.,vUv.x));
    float crest=1.-smoothstep(.0,.12,down);float impact=smoothstep(.72,1.,down);
    vec3 color=mix(vec3(.08,.29,.32),vec3(.58,.83,.78),.18+strands*.45+rush*.23+crest*.2);
    gl_FragColor=vec4(color,edges*(.38+strands*.23+veil*.1+impact*.11));
   }`});
 const impact=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float time;varying vec2 vUv;
   void main(){vec2 p=(vUv-.5)*2.;float r=length(p),angle=atan(p.y,p.x);float noise=sin(angle*13.+r*31.-time*2.2)*sin(angle*7.-r*19.+time*1.7);
    float core=(1.-smoothstep(.04,.42,r))*(.42+noise*.18);
    float rings=0.;for(int i=0;i<3;i++){float age=fract(time*.19+float(i)/3.);float front=.13+age*.77;float width=.012+age*.018;
     rings+=exp(-pow((r-front+noise*.008)/width,2.))*sin(age*3.14159)*.38;}
    float edge=1.-smoothstep(.82,1.,r);float foam=max(core+rings,0.)*edge;
    gl_FragColor=vec4(.53,.81,.73,foam*.66);
   }`});
 surface.name='garden-water-surface';curtain.name='garden-water-curtain';impact.name='garden-water-impact';
 return{surface,curtain,impact};
}

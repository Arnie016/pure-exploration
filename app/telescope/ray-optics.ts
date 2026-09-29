import type {LabState} from '../optics';
export type RaySettings={source:'star'|'near'|'offaxis';spectrum:'white'|'blue'|'green'|'red';lens:'ideal'|'singlet'|'achromat';distance:number;angle:number;dispersion:number;detector:number};
export const initialRays:RaySettings={source:'star',spectrum:'white',lens:'singlet',distance:3,angle:2,dispersion:1,detector:0};
export const wavelengths={blue:486.1,green:550,red:656.3} as const;
export const rayColors:Record<number,string>={486.1:'#76acff',550:'#93edb3',656.3:'#ff8a84'};
/** Reference indices and dispersion coefficients are illustrative glass prescriptions.
 * Two-term Cauchy form; wavelength is in micrometres. No commercial glass is implied. */
export function glassIndex(nm:number,kind:'crown'|'flint',strength=1){const l=nm/1000,ref=.55,b=kind==='crown'?.0042:.01,c=kind==='crown'?.000012:.00018;return(kind==='crown'?1.52:1.62)+strength*(b*(1/l**2-1/ref**2)+c*(1/l**4-1/ref**4));}
export function spectralFocal(focal:number,nm:number,lens:RaySettings['lens'],dispersion:number){
 if(lens==='ideal'||dispersion===0)return focal;
 if(lens==='singlet')return focal*.52/(glassIndex(nm,'crown',dispersion)-1);
 const cb=glassIndex(486.1,'crown',dispersion)-glassIndex(656.3,'crown',dispersion),fb=glassIndex(486.1,'flint',dispersion)-glassIndex(656.3,'flint',dispersion);
 const determinant=.52*fb-.62*cb,kc=fb/(focal*determinant),kf=-cb/(focal*determinant);
 return 1/(kc*(glassIndex(nm,'crown',dispersion)-1)+kf*(glassIndex(nm,'flint',dispersion)-1));
}
export function conjugateDistance(focal:number,objectDistance:number){return Number.isFinite(objectDistance)?focal*objectDistance/(objectDistance-focal):focal;}
type V=[number,number,number];
const normal=(v:V):V=>{const l=Math.hypot(...v);return v.map(x=>x/l) as V;};
export type BenchRay={nm:number;hit:V;incoming:V;outgoing:V;spot:[number,number];meridional:boolean};
export function primaryRay(s:Pick<LabState,'scope'|'focal'|'aperture'|'mirror'>,settings:RaySettings,y:number,z:number,nm:number,plane:number):BenchRay{
 const r2=y*y+z*z,mirror=s.scope==='reflector',R=2*s.focal;
 const x=mirror?(s.mirror==='spherical'?-R+Math.sqrt(R*R-r2):-r2/(4*s.focal)):0;
 const angle=settings.source==='offaxis'?settings.angle*Math.PI/180:0,O=settings.source==='near'?s.focal*settings.distance:Infinity;
 const incoming=normal(Number.isFinite(O)?[x+O,y,z]:[1,Math.tan(angle),0]);let outgoing:V;
 if(mirror){const n=normal(s.mirror==='spherical'?[Math.sqrt(R*R-r2),y,z]:[1,y/(2*s.focal),z/(2*s.focal)]),dot=incoming.reduce((a,v,i)=>a+v*n[i],0);outgoing=incoming.map((v,i)=>v-2*dot*n[i]) as V;}
 else{const f=spectralFocal(s.focal,nm,settings.lens,settings.dispersion);outgoing=normal([1,incoming[1]/incoming[0]-y/f,incoming[2]/incoming[0]-z/f]);}
 const t=((mirror?-plane:plane)-x)/outgoing[0];
 return{nm,hit:[x,y,z],incoming,outgoing,spot:[y+outgoing[1]*t,z+outgoing[2]*t],meridional:Math.abs(z)<1e-7};
}
export function rayExperiment(s:Pick<LabState,'scope'|'focal'|'aperture'|'mirror'>,settings:RaySettings){
 const objectDistance=settings.source==='near'?settings.distance*s.focal:Infinity,image=conjugateDistance(s.focal,objectDistance),plane=image+settings.detector;
 const colors=settings.spectrum==='white'?Object.values(wavelengths):[wavelengths[settings.spectrum]],rays:BenchRay[]=[];
 for(const nm of colors){rays.push(primaryRay(s,settings,0,0,nm,plane));for(const radius of[.25,.5,.75,1])for(let a=0;a<16;a++){const angle=a*Math.PI/8;rays.push(primaryRay(s,settings,Math.cos(angle)*s.aperture*.5*radius,Math.sin(angle)*s.aperture*.5*radius,nm,plane));}}
 const centroid=rays.reduce((a,r)=>[a[0]+r.spot[0]/rays.length,a[1]+r.spot[1]/rays.length],[0,0]);
 const radius=Math.max(...rays.map(r=>Math.hypot(r.spot[0]-centroid[0],r.spot[1]-centroid[1]))),rms=Math.sqrt(rays.reduce((a,r)=>a+(r.spot[0]-centroid[0])**2+(r.spot[1]-centroid[1])**2,0)/rays.length);
 const colorFocus=Object.values(wavelengths).map(nm=>({nm,focal:s.scope==='reflector'?s.focal:spectralFocal(s.focal,nm,settings.lens,settings.dispersion)}));
 return{rays,centroid,radius,rms,image,plane,objectDistance,colorFocus,colorSpread:Math.max(...colorFocus.map(f=>f.focal))-Math.min(...colorFocus.map(f=>f.focal)),airy:1.22*.00055*s.focal/s.aperture};
}
/** Pausing holds phase exactly; resume adds only the next frame's duration. */
export function advanceRayTime(time:number,dt:number,playing:boolean,reduced=false){return time+(playing&&!reduced?Math.max(0,Math.min(dt,.1)):0);}

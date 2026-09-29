/** SI constants. Radius and static-clock readouts use a non-rotating, uncharged black hole. */
const G=6.67430e-11,C=299792458,SOLAR_MASS=1.98847e30;
export function blackHole(massSolar:number,observerRadius=4){
 const mass=Math.max(1,Math.min(1e10,Number.isFinite(massSolar)?massSolar:10));
 const horizon=2*G*mass*SOLAR_MASS/(C*C),r=Math.max(1.001,Number.isFinite(observerRadius)?observerRadius:4);
 return {mass,horizonKm:horizon/1000,photonSphereKm:1.5*horizon/1000,shadowRadiusKm:Math.sqrt(27)/2*horizon/1000,
  crossingSeconds:horizon/C,staticClockRate:Math.sqrt(1-1/r),iscoKm:3*horizon/1000};
}
export const presets=[{name:'Stellar remnant',mass:10},{name:'Galactic centre scale',mass:4.3e6},{name:'Giant galaxy scale',mass:6.5e9}];
export function formatDistance(km:number){return km>=1e9?`${(km/1e9).toFixed(2)} billion km`:km>=1e6?`${(km/1e6).toFixed(2)} million km`:km>=1000?`${Math.round(km).toLocaleString('en-US')} km`:`${km.toFixed(1)} km`;}
export type PhotonPath={points:[number,number][];captured:boolean};
/** A planar null-ray trajectory in Schwarzschild coordinates, numerically integrated.
 * Cartesian acceleration -3/2 L² r/|r|⁵, with the event horizon at r=1.
 * Finite starting distance and integration error make this an educational plot.
 */
export function photonPath(impact:number,lensing=true):PhotonPath{
 let x=-18,y=Math.max(.1,Math.min(8,impact)),vx=1,vy=0;const angular=x*vy-y*vx,L2=angular*angular,points:[number,number][]=[[x,y]];
 for(let i=0;i<1800;i++){
  const r=Math.hypot(x,y);if(r<1.01)return{points,captured:true};if(r>23&&i>40)break;
  const h=Math.max(.008,Math.min(.25,r*.03)),k=lensing?-1.5*L2/r**5:0,ax=k*x,ay=k*y;
  const nx=x+vx*h+.5*ax*h*h,ny=y+vy*h+.5*ay*h*h,nr=Math.hypot(nx,ny),nk=lensing?-1.5*L2/nr**5:0;
  vx+=(ax+nk*nx)*h*.5;vy+=(ay+nk*ny)*h*.5;x=nx;y=ny;if(i%3===0)points.push([x,y]);
 }
 return{points,captured:false};
}

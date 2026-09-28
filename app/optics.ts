export type LabState = {
 scope: 'refractor' | 'reflector'; target: 'saturn' | 'moon' | 'binary' | 'jupiter' | 'mars' | 'venus';
 aperture: number; focal: number; eyepiece: number; focus: number; seeing: number;
 coating: 'ideal' | 'standard' | 'enhanced'; mirror: 'parabolic' | 'spherical';
 cutaway: boolean; rays: boolean; motion: boolean;
};
export const initial: LabState = {scope:'refractor',target:'saturn',aperture:100,focal:800,eyepiece:12,focus:.7,seeing:1,coating:'ideal',mirror:'parabolic',cutaway:true,rays:true,motion:true};
export const targetNotes: Record<LabState['target'], {name:string;crop:number;detail:string}> = {
 saturn:{name:'Saturn',crop:32,detail:'Rings and cloud belts · 18″ disc / 42″ rings'},
 moon:{name:'The Moon',crop:1,detail:'Craters and a curved terminator · 0.5° disc'},
 binary:{name:'Double star',crop:128,detail:'Warm and cool stars · 2.5″ separation'},
 jupiter:{name:'Jupiter',crop:16,detail:'Cloud bands, a storm and four moons · 40″ disc'},
 mars:{name:'Mars',crop:48,detail:'Rust-colored deserts and a polar cap · 14″ disc'},
 venus:{name:'Venus',crop:24,detail:'Sunlit crescent · 30″ disc, 30% illuminated'}
};
/** Named teaching assumptions, not measured performance of a commercial coating. */
export function coatingPreset(s: Pick<LabState,'scope'|'coating'>) {
 if(s.coating==='ideal') return {name:'Lossless reference',perSurface:1,surfaces:s.scope==='reflector'?2:4,description:'Ideal reference; no coating losses.'};
 if(s.scope==='reflector')return s.coating==='enhanced'
  ?{name:'Enhanced aluminum',perSurface:.95,surfaces:2,description:'Teaching assumption: 95% per reflection, two mirrors.'}
  :{name:'Protected aluminum',perSurface:.85,surfaces:2,description:'Teaching assumption: 85% per reflection, two mirrors.'};
 return s.coating==='enhanced'
  ?{name:'Antireflection glass',perSurface:.995,surfaces:4,description:'Teaching assumption: 99.5% per surface, four air–glass surfaces.'}
  :{name:'Uncoated glass',perSurface:.96,surfaces:4,description:'Teaching assumption: 96% per surface, four air–glass surfaces.'};
}
/** Exact on-axis intercept for a spherical mirror, measured from its vertex. mm. */
export function sphericalRayFocus(focal:number,rayHeight:number) {
 const radius=2*focal, height=Math.min(Math.abs(rayHeight),radius*.99);
 return radius*(1-1/(2*Math.sqrt(1-(height/radius)**2)));
}
export function optics(s:LabState){
 const magnification=s.focal/s.eyepiece,resolution=1.22*550e-9/(s.aperture/1000)*206265;
 const coating=coatingPreset(s),transmission=coating.perSurface**coating.surfaces;
 const sphericalShift=s.scope==='reflector'&&s.mirror==='spherical'?s.focal-sphericalRayFocus(s.focal,s.aperture/2):0;
 // A ray-envelope diameter at the paraxial plane. This is not a wave-optics PSF.
 const aberrationDisc=sphericalShift*s.aperture/s.focal;
 return {magnification,resolution,exitPupil:s.aperture/magnification,fRatio:s.focal/s.aperture,field:52/magnification,
  lightGain:(s.aperture/7)**2*(s.scope==='reflector'?.91:1)*transmission,transmission,coating,sphericalShift,aberrationDisc,
  defocusDisc:Math.abs(s.focus)*s.aperture/s.focal,effectiveResolution:Math.max(resolution,s.seeing),overMagnified:magnification>2*s.aperture};
}
export function parseState(search:string):LabState{
 const p=new URLSearchParams(search),s={...initial};
 const ranges={aperture:[60,250],focal:[400,1600],eyepiece:[4,40],focus:[-3,3],seeing:[0,4]} as const;
 for(const [k,[min,max]]of Object.entries(ranges)){const raw=p.get(k);if(raw!==null&&raw.trim()!==''){const v=Number(raw);if(Number.isFinite(v))(s as unknown as Record<string,number>)[k]=Math.max(min,Math.min(max,v));}}
 if(p.get('scope')==='reflector')s.scope='reflector';
 const target=p.get('target');if(target&&Object.hasOwn(targetNotes,target))s.target=target as LabState['target'];
 if(p.get('coating')==='standard'||p.get('coating')==='enhanced')s.coating=p.get('coating') as LabState['coating'];
 if(p.get('mirror')==='spherical')s.mirror='spherical';
 return s;
}
export function stateQuery(s:LabState){const p=new URLSearchParams();for(const k of ['scope','target','aperture','focal','eyepiece','focus','seeing','coating','mirror'] as const)p.set(k,String(s[k]));return p.toString();}

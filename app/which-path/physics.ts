/**
 * Ideal far-field double slit with equal rectangular apertures.
 * Photons are sampled from this probability density, not traced along paths.
 * Slit and detector dimensions are physical; the 3D apparatus is not to scale.
 */
export type InterferenceSettings = {
  wavelengthNm:number;
  slitSpacingUm:number;
  slitWidthUm:number;
  distanceM:number;
  distinguishability:number;
};
export const DEFAULT_EXPERIMENT:InterferenceSettings={
  wavelengthNm:550,slitSpacingUm:140,slitWidthUm:18,distanceM:1.5,distinguishability:0
};
export const DETECTOR_HALF_MM=40;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const visibility=(distinguishability:number)=>Math.sqrt(Math.max(0,1-clamp(distinguishability,0,1)**2));
export function fringeSpacingMm(settings:InterferenceSettings){
  return settings.wavelengthNm*1e-9*settings.distanceM/(settings.slitSpacingUm*1e-6)*1000;
}
export function envelopeZeroMm(settings:InterferenceSettings){
  return settings.wavelengthNm*1e-9*settings.distanceM/(settings.slitWidthUm*1e-6)*1000;
}
function sinc(x:number){return Math.abs(x)<1e-9?1:Math.sin(x)/x;}
export function intensityAt(yMm:number,settings:InterferenceSettings){
  if(!Number.isFinite(yMm))return 0;
  const lambda=settings.wavelengthNm*1e-9;
  const a=settings.slitWidthUm*1e-6;
  const d=settings.slitSpacingUm*1e-6;
  const L=settings.distanceM;
  if(lambda<=0||a<=0||d<=0||L<=0)return 0;
  const sinTheta=Math.sin(Math.atan((yMm*1e-3)/L));
  const envelope=sinc(Math.PI*a*sinTheta/lambda)**2;
  const phase=2*Math.PI*d*sinTheta/lambda;
  return Math.max(0,envelope*(1+visibility(settings.distinguishability)*Math.cos(phase))/2);
}
export function makeSampler(settings:InterferenceSettings,seed=2026,bins=512){
  if(!Number.isInteger(bins)||bins<16||bins>4096)throw new RangeError('Invalid detector resolution');
  let state=seed>>>0||1;
  const random=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
  const cumulative=new Float64Array(bins);
  let total=0;
  for(let i=0;i<bins;i++){
    const y=-DETECTOR_HALF_MM+(i+.5)*2*DETECTOR_HALF_MM/bins;
    total+=intensityAt(y,settings);
    cumulative[i]=total;
  }
  if(total<=0)throw new RangeError('Experiment has no detectable intensity');
  for(let i=0;i<bins;i++)cumulative[i]/=total;
  cumulative[bins-1]=1;
  return {
    sample(){
      const threshold=random();
      let left=0,right=bins-1;
      while(left<right){
        const middle=(left+right)>>>1;
        if(cumulative[middle]<threshold)left=middle+1;else right=middle;
      }
      return -DETECTOR_HALF_MM+(left+random())*2*DETECTOR_HALF_MM/bins;
    },
    probability(yMm:number){return intensityAt(yMm,settings);},
    cumulative
  };
}
export function detectorHistogram(hits:readonly number[],bins=80){
  const counts=new Uint32Array(bins);
  for(const y of hits){
    if(!Number.isFinite(y)||y<-DETECTOR_HALF_MM||y>DETECTOR_HALF_MM)continue;
    const index=Math.min(bins-1,Math.floor((y+DETECTOR_HALF_MM)*bins/(2*DETECTOR_HALF_MM)));
    counts[index]++;
  }
  return counts;
}

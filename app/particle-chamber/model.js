/**
 * Original educational solenoidal detector model. This is NOT a detector reconstruction,
 * a Monte Carlo event generator or a CERN simulation. Distances are metres, momenta GeV/c,
 * energies GeV and the constant 0.299792458 converts qB to transverse curvature.
 * Idealized stable particles start in exact, opposite 3-momentum directions. No matter,
 * decay, showers, magnetic fringe fields or detector measurement uncertainty are modeled.
 * See docs/collision-chamber.md for physics and limitations.
 */
export const species = {
  "electron": {
    "name": "Electron / positron",
    "massGeV": 0.00051099895,
    "short": "e⁻ / e⁺",
    "description": "Light charged leptons. Curvature is easy to see at modest momentum."
  },
  "muon": {
    "name": "Muon / antimuon",
    "massGeV": 0.1056583755,
    "short": "μ⁻ / μ⁺",
    "description": "Heavier leptons. The pair-production threshold is 0.211 GeV."
  },
  "pion": {
    "name": "Charged pion pair",
    "massGeV": 0.13957039,
    "short": "π⁻ / π⁺",
    "description": "Charged mesons. Real pions can decay or interact, which this model does not simulate."
  },
  "proton": {
    "name": "Proton / antiproton",
    "massGeV": 0.93827208816,
    "short": "p / p̄",
    "description": "Heavy baryons. Pair production needs at least 1.877 GeV of centre-of-mass energy."
  }
};
export const detectorRadii = [0.55,1.45,3.1];
export const MAGNETIC_CONVERSION = 0.299792458;

export function clamp(value,min,max,fallback){return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}

export function makeTrack(momentumGeV,fieldTesla,elevationDeg,azimuthRad,charge){
 const elevation=elevationDeg*Math.PI/180;
 const pT=momentumGeV*Math.cos(elevation),pZ=momentumGeV*Math.sin(elevation);
 const k=charge*MAGNETIC_CONVERSION*fieldTesla/Math.max(pT,1e-12);
 const radiusM=1/Math.abs(k);
 const ds=Math.min(0.045,Math.max(0.0005,radiusM*0.08));
 const maxS=Math.min(15,Math.PI*3.4*radiusM);
 const points=[{x:0,y:0,z:0,s:0}],hits=[],seen=new Set();
 for(let i=1;i<=450;i++){
  const s=Math.min(i*ds,maxS),bend=azimuthRad+k*s;
  const point={x:(Math.sin(bend)-Math.sin(azimuthRad))/k,y:(Math.cos(azimuthRad)-Math.cos(bend))/k,z:s*pZ/Math.max(pT,1e-12),s};
  const previous=points[points.length-1];
  const before=Math.hypot(previous.x,previous.y),after=Math.hypot(point.x,point.y);
  for(const layer of detectorRadii){if(!seen.has(layer)&&before<layer&&after>=layer){
   const fraction=(layer-before)/Math.max(after-before,1e-12);
   const hit={layer,x:previous.x+(point.x-previous.x)*fraction,y:previous.y+(point.y-previous.y)*fraction,z:previous.z+(point.z-previous.z)*fraction,s:previous.s+(point.s-previous.s)*fraction};
   if(Math.abs(hit.z)<=2.35){hits.push(hit);seen.add(layer);}
  }}
  points.push(point);
  if(after>=3.65||Math.abs(point.z)>=2.35||s>=maxS-1e-9)break;
 }
 return {charge,pTGeV:pT,pZGeV:pZ,radiusM,points,hits};
}

/**\n * @param {{species?:'electron'|'muon'|'pion'|'proton',sqrtS?:number,fieldTesla?:number,elevationDeg?:number,seed?:number}} [input]\n */\nexport function collision(input={}){
 const kind=Object.prototype.hasOwnProperty.call(species,input.species)?input.species:"muon";
 const particle=species[kind],sqrtS=clamp(Number(input.sqrtS),0,12,3);
 const fieldTesla=clamp(Number(input.fieldTesla),0.25,4,1.6);
 const elevationDeg=clamp(Number(input.elevationDeg),0,65,18);
 const seed=Math.floor(clamp(Number(input.seed),0,1000000,0));
 const thresholdGeV=2*particle.massGeV,available=sqrtS>thresholdGeV+1e-9;
 const energyEachGeV=sqrtS/2,momentumGeV=available?Math.sqrt(Math.max(0,energyEachGeV*energyEachGeV-particle.massGeV*particle.massGeV)):0;
 const azimuth=seed*2.399963229728653, tracks=[];
 if(available){
  const a=makeTrack(momentumGeV,fieldTesla,elevationDeg,azimuth,1);
  const b=makeTrack(momentumGeV,fieldTesla,-elevationDeg,azimuth+Math.PI,-1);
  tracks.push({...a,id:"positive",name:kind==="proton"?"p":particle.short.split(" / ")[1]||"+ charge",color:"#efbb86"}, {...b,id:"negative",name:kind==="proton"?"p̄":particle.short.split(" / ")[0]||"− charge",color:"#69dfd2"});
 }
 return {kind,particle,sqrtS,fieldTesla,elevationDeg,seed,thresholdGeV,available,energyEachGeV,momentumGeV,transverseMomentumGeV:momentumGeV*Math.cos(elevationDeg*Math.PI/180),radiusM:tracks[0]?.radiusM||0,tracks,detectorRadii};
}

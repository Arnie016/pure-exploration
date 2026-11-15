import test from 'node:test';
import assert from 'node:assert/strict';
import {probabilities,pmns,sampleProbabilities} from '../app/neutrino/physics.ts';
const config={initial:1,energyGeV:2.5,baselineKm:1300,deltaDeg:214.2,antineutrino:false};
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,String(a)+' not within '+tol+' of '+String(b));
test('source flavour is certain at zero baseline',()=>{
 for(const initial of [0,1,2]){
  const p=probabilities({...config,initial,baselineKm:0});
  p.forEach((value,index)=>near(value,index===initial?1:0));
 }
});
test('all flavours conserve probability across energy and distance',()=>{
 for(const initial of [0,1,2])for(const antineutrino of [false,true])for(const energyGeV of [.4,1,2.5,8])for(const baselineKm of [0,7,295,810,1300,1600]){
  const p=probabilities({...config,initial,antineutrino,energyGeV,baselineKm});
  p.forEach(value=>assert.ok(value>=-1e-12&&value<=1+1e-12));near(p.reduce((a,b)=>a+b,0),1);
 }
});
test('vacuum oscillation depends on L/E, not either dimension alone',()=>{
 const a=probabilities({...config,energyGeV:1,baselineKm:400});
 const b=probabilities({...config,energyGeV:2.5,baselineKm:1000});
 a.forEach((value,i)=>near(value,b[i]));
});
test('CP conjugation obeys vacuum reciprocity and CP-conserving case',()=>{
 const a=probabilities({...config,initial:1,antineutrino:true});
 const b=probabilities({...config,initial:0,antineutrino:false});near(a[0],b[1]);
 const c=probabilities({...config,deltaDeg:0});
 const d=probabilities({...config,deltaDeg:0,antineutrino:true});c.forEach((value,i)=>near(value,d[i]));
});
test('PMNS mixing matrix rows are orthonormal',()=>{
 const U=pmns(117);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  let re=0,im=0;
  for(let k=0;k<3;k++){re+=U[i][k].re*U[j][k].re+U[i][k].im*U[j][k].im;im+=U[i][k].im*U[j][k].re-U[i][k].re*U[j][k].im;}
  near(re,i===j?1:0);near(im,0);
 }
});
test('sample grid has correct endpoints and finite values',()=>{
 const points=sampleProbabilities({...config},1600,120);
 assert.equal(points.length,121);near(points[0].km,0);near(points.at(-1).km,1600);
 assert.ok(points.every(p=>p.p.every(Number.isFinite)));
 const appearance=probabilities(config);assert.ok(appearance[1]<.5);
});

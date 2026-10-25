import test from 'node:test';
import assert from 'node:assert/strict';
import {collision,makeTrack,species,detectorRadii,MAGNETIC_CONVERSION} from '../app/particle-chamber/model.js';

test('ideal pair generation is deterministic and has opposite charges and 3-momentum',()=>{
 const first=collision({species:'muon',sqrtS:3,fieldTesla:1.6,elevationDeg:18,seed:7});
 assert.deepEqual(first,collision({species:'muon',sqrtS:3,fieldTesla:1.6,elevationDeg:18,seed:7}));
 assert.equal(first.tracks.length,2);
 const [a,b]=first.tracks;
 assert.equal(a.charge,1);assert.equal(b.charge,-1);
 assert.ok(Math.abs(a.pZGeV+b.pZGeV)<1e-12);
 assert.ok(Math.abs(a.pTGeV-b.pTGeV)<1e-12);
 assert.ok(Math.abs(2*first.energyEachGeV-first.sqrtS)<1e-12);
});

test('particle creation requires enough centre-of-mass energy to cover both rest masses',()=>{
 const below=collision({species:'proton',sqrtS:1.7});
 assert.equal(below.available,false);assert.equal(below.tracks.length,0);
 assert.ok(Math.abs(below.thresholdGeV-2*species.proton.massGeV)<1e-12);
 const above=collision({species:'proton',sqrtS:2.5});
 assert.equal(above.available,true);
 assert.ok(above.momentumGeV>0);
 for(const s of Object.keys(species)){
  const threshold=2*species[s].massGeV;
  assert.equal(collision({species:s,sqrtS:threshold*.95}).available,false);
  assert.equal(collision({species:s,sqrtS:Math.max(threshold*1.05,.4)}).available,true);
 }
});

test('radius is the actual Lorentz-force curvature radius from transverse momentum',()=>{
 const a=collision({species:'pion',sqrtS:1.4,fieldTesla:2,elevationDeg:35});
 const radius=a.transverseMomentumGeV/(MAGNETIC_CONVERSION*2);
 assert.ok(Math.abs(a.radiusM-radius)<1e-12);
 const stronger=collision({species:'pion',sqrtS:1.4,fieldTesla:4,elevationDeg:35});
 assert.ok(Math.abs(stronger.radiusM/radius-.5)<1e-12);
 const faster=collision({species:'pion',sqrtS:2.5,fieldTesla:2,elevationDeg:35});
 assert.ok(faster.radiusM>a.radiusM);
 const steeper=collision({species:'pion',sqrtS:1.4,fieldTesla:2,elevationDeg:60});
 assert.ok(steeper.radiusM<a.radiusM);
});

test('detector hits interpolate the first radial crossing and remain in the barrel',()=>{
 for(const kind of Object.keys(species)){
  const event=collision({species:kind,sqrtS:4,fieldTesla:1.4,elevationDeg:22});
  assert.equal(event.tracks.length,2);
  for(const track of event.tracks){
   assert.ok(track.points.length>=2&&track.points.length<=451);
   assert.ok(track.hits.length<=detectorRadii.length);
   assert.equal(new Set(track.hits.map(h=>h.layer)).size,track.hits.length);
   for(const h of track.hits){
    assert.ok(detectorRadii.includes(h.layer));
    assert.ok(Math.abs(Math.hypot(h.x,h.y)-h.layer)<.012);
    assert.ok(Math.abs(h.z)<=2.35);
    assert.ok(Number.isFinite(h.s));
   }
  }
 }
});

test('a steep exit loses outer hits, while straight-out tracks can cross three layers',()=>{
 const flat=collision({species:'muon',sqrtS:3,fieldTesla:1.6,elevationDeg:0});
 const steep=collision({species:'muon',sqrtS:3,fieldTesla:1.6,elevationDeg:65});
 assert.equal(flat.tracks[0].hits.length,3);
 assert.ok(steep.tracks[0].hits.length<flat.tracks[0].hits.length);
});

test('all sampled geometries stay finite, bounded and symmetric across seeds',()=>{
 for(let seed=0;seed<12;seed++){
  const event=collision({species:'electron',sqrtS:.5,fieldTesla:3.5,elevationDeg:44,seed});
  for(const t of event.tracks){
   assert.ok(t.points.every(p=>Object.values(p).every(Number.isFinite)));
   assert.ok(t.points.at(-1).s>0);
   assert.ok(t.points.at(-1).s<=15.05);
  }
 }
 const direct=makeTrack(.05,3.8,0,0,1);
 assert.ok(direct.radiusM>0);
 assert.ok(direct.points.length>5);
});

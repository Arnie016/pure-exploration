import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIRP_SECONDS, TOTAL_SECONDS, LIGHT_SPEED, DEFAULT_SETTINGS,
  normalizedChirp, phaseAt, instantaneousFrequency, opticalReadout,
  instrumentAt, sampleTrace
} from '../app/gravity-waves/model.js';

const close = (a,b,tol=1e-10)=>assert.ok(Math.abs(a-b) <= tol, String(a)+' differs from '+String(b));

test('chirp begins and ends silent, grows in frequency, and has a continuous merger phase',()=>{
  close(normalizedChirp(-1),0);close(normalizedChirp(0),0);close(normalizedChirp(TOTAL_SECONDS+1),0);
  close(instantaneousFrequency(0),24);close(instantaneousFrequency(CHIRP_SECONDS),160);
  assert.ok(phaseAt(CHIRP_SECONDS)>phaseAt(1));
  const left=normalizedChirp(CHIRP_SECONDS);
  const right=normalizedChirp(CHIRP_SECONDS+1e-8);
  assert.ok(Math.abs(left-right)<1e-4);
  for(let t=0;t<=TOTAL_SECONDS;t+=0.0005){
    const h=normalizedChirp(t);
    assert.ok(Number.isFinite(h)&&Math.abs(h)<=1.000001);
  }
});

test('plus polarization gives opposite arm responses and round-trip phase difference',()=>{
  const h=1e-21,L=4000,lambda=1064;
  const r=opticalReadout(h,L,lambda,1e10);
  close(r.differentialMetres,4e-18,1e-30);
  const expected=4*Math.PI*L*h/(lambda*1e-9);
  close(r.physicalPhaseRad,expected,1e-22);
  close(r.darkPortFraction,Math.sin(expected/2)**2,1e-26);
  assert.ok(r.darkPortFraction<1e-18);
  assert.ok(Math.abs(r.displayQuadrature)>r.darkPortFraction);
});

test('arm length and wavelength scale actual phase, visual gain does not',()=>{
  const a=opticalReadout(2e-21,4000,1064,1e10);
  const b=opticalReadout(2e-21,2000,1064,1e10);
  const c=opticalReadout(2e-21,4000,532,1e10);
  const d=opticalReadout(2e-21,4000,1064,1e11);
  close(a.physicalPhaseRad/b.physicalPhaseRad,2);
  close(c.physicalPhaseRad/a.physicalPhaseRad,2);
  close(d.physicalPhaseRad,a.physicalPhaseRad,1e-24);
  close(d.darkPortFraction,a.darkPortFraction,1e-23);
  assert.notEqual(d.displayQuadrature,a.displayQuadrature);
  close(opticalReadout(0,4000,1064,1e10).darkPortFraction,0);
});

test('round-trip laser flight time is from metres and the speed of light',()=>{
  const s=instrumentAt(1,{...DEFAULT_SETTINGS,armLengthM:4000});
  close(s.roundTripSeconds,8000/LIGHT_SPEED,1e-15);
  assert.ok(Math.abs(s.strain)<=DEFAULT_SETTINGS.peakStrain);
});

test('sample trace is deterministic and template match responds to signal and noise',()=>{
  const clean={...DEFAULT_SETTINGS,noiseLevel:0};
  const pure=sampleTrace(clean,240);
  assert.deepEqual(pure,sampleTrace(clean,240));
  close(pure.alignment,1,1e-12);
  assert.ok(sampleTrace({...clean,noiseLevel:0.8},240).alignment<pure.alignment);
  const silent=sampleTrace({...clean,peakStrain:0,noiseLevel:0.3},240);
  close(silent.alignment,0);
  assert.ok(silent.points.every(p=>p.ideal===0));
  assert.throws(()=>sampleTrace(clean,4),RangeError);
});

test('invalid optical settings are rejected instead of producing non-finite graphics',()=>{
  assert.throws(()=>opticalReadout(1e-21,0,1064),RangeError);
  assert.throws(()=>opticalReadout(1e-21,4000,0),RangeError);
  assert.throws(()=>opticalReadout(NaN,4000,1064),RangeError);
});

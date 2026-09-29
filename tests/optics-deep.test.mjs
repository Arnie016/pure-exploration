import test from 'node:test';import assert from 'node:assert/strict';
import {initial,optics,parseState,stateQuery,sphericalRayFocus,targetNotes} from '../app/optics.ts';
test('surface throughput multiplies each encounter, preserving lossless reference',()=>{
 const base=optics(initial),glass=optics({...initial,coating:'standard'}),ar=optics({...initial,coating:'enhanced'});
 assert.equal(base.transmission,1);assert.equal(glass.transmission,.96**4);assert.equal(ar.transmission,.995**4);
 assert.ok(ar.transmission>glass.transmission);assert.equal(glass.lightGain/base.lightGain,glass.transmission);
 const mirror=optics({...initial,scope:'reflector',coating:'standard'});assert.equal(mirror.transmission,.85**2);
 assert.equal(mirror.resolution,base.resolution);assert.equal(mirror.magnification,base.magnification);
});
test('spherical mirror marginal focus is closer and worsens with aperture at fixed focal length',()=>{
 assert.equal(sphericalRayFocus(800,0),800);assert.ok(sphericalRayFocus(800,100)<sphericalRayFocus(800,50));
 const fast=optics({...initial,scope:'reflector',mirror:'spherical',focal:400,aperture:250});
 const slow=optics({...initial,scope:'reflector',mirror:'spherical',focal:800,aperture:250});
 assert.ok(fast.sphericalShift>slow.sphericalShift);assert.ok(fast.aberrationDisc>slow.aberrationDisc);
 assert.equal(optics({...initial,mirror:'spherical'}).sphericalShift,0);
 assert.equal(optics({...initial,scope:'reflector'}).sphericalShift,0);
});
test('all targets and new surface controls round trip and reject hostile query values',()=>{
 for(const target of Object.keys(targetNotes)){const s={...initial,target,scope:'reflector',coating:'enhanced',mirror:'spherical'};assert.deepEqual(parseState(stateQuery(s)),s);}
 const bad=parseState('target=__proto__&coating=constructor&mirror=toString');assert.equal(bad.target,'saturn');assert.equal(bad.coating,'ideal');assert.equal(bad.mirror,'parabolic');
});

import {initialRays,spectralFocal,conjugateDistance,primaryRay,rayExperiment,advanceRayTime} from '../app/telescope/ray-optics.ts';
test('thin lens brings the finite source to its analytically known conjugate',()=>{
 assert.equal(conjugateDistance(600,1800),900);
 const m=rayExperiment({...initial,focal:600},{...initialRays,lens:'ideal',source:'near',distance:3});
 assert.equal(m.plane,900);assert.ok(m.rms<1e-10);
 const misplaced=rayExperiment({...initial,focal:600},{...initialRays,lens:'ideal',source:'near',distance:3,detector:20});assert.ok(misplaced.rms>.1);
});
test('a singlet separates colors; achromat brings F and C together but retains secondary spectrum',()=>{
 const blue=spectralFocal(800,486.1,'singlet',1),red=spectralFocal(800,656.3,'singlet',1);assert.ok(blue<800&&red>800);
 const f=spectralFocal(800,486.1,'achromat',1),c=spectralFocal(800,656.3,'achromat',1),green=spectralFocal(800,550,'achromat',1);assert.ok(Math.abs(f-c)<1e-9);assert.ok(Math.abs(f-green)>.01);
 const singlet=rayExperiment(initial,initialRays),achromat=rayExperiment(initial,{...initialRays,lens:'achromat'});assert.ok(achromat.rms<singlet.rms/10);assert.equal(spectralFocal(800,486.1,'singlet',0),800);
});
test('exact sphere reflections match independently derived axial ray focus',()=>{
 for(const h of[15,60,125]){const s={...initial,scope:'reflector',mirror:'spherical',focal:400},ray=primaryRay(s,initialRays,h,0,550,400),axisDistance=-(ray.hit[0]-h*ray.outgoing[0]/ray.outgoing[1]);assert.ok(Math.abs(axisDistance-sphericalRayFocus(400,h))<1e-9);assert.ok(Math.abs(Math.hypot(...ray.outgoing)-1)<1e-12);}
});
test('paraboloid has a shared on-axis focus but develops off-axis blur without color dispersion',()=>{
 const s={...initial,scope:'reflector',focal:400,aperture:250},on=rayExperiment(s,initialRays),off=rayExperiment(s,{...initialRays,source:'offaxis',angle:3});
 assert.ok(on.rms<1e-10);assert.ok(off.rms>.4);assert.equal(off.colorSpread,0);
 const sphere=rayExperiment({...s,mirror:'spherical'},initialRays);assert.ok(sphere.rms>.8);
 const stop=rayExperiment({...s,aperture:60},{...initialRays,source:'offaxis',angle:3});assert.ok(stop.rms<off.rms/5);
});
test('ray time freezes exactly during pause and resumes without accumulating background time',()=>{
 let time=advanceRayTime(1,.033,true);assert.equal(time,1.033);for(let i=0;i<300;i++)time=advanceRayTime(time,.033,false);assert.equal(time,1.033);assert.equal(advanceRayTime(time,.033,true),1.0659999999999998);assert.equal(advanceRayTime(time,30,true),1.133);assert.equal(advanceRayTime(time,.033,true,true),time);
});

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

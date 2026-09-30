import test from 'node:test';
import assert from 'node:assert/strict';
import {portalBatch,portalRecycleStep,PORTAL_SLOT_COUNT} from '../app/portal-recycling.ts';

test('eight slots cycle through large catalogs without duplicating a batch or losing worlds',()=>{
 const catalog=Array.from({length:37},(_,i)=>`world-${i}`),seen=new Set();
 for(let offset=0;offset<catalog.length*PORTAL_SLOT_COUNT;offset+=PORTAL_SLOT_COUNT){
  const batch=portalBatch(catalog,offset);assert.equal(batch.length,8);assert.equal(new Set(batch).size,8);
  batch.forEach(id=>seen.add(id));
 }
 assert.equal(seen.size,catalog.length);
 assert.deepEqual(portalBatch([],0),[]);
 assert.deepEqual(portalBatch(['one','two'],0),['one','two']);
});

test('a due rotation waits through approach, hover, focus or a gesture and resumes once safe',()=>{
 let state=portalRecycleStep(179,1,true,true);assert.equal(state.recycle,false);assert.equal(state.elapsed,180);
 state=portalRecycleStep(state.elapsed,10,true,true);assert.equal(state.recycle,false);
 state=portalRecycleStep(state.elapsed,.03,true,false);assert.equal(state.recycle,true);assert.equal(state.elapsed,0);
 assert.equal(portalRecycleStep(0,179,true,false).recycle,false);
});

test('hidden time never advances or triggers recycling, including a previously due batch',()=>{
 assert.deepEqual(portalRecycleStep(120,3600,false,false),{elapsed:120,recycle:false});
 assert.deepEqual(portalRecycleStep(180,3600,false,false),{elapsed:180,recycle:false});
 assert.equal(portalRecycleStep(180,0,true,false).recycle,true);
});

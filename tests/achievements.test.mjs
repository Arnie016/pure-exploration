import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProgress,readProgress,addProgress,mergeVisited,achievements,achievementCaption} from '../app/achievement-model.ts';
const worlds=['telescope','airport','spacetime'];
test('distinct world progress unlocks once and duplicates do not inflate it',()=>{
 let p=emptyProgress();let result=addProgress(p,{kind:'visit',worldId:'telescope'},worlds,1);p=result.progress;assert.deepEqual(result.unlocked,['first-door']);
 result=addProgress(p,{kind:'visit',worldId:'telescope'},worlds,2);assert.equal(result.progress.visit.length,1);assert.deepEqual(result.unlocked,[]);assert.equal(result.progress.awards['first-door'].at,1);
 for(const id of worlds)p=addProgress(p,{kind:'interact',worldId:id},worlds,3).progress;
 assert.equal(p.awards['curious-hands'].at,3);assert.equal(p.awards['moment-keeper'],undefined);
});
test('all-world achievement follows the eligible catalog, excludes lobby and unknown IDs',()=>{
 let p=emptyProgress();assert.equal(addProgress(p,{kind:'visit',worldId:'garden'},worlds).progress,p);
 p=mergeVisited(p,['telescope','airport','telescope','garbage'],worlds,1);assert.equal(p.awards['every-door'],undefined);
 p=addProgress(p,{kind:'visit',worldId:'spacetime'},worlds,2).progress;assert.deepEqual(p.awards['every-door'],{at:2,worlds:3});
 const expanded=achievements(p,[...worlds,'coral']);const b=expanded.find(b=>b.id==='every-door');assert.equal(b.target,4);assert.equal(b.current,3);assert.equal(b.award.worlds,3);
});
test('events cannot fabricate unrelated capture, note or feedback milestones',()=>{
 let p=emptyProgress();for(const worldId of worlds)p=addProgress(p,{kind:'visit',worldId},worlds,1).progress;
 assert.equal(p.capture.length,0);assert.equal(p.awards['field-notes'],undefined);assert.equal(p.awards['co-creator'],undefined);
 for(const kind of ['capture','note','feedback'])p=addProgress(p,{kind,worldId:'telescope'},worlds,2).progress;
 assert.equal(Object.keys(p.awards).length,5);
});
test('malformed stored data is bounded and versioned',()=>{
 assert.deepEqual(readProgress({version:2,visit:worlds},worlds),emptyProgress());
 const p=readProgress({version:1,visit:['telescope','telescope','__proto__',{},...worlds],interact:'airport',capture:null,awards:{'first-door':{at:Infinity,worlds:3},'co-creator':{at:15,worlds:3},oops:{at:1,worlds:1}}},worlds);
 assert.deepEqual(p.visit,worlds);assert.deepEqual(p.interact,[]);assert.deepEqual(p.awards,{'co-creator':{at:15,worlds:3}});
});
test('zero available worlds never unlocks complete collection',()=>{
 const p=emptyProgress();assert.equal(addProgress(p,{kind:'visit',worldId:'x'},[]).progress,p);assert.equal(achievements(p,[]).some(b=>b.award),false);
});
test('badge share caption includes maker attribution without personal identifiers',()=>{
 const text=achievementCaption({title:'Curious hands'});assert.match(text,/@itsArnz/);assert.match(text,/pure-exploration\.arnz\.chatgpt\.site/);assert.doesNotMatch(text,/visitor|client|email|token/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createPit,stepMatch,getAIInput} from '../../public/games/universe-clash/combat.mjs';
import {ROSTER,FORMS,STAGES} from '../../public/games/universe-clash/catalog.mjs';
import {pickupCandidate,aimCandidate,powerReadiness,normalizedAim,BLINK_DISTANCE} from '../../public/games/universe-clash/readability.mjs';
import {normalizePresentation,resolveViewAim} from '../../public/games/universe-clash/presentation.mjs';
import {CHAPTERS,DRAW,normalizeStory,chapterUnlocked,completeChapter} from '../../public/games/universe-clash/story.mjs';
import {createTraining,stepTraining} from '../../public/games/universe-clash/training.mjs';
import {ARCS,arcFor,sceneLines,chapterRecap,normalizeBookmark,battleCue} from '../../public/games/universe-clash/story-scenes.mjs';
const tick=(state,input={},frames=1)=>{for(let n=0;n<frames;n++)stepMatch(state,[input,{}],1/60);};
function fight(){const s=createMatch('goku','vegeta',{seed:422});s.phase='fight';s.phaseTime=0;return s;}

test('readiness reports the real missing resource, then the busy state',()=>{
 const f=fight().fighters[0];f.resolve=22;f.energy=15;
 let r=powerReadiness(f,FORMS.goku);assert.equal(r.kiMissing,5);assert.equal(r.resolveMissing,0);assert.match(r.reason,/Charge 5/);
 f.energy=25;assert.equal(powerReadiness(f,FORMS.goku).ready,true);
 f.action='hurt';assert.equal(powerReadiness(f,FORMS.goku).ready,false);assert.match(powerReadiness(f,FORMS.goku).reason,/Finish/);
 f.action='idle';f.resolve=4;assert.match(powerReadiness(f,FORMS.goku).reason,/11 more Resolve/);
});
test('charge tells a moving or airborne player how to recover',()=>{
 const f=fight().fighters[0];f.vx=2;assert.match(powerReadiness(f,FORMS.goku).charge,/Stop moving/);
 f.vx=0;f.vy=1;assert.match(powerReadiness(f,FORMS.goku).charge,/Land or hover/);
 f.vy=0;f.energy=100;assert.equal(powerReadiness(f,FORMS.goku).charge,'Ki full');
});
test('HUD transform eligibility matches an actual engine transformation',()=>{
 const s=fight(),f=s.fighters[0];f.resolve=15;f.energy=20;
 assert.equal(powerReadiness(f,FORMS.goku).ready,true);tick(s,{transform:true});assert.equal(f.action,'transform');
 tick(s,{},65);assert.equal(f.form,1);assert.ok(f.energy<2);assert.ok(s.events.some(e=>e.type==='transform'));
});
test('charging restores Ki without manufacturing Resolve',()=>{
 const s=fight(),f=s.fighters[0];f.energy=12;f.resolve=7;tick(s,{charge:true},120);
 assert.ok(f.energy>60);assert.equal(f.resolve,7);
});
test('expensive forms allow time to recharge but still revert if Ki runs out',()=>{
 const s=fight(),f=s.fighters[0];f.form=2;f.resolve=35;f.energy=30;
 tick(s,{transform:true});tick(s,{},65);assert.equal(f.form,3);
 tick(s,{charge:true},90);assert.equal(f.form,3);assert.ok(f.energy>25);
 f.energy=0;tick(s,{guard:true},45);assert.equal(f.form,2);
 assert.ok(s.events.some(e=>e.type==='revert'));
});
test('pickup prompt and simulation choose the same nearby object',()=>{
 const s=fight(),f=s.fighters[0];s.props.forEach(p=>p.x=90);
 Object.assign(s.props[0],{x:f.x+6,y:1.5,z:f.z});
 assert.equal(pickupCandidate(f,s.props)?.id,0);const before=f.energy;
 tick(s,{interact:true});assert.equal(f.heldProp,0);assert.ok(Math.abs(f.energy-(before-10))<.1);
 tick(s,{},200);assert.equal(f.heldProp,0,'tap pickup persists beyond the old two-second hold');
 tick(s,{interact:true,aimX:0,aimY:0,aimZ:1});
 assert.equal(f.heldProp,-1);const shot=s.projectiles.find(p=>p.prop);assert.ok(shot);assert.ok(shot.vz>21);assert.equal(shot.vx,0);
});
test('pause/drop never accidentally throws a held prop',()=>{
 const s=fight(),f=s.fighters[0];Object.assign(s.props[0],{x:f.x+1,y:.9,z:f.z});tick(s,{interact:true});tick(s,{});tick(s,{drop:true});
 assert.equal(f.heldProp,-1);assert.equal(s.projectiles.filter(p=>p.prop).length,0);
});
test('pickup excludes unavailable and out-of-reach objects',()=>{
 const s=fight(),f=s.fighters[0];s.props.forEach(p=>p.x=99);assert.equal(pickupCandidate(f,s.props),null);
 const p=s.props[0];Object.assign(p,{x:f.x+1,y:1,z:f.z,heldBy:1});assert.equal(pickupCandidate(f,s.props),null);
 p.heldBy=-1;p.respawn=1;assert.equal(pickupCandidate(f,s.props),null);
 p.respawn=0;f.energy=9;tick(s,{interact:true});assert.equal(f.heldProp,-1);
});
test('teleport follows view instead of movement and respects cost and cooldown',()=>{
 const s=fight(),f=s.fighters[0];const {x,z,energy}=f;
 tick(s,{vanish:true,moveX:-1,moveZ:0,aimX:0,aimY:0,aimZ:1});
 assert.ok(Math.abs(f.x-x)<.05);assert.ok(Math.abs(f.z-z-BLINK_DISTANCE)<.08);assert.ok(Math.abs(f.energy-(energy-16))<.1);
 tick(s,{});const firstZ=f.z;tick(s,{vanish:true,aimX:0,aimZ:1});assert.ok(Math.abs(f.z-firstZ)<.1);
 tick(s,{},125);tick(s,{vanish:true,aimX:0,aimY:0,aimZ:-1});assert.ok(f.z<firstZ-5.8);
});
test('teleport remains bounded at the arena edge and rejects non-finite aim',()=>{
 const s=fight(),f=s.fighters[0];f.x=13;tick(s,{vanish:true,aimX:1,aimZ:0});assert.ok(f.x<=14);
 assert.equal(normalizedAim({aimX:NaN,aimZ:1}),null);assert.equal(normalizedAim({aimX:Infinity,aimZ:0}),null);assert.equal(normalizedAim({aimX:0,aimZ:0}),null);
 const aim=normalizedAim({aimX:500,aimY:500,aimZ:500});assert.ok(Math.abs(Math.hypot(aim.x,aim.y,aim.z)-1)<1e-10);
});
test('free aim rotates the fighter and shoots away from an off-screen target',()=>{
 const s=fight(),f=s.fighters[0];tick(s,{aimX:0,aimY:0,aimZ:1,blast:true});tick(s,{aimX:0,aimY:0,aimZ:1},8);
 assert.ok(Math.abs(f.heading)<.01);const shot=s.projectiles[0];assert.ok(shot);assert.ok(shot.vz>18);assert.ok(Math.abs(shot.vx)<.01);
});
test('aim assist finds the opponent near the reticle in a crowded fight',()=>{
 const s=createPit('goku',{seed:120}),f=s.fighters[0];
 s.fighters.forEach((enemy,i)=>Object.assign(enemy,{x:i?25:0,y:0,z:i?0:0}));
 Object.assign(s.fighters[2],{x:.6,z:10});Object.assign(s.fighters[3],{x:0,z:-5});
 assert.equal(aimCandidate(f,s.fighters,{x:0,y:0,z:1})?.slot,2);
 s.fighters[2].alive=false;assert.equal(aimCandidate(f,s.fighters,{x:0,y:0,z:1}),null);
 assert.equal(aimCandidate(f,s.fighters,{x:Infinity,y:0,z:1}),null);
});
test('manual shooting respects aim-assist preference and narrow target cone',()=>{
 for(const assist of [true,false]) {
  const s=fight(),f=s.fighters[0];Object.assign(f,{x:0,z:0});Object.assign(s.fighters[1],{x:.6,z:10});
  tick(s,{blast:true,aimX:0,aimY:0,aimZ:1,aimAssist:assist});tick(s,{},8);
  const shot=s.projectiles[0];assert.ok(shot);
  if(assist) assert.ok(Math.abs(shot.vx/shot.vz-.06)<.001);
  else assert.equal(shot.vx,0);
 }
 const s=fight();Object.assign(s.fighters[0],{x:0,z:0});Object.assign(s.fighters[1],{x:2.5,z:10});
 tick(s,{blast:true,aimX:0,aimZ:1});tick(s,{},8);assert.equal(s.projectiles[0].vx,0,'an opponent 14 degrees away must not steal the shot');
});
test('shoulder-camera projectiles converge on the ground point under the reticle',()=>{
 const f={x:0,y:0,z:0},origin={x:.4,y:4,z:-6},ray={x:0,y:-.2,z:1};
 const aim=resolveViewAim(f,origin,ray),travel=(.1-1.5)/aim.y;
 assert.ok(Math.abs(aim.x*travel-.4)<1e-8);
 assert.ok(Math.abs(aim.z*travel-13.5)<1e-8);
 assert.equal(resolveViewAim(f,origin,{x:NaN,y:0,z:1}),null);
});
test('saved camera preferences reject malformed values and clamp extreme views',()=>{
 const p=normalizePresentation({quality:'__proto__',fov:999,distance:-1,sensitivity:Infinity,invertY:'true',aimAssist:false});
 assert.deepEqual(p,{quality:'balanced',fov:85,distance:6,sensitivity:1,invertY:false,aimAssist:false});
 assert.equal(normalizePresentation(null).distance,9.2);
});
test('story draw introduces every roster character exactly once',()=>{
 assert.equal(DRAW.flat().length,16);assert.equal(new Set(DRAW.flat()).size,16);
 assert.deepEqual([...new Set(DRAW.flat())].sort(),ROSTER.map(f=>f.id).sort());
 for(const c of CHAPTERS){assert.ok(ROSTER.some(f=>f.id===c.player));assert.ok(ROSTER.some(f=>f.id===c.rival));assert.ok(STAGES.some(s=>s.id===c.stage));assert.ok(c.before.length&&c.after.length);}
});
test('story unlocks only sequential completed episodes and safely normalizes storage',()=>{
 let progress=normalizeStory(null);assert.equal(chapterUnlocked(progress,0),true);assert.equal(chapterUnlocked(progress,1),false);
 assert.deepEqual(completeChapter(progress,5),progress);
 progress=completeChapter(progress,0);assert.equal(chapterUnlocked(progress,1),true);
 assert.deepEqual(completeChapter(progress,0),progress,'replays do not inflate completion');
 assert.equal(normalizeStory({completed:[CHAPTERS[4].id]}).completed.length,0);
 for(let i=1;i<CHAPTERS.length;i++)progress=completeChapter(progress,i);
 assert.equal(progress.completed.length,CHAPTERS.length);assert.equal(chapterUnlocked(progress,CHAPTERS.length),false);
});
test('directed story scenes cover the campaign and use valid speakers',()=>{
 assert.equal(ARCS.flatMap(a=>Array.from({length:a.range[1]-a.range[0]+1},(_,n)=>n+a.range[0])).length,16);
 for(let i=0;i<CHAPTERS.length;i++){
  assert.ok(arcFor(i).range[0]<=i&&arcFor(i).range[1]>=i);
  assert.ok(chapterRecap(i).length>40);
  for(const after of [false,true]){
   const lines=sceneLines(i,after);assert.equal(lines[0].speaker,'narrator');
   assert.ok(lines.length>=(after?2:5));
   for(const line of lines){assert.ok(line.speaker==='narrator'||ROSTER.some(f=>f.id===line.speaker));assert.ok(line.text.length>10);}
  }
 }
 assert.deepEqual(sceneLines(99),[]);
});
test('scene bookmarks resume valid lines but cannot unlock episodes or unearned endings',()=>{
 const empty=normalizeStory(null),one=completeChapter(empty,0);
 assert.equal(normalizeBookmark({chapter:1,line:0},empty),null);
 assert.equal(normalizeBookmark({chapter:0,after:true,line:0},empty),null);
 assert.deepEqual(normalizeBookmark({chapter:0,after:true,line:999},one),{chapter:0,after:true,line:sceneLines(0,true).length-1});
 assert.deepEqual(normalizeBookmark({chapter:1,line:2},one),{chapter:1,after:false,line:2});
 assert.equal(normalizeBookmark({chapter:'0'},one),null);
 assert.equal(normalizeBookmark(null,one),null);
 let all=one;for(let i=1;i<16;i++)all=completeChapter(all,i);
 assert.equal(normalizeBookmark({chapter:15,after:true,line:2},all).line,2,'the final epilogue survives a completed save');
});
test('battle conversations are contextual, ordered and never repeat during a fight',()=>{
 for(let i=0;i<16;i++){
  const played=new Set();assert.equal(battleCue(i,5,.9,played),null);
  const first=battleCue(i,6,.9,played);assert.equal(first.id,0);played.add(first.id);
  assert.equal(battleCue(i,10,.9,played),null);
  const second=battleCue(i,12,.5,played);assert.equal(second.id,1);played.add(second.id);
  assert.equal(battleCue(i,99,.1,played),null);
  assert.equal(battleCue(i,38,.9,new Set([0])).id,1);
 }
});
test('the new recharge, blink, prop and flight lessons complete through real input',()=>{
 const charge=createTraining('goku','charge');for(let i=0;i<220;i++)stepTraining(charge,{charge:true});assert.equal(charge.lesson.complete,true);
 const blink=createTraining('goku','blink');stepTraining(blink,{vanish:true,aimX:0,aimZ:1});assert.equal(blink.lesson.complete,true);
 const prop=createTraining('goku','prop');stepTraining(prop,{interact:true});stepTraining(prop,{});stepTraining(prop,{interact:true});assert.equal(prop.lesson.complete,true);
 const flight=createTraining('goku','flight');stepTraining(flight,{flight:true});assert.equal(flight.lesson.complete,true);
});
test('12-fighter simulation stays finite with contextual and aimed input',()=>{
 const s=createPit('goku',{seed:814});for(let i=0;i<2400;i++)stepMatch(s,s.fighters.map((_,slot)=>slot?getAIInput(s,slot,1/60):{moveX:Math.sin(i*.01),moveZ:Math.cos(i*.01),aimX:Math.cos(i*.01),aimZ:Math.sin(i*.01),blast:i%40===0,vanish:i%200===0,interact:i%310===0}),1/60);
 assert.equal(s.fighters.length,12);for(const f of s.fighters)assert.ok(Number.isFinite(f.x+f.y+f.z+f.hp+f.energy));
});

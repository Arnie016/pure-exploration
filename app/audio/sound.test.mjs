import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import ts from'typescript';
import{readSoundSettings,portalBlend,musicAllowed,moodForWorld}from'./score.ts';

test('a new or damaged sound preference always starts quiet and clamps volume',()=>{
 assert.deepEqual(readSoundSettings(null),{enabled:false,music:.45,effects:.4});
 assert.equal(readSoundSettings('{broken').enabled,false);
 assert.deepEqual(readSoundSettings('{"enabled":"true","music":99,"effects":-5}'),{enabled:false,music:1,effects:0});
 assert.deepEqual(readSoundSettings('{"enabled":true,"music":0,"effects":0.3}'),{enabled:true,music:0,effects:.3});
});
test('the portal transition grows continuously towards the shrine without amplifying',()=>{
 assert.equal(portalBlend(Infinity),0);assert.equal(portalBlend(30),0);assert.equal(portalBlend(0),1);
 let previous=0;for(let distance=30;distance>=0;distance-=.2){const next=portalBlend(distance);assert.ok(next>=previous&&next<=1);previous=next;}
});
test('ambient music never overlays embedded game routes and uses destination moods',()=>{
 assert.ok(musicAllowed('/'));assert.ok(musicAllowed('/telescope'));
 for(const path of['/world/poe','/world/tides','/airport','/leaderboard'])assert.equal(musicAllowed(path),false);
 assert.equal(moodForWorld('telescope'),'curiosity');assert.equal(moodForWorld('poe'),'mystery');assert.equal(moodForWorld('tides'),'tide');assert.equal(moodForWorld('coral-memory'),'tide');
});

// The browser graph is substituted only to exercise lifecycle and scheduling, not listening quality.
class Param{value=0;setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{gain=new Param();pan=new Param();frequency=new Param();detune=new Param();delayTime=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();handlers=[];connect(n){return n;}disconnect(){}addEventListener(_,fn){this.handlers.push(fn);}start(){FakeContext.started++;}stop(){this.onended?.();this.handlers.forEach(fn=>fn());}}
class Track{stopped=false;clone(){return new Track();}stop(){this.stopped=true;}}
class FakeContext{static count=0;static started=0;static latest;captureTrack=new Track();currentTime=0;state='suspended';destination=new Node();constructor(){FakeContext.count++;FakeContext.latest=this;}createMediaStreamDestination(){const node=new Node();node.stream={getAudioTracks:()=>[this.captureTrack],getTracks:()=>[this.captureTrack]};return node;}createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createDelay(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createOscillator(){return new Node();}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}}
const source=(await readFile(new URL('./director.ts',import.meta.url),'utf8')).replace("'./score'",JSON.stringify(new URL('./score.ts',import.meta.url).href));
const module=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const{SoundDirector,getSoundCaptureTrack}=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
test('audio requires activation, respects mute, throttles duplicate cues, and sleeps offscreen',async()=>{
 const oldWindow=globalThis.window;globalThis.window={AudioContext:FakeContext};const audio=new SoundDirector();
 try{
  audio.setRoute('/world/tides');audio.setSettings({enabled:true,music:.5,effects:.4});audio.cue('favorite');assert.equal(FakeContext.count,0);assert.equal(getSoundCaptureTrack(),null);
  assert.equal(await audio.unlock(),true);const captureTrack=getSoundCaptureTrack();assert.ok(captureTrack);assert.notEqual(captureTrack,FakeContext.latest.captureTrack);captureTrack.stop();assert.equal(FakeContext.latest.captureTrack.stopped,false,'recording owns a clone');assert.equal(FakeContext.started,0,'embedded route must schedule no melody');
  audio.cue('favorite');const first=FakeContext.started;assert.ok(first>0);audio.cue('favorite');assert.equal(FakeContext.started,first,'rapid favorites must stay quiet');
  FakeContext.latest.currentTime=1;audio.cue('favorite');assert.ok(FakeContext.started>first);
  await audio.setHidden(true);assert.equal(audio.running,false);assert.equal(getSoundCaptureTrack(),null);const paused=FakeContext.started;audio.cue('portal');assert.equal(FakeContext.started,paused);
  await audio.setHidden(false);assert.equal(audio.running,true);
  audio.setSettings({enabled:false,music:.5,effects:.4});assert.equal(audio.running,false);await audio.setHidden(false);assert.equal(audio.running,false,'visibility cannot unmute');
  audio.dispose();assert.equal(FakeContext.latest.state,'closed');assert.equal(FakeContext.latest.captureTrack.stopped,true);assert.equal(getSoundCaptureTrack(),null);assert.equal(await audio.unlock(),false);
 }finally{audio.dispose();globalThis.window=oldWindow;}
});

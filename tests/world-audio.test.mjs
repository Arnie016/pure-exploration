import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/world-audio.js',import.meta.url),'utf8');
function world(enabled=false){
 const listeners={},events={},parent={},origin='https://example.test';
 class AudioContext{state='running';resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
 class HTMLMediaElement{_muted=false;get muted(){return this._muted;}set muted(value){this._muted=!!value;}}
 const window={parent,AudioContext,addEventListener:(name,fn)=>listeners[name]=fn};
 runInNewContext(code,{window,document:{addEventListener:(name,fn)=>events[name]=fn},location:{origin},localStorage:{getItem:()=>JSON.stringify({enabled})},HTMLMediaElement});
 const message=(enabled,source=parent,messageOrigin=origin)=>listeners.message({source,origin:messageOrigin,data:{type:'pe-master-sound',enabled}});
 return{window,HTMLMediaElement,events,message};
}
test('master mute suppresses game resume and restores only audio it suspended',async()=>{
 const w=world(),ctx=new w.window.AudioContext();assert.equal(ctx.state,'suspended');await ctx.resume();assert.equal(ctx.state,'suspended');
 w.message(true);assert.equal(ctx.state,'running');w.message(false);assert.equal(ctx.state,'suspended');w.message(true);assert.equal(ctx.state,'running');
 await ctx.suspend();w.message(false);w.message(true);assert.equal(ctx.state,'suspended');await ctx.close();w.message(true);assert.equal(ctx.state,'closed');
});
test('media mute preserves player intent and rejects foreign or unrelated messages',()=>{
 const w=world(true),ctx=new w.window.AudioContext(),video=new w.HTMLMediaElement();video.muted=false;
 w.message(false,{},'https://elsewhere.test');assert.equal(ctx.state,'running');assert.equal(video.muted,false);
 w.message(false);assert.equal(ctx.state,'suspended');assert.equal(video.muted,true);
 video.muted=true;w.message(true);assert.equal(video.muted,true);
 video.muted=false;w.message(false);w.message(true);assert.equal(video.muted,false);
});

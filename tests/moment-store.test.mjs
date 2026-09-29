import test from 'node:test';import assert from 'node:assert/strict';
import {validateMoment,momentFilename,LIBRARY_LIMIT_BYTES,LIBRARY_LIMIT_ITEMS} from '../app/components/moment-store.ts';
const media=(kind,type,bytes=4)=>({kind,title:'A discovery',note:'',blob:new Blob([new Uint8Array(bytes)],{type})});
test('library accepts its explicit picture, clip, audio and plain-note formats',()=>{
 for(const [kind,type] of [['image','image/png'],['achievement','image/png'],['image','image/jpeg'],['video','video/mp4'],['video','video/webm;codecs=vp9'],['audio','audio/mpeg'],['audio','audio/wav'],['audio','audio/ogg'],['audio','audio/mp4']])assert.equal(validateMoment(media(kind,type)),null,`${kind} ${type}`);
 assert.equal(validateMoment({kind:'note',title:'A question',note:'Why does the ray bend?'}),null);
});
test('library rejects media whose kind disagrees with its MIME type',()=>{
 for(const [kind,type] of [['audio','image/png'],['image','video/mp4'],['video','audio/mpeg'],['achievement','audio/mpeg']])assert.notEqual(validateMoment(media(kind,type)),null,`${kind} ${type}`);
});
test('empty, unsupported and oversize media cannot consume library slots',()=>{
 assert.notEqual(validateMoment(media('video','video/webm',0)),null);
 assert.notEqual(validateMoment(media('image','image/svg+xml')),null);
 assert.notEqual(validateMoment(media('audio','')),null);
 assert.notEqual(validateMoment(media('video','video/webm',40*1024*1024+1)),null);
 assert.equal(LIBRARY_LIMIT_BYTES,200*1024*1024);assert.equal(LIBRARY_LIMIT_ITEMS,80);
});
test('library bounds descriptive input instead of silently truncating saved notes',()=>{
 assert.notEqual(validateMoment({kind:'note',title:' ',note:'hello'}),null);
 assert.notEqual(validateMoment({kind:'note',title:'A'.repeat(121),note:''}),null);
 assert.notEqual(validateMoment({kind:'note',title:'A note',note:'a'.repeat(2001)}),null);
});
test('download filenames retain actual recorder and image encodings',()=>{
 const base={id:'local',worldId:'telescope',title:'A discovery',created:Date.UTC(2026,8,30),note:''};
 assert.equal(momentFilename({...base,kind:'video',blob:new Blob(['x'],{type:'video/webm;codecs=vp9'})}),'telescope-video-2026-09-30.webm');
 assert.equal(momentFilename({...base,kind:'video',blob:new Blob(['x'],{type:'video/mp4'})}),'telescope-video-2026-09-30.mp4');
 assert.equal(momentFilename({...base,kind:'note'}),'telescope-note-2026-09-30.txt');
});

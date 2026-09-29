import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeText,sanitizeStore} from '../public/games/coral-memory/reef-storage.mjs';

test('coral notes render saved markup as text',()=>{
 assert.equal(escapeText('<img src=x onerror="attack()">'), '&lt;img src=x onerror=&quot;attack()&quot;&gt;');
 assert.equal(escapeText("reef & 'water'"), 'reef &amp; &#39;water&#39;');
});
test('coral storage rejects unsafe keys and invalid tags',()=>{
 const stored=sanitizeStore(JSON.parse('{"notes":{"__proto__":[{"text":"bad"}],"100":[{"text":"bad"}],"605":[{"text":"safe","by":"You"}],"9999":[{"text":"bad"}]},"tags":{"605":5,"101":9}}'));
 assert.equal(Object.getPrototypeOf(stored.notes),null);
 assert.deepEqual(Object.keys(stored.notes),['605']);
 assert.equal(stored.notes['605'][0].text,'safe');
 assert.equal(stored.tags['605'],5);assert.equal(stored.tags['101'],undefined);
});
test('coral storage bounds retained note volume and text',()=>{
 const stored=sanitizeStore({notes:{'142':Array.from({length:80},()=>({text:'a'.repeat(1500),by:'b'.repeat(100),when:'today'}))}});
 assert.equal(stored.notes['142'].length,50);
 assert.equal(stored.notes['142'][0].text.length,800);
 assert.equal(stored.notes['142'][0].by.length,50);
 assert.deepEqual(Object.keys(sanitizeStore(null).notes),[]);
});

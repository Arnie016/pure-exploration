import test from 'node:test';
import assert from 'node:assert/strict';
import {STARTER,HEADS,tokenize,embedding,attentionAt,approximateOperations} from '../app/attention/model.js';

const close=(a,b,epsilon=1e-10)=>assert.ok(Math.abs(a-b)<epsilon,'expected '+a+' near '+b);

test('token parsing has bounded complexity and predictable empty input',()=>{
 assert.deepEqual(tokenize('   a   fox \n jumps  '),['a','fox','jumps']);
 assert.deepEqual(tokenize('  '),['attention']);
 assert.equal(tokenize('1 2 3 4 5 6 7 8 9 10').length,8);
 assert.equal(tokenize('x'.repeat(90))[0].length,18);
});
test('embeddings are deterministic but include position',()=>{
 assert.deepEqual(embedding('moon',2),embedding('moon',2));
 assert.notDeepEqual(embedding('moon',0),embedding('moon',1));
 assert.notDeepEqual(embedding('moon',0),embedding('fox',0));
});
test('causal attention has exact zeros above the diagonal and every row sums to one',()=>{
 const tokens=tokenize(STARTER);
 for(let head=0;head<HEADS.length;head++)for(let i=0;i<tokens.length;i++){
  const row=attentionAt(tokens,i,head,1,true);
  close(row.weights.reduce((a,b)=>a+b,0),1);
  row.weights.forEach((weight,j)=>{assert.ok(Number.isFinite(weight));if(j>i){assert.equal(weight,0);assert.equal(row.scores[j],null);}});
 }
});
test('unmasked attention attends bidirectionally and stays normalized',()=>{
 const row=attentionAt(STARTER,0,1,1,false);
 close(row.weights.reduce((a,b)=>a+b,0),1);
 assert.ok(row.weights.slice(1).every(weight=>weight>0));
 assert.ok(row.scores.every(score=>Number.isFinite(score)));
});
test('output equals explicitly weighted V sum in each of four dimensions',()=>{
 const row=attentionAt(STARTER,3,0,.75,true);
 for(let component=0;component<4;component++){
  close(row.output[component],row.weights.reduce((sum,weight,i)=>sum+weight*row.values[i][component],0));
 }
});
test('temperature changes softmax distribution, not Q/K/V',()=>{
 const cold=attentionAt(STARTER,4,0,.2,false);
 const hot=attentionAt(STARTER,4,0,3,false);
 assert.deepEqual(cold.queries,hot.queries);
 assert.deepEqual(cold.keys,hot.keys);
 assert.deepEqual(cold.values,hot.values);
 assert.ok(Math.max(...cold.weights)>Math.max(...hot.weights));
 assert.ok(cold.entropy<hot.entropy);
});
test('different heads use different fixed projections',()=>{
 const one=attentionAt(STARTER,3,0,1,false);
 const two=attentionAt(STARTER,3,1,1,false);
 assert.notDeepEqual(one.weights,two.weights);
});
test('operation count includes quadratic attention and has bounded input',()=>{
 assert.equal(approximateOperations(1),56);
 assert.equal(approximateOperations(4),320);
 assert.equal(approximateOperations(8),896);
 assert.equal(approximateOperations(100),approximateOperations(8));
});

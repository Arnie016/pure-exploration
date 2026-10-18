/** Real browser-CPU neural-network training. The 3D GPU imagery is illustrative. */
export const WIDTHS=[2,8,8,1];
export const PARAM_COUNT=WIDTHS.slice(1).reduce((n,out,i)=>n+out*(WIDTHS[i]+1),0);
export function seededRandom(seed=2026){let s=(seed>>>0)||1;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function createNetwork(seed=2026){
 const random=seededRandom(seed);
 const layers=WIDTHS.slice(1).map((out,i)=>{const input=WIDTHS[i],bound=Math.sqrt(6/(input+out));return{input,out,weights:Float64Array.from({length:input*out},()=>(random()*2-1)*bound),biases:new Float64Array(out)};});
 return{layers,random,steps:0,history:[],last:null};
}
const sigmoid=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function forward(net,x,y){
 const activations=[[x,y]];
 for(let li=0;li<net.layers.length;li++){
  const layer=net.layers[li],old=activations[li],next=[];
  for(let o=0;o<layer.out;o++){let z=layer.biases[o];for(let j=0;j<layer.input;j++)z+=layer.weights[o*layer.input+j]*old[j];next.push(li===net.layers.length-1?sigmoid(z):Math.tanh(z));}
  activations.push(next);
 }
 return{probability:activations.at(-1)[0],activations};
}
export function sample(net){
 const quadrant=Math.floor(net.random()*4),sx=quadrant&1?1:-1,sy=quadrant&2?1:-1;
 const x=sx*(.48+net.random()*.48),y=sy*(.48+net.random()*.48);
 return{x,y,label:x*y<0?1:0};
}
export function trainBatch(net,batchSize=32,learningRate=.17){
 const count=clamp(Math.floor(batchSize),1,128),rate=clamp(learningRate,.001,1);
 const gradients=net.layers.map(l=>({weights:new Float64Array(l.weights.length),biases:new Float64Array(l.out)}));
 let loss=0,last=null;
 for(let k=0;k<count;k++){
  const observation=sample(net),{probability,activations}=forward(net,observation.x,observation.y);
  const p=clamp(probability,1e-7,1-1e-7);
  loss-=observation.label*Math.log(p)+(1-observation.label)*Math.log(1-p);
  const deltas=new Array(net.layers.length);
  deltas[deltas.length-1]=[probability-observation.label];
  for(let li=net.layers.length-2;li>=0;li--){
   const next=net.layers[li+1],values=activations[li+1];
   deltas[li]=values.map((a,n)=>{let upstream=0;for(let o=0;o<next.out;o++)upstream+=next.weights[o*next.input+n]*deltas[li+1][o];return upstream*(1-a*a);});
  }
  for(let li=0;li<net.layers.length;li++){
   const layer=net.layers[li],prev=activations[li],g=gradients[li];
   for(let o=0;o<layer.out;o++){const d=deltas[li][o];g.biases[o]+=d;for(let j=0;j<layer.input;j++)g.weights[o*layer.input+j]+=d*prev[j];}
  }
  if(k===0)last={...observation,probability,activations};
 }
 let squared=0;
 for(const g of gradients){for(const v of g.weights)squared+=(v/count)**2;for(const v of g.biases)squared+=(v/count)**2;}
 const gradientNorm=Math.sqrt(squared),scale=gradientNorm>5?5/gradientNorm:1;
 net.layers.forEach((l,i)=>{const g=gradients[i];for(let j=0;j<l.weights.length;j++)l.weights[j]-=rate*scale*g.weights[j]/count;for(let j=0;j<l.biases.length;j++)l.biases[j]-=rate*scale*g.biases[j]/count;});
 net.steps++;const entry={step:net.steps,loss:loss/count,gradientNorm};
 net.history.push(entry);if(net.history.length>400)net.history.shift();
 net.last={...last,batchSize:count};return entry;
}
export function validation(net){
 let loss=0,correct=0,count=0;
 for(const x of[-.9,-.7,-.5,.5,.7,.9])for(const y of[-.9,-.7,-.5,.5,.7,.9]){
  const truth=x*y<0?1:0,p=clamp(forward(net,x,y).probability,1e-7,1-1e-7);
  loss-=truth*Math.log(p)+(1-truth)*Math.log(1-p);
  correct+=Number((p>=.5?1:0)===truth);count++;
 }
 return{loss:loss/count,accuracy:correct/count};
}
/** Idealized float32 tensor minimum, not real GPU allocation or JS heap size. */
export function tensorEstimate(batchSize){
 const b=clamp(Math.floor(batchSize),1,128);
 return{bytes:4*(2*PARAM_COUNT+b*(WIDTHS.reduce((s,n)=>s+n,0)+WIDTHS.slice(1).reduce((s,n)=>s+n,0)+1)),ops:6*b*88,parameters:PARAM_COUNT};
}

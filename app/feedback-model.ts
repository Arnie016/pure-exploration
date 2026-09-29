export type FeelingOption={id:string;emoji:string;label:string};
export type FeedbackQuestion={prompt:string;options:FeelingOption[]};
const q=(prompt:string,items:string[][]):FeedbackQuestion=>({prompt,options:items.map(([id,emoji,label])=>({id,emoji,label}))});
export function feedbackQuestions(world:string):FeedbackQuestion[]{
 const science=['telescope','spacetime','lightning','edge-universe','particles','reef-relay','coral-memory'].includes(world);
 const first=world==='telescope'?q('What caught your eye?',[['light','🌈','Following the light'],['sky','🌌','Exploring the sky'],['controls','🔭','Trying the controls']]):world==='airport'?q('What caught your eye?',[['routes','🛤️','Robot routes'],['sensors','📡','The sensing system'],['decisions','🧠','How decisions work']]):science?q('What drew you in?',[['world','🌌','The world itself'],['experiment','🧪','Trying things out'],['explanation','💡','The explanation']]):q('What drew you in?',[['world','✨','The atmosphere'],['play','🎮','The interaction'],['story','📖','The story']]);
 const second=science?q('What did you take away?',[['question','🤔','A new question'],['understanding','💡','Something clicked'],['unclear','🧩','Still figuring it out']]):q('How did it leave you feeling?',[['curious','🤔','Curious for more'],['absorbed','🌊','Lost in the moment'],['unsure','🧩','Still finding my feet']]);
 const third=world==='telescope'?q('What would help most next?',[['experiments','🧪','More experiments'],['guidance','🧭','Clearer guidance'],['detail','🌠','More sky detail']]):world==='airport'?q('What would help most next?',[['control','🤖','More robot control'],['reasoning','🧠','Clearer reasoning'],['scenarios','🛫','More scenarios']]):q('What would help most next?',[['depth','🌱','More to explore'],['guidance','🧭','Clearer guidance'],['feel','🎯','Smoother controls']]);
 return[first,second,third];
}
export function guidedFeedbackText(world:string,answers:unknown,note:unknown):string|null{
 const qs=feedbackQuestions(world);if(!Array.isArray(answers)||answers.length!==3||answers.some((a,i)=>typeof a!=='string'||!qs[i].options.some(o=>o.id===a)))return null;
 if(typeof note!=='string'||note.length>180)return null;
 return 'Discovery reflection\n'+qs.map((question,i)=>`${question.prompt} ${question.options.find(o=>o.id===answers[i])!.label}`).join('\n')+(note.trim()?`\nA thought: ${note.trim()}`:'');
}

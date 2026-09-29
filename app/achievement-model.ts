/** Personal mementos, not authenticated game scores or paid entitlements. */
export type ProgressKind = 'visit' | 'interact' | 'capture' | 'note' | 'feedback';
export type ProgressEvent = {kind:ProgressKind;worldId:string};
export type AchievementId = 'first-door'|'curious-hands'|'every-door'|'moment-keeper'|'field-notes'|'co-creator';
export type Award = {at:number;worlds:number};
export type ExplorationProgress = {version:1;visit:string[];interact:string[];capture:string[];note:string[];feedback:string[];awards:Partial<Record<AchievementId,Award>>};
export type Achievement = {id:AchievementId;title:string;description:string;symbol:string;kind:ProgressKind;target:number;current:number;award?:Award};
export const PROGRESS_KEY = 'pe-exploration-mementos-v1';
const kinds:ProgressKind[]=['visit','interact','capture','note','feedback'];
const ids:AchievementId[]=['first-door','curious-hands','every-door','moment-keeper','field-notes','co-creator'];
export function emptyProgress():ExplorationProgress{return{version:1,visit:[],interact:[],capture:[],note:[],feedback:[],awards:{}};}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function readProgress(value:unknown,eligible:string[]):ExplorationProgress{
 const result=emptyProgress(),allowed=new Set(eligible);
 if(!record(value)||value.version!==1)return result;
 for(const kind of kinds)if(Array.isArray(value[kind]))result[kind]=[...new Set((value[kind] as unknown[]).filter((id):id is string=>typeof id==='string'&&allowed.has(id)))].slice(0,512);
 if(record(value.awards))for(const id of ids){const award=value.awards[id];if(record(award)&&typeof award.at==='number'&&Number.isSafeInteger(award.at)&&award.at>0&&typeof award.worlds==='number'&&Number.isSafeInteger(award.worlds)&&award.worlds>=0&&award.worlds<=512)result.awards[id]={at:award.at,worlds:award.worlds};}
 return result;
}
export function achievements(progress:ExplorationProgress,eligible:string[]):Achievement[]{
 const total=new Set(eligible).size;
 const definitions:{id:AchievementId;title:string;description:string;symbol:string;kind:ProgressKind;target:number}[]=[
  {id:'first-door',title:'A door left open',description:'Step into your first world.',symbol:'✦',kind:'visit',target:1},
  {id:'curious-hands',title:'Curious hands',description:'Try a control in three different worlds.',symbol:'✧',kind:'interact',target:Math.min(3,total)},
  {id:'every-door',title:'Every open door',description:'Visit every world currently in the collection.',symbol:'◈',kind:'visit',target:total},
  {id:'moment-keeper',title:'A moment, kept',description:'Save your first screenshot or recording.',symbol:'◎',kind:'capture',target:1},
  {id:'field-notes',title:'Something worth noting',description:'Save an observation in your library.',symbol:'≋',kind:'note',target:1},
  {id:'co-creator',title:'A little better',description:'Send one thought that could shape a world.',symbol:'✺',kind:'feedback',target:1},
 ];
 const allowed=new Set(eligible);
 return definitions.map(d=>({...d,current:progress[d.kind].filter(id=>allowed.has(id)).length,award:progress.awards[d.id]}));
}
export function addProgress(progress:ExplorationProgress,event:ProgressEvent,eligible:string[],now=Date.now()):{progress:ExplorationProgress;unlocked:AchievementId[]}{
 if(!event||!kinds.includes(event.kind)||!eligible.includes(event.worldId)||!Number.isSafeInteger(now)||now<=0)return{progress,unlocked:[]};
 const next:ExplorationProgress={...progress,[event.kind]:[...new Set([...progress[event.kind],event.worldId])],awards:{...progress.awards}};
 const unlocked:AchievementId[]=[];
 for(const badge of achievements(next,eligible))if(badge.target>0&&badge.current>=badge.target&&!badge.award){next.awards[badge.id]={at:now,worlds:new Set(eligible).size};unlocked.push(badge.id);}
 return{progress:next,unlocked};
}
export function mergeVisited(progress:ExplorationProgress,visited:string[],eligible:string[],now=Date.now()):ExplorationProgress{
 return [...new Set(visited)].filter(id=>eligible.includes(id)).reduce((p,worldId)=>addProgress(p,{kind:'visit',worldId},eligible,now).progress,progress);
}
export function achievementCaption(badge:Pick<Achievement,'title'>):string{return `I earned “${badge.title}” exploring worlds by @itsArnz. What will you discover?\nhttps://pure-exploration.arnz.chatgpt.site`;}

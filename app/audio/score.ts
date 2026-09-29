/** Original score rules. No sampled song, voice, or third-party melody. */
export type SoundMood='garden'|'curiosity'|'tide'|'adventure'|'mystery';
export type SoundSettings={enabled:boolean;music:number;effects:number};
export const defaultSoundSettings:SoundSettings={enabled:false,music:.45,effects:.4};
export const soundStorageKey='pure-exploration-sound-v1';
export const clampVolume=(n:unknown,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):fallback;
export function readSoundSettings(raw:string|null):SoundSettings{try{const v=JSON.parse(raw||'{}');return{enabled:v?.enabled===true,music:clampVolume(v?.music,.45),effects:clampVolume(v?.effects,.4)};}catch{return{...defaultSoundSettings};}}
export function musicAllowed(path:string){return path==='/'||path==='/telescope';}
export function portalBlend(distance:number){if(!Number.isFinite(distance))return 0;const t=Math.max(0,Math.min(1,(18-distance)/13));return t*t*(3-2*t);}
export function moodForWorld(worldId:string):SoundMood{if(['plate-engine','telescope','spacetime','airport','lightning'].includes(worldId))return'curiosity';if(['tides','coral','coral-reef','coral-memory'].includes(worldId))return'tide';if(['poe'].includes(worldId))return'mystery';return'adventure';}
export const moodNames:Record<SoundMood,string>={garden:'Garden flute',curiosity:'A little curiosity',tide:'Tidal glass',adventure:'Beyond the horizon',mystery:'Lanterns in the mist'};
export const motifs:Record<SoundMood,readonly number[]>={garden:[62,69,74,-1,71,69,-1,66,64,-1,62,-1],curiosity:[74,78,81,-1,85,81,78,-1,76,74,-1,-1],tide:[62,-1,69,66,-1,74,69,-1,66,-1,64,-1],adventure:[62,66,-1,69,74,-1,71,69,66,-1,64,-1],mystery:[62,-1,65,69,-1,72,69,-1,65,64,-1,-1]};
export const cueCooldown:Record<string,number>={favorite:750,capture:1500,portal:2500,achievement:3500};
export const frequency=(midi:number)=>440*2**((midi-69)/12);

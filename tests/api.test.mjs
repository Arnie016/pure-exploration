import assert from 'node:assert/strict';
import {feedbackQuestions} from '../app/feedback-model.ts';
const origin=process.env.TEST_ORIGIN||'http://localhost:4317';let cookie='';let checks=0;
async function call(path,data,{auth=true,foreign=false}={}){const r=await fetch(origin+path,{method:data===undefined?'GET':'POST',headers:{Origin:foreign?'https://evil.example':origin,'Content-Type':'application/json',...(auth&&cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],name=pair.split('=')[0];cookie=cookie.split('; ').filter(v=>v&&!v.startsWith(name+'=')).concat(pair).join('; ');}const raw=await r.text();let body;try{body=JSON.parse(raw);}catch{body={error:raw.slice(0,100)};}return{status:r.status,body};}
function ok(value,label){assert.ok(value,label);console.log('PASS '+label);checks++;}
const stranger=await call('/api/admin/report');ok(stranger.status===401||stranger.status===503,'private report is closed before authentication');
const denied=await call('/api/pulse',{project:'garden'},{foreign:true});ok(denied.status===403,'cross-origin mutations are rejected');
const pulse=await call('/api/pulse',{project:'garden'});ok(pulse.status===200&&pulse.body.me?.id,'anonymous session starts with a public fox identity');
const id=pulse.body.me.id;ok(!('id' in pulse.body)||pulse.body.id!==cookie,'secret visitor token is not returned');
const pulse2=await call('/api/pulse',{project:'garden'});ok(pulse2.body.journey.find(j=>j.project==='garden').visits===1,'heartbeat does not inflate individual visit counts');
const publicTrail=await call('/api/stats');ok(!('journey' in publicTrail.body)&&!('history' in publicTrail.body),'public stats exclude personal journeys and detailed history');
ok(!('channels' in publicTrail.body)&&!('feedback' in publicTrail.body),'public stats exclude private entry sources and feedback');
const ownCookie=cookie;cookie='';const other=await call('/api/pulse',{project:'airport'});ok(other.body.journey.every(j=>j.project!=='garden'),'another browser cannot see the first browser journey');await call('/api/forget',{});cookie=ownCookie;
await call('/api/event',{name:'project_open',project:'fable-flight'});await call('/api/event',{name:'project_open',project:'fable-flight'});const pulse3=await call('/api/pulse',{project:'garden'});ok(pulse3.body.journey.find(j=>j.project==='fable-flight').opens===1,'repeated portal opens are deduplicated within a session');
const first=await call('/api/favorite',{project:'telescope',active:true});const count=first.body.favorites.find(f=>f.project==='telescope').favorites;const twice=await call('/api/favorite',{project:'telescope',active:true});ok(twice.body.favorites.find(f=>f.project==='telescope').favorites===count,'repeated favorites do not inflate the counter');
await call('/api/favorite',{project:'telescope',active:false});
await call('/api/reaction',{project:'telescope',value:-1});
const pub=await call('/api/stats');ok(!JSON.stringify(pub.body).includes('dislikes'),'public statistics never expose dislikes');
const unsafe=await call('/api/profile',{color:'mint',link:'javascript:alert(1)'});ok(unsafe.status===400,'profile links reject executable URLs');
const presence=await call('/api/garden',{x:999,z:-999});const me=presence.body.people.find(p=>p.id===id);ok(me.x===90&&me.z===-70,'shared positions are constrained by the server');
const feedback=await call('/api/feedback',{project:'telescope',text:'Integration test: keep the optical explanation clear.'});ok(feedback.status===200,'a private suggestion can be submitted');
const duplicate=await call('/api/feedback',{project:'telescope',text:'Integration test: repeated submission.'});ok(duplicate.status===429,'rapid feedback is rate limited');
const bad=await call('/api/admin/login',{key:'wrong'});ok(bad.status===401||bad.status===503,'wrong owner key cannot open analytics');
const login=await call('/api/admin/login',{key:process.env.TEST_OWNER_KEY||'local-only-owner-test'});
if(login.status===200){
 const report=await call('/api/admin/report');ok(report.status===200&&report.body.feedback.some(f=>f.text.includes('Integration test:')),'authenticated owner can see private feedback');ok(report.body.reactions.some(r=>r.project==='telescope'&&r.dislikes>0),'authenticated owner can see private dislikes');
 ok(Array.isArray(report.body.channels)&&report.body.channels.every(row=>['direct','x','github','search','shared','other'].includes(row.channel)&&Number.isSafeInteger(row.visits)&&row.visits>=0),'owner report contains only aggregate allowlisted entry channels');
 const originalCookie=cookie;
 // New browser identity avoids the earlier free-text feedback rate window.
 // Keep only this test's owner session so the fresh browser can read aggregate proof.
 cookie=cookie.split('; ').filter(pair=>pair.startsWith('pe_owner=')).join('; ');
 const initialChannels=Object.fromEntries(report.body.channels.map(row=>[row.channel,row.visits]));
 const fresh=await call('/api/pulse',{project:'telescope',channel:'x'});
 ok(fresh.status===200&&fresh.body.me?.id!==id,'guided feedback uses a fresh independent browser session');
 ok(!('channels' in fresh.body)&&!('feedback' in fresh.body),'visitor pulse does not expose owner sources or feedback');
 const entered=await call('/api/admin/report');
 const beforeChange=Object.fromEntries(entered.body.channels.map(row=>[row.channel,row.visits]));
 ok(beforeChange.x===(initialChannels.x||0)+1,'first X arrival creates one measured session entry');
 const repulse=await call('/api/pulse',{project:'airport',channel:'github'});
 ok(repulse.status===200,'same browser session can continue into another world');
 const changed=await call('/api/admin/report');
 const afterChange=Object.fromEntries(changed.body.channels.map(row=>[row.channel,row.visits]));
 ok(afterChange.x===beforeChange.x&&(afterChange.github||0)===(beforeChange.github||0),'later pulse cannot replace first X entry with GitHub or add a second entry');
 const answers=feedbackQuestions('telescope').map(q=>q.options[0].id);
 const malformed=await call('/api/feedback',{project:'telescope',guided:true,answers:['not-an-answer',...answers.slice(1)],note:''});
 ok(malformed.status===400,'guided feedback rejects invalid option identifiers');
 const incomplete=await call('/api/feedback',{project:'telescope',guided:true,answers:answers.slice(0,2),note:''});
 ok(incomplete.status===400,'guided feedback requires all three answers');
 const notFavorite=await call('/api/feedback',{project:'telescope',guided:true,answers,note:'Integration test: guided reflection before favoriting.'});
 ok(notFavorite.status===400&&/favorite/i.test(notFavorite.body.error||''),'valid guided reflection is rejected before the world is favorited');
 const savedFavorite=await call('/api/favorite',{project:'telescope',active:true});
 ok(savedFavorite.status===200&&savedFavorite.body.saved.includes('telescope'),'fresh browser favorites the world before reflection');
 const guidedNote='Integration test: guided reflection after favoriting.';
 const accepted=await call('/api/feedback',{project:'telescope',guided:true,answers,note:guidedNote});
 ok(accepted.status===200&&accepted.body.ok,'valid guided feedback succeeds after favoriting');
 const reflected=await call('/api/admin/report');
 ok(reflected.body.feedback.some(f=>f.project==='telescope'&&f.text.startsWith('Discovery reflection\n')&&f.text.includes(guidedNote)),'guided answers are rendered into private owner feedback');
 const publicAfter=await call('/api/stats');
 ok(!('channels' in publicAfter.body)&&!('feedback' in publicAfter.body)&&!JSON.stringify(publicAfter.body).includes(guidedNote),'public statistics stay free of guided answers and entry channels');
 await call('/api/forget',{});cookie=originalCookie;
 await call('/api/admin/logout',{});const out=await call('/api/admin/report');ok(out.status===401,'logout revokes owner access');
}else{console.log('Owner positive test not configured: '+login.status);process.exitCode=1;}
await call('/api/forget',{});const forgotten=await call('/api/garden',{x:0,z:0});ok(forgotten.status===401,'forgetting the browser revokes its session');
console.log(`${checks} backend checks passed`);

import {guidedFeedbackText} from '../app/feedback-model';
import {privateSchema} from './private';
/** First-party, pseudonymous activity. Visitor tokens never leave HttpOnly cookies. */
interface DB {prepare(sql:string):Stmt;batch<T=unknown>(statements:Stmt[]):Promise<{results:T[]}[]>}
interface Stmt {bind(...values:unknown[]):Stmt;run():Promise<unknown>;all<T=unknown>():Promise<{results:T[]}>;first<T=unknown>(column?:string):Promise<T|null>}
const knownProjects=new Set(['coral-memory','glorp','spacetime','leaderboard','garden','telescope','airport','lightning','galevein','hollowdeep','neuroscience','universe-clash','tides','reef-relay','aeolith','cansat','checkfirst','morse','particles','poe','edge-universe','skyline','alien-art','ben10','tokenbar','bitepdf','fable-flight']);
const eventNames=new Set(['first_interaction','share','project_open','chapter','tour','clip','follow','remix','screenshot']);
const signals=['Hello, explorers!','I found something wonderful.','Try the telescope.','Who wants to race?','The lightning lab is incredible.','Come explore the airport.'];
let initialized:Promise<unknown>|null=null;
async function schema(db:DB){return db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created INTEGER NOT NULL, seen INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS events (session TEXT NOT NULL, name TEXT NOT NULL, project TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(session,name,project,day))'),
 db.prepare('CREATE INDEX IF NOT EXISTS events_day ON events(day)'),
 db.prepare('CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, public_id TEXT UNIQUE NOT NULL, alias TEXT NOT NULL, color TEXT NOT NULL, link TEXT NOT NULL DEFAULT "", seen INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS favorites_v2 (visitor TEXT NOT NULL, project TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(visitor,project))'),
 db.prepare('CREATE TABLE IF NOT EXISTS presence (visitor TEXT PRIMARY KEY, x REAL NOT NULL DEFAULT 0, z REAL NOT NULL DEFAULT 0, seen INTEGER NOT NULL)'),
 db.prepare('CREATE INDEX IF NOT EXISTS presence_seen ON presence(seen)'),
 db.prepare('CREATE TABLE IF NOT EXISTS garden_feed (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL)'),
 db.prepare('CREATE INDEX IF NOT EXISTS feed_created ON garden_feed(created)'),
 db.prepare("CREATE TABLE IF NOT EXISTS journeys(visitor TEXT NOT NULL,project TEXT NOT NULL,visits INTEGER NOT NULL DEFAULT 0,opens INTEGER NOT NULL DEFAULT 0,last_visit TEXT NOT NULL DEFAULT '',last_open TEXT NOT NULL DEFAULT '',updated INTEGER NOT NULL,PRIMARY KEY(visitor,project))")]);}
export async function activity(request:Request,db:DB|undefined):Promise<Response>{
 const url=new URL(request.url),headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!db)return json({error:'Activity is not connected'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Use this site to send activity'},403);
 const text=request.method==='POST'?await request.text():'';
 if(text.length>2048)return json({error:'Request too large'},413);
 let data:Record<string,unknown>={};try{if(text)data=JSON.parse(text);if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();}catch{return json({error:'Invalid JSON'},400);}
 try{
  if(!initialized)initialized=schema(db).catch(e=>{initialized=null;throw e;});await initialized;await privateSchema(db);
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),cutoff=new Date(now-30*864e5).toISOString().slice(0,10);
  const cookie=(name:string)=>request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([a-f0-9-]{36})(?:;|$)`))?.[1];
  let visitor=cookie('pe_visitor'),session=cookie('pe_session');
  const old=visitor?await db.prepare('SELECT * FROM visitors WHERE id=?').bind(visitor).first<{id:string;public_id:string;alias:string;color:string;link:string;seen:number}>():null;
  const current=session?await db.prepare('SELECT seen FROM sessions WHERE id=?').bind(session).first<{seen:number}>():null;
  const setCookie=(name:string,value:string,age:number)=>headers.append('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`);
  const project=typeof data.project==='string'&&knownProjects.has(data.project)?data.project:'garden';
  if(url.pathname==='/api/pulse'&&request.method==='POST'){
   if(!old){visitor=crypto.randomUUID();const pub=crypto.randomUUID(),n=parseInt(pub.slice(0,4),16);const alias=['Amber','Cedar','Lunar','Fern','Comet','Moss','Nova','Saffron'][n%8]+' Fox '+(n%900+100);await db.prepare('INSERT INTO visitors(id,public_id,alias,color,seen) VALUES(?,?,?,?,?)').bind(visitor,pub,alias,['amber','mint','silver','rose'][n%4],now).run();setCookie('pe_visitor',visitor,180*86400);}else await db.prepare('UPDATE visitors SET seen=? WHERE id=?').bind(now,visitor).run();
   if(!current||now-current.seen>1800000){session=crypto.randomUUID();await db.prepare('INSERT INTO sessions(id,created,seen) VALUES(?,?,?)').bind(session,now,now).run();}else await db.prepare('UPDATE sessions SET seen=? WHERE id=?').bind(now,session).run();
   setCookie('pe_session',session!,1800);
   const channel=['direct','x','github','search','shared','other'].includes(String(data.channel))?String(data.channel):'direct';
   await db.prepare('INSERT OR IGNORE INTO entry_channels(session,channel,created) VALUES(?,?,?)').bind(session,channel,now).run();
   await db.prepare('INSERT OR IGNORE INTO events(session,name,project,day,created) VALUES(?,?,?,?,?)').bind(session,'visit',project,day,now).run();
   await journey(db,visitor!,session!,project,now,'visit');
   // Bounded retention; persistent favorites remain until removed or the browser is forgotten.
   if(!current)await db.batch([db.prepare('DELETE FROM entry_channels WHERE created < ?').bind(now-30*864e5),db.prepare('DELETE FROM sessions WHERE seen < ?').bind(now-864e5),db.prepare('DELETE FROM events WHERE day < ?').bind(cutoff),db.prepare('DELETE FROM presence WHERE seen < ?').bind(now-864e5),db.prepare('DELETE FROM garden_feed WHERE created < ?').bind(now-864e5)]);
   return json({...await stats(db,now,cutoff),...await self(db,visitor!)});
  }
  if(url.pathname==='/api/stats'&&request.method==='GET')return json(await stats(db,now,cutoff));
  if(!old||!visitor||!session||!current||now-current.seen>1800000)return json({error:'Open a world to start a session'},401);
  if(url.pathname==='/api/event'&&request.method==='POST'){
   if(typeof data.name!=='string'||!eventNames.has(data.name)||!knownProjects.has(String(data.project)))return json({error:'Unknown activity'},400);
   await db.prepare('INSERT OR IGNORE INTO events(session,name,project,day,created) VALUES(?,?,?,?,?)').bind(session,data.name,project,day,now).run();if(data.name==='project_open')await journey(db,visitor,session,project,now,'open');return json({ok:true});
  }
  if(url.pathname==='/api/favorite'&&request.method==='POST'){
   if(typeof data.active!=='boolean'||!knownProjects.has(String(data.project)))return json({error:'Choose a world and favorite state'},400);
   const previous=await db.prepare('SELECT created FROM favorites_v2 WHERE visitor=? AND project=?').bind(visitor,project).first();
   await(data.active?db.prepare('INSERT OR IGNORE INTO favorites_v2(visitor,project,created) VALUES(?,?,?)').bind(visitor,project,now):db.prepare('DELETE FROM favorites_v2 WHERE visitor=? AND project=?').bind(visitor,project)).run();
   const recentAnnouncement=await db.prepare("SELECT created FROM garden_feed WHERE visitor=? AND kind='favorite' ORDER BY created DESC LIMIT 1").bind(visitor).first<{created:number}>();
   if(data.active&&!previous&&(!recentAnnouncement||now-recentAnnouncement.created>15000))await db.prepare('INSERT INTO garden_feed(id,visitor,kind,text,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),visitor,'favorite',project,now).run();
   return json({ok:true,...await self(db,visitor),...await stats(db,now,cutoff)});
  }
  if(url.pathname==='/api/garden'&&request.method==='POST'){
   // Position is intent: constrain to the walkable garden; never trust client count/identity.
   const x=typeof data.x==='number'&&Number.isFinite(data.x)?Math.max(-90,Math.min(90,data.x)):0;
   const z=typeof data.z==='number'&&Number.isFinite(data.z)?Math.max(-70,Math.min(80,data.z)):4;
   await db.prepare('INSERT INTO presence(visitor,x,z,seen) VALUES(?,?,?,?) ON CONFLICT(visitor) DO UPDATE SET x=excluded.x,z=excluded.z,seen=excluded.seen').bind(visitor,x,z,now).run();
   const people=await db.prepare('SELECT v.public_id AS id,v.alias,v.color,v.link,p.x,p.z FROM presence p JOIN visitors v ON v.id=p.visitor WHERE p.seen>? ORDER BY p.seen DESC LIMIT 200').bind(now-20000).all();
   const count=await db.prepare('SELECT count(*) AS n FROM presence WHERE seen>?').bind(now-20000).first<number>('n');
   const feed=await db.prepare('SELECT f.id,v.alias,f.kind,f.text,f.created FROM garden_feed f JOIN visitors v ON v.id=f.visitor WHERE f.created>? ORDER BY f.created DESC LIMIT 12').bind(now-864e5).all();
   return json({people:people.results,total:count||0,feed:feed.results,you:old.public_id});
  }
  if(url.pathname==='/api/profile'&&request.method==='POST'){
   const color=['amber','mint','silver','rose'].includes(String(data.color))?String(data.color):old.color;
   const link=typeof data.link==='string'?data.link.trim():'';
   if(link&&!/^https:\/\/(?:x\.com|github\.com)\/[A-Za-z0-9_-]{1,39}\/?$/.test(link))return json({error:'Use a public X or GitHub profile URL'},400);
   await db.prepare('UPDATE visitors SET color=?,link=? WHERE id=?').bind(color,link,visitor).run();return json({ok:true,...await self(db,visitor)});
  }
  if(url.pathname==='/api/signal'&&request.method==='POST'){
   if(!signals.includes(String(data.text)))return json({error:'Choose a garden greeting'},400);
   const recent=await db.prepare("SELECT created FROM garden_feed WHERE visitor=? AND kind='signal' ORDER BY created DESC LIMIT 1").bind(visitor).first<{created:number}>();
   if(recent&&now-recent.created<10000)return json({error:'Give your last greeting a moment'},429);
   await db.prepare('INSERT INTO garden_feed(id,visitor,kind,text,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),visitor,'signal',data.text,now).run();return json({ok:true});
  }
  if(url.pathname==='/api/reaction'&&request.method==='POST'){
   if(![-1,0,1].includes(Number(data.value))||typeof data.value!=='number'||!knownProjects.has(String(data.project)))return json({error:'Choose a reaction'},400);
   await db.prepare('INSERT INTO reactions(visitor,project,value,updated) VALUES(?,?,?,?) ON CONFLICT(visitor,project) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(visitor,project,data.value,now).run();return json({ok:true,value:data.value});
  }
  if(url.pathname==='/api/feedback'&&request.method==='POST'){
   if(data.guided===true){
    const reflection=guidedFeedbackText(project,data.answers,data.note);
    if(!reflection)return json({error:'Choose an answer for each of the three questions'},400);
    const saved=await db.prepare('SELECT created FROM favorites_v2 WHERE visitor=? AND project=?').bind(visitor,project).first();
    if(!saved)return json({error:'Save this world to your favorites before sending this reflection'},400);
    data.text=reflection;
   }
   if(!knownProjects.has(String(data.project))||typeof data.text!=='string'||data.text.trim().length<5||data.text.length>600)return json({error:'Write a suggestion between 5 and 600 characters'},400);
   const recent=await db.prepare('SELECT count(*) AS count,max(created) AS latest FROM feedback WHERE visitor=? AND created>?').bind(visitor,now-864e5).first<{count:number;latest:number}>();
   if(recent&&((recent.count>=5)||(now-recent.latest<30000)))return json({error:'Please wait before sending another suggestion. Limit: five per day.'},429);
   await db.prepare('INSERT INTO feedback(id,visitor,project,text,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),visitor,project,data.text.trim(),now).run();return json({ok:true});
  }
  if(url.pathname==='/api/forget' &&request.method==='POST'){
   await db.batch(['presence','favorites_v2','garden_feed','reactions','feedback','journeys'].map(t=>db.prepare(`DELETE FROM ${t} WHERE visitor=?`).bind(visitor)));
   await db.prepare('DELETE FROM entry_channels WHERE session=?').bind(session).run();await db.prepare('DELETE FROM visitors WHERE id=?').bind(visitor).run();await db.prepare('DELETE FROM sessions WHERE id=?').bind(session).run();setCookie('pe_visitor','',0);setCookie('pe_session','',0);return json({ok:true});
  }
  return json({error:'Not found'},404);
 }catch{return json({error:'Activity is temporarily unavailable'},503);}
}
async function journey(db:DB,visitor:string,session:string,project:string,now:number,kind:'visit'|'open'){
 const field=kind==='visit'?'visits':'opens',last=kind==='visit'?'last_visit':'last_open';
 await db.prepare(`INSERT INTO journeys(visitor,project,${field},${last},updated) VALUES(?,?,1,?,?) ON CONFLICT(visitor,project) DO UPDATE SET ${field}=journeys.${field}+CASE WHEN journeys.${last}<>excluded.${last} THEN 1 ELSE 0 END,${last}=excluded.${last},updated=excluded.updated`).bind(visitor,project,session,now).run();
}
async function self(db:DB,visitor:string){const me=await db.prepare('SELECT public_id AS id,alias,color,link FROM visitors WHERE id=?').bind(visitor).first();const favorites=await db.prepare('SELECT project FROM favorites_v2 WHERE visitor=?').bind(visitor).all<{project:string}>();const trail=await db.prepare('SELECT project,visits,opens,updated FROM journeys WHERE visitor=? ORDER BY updated DESC').bind(visitor).all();return{me,saved:favorites.results.map(r=>r.project),journey:trail.results};}
async function stats(db:DB,now:number,cutoff:string){
 const active=await db.prepare('SELECT count(*) AS n FROM sessions WHERE seen>?').bind(now-90000).first<number>('n');
 const rows=await db.prepare('SELECT name,count(DISTINCT session) AS n FROM events WHERE day>=? GROUP BY name').bind(cutoff).all<{name:string;n:number}>();const counts=Object.fromEntries(rows.results.map(r=>[r.name,r.n]));
 const history=await db.prepare("SELECT day,count(DISTINCT session) AS visits FROM events WHERE name='visit' AND day>=? GROUP BY day ORDER BY day").bind(cutoff).all();
 const ranking=await db.prepare("SELECT project,sum(CASE WHEN name='visit' THEN 1 ELSE 0 END) AS visits,sum(CASE WHEN name='project_open' THEN 1 ELSE 0 END) AS opens,sum(CASE WHEN name='share' THEN 1 ELSE 0 END) AS shares FROM events WHERE day>=? GROUP BY project").bind(cutoff).all();
 const favorites=await db.prepare('SELECT project,count(*) AS favorites FROM favorites_v2 GROUP BY project').all();
 const likes=await db.prepare('SELECT project,count(*) AS likes FROM reactions WHERE value=1 GROUP BY project').all();
 return{active:active||0,visits:counts.visit||0,shares:counts.share||0,explorations:counts.project_open||0,ranking:ranking.results,favorites:favorites.results,likes:likes.results};
}

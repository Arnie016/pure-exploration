interface DB {prepare(sql:string):Stmt;batch<T=unknown>(statements:Stmt[]):Promise<{results:T[]}[]>}
interface Stmt {bind(...values:unknown[]):Stmt;run():Promise<unknown>;all<T=unknown>():Promise<{results:T[]}>;first<T=unknown>(column?:string):Promise<T|null>}
let setup:Promise<unknown>|null=null;
export async function privateSchema(db:DB){if(!setup)setup=db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS entry_channels (session TEXT PRIMARY KEY, channel TEXT NOT NULL, created INTEGER NOT NULL)'),
 db.prepare('CREATE INDEX IF NOT EXISTS entry_channels_created ON entry_channels(created)'),
 db.prepare('CREATE TABLE IF NOT EXISTS reactions (visitor TEXT NOT NULL,project TEXT NOT NULL,value INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(visitor,project))'),
 db.prepare('CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY,visitor TEXT NOT NULL,project TEXT NOT NULL,text TEXT NOT NULL,created INTEGER NOT NULL,resolved INTEGER NOT NULL DEFAULT 0)'),
 db.prepare('CREATE INDEX IF NOT EXISTS feedback_visitor ON feedback(visitor,created)'),
 db.prepare('CREATE TABLE IF NOT EXISTS owner_sessions (hash TEXT PRIMARY KEY,epoch TEXT NOT NULL,expires INTEGER NOT NULL)')]).catch(e=>{setup=null;throw e;});await setup;}
export async function digest(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
export async function owner(request:Request,db:DB|undefined,ownerHash?:string){const url=new URL(request.url),headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}),json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(!db)return json({error:'Owner storage is unavailable'},503);if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Origin mismatch'},403);
 try{await privateSchema(db);const now=Date.now();if(!ownerHash||!/^[a-f0-9]{64}$/.test(ownerHash))return json({error:'Owner access has not been configured'},503);
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){
   const raw=await request.text();if(raw.length>2048)return json({error:'Request too large'},413);let body:{key?:string};try{body=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}if(typeof body.key!=='string'||await digest(body.key.trim())!==ownerHash)return json({error:'That owner key was not accepted'},401);
   const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await db.prepare('INSERT INTO owner_sessions(hash,epoch,expires) VALUES(?,?,?)').bind(await digest(token),ownerHash,now+12*36e5).run();await db.prepare('DELETE FROM owner_sessions WHERE expires<? OR epoch<>?').bind(now,ownerHash).run();headers.append('Set-Cookie',`pe_owner=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=43200${url.protocol==='https:'?'; Secure':''}`);return json({ok:true});
  }
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)pe_owner=([a-f0-9]{64})(?:;|$)/)?.[1];const auth=token?await db.prepare('SELECT expires FROM owner_sessions WHERE hash=? AND epoch=? AND expires>?').bind(await digest(token),ownerHash,now).first():null;if(!auth)return json({error:'Owner sign-in required'},401);
  if(url.pathname==='/api/admin/logout'&&request.method==='POST'){await db.prepare('DELETE FROM owner_sessions WHERE hash=?').bind(await digest(token!)).run();headers.append('Set-Cookie','pe_owner=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0');return json({ok:true});}
  if(url.pathname==='/api/admin/feedback'&&request.method==='POST'){const raw=await request.text();if(raw.length>500)return json({error:'Request too large'},413);const body=JSON.parse(raw) as {id:string;resolved:boolean};if(typeof body.id!=='string'||typeof body.resolved!=='boolean')return json({error:'Invalid feedback state'},400);await db.prepare('UPDATE feedback SET resolved=? WHERE id=?').bind(body.resolved?1:0,body.id).run();return json({ok:true});}
  if(url.pathname==='/api/admin/report'&&request.method==='GET'){
   const cutoff=new Date(now-30*864e5).toISOString().slice(0,10);
   const events=await db.prepare('SELECT project,name,count(*) AS total,count(DISTINCT session) AS sessions FROM events WHERE day>=? GROUP BY project,name ORDER BY total DESC').bind(cutoff).all();
   const reactions=await db.prepare('SELECT project,sum(CASE WHEN value=1 THEN 1 ELSE 0 END) AS likes,sum(CASE WHEN value=-1 THEN 1 ELSE 0 END) AS dislikes FROM reactions GROUP BY project').all();
   const feedback=await db.prepare('SELECT id,project,text,created,resolved FROM feedback ORDER BY created DESC LIMIT 150').all();
   const days=await db.prepare('SELECT day,name,count(DISTINCT session) AS sessions FROM events WHERE day>=? GROUP BY day,name ORDER BY day').bind(cutoff).all();
   const viewers=await db.prepare('SELECT count(*) AS n FROM sessions WHERE seen>?').bind(now-90000).first<number>('n');
   const onlineGarden=await db.prepare('SELECT count(*) AS n FROM presence WHERE seen>?').bind(now-20000).first<number>('n');
   const journeys=await db.prepare('SELECT v.public_id AS visitor,v.alias,j.project,j.visits,j.opens,j.updated FROM journeys j JOIN visitors v ON v.id=j.visitor ORDER BY j.updated DESC LIMIT 200').all();
   const channels=await db.prepare('SELECT channel,count(*) AS visits FROM entry_channels WHERE created>? GROUP BY channel ORDER BY visits DESC').bind(now-30*864e5).all();
   return json({channels:channels.results,journeys:journeys.results,generatedAt:new Date(now).toISOString(),periodDays:30,online:viewers||0,garden:onlineGarden||0,events:events.results,reactions:reactions.results,feedback:feedback.results,days:days.results});
  }return json({error:'Not found'},404);
 }catch{return json({error:'The owner report is temporarily unavailable'},503);}
}

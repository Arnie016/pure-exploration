import {verifyToken} from '@clerk/backend';
import {projects} from '../app/projects';
export interface ExplorerEnv {DB:D1Database;CLERK_SECRET_KEY?:string;CLERK_JWT_KEY?:string;CLERK_PUBLISHABLE_KEY?:string}
export const discoveryWorlds=projects.filter(p=>p.featured!==false&&p.url&&p.category!=='Tools').map(p=>p.id);
export async function explorerSchema(db:D1Database){await db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS explorer_profiles (subject TEXT PRIMARY KEY, public_id TEXT UNIQUE NOT NULL, alias TEXT NOT NULL, visible INTEGER NOT NULL DEFAULT 0, joined INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS explorer_worlds (subject TEXT NOT NULL, world TEXT NOT NULL, discovered INTEGER NOT NULL, PRIMARY KEY(subject,world))')
]);}
export async function explorerBoard(db:D1Database){
 const placeholders=discoveryWorlds.map(()=>'?').join(',');
 const result=await db.prepare(`WITH scores AS (SELECT p.public_id AS id,p.alias,count(w.world) AS worlds FROM explorer_profiles p LEFT JOIN explorer_worlds w ON w.subject=p.subject AND w.world IN (${placeholders}) WHERE p.visible=1 GROUP BY p.subject) SELECT id,alias,worlds,RANK() OVER (ORDER BY worlds DESC) AS rank FROM scores ORDER BY worlds DESC,alias,id LIMIT 100`).bind(...discoveryWorlds).all();
 return result.results;
}
export async function syncDiscoveries(db:D1Database,subject:string,visitor:string){
 // Copy only observed world visits, never a score or badge supplied by the client.
 await db.prepare(`INSERT OR IGNORE INTO explorer_worlds(subject,world,discovered) SELECT ?,project,updated FROM journeys WHERE visitor=? AND (visits>0 OR opens>0) AND project IN (${discoveryWorlds.map(()=>'?').join(',')})`).bind(subject,visitor,...discoveryWorlds).run();
}
export async function explorers(request:Request,env:ExplorerEnv):Promise<Response>{
 const url=new URL(request.url),json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!env.DB)return json({error:'The explorer board could not connect.'},503);
 const configured=!!(env.CLERK_SECRET_KEY||env.CLERK_JWT_KEY)&&/^pk_(test|live)_/.test(env.CLERK_PUBLISHABLE_KEY||'');
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 try{
  await explorerSchema(env.DB);
  if(request.method==='GET')return json({rows:await explorerBoard(env.DB),configured,publishableKey:configured?env.CLERK_PUBLISHABLE_KEY:null});
  if(request.headers.get('Origin')!==url.origin)return json({error:'Use this site to manage your place on the board.'},403);
  if(!configured)return json({error:'Optional sign-in is not connected yet.'},503);
  const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token)return json({error:'Sign in to manage your public profile.'},401);
  let subject:string;try{const claims=await verifyToken(token,{secretKey:env.CLERK_SECRET_KEY,jwtKey:env.CLERK_JWT_KEY,authorizedParties:[url.origin]});if(!claims.sub||!claims.azp||claims.azp!==url.origin)throw new Error();subject=claims.sub;}catch{return json({error:'Your sign-in expired. Sign in again.'},401);}
  const raw=await request.text();if(raw.length>1024)return json({error:'Request too large'},413);
  let data:{action?:string;alias?:string};try{data=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
  if(!data||!['status','join','sync','leave','delete'].includes(data.action||''))return json({error:'Choose a profile action.'},400);
  if(data.action==='delete'){await env.DB.batch([env.DB.prepare('DELETE FROM explorer_worlds WHERE subject=?').bind(subject),env.DB.prepare('DELETE FROM explorer_profiles WHERE subject=?').bind(subject)]);return json({profile:null});}
  if(data.action==='leave')await env.DB.prepare('UPDATE explorer_profiles SET visible=0 WHERE subject=?').bind(subject).run();
  if(data.action==='join'){
   const alias=typeof data.alias==='string'?data.alias.trim():'';
   if(!/^[\p{L}\p{N} _'-]{2,28}$/u.test(alias))return json({error:'Use a name of 2–28 letters, numbers or spaces.'},400);
   await env.DB.prepare('INSERT INTO explorer_profiles(subject,public_id,alias,visible,joined) VALUES(?,?,?,1,?) ON CONFLICT(subject) DO UPDATE SET alias=excluded.alias,visible=1').bind(subject,crypto.randomUUID(),alias,Date.now()).run();
  }
  if(data.action==='join'||data.action==='sync'){
   const profile=await env.DB.prepare('SELECT visible FROM explorer_profiles WHERE subject=?').bind(subject).first<{visible:number}>();
   if(!profile?.visible)return json({error:'Join the board before sharing discoveries.'},409);
   const visitor=request.headers.get('Cookie')?.match(/(?:^|;\s*)pe_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
   if(visitor)await syncDiscoveries(env.DB,subject,visitor);
  }
  const profile=await env.DB.prepare('SELECT public_id AS id,alias,visible FROM explorer_profiles WHERE subject=?').bind(subject).first();
  return json({profile,rows:await explorerBoard(env.DB)});
 }catch{return json({error:'The explorer board could not refresh. Try again.'},503);}
}

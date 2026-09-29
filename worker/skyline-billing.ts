/** Google-verified paid inventory; earned game coins never enter this ledger. */
export interface SkylineEnv { DB: D1Database; GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?: string; GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?: string; SKYLINE_PAYMENTS_ENABLED?: string }
export const PACKAGE = 'dev.arnav.skylineswing';
export const PRODUCTS: Record<string,{coins:number;net:number;smoke:number;entitlement?:string}> = {
 skyline_neon_suit:{coins:0,net:0,smoke:0,entitlement:'neon'},
 skyline_founder_bundle:{coins:1500,net:3,smoke:3,entitlement:'founder'},
 skyline_coins_1500:{coins:1500,net:0,smoke:0}, skyline_gadget_pack:{coins:0,net:3,smoke:3},
};
type Purchase = {purchaseStateContext?:{purchaseState?:string};testPurchaseContext?:{fopType?:string};obfuscatedExternalAccountId?:string;acknowledgementState?:string;productLineItem?:{productId?:string;productOfferDetails?:{quantity?:number;refundableQuantity?:number;consumptionState?:string;rentOfferDetails?:unknown;preorderOfferDetails?:unknown}}[]};
class Failure extends Error { constructor(public status:number,public code:string){super(code);} }
export async function hash(secret:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))),x=>x.toString(16).padStart(2,'0')).join('');}
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function accessToken(env:SkylineEnv,send:typeof fetch){
 if(!env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL||!env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY)throw new Failure(503,'billing_not_configured');
 const now=Math.floor(Date.now()/1000),enc=(o:unknown)=>b64(new TextEncoder().encode(JSON.stringify(o)));
 const input=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pem=env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input));
 const response=await send('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64(new Uint8Array(sig))}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Failure(503,'billing_authorization_unavailable');
 const result=await response.json() as {access_token?:string};if(!result.access_token)throw new Failure(503,'billing_authorization_unavailable');return result.access_token;
}
export function validatePurchase(p:Purchase,member:string,product:string){
 if(p.obfuscatedExternalAccountId!==member)throw new Failure(403,'purchase_account_mismatch');
 if(p.testPurchaseContext?.fopType!=='TEST')throw new Failure(403,'test_purchases_only');
 if(p.purchaseStateContext?.purchaseState==='PENDING')return null;
 if(p.purchaseStateContext?.purchaseState!=='PURCHASED')throw new Failure(409,'purchase_not_completed');
 const line=p.productLineItem;if(line?.length!==1||line[0].productId!==product)throw new Failure(409,'purchase_product_mismatch');
 const offer=line[0].productOfferDetails,quantity=offer?.quantity;
 if(!offer||!Number.isInteger(quantity)||quantity!<1||quantity!>100||offer.refundableQuantity!==quantity||offer.rentOfferDetails||offer.preorderOfferDetails)throw new Failure(409,'invalid_purchase_quantity');
 if(!['CONSUMPTION_STATE_YET_TO_BE_CONSUMED','CONSUMPTION_STATE_CONSUMED'].includes(offer.consumptionState??'')||!['ACKNOWLEDGEMENT_STATE_PENDING','ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(p.acknowledgementState??''))throw new Failure(409,'invalid_purchase_state');
 if(PRODUCTS[product].entitlement&&quantity!==1)throw new Failure(409,'invalid_purchase_quantity');
 return {quantity:quantity!,consumed:offer.consumptionState==='CONSUMPTION_STATE_CONSUMED'};
}
async function snapshot(db:D1Database,memberId:string){const wallet=await db.prepare('SELECT coins,net,smoke FROM skyline_wallets WHERE member=?').bind(memberId).first();const rows=await db.prepare('SELECT entitlement FROM skyline_entitlements WHERE member=? ORDER BY entitlement').bind(memberId).all<{entitlement:string}>();return {memberId,entitlements:rows.results.map(r=>r.entitlement),wallet:wallet??{coins:0,net:0,smoke:0}};}
export async function skylineBilling(request:Request,env:SkylineEnv,send:typeof fetch=fetch):Promise<Response>{
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{
 const path=new URL(request.url).pathname;
 if(!['GET','POST'].includes(request.method))throw new Failure(405,'method_not_allowed');
 // Native calls omit Origin. Browser calls must be same origin; no CORS granted.
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new Failure(403,'origin_not_allowed');
 let body:Record<string,unknown>={};if(request.method==='POST'){
  if(Number(request.headers.get('Content-Length'))>8192)throw new Failure(413,'request_too_large');
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
  if(reader){try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>8192){await reader.cancel();throw new Failure(413,'request_too_large');}chunks.push(part.value);}}finally{reader.releaseLock();}}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw 0;}catch{throw new Failure(400,'invalid_json');}
 }
 if((path==='/api/skyline/account'||path==='/api/skyline/recover')&&request.method==='POST'){
  // Cloudflare supplies CF-Connecting-IP; retain only rotating hashes, not addresses.
  const window=Math.floor(Date.now()/3600000),bucket=await hash(window+':'+path+':'+(request.headers.get('CF-Connecting-IP')??'unknown'));
  await env.DB.prepare('INSERT INTO skyline_rate_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').bind(bucket,(window+2)*3600000).run();
  const rate=await env.DB.prepare('SELECT count FROM skyline_rate_limits WHERE bucket=?').bind(bucket).first<{count:number}>();
  if((rate?.count??0)>(path.endsWith('/account')?60:20))throw new Failure(429,'too_many_requests');
  await env.DB.prepare('DELETE FROM skyline_rate_limits WHERE expires<?').bind(Date.now()).run();
 }
 if(path==='/api/skyline/account'&&request.method==='POST'){
  const memberId=crypto.randomUUID(),sessionToken=secret(),recoveryToken=secret();
  await env.DB.batch([env.DB.prepare('INSERT INTO skyline_members(id,session_hash,recovery_hash,created) VALUES(?,?,?,?)').bind(memberId,await hash(sessionToken),await hash(recoveryToken),Date.now()),env.DB.prepare('INSERT INTO skyline_wallets(member) VALUES(?)').bind(memberId)]);
  return json({memberId,sessionToken,recoveryToken});
 }
 if(path==='/api/skyline/recover'&&request.method==='POST'){
  if(typeof body.memberId!=='string'||typeof body.recoveryToken!=='string'||!/^[a-f0-9]{64}$/.test(body.recoveryToken))throw new Failure(401,'invalid_recovery');
  const sessionToken=secret(),recoveryToken=secret(),result=await env.DB.prepare('UPDATE skyline_members SET session_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(await hash(sessionToken),await hash(recoveryToken),body.memberId,await hash(body.recoveryToken)).run();
  if(result.meta.changes!==1)throw new Failure(401,'invalid_recovery');return json({memberId:body.memberId,sessionToken,recoveryToken});
 }
 const auth=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!auth)throw new Failure(401,'authentication_required');
 const member=await env.DB.prepare('SELECT id FROM skyline_members WHERE session_hash=?').bind(await hash(auth)).first<{id:string}>();if(!member)throw new Failure(401,'invalid_session');
 if(path==='/api/skyline/entitlements'&&request.method==='GET')return json(await snapshot(env.DB,member.id));
 if(path==='/api/skyline/buy'&&request.method==='POST'){
  if(env.SKYLINE_PAYMENTS_ENABLED!=='sandbox')throw new Failure(503,'purchases_not_open');
  const catalogue:Record<string,number>={net:200,smoke:150},item=String(body.item);
  if(!Object.hasOwn(catalogue,item)||typeof body.requestId!=='string'||! /^[a-zA-Z0-9_-]{16,64}$/.test(body.requestId)||Object.keys(body).some(key=>!['item','requestId'].includes(key)))throw new Failure(400,'invalid_buy');
  const price=catalogue[item];
  const old=await env.DB.prepare('SELECT item,price FROM skyline_coin_buys WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{item:string;price:number}>();
  if(old&&(old.item!==item||old.price!==price))throw new Failure(409,'request_id_conflict');
  try{await env.DB.prepare('INSERT OR IGNORE INTO skyline_coin_buys(member,request_id,item,price,created) VALUES(?,?,?,?,?)').bind(member.id,body.requestId,item,price,Date.now()).run();}catch{throw new Failure(409,'insufficient_balance');}
  const saved=await env.DB.prepare('SELECT item,price FROM skyline_coin_buys WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{item:string;price:number}>();
  if(saved?.item!==item||saved?.price!==price)throw new Failure(409,'request_id_conflict');
  return json(await snapshot(env.DB,member.id));
 }
 if(path==='/api/skyline/spend'&&request.method==='POST'){
  if(env.SKYLINE_PAYMENTS_ENABLED!=='sandbox')throw new Failure(503,'purchases_not_open');
  const costs:Record<string,{currency:string;amount:number}>={net:{currency:'net',amount:1},smoke:{currency:'smoke',amount:1}};
  const cost=costs[String(body.item)];if(!cost||typeof body.requestId!=='string'||! /^[a-zA-Z0-9_-]{16,64}$/.test(body.requestId))throw new Failure(400,'invalid_spend');
  const old=await env.DB.prepare('SELECT currency,amount FROM skyline_spends WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{currency:string;amount:number}>();if(old&&(old.currency!==cost.currency||old.amount!==cost.amount))throw new Failure(409,'request_id_conflict');
  try{await env.DB.prepare('INSERT OR IGNORE INTO skyline_spends(member,request_id,currency,amount,created) VALUES(?,?,?,?,?)').bind(member.id,body.requestId,cost.currency,cost.amount,Date.now()).run();}catch{throw new Failure(409,'insufficient_balance');}
  const spent=await env.DB.prepare('SELECT currency,amount FROM skyline_spends WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{currency:string;amount:number}>();if(spent?.currency!==cost.currency||spent?.amount!==cost.amount)throw new Failure(409,'request_id_conflict');
  return json(await snapshot(env.DB,member.id));
 }
 if(path!=='/api/skyline/verify'||request.method!=='POST')throw new Failure(404,'not_found');
 if(env.SKYLINE_PAYMENTS_ENABLED!=='sandbox')throw new Failure(503,'purchases_not_open');
 const product=String(body.productId),token=body.purchaseToken;if(!Object.hasOwn(PRODUCTS,product)||typeof token!=='string'||token.length<8||token.length>4096||/\s/.test(token))throw new Failure(400,'invalid_purchase');
 const tokenHash=await hash(token),existing=await env.DB.prepare('SELECT member,product,settlement FROM skyline_purchases WHERE token_hash=?').bind(tokenHash).first<{member:string;product:string;settlement:string}>();
 if(existing&&(existing.member!==member.id||existing.product!==product))throw new Failure(409,'purchase_already_bound');
 const oauth=await accessToken(env,send),headers={Authorization:'Bearer '+oauth,'Content-Type':'application/json'},base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/';
 const response=await send(base+'productsv2/tokens/'+encodeURIComponent(token),{headers,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Failure(response.status===404?404:503,'purchase_verification_unavailable');
 const purchase=await response.json() as Purchase,valid=validatePurchase(purchase,member.id,product);if(!valid)return json({status:'pending',...await snapshot(env.DB,member.id)});
 if(valid.consumed&&!existing)throw new Failure(409,'purchase_already_consumed');
 const grant=PRODUCTS[product];
 await env.DB.prepare('INSERT OR IGNORE INTO skyline_purchases(token_hash,member,product,quantity,coins,net,smoke,entitlement,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(tokenHash,member.id,product,valid.quantity,grant.coins*valid.quantity,grant.net*valid.quantity,grant.smoke*valid.quantity,grant.entitlement??null,Date.now()).run();
 const saved=await env.DB.prepare('SELECT member,product,settlement FROM skyline_purchases WHERE token_hash=?').bind(tokenHash).first<{member:string;product:string;settlement:string}>();if(saved?.member!==member.id||saved?.product!==product)throw new Failure(409,'purchase_already_bound');
 let settlement=saved.settlement;
 if(settlement!=='complete'){
  const done=grant.entitlement?purchase.acknowledgementState==='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED':valid.consumed;
  try{if(!done){const result=await send(base+'products/'+encodeURIComponent(product)+'/tokens/'+encodeURIComponent(token)+(grant.entitlement?':acknowledge':':consume'),{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});if(!result.ok)throw 0;}
   await env.DB.prepare("UPDATE skyline_purchases SET settlement='complete' WHERE token_hash=?").bind(tokenHash).run();settlement='complete';
  }catch{settlement='retry';}
 }
 return json({status:'verified',settlement,...await snapshot(env.DB,member.id)});
 }catch(error){return json({error:error instanceof Failure?error.code:'billing_unavailable'},error instanceof Failure?error.status:503);}
}

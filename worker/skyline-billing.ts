/** Google-verified paid inventory; earned game coins never enter this ledger. */
export interface SkylineEnv { DB: D1Database; SKYLINE_BILLING_ENVIRONMENT?: string; GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?: string; GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?: string; SKYLINE_PAYMENTS_ENABLED?: string; OWNER_KEY_HASH?: string; SKYLINE_DELETION_PROCESSING_ENABLED?: string }
export const PACKAGE = 'dev.arnav.skylineswing';
export const PRODUCTS: Record<string,{coins:number;net:number;smoke:number;entitlement?:string}> = {
 skyline_neon_suit:{coins:0,net:0,smoke:0,entitlement:'neon'},
 skyline_founder_bundle:{coins:1500,net:3,smoke:3,entitlement:'founder'},
 skyline_coins_1500:{coins:1500,net:0,smoke:0}, skyline_gadget_pack:{coins:0,net:3,smoke:3},
};
const DELETION_DEADLINE_MS=7*86400000;
const DELETION_RECEIPT_RETENTION_MS=30*86400000;
/** Bounded database maintenance; actual periodic invocation must be verified by the host. */
export async function skylineDeletionMaintenance(env:SkylineEnv,now=Date.now(),invoker:"manual"|"scheduled"="manual"){
 env=billingEnvironment(env);
 if(env.SKYLINE_DELETION_PROCESSING_ENABLED!=='true')throw new Failure(503,'deletion_processing_not_open');
 if(!Number.isSafeInteger(now)||now<0)throw new Failure(400,'invalid_maintenance_time');
 if(!['manual','scheduled'].includes(invoker))throw new Failure(400,'invalid_maintenance_invoker');
 // The purge and heartbeat commit together. A failed purge must never look healthy.
 const results=await env.DB.batch([
  env.DB.prepare('DELETE FROM skyline_deletion_completions WHERE completed<=?').bind(now-DELETION_RECEIPT_RETENTION_MS),
  env.DB.prepare('INSERT INTO skyline_deletion_health(id,last_success,last_scheduled) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET last_success=MAX(last_success,excluded.last_success),last_scheduled=CASE WHEN excluded.last_scheduled IS NULL THEN last_scheduled ELSE MAX(COALESCE(last_scheduled,0),excluded.last_scheduled) END').bind(now,invoker==='scheduled'?now:null),
 ]);
 const removed=results[0];
 const pending=await env.DB.prepare("SELECT COUNT(*) AS pending,COALESCE(SUM(CASE WHEN requested+?<=? THEN 1 ELSE 0 END),0) AS overdue,MIN(requested+?) AS nextDeadline FROM skyline_deletion_requests WHERE status='pending'").bind(DELETION_DEADLINE_MS,now,DELETION_DEADLINE_MS).first<{pending:number;overdue:number;nextDeadline:number|null}>();
 return {purgedReceipts:removed.meta.changes,pending:pending?.pending??0,overdue:pending?.overdue??0,nextDeadline:pending?.nextDeadline??null};
}
type Purchase = {purchaseStateContext?:{purchaseState?:string};testPurchaseContext?:{fopType?:string};obfuscatedExternalAccountId?:string;acknowledgementState?:string;productLineItem?:{productId?:string;productOfferDetails?:{quantity?:number;refundableQuantity?:number;consumptionState?:string;rentOfferDetails?:unknown;preorderOfferDetails?:unknown}}[]};
class Failure extends Error { constructor(public status:number,public code:string){super(code);} }
type BillingMode='sandbox'|'production';
const PRODUCTION_BILLING_TABLES=["skyline_coin_buys_v2", "skyline_deletion_completions", "skyline_deletion_health", "skyline_deletion_requests", "skyline_entitlements", "skyline_members", "skyline_payment_holds", "skyline_purchases_v2", "skyline_rate_limits", "skyline_refund_events", "skyline_refunds", "skyline_spends_v2", "skyline_wallets"];
function billingMode(env:SkylineEnv):BillingMode{
 const mode=env.SKYLINE_BILLING_ENVIRONMENT;
 if(mode===undefined||mode==='sandbox')return 'sandbox';
 if(mode==='production')return 'production';
 throw new Failure(503,'billing_environment_invalid');
}
/** Route every account, inventory and deletion operation before touching a ledger. */
function billingEnvironment(env:SkylineEnv):SkylineEnv{
 const mode=billingMode(env);
 if(env.SKYLINE_PAYMENTS_ENABLED!==undefined&&env.SKYLINE_PAYMENTS_ENABLED!==mode)throw new Failure(503,'purchases_not_open');
 if(mode==='production'){
  // Only compile-time SQL identifiers are routed; bound values are untouched.
  const tables=new Set(PRODUCTION_BILLING_TABLES);
  const database=env.DB;
  const routed=new Proxy(database,{get(target,key){
   if(key==='prepare')return (sql:string)=>database.prepare(sql.replace(/\bskyline_[a-z0-9_]+\b/g,name=>{
    if(!tables.has(name))throw new Failure(503,'billing_table_not_routed');
    return name.replace('skyline_','skyline_production_');
   }));
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  return {...env,DB:routed};
 }
 return env;
}
function requirePayments(env:SkylineEnv){if(env.SKYLINE_PAYMENTS_ENABLED!==billingMode(env))throw new Failure(503,'purchases_not_open');}
function validPurchaseEnvironment(p:Purchase,mode:BillingMode){
 return mode==='sandbox'?p.testPurchaseContext?.fopType==='TEST':!Object.hasOwn(p,'testPurchaseContext');
}

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
export function validatePurchase(p:Purchase,member:string,product:string,mode:BillingMode='sandbox'){
 if(p.obfuscatedExternalAccountId!==member)throw new Failure(403,'purchase_account_mismatch');
 if(!validPurchaseEnvironment(p,mode))throw new Failure(403,mode==='sandbox'?'test_purchases_only':'production_purchases_only');
 if(p.purchaseStateContext?.purchaseState==='PENDING')return null;
 if(p.purchaseStateContext?.purchaseState!=='PURCHASED')throw new Failure(409,'purchase_not_completed');
 const line=p.productLineItem;if(line?.length!==1||line[0].productId!==product)throw new Failure(409,'purchase_product_mismatch');
 const offer=line[0].productOfferDetails,quantity=offer?.quantity;
 if(!offer||!Number.isInteger(quantity)||quantity!<1||quantity!>100||offer.refundableQuantity!==quantity||offer.rentOfferDetails||offer.preorderOfferDetails)throw new Failure(409,'invalid_purchase_quantity');
 if(!['CONSUMPTION_STATE_YET_TO_BE_CONSUMED','CONSUMPTION_STATE_CONSUMED'].includes(offer.consumptionState??'')||!['ACKNOWLEDGEMENT_STATE_PENDING','ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(p.acknowledgementState??''))throw new Failure(409,'invalid_purchase_state');
 if(PRODUCTS[product].entitlement&&quantity!==1)throw new Failure(409,'invalid_purchase_quantity');
 return {quantity:quantity!,consumed:offer.consumptionState==='CONSUMPTION_STATE_CONSUMED'};
}
type VoidedPurchase={purchaseToken?:string;voidedTimeMillis?:string;voidedQuantity?:number};
async function reconcile(request:Request,body:Record<string,unknown>,env:SkylineEnv,send:typeof fetch){
 const auth=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{16,256})$/)?.[1];
 if(!env.OWNER_KEY_HASH||! /^[a-f0-9]{64}$/.test(env.OWNER_KEY_HASH))throw new Failure(503,'owner_not_configured');
 if(!auth||await hash(auth)!==env.OWNER_KEY_HASH)throw new Failure(401,'owner_authentication_required');
 requirePayments(env);
 const now=Date.now(),end=body.endTimeMillis??now,start=body.startTimeMillis??Number(end)-29*86400000;
 if(Object.keys(body).some(key=>!['startTimeMillis','endTimeMillis'].includes(key))||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||Number(start)<now-30*86400000||Number(end)>now||Number(start)>=Number(end))throw new Failure(400,'invalid_reconciliation_window');
 const oauth=await accessToken(env,send);let page:string|undefined,reviewed=0,revoked=0,unknown=0,partialHeld=0;
 for(let n=0;n<3;n++){
  const url=new URL('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/voidedpurchases');
  url.searchParams.set('startTime',String(start));url.searchParams.set('endTime',String(end));url.searchParams.set('type','0');url.searchParams.set('maxResults','100');url.searchParams.set('includeQuantityBasedPartialRefund','true');if(page)url.searchParams.set('token',page);
  const response=await send(url.toString(),{headers:{Authorization:'Bearer '+oauth},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Failure(503,'refund_source_unavailable');
  const data=await response.json() as {voidedPurchases?:VoidedPurchase[];tokenPagination?:{nextPageToken?:string}};
  if(!Array.isArray(data.voidedPurchases)&&data.voidedPurchases!==undefined||Number(data.voidedPurchases?.length)>100)throw new Failure(503,'invalid_refund_source');
  for(const entry of data.voidedPurchases??[]){
   if(typeof entry.purchaseToken!=='string'||entry.purchaseToken.length<8||entry.purchaseToken.length>4096||/\s/.test(entry.purchaseToken)||! /^\d{1,16}$/.test(entry.voidedTimeMillis??'')||entry.voidedQuantity!==undefined&&(!Number.isInteger(entry.voidedQuantity)||entry.voidedQuantity<1||entry.voidedQuantity>100))throw new Failure(503,'invalid_refund_source');
   const tokenHash=await hash(entry.purchaseToken),at=Number(entry.voidedTimeMillis);if(!Number.isSafeInteger(at)||at>now)throw new Failure(503,'invalid_refund_source');
   const known=await env.DB.prepare('SELECT member,product,quantity FROM skyline_purchases_v2 WHERE token_hash=?').bind(tokenHash).first<{member:string;product:string;quantity:number}>();
   // If admission races this lookup, cap the conservative tombstone against
   // the newly admitted quantity in SQL; unknown partial races require review.
   let target=known?.quantity??100;
   if(entry.voidedQuantity!==undefined&&known){
    // Event quantities are not cumulative and have no unique event ID. Reconcile
    // against Google's remaining quantity rather than adding possibly replayed events.
    const check=await send('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/productsv2/tokens/'+encodeURIComponent(entry.purchaseToken),{headers:{Authorization:'Bearer '+oauth},signal:AbortSignal.timeout(10000)});
    if(!check.ok)throw new Failure(503,'refund_quantity_unavailable');
    const proof=await check.json() as Purchase,offer=proof.productLineItem?.[0]?.productOfferDetails,remaining=offer?.refundableQuantity;
    if(proof.obfuscatedExternalAccountId!==known.member||!validPurchaseEnvironment(proof,billingMode(env))||proof.productLineItem?.length!==1||proof.productLineItem[0].productId!==known.product||offer?.quantity!==known.quantity||!Number.isInteger(remaining)||remaining!<0||remaining!>known.quantity||known.quantity-remaining!<entry.voidedQuantity||offer.rentOfferDetails||offer.preorderOfferDetails)throw new Failure(503,'invalid_refund_quantity');
    target=known.quantity-remaining!;
   }
   // Fingerprints deduplicate audit rows only; identical events can collide.
   const eventHash=await hash(tokenHash+':'+at+':'+(entry.voidedQuantity??'full'));
   // All delta calculations use the durable cumulative watermark within one D1
   // transaction. Stale proof cannot lower it; a full record drains the remainder.
   const delta='(r.desired_quantity-r.refunded_quantity)',purchase='skyline_purchases_v2 p JOIN skyline_refunds r ON p.token_hash=r.token_hash';
   const debit=(currency:string)=>`(SELECT p.${currency}/p.quantity*${delta} FROM ${purchase} WHERE p.token_hash=?)`;
   const results=await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO skyline_refund_events(event_hash,token_hash,voided_at,partial_quantity) VALUES(?,?,?,?)').bind(eventHash,tokenHash,at,entry.voidedQuantity??null),
    env.DB.prepare('INSERT OR IGNORE INTO skyline_refunds(token_hash,voided_at,partial_quantity) VALUES(?,?,?)').bind(tokenHash,at,entry.voidedQuantity??null),
    env.DB.prepare('UPDATE skyline_refunds SET desired_quantity=MAX(desired_quantity,MIN(?,COALESCE((SELECT quantity FROM skyline_purchases_v2 WHERE token_hash=?),0))) WHERE token_hash=?').bind(target,tokenHash,tokenHash),
    env.DB.prepare(`UPDATE skyline_refunds SET coins_debt=coins_debt+MAX(0,${debit('coins')}-(SELECT coins FROM skyline_wallets WHERE member=(SELECT member FROM skyline_purchases_v2 WHERE token_hash=?))),net_debt=net_debt+MAX(0,${debit('net')}-(SELECT net FROM skyline_wallets WHERE member=(SELECT member FROM skyline_purchases_v2 WHERE token_hash=?))),smoke_debt=smoke_debt+MAX(0,${debit('smoke')}-(SELECT smoke FROM skyline_wallets WHERE member=(SELECT member FROM skyline_purchases_v2 WHERE token_hash=?))) WHERE token_hash=? AND desired_quantity>refunded_quantity AND EXISTS(SELECT 1 FROM skyline_purchases_v2 WHERE token_hash=? AND applied=1)`).bind(tokenHash,tokenHash,tokenHash,tokenHash,tokenHash,tokenHash,tokenHash,tokenHash),
    env.DB.prepare("INSERT OR IGNORE INTO skyline_payment_holds(member,reason,created) SELECT p.member,CASE WHEN ?=1 THEN 'partial_refund_review' ELSE 'spent_refund_review' END,? FROM skyline_purchases_v2 p JOIN skyline_refunds r ON p.token_hash=r.token_hash WHERE p.token_hash=? AND p.applied=1 AND (r.coins_debt+r.net_debt+r.smoke_debt>0 OR ?=1)").bind(entry.voidedQuantity!==undefined&&!known?1:0,now,tokenHash,entry.voidedQuantity!==undefined&&!known?1:0),
    env.DB.prepare(`UPDATE skyline_wallets SET coins=MAX(0,coins-${debit('coins')}),net=MAX(0,net-${debit('net')}),smoke=MAX(0,smoke-${debit('smoke')}) WHERE member=(SELECT member FROM skyline_purchases_v2 WHERE token_hash=? AND applied=1) AND EXISTS(SELECT 1 FROM skyline_refunds WHERE token_hash=? AND desired_quantity>refunded_quantity)`).bind(tokenHash,tokenHash,tokenHash,tokenHash,tokenHash),
    env.DB.prepare('DELETE FROM skyline_entitlements WHERE (member,entitlement) IN (SELECT member,entitlement FROM skyline_purchases_v2 WHERE token_hash=? AND applied=1) AND EXISTS(SELECT 1 FROM skyline_refunds r JOIN skyline_purchases_v2 p ON r.token_hash=p.token_hash WHERE r.token_hash=? AND r.desired_quantity>=p.quantity AND r.desired_quantity>r.refunded_quantity)').bind(tokenHash,tokenHash),
    env.DB.prepare("UPDATE skyline_purchases_v2 SET settlement=CASE WHEN (SELECT desired_quantity FROM skyline_refunds WHERE token_hash=?)>=quantity THEN 'revoked' ELSE 'partially_refunded' END WHERE token_hash=? AND EXISTS(SELECT 1 FROM skyline_refunds WHERE token_hash=? AND desired_quantity>refunded_quantity)").bind(tokenHash,tokenHash,tokenHash),
    env.DB.prepare('UPDATE skyline_refunds SET refunded_quantity=desired_quantity,applied=1 WHERE token_hash=? AND (desired_quantity>refunded_quantity OR applied=0)').bind(tokenHash),
    env.DB.prepare('SELECT p.member,r.coins_debt+r.net_debt+r.smoke_debt AS debt FROM skyline_purchases_v2 p JOIN skyline_refunds r ON p.token_hash=r.token_hash WHERE p.token_hash=?').bind(tokenHash),
   ]);
   reviewed++;if(results[9].results.length===0)unknown++;else if(results[7].meta.changes)revoked++;if(entry.voidedQuantity!==undefined&&Number((results[9].results[0] as {debt?:number}|undefined)?.debt)>0)partialHeld++;
  }
  page=data.tokenPagination?.nextPageToken;if(page!==undefined&&(typeof page!=='string'||page.length>4096))throw new Failure(503,'invalid_refund_source');if(!page)break;
 }
 return {reviewed,revoked,unknown,partialHeld,complete:!page};
}
async function snapshot(db:D1Database,memberId:string){
 const [wallet,entitlements,hold]=await db.batch([
  db.prepare('SELECT coins,net,smoke FROM skyline_wallets WHERE member=?').bind(memberId),
  db.prepare('SELECT entitlement FROM skyline_entitlements WHERE member=? ORDER BY entitlement').bind(memberId),
  db.prepare('SELECT reason FROM skyline_payment_holds WHERE member=?').bind(memberId),
 ]);
 if(!wallet.results.length)throw new Failure(401,'account_unavailable');
 return {memberId,paymentHold:hold.results.length>0,entitlements:(entitlements.results as {entitlement:string}[]).map(r=>r.entitlement),wallet:wallet.results[0]??{coins:0,net:0,smoke:0}};
}
export async function skylineBilling(request:Request,env:SkylineEnv,send:typeof fetch=fetch):Promise<Response>{
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const originalEnvironment=env;
 try{
 env=billingEnvironment(env);
 const path=new URL(request.url).pathname;
 if(!['GET','POST'].includes(request.method))throw new Failure(405,'method_not_allowed');
 // Native calls omit Origin. Browser calls must be same origin; no CORS granted.
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new Failure(403,'origin_not_allowed');
 const expectedEnvironment=request.headers.get('X-Skyline-Billing-Environment');
 if(expectedEnvironment!==null&&expectedEnvironment!==billingMode(env))throw new Failure(409,'billing_environment_mismatch');
 if(path==='/api/skyline/environment'&&request.method==='GET'){
  if(new URL(request.url).search)throw new Failure(400,'invalid_environment_request');
  return json({billingEnvironment:billingMode(env),paymentsOpen:env.SKYLINE_PAYMENTS_ENABLED===billingMode(env)});
 }
 let body:Record<string,unknown>={};if(request.method==='POST'){
  if(Number(request.headers.get('Content-Length'))>8192)throw new Failure(413,'request_too_large');
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
  if(reader){try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>8192){await reader.cancel();throw new Failure(413,'request_too_large');}chunks.push(part.value);}}finally{reader.releaseLock();}}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw 0;}catch{throw new Failure(400,'invalid_json');}
 }
 if(path==='/api/skyline/reconcile'&&request.method==='POST')return json(await reconcile(request,body,env,send));
 if(path==='/api/skyline/deletion-health'&&request.method==='GET'){
  const auth=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{16,256})$/)?.[1];
  if(!env.OWNER_KEY_HASH||!/^[a-f0-9]{64}$/.test(env.OWNER_KEY_HASH))throw new Failure(503,'owner_not_configured');
  if(!auth||await hash(auth)!==env.OWNER_KEY_HASH)throw new Failure(401,'owner_authentication_required');
  if(new URL(request.url).search)throw new Failure(400,'invalid_health_request');
  const now=Date.now();
  const health=await env.DB.prepare('SELECT last_success,last_scheduled FROM skyline_deletion_health WHERE id=1').first<{last_success:number;last_scheduled:number|null}>();
  const queue=await env.DB.prepare("SELECT COUNT(*) AS pending,COALESCE(SUM(CASE WHEN requested+?<=? THEN 1 ELSE 0 END),0) AS overdue,MIN(requested+?) AS nextDeadline FROM skyline_deletion_requests WHERE status='pending'").bind(DELETION_DEADLINE_MS,now,DELETION_DEADLINE_MS).first<{pending:number;overdue:number;nextDeadline:number|null}>();
  return json({processingEnabled:env.SKYLINE_DELETION_PROCESSING_ENABLED==='true',checkedAt:now,lastMaintenanceAt:health?.last_success??null,lastScheduledAt:health?.last_scheduled??null,scheduledRecently:Boolean(health?.last_scheduled&&now-health.last_scheduled<2*3600000),pending:queue?.pending??0,overdue:queue?.overdue??0,nextDeadline:queue?.nextDeadline??null});
 }
 if(path==='/api/skyline/deletion-maintenance'&&request.method==='POST'){
  const auth=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{16,256})$/)?.[1];
  if(!env.OWNER_KEY_HASH||!/^[a-f0-9]{64}$/.test(env.OWNER_KEY_HASH))throw new Failure(503,'owner_not_configured');
  if(!auth||await hash(auth)!==env.OWNER_KEY_HASH)throw new Failure(401,'owner_authentication_required');
  if(Object.keys(body).length)throw new Failure(400,'invalid_maintenance_request');
  return json(await skylineDeletionMaintenance(originalEnvironment));
 }
 if(path==='/api/skyline/deletion-requests/complete'&&request.method==='POST'){
  const auth=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{16,256})$/)?.[1];
  if(!env.OWNER_KEY_HASH||!/^[a-f0-9]{64}$/.test(env.OWNER_KEY_HASH))throw new Failure(503,'owner_not_configured');
  if(!auth||await hash(auth)!==env.OWNER_KEY_HASH)throw new Failure(401,'owner_authentication_required');
  if(env.SKYLINE_DELETION_PROCESSING_ENABLED!=='true')throw new Failure(503,'deletion_processing_not_open');
  if(Object.keys(body).some(key=>!['requestId','confirmation'].includes(key))||typeof body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId)||body.confirmation!=='delete-account')throw new Failure(400,'invalid_deletion_confirmation');
  const requestHash=await hash(body.requestId);
  const pending=await env.DB.prepare("SELECT member FROM skyline_deletion_requests WHERE request_id=? AND status='pending'").bind(body.requestId).first<{member:string}>();
  if(!pending){
   const completed=await env.DB.prepare('SELECT completed FROM skyline_deletion_completions WHERE request_hash=? AND completed>?').bind(requestHash,Date.now()-DELETION_RECEIPT_RETENTION_MS).first<{completed:number}>();
   if(!completed)throw new Failure(404,'request_not_found');
   return json({status:'completed',requestId:body.requestId,completedAt:completed.completed});
  }
  // Guard every removal against the exact durable request. D1 batch commits all or none.
  const guard="EXISTS(SELECT 1 FROM skyline_deletion_requests WHERE member=? AND request_id=? AND status='pending')";
  const member=pending.member;
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO skyline_deletion_completions(request_hash,completed) SELECT ?,? WHERE "+guard).bind(requestHash,Date.now(),member,body.requestId),
   env.DB.prepare('DELETE FROM skyline_refund_events WHERE token_hash IN (SELECT token_hash FROM skyline_purchases_v2 WHERE member=?) AND '+guard).bind(member,member,body.requestId),
   env.DB.prepare('DELETE FROM skyline_refunds WHERE token_hash IN (SELECT token_hash FROM skyline_purchases_v2 WHERE member=?) AND '+guard).bind(member,member,body.requestId),
   ...['skyline_purchases_v2','skyline_entitlements','skyline_spends_v2','skyline_coin_buys_v2','skyline_payment_holds','skyline_wallets'].map(table=>env.DB.prepare('DELETE FROM '+table+' WHERE member=? AND '+guard).bind(member,member,body.requestId)),
   env.DB.prepare("DELETE FROM skyline_deletion_requests WHERE member=? AND request_id=? AND status='pending' AND EXISTS(SELECT 1 FROM skyline_deletion_completions WHERE request_hash=?)").bind(member,body.requestId,requestHash),
   env.DB.prepare('DELETE FROM skyline_members WHERE id=? AND NOT EXISTS(SELECT 1 FROM skyline_deletion_requests WHERE member=?) AND EXISTS(SELECT 1 FROM skyline_deletion_completions WHERE request_hash=?)').bind(member,member,requestHash),
  ]);
  const completed=await env.DB.prepare('SELECT completed FROM skyline_deletion_completions WHERE request_hash=? AND completed>?').bind(requestHash,Date.now()-DELETION_RECEIPT_RETENTION_MS).first<{completed:number}>();
  const remains=await env.DB.prepare('SELECT id FROM skyline_members WHERE id=?').bind(member).first();
  if(!completed||remains)throw new Failure(503,'deletion_not_confirmed');
  return json({status:'completed',requestId:body.requestId,completedAt:completed.completed});
 }
 if(path==='/api/skyline/deletion-requests'&&request.method==='GET'){
  const auth=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{16,256})$/)?.[1];
  if(!env.OWNER_KEY_HASH||!/^[a-f0-9]{64}$/.test(env.OWNER_KEY_HASH))throw new Failure(503,'owner_not_configured');
  if(!auth||await hash(auth)!==env.OWNER_KEY_HASH)throw new Failure(401,'owner_authentication_required');
  const params=new URL(request.url).searchParams,after=params.get('after')??'';
  if(Array.from(params.keys()).some(key=>key!=='after')||params.getAll('after').length>1||after&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(after))throw new Failure(400,'invalid_cursor');
  const rows=await env.DB.prepare("SELECT member,request_id,requested,status FROM skyline_deletion_requests WHERE status='pending' AND request_id>? ORDER BY request_id LIMIT 101").bind(after).all<{member:string;request_id:string;requested:number;status:string}>();
  const requests=rows.results.slice(0,100);
  return json({requests:requests.map(row=>({...row,deadlineAt:row.requested+DELETION_DEADLINE_MS})),next:rows.results.length>100?requests[99].request_id:null});
 }
 if((path==='/api/skyline/account'||path==='/api/skyline/recover'||path==='/api/skyline/deletion-request/recovery')&&request.method==='POST'){
  // Cloudflare supplies CF-Connecting-IP; retain only rotating hashes, not addresses.
  const window=Math.floor(Date.now()/3600000),bucket=await hash(window+':'+path+':'+(request.headers.get('CF-Connecting-IP')??'unknown'));
  await env.DB.prepare('INSERT INTO skyline_rate_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').bind(bucket,(window+2)*3600000).run();
  const rate=await env.DB.prepare('SELECT count FROM skyline_rate_limits WHERE bucket=?').bind(bucket).first<{count:number}>();
  if((rate?.count??0)>(path.endsWith('/account')?60:20))throw new Failure(429,'too_many_requests');
  await env.DB.prepare('DELETE FROM skyline_rate_limits WHERE expires<?').bind(Date.now()).run();
 }
 if(path==='/api/skyline/deletion-request/recovery'&&request.method==='POST'){
  if(Object.keys(body).some(key=>!['memberId','recoveryToken'].includes(key))||typeof body.memberId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.memberId)||typeof body.recoveryToken!=='string'||!/^[a-f0-9]{64}$/.test(body.recoveryToken))throw new Failure(401,'invalid_recovery');
  const member=await env.DB.prepare('SELECT id FROM skyline_members WHERE id=? AND recovery_hash=?').bind(body.memberId,await hash(body.recoveryToken)).first<{id:string}>();
  if(!member)throw new Failure(401,'invalid_recovery');
  await env.DB.prepare('INSERT OR IGNORE INTO skyline_deletion_requests(member,request_id,requested) VALUES(?,?,?)').bind(member.id,crypto.randomUUID(),Date.now()).run();
  const row=await env.DB.prepare('SELECT request_id,requested,status FROM skyline_deletion_requests WHERE member=?').bind(member.id).first<{request_id:string;requested:number;status:string}>();
  if(!row)throw new Failure(503,'request_not_recorded');
  return json({status:row.status,requestId:row.request_id,requestedAt:row.requested},202);
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
 if(path==='/api/skyline/deletion-request'){
  if(Object.keys(body).length)throw new Failure(400,'invalid_deletion_request');
  if(request.method==='POST')await env.DB.prepare('INSERT OR IGNORE INTO skyline_deletion_requests(member,request_id,requested) VALUES(?,?,?)').bind(member.id,crypto.randomUUID(),Date.now()).run();
  const row=await env.DB.prepare('SELECT request_id,requested,status FROM skyline_deletion_requests WHERE member=?').bind(member.id).first<{request_id:string;requested:number;status:string}>();
  return json(row?{status:row.status,requestId:row.request_id,requestedAt:row.requested}:{status:'not_requested'},request.method==='POST'?202:200);
 }
 if(path==='/api/skyline/entitlements'&&request.method==='GET')return json(await snapshot(env.DB,member.id));
 if(['/api/skyline/buy','/api/skyline/spend','/api/skyline/verify'].includes(path)&&await env.DB.prepare('SELECT member FROM skyline_payment_holds WHERE member=?').bind(member.id).first())throw new Failure(409,'payment_review_required');
 if(path==='/api/skyline/buy'&&request.method==='POST'){
  requirePayments(env);
  const catalogue:Record<string,number>={net:200,smoke:150},item=String(body.item);
  if(!Object.hasOwn(catalogue,item)||typeof body.requestId!=='string'||! /^[a-zA-Z0-9_-]{16,64}$/.test(body.requestId)||Object.keys(body).some(key=>!['item','requestId'].includes(key)))throw new Failure(400,'invalid_buy');
  const price=catalogue[item];
  const old=await env.DB.prepare('SELECT item,price FROM skyline_coin_buys_v2 WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{item:string;price:number}>();
  if(old&&(old.item!==item||old.price!==price))throw new Failure(409,'request_id_conflict');
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO skyline_coin_buys_v2(member,request_id,item,price,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM skyline_wallets WHERE member=? AND coins>=? AND NOT EXISTS(SELECT 1 FROM skyline_payment_holds WHERE member=skyline_wallets.member))').bind(member.id,body.requestId,item,price,Date.now(),member.id,price),
   env.DB.prepare("UPDATE skyline_wallets SET coins=coins-?,net=net+?,smoke=smoke+? WHERE member=? AND EXISTS(SELECT 1 FROM skyline_coin_buys_v2 WHERE member=? AND request_id=? AND item=? AND price=? AND applied=0)").bind(price,item==='net'?1:0,item==='smoke'?1:0,member.id,member.id,body.requestId,item,price),
   env.DB.prepare('UPDATE skyline_coin_buys_v2 SET applied=1 WHERE member=? AND request_id=? AND item=? AND price=? AND applied=0').bind(member.id,body.requestId,item,price),
  ]);
  const saved=await env.DB.prepare('SELECT item,price FROM skyline_coin_buys_v2 WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{item:string;price:number}>();
  if(!saved)throw new Failure(409,'insufficient_balance');if(saved.item!==item||saved.price!==price)throw new Failure(409,'request_id_conflict');
  return json(await snapshot(env.DB,member.id));
 }
 if(path==='/api/skyline/spend'&&request.method==='POST'){
  requirePayments(env);
  const costs:Record<string,{currency:string;amount:number}>={net:{currency:'net',amount:1},smoke:{currency:'smoke',amount:1}};
  const cost=costs[String(body.item)];if(!cost||typeof body.requestId!=='string'||! /^[a-zA-Z0-9_-]{16,64}$/.test(body.requestId))throw new Failure(400,'invalid_spend');
  const old=await env.DB.prepare('SELECT currency,amount FROM skyline_spends_v2 WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{currency:string;amount:number}>();if(old&&(old.currency!==cost.currency||old.amount!==cost.amount))throw new Failure(409,'request_id_conflict');
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO skyline_spends_v2(member,request_id,currency,amount,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM skyline_wallets WHERE member=? AND CASE ? WHEN 'net' THEN net ELSE smoke END>=? AND NOT EXISTS(SELECT 1 FROM skyline_payment_holds WHERE member=skyline_wallets.member))").bind(member.id,body.requestId,cost.currency,cost.amount,Date.now(),member.id,cost.currency,cost.amount),
   env.DB.prepare('UPDATE skyline_wallets SET net=net-?,smoke=smoke-? WHERE member=? AND EXISTS(SELECT 1 FROM skyline_spends_v2 WHERE member=? AND request_id=? AND currency=? AND amount=? AND applied=0)').bind(cost.currency==='net'?1:0,cost.currency==='smoke'?1:0,member.id,member.id,body.requestId,cost.currency,cost.amount),
   env.DB.prepare('UPDATE skyline_spends_v2 SET applied=1 WHERE member=? AND request_id=? AND currency=? AND amount=? AND applied=0').bind(member.id,body.requestId,cost.currency,cost.amount),
  ]);
  const spent=await env.DB.prepare('SELECT currency,amount FROM skyline_spends_v2 WHERE member=? AND request_id=?').bind(member.id,body.requestId).first<{currency:string;amount:number}>();if(!spent)throw new Failure(409,'insufficient_balance');if(spent.currency!==cost.currency||spent.amount!==cost.amount)throw new Failure(409,'request_id_conflict');
  return json(await snapshot(env.DB,member.id));
 }
 if(path!=='/api/skyline/verify'||request.method!=='POST')throw new Failure(404,'not_found');
 requirePayments(env);
 const product=String(body.productId),token=body.purchaseToken;if(!Object.hasOwn(PRODUCTS,product)||typeof token!=='string'||token.length<8||token.length>4096||/\s/.test(token))throw new Failure(400,'invalid_purchase');
 const tokenHash=await hash(token);if(await env.DB.prepare('SELECT token_hash FROM skyline_refunds WHERE token_hash=?').bind(tokenHash).first())throw new Failure(409,'purchase_refunded');
 const existing=await env.DB.prepare('SELECT member,product,settlement FROM skyline_purchases_v2 WHERE token_hash=?').bind(tokenHash).first<{member:string;product:string;settlement:string}>();
 if(existing&&(existing.member!==member.id||existing.product!==product))throw new Failure(409,'purchase_already_bound');
 const oauth=await accessToken(env,send),headers={Authorization:'Bearer '+oauth,'Content-Type':'application/json'},base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/';
 const response=await send(base+'productsv2/tokens/'+encodeURIComponent(token),{headers,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Failure(response.status===404?404:503,'purchase_verification_unavailable');
 const purchase=await response.json() as Purchase,valid=validatePurchase(purchase,member.id,product,billingMode(env));if(!valid)return json({status:'pending',...await snapshot(env.DB,member.id)});
 if(valid.consumed&&!existing)throw new Failure(409,'purchase_already_consumed');
 const grant=PRODUCTS[product];
 // D1 batch is one transaction: ledger admission, inventory and applied marker commit together.
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO skyline_purchases_v2(token_hash,member,product,quantity,coins,net,smoke,entitlement,created) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM skyline_members WHERE id=?) AND NOT EXISTS(SELECT 1 FROM skyline_refunds WHERE token_hash=?) AND NOT EXISTS(SELECT 1 FROM skyline_payment_holds WHERE member=?)').bind(tokenHash,member.id,product,valid.quantity,grant.coins*valid.quantity,grant.net*valid.quantity,grant.smoke*valid.quantity,grant.entitlement??null,Date.now(),member.id,tokenHash,member.id),
  env.DB.prepare('UPDATE skyline_wallets SET coins=coins+?,net=net+?,smoke=smoke+? WHERE member=? AND EXISTS(SELECT 1 FROM skyline_purchases_v2 WHERE token_hash=? AND member=? AND product=? AND applied=0)').bind(grant.coins*valid.quantity,grant.net*valid.quantity,grant.smoke*valid.quantity,member.id,tokenHash,member.id,product),
  env.DB.prepare('INSERT OR IGNORE INTO skyline_entitlements(member,entitlement) SELECT member,entitlement FROM skyline_purchases_v2 WHERE token_hash=? AND member=? AND product=? AND applied=0 AND entitlement IS NOT NULL').bind(tokenHash,member.id,product),
  env.DB.prepare('UPDATE skyline_purchases_v2 SET applied=1 WHERE token_hash=? AND member=? AND product=? AND applied=0').bind(tokenHash,member.id,product),
 ]);
 const saved=await env.DB.prepare('SELECT member,product,settlement FROM skyline_purchases_v2 WHERE token_hash=?').bind(tokenHash).first<{member:string;product:string;settlement:string}>();if(saved?.member!==member.id||saved?.product!==product)throw new Failure(409,'purchase_already_bound');
 if(saved.settlement==='revoked'||await env.DB.prepare('SELECT token_hash FROM skyline_refunds WHERE token_hash=?').bind(tokenHash).first())throw new Failure(409,'purchase_refunded');
 let settlement=saved.settlement;
 if(settlement!=='complete'){
  const done=grant.entitlement?purchase.acknowledgementState==='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED':valid.consumed;
  try{if(!done){const result=await send(base+'products/'+encodeURIComponent(product)+'/tokens/'+encodeURIComponent(token)+(grant.entitlement?':acknowledge':':consume'),{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});if(!result.ok)throw 0;}
   await env.DB.prepare("UPDATE skyline_purchases_v2 SET settlement='complete' WHERE token_hash=? AND settlement IN ('retry','complete')").bind(tokenHash).run();settlement='complete';
  }catch{settlement='retry';}
 }
 if(await env.DB.prepare('SELECT token_hash FROM skyline_refunds WHERE token_hash=?').bind(tokenHash).first())throw new Failure(409,'purchase_refunded');
 return json({status:'verified',settlement,...await snapshot(env.DB,member.id)});
 }catch(error){return json({error:error instanceof Failure?error.code:'billing_unavailable'},error instanceof Failure?error.status:503);}
}

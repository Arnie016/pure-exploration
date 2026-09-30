export const PORTAL_SLOT_COUNT=8;
export const PORTAL_RECYCLE_SECONDS=180;

/** A bounded set of doorways, with every catalog destination still reachable. */
export function portalBatch<T>(catalog:readonly T[],offset:number,capacity=PORTAL_SLOT_COUNT):T[]{
 const count=Math.min(catalog.length,Math.max(0,Math.floor(capacity)));
 return Array.from({length:count},(_,i)=>catalog[((offset+i)%catalog.length+catalog.length)%catalog.length]);
}

/** Visible time counts toward recycling; interaction defers a due batch swap. */
export function portalRecycleStep(elapsed:number,seconds:number,visible:boolean,engaged:boolean){
 const next=elapsed+(visible?Math.max(0,seconds):0);
 const recycle=visible&&!engaged&&next>=PORTAL_RECYCLE_SECONDS;
 return{elapsed:recycle?0:next,recycle};
}

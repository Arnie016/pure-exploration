// Paid inventory is a server snapshot, never a second local coin bank.
export const PAID_SUITS = Object.freeze([
  {id:'skyline_neon_suit', entitlement:'neon', name:'NEON', look:{outfit:'suit',mask:'full',eyes:'lenses',hood:'down',backpack:false,suit:'#172539',pants:'#101728',shoes:'#19d3b5',trim:'#3fe0ff',accent:'#3fe0ff',pattern:'circuit',emblem:'v'}},
  {id:'skyline_founder_bundle', entitlement:'founder', name:'FOUNDER', look:{outfit:'suit',mask:'full',eyes:'lenses',hood:'down',backpack:false,suit:'#513175',pants:'#251635',shoes:'#ffd84a',trim:'#ffd84a',accent:'#ff9a2e',pattern:'solid',emblem:'star'}},
]);
const suitIds = new Set(PAID_SUITS.map(s => s.entitlement));
export function verifiedSnapshot(event) {
  if (!event || typeof event.memberId !== 'string' || !event.memberId.trim() || !event.wallet || !Array.isArray(event.entitlements)) return null;
  const wallet = {};
  for (const item of ['coins','net','smoke']) {
    if (!Number.isSafeInteger(event.wallet[item]) || event.wallet[item] < 0) return null;
    wallet[item] = event.wallet[item];
  }
  return {memberId:event.memberId, paymentHold:event.paymentHold === true, wallet, entitlements:[...new Set(event.entitlements.filter(id => suitIds.has(id)))]};
}
export class PaidInventory {
  constructor(host) {
    this.host = host;
    this.snapshot = null;
    this.selectedSuit = null;
    this.pending = null;
    this.message = '';
    this.listeners = new Set();
    this.completed = new Set();
    this.recovered = new Map();
    this.readyEffects = new Map();
    this.effectHandler = null;
    this.journal = null;
    host?.addEventListener('skyline:billing', ({detail}) => this.receive(detail));
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) fn(this); }
  count(item) { return this.snapshot?.wallet[item] || 0; }
  suit() { return PAID_SUITS.find(s => s.id === this.selectedSuit && this.snapshot?.entitlements.includes(s.entitlement)); }
  wear(id) {
    if (!PAID_SUITS.some(s => s.id === id && this.snapshot?.entitlements.includes(s.entitlement))) return false;
    this.selectedSuit = id; this.notify(); return true;
  }
  clearSuit() { this.selectedSuit = null; }
  refresh() { try { this.host?.SkylineBilling?.getEntitlements?.(); this.host?.SkylineBilling?.getPendingInventory?.(); } catch { this.message = 'Purchase wallet unavailable. Retry when connected.'; this.notify(); } }
  receive(event) {
    if (event?.type === 'ready') { this.refresh(); return; }
    if (event?.type === 'accountStatus' && event.status === 'not_connected') {
      this.host.clearTimeout(this.timer);
      this.snapshot = null; this.selectedSuit = null; this.pending = null; this.journal = null;
      this.recovered.clear(); this.readyEffects.clear(); this.completed.clear();
      this.message = 'No purchase account yet.'; this.notify(); return;
    }
    if (event?.type === 'inventoryPending') {
      if (typeof event.memberId !== 'string' || !Array.isArray(event.requests)) return;
      this.journal = event; this.hydrate(); return;
    }
    if (event?.type === 'effectAcknowledged') {
      if (this.completed.has(event.requestId)) { this.readyEffects.delete(event.requestId); this.notify(); }
      return;
    }
    const transaction = event?.type === 'spent' || event?.type === 'bought';
    if (transaction) {
      if (!this.pending || event.requestId !== this.pending.id || event.item !== this.pending.item || event.type !== (this.pending.method === 'spendPaidItem' ? 'spent' : 'bought') || this.completed.has(event.requestId)) return;
    } else if (!['entitlements','purchase','restored'].includes(event?.type) || (event.type !== 'entitlements' && event.status !== 'verified')) {
      if (event?.type === 'error' && this.pending && event.requestId === this.pending.id) {
        this.host.clearTimeout(this.timer); this.pending.retry = true;
        this.message = 'Wallet request was not confirmed. Retry the same request to check it safely.'; this.notify();
      }
      return;
    }
    const next = verifiedSnapshot(event);
    if (!next || (transaction && this.snapshot && next.memberId !== this.snapshot.memberId)) return;
    if (this.snapshot && next.memberId !== this.snapshot.memberId) {
      this.selectedSuit = null;
      this.host.clearTimeout(this.timer);
      this.pending = null;
      this.recovered.clear(); this.readyEffects.clear(); this.completed.clear();
    }
    this.snapshot = next;
    if (next.paymentHold) {
      this.host.clearTimeout(this.timer);
      this.pending = null; this.recovered.clear(); this.readyEffects.clear();
      this.message = 'Purchase wallet paused for refund review. You can still play and use earned coins.';
      if (this.selectedSuit && !next.entitlements.includes(this.suit()?.entitlement)) this.selectedSuit = null;
      this.notify(); return;
    }
    this.message = '';
    if (this.selectedSuit && !PAID_SUITS.some(s => s.id === this.selectedSuit && next.entitlements.includes(s.entitlement))) this.selectedSuit = null;
    if (transaction && this.pending) {
      const request = this.pending;
      this.host.clearTimeout(this.timer); this.pending = null;
      this.recovered.delete(request.id);
      if (event.type === 'spent') this.readyEffects.set(request.id, request);
      else this.completed.add(request.id);
      this.message = event.type === 'spent' ? 'Purchase gadget ready.' : 'Gadget added to your purchase wallet.';
      this.notify(); this.deliverReady(); this.hydrate(); return;
    }
    this.hydrate(); this.notify();
  }
  // The encrypted native journal owns restart recovery. JavaScript stores no paid bank.
  hydrate() {
    if (!this.snapshot || this.snapshot.paymentHold || this.journal?.memberId !== this.snapshot.memberId) return;
    for (const saved of this.journal.requests) {
      if (!saved || typeof saved.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(saved.requestId) || !['net','smoke'].includes(saved.item) || !['spend','buy'].includes(saved.action)) continue;
      if (this.completed.has(saved.requestId)) {
        if (saved.action === 'spend') { try { this.host?.SkylineBilling?.acknowledgePaidEffect?.(saved.requestId); } catch { /* Retry acknowledgment on the next wallet refresh. */ } }
        continue;
      }
      if (this.readyEffects.has(saved.requestId) || this.pending?.id === saved.requestId) continue;
      this.recovered.set(saved.requestId, {id:saved.requestId,item:saved.item,method:saved.action === 'spend' ? 'spendPaidItem' : 'buyPaidItem',retry:false});
    }
    if (!this.pending && this.recovered.size) {
      this.pending = this.recovered.values().next().value;
      // Even a locally confirmed entry is rechecked against the server before use.
      this.send();
    }
  }
  setEffectHandler(fn) { this.effectHandler = fn; this.deliverReady(); }
  deliverReady() {
    if (!this.snapshot || this.snapshot.paymentHold) return;
    for (const request of this.readyEffects.values()) {
      if (this.completed.has(request.id)) continue;
      let applied = false;
      try { applied = (request.effect || this.effectHandler)?.(request.item, request.id) === true; } catch { /* Keep native delivery unacknowledged for recovery. */ }
      if (!applied) continue;
      this.completed.add(request.id);
      try { this.host?.SkylineBilling?.acknowledgePaidEffect?.(request.id); } catch { /* Never repeat an applied effect in this session. */ }
    }
  }
  transact(method, item, effect) {
    if (!['net','smoke'].includes(item) || this.pending || this.readyEffects.size || !this.snapshot || this.snapshot.paymentHold || typeof this.host?.SkylineBilling?.[method] !== 'function') return false;
    if (method === 'spendPaidItem' && !this.count(item)) return false;
    if (method === 'buyPaidItem' && this.count('coins') < (item === 'net' ? 200 : 150)) return false;
    const id = this.host.crypto?.randomUUID?.() || `wallet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.pending = {id,item,method,effect,retry:false}; this.send(); return true;
  }
  send() {
    const request = this.pending;
    if (!request) return;
    request.retry = false; this.message = 'Checking your purchase wallet…';
    this.host.clearTimeout(this.timer);
    this.timer = this.host.setTimeout(() => {
      if (this.pending === request) { request.retry = true; this.message = 'Wallet is taking longer. Retry checks the same request; it does not spend twice.'; this.notify(); }
    }, 15000);
    try { this.host.SkylineBilling[request.method](request.item, request.id); }
    catch { this.host.clearTimeout(this.timer); request.retry = true; this.message = 'Purchase wallet unavailable. Retry when connected.'; }
    this.notify();
  }
  retry() { if (this.pending?.retry) this.send(); }
  spend(item,effect) { return this.transact('spendPaidItem',item,effect); }
  buy(item) { return this.transact('buyPaidItem',item); }
}
export const paidInventory = new PaidInventory(typeof window === 'undefined' ? null : window);

import { paidInventory, PAID_SUITS } from './paid-inventory.js';
import { suitPreview } from './suit-preview.js';
// Google Play offers are separate from the earned-coin shop. This UI never grants items.
export const PLAY_OFFERS = Object.freeze([
  { id: 'skyline_neon_suit', name: 'NEON SUIT', desc: 'A luminous cosmetic suit.' },
  { id: 'skyline_founder_bundle', name: 'FOUNDER BUNDLE', desc: 'Founder suit, 1,500 paid coins, 3 nets and 3 smoke gadgets.' },
  { id: 'skyline_coins_1500', name: '1,500 COINS', desc: '1,500 paid coins in your purchase wallet.' },
  { id: 'skyline_gadget_pack', name: 'GADGET PACK', desc: '3 nets and 3 smoke gadgets in your purchase wallet.' },
]);
const offerIds = new Set(PLAY_OFFERS.map((offer) => offer.id));
const HOLD_MESSAGE = 'Purchase wallet paused for refund review. You can still play and use earned coins.';

export function initialPlayShopState(nativeAvailable) {
  return { prices: {}, paymentsEnabled: false, paymentHold: false, busy: false, accountStatus: nativeAvailable ? 'unknown' : 'not_available', message: nativeAvailable
    ? 'Purchases are not open yet. Play and earn coins for free.'
    : 'Google Play purchases are available only in the Android app. Everything in the coin shop is earned by playing.' };
}

// Keep only display fields. Purchase tokens must never enter UI state, logs or save data.
export function applyBillingEvent(state, event) {
  if (!event || typeof event !== 'object') return state;
  if (event.type === 'accountStatus' && event.status === 'not_connected') {
    return { ...state, busy: false, accountStatus: 'not_connected', paymentHold: false, wallet: undefined, entitlements: [],
      message: state.paymentsEnabled ? 'No purchase account yet.' : 'Purchases are not open yet. Play and earn coins for free.' };
  }
  if (event.type === 'products') {
    const prices = {};
    for (const product of Array.isArray(event.products) ? event.products : []) {
      if (product && offerIds.has(product.id) && typeof product.formattedPrice === 'string' && product.formattedPrice.length <= 80) {
        prices[product.id] = product.formattedPrice;
      }
    }
    const paymentsEnabled = event.paymentsEnabled === true;
    return { ...state, prices, paymentsEnabled, busy: false, message: state.paymentHold === true ? HOLD_MESSAGE : paymentsEnabled
      ? Object.keys(prices).length ? 'One-time purchases through Google Play. Coins can still be earned for free.' : 'No Google Play offers are available on this installation.'
      : 'Purchases are not open yet. Play and earn coins for free.' };
  }
  if (event.type === 'entitlements' || ((event.type === 'purchase' || event.type === 'restored') && event.status === 'verified')) {
    if (event.type !== 'entitlements' && !offerIds.has(event.productId)) return state;
    if (typeof event.memberId !== 'string' || !event.memberId.trim() || !event.wallet || !Array.isArray(event.entitlements)) return { ...state, busy: false, message: 'Purchase details could not be verified. No items have been added.' };
    const wallet = {};
    for (const key of ['coins', 'net', 'smoke']) {
      if (!Number.isSafeInteger(event.wallet[key]) || event.wallet[key] < 0) return { ...state, busy: false, message: 'Purchase details could not be verified. No items have been added.' };
      wallet[key] = event.wallet[key];
    }
    // Display the server snapshot separately; never mint these into the local earned bank.
    return { ...state, busy: false, accountStatus: 'connected', paymentHold: event.paymentHold === true, wallet, entitlements: event.entitlements.filter(v => typeof v === 'string'),
      message: event.paymentHold === true ? HOLD_MESSAGE : event.settlement === 'retry' ? 'Your items are secured. Restore purchases to finish syncing with Google Play.' : 'Your purchase wallet is synced.' };
  }
  if (event.type === 'purchase' || event.type === 'restored') {
    if (event.type === 'restored' && Array.isArray(event.purchases) && event.purchases.length === 0) {
      return { ...state, busy: false, message: 'No purchases were found for this Google Play account.' };
    }
    if (!offerIds.has(event.productId)) return state;
    return { ...state, busy: false, message: event.status === 'pending'
      ? 'Payment is pending in Google Play. No items have been added.'
      : 'Google Play found a purchase. Verification is not available yet; no items have been added.' };
  }
  if (event.type === 'error') {
    // The bridge provides a user-facing error, never a purchase token.
    return { ...state, busy: false, message: typeof event.message === 'string'
      ? event.message.slice(0, 240) : 'Google Play could not complete that request. Please try again.' };
  }
  return state;
}

// Wallet/account refreshes can arrive while the Google Play sheet is open.
// They update display data but cannot unlock another checkout attempt.
export function applyShopRequestEvent(state, event) {
  const next = applyBillingEvent(state, event);
  if (next === state || !state.busy || !state.request) return next;
  const { method, id } = state.request;
  const completes = (event.type === 'error' && !event.requestId)
    || (method === 'getProducts' && event.type === 'products')
    || (method === 'restorePurchases' && event.type === 'restored')
    || (method === 'purchase' && event.type === 'purchase' && event.productId === id);
  return completes ? { ...next, request: undefined }
    : { ...next, busy: true, request: state.request, message: state.message };
}

export function timeoutShopRequest(state) {
  // The payment sheet can legitimately remain open longer than a network query.
  if (state.request?.method === 'purchase') return { ...state, message: 'Waiting for Google Play. Finish or cancel checkout to continue.' };
  return { ...state, busy: false, request: undefined, message: 'Google Play has not responded yet. You can retry.' };
}

export function canPurchase(state, id) {
  return state.paymentsEnabled === true && state.paymentHold !== true && !state.busy && offerIds.has(id) && Object.hasOwn(state.prices, id);
}

export function mountPlayShop(doc = document, host = window) {
  const panel = doc.querySelector('#shop .shop-panel');
  if (!panel || doc.getElementById('play-shop')) return;
  const native = () => host.SkylineBilling;
  let state = initialPlayShopState(!!native());
  let requestTimer;
  const section = doc.createElement('section');
  section.id = 'play-shop';
  section.className = 'play-shop';
  const heading = doc.createElement('h3');
  heading.textContent = 'GOOGLE PLAY EXTRAS';
  section.append(heading);
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  section.append(status);
  const cards = doc.createElement('div');
  cards.className = 'play-shop-offers';
  const purchaseButtons = new Map();
  for (const offer of PLAY_OFFERS) {
    const card = doc.createElement('div');
    card.className = 'play-shop-offer';
    const name = doc.createElement('b'); name.textContent = offer.name;
    const description = doc.createElement('span'); description.textContent = offer.desc;
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'buy';
    button.addEventListener('click', () => {
      if (canPurchase({ ...state, paymentHold: state.paymentHold === true || paidInventory.snapshot?.paymentHold === true }, offer.id)) request('purchase', offer.id);
    });
    purchaseButtons.set(offer.id, button);
    card.append(name, description, button); cards.append(card);
  }
  section.append(cards);
  const actions = doc.createElement('div'); actions.className = 'play-shop-actions';
  const refresh = doc.createElement('button'); refresh.type = 'button'; refresh.className = 'btn'; refresh.textContent = 'REFRESH OFFERS';
  const restore = doc.createElement('button'); restore.type = 'button'; restore.className = 'btn'; restore.textContent = 'RESTORE PURCHASES';
  refresh.addEventListener('click', () => request('getProducts'));
  restore.addEventListener('click', () => request('restorePurchases'));
  const account = doc.createElement('button'); account.type = 'button'; account.className = 'btn'; account.textContent = 'PURCHASE ACCOUNT';
  account.addEventListener('click', () => native()?.showPurchaseAccount?.());
  actions.append(refresh, restore, account); section.append(actions);
  const walletSection = doc.createElement('section'); walletSection.className = 'paid-wallet';
  const walletHeading = doc.createElement('h3'); walletHeading.textContent = 'YOUR PURCHASE WALLET';
  const walletStatus = doc.createElement('p'); walletStatus.setAttribute('role','status'); walletStatus.setAttribute('aria-live','polite');
  const walletActions = doc.createElement('div'); walletActions.className = 'play-shop-actions';
  const walletRefresh = doc.createElement('button'); walletRefresh.className = 'btn'; walletRefresh.textContent = 'SYNC WALLET';
  walletRefresh.addEventListener('click', () => paidInventory.refresh());
  const walletRetry = doc.createElement('button'); walletRetry.className = 'btn'; walletRetry.textContent = 'RETRY WALLET REQUEST';
  walletRetry.addEventListener('click', () => paidInventory.retry());
  walletActions.append(walletRefresh,walletRetry);
  const walletItems = doc.createElement('div'); walletItems.className = 'play-shop-offers';
  const walletButtons = new Map();
  for (const [item,name,cost] of [['net','WEB NET',200],['smoke','SMOKE',150]]) {
    const button = doc.createElement('button'); button.className = 'btn'; button.textContent = `${name} · ${cost} PAID COINS`;
    button.addEventListener('click', () => paidInventory.buy(item)); walletButtons.set(item,button); walletItems.append(button);
  }
  const suitItems = doc.createElement('div'); suitItems.className = 'paid-suits';
  const suitButtons = new Map();
  for (const suit of PAID_SUITS) {
    const button = doc.createElement('button'); button.className = 'suit-card'; button.innerHTML = suitPreview(suit);
    const label = doc.createElement('b'); label.textContent = `${suit.name} · WEAR`; button.append(label);
    button.addEventListener('click', () => paidInventory.wear(suit.id)); suitItems.append(button); suitButtons.set(suit.id,button);
  }
  walletSection.append(walletHeading,walletStatus,walletItems,suitItems,walletActions); section.append(walletSection);
  paidInventory.subscribe(render);
  panel.insertBefore(section, panel.querySelector('.studio-actions'));
  const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./play-shop.css', import.meta.url).href;
  doc.head.append(css);

  function render() {
    const paymentHold = state.paymentHold === true || paidInventory.snapshot?.paymentHold === true;
    status.textContent = paymentHold ? HOLD_MESSAGE : state.message + (state.wallet && !state.paymentsEnabled ? ' Purchases are not open yet.' : '');
    for (const [id, button] of purchaseButtons) {
      const available = canPurchase({ ...state, paymentHold }, id);
      button.disabled = !available;
      button.textContent = state.prices[id] ? `${state.prices[id]}${state.paymentsEnabled ? '' : ' · NOT OPEN'}` : 'UNAVAILABLE';
      button.setAttribute('aria-label', `${PLAY_OFFERS.find((offer) => offer.id === id).name}: ${button.textContent}`);
    }
    refresh.disabled = restore.disabled = !native() || state.busy;
    account.disabled = typeof native()?.showPurchaseAccount !== 'function';
    walletSection.hidden = !native();
    const wallet = state.accountStatus === 'not_connected' ? null : paidInventory.snapshot?.wallet;
    walletStatus.textContent = paymentHold ? HOLD_MESSAGE : wallet
      ? `${wallet.coins} paid coins · ${wallet.net} nets · ${wallet.smoke} smoke. ${paidInventory.message || 'Separate from the coins you earn.'}`
      : state.accountStatus === 'not_connected' ? 'No purchase account yet.' : 'No purchase wallet is synced. Restore a purchase account, then sync your wallet.';
    walletRefresh.disabled = typeof native()?.getEntitlements !== 'function' || !!paidInventory.pending;
    walletRetry.hidden = !paidInventory.pending?.retry;
    for (const [item,button] of walletButtons) button.disabled = paymentHold || !wallet || !!paidInventory.pending || wallet.coins < (item === 'net' ? 200 : 150) || typeof native()?.buyPaidItem !== 'function';
    for (const suit of PAID_SUITS) {
      const button = suitButtons.get(suit.id);
      button.disabled = paymentHold;
      button.hidden = !wallet || !paidInventory.snapshot?.entitlements.includes(suit.entitlement);
      button.classList.toggle('on', paidInventory.selectedSuit === suit.id);
      button.querySelector('b').textContent = `${suit.name} · ${paidInventory.selectedSuit === suit.id ? 'WEARING' : 'WEAR'}`;
    }
  }
  function request(method, id) {
    if (state.busy || typeof native()?.[method] !== 'function') return;
    state = { ...state, busy: true, request: { method, id }, message: method === 'purchase' ? 'Opening Google Play…' : method === 'restorePurchases' ? 'Checking your Google Play purchases…' : 'Checking Google Play offers…' };
    render();
    host.clearTimeout(requestTimer);
    requestTimer = host.setTimeout(() => {
      state = timeoutShopRequest(state); render();
    }, 15000);
    try { id === undefined ? native()[method]() : native()[method](id); }
    catch { host.clearTimeout(requestTimer); state = { ...state, busy: false, request: undefined, message: 'Google Play is unavailable. Play and earn coins for free.' }; render(); }
  }
  host.addEventListener('skyline:billing', ({ detail }) => {
    if (detail?.type === 'ready') { if (!doc.getElementById('shop').classList.contains('hidden')) { request('getProducts'); paidInventory.refresh(); } return; }
    const next = applyShopRequestEvent(state, detail);
    if (next !== state) { if (!next.busy) host.clearTimeout(requestTimer); state = next; render(); }
  });
  const observer = new MutationObserver(() => {
    if (!doc.getElementById('shop').classList.contains('hidden')) { request('getProducts'); paidInventory.refresh(); }
  });
  observer.observe(doc.getElementById('shop'), { attributes: true, attributeFilter: ['class'] });
  render();
}

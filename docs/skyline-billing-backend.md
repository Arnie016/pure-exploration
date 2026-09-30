# Skyline Play Billing backend — sandbox preparation

No real payment has been verified and no billing environment was enabled by this change. The Skyline route and flat migrations 0003/0004 are mounted/registered in the **local source**; this does not establish deployment. Root previously verified the remote public D1 database had no Skyline tables. Refund migrations `drizzle/0005_skyline_refunds.sql` and `drizzle/0006_skyline_partial_refunds.sql` are registered in the local migration journal; hosted application remains unverified. All SQL statements are complete and trigger-free. Transactional D1 batches commit ledger admission, inventory updates and applied markers together or roll back together. Versioned ledger tables preserve the prior failed-deployment boundary.

Server environment (secrets must be installed via native secret tooling, never client source):
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` (PKCS8 PEM)
- `SKYLINE_PAYMENTS_ENABLED=sandbox` — any other value disables verification/grants. Even with sandbox enabled, only Google's `testPurchaseContext.fopType=TEST` is accepted. No live-mode switch exists in this implementation.

## Native contract

- POST `/api/skyline/account` body `{}` creates a random member and returns `{memberId,sessionToken,recoveryToken}`. Save both tokens in encrypted native storage; never expose them to the game WebView. Only SHA-256 token hashes are stored server-side.
- POST `/api/skyline/recover` body `{memberId,recoveryToken}` rotates both tokens atomically and revokes the old session. A recovery token is a full recovery credential. It must be kept privately and cannot be replaced by an email address without a separate verified recovery mechanism.
- Other routes require `Authorization: Bearer sessionToken`.
- GET `/api/skyline/entitlements` returns `{memberId,entitlements:["neon","founder"],wallet:{coins,net,smoke}}` as applicable.
- POST `/api/skyline/verify` body `{productId,purchaseToken}` verifies against Google for the fixed package `dev.arnav.skylineswing`, requiring the member ID match `obfuscatedExternalAccountId`. Native must set `BillingFlowParams.setObfuscatedAccountId(memberId)` before purchase. Returns `{status:"pending"|"verified",memberId,entitlements,wallet,settlement?}`. `pending` grants nothing. Verified purchases use `settlement:"complete"|"retry"`.
- POST `/api/skyline/buy` body `{item:"net"|"smoke",requestId}` buys exactly one paid gadget with paid coins. Prices are fixed server-side: net 200 coins, smoke 150 coins, matching the canonical earned shop. Any client `price`, `cost`, `quantity`, or other extra field is rejected. Reuse the request ID on retry; a different item under the same ID is rejected. Transactional D1 batches debit coins and credit the gadget together, preventing duplicate fulfillment or overdraw even under concurrent requests. Returns the complete authoritative wallet and entitlement snapshot. Buy and use request IDs are separate operation namespaces.
- POST `/api/skyline/spend` body `{item:"net"|"smoke",requestId}` consumes one paid gadget. requestId must be a random 16–64-character identifier, reused when retrying the same spend. Reusing it for a different item is rejected. Balance-guarded ledger insertion and transactional batches reject overspending; never decrement only a client copy.

The four allowlisted products are `skyline_neon_suit` (neon), `skyline_founder_bundle` (founder, 1500 paid coins, 3 nets and 3 smoke once), `skyline_coins_1500` (1500 paid coins), and `skyline_gadget_pack` (3 nets and 3 smoke). Paid coins remain separate from earned local currency. Paid coins buy net/smoke through the fixed catalogue above; clients cannot pick arbitrary prices or grant quantities. Additional gadget and upgrade products are not enabled. Both `/buy` and `/spend` require the sandbox environment flag; no live economy is enabled.

## Settlement and operating boundaries

Grant precedes consume/acknowledge; the database is committed before the external call. If Google settlement fails, the grant remains once and `retry` directs native to resubmit the same purchase token on restore/relaunch. Raw Play tokens are never stored in D1 or returned in JSON. They are sent only to Google in the required API path. Avoid HTTP request-body or outbound-URL logging in infrastructure. No response exposes Google error details or service credentials.

Native must durably queue tokens until settlement completes. There is no server background settlement retry because raw tokens are not retained; if native loses the unconsumed token before retry, settlement cannot complete automatically. Purchases already consumed elsewhere with no local ledger entry are rejected instead of credited again.

Production is not ready: real license-tester purchase/restore/settlement, device identity/recovery, verification rate limiting and account provisioning abuse review, RTDN and real-service refund reconciliation/revocation validation, expanded paid-coin spending catalogue if additional items are offered, and bounded settlement recovery monitoring are outstanding. Test grants must not migrate into a live economy. Account creation is limited to 60/hour and recovery 20/hour per rotating hash of Cloudflare-provided network address. Missing addresses share a fallback bucket. This is a basic abuse gate, not device attestation or a distributed bot defense. No Play Integrity assertion is currently required; possession of a matching Google-verified test purchase plus authenticated member is required for every grant.

## Verification

`node --test tests/skyline-billing.test.mjs` runs real SQLite transaction batches with mocked Google transport and synthetic generated RSA credentials. It covers hashed identity/recovery, auth/disabled gate, pending/cancelled, non-test/account/product/refund mismatch, token replay and concurrent calls, failed settlement/retry, consumed-token rejection, founder exactly once, gadget spend replay/overspend, concurrent paid coin buys, exactly-once buy retries, and rejection of client price/quantity overrides. This is local fixture proof, not real Google purchase proof.

Primary references checked September 30, 2026:
- https://developer.android.com/google/play/billing/security
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/acknowledge
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/consume

### Native integration checkpoint
Android version 1.0.1 (2) compiles a Keystore AES-GCM identity/receipt retry store and native HTTPS verification. It retries saved receipts on page readiness and explicit restore, removing a receipt only after server settlement is complete. These are implementation/build facts; interrupted-device retry is not yet tested. User recovery export/import UI, full paid inventory use and refund reconciliation remain required before payments open.

## Hosting migration hold

The earlier deployed migration runner rejected trigger bodies with `incomplete input: SQLITE_ERROR`. Trigger-free migrations 0003/0004 and the Skyline API route were subsequently registered/mounted in local source. Root's remote database inspection reported no Skyline tables. Versioned purchase/spend/buy ledgers (`*_v2`) preserve this history without inventing deployed payment proof. The new refund migration 0005 requires root registration before deployment. This is local preparation, not a deployed payment service.

`SKYLINE_TEST_D1=1 node --test tests/skyline-billing.test.mjs` passed 18 tests, including the installed Miniflare/workerd local D1 binding. The local runtime supports compatibility date 2026-05-22 (a later date failed before startup and was corrected to its supported date). Real local D1 verifies semicolon-split schema installation and concurrent exactly-once purchase credit, gadget buys and uses. Injected batch failures test rollback after ledger admission and inventory updates; Google settlement retry remains separate and cannot double-grant. This does not prove hosted Sites migration/deployment or Google license-tester settlement.

D1 transaction behavior reference: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

### Local integration checkpoint
Flat SQL migrations are now registered under drizzle and the /api/skyline/ router mounted locally. This does not mean they are deployed. Current remote database inventory has no skyline tables. Latest local proof: 18 tests, including workerd/Miniflare D1 concurrency and rollback. Payments remain closed.


## Bounded owner refund reconciliation — local only

POST `/api/skyline/reconcile` accepts `Authorization: Bearer <existing owner key>` checked against `OWNER_KEY_HASH`, using the existing owner-key convention. Member credentials cannot invoke it. This route does not use or disclose member recovery keys. It remains disabled unless the sandbox flag is explicitly configured; no Google request, owner credentials, webhook, schedule or deployment was performed during implementation.

Body may contain integer `startTimeMillis` and `endTimeMillis`; default is the preceding 29 days. The window must fit within the last 30 days and end no later than now. One authorized call performs at most three Google pages of 100 entries, type=0 (one-time products), with quantity-based partial refunds included. It returns counts `{reviewed,revoked,unknown,partialHeld,complete}` only, without purchase tokens, member IDs, order IDs or pagination tokens. `complete:false` means the bounded window was not fully covered; narrower windows and an operational coverage mechanism are needed. This is not an autonomous full-history reconciliation service.

A SHA-256 tombstone is retained for every returned token, including unknown tokens. Tombstones prevent delayed/stale successful Google verification from granting a refunded token. Known purchases are revoked in a transactional D1 batch: remaining credited resources are clawed back, associated permanent suit removed, settlement marked revoked and the refund marked applied. Replay does not repeat the deduction. A settlement retry cannot overwrite revoked status. A fresh nonconsumable token may restore the same suit after an unspent full refund; the active-entitlement index excludes revoked tokens. Replayed older refunds cannot remove this new grant because the old refund marker is already applied.

**Spent-credit policy:** balances never become negative. Any unavailable resource shortfall is recorded as resource-specific debt in the refund row. The member's paid buy/use/new-purchase verification is held for owner review; free gameplay and earned local currency remain available. These shortfalls are not money owed or a charge authorization, and no automatic billing occurs. Owner review/appeal and debt resolution are not implemented. A conservative hold also prevents use of gadgets converted from refunded paid coins. Multiple resource deficits should not be interpreted as a monetary debt sum.

**Quantity-based partial refund policy:** the entire token's grant is conservatively revoked and the member held for review when `voidedQuantity` is supplied. `partialHeld` counts partial refund entries reviewed, including replay entries, rather than newly created holds. Proportional quantity attribution/reinstatement is not implemented. This conservative sandbox policy must be replaced or reviewed before real multi-quantity sales; it does not claim production-ready partial refunds.

Each entry is committed atomically; valid earlier entries can remain committed if a later Google page/entry fails. Repeating the bounded window is safe for tested token-level replays. Pagination coverage, Google response validation, owner secret rotation/operational audit, real chargeback/refund fixtures and refund appeal remain real-service proof boundaries. Existing RTDN integration is still absent.

Verification: `SKYLINE_TEST_D1=1 node --test tests/skyline-billing.test.mjs` tests actual local D1 concurrent refunds and existing credit/buy/use paths, plus SQLite fixture tests for permanent revocation, spent shortfalls, token replay, tombstones, delayed verification races, unauthorized requests, disabled gates and injected rollback. These tests use synthetic credentials and mocked Google transport; no real purchase/refund was claimed.

Primary reference: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases (VoidedPurchase fields, including optional voidedQuantity).

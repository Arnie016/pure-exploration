# Skyline Play Billing backend — sandbox preparation

No real payment has been verified and no billing environment was enabled by this change. Apply `drizzle/0003_skyline_billing.sql` and `drizzle/0004_skyline_coin_shop.sql` before invoking these routes. The migration uses atomic SQLite triggers: an inserted purchase credits the wallet and entitlement together, while the purchase-token hash primary key prevents double credit. A unique member/entitlement index prevents repeat founder bonuses under another purchase token.

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
- POST `/api/skyline/buy` body `{item:"net"|"smoke",requestId}` buys exactly one paid gadget with paid coins. Prices are fixed server-side: net 200 coins, smoke 150 coins, matching the canonical earned shop. Any client `price`, `cost`, `quantity`, or other extra field is rejected. Reuse the request ID on retry; a different item under the same ID is rejected. Atomic SQLite triggers debit coins and credit the gadget together, preventing duplicate fulfillment or overdraw even under concurrent requests. Returns the complete authoritative wallet and entitlement snapshot. Buy and use request IDs are separate operation namespaces.
- POST `/api/skyline/spend` body `{item:"net"|"smoke",requestId}` consumes one paid gadget. requestId must be a random 16–64-character identifier, reused when retrying the same spend. Reusing it for a different item is rejected. Atomic triggers reject overspending; never decrement only a client copy.

The four allowlisted products are `skyline_neon_suit` (neon), `skyline_founder_bundle` (founder, 1500 paid coins, 3 nets and 3 smoke once), `skyline_coins_1500` (1500 paid coins), and `skyline_gadget_pack` (3 nets and 3 smoke). Paid coins remain separate from earned local currency. Paid coins buy net/smoke through the fixed catalogue above; clients cannot pick arbitrary prices or grant quantities. Additional gadget and upgrade products are not enabled. Both `/buy` and `/spend` require the sandbox environment flag; no live economy is enabled.

## Settlement and operating boundaries

Grant precedes consume/acknowledge; the database is committed before the external call. If Google settlement fails, the grant remains once and `retry` directs native to resubmit the same purchase token on restore/relaunch. Raw Play tokens are never stored in D1 or returned in JSON. They are sent only to Google in the required API path. Avoid HTTP request-body or outbound-URL logging in infrastructure. No response exposes Google error details or service credentials.

Native must durably queue tokens until settlement completes. There is no server background settlement retry because raw tokens are not retained; if native loses the unconsumed token before retry, settlement cannot complete automatically. Purchases already consumed elsewhere with no local ledger entry are rejected instead of credited again.

Production is not ready: real license-tester purchase/restore/settlement, device identity/recovery, verification rate limiting and account provisioning abuse review, RTDN/voided-purchase refund reconciliation and entitlement revocation, expanded paid-coin spending catalogue if additional items are offered, and bounded settlement recovery monitoring are outstanding. Test grants must not migrate into a live economy. Account creation is limited to 60/hour and recovery 20/hour per rotating hash of Cloudflare-provided network address. Missing addresses share a fallback bucket. This is a basic abuse gate, not device attestation or a distributed bot defense. No Play Integrity assertion is currently required; possession of a matching Google-verified test purchase plus authenticated member is required for every grant.

## Verification

`node --test tests/skyline-billing.test.mjs` runs real SQLite transactions/triggers with mocked Google transport and synthetic generated RSA credentials. It covers hashed identity/recovery, auth/disabled gate, pending/cancelled, non-test/account/product/refund mismatch, token replay and concurrent calls, failed settlement/retry, consumed-token rejection, founder exactly once, gadget spend replay/overspend, concurrent paid coin buys, exactly-once buy retries, and rejection of client price/quantity overrides. This is local fixture proof, not real Google purchase proof.

Primary references checked September 30, 2026:
- https://developer.android.com/google/play/billing/security
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/acknowledge
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/consume

### Native integration checkpoint
Android version 1.0.1 (2) compiles a Keystore AES-GCM identity/receipt retry store and native HTTPS verification. It retries saved receipts on page readiness and explicit restore, removing a receipt only after server settlement is complete. These are implementation/build facts; interrupted-device retry is not yet tested. User recovery export/import UI, full paid inventory use and refund reconciliation remain required before payments open.

## Hosting migration hold

The deployed migration runner rejected trigger bodies with `incomplete input: SQLITE_ERROR`. SQL is retained under docs/pending-migrations for local tests. Skyline API routing and migration registration are excluded from the map release. This backend is local preparation, not a deployed payment service.

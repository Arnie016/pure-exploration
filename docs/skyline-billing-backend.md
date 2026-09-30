# Skyline Play Billing backend — isolated local production path

No real payment has been verified and no billing environment was enabled by this change. The Skyline route and flat migrations 0003/0004 are mounted/registered in the **local source**; this does not establish deployment. Earlier inspection found no Skyline tables. A fresh Sites database overview on 2026-09-30 now confirms the live DB has the Skyline member, wallet, entitlement, purchase, spend, coin-buy, refund and hold tables. Refund migrations `drizzle/0005_skyline_refunds.sql` and `drizzle/0006_skyline_partial_refunds.sql` are registered in the local migration journal; Hosted schema presence is now verified; actual Google purchase fulfillment remains unverified. All SQL statements are complete and trigger-free. Transactional D1 batches commit ledger admission, inventory updates and applied markers together or roll back together. Versioned ledger tables preserve the prior failed-deployment boundary.

Server environment (secrets must be installed via native secret tooling, never client source):
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` (PKCS8 PEM)
- `SKYLINE_BILLING_ENVIRONMENT` selects the billing ledger: unset or `sandbox` retains the existing sandbox tables; `production` selects the separate `skyline_production_*` tables in the same `DB` binding. Any other value fails closed. Migration `0011_skyline_production_billing.sql` creates the complete empty production schema and indexes; it copies no sandbox accounts, credentials, balances or receipts.
- `SKYLINE_PAYMENTS_ENABLED` must equal the selected environment to allow verification/grants, paid buying/spending or reconciliation. Unset keeps payments closed while account reads, recovery and deletion remain available in the selected ledger. Unknown or mismatched nonempty values fail closed before database access.
- Sandbox only accepts Google's `testPurchaseContext.fopType=TEST`; production only accepts absence of the `testPurchaseContext` field. Present null, malformed or test context is rejected in production. The same rule validates partial-refund quantity proof.

## Native contract

- POST `/api/skyline/account` body `{}` creates a random member and returns `{memberId,sessionToken,recoveryToken}`. Save both tokens in encrypted native storage; never expose them to the game WebView. Only SHA-256 token hashes are stored server-side.
- POST `/api/skyline/recover` body `{memberId,recoveryToken}` rotates both tokens atomically and revokes the old session. A recovery token is a full recovery credential. It must be kept privately and cannot be replaced by an email address without a separate verified recovery mechanism.
- Other routes require `Authorization: Bearer sessionToken`.
- GET `/api/skyline/entitlements` returns `{memberId,entitlements:["neon","founder"],wallet:{coins,net,smoke}}` as applicable.
- POST `/api/skyline/verify` body `{productId,purchaseToken}` verifies against Google for the fixed package `dev.arnav.skylineswing`, requiring the member ID match `obfuscatedExternalAccountId`. Native must set `BillingFlowParams.setObfuscatedAccountId(memberId)` before purchase. Returns `{status:"pending"|"verified",memberId,entitlements,wallet,settlement?}`. `pending` grants nothing. Verified purchases use `settlement:"complete"|"retry"`.
- POST `/api/skyline/buy` body `{item:"net"|"smoke",requestId}` buys exactly one paid gadget with paid coins. Prices are fixed server-side: net 200 coins, smoke 150 coins, matching the canonical earned shop. Any client `price`, `cost`, `quantity`, or other extra field is rejected. Reuse the request ID on retry; a different item under the same ID is rejected. Transactional D1 batches debit coins and credit the gadget together, preventing duplicate fulfillment or overdraw even under concurrent requests. Returns the complete authoritative wallet and entitlement snapshot. Buy and use request IDs are separate operation namespaces.
- POST `/api/skyline/spend` body `{item:"net"|"smoke",requestId}` consumes one paid gadget. requestId must be a random 16–64-character identifier, reused when retrying the same spend. Reusing it for a different item is rejected. Balance-guarded ledger insertion and transactional batches reject overspending; never decrement only a client copy.

The four allowlisted products are `skyline_neon_suit` (neon), `skyline_founder_bundle` (founder, 1500 paid coins, 3 nets and 3 smoke once), `skyline_coins_1500` (1500 paid coins), and `skyline_gadget_pack` (3 nets and 3 smoke). Paid coins remain separate from earned local currency. Paid coins buy net/smoke through the fixed catalogue above; clients cannot pick arbitrary prices or grant quantities. Additional gadget and upgrade products are not enabled. Both `/buy` and `/spend` require `SKYLINE_PAYMENTS_ENABLED` to match the selected billing environment; no live economy is enabled.

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

POST `/api/skyline/reconcile` accepts `Authorization: Bearer <existing owner key>` checked against `OWNER_KEY_HASH`, using the existing owner-key convention. Member credentials cannot invoke it. This route does not use or disclose member recovery keys. It remains disabled unless `SKYLINE_PAYMENTS_ENABLED` matches the selected billing environment; no Google request, owner credentials, webhook, schedule or deployment was performed during implementation.

Body may contain integer `startTimeMillis` and `endTimeMillis`; default is the preceding 29 days. The window must fit within the last 30 days and end no later than now. One authorized call performs at most three Google pages of 100 entries, type=0 (one-time products), with quantity-based partial refunds included. It returns counts `{reviewed,revoked,unknown,partialHeld,complete}` only, without purchase tokens, member IDs, order IDs or pagination tokens. `complete:false` means the bounded window was not fully covered; narrower windows and an operational coverage mechanism are needed. This is not an autonomous full-history reconciliation service.

A SHA-256 tombstone is retained for every returned token, including unknown tokens. Tombstones prevent delayed/stale successful Google verification from granting a refunded token. Known purchases are revoked in a transactional D1 batch: remaining credited resources are clawed back, associated permanent suit removed, settlement marked revoked and the refund marked applied. Replay does not repeat the deduction. A settlement retry cannot overwrite revoked status. A fresh nonconsumable token may restore the same suit after an unspent full refund; the active-entitlement index excludes revoked tokens. Replayed older refunds cannot remove this new grant because the old refund marker is already applied.

**Spent-credit policy:** balances never become negative. Any unavailable resource shortfall is recorded as resource-specific debt in the refund row. The member's paid buy/use/new-purchase verification is held for owner review; free gameplay and earned local currency remain available. These shortfalls are not money owed or a charge authorization, and no automatic billing occurs. Owner review/appeal and debt resolution are not implemented. A conservative hold also prevents use of gadgets converted from refunded paid coins. Multiple resource deficits should not be interpreted as a monetary debt sum.

**Historical partial-refund policy — superseded:** at the initial sandbox checkpoint, the entire token's grant is conservatively revoked and the member held for review when `voidedQuantity` is supplied. `partialHeld` counts partial refund entries reviewed, including replay entries, rather than newly created holds. Proportional quantity attribution/reinstatement is not implemented. This records the earlier conservative sandbox policy and its original proof boundary; it is not the current implementation.

**Current partial-refund behavior:** for a known token, Google's original quantity and remaining refundable quantity establish cumulative refunded units. Only newly refunded units are deducted, repeated or stale snapshots cannot double-debit inventory, and a full refund removes the remainder. Missing spent resources create a review hold; an unknown-token partial refund remains conservatively blocked pending review. Both selected billing environments use this local implementation, with mode-specific Google proof validation. Synthetic SQLite and actual local D1 tests cover it; real Google partial-refund behavior remains unverified.

Each entry is committed atomically; valid earlier entries can remain committed if a later Google page/entry fails. Repeating the bounded window is safe for tested token-level replays. Pagination coverage, Google response validation, owner secret rotation/operational audit, real chargeback/refund fixtures and refund appeal remain real-service proof boundaries. Existing RTDN integration is still absent.

Verification: `SKYLINE_TEST_D1=1 node --test tests/skyline-billing.test.mjs` tests actual local D1 concurrent refunds and existing credit/buy/use paths, plus SQLite fixture tests for permanent revocation, spent shortfalls, token replay, tombstones, delayed verification races, unauthorized requests, disabled gates and injected rollback. These tests use synthetic credentials and mocked Google transport; no real purchase/refund was claimed.

Primary reference: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases (VoidedPurchase fields, including optional voidedQuantity).

## Live configuration checkpoint — 2026-09-30

Google OAuth and the current one-time-product catalog endpoint both returned HTTP 200, with all four expected product IDs. The earlier catalog HTTP 403 is superseded for this endpoint; purchase-verification/settlement permission is not yet proven. All four Play purchase options remain Draft.

The two Google service-account variables were configured as Sites server secrets and applied by redeploying the existing archive-backed version 15, environment revision 2. No source changes or access-policy changes were published. `SKYLINE_PAYMENTS_ENABLED` remains unset and native `PAYMENTS_ENABLED=false`. No real purchase occurred. Receipt: `../../skyline-android/proof/billing-server-config-checkpoint.json`.

The direct unauthenticated endpoint probe received Cloudflare HTTP 403 / edge code 1010 before application execution. Browser navigation to that endpoint was blocked by the client. Those results did not establish whether Android native networking works. The subsequent native checkpoint below resolves reachability through the emulator, without proving authenticated operations or checkout.

## Account deletion requests: local implementation, not live

Migration0008 creates skyline_deletion_requests. Authenticated POST /api/skyline/deletion-request accepts an empty body, uses the session account rather than caller-supplied IDs, and returns202 only after a durable INSERT OR IGNORE and readback. GET returns pending/not_requested with the same reference; recovery rotates credentials without losing the request. No credentials, purchase receipts, wallet balances or earned progress are removed by this action.

Owner-only GET /api/skyline/deletion-requests uses the existing OWNER_KEY_HASH convention and returns up to100 pending rows, with a UUID after cursor for subsequent pages. Member sessions cannot enumerate requests. It does not complete or delete requests. Do not add a schedule or claim requests are processed automatically.

Before deploying/advertising: define retention and deletion processing, verify the public web request route, verify host networking from Android, apply migration0008 and deploy backend, then exercise live request and retry without real purchases. Current v15 live backend lacks these routes. Android localv11 therefore must not be uploaded as a functional live deletion flow yet. Source tests passed; live D1/account deletion remains unverified.


## Public deletion-request page — local checkpoint

`public/skyline-account.html` is a standalone page at `/skyline-account.html`, with self-hosted CSS/JavaScript and no world HUD, analytics or sign-in bundle. The private recovery code is masked, sent in a same-origin POST body, cleared from the form immediately, and never saved to browser storage or the URL. The page distinguishes a pending request from actual account deletion. It is not published or advertised as a working live deletion service.

POST `/api/skyline/deletion-request/recovery` verifies the existing member UUID and hashed recovery code. It never creates an account or rotates credentials. Valid retries keep the same reference. Invalid codes use a generic 401, foreign browser origins are rejected, and the route shares the existing bounded recovery-attempt limiter. Only durable readback can return 202. Existing native session requests and owner queue remain available locally.

Verification: 44 backend/migration tests passed, two optional D1 tests skipped; TypeScript and hosted build passed. The built static HTML/CSS/JS are present in `dist/client`. Local browser inspection covered desktop and 390px layouts, masked input, required confirmation, immediate field clearing and a failed-service response without false confirmation. The local dev database was not migrated during this page check, so the browser did not establish successful live persistence; positive persistence and replay were verified with synthetic SQLite fixtures. Human comprehension and real Android interaction remain NOT_TESTED. Actual deletion processing, retention policy, public support contact, live migration/deployment and live request verification remain release work.


## Android native reachability checkpoint

One executed Android instrumentation test, using the production PurchaseBackend HTTPS transport on emulator-5554, received the expected HTTP401 JSON `authentication_required` from the deployed `/api/skyline/entitlements` endpoint. This is application-level service reachability, not merely a TCP/TLS connection. The request sent no credentials or body and created no account/purchase. The local test preference store remained unchanged. Reproduce with `../skyline-android/tools/test-purchase-connectivity.py emulator-5554`; receipts are under that project's `proof/purchase-connectivity-*`. Earlier direct/client-blocked probes are not evidence of Android blockage after this successful native result. Authenticated live operations, deployment of the deletion changes, actual processing and Google settlement remain unverified.


## Deletion processing — local, disabled by default

Migration0009 adds `skyline_deletion_completions(request_hash,completed)`. POST `/api/skyline/deletion-requests/complete` requires the existing owner Bearer authentication, `SKYLINE_DELETION_PROCESSING_ENABLED=true`, and the exact body `{ "requestId": "<queued UUID>", "confirmation": "delete-account" }`. No caller-supplied member ID is accepted. An unknown/unrequested account cannot be deleted through this route. No processing flag has been configured live; no real deletion occurred.

The action resolves the durable pending request, then atomically writes a hashed reference/completion receipt and removes that member's associated refund events/refund rows, purchase ledger, entitlements, spends, coin buys, holds, wallet, pending request and credential row. Each removal is guarded by the exact pending request. Owner retries return the same completion time without removing another account. Deleted session/recovery credentials fail authentication. Account creation does not accept a supplied member ID; a new identity cannot claim the deleted identity's Google purchase proof. Purchase admission now also requires the member still to exist, and a missing wallet cannot produce a successful entitlement snapshot. A delayed Google verification cannot recreate the deleted ledger.

**Retained data requiring policy approval:** the completion table retains only SHA-256(request UUID) and a completion timestamp, with no member ID, session/recovery credential, product, purchase token or balance. No expiry/purge schedule exists yet, so do not promise a retention duration. Owner processing target, receipt retention/purge, public support contact, provider logging/backups and corresponding public policy remain required before enabling this route. Existing Google Play transactions are not refunded/cancelled/deleted by this action. Later refund reconciliation can still record unknown hashed purchase-token tombstones for fraud prevention; do not claim all provider or anti-fraud records are erased. Earned local gameplay data is separate and is not remotely removed.

Verification: `SKYLINE_TEST_D1=1 node --test tests/skyline-billing.test.mjs tests/migrations.test.mjs` — 51 passed, none skipped. Includes actual local D1 concurrent completion retries and SQLite tests for owner/gate/confirmation enforcement, complete member-linked removal, other-account preservation, failure injection at each transaction stage and deletion during delayed Google purchase verification. Typecheck passed. These are local synthetic data; live request/processing, provider retention and human/device acceptance remain unverified.

Policy reference: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en — account-associated data must be deleted; justified retention must be disclosed; users must be told what to expect. This local implementation is not a claim of policy approval.


### Owner policy selection and compact-page revision

Owner selected a 7-day deletion-processing deadline and 30-day hashed completion-receipt retention in a direct reply. Expiry/purge implementation and operational enforcement remain pending; no policy was published or live processing enabled. The request page was simplified to one visible instruction, one field and one action, with recovery instructions and data/refund details inside native disclosures. Desktop and390px rendering, disclosure expansion, required acknowledgement and failed-service response were checked through the local browser. Human comprehension remains NOT_TESTED. Screenshot: ../proof/skyline-deletion-compact-local.png.


## Selected policy: expiry and maintenance implemented locally

The direct owner selection was completion within7 days and hashed completion-receipt retention of30 days. Receipt lookup now rejects records at the30-day boundary. `skylineDeletionMaintenance` physically purges receipts whose completion time is at least30 days old and reports pending/overdue counts plus the nearest7-day deadline without member IDs. The owner queue includes each request's `deadlineAt`. Cleanup does not itself delete pending accounts; completion remains the deliberate owner operation.

POST `/api/skyline/deletion-maintenance` requires owner authentication, an empty body and the processing-enable flag. Clients cannot choose a cleanup timestamp. `worker/index.ts` includes a scheduled handler using server wall-clock time, disabled when processing is not open. No Cron Trigger was configured and no timer invocation was observed live. Sites get_site returned current live version15, with no automation capability field exposed; that is not proof that schedules are impossible or that none exist. Available connector tools exposed no schedule configuration operation. A verified periodic trigger (recommended hourly), operational owner queue review and monitoring are required before claiming the chosen timing policy is enforced. Request-driven/manual cleanup alone cannot guarantee physical expiry during idle periods.

54 backend/migration tests passed with actual local D1 cases enabled, zero skipped; typecheck and hosted build passed. D1 case verifies concurrent completion retries,30-day physical purge and failure to retrieve a purged receipt. SQLite fixtures verify exact expiry/deadline boundaries, owner authentication, disabled gate, client time rejection and preservation of pending accounts. No live account/receipt deletion, timer, enabled processing flag or policy publication occurred. Public page stays compact and does not advertise the timing promise until operations are live.

Cloudflare source: https://developers.cloudflare.com/workers/configuration/cron-triggers/ — scheduled handlers and Cron Trigger configuration are distinct requirements. Hosting-operation integration remains unverified.


### Owner operation health · local only

Migration0010 adds a singleton operational heartbeat without account IDs, request references or tokens. Maintenance batches the receipt purge and success timestamp atomically. A failure in either statement rolls back both. Scheduled invocations update a separate `last_scheduled` timestamp; manual invocations leave that value alone, and older invocations cannot move either timestamp backwards.

GET `/api/skyline/deletion-health` requires owner Bearer authentication and accepts no query parameters. It is read-only even when processing is disabled, returning the enable flag, server check time, last successful cleanup, last scheduled cleanup, pending/overdue counts and next deadline. `scheduledRecently` means the last scheduled invocation is less than two hours old; it is a recent-invocation indicator, not proof of a durable Cron Trigger or a seven-day response guarantee. Visitor credentials are rejected and no member identifiers are returned.

Deployment operating check: apply migrations0008–0010, configure the host trigger, keep processing disabled until its scope is verified, then enable processing and inspect this endpoint after a real scheduled invocation. Check the owner queue daily and resolve requests within seven days. Alert on overdue requests or missing/stale scheduled cleanup. The connector currently exposes no schedule-creation operation, and get_site still returns live version15 without schedule metadata. Do not use a manual invocation as schedule evidence. No live operation or account deletion occurred in this pass.

Validation:56 backend/migration tests passed with local D1 tests enabled, none skipped; typecheck passed. New fixtures cover unauthenticated/member access rejection, read-only disabled-state health, missing/stale scheduled heartbeat, manual versus scheduled invocation, and rollback on each maintenance batch failure. Human operations review remains NOT_TESTED.


## Production implementation checkpoint — local, disabled

All billing SQL uses a fixed allowlist of 13 internal table identifiers. Selecting production rewrites those compiled SQL identifiers to `skyline_production_*`; prepared statement parameters are never rewritten. Native D1 prepared statements and the original D1 transactional `batch` are forwarded unchanged. An unknown billing table identifier fails closed, so a later table addition must be explicitly included in the routing allowlist and production schema. Account creation, authentication, recovery, rate limits, snapshots, inventory, purchase settlement, reconciliation, deletion requests/completion, retained receipts and maintenance/health all use the selected namespace. Missing production migration causes service failure without falling back to sandbox. Standalone scheduled maintenance selects the same namespace; manual cleanup does not count as scheduled evidence.

Unauthenticated GET `/api/skyline/environment` returns `{billingEnvironment, paymentsOpen}` without database or Google access. Native clients may send `X-Skyline-Billing-Environment` on every request. A supplied invalid or mismatched header returns `409 billing_environment_mismatch` before mutations. Missing header remains supported for browser deletion and legacy clients; this header is a consistency check, not authentication. Native clients must preflight the endpoint before provisioning or using credentials: an old deployed worker that lacks the endpoint cannot establish an environment match merely by ignoring a header.

The native production storage namespace/build and server environment must match before activation. Sandbox credentials or encrypted pending receipts must never be automatically migrated, wiped or reused as production identity/inventory. Production intentionally rejects license-test `TEST` receipts: use a matching sandbox native build and server mode for free Google license-test proof. Production account/checkout and real receipt evidence require their own authorized test. Public checkout remains disabled; no server environment, migration deployment, paid checkout or real purchase was performed in this implementation pass.

Primary source: [Google ProductPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2) documents that `testPurchaseContext` is set only for test purchases. The acceptance rule is a locally tested implementation policy; Google service permission, active product offers, device checkout/settlement and human judgment remain separate proof gates.

Local tests cover unknown/mismatched environment settings, absent production schema, test-context rejection including malformed/null contexts, no grant for pending/cancelled/unknown consumed receipts, settlement retry and concurrent grant idempotency, paid buys/spends, and partial-refund proof rejection. An actual Miniflare D1 test exercises two modes on one database, cross-mode credential/recovery/deletion rejection, concurrent production grants, repeated partial/full refunds, production recovery with payments disabled, deletion completion and scheduled maintenance without changing sandbox account/inventory/health. Native environment preflight and header checks use synthetic requests and do not prove deployed client/server compatibility.

Validation receipt: `SKYLINE_TEST_D1=1 node --test tests/skyline-billing.test.mjs tests/migrations.test.mjs` passed 67 tests, zero skipped, including actual local D1 production isolation and production schema parity; `npm run typecheck` passed. All Google responses and credentials in these tests are generated synthetic fixtures. Hosted build/deployment, live configuration, Google checkout and real settlement are outside this receipt.

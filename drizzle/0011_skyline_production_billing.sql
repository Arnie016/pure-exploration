-- Separate production billing ledger. No sandbox rows or credentials are copied.

CREATE TABLE skyline_production_coin_buys_v2 (
 member TEXT NOT NULL REFERENCES skyline_production_members(id),
 request_id TEXT NOT NULL,
 item TEXT NOT NULL CHECK(item IN ('net','smoke')),
 price INTEGER NOT NULL CHECK((item='net' AND price=200) OR (item='smoke' AND price=150)),
 applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)),
 created INTEGER NOT NULL,
 PRIMARY KEY(member,request_id)
);

CREATE TABLE skyline_production_deletion_completions (
 request_hash TEXT PRIMARY KEY,
 completed INTEGER NOT NULL
);

CREATE TABLE skyline_production_deletion_health (
 id INTEGER PRIMARY KEY CHECK(id=1),
 last_success INTEGER NOT NULL,
 last_scheduled INTEGER
);

CREATE TABLE skyline_production_deletion_requests (
 member TEXT PRIMARY KEY REFERENCES skyline_production_members(id),
 request_id TEXT UNIQUE NOT NULL,
 requested INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed'))
);

CREATE TABLE skyline_production_entitlements (member TEXT NOT NULL, entitlement TEXT NOT NULL, PRIMARY KEY(member,entitlement));

CREATE TABLE skyline_production_members (id TEXT PRIMARY KEY, session_hash TEXT UNIQUE NOT NULL, recovery_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);

CREATE TABLE skyline_production_payment_holds (member TEXT PRIMARY KEY REFERENCES skyline_production_members(id), reason TEXT NOT NULL, created INTEGER NOT NULL);

CREATE TABLE skyline_production_purchases_v2 (token_hash TEXT PRIMARY KEY, member TEXT NOT NULL REFERENCES skyline_production_members(id), product TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100), coins INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL DEFAULT 0, smoke INTEGER NOT NULL DEFAULT 0, entitlement TEXT, settlement TEXT NOT NULL DEFAULT 'retry', applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)), created INTEGER NOT NULL);

CREATE TABLE skyline_production_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);

CREATE TABLE skyline_production_refund_events (event_hash TEXT PRIMARY KEY, token_hash TEXT NOT NULL, voided_at INTEGER NOT NULL, partial_quantity INTEGER);

CREATE TABLE skyline_production_refunds (token_hash TEXT PRIMARY KEY, voided_at INTEGER NOT NULL, partial_quantity INTEGER, applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)), coins_debt INTEGER NOT NULL DEFAULT 0, net_debt INTEGER NOT NULL DEFAULT 0, smoke_debt INTEGER NOT NULL DEFAULT 0, desired_quantity INTEGER NOT NULL DEFAULT 0 CHECK(desired_quantity>=0), refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK(refunded_quantity>=0));

CREATE TABLE skyline_production_spends_v2 (member TEXT NOT NULL, request_id TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('coins','net','smoke')), amount INTEGER NOT NULL CHECK(amount>0), applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)),
 created INTEGER NOT NULL, PRIMARY KEY(member,request_id));

CREATE TABLE skyline_production_wallets (member TEXT PRIMARY KEY REFERENCES skyline_production_members(id), coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0), net INTEGER NOT NULL DEFAULT 0 CHECK(net>=0), smoke INTEGER NOT NULL DEFAULT 0 CHECK(smoke>=0));

CREATE UNIQUE INDEX skyline_production_purchase_entitlement_active_v2 ON skyline_production_purchases_v2(member,entitlement) WHERE entitlement IS NOT NULL AND settlement!='revoked';

CREATE TABLE IF NOT EXISTS skyline_members (id TEXT PRIMARY KEY, session_hash TEXT UNIQUE NOT NULL, recovery_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_wallets (member TEXT PRIMARY KEY REFERENCES skyline_members(id), coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0), net INTEGER NOT NULL DEFAULT 0 CHECK(net>=0), smoke INTEGER NOT NULL DEFAULT 0 CHECK(smoke>=0));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_purchases_v2 (token_hash TEXT PRIMARY KEY, member TEXT NOT NULL REFERENCES skyline_members(id), product TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100), coins INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL DEFAULT 0, smoke INTEGER NOT NULL DEFAULT 0, entitlement TEXT, settlement TEXT NOT NULL DEFAULT 'retry', applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)), created INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS skyline_purchase_entitlement_once_v2 ON skyline_purchases_v2(member,entitlement) WHERE entitlement IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_entitlements (member TEXT NOT NULL, entitlement TEXT NOT NULL, PRIMARY KEY(member,entitlement));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_spends_v2 (member TEXT NOT NULL, request_id TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('coins','net','smoke')), amount INTEGER NOT NULL CHECK(amount>0), applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)),
 created INTEGER NOT NULL, PRIMARY KEY(member,request_id));
--> statement-breakpoint

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);

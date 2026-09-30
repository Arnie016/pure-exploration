CREATE TABLE IF NOT EXISTS skyline_refunds (token_hash TEXT PRIMARY KEY, voided_at INTEGER NOT NULL, partial_quantity INTEGER, applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)), coins_debt INTEGER NOT NULL DEFAULT 0, net_debt INTEGER NOT NULL DEFAULT 0, smoke_debt INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_payment_holds (member TEXT PRIMARY KEY REFERENCES skyline_members(id), reason TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
DROP INDEX IF EXISTS skyline_purchase_entitlement_once_v2;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS skyline_purchase_entitlement_active_v2 ON skyline_purchases_v2(member,entitlement) WHERE entitlement IS NOT NULL AND settlement!='revoked';

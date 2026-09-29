CREATE TABLE IF NOT EXISTS skyline_members (id TEXT PRIMARY KEY, session_hash TEXT UNIQUE NOT NULL, recovery_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_wallets (member TEXT PRIMARY KEY REFERENCES skyline_members(id), coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0), net INTEGER NOT NULL DEFAULT 0 CHECK(net>=0), smoke INTEGER NOT NULL DEFAULT 0 CHECK(smoke>=0));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_purchases (token_hash TEXT PRIMARY KEY, member TEXT NOT NULL REFERENCES skyline_members(id), product TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100), coins INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL DEFAULT 0, smoke INTEGER NOT NULL DEFAULT 0, entitlement TEXT, settlement TEXT NOT NULL DEFAULT 'retry', created INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS skyline_purchase_entitlement_once ON skyline_purchases(member,entitlement) WHERE entitlement IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_entitlements (member TEXT NOT NULL, entitlement TEXT NOT NULL, PRIMARY KEY(member,entitlement));
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS skyline_purchase_grant AFTER INSERT ON skyline_purchases BEGIN
 INSERT OR IGNORE INTO skyline_wallets(member) VALUES(NEW.member);
 UPDATE skyline_wallets SET coins=coins+NEW.coins, net=net+NEW.net, smoke=smoke+NEW.smoke WHERE member=NEW.member;
 INSERT OR IGNORE INTO skyline_entitlements(member,entitlement) SELECT NEW.member,NEW.entitlement WHERE NEW.entitlement IS NOT NULL;
END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_spends (member TEXT NOT NULL, request_id TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('coins','net','smoke')), amount INTEGER NOT NULL CHECK(amount>0), created INTEGER NOT NULL, PRIMARY KEY(member,request_id));
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS skyline_spend_guard BEFORE INSERT ON skyline_spends BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM skyline_spends WHERE member=NEW.member AND request_id=NEW.request_id) AND COALESCE((SELECT CASE NEW.currency WHEN 'coins' THEN coins WHEN 'net' THEN net ELSE smoke END FROM skyline_wallets WHERE member=NEW.member),0)<NEW.amount THEN RAISE(ABORT,'insufficient_balance') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS skyline_spend_apply AFTER INSERT ON skyline_spends BEGIN
 UPDATE skyline_wallets SET coins=coins-CASE WHEN NEW.currency='coins' THEN NEW.amount ELSE 0 END, net=net-CASE WHEN NEW.currency='net' THEN NEW.amount ELSE 0 END, smoke=smoke-CASE WHEN NEW.currency='smoke' THEN NEW.amount ELSE 0 END WHERE member=NEW.member;
END;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS skyline_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);

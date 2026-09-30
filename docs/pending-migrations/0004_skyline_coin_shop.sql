CREATE TABLE IF NOT EXISTS skyline_coin_buys (
 member TEXT NOT NULL REFERENCES skyline_members(id),
 request_id TEXT NOT NULL,
 item TEXT NOT NULL CHECK(item IN ('net','smoke')),
 price INTEGER NOT NULL CHECK((item='net' AND price=200) OR (item='smoke' AND price=150)),
 created INTEGER NOT NULL,
 PRIMARY KEY(member,request_id)
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS skyline_coin_buy_guard BEFORE INSERT ON skyline_coin_buys BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM skyline_coin_buys WHERE member=NEW.member AND request_id=NEW.request_id) AND COALESCE((SELECT coins FROM skyline_wallets WHERE member=NEW.member),0)<NEW.price THEN RAISE(ABORT,'insufficient_balance') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS skyline_coin_buy_apply AFTER INSERT ON skyline_coin_buys BEGIN
 UPDATE skyline_wallets SET coins=coins-NEW.price, net=net+CASE WHEN NEW.item='net' THEN 1 ELSE 0 END, smoke=smoke+CASE WHEN NEW.item='smoke' THEN 1 ELSE 0 END WHERE member=NEW.member;
END;

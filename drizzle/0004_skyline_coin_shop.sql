CREATE TABLE IF NOT EXISTS skyline_coin_buys_v2 (
 member TEXT NOT NULL REFERENCES skyline_members(id),
 request_id TEXT NOT NULL,
 item TEXT NOT NULL CHECK(item IN ('net','smoke')),
 price INTEGER NOT NULL CHECK((item='net' AND price=200) OR (item='smoke' AND price=150)),
 applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)),
 created INTEGER NOT NULL,
 PRIMARY KEY(member,request_id)
);
--> statement-breakpoint
--> statement-breakpoint

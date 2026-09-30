ALTER TABLE skyline_refunds ADD COLUMN desired_quantity INTEGER NOT NULL DEFAULT 0 CHECK(desired_quantity>=0);
--> statement-breakpoint
ALTER TABLE skyline_refunds ADD COLUMN refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK(refunded_quantity>=0);
--> statement-breakpoint
UPDATE skyline_refunds SET desired_quantity=COALESCE((SELECT quantity FROM skyline_purchases_v2 WHERE token_hash=skyline_refunds.token_hash),0),refunded_quantity=COALESCE((SELECT quantity FROM skyline_purchases_v2 WHERE token_hash=skyline_refunds.token_hash),0) WHERE applied=1;
--> statement-breakpoint
CREATE TABLE skyline_refund_events (event_hash TEXT PRIMARY KEY, token_hash TEXT NOT NULL, voided_at INTEGER NOT NULL, partial_quantity INTEGER);

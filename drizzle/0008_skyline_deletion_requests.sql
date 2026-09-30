-- A request is durable and does not erase receipts or grant/refund records.
-- Completion is a separate owner operation, not implied by this queue.
CREATE TABLE IF NOT EXISTS skyline_deletion_requests (
 member TEXT PRIMARY KEY REFERENCES skyline_members(id),
 request_id TEXT UNIQUE NOT NULL,
 requested INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed'))
);

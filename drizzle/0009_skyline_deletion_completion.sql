-- Minimal retry receipt only: no member ID, credentials or purchase token.
CREATE TABLE IF NOT EXISTS skyline_deletion_completions (
 request_hash TEXT PRIMARY KEY,
 completed INTEGER NOT NULL
);

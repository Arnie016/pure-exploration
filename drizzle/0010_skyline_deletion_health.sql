-- One operational heartbeat, with no account IDs or request references.
CREATE TABLE IF NOT EXISTS skyline_deletion_health (
 id INTEGER PRIMARY KEY CHECK(id=1),
 last_success INTEGER NOT NULL,
 last_scheduled INTEGER
);

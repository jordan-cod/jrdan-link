CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id    TEXT NOT NULL,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  country    TEXT,
  city       TEXT,
  region     TEXT,
  referer    TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS clicks_link_ts_idx ON clicks (link_id, ts DESC);

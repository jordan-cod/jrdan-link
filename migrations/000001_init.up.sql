CREATE TABLE links (
    id         TEXT PRIMARY KEY,
    url        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE clicks (
    id         BIGSERIAL PRIMARY KEY,
    link_id    TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip         INET,
    user_agent TEXT,
    referrer   TEXT,
    country    TEXT,
    device     TEXT,
    is_bot     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX clicks_link_ts_idx ON clicks (link_id, ts DESC);
CREATE INDEX clicks_ts_idx ON clicks (ts DESC);

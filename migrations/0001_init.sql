-- Fonte da verdade dos links. Os cliques não moram aqui: vão pro Analytics
-- Engine, que é feito pra série temporal.
CREATE TABLE links (
  slug       TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

-- `list` ordena por data de criação.
CREATE INDEX links_created_at ON links (created_at DESC);

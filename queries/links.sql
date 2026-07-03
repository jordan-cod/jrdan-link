-- name: GetLink :one
SELECT * FROM links WHERE id = $1 AND active = true;

-- name: CreateLink :one
INSERT INTO links (id, url, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: DeactivateLink :exec
UPDATE links SET active = false WHERE id = $1;

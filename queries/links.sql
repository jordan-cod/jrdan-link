-- name: GetLink :one
SELECT * FROM links WHERE id = $1 AND active = true;

-- name: CreateLink :one
INSERT INTO links (id, url, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateLink :one
UPDATE links SET
    url        = coalesce(sqlc.narg('url'), url),
    expires_at = coalesce(sqlc.narg('expires_at'), expires_at),
    active     = coalesce(sqlc.narg('active'), active)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateLink :exec
UPDATE links SET active = false WHERE id = $1;

-- name: ListLinks :many
SELECT l.*,
       (SELECT count(*) FROM clicks c WHERE c.link_id = l.id AND NOT c.is_bot) AS total_clicks
FROM links l
ORDER BY l.created_at DESC
LIMIT $1 OFFSET $2;

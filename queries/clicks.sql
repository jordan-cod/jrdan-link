-- name: GetLinkTotals :one
SELECT
    count(*)                                            AS total_clicks,
    count(*) FILTER (WHERE ts > now() - interval '24 hours') AS clicks_24h,
    count(*) FILTER (WHERE ts > now() - interval '7 days')   AS clicks_7d
FROM clicks
WHERE link_id = $1;

-- name: GetLinkDailyClicks :many
SELECT date_trunc('day', ts)::date AS day, count(*) AS clicks
FROM clicks
WHERE link_id = $1 AND ts > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- name: GetLinkTopReferrers :many
SELECT coalesce(referrer, '(direct)') AS referrer, count(*) AS clicks
FROM clicks
WHERE link_id = $1
GROUP BY referrer
ORDER BY clicks DESC
LIMIT 10;

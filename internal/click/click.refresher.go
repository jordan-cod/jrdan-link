package click

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func RunRefresher(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			_, err := pool.Exec(rctx, "REFRESH MATERIALIZED VIEW CONCURRENTLY clicks_daily")
			cancel()
			if err != nil {
				log.Error("refresh clicks_daily", "err", err)
			}
		}
	}
}

package click

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Event struct {
	LinkID    string
	TS        time.Time
	UserAgent string
	Referrer  string
}

// Batcher acumula clicks num channel e grava em lote via COPY,
// tirando o write do hot path do redirect.
type Batcher struct {
	pool      *pgxpool.Pool
	log       *slog.Logger
	ch        chan Event
	done      chan struct{}
	maxBatch  int
	flushEach time.Duration
}

func NewBatcher(pool *pgxpool.Pool, log *slog.Logger) *Batcher {
	return &Batcher{
		pool:      pool,
		log:       log,
		ch:        make(chan Event, 10_000),
		done:      make(chan struct{}),
		maxBatch:  1_000,
		flushEach: 500 * time.Millisecond,
	}
}

// Record enfileira sem bloquear; sob backpressure extrema descarta
// (perder um click de analytics é melhor que travar o redirect).
func (b *Batcher) Record(e Event) {
	select {
	case b.ch <- e:
	default:
		b.log.Warn("click dropped: buffer full", "link_id", e.LinkID)
	}
}

// Run consome o channel até ele ser fechado, então drena e sinaliza done.
func (b *Batcher) Run() {
	defer close(b.done)

	batch := make([]Event, 0, b.maxBatch)
	ticker := time.NewTicker(b.flushEach)
	defer ticker.Stop()

	for {
		select {
		case e, ok := <-b.ch:
			if !ok {
				b.flush(batch)
				return
			}
			batch = append(batch, e)
			if len(batch) >= b.maxBatch {
				b.flush(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				b.flush(batch)
				batch = batch[:0]
			}
		}
	}
}

// Close para de aceitar eventos e espera o drain terminar.
func (b *Batcher) Close() {
	close(b.ch)
	<-b.done
}

func (b *Batcher) flush(batch []Event) {
	if len(batch) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows := make([][]any, len(batch))
	for i, e := range batch {
		rows[i] = []any{e.LinkID, e.TS, nullable(e.UserAgent), nullable(e.Referrer)}
	}

	_, err := b.pool.CopyFrom(ctx,
		pgx.Identifier{"clicks"},
		[]string{"link_id", "ts", "user_agent", "referrer"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		b.log.Error("flush clicks", "err", err, "count", len(batch))
		return
	}
	b.log.Debug("clicks flushed", "count", len(batch))
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

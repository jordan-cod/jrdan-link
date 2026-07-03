package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jrdan/tracker/internal/click"
	"github.com/jrdan/tracker/internal/config"
	"github.com/jrdan/tracker/internal/db"
	"github.com/jrdan/tracker/internal/link"
	"github.com/jrdan/tracker/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("pgx pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Error("db ping", "err", err)
		os.Exit(1)
	}

	queries := db.New(pool)

	batcher := click.NewBatcher(pool, logger)
	go batcher.Run()
	go click.RunRefresher(ctx, pool, logger, 5*time.Minute)

	linkSvc := link.NewService(queries)
	linkHandler := link.NewHandler(linkSvc, batcher, queries, cfg.BaseURL, logger)

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.New(cfg.APIKey, linkHandler),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("listening", "port", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Info("shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = httpSrv.Shutdown(shutdownCtx)

	batcher.Close()
}

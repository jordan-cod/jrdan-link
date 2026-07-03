package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
)

// Registrar é implementado pelos handlers de domínio (link, click...).
type Registrar interface {
	Register(api huma.API)
}

// New monta o huma.API com middleware de auth e registra os domínios.
func New(apiKey string, domains ...Registrar) http.Handler {
	mux := http.NewServeMux()

	cfg := huma.DefaultConfig("Tracker API", "0.1.0")
	cfg.Info.Description = "Encurtador de URLs com tracking de cliques."
	cfg.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"apiKey": {
			Type: "apiKey",
			In:   "header",
			Name: "X-API-Key",
		},
	}

	api := humago.New(mux, cfg)

	api.UseMiddleware(func(ctx huma.Context, next func(huma.Context)) {
		if len(ctx.Operation().Security) == 0 {
			next(ctx)
			return
		}
		if ctx.Header("X-API-Key") != apiKey {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(ctx)
	})

	registerHealth(api)
	for _, d := range domains {
		d.Register(api)
	}

	return mux
}

type healthOutput struct {
	Body struct {
		Status string `json:"status" example:"ok"`
	}
}

func registerHealth(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "healthz",
		Method:      http.MethodGet,
		Path:        "/healthz",
		Summary:     "Health check",
		Tags:        []string{"System"},
	}, func(ctx context.Context, in *struct{}) (*healthOutput, error) {
		out := &healthOutput{}
		out.Body.Status = "ok"
		return out, nil
	})
}

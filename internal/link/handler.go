package link

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/jrdan/tracker/internal/click"
	"github.com/jrdan/tracker/internal/db"
)

// Handler expõe as rotas HTTP do domínio de links.
type Handler struct {
	svc     *Service
	clicks  *click.Batcher
	q       *db.Queries
	baseURL string
	log     *slog.Logger
}

func NewHandler(svc *Service, clicks *click.Batcher, q *db.Queries, baseURL string, log *slog.Logger) *Handler {
	return &Handler{svc: svc, clicks: clicks, q: q, baseURL: baseURL, log: log}
}

// Register registra as operações do domínio no huma.API.
func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "redirect",
		Method:      http.MethodGet,
		Path:        "/{id}",
		Summary:     "Redirect to destination",
		Description: "Redireciona pro destino registrado e registra o click de forma assíncrona.",
		Tags:        []string{"Links"},
	}, h.redirect)

	huma.Register(api, huma.Operation{
		OperationID: "createLink",
		Method:      http.MethodPost,
		Path:        "/links",
		Summary:     "Create short link",
		Description: "Encurta uma URL. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.createLink)

	huma.Register(api, huma.Operation{
		OperationID: "getLinkStats",
		Method:      http.MethodGet,
		Path:        "/links/{id}/stats",
		Summary:     "Link stats",
		Description: "Totais, série diária (30d) e top referrers do link. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.stats)
}

type redirectInput struct {
	ID        string `path:"id" doc:"Short ID do link" example:"aB3xK9pQ"`
	UserAgent string `header:"User-Agent"`
	Referrer  string `header:"Referer"`
}

type redirectOutput struct {
	Status   int
	Location string `header:"Location"`
}

func (h *Handler) redirect(ctx context.Context, in *redirectInput) (*redirectOutput, error) {
	link, err := h.svc.Resolve(ctx, in.ID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, huma.Error404NotFound("link not found")
		}
		h.log.Error("resolve link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	h.clicks.Record(click.Event{
		LinkID:    link.ID,
		TS:        time.Now().UTC(),
		UserAgent: in.UserAgent,
		Referrer:  in.Referrer,
	})

	return &redirectOutput{Status: http.StatusFound, Location: link.Url}, nil
}

type createLinkInput struct {
	Body struct {
		URL       string     `json:"url" doc:"URL destino" example:"https://github.com" required:"true"`
		ExpiresAt *time.Time `json:"expires_at,omitempty" doc:"Expiração opcional"`
	}
}

type createLinkOutput struct {
	Status int
	Body   struct {
		ID        string    `json:"id" example:"aB3xK9pQ"`
		URL       string    `json:"url"`
		ShortURL  string    `json:"short_url"`
		CreatedAt time.Time `json:"created_at"`
	}
}

func (h *Handler) createLink(ctx context.Context, in *createLinkInput) (*createLinkOutput, error) {
	link, err := h.svc.Create(ctx, in.Body.URL, in.Body.ExpiresAt)
	if err != nil {
		if errors.Is(err, ErrInvalidURL) {
			return nil, huma.Error400BadRequest("url must be a valid http(s) URL")
		}
		h.log.Error("create link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	out := &createLinkOutput{Status: http.StatusCreated}
	out.Body.ID = link.ID
	out.Body.URL = link.Url
	out.Body.ShortURL = h.baseURL + "/" + link.ID
	out.Body.CreatedAt = link.CreatedAt.Time
	return out, nil
}

type statsInput struct {
	ID string `path:"id" doc:"Short ID do link"`
}

type dailyClicks struct {
	Day    string `json:"day" example:"2026-07-02"`
	Clicks int64  `json:"clicks"`
}

type referrerClicks struct {
	Referrer string `json:"referrer" example:"https://news.ycombinator.com"`
	Clicks   int64  `json:"clicks"`
}

type statsOutput struct {
	Body struct {
		TotalClicks  int64            `json:"total_clicks"`
		Clicks24h    int64            `json:"clicks_24h"`
		Clicks7d     int64            `json:"clicks_7d"`
		Daily        []dailyClicks    `json:"daily"`
		TopReferrers []referrerClicks `json:"top_referrers"`
	}
}

func (h *Handler) stats(ctx context.Context, in *statsInput) (*statsOutput, error) {
	if _, err := h.svc.Resolve(ctx, in.ID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, huma.Error404NotFound("link not found")
		}
		h.log.Error("resolve link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	totals, err := h.q.GetLinkTotals(ctx, in.ID)
	if err != nil {
		h.log.Error("link totals", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}
	daily, err := h.q.GetLinkDailyClicks(ctx, in.ID)
	if err != nil {
		h.log.Error("link daily", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}
	refs, err := h.q.GetLinkTopReferrers(ctx, in.ID)
	if err != nil {
		h.log.Error("link referrers", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	out := &statsOutput{}
	out.Body.TotalClicks = totals.TotalClicks
	out.Body.Clicks24h = totals.Clicks24h
	out.Body.Clicks7d = totals.Clicks7d
	out.Body.Daily = make([]dailyClicks, len(daily))
	for i, d := range daily {
		out.Body.Daily[i] = dailyClicks{Day: d.Day.Time.Format("2006-01-02"), Clicks: d.Clicks}
	}
	out.Body.TopReferrers = make([]referrerClicks, len(refs))
	for i, r := range refs {
		out.Body.TopReferrers[i] = referrerClicks{Referrer: r.Referrer, Clicks: r.Clicks}
	}
	return out, nil
}

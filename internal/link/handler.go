package link

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/skip2/go-qrcode"

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
		Description: "Redireciona pro destino registrado, repassando query params, e registra o click de forma assíncrona.",
		Tags:        []string{"Links"},
	}, h.redirect)

	huma.Register(api, huma.Operation{
		OperationID: "createLink",
		Method:      http.MethodPost,
		Path:        "/links",
		Summary:     "Create short link",
		Description: "Encurta uma URL, com slug customizado opcional. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.createLink)

	huma.Register(api, huma.Operation{
		OperationID: "listLinks",
		Method:      http.MethodGet,
		Path:        "/links",
		Summary:     "List links",
		Description: "Lista links com contagem de clicks, paginado. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.listLinks)

	huma.Register(api, huma.Operation{
		OperationID: "updateLink",
		Method:      http.MethodPatch,
		Path:        "/links/{id}",
		Summary:     "Update link",
		Description: "Altera destino, expiração ou status. Campos omitidos não mudam. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.updateLink)

	huma.Register(api, huma.Operation{
		OperationID: "deleteLink",
		Method:      http.MethodDelete,
		Path:        "/links/{id}",
		Summary:     "Deactivate link",
		Description: "Desativa o link (soft delete). Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.deleteLink)

	huma.Register(api, huma.Operation{
		OperationID: "getLinkStats",
		Method:      http.MethodGet,
		Path:        "/links/{id}/stats",
		Summary:     "Link stats",
		Description: "Totais, série diária (30d), top referrers e devices, sem bots. Requer `X-API-Key`.",
		Tags:        []string{"Links"},
		Security:    []map[string][]string{{"apiKey": {}}},
	}, h.stats)

	huma.Register(api, huma.Operation{
		OperationID: "getLinkQR",
		Method:      http.MethodGet,
		Path:        "/links/{id}/qr.png",
		Summary:     "QR code",
		Description: "PNG com QR code apontando pro link curto.",
		Tags:        []string{"Links"},
	}, h.qr)
}

type redirectInput struct {
	ID        string `path:"id" doc:"Short ID do link" example:"aB3xK9pQ"`
	UserAgent string `header:"User-Agent"`
	Referrer  string `header:"Referer"`

	rawQuery string
}

// Resolve captura a query string crua pra repassar ao destino.
func (i *redirectInput) Resolve(ctx huma.Context) []error {
	i.rawQuery = ctx.URL().RawQuery
	return nil
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

	device, isBot := click.Classify(in.UserAgent)
	h.clicks.Record(click.Event{
		LinkID:    link.ID,
		TS:        time.Now().UTC(),
		UserAgent: in.UserAgent,
		Referrer:  in.Referrer,
		Device:    device,
		IsBot:     isBot,
	})

	dest := link.Url
	if in.rawQuery != "" {
		sep := "?"
		if strings.Contains(dest, "?") {
			sep = "&"
		}
		dest += sep + in.rawQuery
	}

	return &redirectOutput{Status: http.StatusFound, Location: dest}, nil
}

type linkBody struct {
	ID        string     `json:"id" example:"aB3xK9pQ"`
	URL       string     `json:"url"`
	ShortURL  string     `json:"short_url"`
	Active    bool       `json:"active"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

func (h *Handler) toLinkBody(l db.Link) linkBody {
	b := linkBody{
		ID:        l.ID,
		URL:       l.Url,
		ShortURL:  h.baseURL + "/" + l.ID,
		Active:    l.Active,
		CreatedAt: l.CreatedAt.Time,
	}
	if l.ExpiresAt.Valid {
		t := l.ExpiresAt.Time
		b.ExpiresAt = &t
	}
	return b
}

type createLinkInput struct {
	Body struct {
		URL       string     `json:"url" doc:"URL destino" example:"https://github.com" required:"true"`
		Slug      string     `json:"slug,omitempty" doc:"Slug customizado (3-32 chars: a-z A-Z 0-9 _ -)" example:"promo"`
		ExpiresAt *time.Time `json:"expires_at,omitempty" doc:"Expiração opcional"`
	}
}

type createLinkOutput struct {
	Status int
	Body   linkBody
}

func (h *Handler) createLink(ctx context.Context, in *createLinkInput) (*createLinkOutput, error) {
	link, err := h.svc.Create(ctx, in.Body.URL, in.Body.Slug, in.Body.ExpiresAt)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidURL):
			return nil, huma.Error400BadRequest("url must be a valid http(s) URL")
		case errors.Is(err, ErrInvalidSlug):
			return nil, huma.Error400BadRequest("slug must match ^[a-zA-Z0-9_-]{3,32}$")
		case errors.Is(err, ErrSlugTaken):
			return nil, huma.Error409Conflict("slug already taken")
		}
		h.log.Error("create link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	return &createLinkOutput{Status: http.StatusCreated, Body: h.toLinkBody(link)}, nil
}

type listLinksInput struct {
	Limit  int32 `query:"limit" default:"20" minimum:"1" maximum:"100"`
	Offset int32 `query:"offset" default:"0" minimum:"0"`
}

type listLinkItem struct {
	linkBody
	TotalClicks int64 `json:"total_clicks"`
}

type listLinksOutput struct {
	Body struct {
		Links []listLinkItem `json:"links"`
	}
}

func (h *Handler) listLinks(ctx context.Context, in *listLinksInput) (*listLinksOutput, error) {
	rows, err := h.svc.List(ctx, in.Limit, in.Offset)
	if err != nil {
		h.log.Error("list links", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	out := &listLinksOutput{}
	out.Body.Links = make([]listLinkItem, len(rows))
	for i, r := range rows {
		out.Body.Links[i] = listLinkItem{
			linkBody: h.toLinkBody(db.Link{
				ID: r.ID, Url: r.Url, Active: r.Active,
				CreatedAt: r.CreatedAt, ExpiresAt: r.ExpiresAt,
			}),
			TotalClicks: r.TotalClicks,
		}
	}
	return out, nil
}

type updateLinkInput struct {
	ID   string `path:"id"`
	Body struct {
		URL       *string    `json:"url,omitempty" doc:"Novo destino"`
		ExpiresAt *time.Time `json:"expires_at,omitempty" doc:"Nova expiração"`
		Active    *bool      `json:"active,omitempty" doc:"Ativar/desativar"`
	}
}

type updateLinkOutput struct {
	Body linkBody
}

func (h *Handler) updateLink(ctx context.Context, in *updateLinkInput) (*updateLinkOutput, error) {
	link, err := h.svc.Update(ctx, in.ID, UpdateParams{
		URL:       in.Body.URL,
		ExpiresAt: in.Body.ExpiresAt,
		Active:    in.Body.Active,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			return nil, huma.Error404NotFound("link not found")
		case errors.Is(err, ErrInvalidURL):
			return nil, huma.Error400BadRequest("url must be a valid http(s) URL")
		}
		h.log.Error("update link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}
	return &updateLinkOutput{Body: h.toLinkBody(link)}, nil
}

type deleteLinkInput struct {
	ID string `path:"id"`
}

func (h *Handler) deleteLink(ctx context.Context, in *deleteLinkInput) (*struct{}, error) {
	if err := h.svc.Delete(ctx, in.ID); err != nil {
		h.log.Error("delete link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}
	return &struct{}{}, nil
}

type statsInput struct {
	ID string `path:"id" doc:"Short ID do link"`
}

type dailyClicks struct {
	Day    string `json:"day" example:"2026-07-02"`
	Clicks int64  `json:"clicks"`
}

type namedClicks struct {
	Name   string `json:"name" example:"mobile"`
	Clicks int64  `json:"clicks"`
}

type statsOutput struct {
	Body struct {
		TotalClicks  int64         `json:"total_clicks"`
		Clicks24h    int64         `json:"clicks_24h"`
		Clicks7d     int64         `json:"clicks_7d"`
		Daily        []dailyClicks `json:"daily"`
		TopReferrers []namedClicks `json:"top_referrers"`
		Devices      []namedClicks `json:"devices"`
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
	devices, err := h.q.GetLinkDevices(ctx, in.ID)
	if err != nil {
		h.log.Error("link devices", "err", err)
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
	out.Body.TopReferrers = make([]namedClicks, len(refs))
	for i, r := range refs {
		out.Body.TopReferrers[i] = namedClicks{Name: r.Referrer, Clicks: r.Clicks}
	}
	out.Body.Devices = make([]namedClicks, len(devices))
	for i, d := range devices {
		out.Body.Devices[i] = namedClicks{Name: d.Device, Clicks: d.Clicks}
	}
	return out, nil
}

type qrInput struct {
	ID   string `path:"id"`
	Size int    `query:"size" default:"256" minimum:"64" maximum:"1024" doc:"Lado do PNG em pixels"`
}

type qrOutput struct {
	ContentType string `header:"Content-Type"`
	Body        []byte
}

func (h *Handler) qr(ctx context.Context, in *qrInput) (*qrOutput, error) {
	if _, err := h.svc.Resolve(ctx, in.ID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, huma.Error404NotFound("link not found")
		}
		h.log.Error("resolve link", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}

	png, err := qrcode.Encode(h.baseURL+"/"+in.ID, qrcode.Medium, in.Size)
	if err != nil {
		h.log.Error("qr encode", "err", err)
		return nil, huma.Error500InternalServerError("internal error")
	}
	return &qrOutput{ContentType: "image/png", Body: png}, nil
}

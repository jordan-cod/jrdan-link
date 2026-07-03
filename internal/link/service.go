package link

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/jrdan/tracker/internal/db"
)

var (
	ErrNotFound    = errors.New("link not found")
	ErrInvalidURL  = errors.New("invalid url")
	ErrInvalidSlug = errors.New("invalid slug")
	ErrSlugTaken   = errors.New("slug already taken")
)

var slugPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,32}$`)

const uniqueViolation = "23505"

// Service resolve e cria links, com cache LRU em memória no read path.
type Service struct {
	q     *db.Queries
	cache *expirable.LRU[string, db.Link]
}

func NewService(q *db.Queries) *Service {
	return &Service{
		q:     q,
		cache: expirable.NewLRU[string, db.Link](10_000, nil, 5*time.Minute),
	}
}

// Resolve retorna o link ativo e não expirado, ou ErrNotFound.
func (s *Service) Resolve(ctx context.Context, id string) (db.Link, error) {
	link, ok := s.cache.Get(id)
	if !ok {
		var err error
		link, err = s.q.GetLink(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return db.Link{}, ErrNotFound
			}
			return db.Link{}, err
		}
		s.cache.Add(id, link)
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		return db.Link{}, ErrNotFound
	}
	return link, nil
}

// Create valida a URL e persiste um novo link. Com slug vazio gera um
// short ID aleatório, tentando de novo em caso de colisão.
func (s *Service) Create(ctx context.Context, rawURL, slug string, expiresAt *time.Time) (db.Link, error) {
	if err := validateURL(rawURL); err != nil {
		return db.Link{}, err
	}

	var expires pgtype.Timestamptz
	if expiresAt != nil {
		expires = pgtype.Timestamptz{Time: *expiresAt, Valid: true}
	}

	if slug != "" {
		if !slugPattern.MatchString(slug) {
			return db.Link{}, ErrInvalidSlug
		}
		link, err := s.q.CreateLink(ctx, db.CreateLinkParams{ID: slug, Url: rawURL, ExpiresAt: expires})
		if isUniqueViolation(err) {
			return db.Link{}, ErrSlugTaken
		}
		return link, err
	}

	for range 3 {
		id, err := newShortID(8)
		if err != nil {
			return db.Link{}, err
		}
		link, err := s.q.CreateLink(ctx, db.CreateLinkParams{ID: id, Url: rawURL, ExpiresAt: expires})
		if isUniqueViolation(err) {
			continue
		}
		return link, err
	}
	return db.Link{}, errors.New("could not generate unique short id")
}

// UpdateParams define os campos alteráveis de um link; nil mantém o valor atual.
type UpdateParams struct {
	URL       *string
	ExpiresAt *time.Time
	Active    *bool
}

// Update altera o link e invalida o cache.
func (s *Service) Update(ctx context.Context, id string, p UpdateParams) (db.Link, error) {
	params := db.UpdateLinkParams{ID: id}
	if p.URL != nil {
		if err := validateURL(*p.URL); err != nil {
			return db.Link{}, err
		}
		params.Url = pgtype.Text{String: *p.URL, Valid: true}
	}
	if p.ExpiresAt != nil {
		params.ExpiresAt = pgtype.Timestamptz{Time: *p.ExpiresAt, Valid: true}
	}
	if p.Active != nil {
		params.Active = pgtype.Bool{Bool: *p.Active, Valid: true}
	}

	link, err := s.q.UpdateLink(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Link{}, ErrNotFound
		}
		return db.Link{}, err
	}
	s.cache.Remove(id)
	return link, nil
}

// Delete desativa o link e invalida o cache.
func (s *Service) Delete(ctx context.Context, id string) error {
	if err := s.q.DeactivateLink(ctx, id); err != nil {
		return err
	}
	s.cache.Remove(id)
	return nil
}

// List retorna links paginados com contagem de clicks (sem bots).
func (s *Service) List(ctx context.Context, limit, offset int32) ([]db.ListLinksRow, error) {
	return s.q.ListLinks(ctx, db.ListLinksParams{Limit: limit, Offset: offset})
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == uniqueViolation
}

func validateURL(raw string) error {
	if raw == "" {
		return ErrInvalidURL
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ErrInvalidURL
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ErrInvalidURL
	}
	if strings.TrimSpace(u.Host) == "" {
		return ErrInvalidURL
	}
	return nil
}

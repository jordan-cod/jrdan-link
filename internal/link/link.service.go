package link

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/jrdan/tracker/internal/db"
)

var (
	ErrNotFound   = errors.New("link not found")
	ErrInvalidURL = errors.New("invalid url")
)

// Service resolve e cria links, com cache LRU em memória no read path:
// hot links respondem da RAM sem tocar no Postgres.
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

func (s *Service) Create(ctx context.Context, rawURL string, expiresAt *time.Time) (db.Link, error) {
	if err := validateURL(rawURL); err != nil {
		return db.Link{}, err
	}

	id, err := newShortID(8)
	if err != nil {
		return db.Link{}, err
	}

	params := db.CreateLinkParams{ID: id, Url: rawURL}
	if expiresAt != nil {
		params.ExpiresAt = pgtype.Timestamptz{Time: *expiresAt, Valid: true}
	}
	return s.q.CreateLink(ctx, params)
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

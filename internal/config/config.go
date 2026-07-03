package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	BaseURL     string
	DatabaseURL string
	APIKey      string
}

func Load() (Config, error) {
	c := Config{
		Port:        getenv("PORT", "8080"),
		BaseURL:     getenv("BASE_URL", "http://app.localhost"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		APIKey:      os.Getenv("API_KEY"),
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	if c.APIKey == "" {
		return c, fmt.Errorf("API_KEY is required")
	}
	return c, nil
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

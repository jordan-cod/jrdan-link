package click

import (
	ua "github.com/mileusna/useragent"
)

// Classify extrai o tipo de dispositivo do User-Agent e detecta bots.
// Segue a convenção dos grandes (Dub, Plausible): só marca bot quando
// positivamente identificado; UA desconhecido conta como humano.
func Classify(raw string) (device string, isBot bool) {
	if raw == "" {
		return "unknown", true
	}

	parsed := ua.Parse(raw)
	if parsed.Bot {
		return "unknown", true
	}

	switch {
	case parsed.Mobile:
		return "mobile", false
	case parsed.Tablet:
		return "tablet", false
	case parsed.Desktop:
		return "desktop", false
	default:
		return "unknown", false
	}
}

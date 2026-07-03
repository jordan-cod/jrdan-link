package click

import (
	"regexp"
	"strings"
)

var botPattern = regexp.MustCompile(`(?i)bot|crawl|spider|slurp|curl|wget|python|httpclient|monitor|preview|scan|facebookexternalhit|whatsapp|telegram`)

// Classify extrai o tipo de dispositivo do User-Agent e detecta bots.
func Classify(ua string) (device string, isBot bool) {
	if ua == "" || botPattern.MatchString(ua) {
		return "unknown", true
	}
	l := strings.ToLower(ua)
	switch {
	case strings.Contains(l, "ipad") || strings.Contains(l, "tablet"):
		return "tablet", false
	case strings.Contains(l, "mobi") || strings.Contains(l, "iphone") || strings.Contains(l, "android"):
		return "mobile", false
	default:
		return "desktop", false
	}
}

#!/usr/bin/env bash

set -euo pipefail

API="${JRDAN_LINK_API:-https://shortener.jrdan.dev}/api/links"

notify() { osascript -e "display notification \"$1\" with title \"jrdan.link\""; }

token=$(security find-generic-password -a jrdan -s jrdan-link-token -w 2>/dev/null) || {
  notify 'Token não encontrado no Keychain'
  exit 1
}

if [[ -n "${1:-}" ]]; then
  url="$1"
elif [[ ! -t 0 ]]; then
  url=$(cat)
else
  url=$(pbpaste)
fi
url=$(printf '%s' "$url" | tr -d '\r\n' | sed 's/^ *//;s/ *$//')

if [[ ! "$url" =~ ^https?:// ]]; then
  notify 'Não tem uma URL http(s) pra encurtar'
  exit 1
fi

body=$(printf '%s' "$url" | python3 -c 'import json,sys; print(json.dumps({"url": sys.stdin.read().strip()}))')
resp=$(curl -s -X POST "$API" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "$body")
short=$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("shortUrl",""))' 2>/dev/null || true)

if [[ -z "$short" ]]; then
  error=$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("error",""))' 2>/dev/null || true)
  notify "Falhou: ${error:-sem resposta}"
  exit 1
fi

printf '%s' "$short" | pbcopy
notify "$short  (copiado)"

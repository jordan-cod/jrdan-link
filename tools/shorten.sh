#!/usr/bin/env bash
#
# Lê uma URL do clipboard, cria um link curto em jrdan.link e devolve o
# link curto no clipboard (+ notificação). Pensado pra rodar via um atalho
# global do macOS (Shortcuts.app → Run Shell Script).
#
# A API key fica no Keychain:
#   security add-generic-password -a jrdan -s jrdan-admin-key -w '<sua-key>' -U

set -euo pipefail

API='https://app.jrdan.link/links'

notify() { osascript -e "display notification \"$1\" with title \"jrdan.link\""; }

key=$(security find-generic-password -a jrdan -s jrdan-admin-key -w 2>/dev/null) || {
  notify 'API key não encontrada no Keychain'
  exit 1
}

url=$(pbpaste)
if [[ ! "$url" =~ ^https?:// ]]; then
  notify 'Clipboard não tem uma URL http(s)'
  exit 1
fi

body=$(printf '%s' "$url" | python3 -c 'import json,sys; print(json.dumps({"url": sys.stdin.read().strip()}))')
resp=$(curl -s -X POST "$API" -H "Authorization: Bearer $key" -H 'Content-Type: application/json' -d "$body")
short=$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("short_url",""))' 2>/dev/null || true)

if [[ -z "$short" ]]; then
  notify 'Falhou ao criar o link'
  exit 1
fi

printf '%s' "$short" | pbcopy
notify "$short  (copiado)"

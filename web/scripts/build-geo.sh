#!/usr/bin/env bash

set -euo pipefail

SRC="${GEO_SRC:-/tmp/natural-earth}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/geo"
BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
MAPSHAPER="bunx mapshaper@0.6.113"

mkdir -p "$SRC" "$OUT/admin1"

for layer in ne_50m_admin_0_countries ne_10m_admin_1_states_provinces; do
  [[ -f "$SRC/$layer.geojson" ]] || curl -fsSL -o "$SRC/$layer.geojson" "$BASE/$layer.geojson"
done

$MAPSHAPER -i "$SRC/ne_50m_admin_0_countries.geojson" \
  -filter 'ISO_A2_EH !== "AQ"' \
  -each 'id = ISO_A2_EH === "-99" ? "" : ISO_A2_EH, name = NAME_PT || NAME' \
  -filter-fields id,name \
  -simplify 20% keep-shapes \
  -rename-layers countries \
  -o "$OUT/world.json" format=topojson quantization=100000

rm -f "$OUT"/admin1/*.json
$MAPSHAPER -i "$SRC/ne_10m_admin_1_states_provinces.geojson" \
  -filter '/^[A-Z]{2}$/.test(iso_a2)' \
  -each 'cc = iso_a2, id = iso_3166_2, name = name_pt || name' \
  -filter-fields cc,id,name \
  -simplify 4% keep-shapes \
  -split cc \
  -o "$OUT/admin1/" format=topojson quantization=100000 singles

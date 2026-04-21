#!/usr/bin/env bash
# Render all CWS screenshot templates into 1280×800 PNGs via headless Chrome.
set -e

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
ROOT="$(cd "$(dirname "$0")" && pwd -W)"   # Windows-style absolute path
ROOT_URL="file:///${ROOT//\\//}"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/output"

mkdir -p "$OUT_DIR"

render() {
  local name="$1"
  local size="${2:-1280,800}"
  local tpl="${ROOT_URL}/templates/${name}.html"
  local out="${OUT_DIR}/${name}.png"

  echo "→ Rendering ${name}.html (${size})"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --hide-scrollbars \
    --window-size="$size" \
    --virtual-time-budget=3000 \
    --default-background-color=00000000 \
    --screenshot="$out" \
    "$tpl" 2>/dev/null

  if [[ -f "$out" ]]; then
    local size=$(stat -c %s "$out" 2>/dev/null || stat -f %z "$out")
    echo "   ✓ ${out} (${size} bytes)"
  else
    echo "   ✗ Failed"
    return 1
  fi
}

render 01-hero
render 02-signature
render 03-text
render 04-privacy
render 05-usecases
render og-preview "1200,630"

echo ""
echo "Done. Output in: ${OUT_DIR}"

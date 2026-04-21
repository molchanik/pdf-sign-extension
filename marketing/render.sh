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

# OG preview — headless Chrome's --window-size in new-headless mode
# includes a small browser-chrome area, so a 1200,630 window produces
# a ~1200,530 viewport (bottom-positioned elements get clipped).
# Render into 1200,760 and crop to 1200,630 via PIL.
render_og() {
  local tpl="${ROOT_URL}/templates/og-preview.html"
  local raw="${OUT_DIR}/og-raw.png"
  local out="${OUT_DIR}/og-preview.png"

  echo "→ Rendering og-preview.html (1200,760 → crop 1200,630)"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --hide-scrollbars \
    --window-size=1200,760 \
    --virtual-time-budget=8000 \
    --default-background-color=00000000 \
    --screenshot="$raw" \
    "$tpl" 2>/dev/null

  python -c "
from PIL import Image
Image.open('$raw').convert('RGB').crop((0, 0, 1200, 630)).save('$out', optimize=True)
"
  rm -f "$raw"
  if [[ -f "$out" ]]; then
    local size=$(stat -c %s "$out" 2>/dev/null || stat -f %z "$out")
    echo "   ✓ ${out} (${size} bytes)"
  else
    echo "   ✗ Failed"
    return 1
  fi
}

render_og

echo ""
echo "Done. Output in: ${OUT_DIR}"

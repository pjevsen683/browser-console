#!/bin/bash
# Headless screenshot af den lokale dev-server (port $PORT, standard 8091) i fjernsynsformat: tools/shot.sh ud.png 'bots=6&auto=1&prewarm=8' [B,H] [side]
out=${1:-/tmp/shot.png}; q=${2:-bots=4}; size=${3:-1280,720}; page=${4:-}
google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --no-sandbox \
  --hide-scrollbars --virtual-time-budget=8000 --window-size=$size --screenshot="$out" \
  "http://localhost:${PORT:-8091}/${page}?nosw=1&$q" 2>/dev/null
echo "$out"

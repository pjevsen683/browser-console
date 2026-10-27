#!/bin/bash
# PNG-ikoner fra public/icons/icon.svg med headless Chrome (ingen GPU-job: et ikon er tegnet, ikke genereret).
set -euo pipefail
cd "$(dirname "$0")/../public/icons"
for s in 192 512; do
  google-chrome --headless=new --no-sandbox --hide-scrollbars --window-size=$s,$s --screenshot="$PWD/icon-$s.png" "file://$PWD/icon.svg" 2>/dev/null
done
cp icon-512.png icon-maskable-512.png   # motivet holder sig inden for den sikre zone (80 %)
ls -l icon-*.png

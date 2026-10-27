#!/bin/bash
# 3D for every asset from its seed-1 reference image, one job at a time.
# Skips assets that already have a .glb.
cd "$(dirname "$0")/.."
G=asset-generation/generated
while pgrep -f "gen.mjs images" >/dev/null; do sleep 10; done
# name or name=<image-job-id> to use another image than seed 1
for arg in "$@"; do
  n=${arg%%=*}; id=${arg#*=}; [ "$id" = "$arg" ] && id=
  [ -f "$G/$n.glb" ] && continue
  [ -z "$id" ] && id=$(grep -oP 'image job \K[0-9a-f]+(?=.*seed 1,)' "$G/$n.md" | tail -1)
  [ -z "$id" ] && { echo "$n: intet billede"; continue; }
  node tools/gen.mjs model "$n" "$id" || echo "$n: FEJL"
done

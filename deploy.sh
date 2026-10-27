#!/bin/bash
# Lægger public/ på Caddy-boksen bag konsol.mobil.peter87.dk. Siden er statisk; signalserveren udrulles for sig
# med ./deploy-server.sh. --delete holder sig inden for spillets egen mappe.
set -euo pipefail
cd "$(dirname "$0")"
HOST=peter@10.0.1.198
DEST=/home/peter/dockers/home-proxy/public/mobil/konsol
./sync-vendor.sh
npm test --silent
ssh "$HOST" "mkdir -p $DEST"
rsync -az --delete --info=stats1 public/ "$HOST:$DEST/"
echo
echo "Udrullet:  https://konsol.mobil.peter87.dk/"

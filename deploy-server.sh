#!/bin/bash
# Lægger signalserveren på proxy-boksen og genstarter dens container. Kun nødvendigt, når server/ er ændret.
set -euo pipefail
cd "$(dirname "$0")"
HOST=peter@10.0.1.198
DEST=/home/peter/dockers/konsol-signal
npm test --silent
ssh "$HOST" "mkdir -p $DEST"
rsync -az --delete --info=stats1 server/ "$HOST:$DEST/"
ssh "$HOST" "cd $DEST && ./docker-run.sh"

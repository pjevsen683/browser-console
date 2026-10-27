#!/bin/bash
# Byg og (gen)start signalserveren. Køres PÅ proxy-boksen fra /home/peter/dockers/konsol-signal/ (deploy-server.sh
# lægger filerne der). Kun loopback (127.0.0.1:3260): Caddy når den gennem `handle /ws` i konsol-blokken.
# --read-only: den skriver intet og husker intet; en genstart lukker rummene, og klienterne forbinder selv igen.
# --memory: boksen fronter alle sites; vokser den, skal den dø alene.
set -euo pipefail
cd "$(dirname "$0")"
docker build -t konsol-signal .
docker stop konsol-signal 2>/dev/null || true
docker rm konsol-signal 2>/dev/null || true
docker run -d \
  --name konsol-signal \
  --restart unless-stopped \
  -p 127.0.0.1:3260:3260 \
  -e ORIGINS=https://konsol.mobil.peter87.dk \
  --read-only \
  --memory 128m --memory-swap 128m \
  -e NODE_OPTIONS=--max-old-space-size=96 \
  konsol-signal
docker ps --filter name=konsol-signal --format '{{.Names}}  {{.Status}}  {{.Ports}}'
sleep 1
curl -sS -w '  <- /health %{http_code}\n' http://127.0.0.1:3260/health

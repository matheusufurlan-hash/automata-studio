#!/usr/bin/env bash
# Tira um print da interface sem abrir janela.
# Uso: tools/screenshot.sh <porta> <saida.png> [query-string] [largura,altura]
# Ex.: tools/screenshot.sh 5174 screenshots/editor-escuro.png "demo=termina-em-01&theme=dark"
# Use uma porta livre diferente para cada print em paralelo.
set -euo pipefail
PORT="${1:?porta}"; OUT="${2:?arquivo de saída}"; QUERY="${3:-}"; SIZE="${4:-1400,900}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$(dirname "$OUT")"
"$ROOT/node_modules/.bin/vite" "$ROOT" --port "$PORT" --strictPort >/dev/null 2>&1 &
VITE_PID=$!
PROFILE="$(mktemp -d)"
cleanup() { kill "$VITE_PID" 2>/dev/null || true; pkill -P "$VITE_PID" 2>/dev/null || true; rm -rf "$PROFILE"; }
trap cleanup EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT" && break; sleep 0.3; done
timeout 60 google-chrome --headless=new --disable-gpu --user-data-dir="$PROFILE" \
  --window-size="$SIZE" --timeout=4000 --virtual-time-budget=4000 \
  --screenshot="$OUT" "http://localhost:$PORT/?$QUERY" >/dev/null 2>&1
echo "print salvo em $OUT"

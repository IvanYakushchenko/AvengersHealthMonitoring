#!/usr/bin/env bash
# Runs the whole project: the backend API on http://localhost:8000 and the web app on
# http://localhost:5173. Press Ctrl+C to stop both.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [ ! -f "$BACKEND/.env" ]; then
  echo "Missing backend/.env. Create it with your database address (see README, step 2)." >&2
  exit 1
fi

"$ROOT/scripts/setup.sh"

pids=()
cleanup() {
  echo; echo "==> Stopping the backend and the frontend..."
  kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting the backend on http://localhost:8000 (API docs: http://localhost:8000/docs)"
(cd "$BACKEND" && exec venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
pids+=($!)

echo "==> Starting the web app on http://localhost:5173"
(cd "$FRONTEND" && exec npm run dev -- --port 5173) &
pids+=($!)

wait

#!/usr/bin/env bash
# Code was assisted with Claude.
# Installs everything the project needs: the backend's Python packages and the frontend's npm packages.
# Safe to run again. Used by run.sh and test.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10 or newer is needed (python3 was not found)." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22 or newer (with npm) is needed. Install it from https://nodejs.org" >&2
  exit 1
fi

echo "==> Backend: Python packages"
if [ ! -d "$BACKEND/venv" ]; then
  python3 -m venv "$BACKEND/venv"
fi
"$BACKEND/venv/bin/python" -m pip install -q -r "$BACKEND/requirements.txt"

echo "==> Frontend: npm packages"
cd "$FRONTEND"
npm install --no-audit --no-fund

echo "==> Setup finished."

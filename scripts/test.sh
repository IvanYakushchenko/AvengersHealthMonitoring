#!/usr/bin/env bash
# Code was assisted with Claude.
# Runs all automated tests: backend tests, then frontend tests and a production build.
# The backend tests use TEST_DATABASE_URL from backend/.env if it is set, otherwise
# DATABASE_URL. Point that at a test database (not your real data).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/setup.sh"

echo "==> Backend tests"
(cd "$ROOT/backend" && venv/bin/python -m unittest)

echo "==> Frontend tests"
(cd "$ROOT/frontend" && npm test)

echo "==> Frontend type-check and build"
(cd "$ROOT/frontend" && npm run build)

echo "==> All tests passed."

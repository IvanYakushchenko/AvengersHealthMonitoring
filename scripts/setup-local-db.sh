#!/usr/bin/env bash
# Code was assisted with Claude Code.
# Prepares a local PostgreSQL database for the backend, so no hosted database is needed.
# It creates the database "avengers" (or the name you give) and writes backend/.env,
# unless that file already exists. Run it once, after PostgreSQL is installed and running.
#
#   ./scripts/setup-local-db.sh [database-name]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
DB_NAME="${1:-avengers}"
PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-$(whoami)}"

if ! command -v psql >/dev/null 2>&1 || ! command -v createdb >/dev/null 2>&1; then
  echo "PostgreSQL is not installed (psql was not found)." >&2
  echo "  macOS:   brew install postgresql@17 && brew services start postgresql@17" >&2
  echo "  Windows: install from https://www.postgresql.org/download/ (Git Bash or WSL to run this script)" >&2
  echo "  Linux:   sudo apt install postgresql" >&2
  exit 1
fi

if ! pg_isready -h localhost -p "$PORT" >/dev/null 2>&1; then
  echo "PostgreSQL is installed but not running on localhost:$PORT." >&2
  echo "  macOS:   brew services start postgresql@17" >&2
  echo "  Linux:   sudo systemctl start postgresql" >&2
  exit 1
fi

if ! psql -h localhost -p "$PORT" -U "$DB_USER" -d postgres -tAc "select 1" >/dev/null 2>&1; then
  echo "Cannot log in as '$DB_USER' without a password. Set PGUSER and PGPASSWORD, or create that role." >&2
  exit 1
fi

echo "==> Database '$DB_NAME'"
if [ "$(psql -h localhost -p "$PORT" -U "$DB_USER" -d postgres -tAc "select 1 from pg_database where datname = '$DB_NAME'")" = "1" ]; then
  echo "    already exists"
else
  createdb -h localhost -p "$PORT" -U "$DB_USER" -T template0 -E UTF8 "$DB_NAME"
  echo "    created"
fi

echo "==> Backend settings (backend/.env)"
if [ -f "$ENV_FILE" ]; then
  echo "    $ENV_FILE already exists, so it was left unchanged."
  echo "    To use this database, set: DATABASE_URL=postgresql://$DB_USER@localhost:$PORT/$DB_NAME"
else
  echo "DATABASE_URL=postgresql://$DB_USER@localhost:$PORT/$DB_NAME" > "$ENV_FILE"
  echo "    written: DATABASE_URL=postgresql://$DB_USER@localhost:$PORT/$DB_NAME"
fi

echo "==> Done. Next: ./scripts/setup.sh, then ./scripts/run.sh"

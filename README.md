# AvengersHealthMonitoring

NASA Space Apps Challenge 2026 Hackathon | AUK Avengers Team Project

Astronaut Health Monitor. Crew members log their own measurements and see a rating for
each one (normal, caution or urgent). Mission control manages its own crew, and the
superadmin creates crews.

> **Hackathon prototype, not a medical device.** The health ranges in
> `backend/app/data/rules.json` are estimates and have not been checked against cited
> sources. Do not use them for real health decisions.

## What is in this repository

```
backend/     Python API (FastAPI) with a PostgreSQL database and automated tests
frontend/    Web app (React, TypeScript, Vite)
scripts/     Scripts that set up the database, install, run, and test everything
```

## Before you start

Install these once:

| Tool | Version | Where |
|---|---|---|
| Python | 3.10 or newer | https://www.python.org |
| Node.js (includes npm) | 22 or newer | https://nodejs.org |
| A PostgreSQL database | 14 or newer | Your own computer (step 2, Option A) or a free hosted one such as [Neon](https://neon.tech) (Option B) |

The scripts are written for macOS and Linux shells. On Windows, use WSL (Ubuntu) so the
scripts find the Python environment; Git Bash may not find it.

## 1. Get the code

```bash
git clone https://github.com/IvanYakushchenko/AvengersHealthMonitoring.git
cd AvengersHealthMonitoring
```

## 2. Connect the backend to a database

You can use a database on your own computer, or a hosted one (Neon). Choose one of the two options below.

**Option A: local PostgreSQL (no account needed)**

Install PostgreSQL and start it (macOS: `brew install postgresql@17 && brew services start postgresql@17`;
Windows: installer from https://www.postgresql.org/download/; Linux: `sudo apt install postgresql`). Then run:

```bash
./scripts/setup-local-db.sh
```

It creates the database `avengers` and writes `backend/.env`. If `backend/.env` already exists, it is not changed.

**Option B: hosted database (Neon)**

Create the file `backend/.env` (it is ignored by Git, so your password stays private):

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Get the address from your database provider (on Neon: **Connect**, pooled connection).
The tables are created automatically the first time the backend starts.

Optional settings in the same file:

```bash
# Database for the automated tests only (e.g. a Neon branch). If it is missing, the
# tests use DATABASE_URL and clean up their own data.
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DATABASE?sslmode=require

# Web addresses allowed to call the API from a browser (default: http://localhost:5173)
CORS_ORIGINS=http://localhost:5173
```

## 3. Install everything

```bash
./scripts/setup.sh
```

This creates `backend/venv`, installs the Python packages, and installs the npm packages in `frontend/`.
It is safe to run again.

## 4. Run the whole project

```bash
./scripts/run.sh
```

It starts both parts and keeps them running:

- **Web app:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API documentation** (try every endpoint in the browser): http://localhost:8000/docs

Press **Ctrl+C** to stop both.

## 5. Create the first account: superadmin

The superadmin creates crews and their mission control accounts. Run this once, in the
project folder, and answer the questions:

```bash
cd backend
venv/bin/python -m app.create_superadmin
```

Then open http://localhost:5173 and log in with that username and password.

Skip this step if you load the demo data below: it already creates a superadmin.

Everyday flow after that:
1. Superadmin creates a crew, then creates its mission control account.
2. Mission control logs in and creates crew members (each with sex, which picks the 3D model).
3. Crew members log in, follow the tutorial on first login, and log their measurements (Manual) or let the simulated sensors fill them in (Auto).

## Demo data (for presentations)

The demo adds a small crew with readings, so every screen has something to show. It is
for demonstrations only: the passwords below are public.

Use a **separate demo database**, never the one that holds real data. The local database
from step 2 (Option A) is ideal. Then run from the `backend` folder:

```bash
cd backend
venv/bin/python -m app.demo seed --demo     # create the demo crew and 14 days of readings
venv/bin/python -m app.demo reset --demo    # remove the demo accounts and the demo crew
```

Both commands need `--demo`, so they cannot run by accident. Seeding stops if the demo
data already exists. Reset removes only accounts named `demo_...` and the crew "Demo Crew".
Each command prints the database host it changed.

| Role | Username | Password |
|---|---|---|
| Superadmin | `demo_superadmin` | `demo-password-2026` |
| Mission control of "Demo Crew" | `demo_control` | `demo-password-2026` |
| Crew member (female) | `demo_anna` | `demo-password-2026` |
| Crew member (male) | `demo_max` | `demo-password-2026` |
| Crew member (female) | `demo_lena` | `demo-password-2026` |

## Scripts

| Script | What it does |
|---|---|
| `./scripts/setup-local-db.sh` | Creates a local database `avengers` and writes `backend/.env` (optional, Option A) |
| `./scripts/setup.sh` | Installs the Python and npm packages |
| `./scripts/run.sh` | Runs the backend and the web app |
| `./scripts/test.sh` | Runs all tests and the production build |

## Running the tests

```bash
./scripts/test.sh
```

This runs the backend tests (against `TEST_DATABASE_URL`, or `DATABASE_URL` if that is
not set), the frontend tests, and a production build. The local database from step 2 works
for the tests. The backend tests create accounts named `test_...` and delete them afterwards,
but they do write to the database, so do not point them at real data.

Run the tests before every commit.

## Project documentation

- Backend: [backend/README.md](backend/README.md). API endpoints, roles, the rating rules, and the database.
- Frontend: [frontend/README.md](frontend/README.md). Pages, configuration and commands.

## Configuration summary

| Setting | Where | Default |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | (required; `setup-local-db.sh` writes it for a local database) |
| `TEST_DATABASE_URL` | `backend/.env` | uses `DATABASE_URL` |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173,http://127.0.0.1:5173` |
| `VITE_API_URL` | `frontend/.env` (optional) | `http://localhost:8000` |

## Troubleshooting

- **"Missing backend/.env"**: create the file as described in step 2.
- **"Backend not available" in the web app**: the backend is not running. Start it with `./scripts/run.sh`, or check the terminal for an error (for example a wrong `DATABASE_URL`).
- **Login fails with a database error**: check that `DATABASE_URL` is correct and that the database accepts connections.
- **"PostgreSQL is not running"** (from `setup-local-db.sh`): start it, for example `brew services start postgresql@17` on macOS, then run the script again.
- **"PostgreSQL is installed" is missing or the login fails**: the script logs in as your computer's user name. If your database needs a user and password, set `PGUSER` and `PGPASSWORD` before running it.
- **Port already in use**: another program is using 5173 or 8000. Stop it, then run the script again.

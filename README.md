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
scripts/     Scripts that install and run everything
```

## Before you start

Install these once:

| Tool | Version | Where |
|---|---|---|
| Python | 3.10 or newer | https://www.python.org |
| Node.js (includes npm) | 22 or newer | https://nodejs.org |
| A PostgreSQL database | any | A free hosted one such as [Neon](https://neon.tech), or a local PostgreSQL |

The scripts are written for macOS and Linux shells. On Windows, use Git Bash or WSL.

## 1. Get the code

```bash
git clone https://github.com/IvanYakushchenko/AvengersHealthMonitoring.git
cd AvengersHealthMonitoring
```

## 2. Connect the backend to a database

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

Everyday flow after that:
1. Superadmin creates a crew, then creates its mission control account.
2. Mission control logs in and creates crew members (each with sex, which picks the 3D model).
3. Crew members log in, follow the tutorial on first login, and log their measurements (Manual) or let the simulated sensors fill them in (Auto).

## Running the tests

```bash
./scripts/test.sh
```

This runs the backend tests (against `TEST_DATABASE_URL`, or `DATABASE_URL` if that is
not set), the frontend tests, and a production build. Use a **test database**: the
backend tests create accounts named `test_...` and delete them afterwards, but they do
write to the database.

Run the tests before every commit.

## Project documentation

- Backend: [backend/README.md](backend/README.md). API endpoints, roles, the rating rules, and the database.
- Frontend: [frontend/README.md](frontend/README.md). Pages, configuration and commands.

## Configuration summary

| Setting | Where | Default |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | (required) |
| `TEST_DATABASE_URL` | `backend/.env` | uses `DATABASE_URL` |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173,http://127.0.0.1:5173` |
| `VITE_API_URL` | `frontend/.env` (optional) | `http://localhost:8000` |

## Troubleshooting

- **"Missing backend/.env"**: create the file as described in step 2.
- **"Backend not available" in the web app**: the backend is not running. Start it with `./scripts/run.sh`, or check the terminal for an error (for example a wrong `DATABASE_URL`).
- **Login fails with a database error**: check that `DATABASE_URL` is correct and that the database accepts connections.
- **Port already in use**: another program is using 5173 or 8000. Stop it, then run the script again.

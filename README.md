# AvengersHealthMonitoring

NASA Space Apps Challenge 2026 Hackathon | AUK Avengers Team Project

Astronaut Health Monitor: crew members log their own measurements and see a rating for each one. Mission control and the superadmin manage crews.

## Structure

```
backend/    FastAPI + PostgreSQL API, tests (see backend/README.md)
frontend/   React + TypeScript + Vite web app (see frontend/README.md)
```

## Quick start

1. Backend: follow `backend/README.md`. Create `backend/.env` with your `DATABASE_URL` (never commit it).
2. Frontend: follow `frontend/README.md`. Set `VITE_API_URL` if the backend is not at http://localhost:8000.

> Hackathon prototype, not a medical device. Health ranges are estimates.

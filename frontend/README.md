# Frontend: Astronaut Health Monitor

React + TypeScript + Vite web app. It talks to the backend API (see [backend/README.md](../backend/README.md)).

## Commands

Run these in this folder (`frontend/`), after `npm install`:

| Command | What it does |
|---|---|
| `npm run dev` | Starts the web app on http://localhost:5173 |
| `npm test` | Runs the automated tests once |
| `npm run test:watch` | Runs the tests again on every change |
| `npm run build` | Type-checks and builds the production version into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Checks the code with oxlint |

To run the whole project with one command, use `./scripts/run.sh` in the repository root.

## Configuration

The app calls the backend at `http://localhost:8000` by default. To use another address,
create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8000
```

Then restart `npm run dev`. The backend must allow the app's address in `CORS_ORIGINS`.

## Where things are

```
src/api/                 Client for the backend API (all requests go through here)
src/features/login/      Login screen
src/features/indications/  Crew page: indicators, 3D body model, Manual/Auto input
src/features/admin/      Mission control: crew list and crew members
src/features/superadmin/ Superadmin: crews and their mission control accounts
src/features/tutorial/   Tutorial for crew members
src/features/account/    Change password dialog
public/models/           The two 3D body models (male and female)
```

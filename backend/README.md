# AvengersHealthMonitoring backend

AvengersHealthMonitoring helps astronauts check their own health. They enter a measurement
(heart rate, blood oxygen, sleep, ...) and get back a simple rating:
**normal**, **caution** or **urgent**, plus a short message.

This repo is the backend API. The React + TypeScript frontend lives in a
separate repo.

> **Hackathon prototype, not a medical device.** The health ranges in
> `app/data/rules.json` are estimated average ranges for healthy adults,
> not taken from cited medical sources. Don't use them for real health
> decisions.

## Setup

You need Python 3.10 or newer.

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Then connect a PostgreSQL database:

1. Copy `.env` to `.env` (git ignores `.env`, so the password stays private).
2. Put your database's connection URL in it as `DATABASE_URL=...`.
   On a free hosted database such as Neon, you find it under **Connect**.

The tables are created automatically on first start.

## Run

```bash
python -m uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs (try every endpoint in the browser): http://localhost:8000/docs

The frontend dev server (http://localhost:5173) is allowed through CORS. When
the frontend runs somewhere else, list its address in `.env` as
`CORS_ORIGINS=...` (see `.env`).

## Tests

```bash
python -m unittest -v
```

This runs `test_backend.py`:

- **Rating tests** check the rating logic with made-up rules, so they keep
  passing when the numbers in `rules.json` change.
- **API tests** start the server and test every endpoint against the
  database. They create accounts named `test_...` and delete exactly those
  afterwards. To keep them away from real data entirely, put a separate
  database (e.g. a Neon branch) in `.env` as `TEST_DATABASE_URL=...`.

Run the tests before every commit.

## Accounts and login

Every account belongs to a **crew**, except the superadmin. There are three roles:

- **Superadmin**: creates crews and the mission control account of each crew.
  Belongs to no crew and has no readings of its own.
- **Mission control** (admin): belongs to one crew. Creates that crew's members,
  sees and changes only their health and accounts, and can correct or delete
  their readings and reset their passwords. Has no readings of its own.
- **Crew** (astronauts): belongs to one crew. Saves and sees only their own readings.

There is no public sign-up. The superadmin creates crews and mission control
accounts, and mission control creates the crew members of its own crew.

### First start: create the superadmin

Run this once in the project folder and answer the questions:

```bash
python -m app.create_superadmin
```

This is the only way to make a superadmin, so nobody can make themselves one through the API.

### Upgrading an older database

When the server starts, it updates the database in place. It is safe to run
more than once:

- Mission control accounts made before crews existed become superadmins.
- Crew members without a crew are put into a crew called **Default crew**.

### Logging in

1. `POST /api/login` with `{"username": "...", "password": "..."}`. It returns
   `{token, astronautId, username, isAdmin, isSuperadmin, sex, crewId, crewName}`.
   `sex` is `"male"` or `"female"` for crew (it picks the 3D body model) and
   `null` for mission control and the superadmin. `crewId` and `crewName` are
   `null` for the superadmin.
2. Send the token with every other request as a header:
   `Authorization: Bearer <token>`. In `/docs`, click **Authorize** and paste it.
3. A token stays valid for 30 days, until `POST /api/logout`, or until the
   password changes.

Without a valid token, endpoints return **401**. Crew calling mission control
endpoints, or mission control calling crew-only endpoints, get **403**.
Passwords and tokens are never stored, only hashes of them. That also means
nobody can look up a forgotten password, not even mission control; they can
only set a new one.

After 5 wrong passwords in a row, the error message adds: *"If you forgot
your password, contact Mission control to reset it."* Nothing is locked; the
count starts over after a correct login.

Usernames are 3-30 letters, digits, `_`, `.` or `-` (no spaces) and are not
case-sensitive. Passwords need at least 8 characters.

## Endpoints

### For everyone

| Method | Path | Login | What it does |
|---|---|---|---|
| GET | `/api/hello` | no | Check that the server is running |
| GET | `/api/indicators` | no | Every indicator with its region and value rules (for building forms) |
| POST | `/api/login` | no | Log in, returns a token |
| POST | `/api/logout` | any | Make the current token stop working |
| GET | `/api/me` | any | The same account details as login, for whoever is logged in |
| POST | `/api/me/password` | any | Change your own password: `{currentPassword, newPassword}` |

### Crew only (your own data)

| Method | Path | What it does |
|---|---|---|
| POST | `/api/readings` | Save a reading and get its rating |
| GET | `/api/readings?indicator=spo2&days=30` | Reading history for charts, oldest first |
| PUT | `/api/readings/{id}` | Correct a reading: `{values, takenAt?}`, returns the new rating |
| DELETE | `/api/readings/{id}` | Delete a reading |
| GET | `/api/status` | Status per body region and per indicator (newest readings) |
| GET | `/api/checklist` | Which measurements are due, plus streak and points |
| GET | `/api/alerts` | Indicators whose newest reading is caution or urgent |

### Mission control only (own crew)

Mission control sees only the members of its own crew. Anyone outside that crew
gets **404**.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/admin/astronauts` | The crew's members, each with overall status and alert count |
| POST | `/api/admin/astronauts` | Create a crew member in this crew: `{username, password, sex}` (`sex` is `"male"` or `"female"`) |
| PATCH | `/api/admin/astronauts/{id}` | Correct a crew member's details: `{sex}` |
| POST | `/api/admin/astronauts/{id}/password` | Set a new password: `{newPassword}` |
| DELETE | `/api/admin/astronauts/{id}` | Delete a crew account with all its readings |
| GET | `/api/admin/astronauts/{id}/status` | That crew member's status |
| GET | `/api/admin/astronauts/{id}/alerts` | That crew member's alerts |
| GET | `/api/admin/astronauts/{id}/checklist` | That crew member's checklist |
| GET | `/api/admin/astronauts/{id}/readings?indicator=spo2&days=30` | That crew member's history |

### Superadmin only

| Method | Path | What it does |
|---|---|---|
| GET | `/api/superadmin/crews` | Every crew with its member and mission control counts |
| POST | `/api/superadmin/crews` | Create a crew: `{name}` (2-60 characters, unique ignoring case) |
| DELETE | `/api/superadmin/crews/{id}` | Delete a crew. Only an empty crew can be deleted (409 if it still has members or mission control) |
| GET | `/api/superadmin/crews/{id}/admins` | The mission control accounts of one crew |
| POST | `/api/superadmin/crews/{id}/admins` | Create a mission control account for a crew: `{username, password}` |
| PUT | `/api/admin/readings/{id}` | Correct any reading: `{values, takenAt?}` |
| DELETE | `/api/admin/readings/{id}` | Delete any reading |

### Example: save a reading

```http
POST /api/readings
{
  "indicatorId": "heart_rate",
  "values": { "bpm": 72 },
  "takenAt": "2026-11-14T08:00:00Z"
}
```

`takenAt` is optional. Leave it out and the server uses the current time.

Response:

```json
{
  "indicatorId": "heart_rate",
  "status": "normal",
  "message": "Heart rate is in the normal range.",
  "escalate": false
}
```

`escalate` is `true` only for **urgent**. It means "contact the flight surgeon".

A reading is rejected with **400** (and not saved) if the indicator is
unknown, a required value is missing, a value key is unknown, a value is
outside its allowed limits, a whole-number value has decimals, or `takenAt`
is in the future.
`GET /api/readings` returns **400** for an unknown indicator.

### Response shapes

- `GET /api/readings`: `[{id, indicatorId, values, takenAt}]`, oldest first.
  Use `id` to correct or delete a reading.
- `GET /api/admin/astronauts`: `[{astronautId, username, sex, createdAt, status, alertCount}]`,
  where `status` is the worst status over all of that crew member's indicators
- `GET /api/status`: `{regions: [{regionId, status, indicators: [StatusResult]}]}`
- `GET /api/checklist`: `{items: [{indicatorId, due, lastTakenAt}], streak, points}`
  - `due` = no reading within the indicator's `dueEveryHours`
  - `streak` = days in a row (UTC) with at least one reading
  - `points` = number of readings x `pointsPerReading`
- `GET /api/alerts`: `[StatusResult]` with caution or urgent, urgent first
- `GET /api/indicators`: `[{indicatorId, region, dueEveryHours, values}]`, where
  `values` maps each value key to `{limits, normal, caution, optional, wholeNumber}`

`StatusResult` is the shape shown in the example response above.

## Indicators

| Indicator | Values | Body region |
|---|---|---|
| `heart_rate` | `bpm` | heart |
| `blood_pressure` | `systolic`, `diastolic` | heart |
| `spo2` | `percent` (optional `breathsPerMinute`) | lungs |
| `temperature` | `celsius` | body |
| `sleep` | `hours`, `quality` (1-5) | head |
| `mood_stress` | `mood`, `stress`, `isolation` (each 1-5) | head |
| `exercise` | `minutes`, `effort` (1-5) | legs_spine |
| `vision` | `newBlur` (0 or 1), `clarity` (1-5) | eyes |
| `cabin_co2` | `ppm` | habitat |
| `radiation` | `totalMsv` | habitat |

A region's status is the worst status among its indicators. An indicator with
no reading yet is **unknown**. Unknown never makes a region look worse.

## How the rating works

Every number lives in `app/data/rules.json`. None are written into the code.
Each value has three ranges, written as `[min, max]` with both ends included:

- `limits`: the only values accepted at all (anything else is treated as a typo)
- `normal`: inside this range = **normal**
- `caution`: inside this range (but not normal) = **caution**
- outside `caution` = **urgent**

If an indicator has several values, it gets the worst of their ratings.

Optional flags per value:
- `"optional": true`: the value may be left out
- `"wholeNumber": true`: decimals are rejected (used for 1-5 scales and `newBlur`)
- `"simulation": { "min", "max", "whole" }`: the range the app's simulated sensors (auto mode) pick random values from. It must lie inside `limits`. The app reads it from `GET /api/indicators`.

`rules.json` also holds:
- `region` per indicator: which body region it belongs to
- `dueEveryHours` per indicator, which the checklist uses
- `pointsPerReading`, used for points

The file is re-read on every request, so changes apply without restarting the
server. At startup the server checks that nothing required is missing and
refuses to start with a list of problems if something is. Keep it valid JSON:
a missing comma breaks every endpoint until it's fixed.

## Adding a new indicator or value

Everything is driven by `rules.json`, so no code changes are needed:

- **New value in an existing indicator** (e.g. `anxiety` in `mood_stress`):
  add an entry under that indicator's `values`.
- **New indicator** (e.g. `hydration`): add a block under `indicators` with
  `region`, `dueEveryHours`, `values` and `messages` (`normal`, `caution`,
  `urgent`). It then works in every endpoint.

The frontend also has to show the new indicator. `GET /api/indicators` lists
every indicator and its values, so forms can be built from it.

## Database

PostgreSQL, through the `psycopg` library. The database runs on a hosted
service (e.g. Neon), so everyone on the team and every device share the
same data. The address comes from `DATABASE_URL` in `.env`.

Opening a connection to a hosted database takes about 0.3 s, so the backend
keeps a few connections open and reuses them (`psycopg-pool`).

Three tables, created automatically on first start:

| Table | Columns | Holds |
|---|---|---|
| `crews` | `id`, `name`, `created_at` | One row per crew |
| `astronauts` | `id`, `username`, `password_hash`, `is_admin`, `is_superadmin`, `sex`, `crew_id`, `created_at` | One row per account (crew, mission control and superadmin) |
| `sessions` | `token` (hashed), `astronaut_id`, `created_at` | One row per login token |
| `readings` | `id`, `astronaut_id`, `indicator_id`, `reading_values`, `taken_at` | One row per measurement |

`reading_values` is a JSON column (e.g. `{"bpm": 72}`). That's what makes new
indicators possible without changing the table. Ratings are not stored:
they're worked out from `rules.json` when needed, so changing a range also
updates old readings. Deleting an astronaut also deletes their readings and
tokens.

## Project structure

```
app/
  main.py          app setup, CORS, includes the router
  routes.py        API endpoints for login and crew members
  admin_routes.py  API endpoints for mission control of one crew (/api/admin/...)
  superadmin_routes.py  API endpoints for the superadmin: crews (/api/superadmin/...)
  health.py        reading checks, status per region, alerts (shared by both)
  database.py      PostgreSQL: astronauts, sessions and readings tables
  auth.py          password hashing, login tokens, role checks
  create_superadmin.py  terminal script that creates the superadmin account
  schemas.py       request/response shapes (Pydantic)
  status_rules.py  rating logic, reads rules.json
  checklist.py     due measurements, streak and points
  data/
    rules.json     all indicators, regions and numeric ranges (estimates)
test_backend.py    automated tests (python -m unittest -v)
```

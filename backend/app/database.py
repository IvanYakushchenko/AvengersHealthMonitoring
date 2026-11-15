import atexit
import hashlib
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

ENV_PATH = Path(__file__).parent.parent / ".env"

# How long a login stays valid.
SESSION_DAYS = 30

# The open connections to PostgreSQL, shared by all requests (made on first use).
pool = None


# Read KEY=VALUE lines from the .env file (if there is one) into the environment.
# Quotes around a value are removed, e.g. DATABASE_URL="postgresql://...".
def load_env_file():
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


# Get the database address from DATABASE_URL, with a clear error if it is missing.
def get_database_url():
    load_env_file()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy .env to .env and fill it in.")
    return url


# Open the shared connections the first time they are needed.
# Opening a connection to Neon takes ~0.3 s, so we keep a few open and reuse them.
def get_pool():
    global pool
    if pool is None:
        pool = ConnectionPool(
            get_database_url(),
            min_size=1,
            max_size=10,
            # Rows behave like dicts. autocommit saves each statement right away
            # (one less trip to Neon). prepare_threshold=None keeps it working with
            # Neon's pooled address. connect_timeout stops it from hanging forever.
            kwargs={
                "row_factory": dict_row,
                "autocommit": True,
                "prepare_threshold": None,
                "connect_timeout": 10,
            },
            # Test each connection before using it, in case Neon closed it while idle.
            check=ConnectionPool.check_connection,
        )
        atexit.register(pool.close)
    return pool


# Borrow a connection to PostgreSQL. Rows behave like dicts.
# Use it as "with get_connection() as conn:" so it goes back to the pool by itself.
# Each statement is saved right away. For several statements that must all succeed
# or all fail, put them inside "with conn.transaction():".
def get_connection():
    return get_pool().connection()


# One-time data fixes for databases made before crews existed. Safe to run every start.
# - Mission control accounts from before crews become superadmins (they had full control).
# - Crew members without a crew go into a "Default crew".
def migrate_to_crews(conn):
    conn.execute(
        "UPDATE astronauts SET is_superadmin = true, is_admin = false WHERE is_admin AND crew_id IS NULL"
    )
    conn.execute(
        """
        INSERT INTO crews (name)
        SELECT 'Default crew'
        WHERE EXISTS (SELECT 1 FROM astronauts WHERE crew_id IS NULL AND NOT is_superadmin)
        ON CONFLICT DO NOTHING
        """
    )
    conn.execute(
        """
        UPDATE astronauts SET crew_id = (SELECT id FROM crews WHERE lower(name) = 'default crew')
        WHERE crew_id IS NULL AND NOT is_superadmin
        """
    )


# Create the tables if they do not exist yet.
def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS astronauts (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT false,
                sex TEXT CHECK (sex IN ('male', 'female')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        # Tables made before these columns existed get them here.
        conn.execute(
            "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false"
        )
        conn.execute(
            "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'))"
        )
        # Crews. Every crew member and mission control account belongs to one crew.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crews (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS crews_name_lower ON crews (lower(name))")
        conn.execute(
            "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS crew_id INTEGER REFERENCES crews(id)"
        )
        conn.execute(
            "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false"
        )
        migrate_to_crews(conn)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,  -- sha256 of the token, never the token itself
                astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS readings (
                id SERIAL PRIMARY KEY,
                astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
                indicator_id TEXT NOT NULL,
                reading_values JSONB NOT NULL,
                taken_at TIMESTAMPTZ NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS readings_lookup
            ON readings (astronaut_id, indicator_id, taken_at)
            """
        )


# ---------- astronauts and logins ----------

# Columns of an account, with its crew's name. Used by every lookup that returns an account.
ACCOUNT_SELECT = """
    SELECT a.id, a.username, a.password_hash, a.is_admin, a.is_superadmin, a.sex,
           a.crew_id, c.name AS crew_name, a.created_at
    FROM astronauts a LEFT JOIN crews c ON c.id = a.crew_id
"""


# Save a new account and return its id, or None if the username is taken.
# Roles: superadmin (is_superadmin, no crew), mission control (is_admin, in a crew),
# crew member (neither, in a crew). sex is "male" or "female" (crew members only).
def create_astronaut(username, password_hash, *, is_admin=False, is_superadmin=False, sex=None, crew_id=None):
    with get_connection() as conn:
        row = conn.execute(
            """
            INSERT INTO astronauts (username, password_hash, is_admin, is_superadmin, sex, crew_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING
            RETURNING id
            """,
            (username, password_hash, is_admin, is_superadmin, sex, crew_id),
        ).fetchone()
    if row is None:
        return None
    return row["id"]


# Find an account by username (with its password hash), or None.
def get_astronaut_by_username(username):
    with get_connection() as conn:
        return conn.execute(ACCOUNT_SELECT + " WHERE a.username = %s", (username,)).fetchone()


# Find an account by id (with its password hash), or None.
def get_astronaut_by_id(astronaut_id):
    with get_connection() as conn:
        return conn.execute(ACCOUNT_SELECT + " WHERE a.id = %s", (astronaut_id,)).fetchone()


# List one crew's members (not mission control), oldest first.
def list_crew(crew_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT id, username, sex, created_at FROM astronauts
            WHERE crew_id = %s AND NOT is_admin AND NOT is_superadmin
            ORDER BY id
            """,
            (crew_id,),
        ).fetchall()


# Create a crew. Returns its id, or None if the name is taken (ignoring case).
def create_crew(name):
    with get_connection() as conn:
        row = conn.execute(
            "INSERT INTO crews (name) VALUES (%s) ON CONFLICT DO NOTHING RETURNING id", (name,)
        ).fetchone()
    return None if row is None else row["id"]


# Find a crew by id, or None.
def get_crew(crew_id):
    with get_connection() as conn:
        return conn.execute("SELECT id, name, created_at FROM crews WHERE id = %s", (crew_id,)).fetchone()


# All crews with how many crew members and mission control accounts each has.
def list_crews():
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT c.id, c.name, c.created_at,
                   COUNT(a.id) FILTER (WHERE NOT a.is_admin AND NOT a.is_superadmin) AS member_count,
                   COUNT(a.id) FILTER (WHERE a.is_admin) AS admin_count
            FROM crews c LEFT JOIN astronauts a ON a.crew_id = c.id
            GROUP BY c.id ORDER BY c.id
            """
        ).fetchall()


# One crew's mission control accounts, oldest first.
def list_crew_admins(crew_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT id, username, created_at FROM astronauts WHERE crew_id = %s AND is_admin ORDER BY id",
            (crew_id,),
        ).fetchall()


# Delete a crew. Returns False (and deletes nothing) if the crew still has accounts in it.
def delete_crew(crew_id):
    with get_connection() as conn:
        deleted = conn.execute(
            """
            DELETE FROM crews WHERE id = %s
            AND NOT EXISTS (SELECT 1 FROM astronauts WHERE crew_id = %s)
            """,
            (crew_id, crew_id),
        ).rowcount
    return deleted > 0


# Change a crew member's sex ("male" or "female").
def set_sex(astronaut_id, sex):
    with get_connection() as conn:
        conn.execute("UPDATE astronauts SET sex = %s WHERE id = %s", (sex, astronaut_id))


# Delete a crew account with all its readings and logins. False if not found.
# Mission control accounts can't be deleted this way.
def delete_crew_member(astronaut_id):
    with get_connection() as conn:
        deleted = conn.execute(
            "DELETE FROM astronauts WHERE id = %s AND NOT is_admin AND NOT is_superadmin",
            (astronaut_id,),
        ).rowcount
    return deleted > 0


# Set a new password hash and log the account out everywhere (both or neither).
def set_password(astronaut_id, password_hash):
    with get_connection() as conn, conn.transaction():
        conn.execute(
            "UPDATE astronauts SET password_hash = %s WHERE id = %s",
            (password_hash, astronaut_id),
        )
        conn.execute("DELETE FROM sessions WHERE astronaut_id = %s", (astronaut_id,))


# Tokens are stored only as a hash, so a leaked database can't be used to log in.
def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


# The oldest time a login can have been made and still be valid.
def oldest_valid_login():
    return datetime.now(timezone.utc) - timedelta(days=SESSION_DAYS)


# Remember a login token for an astronaut, and clean out expired ones.
def save_session(token, astronaut_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE created_at < %s", (oldest_valid_login(),))
        conn.execute(
            "INSERT INTO sessions (token, astronaut_id) VALUES (%s, %s)",
            (hash_token(token), astronaut_id),
        )


# Find the astronaut who owns a login token, or None if it is unknown or too old.
def get_astronaut_by_token(token):
    with get_connection() as conn:
        return conn.execute(
            ACCOUNT_SELECT
            + """
            JOIN sessions ON sessions.astronaut_id = a.id
            WHERE sessions.token = %s AND sessions.created_at >= %s
            """,
            (hash_token(token), oldest_valid_login()),
        ).fetchone()


# Forget a login token (log out).
def delete_session(token):
    with get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token = %s", (hash_token(token),))


# ---------- readings ----------

# Turn one database row into a Reading-shaped dict.
def row_to_reading(row):
    return {
        "id": row["id"],
        "astronautId": row["astronaut_id"],
        "indicatorId": row["indicator_id"],
        "values": row["reading_values"],
        "takenAt": row["taken_at"],
    }


# Save one reading for an astronaut. If taken_at is None, use the current time.
# A time without a timezone is treated as UTC.
def save_reading(astronaut_id, indicator_id, values, taken_at):
    if taken_at is None:
        taken_at = datetime.now(timezone.utc)
    if taken_at.tzinfo is None:
        taken_at = taken_at.replace(tzinfo=timezone.utc)
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO readings (astronaut_id, indicator_id, reading_values, taken_at)
            VALUES (%s, %s, %s, %s)
            """,
            (astronaut_id, indicator_id, Jsonb(values), taken_at),
        )


# Get one reading by its id, or None.
def get_reading(reading_id):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM readings WHERE id = %s", (reading_id,)).fetchone()
    if row is None:
        return None
    return row_to_reading(row)


# Replace the values and time of one reading.
def update_reading(reading_id, values, taken_at):
    if taken_at.tzinfo is None:
        taken_at = taken_at.replace(tzinfo=timezone.utc)
    with get_connection() as conn:
        conn.execute(
            "UPDATE readings SET reading_values = %s, taken_at = %s WHERE id = %s",
            (Jsonb(values), taken_at, reading_id),
        )


# Delete one reading.
def delete_reading(reading_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM readings WHERE id = %s", (reading_id,))


# Get one astronaut's readings for one indicator from the last `days` days, oldest first.
def get_readings(astronaut_id, indicator_id, days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM readings
            WHERE astronaut_id = %s AND indicator_id = %s AND taken_at >= %s
            ORDER BY taken_at
            """,
            (astronaut_id, indicator_id, cutoff),
        ).fetchall()
    return [row_to_reading(row) for row in rows]


# Get the newest reading of every indicator for one astronaut,
# as a dict like {"heart_rate": {...reading...}, "spo2": {...}}.
def get_latest_readings(astronaut_id):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT ON (indicator_id) * FROM readings
            WHERE astronaut_id = %s
            ORDER BY indicator_id, taken_at DESC
            """,
            (astronaut_id,),
        ).fetchall()
    return {row["indicator_id"]: row_to_reading(row) for row in rows}


# Get the newest reading of every indicator for every member of one crew in one query,
# as {astronaut_id: {"heart_rate": {...reading...}, ...}}.
def get_latest_readings_for_crew(crew_id):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT ON (r.astronaut_id, r.indicator_id) r.* FROM readings r
            JOIN astronauts a ON a.id = r.astronaut_id
            WHERE a.crew_id = %s
            ORDER BY r.astronaut_id, r.indicator_id, r.taken_at DESC
            """,
            (crew_id,),
        ).fetchall()
    latest = {}
    for row in rows:
        latest.setdefault(row["astronaut_id"], {})[row["indicator_id"]] = row_to_reading(row)
    return latest


# Count one astronaut's readings per day (UTC), e.g. {date(2026, 11, 14): 3, ...}.
# Used for the streak (which days) and points (how many in total).
def count_readings_per_day(astronaut_id):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT (taken_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
            FROM readings WHERE astronaut_id = %s
            GROUP BY day
            """,
            (astronaut_id,),
        ).fetchall()
    return {row["day"]: row["count"] for row in rows}

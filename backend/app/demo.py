# Code was assisted with Claude Code.
# Demo data for presentations: create a small, clearly labelled crew, or remove it again.
#
#   python -m app.demo seed --demo    creates the demo crew, its accounts and 14 days of readings
#   python -m app.demo reset --demo   removes only the demo accounts and the demo crew
#
# Everything created here has a name starting with "demo_" or is the crew "Demo Crew".
# The --demo flag is required, so the script cannot be run by accident. The demo passwords
# are public (they are in the README): never use this on a database with real people in it.
import argparse
import math
import random
import sys
from datetime import datetime, timedelta, timezone

from psycopg.types.json import Jsonb
from psycopg.conninfo import conninfo_to_dict

from app import auth, database, status_rules

DEMO_CREW = "Demo Crew"
DEMO_PASSWORD = "demo-password-2026"
DEMO_SUPERADMIN = "demo_superadmin"
DEMO_CONTROL = "demo_control"
# (username, sex) of the crew members. Their readings are generated below.
DEMO_MEMBERS = [("demo_anna", "female"), ("demo_max", "male"), ("demo_lena", "female")]
DEMO_USERNAMES = [DEMO_SUPERADMIN, DEMO_CONTROL] + [name for name, _ in DEMO_MEMBERS]
DAYS = 14  # one set of readings per day, so the streak is 14 days


# One realistic set of values for one indicator, from the simulation ranges in rules.json.
# Each value is inside its allowed limits, so the backend can rate it.
def simulated_values(indicator_id, rng, rules):
    values = {}
    for key, rule in rules["indicators"][indicator_id]["values"].items():
        simulation = rule.get("simulation")
        if simulation is None:
            continue
        if rule.get("optional") and rng.random() < 0.2:
            continue  # some sensors skip optional values, as in the app's Auto mode
        if simulation.get("whole"):
            values[key] = rng.randint(math.ceil(simulation["min"]), math.floor(simulation["max"]))
        else:
            values[key] = round(rng.uniform(simulation["min"], simulation["max"]), 1)
    if indicator_id == "blood_pressure" and values.get("diastolic", 0) >= values.get("systolic", 0):
        values["diastolic"] = values["systolic"] - 20
    return values


# Show which database will be changed (the host only, never the password).
def describe_database():
    host = conninfo_to_dict(database.get_database_url()).get("host", "unknown host")
    print(f"Database host: {host}")


# Create the demo crew, its accounts and the readings. Refuses to run twice.
def seed():
    if database.get_astronaut_by_username(DEMO_SUPERADMIN) is not None:
        print("The demo data already exists. Run 'python -m app.demo reset --demo' first.")
        return 1
    with database.get_connection() as conn:
        taken = conn.execute("SELECT 1 FROM crews WHERE name = %s", (DEMO_CREW,)).fetchone()
    if taken:
        print(f"A crew named '{DEMO_CREW}' already exists. Run the reset first.")
        return 1

    password_hash = auth.hash_password(DEMO_PASSWORD)
    database.create_astronaut(DEMO_SUPERADMIN, password_hash, is_superadmin=True)
    crew_id = database.create_crew(DEMO_CREW)
    database.create_astronaut(DEMO_CONTROL, password_hash, is_admin=True, crew_id=crew_id)

    rules = status_rules.load_rules()
    rng = random.Random(2026)  # the same demo data every time
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    readings = 0
    for username, sex in DEMO_MEMBERS:
        member_id = database.create_astronaut(username, password_hash, sex=sex, crew_id=crew_id)
        with database.get_connection() as conn, conn.transaction():
            for day in range(DAYS, 0, -1):
                morning = now - timedelta(days=day, hours=now.hour - 8)
                for index, indicator_id in enumerate(rules["indicators"]):
                    values = simulated_values(indicator_id, rng, rules)
                    if not values or status_rules.rate_reading(indicator_id, values)["status"] == "unknown":
                        continue
                    taken_at = morning + timedelta(minutes=index * 5)
                    conn.execute(
                        "INSERT INTO readings (astronaut_id, indicator_id, reading_values, taken_at) VALUES (%s, %s, %s, %s)",
                        (member_id, indicator_id, Jsonb(values), taken_at),
                    )
                    readings += 1

    describe_database()
    print(f"Created crew '{DEMO_CREW}' with {len(DEMO_MEMBERS)} crew members and {readings} readings.")
    print(f"Superadmin: {DEMO_SUPERADMIN}   Mission control: {DEMO_CONTROL}")
    print(f"Crew members: {', '.join(name for name, _ in DEMO_MEMBERS)}")
    print(f"Password for all demo accounts: {DEMO_PASSWORD}")
    return 0


# Remove the demo accounts (their readings and logins go with them) and the demo crew.
def reset():
    with database.get_connection() as conn, conn.transaction():
        removed = conn.execute(
            "DELETE FROM astronauts WHERE username = ANY(%s)", (DEMO_USERNAMES,)
        ).rowcount
        crew_deleted = conn.execute(
            """
            DELETE FROM crews WHERE name = %s
            AND NOT EXISTS (SELECT 1 FROM astronauts WHERE crew_id = crews.id)
            """,
            (DEMO_CREW,),
        ).rowcount
    describe_database()
    print(f"Removed {removed} demo accounts and {crew_deleted} demo crew.")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Create or remove the demo crew for presentations.")
    parser.add_argument("command", choices=["seed", "reset"])
    parser.add_argument("--demo", action="store_true", help="required: confirms you want demo data changed")
    args = parser.parse_args(argv)
    if not args.demo:
        print("Refusing to run without --demo. Example: python -m app.demo seed --demo")
        return 1
    database.init_db()
    return seed() if args.command == "seed" else reset()


if __name__ == "__main__":
    sys.exit(main())

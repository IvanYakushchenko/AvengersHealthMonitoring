from datetime import datetime, timedelta, timezone

from app import database, status_rules


# Count how many days in a row (ending today, or yesterday) have a reading.
def count_streak(reading_days, today):
    day = today
    if day not in reading_days:
        day = day - timedelta(days=1)
    streak = 0
    while day in reading_days:
        streak += 1
        day = day - timedelta(days=1)
    return streak


# Check one indicator: is it due, and when was it last measured.
def checklist_item(indicator_id, latest, due_every_hours, now):
    if latest is None:
        return {"indicatorId": indicator_id, "due": True, "lastTakenAt": None}
    last_time = latest["takenAt"]
    due = now - last_time >= timedelta(hours=due_every_hours)
    return {"indicatorId": indicator_id, "due": due, "lastTakenAt": last_time}


# Build one astronaut's checklist: one item per indicator, plus streak and points.
def build_checklist(astronaut_id):
    rules = status_rules.load_rules()
    now = datetime.now(timezone.utc)
    latest = database.get_latest_readings(astronaut_id)
    per_day = database.count_readings_per_day(astronaut_id)
    items = [
        checklist_item(indicator_id, latest.get(indicator_id), indicator_rules["dueEveryHours"], now)
        for indicator_id, indicator_rules in rules["indicators"].items()
    ]
    return {
        "items": items,
        "streak": count_streak(set(per_day), now.date()),
        "points": sum(per_day.values()) * rules["pointsPerReading"],
    }

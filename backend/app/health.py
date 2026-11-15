# Code was assisted with Claude.
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app import database, status_rules

# How far in the future takenAt may be, to allow for clocks that are a bit off.
CLOCK_TOLERANCE = timedelta(minutes=5)


# True if takenAt is in the future (a time without a timezone counts as UTC).
def is_in_future(taken_at):
    if taken_at.tzinfo is None:
        taken_at = taken_at.replace(tzinfo=timezone.utc)
    return taken_at > datetime.now(timezone.utc) + CLOCK_TOLERANCE


# Check a reading before saving it and return its rating.
# personal = the crew member's personal ranges (None = defaults).
# Stops the request with a 400 error if it can't be rated.
def check_reading(indicator_id, values, taken_at, personal=None):
    if not status_rules.has_rules(indicator_id):
        raise HTTPException(400, f"Unknown indicator: {indicator_id}")
    if taken_at is not None and is_in_future(taken_at):
        raise HTTPException(400, "takenAt cannot be in the future")
    result = status_rules.rate_reading(indicator_id, values, personal)
    if result["status"] == "unknown":
        raise HTTPException(400, result["message"])
    return result


# Stop with a 400 error if the indicator has no rules.
def check_indicator(indicator_id):
    if not status_rules.has_rules(indicator_id):
        raise HTTPException(400, f"Unknown indicator: {indicator_id}")


# Rate the newest reading of every indicator for one astronaut, with their personal ranges.
# Returns {indicator_id: StatusResult}; "unknown" where there is no reading yet.
def latest_statuses(astronaut_id):
    account = database.get_astronaut_by_id(astronaut_id)
    return rate_latest(database.get_latest_readings(astronaut_id), account["personal_ranges"])


# Rate newest readings given as {indicator_id: reading}, using the personal ranges
# (None = defaults). Same answer as latest_statuses.
def rate_latest(latest, personal=None):
    results = {}
    for indicator_id in status_rules.load_rules()["indicators"]:
        if indicator_id in latest:
            results[indicator_id] = status_rules.rate_reading(indicator_id, latest[indicator_id]["values"], personal)
        else:
            results[indicator_id] = status_rules.unknown_result(indicator_id, "No reading yet.")
    return results


# Status per body region and per indicator, shaped like StatusOverview.
def status_overview(astronaut_id):
    statuses = latest_statuses(astronaut_id)
    regions = []
    for region_id, indicator_ids in status_rules.get_regions().items():
        results = [statuses[i] for i in indicator_ids]
        regions.append({
            "regionId": region_id,
            "status": status_rules.worst_status([r["status"] for r in results]),
            "indicators": results,
        })
    return {"regions": regions}


# Indicators whose newest reading is caution or urgent, urgent first.
def alerts(astronaut_id):
    found = [r for r in latest_statuses(astronaut_id).values() if r["status"] in ("caution", "urgent")]
    found.sort(key=lambda r: status_rules.STATUS_RANK[r["status"]], reverse=True)
    return found

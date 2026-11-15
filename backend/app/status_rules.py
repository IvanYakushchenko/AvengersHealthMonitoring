import json
from pathlib import Path

RULES_PATH = Path(__file__).parent / "data" / "rules.json"

# Higher number = worse. "unknown" is lowest so it never hides a real problem.
STATUS_RANK = {"unknown": -1, "normal": 0, "caution": 1, "urgent": 2}


# Read rules.json fresh every time, so edits apply without a restart.
def load_rules():
    with open(RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


# Group indicators by body region, e.g. {"heart": ["heart_rate", "blood_pressure"], ...}.
def get_regions():
    regions = {}
    for indicator_id, indicator_rules in load_rules()["indicators"].items():
        regions.setdefault(indicator_rules["region"], []).append(indicator_id)
    return regions


# True if x is a number (int or float).
def is_number(x):
    return isinstance(x, (int, float))


# True if x is a range like [min, max]: two numbers with min <= max.
def is_range(x):
    return isinstance(x, list) and len(x) == 2 and all(is_number(n) for n in x) and x[0] <= x[1]


# Check that rules.json has everything the code needs. Returns a list of problems.
def find_rules_problems():
    try:
        rules = load_rules()
    except json.JSONDecodeError as error:
        return [f"not valid JSON at line {error.lineno}, column {error.colno}: {error.msg}"]
    problems = []
    if not is_number(rules.get("pointsPerReading")):
        problems.append("pointsPerReading is missing or not a number")
    if not rules.get("indicators"):
        problems.append("'indicators' is missing or empty")
    for indicator_id, indicator_rules in rules.get("indicators", {}).items():
        for field in ("region", "values", "messages"):
            if field not in indicator_rules:
                problems.append(f"{indicator_id}: '{field}' is missing")
        if not is_number(indicator_rules.get("dueEveryHours")):
            problems.append(f"{indicator_id}: 'dueEveryHours' is missing or not a number")
        for status in ("normal", "caution", "urgent"):
            if status not in indicator_rules.get("messages", {}):
                problems.append(f"{indicator_id}: message for '{status}' is missing")
        for key, rule in indicator_rules.get("values", {}).items():
            for field in ("limits", "normal", "caution"):
                if not is_range(rule.get(field)):
                    problems.append(f"{indicator_id}.{key}: '{field}' must be [min, max] with min <= max")
            # Optional simulation range (used by the app's simulated sensors). Must lie inside the limits.
            simulation = rule.get("simulation")
            if simulation is not None:
                low, high = simulation.get("min"), simulation.get("max")
                if not (is_number(low) and is_number(high) and low <= high):
                    problems.append(f"{indicator_id}.{key}: 'simulation' needs min <= max numbers")
                elif is_range(rule.get("limits")) and not (rule["limits"][0] <= low and high <= rule["limits"][1]):
                    problems.append(f"{indicator_id}.{key}: 'simulation' must lie inside 'limits'")
    return problems


# Get the rules for one indicator, or None if there are none.
def get_indicator_rules(indicator_id):
    return load_rules()["indicators"].get(indicator_id)


# True if rules.json has rules for this indicator.
def has_rules(indicator_id):
    return get_indicator_rules(indicator_id) is not None


# Rate one number against its normal and caution ranges.
def rate_value(value, rule):
    low, high = rule["normal"]
    if low <= value <= high:
        return "normal"
    low, high = rule["caution"]
    if low <= value <= high:
        return "caution"
    return "urgent"


# Return the worst status from a list, e.g. ["normal", "caution"] -> "caution".
def worst_status(statuses):
    if not statuses:
        return "unknown"
    return max(statuses, key=lambda s: STATUS_RANK[s])


# Rate a whole reading and return a dict shaped like StatusResult.
def rate_reading(indicator_id, values):
    indicator_rules = get_indicator_rules(indicator_id)
    if indicator_rules is None:
        return unknown_result(indicator_id, "No rules for this indicator yet.")

    for key in values:
        if key not in indicator_rules["values"]:
            return unknown_result(indicator_id, f"Unknown value: {key}")

    statuses = []
    for key, rule in indicator_rules["values"].items():
        if key not in values:
            if rule.get("optional"):
                continue
            return unknown_result(indicator_id, f"Missing value: {key}")
        low, high = rule["limits"]
        if not low <= values[key] <= high:
            return unknown_result(indicator_id, f"{key} must be between {low} and {high}")
        if rule.get("wholeNumber") and values[key] != int(values[key]):
            return unknown_result(indicator_id, f"{key} must be a whole number")
        statuses.append(rate_value(values[key], rule))

    status = worst_status(statuses)
    return {
        "indicatorId": indicator_id,
        "status": status,
        "message": indicator_rules["messages"][status],
        "escalate": status == "urgent",
    }


# Build an "unknown" result with a reason.
def unknown_result(indicator_id, message):
    return {
        "indicatorId": indicator_id,
        "status": "unknown",
        "message": message,
        "escalate": False,
    }

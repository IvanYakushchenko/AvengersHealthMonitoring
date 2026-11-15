# Code was assisted with Claude.
# Personal "normal" and "caution" ranges for one crew member. Set by the superadmin.
# Everyone starts with the defaults in rules.json; a personal range replaces the default
# for one value (e.g. heart_rate.bpm) and is stored on the astronaut's account.
from app import status_rules


# True if x is a whole number (e.g. 3 or 3.0).
def is_whole(x):
    return float(x).is_integer()


# Find the rules for one value, or None if the indicator or value does not exist.
def find_value_rule(indicator_id, value_key):
    indicator_rules = status_rules.get_indicator_rules(indicator_id)
    if indicator_rules is None:
        return None
    return indicator_rules["values"].get(value_key)


# Check a proposed personal range. Returns a message for the first problem, or None if it is fine.
def find_problem(indicator_id, value_key, normal, caution):
    rule = find_value_rule(indicator_id, value_key)
    if rule is None:
        return f"Unknown indicator or value: {indicator_id}.{value_key}"
    if not status_rules.is_range(normal) or not status_rules.is_range(caution):
        return "normal and caution must each be [min, max] with min <= max"
    low, high = rule["limits"]
    if not (low <= caution[0] and caution[1] <= high):
        return f"caution must lie between {low} and {high}"
    if not (caution[0] <= normal[0] and normal[1] <= caution[1]):
        return "normal must lie inside caution"
    if rule.get("wholeNumber") and not all(is_whole(x) for x in normal + caution):
        return "this value only accepts whole numbers"
    return None


# One row per value: its defaults, the range in use, and whether it is personal.
def row(indicator_id, value_key, rule, personal):
    override = (personal or {}).get(indicator_id, {}).get(value_key)
    return {
        "indicatorId": indicator_id,
        "valueKey": value_key,
        "limits": rule["limits"],
        "defaultNormal": rule["normal"],
        "defaultCaution": rule["caution"],
        "normal": override["normal"] if override else rule["normal"],
        "caution": override["caution"] if override else rule["caution"],
        "isPersonal": override is not None,
    }


# Rows for every value of every indicator, in rules.json order.
def rows(personal):
    result = []
    for indicator_id, indicator in status_rules.load_rules()["indicators"].items():
        for value_key, rule in indicator["values"].items():
            result.append(row(indicator_id, value_key, rule, personal))
    return result

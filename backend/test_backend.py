# Code was assisted with Claude.
# Automated tests for the backend. Run them from the project folder:
#
#     python -m unittest -v
#
# RulesTests need nothing: they test the rating logic with made-up rules, so they
# keep working when the numbers in rules.json change.
#
# ApiTests start the real server and use the database: TEST_DATABASE_URL from .env
# if it's set (e.g. a Neon branch), otherwise DATABASE_URL. They only create accounts
# whose names start with "test_" and delete exactly those accounts at the end.
import json
import os
import socket
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from app import database

# Use the test database if there is one. This must happen before anything connects.
database.load_env_file()
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

from pydantic import ValidationError  # noqa: E402

from app import auth, checklist, status_rules  # noqa: E402
from app.schemas import Credentials  # noqa: E402

PASSWORD = "test-password-1"

# Small made-up rules for RulesTests.
TEST_RULES = {
    "pointsPerReading": 10,
    "indicators": {
        "pulse": {
            "region": "heart",
            "dueEveryHours": 24,
            "values": {
                "bpm": {"limits": [20, 250], "normal": [60, 100], "caution": [50, 120]},
                "breaths": {"limits": [1, 80], "normal": [12, 20], "caution": [10, 24], "optional": True},
            },
            "messages": {"normal": "ok", "caution": "watch it", "urgent": "call now"},
        },
        "mood": {
            "region": "head",
            "dueEveryHours": 24,
            "values": {"score": {"limits": [1, 5], "normal": [3, 5], "caution": [2, 5], "wholeNumber": True}},
            "messages": {"normal": "ok", "caution": "low", "urgent": "very low"},
        },
    },
}


# A new unique username like "test_3f9a1c2b7d".
def unique_name():
    return "test_" + uuid.uuid4().hex[:10]


# ---------- tests without the server or database ----------

class RulesTests(unittest.TestCase):

    # Run every test here with TEST_RULES instead of rules.json.
    def setUp(self):
        patcher = mock.patch.object(status_rules, "load_rules", return_value=TEST_RULES)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_rate_value_uses_normal_then_caution_range(self):
        rule = TEST_RULES["indicators"]["pulse"]["values"]["bpm"]
        self.assertEqual(status_rules.rate_value(72, rule), "normal")
        self.assertEqual(status_rules.rate_value(100, rule), "normal")  # range ends count
        self.assertEqual(status_rules.rate_value(115, rule), "caution")
        self.assertEqual(status_rules.rate_value(50, rule), "caution")
        self.assertEqual(status_rules.rate_value(49, rule), "urgent")
        self.assertEqual(status_rules.rate_value(140, rule), "urgent")

    def test_reading_gets_worst_value_and_escalates_when_urgent(self):
        result = status_rules.rate_reading("pulse", {"bpm": 72, "breaths": 30})
        self.assertEqual(result["status"], "urgent")
        self.assertEqual(result["message"], "call now")
        self.assertTrue(result["escalate"])
        result = status_rules.rate_reading("pulse", {"bpm": 115})
        self.assertEqual((result["status"], result["escalate"]), ("caution", False))

    def test_optional_value_can_be_left_out(self):
        self.assertEqual(status_rules.rate_reading("pulse", {"bpm": 72})["status"], "normal")

    def test_bad_readings_are_unknown_with_a_reason(self):
        cases = {
            "Missing value: bpm": ("pulse", {"breaths": 15}),
            "Unknown value: bpn": ("pulse", {"bpm": 72, "bpn": 70}),
            "bpm must be between 20 and 250": ("pulse", {"bpm": 999}),
            "score must be a whole number": ("mood", {"score": 3.5}),
            "No rules for this indicator yet.": ("sleep", {"hours": 8}),
        }
        for message, (indicator_id, values) in cases.items():
            result = status_rules.rate_reading(indicator_id, values)
            self.assertEqual((result["status"], result["message"]), ("unknown", message))

    def test_not_a_number_is_rejected(self):
        self.assertEqual(status_rules.rate_reading("pulse", {"bpm": float("nan")})["status"], "unknown")
        self.assertEqual(status_rules.rate_reading("pulse", {"bpm": float("inf")})["status"], "unknown")

    def test_worst_status_ignores_unknown(self):
        self.assertEqual(status_rules.worst_status(["normal", "unknown"]), "normal")
        self.assertEqual(status_rules.worst_status(["caution", "urgent", "normal"]), "urgent")
        self.assertEqual(status_rules.worst_status(["unknown"]), "unknown")
        self.assertEqual(status_rules.worst_status([]), "unknown")

    def test_regions_come_from_rules(self):
        self.assertEqual(status_rules.get_regions(), {"heart": ["pulse"], "head": ["mood"]})

    def test_rules_check_finds_problems(self):
        self.assertEqual(status_rules.find_rules_problems(), [])
        broken = json.loads(json.dumps(TEST_RULES))
        broken["indicators"]["pulse"]["values"]["bpm"]["normal"] = 5
        broken["indicators"]["pulse"]["values"]["bpm"]["caution"] = [120, 50]
        del broken["indicators"]["mood"]["region"]
        del broken["indicators"]["mood"]["messages"]["urgent"]
        with mock.patch.object(status_rules, "load_rules", return_value=broken):
            problems = status_rules.find_rules_problems()
        self.assertEqual(len(problems), 4, problems)

    def test_rules_check_reports_invalid_json(self):
        error = json.JSONDecodeError("Expecting value", "{", 1)
        with mock.patch.object(status_rules, "load_rules", side_effect=error):
            problems = status_rules.find_rules_problems()
        self.assertIn("not valid JSON", problems[0])


class RealRulesFileTests(unittest.TestCase):

    def test_rules_json_has_no_problems(self):
        self.assertEqual(status_rules.find_rules_problems(), [])

    def test_every_value_has_a_simulation_range_inside_its_limits(self):
        for indicator_id, indicator in status_rules.load_rules()["indicators"].items():
            for key, rule in indicator["values"].items():
                simulation = rule.get("simulation")
                self.assertIsNotNone(simulation, f"{indicator_id}.{key} has no simulation range")
                self.assertTrue(rule["limits"][0] <= simulation["min"] <= simulation["max"] <= rule["limits"][1], f"{indicator_id}.{key}")

    def test_bad_simulation_range_is_reported(self):
        broken = json.loads(json.dumps(TEST_RULES))
        broken["indicators"]["pulse"]["values"]["bpm"]["simulation"] = {"min": 10, "max": 300}
        with mock.patch.object(status_rules, "load_rules", return_value=broken):
            problems = status_rules.find_rules_problems()
        self.assertEqual(problems, ["pulse.bpm: 'simulation' must lie inside 'limits'"])


class StreakTests(unittest.TestCase):

    def test_streak_counts_days_in_a_row(self):
        days = {date(2026, 11, 14), date(2026, 11, 13), date(2026, 11, 11)}
        self.assertEqual(checklist.count_streak(days, date(2026, 11, 14)), 2)
        self.assertEqual(checklist.count_streak(days, date(2026, 11, 15)), 2)  # today not done yet
        self.assertEqual(checklist.count_streak(days, date(2026, 11, 17)), 0)
        self.assertEqual(checklist.count_streak(set(), date(2026, 11, 17)), 0)


class AccountRulesTests(unittest.TestCase):

    def test_password_hash_checks_and_is_salted(self):
        stored = auth.hash_password("correct horse")
        self.assertTrue(auth.check_password("correct horse", stored))
        self.assertFalse(auth.check_password("wrong horse", stored))
        self.assertNotEqual(stored, auth.hash_password("correct horse"))

    def test_hint_after_several_wrong_passwords(self):
        key = "test:" + unique_name()
        for _ in range(auth.HINT_AFTER_WRONG_PASSWORDS - 1):
            auth.record_wrong_password(key)
        self.assertEqual(auth.wrong_password_message("Wrong", key), "Wrong")  # no hint yet
        auth.record_wrong_password(key)
        self.assertEqual(auth.wrong_password_message("Wrong", key), f"Wrong. {auth.FORGOT_PASSWORD_HINT}")
        auth.clear_wrong_passwords(key)
        self.assertEqual(auth.wrong_password_message("Wrong", key), "Wrong")

    def test_username_rules(self):
        for name in ["patrik", "Alice_01", "a.b-c"]:
            Credentials(username=name, password=PASSWORD)
        for name in ["ab", "  ab ", "has space", "x" * 31, "émile", ""]:
            with self.assertRaises(ValidationError):
                Credentials(username=name, password=PASSWORD)
        with self.assertRaises(ValidationError):
            Credentials(username="patrik", password="short")


# ---------- tests against the running server and database ----------

# Find a free network port for the test server.
def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ApiTests(unittest.TestCase):

    # Start the server once, with a superadmin, a crew and its mission control account to work with.
    @classmethod
    def setUpClass(cls):
        database.init_db()  # make sure tables and columns exist before using them
        cls.created = []
        cls.created_crews = []
        cls.rules = status_rules.load_rules()
        cls.superadmin_name = unique_name()
        database.create_astronaut(cls.superadmin_name, auth.hash_password(PASSWORD), is_superadmin=True)
        cls.created.append(cls.superadmin_name)

        cls.port = free_port()
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(cls.port), "--log-level", "warning"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        cls.wait_for_server()
        cls.superadmin_token = cls.login(cls.superadmin_name)[1]["token"]
        cls.crew_id, cls.admin_name = cls.create_crew_with_admin(cls.superadmin_token)
        cls.admin_token = cls.login(cls.admin_name)[1]["token"]

    # Stop the server and delete every account these tests created.
    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)
        with database.get_connection() as conn:
            conn.execute("DELETE FROM astronauts WHERE username = ANY(%s)", (cls.created,))
        for crew_id in cls.created_crews:  # accounts first, because they point at their crew
            database.delete_crew(crew_id)

    # Create a test crew through the superadmin and its mission control account.
    # Returns (crew id, admin username).
    @classmethod
    def create_crew_with_admin(cls, superadmin_token):
        status, crew = cls.call("POST", "/api/superadmin/crews", {"name": "test_crew_" + uuid.uuid4().hex[:8]}, superadmin_token)
        assert status == 200, crew
        cls.created_crews.append(crew["crewId"])
        admin_name = unique_name()
        status, admin = cls.call(
            "POST", f"/api/superadmin/crews/{crew['crewId']}/admins", {"username": admin_name, "password": PASSWORD}, superadmin_token
        )
        assert status == 200, admin
        cls.created.append(admin_name)
        return crew["crewId"], admin_name

    # Wait until the server answers, or fail with a hint after 30 seconds.
    @classmethod
    def wait_for_server(cls):
        for _ in range(60):
            try:
                if cls.call("GET", "/api/hello")[0] == 200:
                    return
            except urllib.error.URLError:
                pass
            time.sleep(0.5)
        cls.server.terminate()
        raise RuntimeError("Server did not start. Run 'python -m uvicorn app.main:app' to see why.")

    # Send one request. Returns (status code, answer as JSON).
    @classmethod
    def call(cls, method, path, body=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(f"http://127.0.0.1:{cls.port}{path}", data, headers, method=method)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read())

    # Log in. Returns (status code, answer).
    @classmethod
    def login(cls, username, password=PASSWORD):
        return cls.call("POST", "/api/login", {"username": username, "password": password})

    # Create a crew member through mission control and log them in. Returns (id, token, name).
    def make_crew(self, sex="female"):
        name = unique_name()
        body = {"username": name, "password": PASSWORD, "sex": sex}
        status, answer = self.call("POST", "/api/admin/astronauts", body, self.admin_token)
        self.assertEqual(status, 200, answer)
        self.created.append(name)
        return answer["astronautId"], self.login(name)[1]["token"], name

    # A heart_rate value with the wanted rating, worked out from rules.json.
    def bpm_for(self, status):
        rule = self.rules["indicators"]["heart_rate"]["values"]["bpm"]
        normal, caution, limits = rule["normal"], rule["caution"], rule["limits"]
        if status == "normal":
            return (normal[0] + normal[1]) / 2
        if status == "caution":
            return (normal[1] + caution[1]) / 2
        if status == "urgent":
            return caution[1] + 1
        return limits[1] + 1  # "invalid": outside the allowed limits

    # Save a heart_rate reading for a crew member. Returns (status code, answer).
    def save_bpm(self, token, bpm, taken_at=None):
        body = {"indicatorId": "heart_rate", "values": {"bpm": bpm}}
        if taken_at:
            body["takenAt"] = taken_at.isoformat()
        return self.call("POST", "/api/readings", body, token)

    # Get a crew member's heart_rate history.
    def history(self, token):
        return self.call("GET", "/api/readings?indicator=heart_rate&days=30", token=token)[1]

    # ----- accounts and login -----

    def test_hello_and_public_indicators(self):
        self.assertEqual(self.call("GET", "/api/hello")[0], 200)
        status, indicators = self.call("GET", "/api/indicators")
        self.assertEqual(status, 200)
        self.assertEqual(len(indicators), len(self.rules["indicators"]))

    def test_there_is_no_public_sign_up(self):
        status, _ = self.call("POST", "/api/register", {"username": unique_name(), "password": PASSWORD})
        self.assertIn(status, (404, 405))

    def test_login_and_me(self):
        astronaut_id, token, name = self.make_crew(sex="male")
        status, me = self.call("GET", "/api/me", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(me["astronautId"], astronaut_id)
        self.assertEqual(me["username"], name)
        self.assertEqual((me["isAdmin"], me["isSuperadmin"], me["sex"]), (False, False, "male"))
        status, login = self.login(name)
        self.assertEqual((login["isAdmin"], login["sex"]), (False, "male"))
        admin_me = self.call("GET", "/api/me", token=self.admin_token)[1]
        self.assertEqual((admin_me["isAdmin"], admin_me["sex"]), (True, None))

    def test_usernames_are_not_case_sensitive(self):
        _, _, name = self.make_crew()
        self.assertEqual(self.login(name.upper())[0], 200)

    def test_wrong_password_and_unknown_user_look_the_same(self):
        _, _, name = self.make_crew()
        wrong = self.login(name, "wrong-password")
        unknown = self.login(unique_name())
        self.assertEqual(wrong, unknown)
        self.assertEqual(wrong[0], 401)

    def test_forgot_password_hint_after_several_wrong_passwords(self):
        _, _, name = self.make_crew()
        for _ in range(auth.HINT_AFTER_WRONG_PASSWORDS - 1):
            status, answer = self.login(name, "wrong-password")
            self.assertEqual(status, 401)
            self.assertNotIn("Mission control", answer["detail"])
        status, answer = self.login(name, "wrong-password")
        self.assertEqual(status, 401)
        self.assertIn(auth.FORGOT_PASSWORD_HINT, answer["detail"])
        self.assertEqual(self.login(name)[0], 200)  # nothing is locked
        status, answer = self.login(name, "wrong-password")
        self.assertNotIn("Mission control", answer["detail"])  # counting starts over

    def test_requests_without_valid_token_are_refused(self):
        self.assertEqual(self.call("GET", "/api/status")[0], 401)
        self.assertEqual(self.call("GET", "/api/status", token="not-a-token")[0], 401)
        self.assertEqual(self.call("GET", "/api/admin/astronauts")[0], 401)

    def test_logout_ends_only_that_login(self):
        _, token, name = self.make_crew()
        second_token = self.login(name)[1]["token"]
        self.assertEqual(self.call("POST", "/api/logout", token=token)[0], 200)
        self.assertEqual(self.call("GET", "/api/me", token=token)[0], 401)
        self.assertEqual(self.call("GET", "/api/me", token=second_token)[0], 200)

    def test_change_password(self):
        _, token, name = self.make_crew()
        change = {"currentPassword": "wrong-password", "newPassword": "new-password-1"}
        self.assertEqual(self.call("POST", "/api/me/password", change, token)[0], 401)
        change["currentPassword"] = PASSWORD
        self.assertEqual(self.call("POST", "/api/me/password", change, token)[0], 200)
        self.assertEqual(self.call("GET", "/api/me", token=token)[0], 401)  # logged out everywhere
        self.assertEqual(self.login(name)[0], 401)
        self.assertEqual(self.login(name, "new-password-1")[0], 200)

    # ----- crew readings -----

    def test_readings_are_rated(self):
        _, token, _ = self.make_crew()
        for status in ("normal", "caution", "urgent"):
            code, result = self.save_bpm(token, self.bpm_for(status))
            self.assertEqual(code, 200, result)
            self.assertEqual(result["status"], status)
            self.assertEqual(result["escalate"], status == "urgent")

    def test_bad_readings_are_refused_and_not_saved(self):
        _, token, _ = self.make_crew()
        future = datetime.now(timezone.utc) + timedelta(days=1)
        bad = [
            {"indicatorId": "not_real", "values": {"bpm": 70}},
            {"indicatorId": "heart_rate", "values": {}},
            {"indicatorId": "heart_rate", "values": {"bpm": 70, "typo": 1}},
            {"indicatorId": "heart_rate", "values": {"bpm": self.bpm_for("invalid")}},
            {"indicatorId": "heart_rate", "values": {"bpm": 70}, "takenAt": future.isoformat()},
        ]
        for body in bad:
            self.assertEqual(self.call("POST", "/api/readings", body, token)[0], 400, body)
        self.assertEqual(self.history(token), [])
        self.assertEqual(self.call("GET", "/api/readings?indicator=not_real", token=token)[0], 400)

    def test_history_is_oldest_first_with_ids(self):
        _, token, _ = self.make_crew()
        now = datetime.now(timezone.utc)
        self.save_bpm(token, 81, now - timedelta(hours=1))
        self.save_bpm(token, 80, now - timedelta(days=2))
        history = self.history(token)
        self.assertEqual([r["values"]["bpm"] for r in history], [80, 81])
        self.assertTrue(all(isinstance(r["id"], int) for r in history))

    def test_crew_can_correct_and_delete_own_readings(self):
        _, token, _ = self.make_crew()
        self.save_bpm(token, self.bpm_for("urgent"))
        reading = self.history(token)[0]
        update = {"values": {"bpm": self.bpm_for("normal")}}
        status, result = self.call("PUT", f"/api/readings/{reading['id']}", update, token)
        self.assertEqual((status, result["status"]), (200, "normal"))
        corrected = self.history(token)[0]
        self.assertEqual(corrected["takenAt"], reading["takenAt"])  # time kept
        bad = {"values": {"bpm": self.bpm_for("invalid")}}
        self.assertEqual(self.call("PUT", f"/api/readings/{reading['id']}", bad, token)[0], 400)
        self.assertEqual(self.call("DELETE", f"/api/readings/{reading['id']}", token=token)[0], 200)
        self.assertEqual(self.history(token), [])

    def test_crew_cannot_see_or_touch_others_data(self):
        _, alice, _ = self.make_crew()
        _, bob, _ = self.make_crew()
        self.save_bpm(alice, 70)
        reading_id = self.history(alice)[0]["id"]
        self.assertEqual(self.history(bob), [])
        self.assertEqual(self.call("PUT", f"/api/readings/{reading_id}", {"values": {"bpm": 60}}, bob)[0], 404)
        self.assertEqual(self.call("DELETE", f"/api/readings/{reading_id}", token=bob)[0], 404)
        self.assertEqual(len(self.history(alice)), 1)

    def test_status_alerts_and_checklist(self):
        _, token, _ = self.make_crew()
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        self.save_bpm(token, self.bpm_for("normal"), yesterday)
        self.save_bpm(token, self.bpm_for("urgent"))

        regions = {r["regionId"]: r["status"] for r in self.call("GET", "/api/status", token=token)[1]["regions"]}
        self.assertEqual(regions["heart"], "urgent")  # the newest reading counts
        self.assertEqual(regions["eyes"], "unknown")  # nothing measured yet

        alerts = self.call("GET", "/api/alerts", token=token)[1]
        self.assertEqual([(a["indicatorId"], a["status"]) for a in alerts], [("heart_rate", "urgent")])

        board = self.call("GET", "/api/checklist", token=token)[1]
        self.assertEqual(board["streak"], 2)
        self.assertEqual(board["points"], 2 * self.rules["pointsPerReading"])
        due = {item["indicatorId"]: item["due"] for item in board["items"]}
        self.assertFalse(due["heart_rate"])
        self.assertTrue(due["spo2"])

    # ----- roles -----

    def test_mission_control_has_no_own_readings(self):
        self.assertEqual(self.save_bpm(self.admin_token, 70)[0], 403)
        for path in ["/api/status", "/api/alerts", "/api/checklist", "/api/readings?indicator=heart_rate"]:
            self.assertEqual(self.call("GET", path, token=self.admin_token)[0], 403, path)

    def test_crew_cannot_use_mission_control_endpoints(self):
        _, token, _ = self.make_crew()
        self.assertEqual(self.call("GET", "/api/admin/astronauts", token=token)[0], 403)
        new = {"username": unique_name(), "password": PASSWORD, "sex": "male"}
        self.assertEqual(self.call("POST", "/api/admin/astronauts", new, token)[0], 403)
        self.assertEqual(self.call("PATCH", "/api/admin/astronauts/1", {"sex": "male"}, token)[0], 403)

    # ----- mission control -----

    def test_duplicate_username_is_refused(self):
        _, _, name = self.make_crew()
        again = {"username": name.upper(), "password": PASSWORD, "sex": "male"}
        self.assertEqual(self.call("POST", "/api/admin/astronauts", again, self.admin_token)[0], 409)

    def test_sex_is_required_and_can_be_corrected(self):
        for sex in [None, "other", "Male", ""]:
            body = {"username": unique_name(), "password": PASSWORD}
            if sex is not None:
                body["sex"] = sex
            self.assertEqual(self.call("POST", "/api/admin/astronauts", body, self.admin_token)[0], 422, sex)
        crew_id, token, name = self.make_crew(sex="female")
        status, answer = self.call("PATCH", f"/api/admin/astronauts/{crew_id}", {"sex": "male"}, self.admin_token)
        self.assertEqual((status, answer["sex"]), (200, "male"))
        self.assertEqual(self.call("GET", "/api/me", token=token)[1]["sex"], "male")
        crew = {c["astronautId"]: c for c in self.call("GET", "/api/admin/astronauts", token=self.admin_token)[1]}
        self.assertEqual(crew[crew_id]["sex"], "male")
        self.assertEqual(self.call("PATCH", f"/api/admin/astronauts/{crew_id}", {"sex": "x"}, self.admin_token)[0], 422)
        admin_id = self.call("GET", "/api/me", token=self.admin_token)[1]["astronautId"]
        self.assertEqual(self.call("PATCH", f"/api/admin/astronauts/{admin_id}", {"sex": "male"}, self.admin_token)[0], 404)

    def test_crew_list_shows_status_and_alerts(self):
        calm_id, _, _ = self.make_crew()
        sick_id, sick, _ = self.make_crew()
        self.save_bpm(sick, self.bpm_for("urgent"))
        crew = {c["astronautId"]: c for c in self.call("GET", "/api/admin/astronauts", token=self.admin_token)[1]}
        self.assertEqual((crew[calm_id]["status"], crew[calm_id]["alertCount"]), ("unknown", 0))
        self.assertEqual((crew[sick_id]["status"], crew[sick_id]["alertCount"]), ("urgent", 1))
        self.assertNotIn(self.admin_name, [c["username"] for c in crew.values()])

    def test_mission_control_sees_and_corrects_crew_data(self):
        crew_id, token, _ = self.make_crew()
        self.save_bpm(token, self.bpm_for("urgent"))
        base = f"/api/admin/astronauts/{crew_id}"
        self.assertEqual(self.call("GET", f"{base}/status", token=self.admin_token)[0], 200)
        self.assertEqual(len(self.call("GET", f"{base}/alerts", token=self.admin_token)[1]), 1)
        self.assertEqual(self.call("GET", f"{base}/checklist", token=self.admin_token)[1]["points"], self.rules["pointsPerReading"])
        readings = self.call("GET", f"{base}/readings?indicator=heart_rate", token=self.admin_token)[1]

        update = {"values": {"bpm": self.bpm_for("normal")}}
        status, result = self.call("PUT", f"/api/admin/readings/{readings[0]['id']}", update, self.admin_token)
        self.assertEqual((status, result["status"]), (200, "normal"))
        self.assertEqual(self.call("GET", "/api/alerts", token=token)[1], [])
        self.assertEqual(self.call("DELETE", f"/api/admin/readings/{readings[0]['id']}", token=self.admin_token)[0], 200)
        self.assertEqual(self.history(token), [])

    def test_mission_control_resets_password_and_deletes_crew(self):
        crew_id, token, name = self.make_crew()
        reset = {"newPassword": "reset-password-1"}
        self.assertEqual(self.call("POST", f"/api/admin/astronauts/{crew_id}/password", reset, self.admin_token)[0], 200)
        self.assertEqual(self.call("GET", "/api/me", token=token)[0], 401)  # logged out
        self.assertEqual(self.login(name, "reset-password-1")[0], 200)
        self.assertEqual(self.call("DELETE", f"/api/admin/astronauts/{crew_id}", token=self.admin_token)[0], 200)
        self.assertEqual(self.login(name, "reset-password-1")[0], 401)
        self.assertEqual(self.call("GET", f"/api/admin/astronauts/{crew_id}/status", token=self.admin_token)[0], 404)

    def test_mission_control_accounts_are_protected(self):
        admin_id = self.call("GET", "/api/me", token=self.admin_token)[1]["astronautId"]
        self.assertEqual(self.call("DELETE", f"/api/admin/astronauts/{admin_id}", token=self.admin_token)[0], 404)
        self.assertEqual(self.call("GET", f"/api/admin/astronauts/{admin_id}/status", token=self.admin_token)[0], 404)



    # ----- crews and the superadmin -----

    def test_login_and_me_show_crew_and_role(self):
        superadmin = self.call("GET", "/api/me", token=self.superadmin_token)[1]
        self.assertEqual((superadmin["isSuperadmin"], superadmin["isAdmin"], superadmin["crewId"]), (True, False, None))
        admin = self.call("GET", "/api/me", token=self.admin_token)[1]
        self.assertEqual((admin["isAdmin"], admin["isSuperadmin"], admin["crewId"]), (True, False, self.crew_id))
        self.assertTrue(admin["crewName"].startswith("test_crew_"))
        name = self.make_crew()[2]
        member = self.login(name)[1]
        self.assertEqual((member["crewId"], member["crewName"]), (self.crew_id, admin["crewName"]))

    def test_superadmin_creates_crews(self):
        name = "test_crew_" + uuid.uuid4().hex[:8]
        status, crew = self.call("POST", "/api/superadmin/crews", {"name": name}, self.superadmin_token)
        self.assertEqual(status, 200)
        self.created_crews.append(crew["crewId"])
        self.assertEqual((crew["name"], crew["memberCount"], crew["adminCount"]), (name, 0, 0))
        # Names are unique, ignoring case and spaces at the ends.
        self.assertEqual(self.call("POST", "/api/superadmin/crews", {"name": name.upper()}, self.superadmin_token)[0], 409)
        self.assertEqual(self.call("POST", "/api/superadmin/crews", {"name": " x "}, self.superadmin_token)[0], 422)
        listed = {c["crewId"]: c for c in self.call("GET", "/api/superadmin/crews", token=self.superadmin_token)[1]}
        self.assertIn(self.crew_id, listed)
        self.assertEqual(listed[self.crew_id]["adminCount"], 1)

    def test_superadmin_creates_mission_control_for_a_crew(self):
        status, admins = self.call("GET", f"/api/superadmin/crews/{self.crew_id}/admins", token=self.superadmin_token)
        self.assertEqual(status, 200)
        self.assertEqual([a["username"] for a in admins], [self.admin_name])
        name = unique_name()
        status, answer = self.call(
            "POST", f"/api/superadmin/crews/{self.crew_id}/admins", {"username": name, "password": PASSWORD}, self.superadmin_token
        )
        self.assertEqual(status, 200)
        self.created.append(name)
        self.assertEqual((answer["isAdmin"], answer["crewId"]), (True, self.crew_id))
        self.assertEqual(self.call("POST", "/api/superadmin/crews/999999/admins", {"username": unique_name(), "password": PASSWORD}, self.superadmin_token)[0], 404)

    def test_only_the_superadmin_uses_superadmin_endpoints(self):
        for token in [self.admin_token, None]:
            self.assertIn(self.call("GET", "/api/superadmin/crews", token=token)[0], [401, 403])
        self.assertEqual(self.call("GET", "/api/superadmin/crews", token=self.admin_token)[0], 403)
        name = self.make_crew()[2]
        member_token = self.login(name)[1]["token"]
        self.assertEqual(self.call("GET", "/api/superadmin/crews", token=member_token)[0], 403)
        self.assertEqual(self.call("GET", "/api/admin/astronauts", token=self.superadmin_token)[0], 403)
        self.assertEqual(self.save_bpm(self.superadmin_token, 70)[0], 403)

    def test_each_crew_sees_only_its_own_members(self):
        other_crew_id, other_admin = self.create_crew_with_admin(self.superadmin_token)
        other_admin_token = self.login(other_admin)[1]["token"]
        mine_id, mine_token, mine_name = self.make_crew()
        self.save_bpm(mine_token, 70)
        # The other crew's mission control sees none of this crew's members.
        listed = self.call("GET", "/api/admin/astronauts", token=other_admin_token)[1]
        self.assertNotIn(mine_name, [c["username"] for c in listed])
        for path in [f"/api/admin/astronauts/{mine_id}/status", f"/api/admin/astronauts/{mine_id}/alerts"]:
            self.assertEqual(self.call("GET", path, token=other_admin_token)[0], 404, path)
        self.assertEqual(self.call("PATCH", f"/api/admin/astronauts/{mine_id}", {"sex": "male"}, other_admin_token)[0], 404)
        self.assertEqual(self.call("POST", f"/api/admin/astronauts/{mine_id}/password", {"newPassword": "another-pass-2"}, other_admin_token)[0], 404)
        reading_id = self.history(mine_token)[0]["id"]
        self.assertEqual(self.call("PUT", f"/api/admin/readings/{reading_id}", {"values": {"bpm": 71}}, other_admin_token)[0], 404)
        self.assertEqual(self.call("DELETE", f"/api/admin/readings/{reading_id}", token=other_admin_token)[0], 404)
        # And the first crew's mission control still sees and changes its own member.
        self.assertIn(mine_name, [c["username"] for c in self.call("GET", "/api/admin/astronauts", token=self.admin_token)[1]])
        self.assertEqual(self.call("GET", f"/api/admin/astronauts/{mine_id}/status", token=self.admin_token)[0], 200)
        self.assertEqual(self.call("GET", f"/api/admin/astronauts/{mine_id}/status", token=other_admin_token)[0], 404)

    def test_new_crew_member_joins_the_admins_crew(self):
        other_crew_id, other_admin = self.create_crew_with_admin(self.superadmin_token)
        other_admin_token = self.login(other_admin)[1]["token"]
        name = unique_name()
        status, answer = self.call("POST", "/api/admin/astronauts", {"username": name, "password": PASSWORD, "sex": "male"}, other_admin_token)
        self.assertEqual((status, answer["crewId"]), (200, other_crew_id))
        self.created.append(name)
        self.assertNotIn(name, [c["username"] for c in self.call("GET", "/api/admin/astronauts", token=self.admin_token)[1]])

    def test_deleting_a_crew_member_keeps_the_crew(self):
        def member_count():
            crews = self.call("GET", "/api/superadmin/crews", token=self.superadmin_token)[1]
            return {c["crewId"]: c["memberCount"] for c in crews}[self.crew_id]

        before = member_count()
        name = self.make_crew()[2]
        self.assertEqual(member_count(), before + 1)
        members = self.call("GET", "/api/admin/astronauts", token=self.admin_token)[1]
        member_id = [c["astronautId"] for c in members if c["username"] == name][0]
        self.assertEqual(self.call("DELETE", f"/api/admin/astronauts/{member_id}", token=self.admin_token)[0], 200)
        self.assertEqual(member_count(), before)
        self.assertEqual(self.call("GET", "/api/admin/astronauts", token=self.admin_token)[0], 200)

    def test_superadmin_lists_members_and_resets_their_password(self):
        member_id, member_token, member_name = self.make_crew(sex="female")
        status, members = self.call("GET", f"/api/superadmin/crews/{self.crew_id}/members", token=self.superadmin_token)
        self.assertEqual(status, 200)
        listed = {m["astronautId"]: m for m in members}
        self.assertEqual((listed[member_id]["username"], listed[member_id]["sex"]), (member_name, "female"))
        self.assertNotIn("password", listed[member_id])  # passwords are never shown
        self.assertNotIn(self.admin_name, [m["username"] for m in members])  # mission control is not a member
        other_crew_id, _ = self.create_crew_with_admin(self.superadmin_token)
        self.assertEqual(self.call("GET", f"/api/superadmin/crews/{other_crew_id}/members", token=self.superadmin_token)[1], [])
        self.assertEqual(self.call("GET", f"/api/superadmin/crews/{self.crew_id}/members", token=self.admin_token)[0], 403)
        # Reset the password: the old one stops working, the new one works.
        new_password = "brand-new-pass-1"
        url = f"/api/superadmin/crews/{self.crew_id}/members/{member_id}/password"
        self.assertEqual(self.call("POST", url, {"newPassword": new_password}, self.superadmin_token)[0], 200)
        self.assertEqual(self.login(member_name)[0], 401)
        self.assertEqual(self.login(member_name, new_password)[0], 200)
        # Not a member of that crew: 404.
        self.assertEqual(self.call("POST", f"/api/superadmin/crews/{other_crew_id}/members/{member_id}/password", {"newPassword": new_password}, self.superadmin_token)[0], 404)


    def test_fat_burgers_is_not_allowed_as_a_name(self):
        message = "Fat Burgers are not allowed\nGlory to AUK Avengers"
        for name in ["fat_burgers", "Fat Burgers", "FAT-BURGERS", "fat  burgers"]:
            status, answer = self.call("POST", "/api/superadmin/crews", {"name": name}, self.superadmin_token)
            self.assertEqual((status, answer["detail"]), (400, message), name)
        status, answer = self.call("POST", f"/api/superadmin/crews/{self.crew_id}/admins", {"username": "fat_burgers", "password": PASSWORD}, self.superadmin_token)
        self.assertEqual((status, answer["detail"]), (400, message))
        status, answer = self.call("POST", "/api/admin/astronauts", {"username": "fat_burgers", "password": PASSWORD, "sex": "male"}, self.admin_token)
        self.assertEqual((status, answer["detail"]), (400, message))
        status, cats = self.call("POST", "/api/superadmin/crews", {"name": "Fat Cats " + uuid.uuid4().hex[:6]}, self.superadmin_token)
        self.assertEqual(status, 200)
        self.created_crews.append(cats["crewId"])
        status, answer = self.call("POST", "/api/login", {"username": "fat_burgers", "password": "x"})
        self.assertEqual((status, answer["detail"]), (400, message))  # the name check runs first

    def test_superadmin_deletes_only_an_empty_crew(self):
        status, crew = self.call("POST", "/api/superadmin/crews", {"name": "test_crew_" + uuid.uuid4().hex[:8]}, self.superadmin_token)
        self.assertEqual(status, 200)
        url = f"/api/superadmin/crews/{crew['crewId']}"
        self.assertEqual(self.call("DELETE", url, token=self.admin_token)[0], 403)
        self.assertEqual(self.call("DELETE", "/api/superadmin/crews/999999", token=self.superadmin_token)[0], 404)
        # A crew with a member or mission control account cannot be deleted.
        status, admin = self.call("POST", f"/api/superadmin/crews/{crew['crewId']}/admins", {"username": unique_name(), "password": PASSWORD}, self.superadmin_token)
        self.assertEqual(status, 200)
        self.created.append(admin["username"])
        self.assertEqual(self.call("DELETE", url, token=self.superadmin_token)[0], 409)
        # Remove the account directly (the API has no way to delete mission control accounts).
        with database.get_connection() as conn:
            conn.execute("DELETE FROM astronauts WHERE crew_id = %s", (crew["crewId"],))
        self.assertEqual(self.call("DELETE", url, token=self.superadmin_token)[0], 200)
        self.assertEqual(self.call("DELETE", url, token=self.superadmin_token)[0], 404)
        listed = [c["crewId"] for c in self.call("GET", "/api/superadmin/crews", token=self.superadmin_token)[1]]
        self.assertNotIn(crew["crewId"], listed)
        self.assertIn(self.crew_id, listed)


    def test_superadmin_reads_one_members_health_only(self):
        member_id, member_token, member_name = self.make_crew()
        self.assertEqual(self.save_bpm(member_token, 72)[0], 200)
        base = f"/api/superadmin/crews/{self.crew_id}/members/{member_id}"
        status, overview = self.call("GET", f"{base}/status", token=self.superadmin_token)
        self.assertEqual(status, 200)
        heart = [i for r in overview["regions"] for i in r["indicators"] if i["indicatorId"] == "heart_rate"][0]
        self.assertEqual(heart["status"], "normal")
        self.assertEqual(self.call("GET", f"{base}/checklist", token=self.superadmin_token)[1]["points"], self.rules["pointsPerReading"])
        readings = self.call("GET", f"{base}/readings?indicator=heart_rate", token=self.superadmin_token)[1]
        self.assertEqual(len(readings), 1)
        self.assertEqual(self.call("GET", f"{base}/readings?indicator=nope", token=self.superadmin_token)[0], 400)
        # Only the superadmin, only members of that crew, and the views cannot change anything.
        self.assertEqual(self.call("GET", f"{base}/status", token=self.admin_token)[0], 403)
        other_crew_id, _ = self.create_crew_with_admin(self.superadmin_token)
        self.assertEqual(self.call("GET", f"/api/superadmin/crews/{other_crew_id}/members/{member_id}/status", token=self.superadmin_token)[0], 404)
        admin_id = self.call("GET", "/api/me", token=self.admin_token)[1]["astronautId"]
        self.assertEqual(self.call("GET", f"/api/superadmin/crews/{self.crew_id}/members/{admin_id}/status", token=self.superadmin_token)[0], 404)
        self.assertEqual(self.call("PUT", f"/api/admin/readings/{readings[0]['id']}", {"values": {"bpm": 90}}, self.superadmin_token)[0], 403)


    def test_superadmin_deletes_a_crew_member(self):
        member_id, member_token, _ = self.make_crew()
        self.save_bpm(member_token, 72)
        url = f"/api/superadmin/crews/{self.crew_id}/members/{member_id}"
        other_crew_id, _ = self.create_crew_with_admin(self.superadmin_token)
        self.assertEqual(self.call("DELETE", f"/api/superadmin/crews/{other_crew_id}/members/{member_id}", token=self.superadmin_token)[0], 404)
        self.assertEqual(self.call("DELETE", url, token=self.admin_token)[0], 403)
        self.assertEqual(self.call("DELETE", url, token=self.superadmin_token)[0], 200)
        self.assertEqual(self.call("DELETE", url, token=self.superadmin_token)[0], 404)
        self.assertEqual(self.call("GET", "/api/me", token=member_token)[0], 401)  # login ended
        self.assertNotIn(member_id, [m["astronautId"] for m in self.call("GET", f"/api/superadmin/crews/{self.crew_id}/members", token=self.superadmin_token)[1]])


if __name__ == "__main__":
    unittest.main()

# Code was assisted with Claude.
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app import auth, checklist, database, health, reserved_names, status_rules
from app.schemas import (
    Astronaut,
    Checklist,
    LoginRequest,
    IndicatorInfo,
    LoginResult,
    PasswordChange,
    Reading,
    ReadingUpdate,
    SavedReading,
    StatusOverview,
    StatusResult,
)

router = APIRouter(prefix="/api")


# ---------- accounts ----------
# There is no sign-up: mission control creates crew accounts (see admin_routes.py).

# Which computer a request comes from (used to count wrong passwords).
def client_address(request):
    return request.client.host if request.client else "unknown"


# Log in with username and password. Returns a token for the Authorization header.
# After several wrong passwords, the error suggests contacting mission control.
@router.post("/login", response_model=LoginResult)
def login(credentials: LoginRequest, request: Request):
    reserved_names.check_allowed(credentials.username)
    username = credentials.username.lower()
    key = f"{client_address(request)}:{username}"
    user = auth.verify_login(username, credentials.password, key)
    if user is None:
        raise HTTPException(401, auth.wrong_password_message("Wrong username or password", key))
    token = auth.start_session(user["id"])
    return {"token": token, **auth.account_info(user)}


# Log out: the current token stops working.
@router.post("/logout")
def logout(user=Depends(auth.current_user), credentials=Depends(auth.bearer)):
    database.delete_session(credentials.credentials)
    return {"message": "Logged out"}


# Who is logged in with this token.
@router.get("/me", response_model=Astronaut)
def me(user=Depends(auth.current_user)):
    return auth.account_info(user)


# Change your own password. Logs you out everywhere, so log in again afterwards.
@router.post("/me/password")
def change_password(change: PasswordChange, request: Request, user=Depends(auth.current_user)):
    key = f"{client_address(request)}:{user['username']}"
    if auth.verify_login(user["username"], change.currentPassword, key) is None:
        raise HTTPException(401, auth.wrong_password_message("Current password is wrong", key))
    database.set_password(user["id"], auth.hash_password(change.newPassword))
    return {"message": "Password changed. Please log in again."}


# ---------- own readings (crew only) ----------

# Save a reading and return its rating. Rejects readings we cannot rate.
@router.post("/readings", response_model=StatusResult)
def create_reading(reading: Reading, astronaut=Depends(auth.current_astronaut)):
    result = health.check_reading(reading.indicatorId, reading.values, reading.takenAt, astronaut["personal_ranges"])
    database.save_reading(astronaut["id"], reading.indicatorId, reading.values, reading.takenAt)
    return result


# History for charts, e.g. GET /api/readings?indicator=spo2&days=30
@router.get("/readings", response_model=list[SavedReading])
def list_readings(
    indicator: str,
    days: int = Query(30, ge=1, le=365),
    astronaut=Depends(auth.current_astronaut),
):
    health.check_indicator(indicator)
    return database.get_readings(astronaut["id"], indicator, days)


# Find one of your own readings, or stop with 404.
def own_reading(reading_id, astronaut):
    reading = database.get_reading(reading_id)
    if reading is None or reading["astronautId"] != astronaut["id"]:
        raise HTTPException(404, "Reading not found")
    return reading


# Correct one of your own readings and return its new rating.
@router.put("/readings/{reading_id}", response_model=StatusResult)
def edit_reading(reading_id: int, update: ReadingUpdate, astronaut=Depends(auth.current_astronaut)):
    reading = own_reading(reading_id, astronaut)
    result = health.check_reading(reading["indicatorId"], update.values, update.takenAt, astronaut["personal_ranges"])
    database.update_reading(reading_id, update.values, update.takenAt or reading["takenAt"])
    return result


# Delete one of your own readings.
@router.delete("/readings/{reading_id}")
def remove_reading(reading_id: int, astronaut=Depends(auth.current_astronaut)):
    own_reading(reading_id, astronaut)
    database.delete_reading(reading_id)
    return {"message": "Reading deleted"}


# ---------- own overview (crew only) ----------

# Status per body region and per indicator, based on the newest readings.
@router.get("/status", response_model=StatusOverview)
def get_status(astronaut=Depends(auth.current_astronaut)):
    return health.status_overview(astronaut["id"])


# Which measurements are due now, plus the streak and points.
@router.get("/checklist", response_model=Checklist)
def get_checklist(astronaut=Depends(auth.current_astronaut)):
    return checklist.build_checklist(astronaut["id"])


# Indicators whose newest reading is caution or urgent, urgent first.
@router.get("/alerts", response_model=list[StatusResult])
def get_alerts(astronaut=Depends(auth.current_astronaut)):
    return health.alerts(astronaut["id"])


# ---------- public ----------

# Every indicator with its region and value rules, so the frontend can build forms.
# No login needed: this is the same for everyone.
@router.get("/indicators", response_model=list[IndicatorInfo])
def list_indicators():
    indicators = []
    for indicator_id, indicator_rules in status_rules.load_rules()["indicators"].items():
        indicators.append({
            "indicatorId": indicator_id,
            "region": indicator_rules["region"],
            "dueEveryHours": indicator_rules["dueEveryHours"],
            "values": indicator_rules["values"],
        })
    return indicators

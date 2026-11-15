# Code was assisted with Claude.
from fastapi import APIRouter, Depends, HTTPException, Query

from app import auth, checklist, database, health, reserved_names, status_rules
from app.schemas import (
    Astronaut,
    Checklist,
    CrewMember,
    CrewUpdate,
    NewCrewMember,
    PasswordReset,
    ReadingUpdate,
    SavedReading,
    StatusOverview,
    StatusResult,
)

# Every endpoint here is for mission control only (403 for crew members and the superadmin).
# Mission control sees and changes only the members of its own crew (404 for anyone else).
router = APIRouter(prefix="/api/admin", dependencies=[Depends(auth.current_admin)])


# Find a crew member of this mission control's crew by id, or stop with 404.
def crew_member(astronaut_id, admin):
    astronaut = database.get_astronaut_by_id(astronaut_id)
    if (
        astronaut is None
        or astronaut["is_admin"]
        or astronaut["is_superadmin"]
        or astronaut["crew_id"] != admin["crew_id"]
    ):
        raise HTTPException(404, "Crew member not found")
    return astronaut


# Find a reading of this mission control's crew by id, or stop with 404.
def crew_reading(reading_id, admin):
    reading = database.get_reading(reading_id)
    if reading is None:
        raise HTTPException(404, "Reading not found")
    crew_member(reading["astronautId"], admin)
    return reading


# ---------- crew accounts ----------

# The crew with each member's overall status and number of alerts.
@router.get("/astronauts", response_model=list[CrewMember])
def list_crew(admin=Depends(auth.current_admin)):
    latest_for_crew = database.get_latest_readings_for_crew(admin["crew_id"])
    crew = []
    for astronaut in database.list_crew(admin["crew_id"]):
        statuses = health.rate_latest(latest_for_crew.get(astronaut["id"], {})).values()
        crew.append({
            "astronautId": astronaut["id"],
            "username": astronaut["username"],
            "sex": astronaut["sex"],
            "createdAt": astronaut["created_at"],
            "status": status_rules.worst_status([s["status"] for s in statuses]),
            "alertCount": sum(1 for s in statuses if s["status"] in ("caution", "urgent")),
        })
    return crew


# Create a crew member in this mission control's crew. The member logs in with this username and password.
@router.post("/astronauts", response_model=Astronaut)
def create_crew_member(new: NewCrewMember, admin=Depends(auth.current_admin)):
    reserved_names.check_allowed(new.username)
    username = new.username.lower()
    astronaut_id = database.create_astronaut(
        username,
        auth.hash_password(new.password),
        sex=new.sex,
        crew_id=admin["crew_id"],
    )
    if astronaut_id is None:
        raise HTTPException(409, "This username is already taken")
    return auth.account_info(database.get_astronaut_by_id(astronaut_id))


# Correct a crew member's details (for now: sex, which picks the 3D model).
@router.patch("/astronauts/{astronaut_id}", response_model=Astronaut)
def update_crew_member(astronaut_id: int, update: CrewUpdate, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    database.set_sex(astronaut_id, update.sex)
    return auth.account_info(database.get_astronaut_by_id(astronaut_id))


# Set a new password for a crew member (e.g. they forgot it). Logs them out everywhere.
@router.post("/astronauts/{astronaut_id}/password")
def reset_password(astronaut_id: int, reset: PasswordReset, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    database.set_password(astronaut_id, auth.hash_password(reset.newPassword))
    return {"message": "Password reset"}


# Delete a crew account together with all its readings.
@router.delete("/astronauts/{astronaut_id}")
def delete_crew_member(astronaut_id: int, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    database.delete_crew_member(astronaut_id)
    return {"message": "Crew member deleted"}


# ---------- one crew member's health ----------

# A crew member's status per body region and indicator.
@router.get("/astronauts/{astronaut_id}/status", response_model=StatusOverview)
def crew_status(astronaut_id: int, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    return health.status_overview(astronaut_id)


# A crew member's alerts, urgent first.
@router.get("/astronauts/{astronaut_id}/alerts", response_model=list[StatusResult])
def crew_alerts(astronaut_id: int, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    return health.alerts(astronaut_id)


# A crew member's checklist, streak and points.
@router.get("/astronauts/{astronaut_id}/checklist", response_model=Checklist)
def crew_checklist(astronaut_id: int, admin=Depends(auth.current_admin)):
    crew_member(astronaut_id, admin)
    return checklist.build_checklist(astronaut_id)


# A crew member's reading history, e.g. ?indicator=spo2&days=30
@router.get("/astronauts/{astronaut_id}/readings", response_model=list[SavedReading])
def crew_readings(
    astronaut_id: int,
    indicator: str,
    days: int = Query(30, ge=1, le=365),
    admin=Depends(auth.current_admin),
):
    crew_member(astronaut_id, admin)
    health.check_indicator(indicator)
    return database.get_readings(astronaut_id, indicator, days)


# ---------- correcting readings ----------

# Correct a reading of a crew member and return its new rating.
@router.put("/readings/{reading_id}", response_model=StatusResult)
def edit_any_reading(reading_id: int, update: ReadingUpdate, admin=Depends(auth.current_admin)):
    reading = crew_reading(reading_id, admin)
    result = health.check_reading(reading["indicatorId"], update.values, update.takenAt)
    database.update_reading(reading_id, update.values, update.takenAt or reading["takenAt"])
    return result


# Delete a reading of a crew member.
@router.delete("/readings/{reading_id}")
def delete_any_reading(reading_id: int, admin=Depends(auth.current_admin)):
    crew_reading(reading_id, admin)
    database.delete_reading(reading_id)
    return {"message": "Reading deleted"}

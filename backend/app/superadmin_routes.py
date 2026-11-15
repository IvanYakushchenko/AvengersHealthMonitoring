# Code was assisted with Claude.
from fastapi import APIRouter, Depends, HTTPException, Query

from app import auth, checklist, database, health, reserved_names
from app.schemas import (
    AccountInfo,
    Checklist,
    Credentials,
    Crew,
    CrewAdmin,
    CrewMemberInfo,
    NewCrew,
    PasswordReset,
    SavedReading,
    StatusOverview,
    StatusResult,
)

# Every endpoint here is for the superadmin only (403 for everyone else).
# The superadmin creates crews and the mission control account of each crew.
router = APIRouter(prefix="/api/superadmin", dependencies=[Depends(auth.current_superadmin)])


# Find a crew by id, or stop with 404.
def find_crew(crew_id):
    crew = database.get_crew(crew_id)
    if crew is None:
        raise HTTPException(404, "Crew not found")
    return crew


# Find a crew member of this crew, or stop with 404. Read-only health views use this.
def member_of_crew(crew_id, astronaut_id):
    find_crew(crew_id)
    member = database.get_astronaut_by_id(astronaut_id)
    if member is None or member["crew_id"] != crew_id or member["is_admin"] or member["is_superadmin"]:
        raise HTTPException(404, "Crew member not found")
    return member


# Every crew with its member and mission control counts.
@router.get("/crews", response_model=list[Crew])
def list_crews():
    return [
        {
            "crewId": row["id"],
            "name": row["name"],
            "createdAt": row["created_at"],
            "memberCount": row["member_count"],
            "adminCount": row["admin_count"],
        }
        for row in database.list_crews()
    ]


# Create a new crew. Its name must be unique (ignoring upper and lower case).
@router.post("/crews", response_model=Crew)
def create_crew(new: NewCrew):
    name = new.name.strip()
    reserved_names.check_allowed(name)
    if len(name) < 2:
        raise HTTPException(422, "Crew name must be at least 2 characters")
    crew_id = database.create_crew(name)
    if crew_id is None:
        raise HTTPException(409, "A crew with this name already exists")
    crew = find_crew(crew_id)
    return {"crewId": crew["id"], "name": crew["name"], "createdAt": crew["created_at"], "memberCount": 0, "adminCount": 0}


# The crew members of one crew. Their passwords are never shown: only hashes are stored.
@router.get("/crews/{crew_id}/members", response_model=list[CrewMemberInfo])
def list_crew_members(crew_id: int):
    find_crew(crew_id)
    return [
        {"astronautId": row["id"], "username": row["username"], "sex": row["sex"], "createdAt": row["created_at"]}
        for row in database.list_crew(crew_id)
    ]


# Delete a crew member with all their readings and logins.
@router.delete("/crews/{crew_id}/members/{astronaut_id}")
def delete_member(crew_id: int, astronaut_id: int):
    member_of_crew(crew_id, astronaut_id)
    database.delete_crew_member(astronaut_id)
    return {"message": "Crew member deleted"}


# Set a new password for a crew member (they forgot it). Logs them out everywhere.
@router.post("/crews/{crew_id}/members/{astronaut_id}/password")
def reset_member_password(crew_id: int, astronaut_id: int, reset: PasswordReset):
    find_crew(crew_id)
    member = database.get_astronaut_by_id(astronaut_id)
    if member is None or member["crew_id"] != crew_id or member["is_admin"] or member["is_superadmin"]:
        raise HTTPException(404, "Crew member not found")
    database.set_password(astronaut_id, auth.hash_password(reset.newPassword))
    return {"message": "Password reset"}


# Delete a crew. Only an empty crew can be deleted: remove its members and mission
# control accounts first, so no readings or logins are lost by accident.
@router.delete("/crews/{crew_id}")
def delete_crew(crew_id: int):
    find_crew(crew_id)
    if not database.delete_crew(crew_id):
        raise HTTPException(409, "This crew still has members or mission control accounts. Remove them first.")
    return {"message": "Crew deleted"}


# The mission control accounts of one crew.
@router.get("/crews/{crew_id}/admins", response_model=list[CrewAdmin])
def list_crew_admins(crew_id: int):
    find_crew(crew_id)
    return [
        {"astronautId": row["id"], "username": row["username"], "createdAt": row["created_at"]}
        for row in database.list_crew_admins(crew_id)
    ]


# Create a mission control account for a crew. It can manage that crew's members only.
@router.post("/crews/{crew_id}/admins", response_model=AccountInfo)
def create_crew_admin(crew_id: int, new: Credentials):
    find_crew(crew_id)
    reserved_names.check_allowed(new.username)
    username = new.username.lower()
    astronaut_id = database.create_astronaut(
        username,
        auth.hash_password(new.password),
        is_admin=True,
        crew_id=crew_id,
    )
    if astronaut_id is None:
        raise HTTPException(409, "This username is already taken")
    return auth.account_info(database.get_astronaut_by_id(astronaut_id))


# ---------- read-only health of one crew member ----------

# A crew member's status per body region and indicator.
@router.get("/crews/{crew_id}/members/{astronaut_id}/status", response_model=StatusOverview)
def member_status(crew_id: int, astronaut_id: int):
    member_of_crew(crew_id, astronaut_id)
    return health.status_overview(astronaut_id)


# A crew member's checklist, streak and points.
@router.get("/crews/{crew_id}/members/{astronaut_id}/checklist", response_model=Checklist)
def member_checklist(crew_id: int, astronaut_id: int):
    member_of_crew(crew_id, astronaut_id)
    return checklist.build_checklist(astronaut_id)


# A crew member's reading history, e.g. ?indicator=spo2&days=30
@router.get("/crews/{crew_id}/members/{astronaut_id}/readings", response_model=list[SavedReading])
def member_readings(crew_id: int, astronaut_id: int, indicator: str, days: int = Query(30, ge=1, le=365)):
    member_of_crew(crew_id, astronaut_id)
    health.check_indicator(indicator)
    return database.get_readings(astronaut_id, indicator, days)

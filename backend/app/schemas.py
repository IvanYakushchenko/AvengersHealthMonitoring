# Code was assisted with Claude.
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# The four status values the frontend understands. Do not rename.
Status = Literal["normal", "caution", "urgent", "unknown"]


# A crew member's sex, used by the frontend to pick the 3D body model.
Sex = Literal["male", "female"]

# Allowed usernames: 3-30 letters, digits, "_", "." or "-" (no spaces).
USERNAME_PATTERN = r"^[A-Za-z0-9_.-]{3,30}$"


# Username and password, sent to the endpoints that create accounts and crews.
class Credentials(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)


# Sent to /api/login. Any password length is accepted here, so a wrong or old password
# gets the same answer as a too-short one, and blocked names get their own message.
class LoginRequest(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)
    password: str = Field(min_length=1, max_length=128)


# Sent by mission control to POST /api/admin/astronauts to create a crew account.
class NewCrewMember(Credentials):
    sex: Sex


# Sent by mission control to PATCH /api/admin/astronauts/{id} to correct a crew member.
class CrewUpdate(BaseModel):
    sex: Sex


# Account details shared by login and /api/me. isAdmin = mission control of one crew.
# isSuperadmin = creates crews. Mission control and superadmin have no sex (null).
class AccountInfo(BaseModel):
    astronautId: int
    username: str
    isAdmin: bool
    isSuperadmin: bool
    sex: Sex | None
    crewId: int | None
    crewName: str | None


# Answer of login: the same account details plus the token.
# Send the token as "Authorization: Bearer <token>".
class LoginResult(AccountInfo):
    token: str


# Answer of GET /api/me (and of creating a crew account).
class Astronaut(AccountInfo):
    pass


# Sent to POST /api/me/password to change your own password.
class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8, max_length=128)


# Sent by mission control to set a new password for a crew member.
class PasswordReset(BaseModel):
    newPassword: str = Field(min_length=8, max_length=128)


# Sent to POST /api/superadmin/crews to create a crew.
class NewCrew(BaseModel):
    name: str = Field(min_length=2, max_length=60)


# One crew as the superadmin sees it.
class Crew(BaseModel):
    crewId: int
    name: str
    createdAt: datetime
    memberCount: int
    adminCount: int


# One crew member of a crew as the superadmin sees them. Passwords are never shown.
class CrewMemberInfo(BaseModel):
    astronautId: int
    username: str
    sex: Sex | None
    createdAt: datetime


# One mission control account of a crew.
class CrewAdmin(BaseModel):
    astronautId: int
    username: str
    createdAt: datetime


# Code was assisted with Claude.
# A personal normal and caution range for one value, sent by the superadmin.
class PersonalRange(BaseModel):
    normal: list[float] = Field(min_length=2, max_length=2)
    caution: list[float] = Field(min_length=2, max_length=2)


# One value of an indicator with its default ranges and the ranges in use for one crew member.
class PersonalRangeRow(BaseModel):
    indicatorId: str
    valueKey: str
    limits: list[float]
    defaultNormal: list[float]
    defaultCaution: list[float]
    normal: list[float]
    caution: list[float]
    isPersonal: bool


# One crew member as mission control sees them in the crew list.
# status = the worst status over all their indicators.
class CrewMember(BaseModel):
    astronautId: int
    username: str
    sex: Sex | None
    createdAt: datetime
    status: Status
    alertCount: int


# One measurement, e.g. {"indicatorId": "heart_rate", "values": {"bpm": 72}}.
# If takenAt is left out, the server uses the current time.
class Reading(BaseModel):
    indicatorId: str
    values: dict[str, float]
    takenAt: datetime | None = None


# A reading as stored: the same as Reading plus its id (used to edit or delete it).
class SavedReading(Reading):
    id: int


# Sent to PUT /api/readings/{id} to correct a reading. The indicator can't change.
# If takenAt is left out, the old time is kept.
class ReadingUpdate(BaseModel):
    values: dict[str, float]
    takenAt: datetime | None = None


# The rating the backend gives back for a reading.
class StatusResult(BaseModel):
    indicatorId: str
    status: Status
    message: str
    escalate: bool


# One body region with its overall status and the status of each indicator in it.
class RegionStatus(BaseModel):
    regionId: str
    status: Status
    indicators: list[StatusResult]


# Answer of GET /api/status.
class StatusOverview(BaseModel):
    regions: list[RegionStatus]


# One line of the checklist: is this measurement due, and when was it last done.
class ChecklistItem(BaseModel):
    indicatorId: str
    due: bool
    lastTakenAt: datetime | None


# Answer of GET /api/checklist.
class Checklist(BaseModel):
    items: list[ChecklistItem]
    streak: int
    points: int


# The rules for one value, e.g. bpm: limits, normal and caution ranges as [min, max].
# Range the app's simulated sensors pick random values from (see rules.json).
class SimulationRange(BaseModel):
    min: float
    max: float
    whole: bool = False


class ValueRule(BaseModel):
    limits: list[float]
    normal: list[float]
    caution: list[float]
    optional: bool = False
    wholeNumber: bool = False
    simulation: SimulationRange | None = None


# One indicator as described in rules.json (answer of GET /api/indicators).
class IndicatorInfo(BaseModel):
    indicatorId: str
    region: str
    dueEveryHours: float
    values: dict[str, ValueRule]

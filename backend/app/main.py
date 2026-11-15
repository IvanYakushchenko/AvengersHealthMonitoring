# Code was assisted with Claude.
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin_routes import router as admin_router
from app.database import init_db, load_env_file
from app.routes import router
from app.superadmin_routes import router as superadmin_router
from app.status_rules import find_rules_problems

# Where the frontend runs, unless CORS_ORIGINS in .env says otherwise.
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


# The web addresses allowed to call this API from a browser (comma-separated in .env).
def cors_origins():
    load_env_file()
    origins = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app = FastAPI()

# Let the React frontend (another address) call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stop at startup with a clear message if rules.json is incomplete.
problems = find_rules_problems()
if problems:
    raise RuntimeError("rules.json has problems:\n- " + "\n- ".join(problems))

# Make sure the tables exist before any request comes in.
init_db()

app.include_router(router)
app.include_router(admin_router)
app.include_router(superadmin_router)


# Simple check that the server is up.
@app.get("/api/hello")
def hello():
    return {"message": "AvengersHealthMonitoring backend is running"}

# Code was assisted with Claude.
import hashlib
import hmac
import secrets
import threading
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import database

# How many times the password is hashed. Higher = slower to guess.
HASH_ROUNDS = 600_000

# After this many wrong passwords in a row, the error message suggests contacting
# mission control (counted per account and per computer). Nothing gets locked.
HINT_AFTER_WRONG_PASSWORDS = 5
FORGOT_PASSWORD_HINT = "If you forgot your password, contact Mission control to reset it."

# Wrong passwords older than this are forgotten.
FORGET_AFTER_SECONDS = 60 * 60

# Reads the "Authorization: Bearer <token>" header. Also adds the
# "Authorize" button to /docs.
bearer = HTTPBearer(auto_error=False)

# When each recent wrong password happened, e.g. {"127.0.0.1:alice": [time, time]}.
# Kept in memory, so a server restart clears it.
wrong_passwords = {}
wrong_passwords_lock = threading.Lock()


# Turn a password into "salt$hash" text, so the real password is never stored.
def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), HASH_ROUNDS)
    return f"{salt}${digest.hex()}"


# True if the password matches the stored "salt$hash" text.
def check_password(password, stored):
    salt, expected = stored.split("$", 1)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), HASH_ROUNDS)
    return hmac.compare_digest(digest.hex(), expected)


# A hash of a random password, so checking an unknown username takes as long
# as checking a real one (otherwise the speed reveals which usernames exist).
DUMMY_HASH = hash_password(secrets.token_hex(16))


# How many recent wrong passwords this key had (older ones are forgotten).
def count_wrong_passwords(key):
    cutoff = time.monotonic() - FORGET_AFTER_SECONDS
    with wrong_passwords_lock:
        recent = [t for t in wrong_passwords.get(key, []) if t > cutoff]
        if recent:
            wrong_passwords[key] = recent
        else:
            wrong_passwords.pop(key, None)
        return len(recent)


# The error message for a wrong password. After several in a row, it adds the
# hint to contact mission control.
def wrong_password_message(message, key):
    if count_wrong_passwords(key) >= HINT_AFTER_WRONG_PASSWORDS:
        return f"{message}. {FORGOT_PASSWORD_HINT}"
    return message


# Remember one wrong password for this key.
def record_wrong_password(key):
    with wrong_passwords_lock:
        wrong_passwords.setdefault(key, []).append(time.monotonic())


# Forget the wrong passwords for this key (after a correct one).
def clear_wrong_passwords(key):
    with wrong_passwords_lock:
        wrong_passwords.pop(key, None)


# Check a username and password. Returns the account, or None if either is wrong.
# key says whose wrong passwords to count (e.g. "<computer>:<username>").
def verify_login(username, password, key):
    user = database.get_astronaut_by_username(username)
    stored = user["password_hash"] if user else DUMMY_HASH
    if not check_password(password, stored) or user is None:
        record_wrong_password(key)
        return None
    clear_wrong_passwords(key)
    return user


# Make a new random login token, save it and return it.
def start_session(astronaut_id):
    token = secrets.token_urlsafe(32)
    database.save_session(token, astronaut_id)
    return token


# Used by endpoints that need any logged-in account (crew or mission control).
# Returns the account row (id, username, is_admin, is_superadmin, sex, crew_id, crew_name).
def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(401, "Not logged in")
    user = database.get_astronaut_by_token(credentials.credentials)
    if user is None:
        raise HTTPException(401, "Login expired or invalid. Please log in again.")
    return user


# Used by endpoints for crew members only (their own readings).
def current_astronaut(user=Depends(current_user)):
    if user["is_admin"] or user["is_superadmin"]:
        raise HTTPException(403, "Only crew members have own readings. Use the /api/admin endpoints.")
    return user


# Used by endpoints for mission control of one crew only.
def current_admin(user=Depends(current_user)):
    if not user["is_admin"]:
        raise HTTPException(403, "Mission control only")
    return user


# Used by endpoints for the superadmin (creates crews and their mission control accounts).
def current_superadmin(user=Depends(current_user)):
    if not user["is_superadmin"]:
        raise HTTPException(403, "Superadmin only")
    return user


# The account details the frontend needs, as returned by login, /api/me and account lists.
def account_info(user):
    return {
        "astronautId": user["id"],
        "username": user["username"],
        "isAdmin": user["is_admin"],
        "isSuperadmin": user["is_superadmin"],
        "sex": user["sex"],
        "crewId": user["crew_id"],
        "crewName": user["crew_name"],
    }

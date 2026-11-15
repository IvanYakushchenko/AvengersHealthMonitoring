import re

from fastapi import HTTPException

# Names nobody may use for an account or a crew. Compared after normalize(), so
# "fat_burgers", "Fat Burgers" and "FAT-BURGERS" all count as "fat burgers".
BLOCKED_NAMES = {"fat burgers"}


# Lower case, with "_", "-" and spaces all treated as one space.
def normalize(name):
    return re.sub(r"[\s_\-]+", " ", name).strip().lower()


# Stop with a 400 error if the name is blocked.
def check_allowed(name):
    if normalize(name) in BLOCKED_NAMES:
        raise HTTPException(400, "Fat Burgers are not allowed\nGlory to AUK Avengers")

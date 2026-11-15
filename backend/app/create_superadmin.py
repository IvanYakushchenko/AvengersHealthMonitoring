# Code was assisted with Claude.
# Create the superadmin account from the terminal. The superadmin creates crews and their
# mission control accounts. Run from the project folder:  python -m app.create_superadmin
# This is the only way to make a superadmin, so nobody can make themselves one through the API.
import re
from getpass import getpass

from app import auth, database
from app.schemas import USERNAME_PATTERN


# Ask for a username and password, then save the superadmin account.
def main():
    database.init_db()
    username = input("Superadmin username: ").strip().lower()
    if not re.match(USERNAME_PATTERN, username):
        print("Username must be 3-30 letters, digits, '_', '.' or '-' (no spaces).")
        return
    password = getpass("Password (at least 8 characters, not shown): ")
    if len(password) < 8:
        print("Password is too short.")
        return
    if getpass("Repeat password: ") != password:
        print("Passwords don't match.")
        return
    if database.create_astronaut(username, auth.hash_password(password), is_superadmin=True) is None:
        print("This username is already taken.")
        return
    print(f"Superadmin '{username}' created. Log in with POST /api/login.")


if __name__ == "__main__":
    main()

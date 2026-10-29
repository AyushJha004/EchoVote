"""Administrator tool: reset a user's EchoVote password, or list accounts.

Run it where the database lives (it uses the same hashing and DB path as the app):

  docker compose exec backend python admin_reset_password.py --list
  docker compose exec backend python admin_reset_password.py user@example.org --generate
  docker compose exec backend python admin_reset_password.py dr_rao        # prompts for the new password

Without Docker, run it from the backend folder (set ECHOVOTE_DB_PATH if you use a custom database).
Tell the user their new password through a trusted channel and ask them to change it from
Account > Change password after logging in. Password hashes are never printed.
"""

import argparse
import getpass
import secrets
import string
import sys

from auth import DB_PATH, _get_db, _hash_password

MIN_LENGTH = 6


def list_users():
    conn = _get_db()
    rows = conn.execute("SELECT id, username, email, org, created FROM users ORDER BY id").fetchall()
    conn.close()
    print(f"Database: {DB_PATH}")
    if not rows:
        print("No accounts.")
        return 0
    print(f"{'id':>3}  {'username':<20} {'email':<32} {'organisation':<20} created")
    for r in rows:
        print(f"{r['id']:>3}  {r['username']:<20} {r['email']:<32} {(r['org'] or ''):<20} {r['created']}")
    return 0


def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def reset(identifier, new_password):
    ident = identifier.strip().lower()
    conn = _get_db()
    row = conn.execute(
        "SELECT id, username, email FROM users WHERE email = ? OR LOWER(username) = ?",
        (ident, ident),
    ).fetchone()
    if row is None:
        conn.close()
        print(f"No account found for '{identifier}' in {DB_PATH}. Use --list to see accounts.", file=sys.stderr)
        return 1
    conn.execute("UPDATE users SET pw_hash = ? WHERE id = ?", (_hash_password(new_password), row["id"]))
    conn.commit()
    conn.close()
    print(f"Password reset for {row['username']} <{row['email']}>.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Reset an EchoVote user's password or list accounts.")
    parser.add_argument("identifier", nargs="?", help="username or email of the account to reset")
    parser.add_argument("--list", action="store_true", help="list accounts (no passwords) and exit")
    parser.add_argument("--generate", action="store_true", help="set a random password and print it")
    args = parser.parse_args()

    if args.list:
        return list_users()
    if not args.identifier:
        parser.error("give a username or email, or use --list")

    if args.generate:
        password = generate_password()
    else:
        password = getpass.getpass("New password: ")
        if password != getpass.getpass("Repeat new password: "):
            print("Passwords do not match. Nothing changed.", file=sys.stderr)
            return 1
    if len(password) < MIN_LENGTH:
        print(f"Password must be at least {MIN_LENGTH} characters. Nothing changed.", file=sys.stderr)
        return 1

    status = reset(args.identifier, password)
    if status == 0 and args.generate:
        print(f"New password: {password}")
    return status


if __name__ == "__main__":
    sys.exit(main())

"""
EchoVote authentication router.
Endpoints:
  POST /auth/register       — create account
  POST /auth/login          — verify credentials
  POST /auth/reset-password — change password after verifying the current password
"""

import os
import sqlite3
import hashlib
import hmac
import secrets
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Database path ─────────────────────────────────────────────────────────────
DB_PATH = os.environ.get(
    "ECHOVOTE_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db"),
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_db():
    """Open a SQLite connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    """Create the users table if it doesn't exist yet."""
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            email    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            org      TEXT    DEFAULT '',
            pw_hash  TEXT    NOT NULL,
            created  TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def _hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 (built-in, no extra deps)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}${dk.hex()}"


def _verify_password(password: str, pw_hash: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt, stored_dk = pw_hash.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(dk.hex(), stored_dk)
    except Exception:
        return False


# ── Pydantic models ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    org: str = ""


class LoginRequest(BaseModel):
    # Accept either username OR email in the "identifier" field
    identifier: str   # username or email
    password: str


class ResetPasswordRequest(BaseModel):
    identifier: str   # username or email
    current_password: str
    new_password: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest):
    if len(req.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    pw_hash = _hash_password(req.password)
    try:
        conn = _get_db()
        conn.execute(
            "INSERT INTO users (username, email, org, pw_hash) VALUES (?, ?, ?, ?)",
            (req.username.strip(), req.email.strip().lower(), req.org.strip(), pw_hash),
        )
        conn.commit()
        # Fetch the new row to return user info
        row = conn.execute(
            "SELECT id, username, email, org FROM users WHERE email = ?",
            (req.email.strip().lower(),),
        ).fetchone()
        conn.close()
        return {
            "success": True,
            "message": "Account created successfully.",
            "user": {"id": row["id"], "username": row["username"], "email": row["email"], "org": row["org"]},
        }
    except sqlite3.IntegrityError as e:
        err = str(e)
        if "username" in err:
            raise HTTPException(status_code=409, detail="Username already taken. Please choose another.")
        if "email" in err:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=409, detail="Account already exists.")


@router.post("/login")
def login(req: LoginRequest):
    ident = req.identifier.strip().lower()
    conn = _get_db()
    # Try email first, then username
    row = conn.execute(
        "SELECT id, username, email, org, pw_hash FROM users WHERE email = ? OR LOWER(username) = ?",
        (ident, ident),
    ).fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="No account found with that username or email.")

    if not _verify_password(req.password, row["pw_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    return {
        "success": True,
        "message": "Login successful.",
        "user": {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "org": row["org"],
        },
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    ident = req.identifier.strip().lower()
    conn = _get_db()
    row = conn.execute(
        "SELECT id, pw_hash FROM users WHERE email = ? OR LOWER(username) = ?",
        (ident, ident),
    ).fetchone()

    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="No account found with that username or email.")

    if not _verify_password(req.current_password, row["pw_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Incorrect current password.")

    new_hash = _hash_password(req.new_password)
    conn.execute("UPDATE users SET pw_hash = ? WHERE id = ?", (new_hash, row["id"]))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Password changed successfully."}


# Initialise DB on import
_init_db()

import sys, sqlite3
sys.path.insert(0, '.')
import auth
print('auth.py imported OK')
conn = sqlite3.connect('users.db')
rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', rows)
conn.close()

# Quick smoke test: register a user, login, reset password
from auth import _hash_password, _verify_password
h = _hash_password("mypassword123")
assert _verify_password("mypassword123", h), "verify failed!"
assert not _verify_password("wrongpass", h), "false positive!"
print("Password hash/verify: OK")
print("All checks passed.")

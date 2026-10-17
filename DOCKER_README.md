# EchoVote — Docker Deployment

## Prerequisites

1. **Download Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop.

---

## Quick Start

### Step 1 — Add the trained models

Place your trained model files in the `models/` folder:

```
models/
├── ecg_1d_cnn.keras
├── ecg_bilstm.keras
├── ecg_cnn_lstm.keras
├── ecg_lr.pkl
├── ecg_knn.pkl
├── ecg_svm.pkl
├── ecg_rf.pkl
├── ecg_xgb.pkl
└── ecg_scaler.pkl
```

### Step 2 — Start Everything

Open PowerShell in the repository folder:

```powershell
docker compose up -d --build
```

The first model load can take several minutes. Check readiness using:

```powershell
curl.exe http://localhost:3001/api/health
```

With trained models available, the response reports `"models_loaded":8` and `"demo_mode":false`.
Authentication accounts are stored in SQLite at `/app/data/users.db` inside the backend container. Docker Compose mounts the named `user_data` volume at `/app/data`, so accounts persist when containers are rebuilt or recreated.

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes (260,000 iterations), not as plaintext. The `/auth/register` and `/auth/login` endpoints support account creation and login by username or email. The password-change endpoint requires the current password; it does not provide forgotten-password recovery. The frontend Nginx proxy forwards both `/api/*` and `/auth/*` to FastAPI.

> **Keep account data:** `docker compose down` removes containers but keeps the named volume. Do not run `docker compose down -v` unless you intend to permanently delete all accounts.

### Step 3 — Open App

Visit: **http://localhost:3001**

---

## What's Running

- **Backend**: http://localhost:8001 (FastAPI)
- **Frontend**: http://localhost:3001 (React + Nginx)
- **API Proxy**: `/api/*` and `/auth/*` route to backend

---

## Commands

```powershell
# Start or resume after a system restart
docker compose up -d

# Stop the services
docker compose stop

# View backend logs
docker compose logs --tail 100 backend

# Rebuild and start after code changes
docker compose up -d --build
```

---

## Troubleshooting

**Models not loading:**
- Check `models/` folder exists
- Verify file names match exactly
- Check startup: `docker compose logs --tail 100 backend`

**Backend offline:**
```powershell
docker compose ps
docker compose logs --tail 100 backend
```

**Authentication accounts missing after a restart:**
- Confirm Compose still declares the `user_data:/app/data` volume with `docker compose config`.
- Avoid `docker compose down -v`, which deletes named volumes including the account database.
- Account data is local to this Docker installation and is not automatically synced or backed up.

---

## No Models? No Problem

App runs in **Demo Mode** if models not found. Full UI works with simulated predictions.

---

⚠️ **Disclaimer**: Research tool only. Not FDA-approved.

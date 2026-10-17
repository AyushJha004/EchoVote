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

### Step 3 — Open App

Visit: **http://localhost:3001**

---

## What's Running

- **Backend**: http://localhost:8001 (FastAPI)
- **Frontend**: http://localhost:3001 (React + Nginx)
- **API Proxy**: `/api/*` routes to backend

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

---

## No Models? No Problem

App runs in **Demo Mode** if models not found. Full UI works with simulated predictions.

---

⚠️ **Disclaimer**: Research tool only. Not FDA-approved.

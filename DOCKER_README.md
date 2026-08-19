# CardioAI — Docker Deployment

## Prerequisites

1. **Download Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. **Install it** (takes 5 mins)
3. **Restart your computer**

---

## Quick Start

### Step 1 — Add Models

Place your trained model files in the `models/` folder:

```
models/
├── ecg_1d_cnn.h5
├── ecg_bilstm.h5
├── ecg_cnn_lstm.h5
├── ecg_lr.pkl
├── ecg_knn.pkl
├── ecg_svm.pkl
├── ecg_rf.pkl
├── ecg_xgb.pkl
└── ecg_scaler.pkl
```

### Step 2 — Start Everything

Open PowerShell in the `ecg-app` folder:

```powershell
docker-compose up --build
```

Wait for both services to start:
```
backend  | INFO: Uvicorn running on http://0.0.0.0:8000
frontend | ... compiled successfully
```

### Step 3 — Open App

Visit: **http://localhost:3000**

---

## What's Running

- **Backend**: http://localhost:8000 (FastAPI)
- **Frontend**: http://localhost:3000 (React + Nginx)
- **API Proxy**: `/api/*` routes to backend

---

## Commands

```powershell
# Start everything
docker-compose up

# Start in background
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild after code changes
docker-compose up --build
```

---

## Troubleshooting

**Port 8000 already in use:**
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Port 3000 already in use:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Models not loading:**
- Check `models/` folder exists
- Verify file names match exactly
- Restart: `docker-compose down && docker-compose up --build`

**Backend offline:**
```powershell
docker-compose logs backend
```

---

## No Models? No Problem

App runs in **Demo Mode** if models not found. Full UI works with simulated predictions.

---

⚠️ **Disclaimer**: Research tool only. Not FDA-approved.

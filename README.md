# EchoVote — ECG Arrhythmia Classification

> AI-powered cardiac diagnosis using an 8-model ensemble (3 Deep Learning + 5 Machine Learning).  
> Built for doctors and researchers. Capstone research — BMSCE Bengaluru.

---

## 🚀 Quick Start (Docker — Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone the repository
```bash
git clone https://github.com/AyushJha004/EchoVote.git
cd EchoVote
```

### 2. Add your trained models
Place model files in the `models/` folder:
```
models/
├── ecg_1d_cnn.keras       ← 1D-CNN (TensorFlow)
├── ecg_bilstm.keras       ← BiLSTM (TensorFlow)
├── ecg_cnn_lstm.keras     ← CNN-LSTM (TensorFlow)
├── ecg_rf.pkl             ← Random Forest
├── ecg_xgb.pkl            ← XGBoost
├── ecg_knn.pkl            ← KNN
├── ecg_svm.pkl            ← SVM
├── ecg_lr.pkl             ← Logistic Regression
└── ecg_scaler.pkl         ← StandardScaler
```

> **No models?** The app runs in **Demo Mode** automatically — predictions are simulated so you can explore the full UI.

### 3. Build Docker images
```bash
docker build -t ecg-app-backend:latest -f Dockerfile .
docker build -t ecg-app-frontend:latest -f frontend/Dockerfile.frontend frontend/
```

### 4. Start the app
```bash
docker-compose up -d
```

### 5. Open the app
Visit: **http://localhost:3000**

> The backend takes ~2–3 minutes on first start to load all 8 models (TensorFlow initialization).  
> The sidebar shows **"Live"** once all models are ready. If it shows "Offline", wait a moment and refresh.

### Windows: use alternate ports when Grafana uses port 3000

The default Compose setup uses host ports **3000** (frontend) and **8000** (backend). If another application such as Grafana already uses either port, use the runtime setup below instead. It keeps Grafana on port 3000, serves EchoVote at **http://localhost:3001**, and exposes the backend at port 8001. Run these commands in **PowerShell from the repository root**.

Build the images as described above if they do not exist yet. Make sure the trained model files are in `models/`, then start Docker Desktop after a system restart:

```powershell
docker desktop start
docker info
```

Create a dedicated Docker network once, then start the backend and frontend. The backend mounts the repository's `models/` directory. The frontend serves API calls through Nginx, so the browser does not try to contact the conflicting default backend port directly.

```powershell
docker network inspect echovote-runtime *> $null
if ($LASTEXITCODE -ne 0) { docker network create echovote-runtime }

docker run -d --init --restart unless-stopped `
  --name echovote-backend `
  --network echovote-runtime --network-alias backend `
  -p 8001:8000 `
  -v "${PWD}\models:/app/models" `
  -e PYTHONUNBUFFERED=1 `
  ecg-app-backend:latest

docker run -d --restart unless-stopped `
  --name echovote-frontend `
  --network echovote-runtime `
  -p 3001:80 `
  --entrypoint /bin/sh ecg-app-frontend:latest `
  -c "sed -i 's#http://localhost:8000##g' /usr/share/nginx/html/static/js/*.js; exec nginx -g 'daemon off;'"
```

Open **http://localhost:3001** in Chrome. Wait for the TensorFlow models to load, then verify the frontend's proxied health endpoint:

```powershell
curl.exe http://localhost:3001/api/health
docker ps --filter name=echovote
```

The health response should show `"models_loaded":8` and `"demo_mode":false`. After a system restart, Docker Desktop's restart policy should bring both containers back automatically. If they are stopped, start them without creating new containers:

```powershell
docker start echovote-backend echovote-frontend
```

If the page opens but says **Offline**, wait for model loading and check `docker logs --tail 100 echovote-backend`. If the frontend started before the backend was available, restart it after the backend is healthy:

```powershell
docker restart echovote-frontend
```

Do not use `docker compose up` for this alternate-port setup: Compose uses the default host ports 3000 and 8000 and the prebuilt image tags, so it does not rebuild the images or apply the alternate port/proxy configuration above. If the named `echovote-backend` or `echovote-frontend` containers already exist, use `docker start`/`docker restart` rather than running the `docker run` commands again.

---

## 🔄 Stopping & Restarting

```bash
# Stop
docker-compose down

# Start again (no rebuild needed)
docker-compose up -d

# Rebuild frontend after code changes
docker build -t ecg-app-frontend:latest -f frontend/Dockerfile.frontend frontend/
docker-compose up -d

# Check status
docker ps

# View backend logs
docker logs ecg-app-backend-1
```

---

## 🛠 Development (Without Docker)

> **Note:** Requires Python 3.10 or 3.11. Python 3.12+ is not supported by TensorFlow.

### Backend
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
set REACT_APP_API_BASE=http://localhost:8000   # Windows
# export REACT_APP_API_BASE=http://localhost:8000  # Mac/Linux
npm start
# Runs on http://localhost:3000
```

---

## 📊 Testing with Real ECG Data

The models are trained on the **MIT-BIH Arrhythmia Database** (187 samples per beat, AAMI 5-class standard).

**Get test data:**
1. Go to [Kaggle — ECG Heartbeat Categorization](https://www.kaggle.com/datasets/shayanfazeli/heartbeat)
2. Download `mitbih_test.csv`
3. Open in Excel, copy any row's first **187 values** (ignore column 188 — that's the label)
4. Paste into the **Manual** tab in EchoVote and hit Analyze

**Class labels in the dataset:**
| Value | Class |
|-------|-------|
| 0 | Normal (N) |
| 1 | Supraventricular (S) |
| 2 | Ventricular (V) |
| 3 | Fusion (F) |
| 4 | Unclassifiable (Q) |

---

## ✨ Features

### Landing Page & Auth
- Public landing page with live ECG animation, feature highlights, and stats strip
- Login and Sign Up pages with a split-panel layout (ECG trace on the left, form on the right)
- Auth is currently frontend-only (no backend session) — designed to be wired to a real auth provider

### Input Methods
| Tab | Description |
|-----|-------------|
| 📄 CSV | Upload a CSV file with 187 comma-separated ECG amplitude values |
| 📷 Photo | Upload a photo of a printed ECG strip — OpenCV extracts the signal. The original image is displayed exactly as uploaded. |
| ⌨️ Manual | Paste 187 values directly (comma, tab, or space separated; scientific notation supported) |
| 🧪 Sample | Generate synthetic beats: Normal, Ventricular, Supraventricular, Fusion |

### Results Panel
| Tab | Description |
|-----|-------------|
| Overview | Uploaded image preview (photo mode) + Ensemble verdict + Sensitivity Heatmap + DL vs ML comparison |
| Disease Probability | Per-class probability bars + per-model probability table |
| All Models | Individual cards for all 8 models with confidence and probability breakdown |

### Clinical Summary (bottom of results)
- Final prediction with confidence
- ⚠️ DL vs ML disagreement alert when groups disagree
- Consensus level: HIGH / MODERATE / LOW
- Clinical recommendation based on prediction + consensus

### Sensitivity Heatmap
Perturbation-based explainability — slides a 10-sample window across the 187-point signal, masks each window, re-runs all 8 models, and shows which ECG segments most influenced the prediction.

- **Photo uploads:** heatmap is overlaid directly on the original uploaded image
- **CSV / Manual:** heatmap is overlaid on the SVG signal chart
- Color scale: blue (low impact) → amber → red (high impact)

### PDF Export
Click **⬇ Export PDF** in the results tab bar to download a clinical-style report. The PDF includes:
- Colored header with report title and timestamp
- Ensemble prediction, confidence, and agreement count
- Stats row — models run, agreement %, consensus level, DL/ML split
- Ensemble disease probability bars for all 5 classes
- Per-model results table with prediction, confidence, and all 5 class probabilities
- Clinical summary with final prediction and recommendation
- Disclaimer footer

File saves as `EchoVote_Report_YYYY-MM-DD.pdf`.

---

## 🧠 Models

| Model | Type | Architecture |
|-------|------|-------------|
| 1D-CNN | Deep Learning | Conv1D → BatchNorm → MaxPool → Dense |
| BiLSTM | Deep Learning | Bidirectional LSTM × 2 → Dense |
| CNN-LSTM | Deep Learning | Conv1D blocks → BiLSTM × 2 → Dense |
| Random Forest | Machine Learning | 100 estimators |
| XGBoost | Machine Learning | Gradient boosting |
| KNN | Machine Learning | K-Nearest Neighbors |
| SVM | Machine Learning | Support Vector Machine |
| Logistic Regression | Machine Learning | Multinomial |

**Dataset:** MIT-BIH Arrhythmia Database — 87,554 training samples, 5-class AAMI standard  
**Balancing:** SMOTE oversampling applied during training

---

## 🏗 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, SVG charts, jsPDF |
| Backend | FastAPI, Python 3.10 |
| ML/DL | Scikit-learn, XGBoost, TensorFlow 2.16 (CPU) |
| Image processing | OpenCV (CLAHE + adaptive threshold + weighted centroid) |
| Containerization | Docker, Docker Compose, Nginx |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Backend status + models loaded + demo mode flag |
| POST | `/api/predict/csv` | Upload CSV file (187 values) |
| POST | `/api/predict/image` | Upload ECG photo — returns signal + original image as base64 |
| POST | `/api/predict/manual` | JSON `{values: [...187 floats]}` |
| POST | `/api/perturbation` | Sensitivity heatmap computation |
| GET | `/api/clinical-info` | Clinical info for each arrhythmia class |

---

## 📝 Changelog

### Latest
- Added **PDF Export** — clinical-style report with ensemble verdict, per-model table, disease probabilities, and recommendation
- Added **Landing Page** — ECG animation, feature cards, stats strip, CTA
- Added **Login & Sign Up pages** — split-panel auth UI, frontend-only (no backend session yet)
- Fixed DL model loading: patched Keras `quantization_config` version mismatch so all 3 deep learning models load correctly
- Fixed image preprocessing: signal now aligned to MIT-BIH amplitude distribution for accurate predictions
- Renamed app from CardiaScan → **EchoVote**
- **Photo upload:** original image is now displayed exactly as uploaded (no reconstruction artifacts)
- **Sensitivity heatmap** overlaid directly on the real ECG image for photo uploads
- Improved ECG image extraction: CLAHE contrast enhancement + adaptive thresholding + weighted centroid per column
- Fixed Docker health check (replaced `curl` with Python `urllib`; added `start_period` for TF startup time)
- UI redesign: warm paper surfaces, cobalt ink, clinical lab report aesthetic

---

## ⚠️ Disclaimer

Research tool only. Not FDA-approved. Not a medical device.  
Always consult a qualified cardiologist before making any clinical decisions.

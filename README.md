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

> **Note:** Model files are too large for GitHub (>100 MB). They are stored separately in an S3 bucket. See [Model Storage](#-model-storage-s3) below.

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

## 📦 Model Storage (S3)

Model files are not committed to this repository due to GitHub's 100 MB file size limit. They are stored in a private S3 bucket.

**To pull models before running the app:**
```bash
aws s3 sync s3://echovote-models/ ./models/
```

The EC2 instance (or local machine) needs an IAM role or profile with read access to the bucket. No credentials are hardcoded anywhere — access is granted via IAM.

**Bucket structure:**
```
s3://echovote-models/
├── ecg_1d_cnn.keras
├── ecg_bilstm.keras
├── ecg_cnn_lstm.keras
├── ecg_rf.pkl
├── ecg_xgb.pkl
├── ecg_knn.pkl
├── ecg_svm.pkl
├── ecg_lr.pkl
└── ecg_scaler.pkl
```

To update a model, re-upload the file to S3:
```bash
aws s3 cp models/ecg_rf.pkl s3://echovote-models/ecg_rf.pkl
```

---

## ☁️ Deployment (AWS EC2)

The recommended way to run EchoVote publicly without keeping Docker running locally.

### Steps
1. Launch an EC2 `t3.medium` (or larger) instance — Ubuntu 22.04
2. Attach an IAM role with `s3:GetObject` on the `echovote-models` bucket
3. Assign an Elastic IP so the URL stays fixed across restarts
4. SSH in and run:

```bash
# Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# Clone repo
git clone https://github.com/AyushJha004/EchoVote.git
cd EchoVote

# Pull models from S3
aws s3 sync s3://echovote-models/ ./models/

# Build and start
docker build -t ecg-app-backend:latest -f Dockerfile .
docker build -t ecg-app-frontend:latest -f frontend/Dockerfile.frontend frontend/
docker-compose up -d
```

The app will be live at `http://<your-elastic-ip>:3000`.

> For a custom domain, point an A record to the Elastic IP via Route 53 or any registrar.

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
- Public landing page with live ECG animation, feature highlights, and stats
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
| Frontend | React 18, SVG charts |
| Backend | FastAPI, Python 3.10 |
| ML/DL | Scikit-learn, XGBoost, TensorFlow 2.16 (CPU) |
| Image processing | OpenCV (CLAHE + adaptive threshold + weighted centroid) |
| Containerization | Docker, Docker Compose, Nginx |
| Model storage | AWS S3 |
| Deployment | AWS EC2 (t3.medium) |

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
- Added **Landing Page** — ECG animation, feature cards, stats strip, CTA
- Added **Login & Sign Up pages** — split-panel auth UI, frontend-only (no backend session yet)
- Model files moved out of repo — now stored in **AWS S3** (`echovote-models` bucket) due to GitHub 100 MB limit
- Added EC2 deployment guide with S3 model pull step
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

# CardiScan — ECG Arrhythmia Classification

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
> If the UI shows "Offline", wait a moment and refresh.

---

## 🔄 Stopping & Restarting

```bash
# Stop
docker-compose down

# Start again (no rebuild needed)
docker-compose up -d

# Check status
docker ps

# View backend logs
docker logs ecg-app-backend-1
```

---

## 🛠 Development (Without Docker)

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
4. Paste into the **Manual** tab in CardiScan and hit Analyze

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

### Input Methods
| Tab | Description |
|-----|-------------|
| 📄 CSV | Upload a CSV file with 187 comma-separated ECG amplitude values |
| 📷 Photo | Upload a photo of a printed ECG strip — OpenCV extracts the signal |
| ⌨️ Manual | Paste 187 values directly |
| 🧪 Sample | Generate synthetic beats: Normal, Ventricular, Supraventricular, Fusion |

### Results Panel
| Tab | Description |
|-----|-------------|
| Overview | Ensemble verdict + Sensitivity Heatmap + DL vs ML comparison |
| Disease Probability | Per-class probability bars + per-model probability table |
| All Models | Individual cards for all 8 models with confidence and probability breakdown |

### Clinical Summary (bottom of results)
- Final prediction with confidence
- ⚠️ DL vs ML disagreement alert when groups disagree
- Consensus level: HIGH / MODERATE / LOW
- Clinical recommendation based on prediction + consensus

### Sensitivity Heatmap
Perturbation-based explainability — slides a 10-sample window across the 187-point signal, masks each window, re-runs all models, and shows which ECG segments most influenced the prediction.

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
| Backend | FastAPI, Python 3.10+ |
| ML/DL | Scikit-learn, XGBoost, TensorFlow/Keras |
| Image processing | OpenCV |
| Containerization | Docker, Docker Compose, Nginx |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Backend status + models loaded |
| POST | `/api/predict/csv` | Upload CSV file |
| POST | `/api/predict/image` | Upload ECG photo |
| POST | `/api/predict/manual` | JSON `{values: [...187 floats]}` |
| POST | `/api/perturbation` | Sensitivity heatmap computation |
| GET | `/api/clinical-info` | Clinical info for each class |

---

## ⚠️ Disclaimer

Research tool only. Not FDA-approved. Not a medical device.  
Always consult a qualified cardiologist before making any clinical decisions.

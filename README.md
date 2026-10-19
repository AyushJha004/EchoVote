# EchoVote — ECG Arrhythmia Classification

> AI-powered cardiac diagnosis using an 8-model ensemble (3 Deep Learning + 5 Machine Learning).  
> Built for doctors and researchers. Capstone research — BMSCE Bengaluru.

**How it works:** see [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for how images are read, the model and screening logic, and how the sensitivity heatmap is computed. A screen-by-screen tour with screenshots is in [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md).

---

## Quick Start (Docker)

1. Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Clone the repository and open PowerShell in its folder:
   ```powershell
   git clone https://github.com/AyushJha004/EchoVote.git
   cd EchoVote
   ```
3. Put the trained model files in `models/` (all 8 models are required for full ensemble results; there is no demo mode).
4. Build the images and start the app:
   ```powershell
   docker compose up -d --build
   ```
5. Open **http://localhost:3001**. Check model status at **http://localhost:3001/api/health**; with trained models loaded, the response lists all 8 models with `"live":true`.

### After a system restart

Start Docker Desktop, open PowerShell in the repository folder, then run:

```powershell
docker compose up -d
```

The containers are configured to restart automatically when Docker starts. Model initialization can take a few minutes. To check backend startup:

```powershell
docker compose logs --tail 100 backend
```

For a detailed Windows and VS Code terminal walkthrough, see
[RUN_AFTER_RESTART.md](./RUN_AFTER_RESTART.md).

### Stop or update

```powershell
docker compose stop
docker compose up -d --build
```

`docker compose stop` preserves the containers for the next start. `docker compose down` removes them.
The named `user_data` volume is retained by `docker compose down`; remove it only if you intend to permanently delete all registered accounts.

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
```powershell
cd frontend
npm install
$env:REACT_APP_API_BASE = "http://localhost:8000"
npm start
# Runs on http://localhost:3000
```

For Mac/Linux, set `REACT_APP_API_BASE=http://localhost:8000` before running `npm start`.

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
- FastAPI authentication API for account registration and login by username or email
- Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes (260,000 iterations); plaintext passwords are not stored
- SQLite user database is stored in Docker's persistent `user_data` volume at `/app/data/users.db`
- Password changes require the current password; this is not a forgotten-password recovery flow
- Login is UI-level only: authenticated state is held in the frontend and is not backed by server sessions or protected API routes

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
- Predicted class selected by the highest averaged model class score
- Model vote share and agreement tier shown separately from the selected class
- ⚠️ DL vs ML disagreement alert when groups disagree
- Model Agreement Tier: HIGH / MODERATE / LOW, based on vote share
- Neutral note to interpret the model output alongside the ECG and clinical context

The averaged class scores are uncalibrated model outputs, not clinical probabilities or a diagnosis.

### Sensitivity Heatmap
Perturbation-based explainability — slides a 10-sample window across the 187-point signal, masks each window, re-runs all 8 models, and shows which ECG segments most influenced the prediction.

- **Photo uploads:** heatmap is overlaid directly on the original uploaded image
- **CSV / Manual:** heatmap is overlaid on the SVG signal chart
- Color scale: blue (low impact) → amber → red (high impact)

### PDF Export
Click **⬇ Export PDF** in the results tab bar to download a clinical-style report. The PDF includes:
- Colored header with report title and timestamp
- Predicted beat class selected by the highest averaged class score
- Stats row — models run, vote agreement %, Model Agreement Tier, DL/ML split
- Ensemble class-score bars for all 5 classes
- Per-model results table with prediction, confidence, and all 5 class probabilities
- Methodology note distinguishing the averaged class scores from model vote agreement
- Neutral interpretation note; scores are uncalibrated and require ECG and clinical context
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
| GET | `/api/health` | Backend status + models loaded + `live` flag |
| POST | `/api/predict/csv` | Upload CSV file (187 values) |
| POST | `/api/predict/image` | Upload ECG photo — returns signal + original image as base64 |
| POST | `/api/predict/manual` | JSON `{values: [...187 floats]}` |
| POST | `/api/perturbation` | Sensitivity heatmap computation |
| GET | `/api/clinical-info` | Clinical info for each arrhythmia class |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Authenticate by username or email |
| POST | `/auth/reset-password` | Change password after verifying the current password |

The frontend Nginx proxy forwards both `/api/*` and `/auth/*` requests to FastAPI.
The backend reads the database path from `ECHOVOTE_DB_PATH`; Docker Compose sets it
to `/app/data/users.db` and mounts the persistent `user_data` volume at `/app/data`.
Rebuilding or recreating containers does not remove this named volume. Do not run
`docker compose down -v` unless you intend to delete all registered users.

---

## 📝 Changelog

### Latest
- Added backend-backed signup, login, and password changes using SQLite and salted PBKDF2 password hashes
- Persisted account data in a Docker Compose volume and routed authentication requests through Nginx
- Added a Windows/VS Code terminal guide for starting EchoVote after a laptop restart
- Added **PDF Export** — clinical-style report with ensemble verdict, per-model table, disease probabilities, and recommendation
- Added **Landing Page** — ECG animation, feature cards, stats strip, CTA
- Added **Login & Sign Up pages** — split-panel auth UI
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

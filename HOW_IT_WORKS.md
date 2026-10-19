# How EchoVote works

EchoVote is a research decision-support tool that screens ECG beats for arrhythmia. This document explains
the logic of the whole application: how each kind of input is read, how the models produce a result, how the
arrhythmia screen is decided, and how the sensitivity heatmap is computed.

> **Not a medical device.** EchoVote is an academic capstone project (BMSCE Bengaluru). It is not certified by
> the FDA, CE or CDSCO and does not provide a diagnosis. A clinician must confirm every finding.

For an annotated tour with screenshots of every screen, see [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md).

---

## 1. Architecture

```
Browser (React)  ──►  Nginx (port 3001)  ──►  FastAPI backend (port 8001 -> 8000 in the container)
   │                        │  /api/*, /auth/*          ├─ 8 models loaded at start-up (models/ folder)
   │                        └─ static React build       ├─ SQLite user store (auth.py, volume user_data)
   └─ jsPDF builds the PDF report in the browser        └─ OpenCV / SciPy for photo processing
```

| Part | File | Role |
|---|---|---|
| Backend API | `backend/main.py` | Input parsing, photo processing, model inference, ensemble, arrhythmia screen, heatmap |
| Auth | `backend/auth.py` | Register, login and password reset against a SQLite database |
| Frontend | `frontend/src/App.js` | Shell, Analyze page, History; calls the API |
| Results | `frontend/src/ResultsPanel.js` | Results tabs, heatmap display, PDF report |
| Ensemble helper | `frontend/src/ensemble.js` | Picks the predicted class from the averaged scores |
| Guide / About | `frontend/src/InfoPages.js` | Reference pages |
| Containers | `docker-compose.yml`, `Dockerfile`, `frontend/Dockerfile.frontend` | Runs backend and frontend |

There is **no demo mode**. If the models cannot be loaded, prediction endpoints return HTTP 503 and the UI shows
"Models unavailable". `/api/health` reports `live`, `models_loaded` and `models_expected`.

---

## 2. The models

All models classify a single heartbeat of **187 samples** into five AAMI classes:

| Index | Class | Meaning |
|---|---|---|
| 0 | N | Normal |
| 1 | S | Supraventricular ectopic |
| 2 | V | Ventricular ectopic |
| 3 | F | Fusion |
| 4 | Q | Unclassifiable |

* **Deep learning (3):** 1D-CNN, BiLSTM, CNN-LSTM (`models/*.keras`).
* **Classical ML (5):** Random Forest, XGBoost, KNN, SVM, Logistic Regression (`models/*.pkl`).
* **Scaler:** `ecg_scaler.pkl`, a per-sample-position z-score fitted on the training data.

They were trained on the **MIT-BIH Arrhythmia Database** in the common 187-sample heartbeat format (87,554 training
beats, class imbalance handled with SMOTE).

**Input to every model is the scaler-normalised beat.** The classical models and the deep-learning models all
receive `scaler.transform(beat)`. (An earlier version fed the deep-learning models `beat / max(beat)`, which
made them far less accurate on real beats; see the validation notes in section 9.)

---

## 3. Reading each kind of input

### 3.1 CSV and pasted values (`/api/predict/csv`, `/api/predict/manual`)

* The first row is read, trying comma, tab and whitespace delimiters in turn.
* A trailing class-label column (188 values, last in 0-4) is dropped; only the first 187 values are kept.
* Short input is zero-padded to 187. NaNs become 0.
* The pasted-values form requires exactly 187 values.
* The beat goes straight to the models (section 4).

### 3.2 ECG photos and scans (`/api/predict/image`)

A photo of a strip contains many beats, a coloured grid and sometimes frames or labels. The pipeline recovers the
waveform, cuts it into single beats in the training format, and analyses every beat.

**Step A: validate.** Reject the image if it cannot be decoded, is blank (grey-level standard deviation below 8) or
has too little contrast (5th to 95th percentile spread below 30).

**Step B: find the trace pixels** (`extract_trace` in `main.py`).
1. Crop 4% off the top and bottom and 1% off each side to drop borders and labels.
2. Downscale (never upscale) to at most 2000 x 600 px, then apply a 3x3 Gaussian blur.
3. **Two-level Otsu threshold.** The first Otsu threshold separates "ink" (trace, dark grid lines) from paper.
   A second Otsu threshold is then applied to the ink pixels only. If the two ink classes differ clearly in
   brightness (mean difference above 45 grey levels), only the darker class is kept. This keeps a dark trace
   and discards a lighter, coloured grid such as the orange, grey or blue paper in typical ECG images.
4. Remove long vertical rules (frame edges, major grid lines): a vertical morphological opening with a tall kernel
   (80% of the height), subtracted from the mask.
5. Keep only connected components at least 25% as wide as the widest one, which drops grid fragments and text.
6. Crop to the columns that contain trace, so empty margins do not distort the signal.

**Step C: turn pixels into a signal.** For each image column:
* If the trace is thin there (up to 2 px tall), take its mean row.
* If it is a vertical stroke (a QRS spike), take the stroke's **tip farthest from where the trace just was**. This
  preserves the R-peak height and the S-wave depth, which a plain centroid would flatten.
* Gaps are filled by linear interpolation, then a 3-point moving average (with edge padding) smooths the line.
* The signal is flipped so peaks point up, shifted so the 20th percentile is 0, and scaled so the maximum is 1.

**Step D: cut into beats** (`segment_beats`).
1. Find R peaks with `scipy.signal.find_peaks`: height at least 0.4, prominence at least 0.3, minimum spacing of
   1/80 of the strip width.
2. Fewer than two peaks means the strip cannot be segmented. The whole image is then resampled to 187 samples
   and treated as one beat (the old behaviour).
3. The training beats run from one R peak to the next. So each beat is the stretch between consecutive R peaks.
   Intervals shorter than 0.45x or longer than 1.8x the median interval (probably a missed or extra peak) are skipped.
4. Each segment is resampled to a length proportional to its R-R interval. The median interval maps to
   **106 samples** (the median non-padded beat length in the MIT-BIH test set), up to a maximum of 187.
5. Each beat is min-max scaled to 0-1 and **zero-padded to 187**, matching the dataset's layout.

A photo has no time scale, so the "106 samples per median interval" mapping assumes a typical heart rate. This is
an approximation.

**Step E: analyse every beat, then combine** (section 5). The response also carries the extracted trace, the R-peak
positions, and a rhythm-regularity number (section 6).

**Speed.** Every beat in the strip is run through all 8 models (the KNN model is the slowest, roughly 6 s per beat
on CPU), so a strip with about 15 beats can take 1 to 2 minutes. The Nginx proxy allows up to 900 s.

**Limitations.** The models were trained on digital MIT-BIH beats, not on beats cut from photos, so photo results
are less reliable. The photo path has been checked for the correct number of beats on synthetic strips and on
three textbook strips, but **its classification accuracy on real photos has not been validated**.

---

## 4. From one beat to a prediction

For one 187-sample beat (`_run_predict`):

1. `scaler.transform` normalises the beat.
2. Each of the 8 models returns a probability for each of the 5 classes.
   * Deep-learning models: `model.predict` on the scaled beat shaped (187, 1).
   * Classical models: `predict_proba` on the scaled beat.
3. **Ensemble (soft voting).** The class probabilities of all models that returned a valid result are averaged
   (`compute_ensemble_probs`). If no model returns a valid result, the request fails instead of returning a default.
4. **Predicted beat class** = the class with the highest mean probability (ties go to the order N, S, V, F, Q).
   The count of models that individually voted for that class is shown separately as "agreement"; it does not choose
   the class. Agreement tiers: High at 87.5% or more of models, Moderate at 62.5% or more, Low below that.

Scores are uncalibrated model outputs, not clinical probabilities.

---

## 5. The arrhythmia screen

The beat class is five-way. The screen is a yes/no on top of it.

* `P(abnormal) = 1 - P(Normal)`, using the ensemble probabilities.
* A beat is **flagged** when `P(abnormal) >= 0.4` (`ARRHYTHMIA_THRESHOLD` in `main.py`).
  Any non-Normal class (S, V, F, Q) counts as abnormal.
* **Single beat (CSV, paste, sample):** flagged means "possible arrhythmia detected".
* **Strip (photo):** every beat is scored. The strip is flagged when **at least 20% of its beats are flagged, or
  any one beat has P(abnormal) of 0.7 or more** (so an isolated premature ventricular beat is not lost).
  The reported probability and the beat shown in the results belong to the most abnormal beat (when the strip is
  flagged) or the median beat (when it is not).
* The 0.4 threshold was chosen from MIT-BIH test beats as a screening trade-off (more sensitivity, some extra false
  alarms). It was chosen *before* the deep-learning input fix and has not been re-tuned.

### Rhythm regularity (photos only)

From the R-peak positions the backend computes the coefficient of variation of the R-R intervals (needs at least
five peaks). A value above 0.15 sets `irregular_rhythm`, and the UI adds a note that irregular spacing can accompany
rhythm disorders such as atrial fibrillation. This is a simple scale-free check. It is not validated, and a missed
or extra peak can also make a strip look irregular.

### What the screen cannot do

The models label **beat shapes**. They cannot recognise rhythm disorders such as atrial flutter or atrial
fibrillation as such; at best an irregular strip is flagged as abnormal and its beats are labelled with the closest
known class. Detecting those would need a model trained on rhythm-labelled data.

---

## 6. The sensitivity heatmap (perturbation / occlusion map)

The heatmap answers: **which parts of this beat most influenced the prediction?**
It is computed by `/api/perturbation` and `compute_perturbation` in `main.py`.

**Algorithm**
1. Take the beat (187 samples) and the class index to explain: the predicted (consensus) class.
2. Slide a **10-sample window** across the beat in steps of 10, giving 19 windows (the last one is shorter).
3. For each window make a copy of the beat with that window **set to 0** (occluded).
4. Run the **whole ensemble** on the original and on all 19 occluded copies in one batch (`_run_predict_batch`).
5. For each window compute `drop = P_original(class) - P_occluded(class)`, using the **ensemble** probability of
   the explained class. Negative drops are set to 0 (occluding that window did not hurt the prediction).
6. Every sample in a window gets the window's drop value.
7. Divide by the largest drop so the result is **0 to 1**. The most influential window is always 1.0.

The response contains the 187 sensitivity values, the original ensemble probability (`base_conf`), the class
index and the window size.

**Display** (`ResultsPanel.js`)
* The beat is drawn with a colour ribbon underneath. Blue means low impact, amber moderate and red high.
* For photo uploads the same colours are overlaid on the original image.
* "Top sensitive regions" lists the three 10-sample windows with the highest average sensitivity.
* The PDF report shades the high-sensitivity segments (average at least 0.6) on the beat trace.

**How to read it, and its limits**
* It is relative: values are normalised per beat, so a red region is "most influential for this beat", not an
  absolute measure.
* It is an *occlusion* test, not a proof of cause. Zeroing a segment creates an unnatural signal that the models
  never saw in training, so it measures sensitivity of the models, not clinical importance.
* For photos it explains the representative beat that was cut from the strip, not the whole image.
* Typical interpretation: sensitivity on the QRS complex is expected; on the P-wave region it may reflect atrial
  activity; on the ST-T region it may reflect repolarisation; on the edges it may mean the models are reacting to
  noise or baseline wander. These are aids for a human reader, not findings.

---

## 7. Frontend flow

1. The user logs in (SQLite-backed `/auth/*`), lands on **Analyze** and chooses CSV, Photo, Paste or Samples.
2. The request goes to the matching `/api/predict/*` endpoint and the result is stored in session **History**
   (up to 10 entries; cleared on refresh).
3. **Clinical Summary** (default tab) shows the arrhythmia screen, predicted beat type, the beat with the heatmap
   and a reminder that a clinician must confirm. The heatmap is requested automatically.
4. **Model Comparison**, **Ensemble Scores** and **All Models** hold the per-model detail for researchers.
5. **Export PDF** builds the report in the browser with jsPDF:
   * Page 1 (clinician): result, most likely beat type with a plain-language meaning, the uploaded image (photos), the
     analysed beat with heatmap shading, beat-type probabilities, suggested next steps, disclaimer.
   * Page 2 (researcher): the 8-model table, deep-learning vs classical cohorts, screening rule, ensemble method,
     known limitations, methodology and sign-off fields.
6. Samples are synthetic beats generated in the browser. They only demonstrate the interface; the models are not
   expected to classify them reliably.

---

## 8. API summary

| Method and path | Purpose |
|---|---|
| `GET /api/health` | `live`, `models_loaded`, `models_expected`, threshold |
| `POST /api/predict/csv` | One CSV beat |
| `POST /api/predict/manual` | `{"values": [187 numbers]}` |
| `POST /api/predict/image` | Photo of a strip (segmented into beats) |
| `POST /api/perturbation` | Sensitivity map for a beat and class |
| `GET /api/clinical-info` | Plain-language descriptions per class |
| `POST /auth/register`, `/auth/login`, `/auth/reset-password` | Accounts |

Each prediction response contains `signal`, `predictions` (per model: class, confidence, probabilities),
`ensemble_probs`, `arrhythmia` (`detected`, `p_abnormal`, `threshold`, plus `beats_total`, `beats_flagged` and
`irregular_rhythm` for photos) and, for photos, `segmentation` (per-beat scores, the representative beat, the trace
and peak positions, and the rhythm-regularity number) and `source_image`.

---

## 9. Validation status

Measured on the MIT-BIH test set (21,892 beats), classical models, scaler-normalised input:

| Model | Accuracy (5 classes) |
|---|---|
| Random Forest | 98.1% |
| XGBoost | 97.9% |
| Logistic Regression | 66.9% (over-predicts abnormal classes) |

On a 5,000-beat sample through the running backend, abnormal-beat detection (any non-Normal class) was:

| Model | Sensitivity | Specificity |
|---|---|---|
| RF / XGB / KNN | 92-97% | 95-99% |
| 1D-CNN, BiLSTM, CNN-LSTM **after** the input fix | 97-98% | 94-96% |
| BiLSTM, CNN-LSTM, 1D-CNN **before** the fix | 9% / 49% / 61% | n/a |

Caveats you should keep in mind:
* The MIT-BIH test beats come from the same patients as the training beats, so performance on new patients will be
  lower. A patient-wise evaluation has not been done.
* The final 8-model ensemble was not re-evaluated end to end after the deep-learning fix, so the 0.4 screen
  threshold is not re-tuned.
* Photo accuracy is unvalidated (section 3.2).
* Synthetic samples are not clinical data; the models often disagree on them.

---

## 10. Running it

```bash
docker compose up -d --build        # backend loads ~800 MB of models; wait ~40 s for /api/health
# app: http://localhost:3001      API health: http://localhost:3001/api/health
```

The `models/` folder is mounted from disk and is not in git. See `DOCKER_README.md` for details.

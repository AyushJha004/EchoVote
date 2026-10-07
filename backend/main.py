"""
ECG Arrhythmia Classification - FastAPI Backend
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import io
import os
import joblib
import json
import warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="ECG Classifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LABEL_MAP = {
    0: "Normal (N)",
    1: "Supraventricular (S)",
    2: "Ventricular (V)",
    3: "Fusion (F)",
    4: "Unclassifiable (Q)"
}

CLINICAL_INFO = {
    "Normal (N)": {"desc": "Normal sinus rhythm detected. No arrhythmia present.", "severity": "normal"},
    "Supraventricular (S)": {"desc": "Supraventricular ectopic beat. Originates above the ventricles. Cardiology follow-up recommended.", "severity": "warning"},
    "Ventricular (V)": {"desc": "Ventricular ectopic beat detected. Originates in the ventricles. Prompt medical review required.", "severity": "danger"},
    "Fusion (F)": {"desc": "Fusion beat: combination of normal and ventricular. Clinical review recommended.", "severity": "warning"},
    "Unclassifiable (Q)": {"desc": "Beat could not be classified. Signal quality may be poor. Manual review needed.", "severity": "info"},
}

models = {}
scaler = None

def load_models():
    global models, scaler
    model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
    if not os.path.isdir(model_dir):
        model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')

    # Try loading TensorFlow DL models
    dl_files = {
        '1D-CNN':   ('ecg_1d_cnn.keras',   'ecg_1d_cnn.h5'),
        'BiLSTM':   ('ecg_bilstm.keras',    'ecg_bilstm.h5'),
        'CNN-LSTM': ('ecg_cnn_lstm.keras',  'ecg_cnn_lstm.h5'),
    }
    try:
        import tensorflow as tf
        import zipfile, tempfile, shutil, h5py

        def _build_1d_cnn():
            m = tf.keras.Sequential([
                tf.keras.layers.Conv1D(64, 5, padding='same', activation='relu', input_shape=(187, 1)),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.MaxPooling1D(2),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Conv1D(128, 5, padding='same', activation='relu'),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.MaxPooling1D(2),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Conv1D(256, 3, padding='same', activation='relu'),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.GlobalAveragePooling1D(),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(128, activation='relu'),
                tf.keras.layers.Dropout(0.4),
                tf.keras.layers.Dense(5, activation='softmax'),
            ])
            return m

        def _build_bilstm():
            m = tf.keras.Sequential([
                tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True), input_shape=(187, 1)),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32)),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(64, activation='relu'),
                tf.keras.layers.Dropout(0.4),
                tf.keras.layers.Dense(5, activation='softmax'),
            ])
            return m

        def _build_cnn_lstm():
            m = tf.keras.Sequential([
                tf.keras.layers.Conv1D(64, 5, padding='same', activation='relu', input_shape=(187, 1)),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.Conv1D(64, 5, padding='same', activation='relu'),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.MaxPooling1D(2),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Conv1D(128, 3, padding='same', activation='relu'),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.Conv1D(128, 3, padding='same', activation='relu'),
                tf.keras.layers.BatchNormalization(momentum=0.99, epsilon=0.001),
                tf.keras.layers.MaxPooling1D(2),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(128, return_sequences=True)),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64)),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(128, activation='relu'),
                tf.keras.layers.Dropout(0.4),
                tf.keras.layers.Dense(64, activation='relu'),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(5, activation='softmax'),
            ])
            return m

        builders = {'1D-CNN': _build_1d_cnn, 'BiLSTM': _build_bilstm, 'CNN-LSTM': _build_cnn_lstm}

        # Patch Dense to ignore quantization_config (Keras version mismatch)
        original_dense_init = tf.keras.layers.Dense.__init__
        def _patched_dense_init(self, *args, **kwargs):
            kwargs.pop('quantization_config', None)
            original_dense_init(self, *args, **kwargs)
        tf.keras.layers.Dense.__init__ = _patched_dense_init

        for name, fnames in dl_files.items():
            for fname in fnames:
                path = os.path.join(model_dir, fname)
                if not os.path.exists(path):
                    continue
                try:
                    model = tf.keras.models.load_model(path, compile=False)
                    models[name] = model
                    print(f"✅ {name} loaded ({fname})")
                    break
                except Exception as e1:
                    print(f"⚠️  {name} load_model failed: {e1}")
                    # Fallback: build architecture and load weights only
                    try:
                        import tempfile, zipfile, shutil
                        tmpdir = tempfile.mkdtemp()
                        with zipfile.ZipFile(path) as zf:
                            zf.extractall(tmpdir)
                        model = builders[name]()
                        model.load_weights(os.path.join(tmpdir, 'model.weights.h5'))
                        shutil.rmtree(tmpdir)
                        models[name] = model
                        print(f"✅ {name} loaded via weights fallback ({fname})")
                        break
                    except Exception as e2:
                        print(f"⚠️  {name} ({fname}) weights fallback also failed: {e2}")
    except Exception as e:
        print(f"⚠️  DL model setup failed: {e}")

    # ML models
    ml_files = {
        'Random Forest':      'ecg_rf.pkl',
        'XGBoost':            'ecg_xgb.pkl',
        'KNN':                'ecg_knn.pkl',
        'SVM':                'ecg_svm.pkl',
        'Logistic Regression':'ecg_lr.pkl',
    }
    for name, fname in ml_files.items():
        path = os.path.join(model_dir, fname)
        if os.path.exists(path):
            try:
                models[name] = joblib.load(path)
                print(f"✅ {name} loaded")
            except Exception as e:
                print(f"⚠️  {name} not loaded: {e}")

    # Scaler
    scaler_path = os.path.join(model_dir, 'ecg_scaler.pkl')
    if os.path.exists(scaler_path):
        try:
            scaler = joblib.load(scaler_path)
            print("✅ Scaler loaded")
        except Exception as e:
            print(f"⚠️  Scaler not loaded: {e}")

    if not models:
        print("⚠️  No models found — running in DEMO MODE")

def compute_ensemble_probs(results):
    """Average per-class probabilities across all valid models."""
    valid = [r for r in results.values() if r.get('probs') and r['prediction'] != 'Error']
    if not valid:
        return [0.2] * 5
    avg = np.mean([r['probs'] for r in valid], axis=0)
    return [round(float(p), 4) for p in avg]


def demo_predict(signal):
    import random
    results = {}
    demo_models = ['1D-CNN', 'BiLSTM', 'CNN-LSTM', 'Random Forest', 'XGBoost', 'KNN', 'SVM', 'Logistic Regression']
    for name in demo_models:
        pred_idx = 0
        probs = [0.0] * 5
        probs[pred_idx] = round(random.uniform(0.82, 0.98), 4)
        remaining = 1 - probs[pred_idx]
        for i in range(1, 5):
            probs[i] = round(remaining / 4, 4)
        results[name] = {
            'prediction': LABEL_MAP[pred_idx],
            'confidence': probs[pred_idx],
            'probs': probs,
            'class_idx': pred_idx,
            'type': 'DL' if name in ('1D-CNN', 'BiLSTM', 'CNN-LSTM') else 'ML'
        }
    return results, compute_ensemble_probs(results)

DL_MODELS = {'1D-CNN', 'BiLSTM', 'CNN-LSTM'}


def run_predict(signal):
    global models, scaler

    if not models:
        return demo_predict(signal)

    signal = np.nan_to_num(signal.astype(float), nan=0.0)

    if scaler is not None:
        signal_scaled = scaler.transform(signal.reshape(1, -1))
    else:
        signal_scaled = signal.reshape(1, -1)

    # DL models expect 0-1 range — signal is already 0-1 after scaler-aligned preprocessing
    sig_dl = (signal / (signal.max() + 1e-8)).reshape(1, 187, 1)

    results = {}
    for name, model in models.items():
        try:
            if name in DL_MODELS:
                probs = model.predict(sig_dl, verbose=0)[0]
                pred_class = int(np.argmax(probs))
                confidence = float(probs[pred_class])
            else:
                pred_class = int(model.predict(signal_scaled)[0])
                probs_all  = model.predict_proba(signal_scaled)[0]
                confidence = float(probs_all[pred_class])
                probs      = probs_all

            results[name] = {
                'prediction': LABEL_MAP[pred_class].strip(),
                'confidence': round(confidence, 4),
                'probs':      [round(float(p), 4) for p in probs],
                'class_idx':  pred_class,
                'type':       'DL' if name in DL_MODELS else 'ML'
            }
        except Exception as e:
            results[name] = {'prediction': 'Error', 'confidence': 0.0, 'probs': [0]*5,
                             'error': str(e), 'type': 'DL' if name in DL_MODELS else 'ML'}

    return results, compute_ensemble_probs(results)


@app.on_event("startup")
def startup():
    load_models()


@app.get("/api/health")
def health():
    return {
        'status': 'ok',
        'models_loaded': len(models),
        'model_names': list(models.keys()),
        'demo_mode': len(models) == 0
    }


@app.post("/api/predict/csv")
async def predict_csv(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = contents.decode('utf-8', errors='ignore').strip()
        # Auto-detect delimiter: try comma first, then tab, then whitespace
        for delim in [',', '\t', None]:
            try:
                data = np.genfromtxt(io.StringIO(text), delimiter=delim)
                if data.ndim == 2:
                    data = data[0]
                # Strip label column if present (last value is integer class 0-4)
                if len(data) == 188 and data[-1] in range(5):
                    data = data[:187]
                data = data[:187]
                if len(data) >= 10 and not np.all(np.isnan(data)):
                    break
            except Exception:
                continue
        if len(data) < 187:
            data = np.pad(data, (0, 187 - len(data)))
        data = np.nan_to_num(data, nan=0.0)
        results, ensemble_probs = run_predict(data)
        return {'success': True, 'signal': data.tolist(), 'predictions': results, 'ensemble_probs': ensemble_probs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/predict/manual")
async def predict_manual(payload: dict):
    try:
        values = np.array(payload['values'], dtype=float)
        if len(values) != 187:
            raise ValueError(f"Need 187 values, got {len(values)}")
        results, ensemble_probs = run_predict(values)
        return {'success': True, 'signal': values.tolist(), 'predictions': results, 'ensemble_probs': ensemble_probs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/predict/image")
async def predict_image(file: UploadFile = File(...)):
    try:
        import cv2
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError("Could not decode image. Please upload a valid JPG or PNG file.")

        h, w = img.shape

        # ── 1. Reject blank / low-contrast images ───────────────────────
        if float(np.std(img)) < 8.0:
            raise ValueError("Image appears to be blank or uniform. Please upload a photo of an ECG strip.")
        p5, p95 = np.percentile(img, 5), np.percentile(img, 95)
        if (p95 - p5) < 30:
            raise ValueError("Image has insufficient contrast. Please upload a clear ECG strip photo.")

        # ── 2. Crop central 80% vertically (skip axis labels / borders) ─
        img_crop = img[int(h * 0.10):int(h * 0.90), :]

        # ── 3. Resize to working resolution ─────────────────────────────
        resized = cv2.resize(img_crop, (187, 256))

        # ── 4. CLAHE contrast enhancement ───────────────────────────────
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        resized = clahe.apply(resized)

        # ── 5. Ensure dark trace on light background ─────────────────────
        if np.mean(resized) < 128:
            resized = 255 - resized

        # ── 6. Adaptive threshold ────────────────────────────────────────
        binary = cv2.adaptiveThreshold(
            resized, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            blockSize=15, C=6
        )

        # ── 7. Morphological opening to remove noise ─────────────────────
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

        # ── 8. Per-column weighted centroid → raw signal ─────────────────
        rows_idx = np.arange(256, dtype=float)
        raw = np.zeros(187, dtype=float)
        for col in range(187):
            col_data = binary[:, col].astype(float)
            total = col_data.sum()
            raw[col] = float(np.sum(rows_idx * col_data) / total) if total > 0 else 128.0

        # ── 9. Smooth single-column spikes ───────────────────────────────
        raw = np.convolve(raw, np.ones(3) / 3, mode='same')

        # ── 10. Validate extracted signal ────────────────────────────────
        if float(np.std(raw)) < 2.0 or float(raw.max() - raw.min()) < 5.0:
            raise ValueError("Could not detect an ECG waveform in this image. Please upload a clear photo of an ECG strip with a visible trace.")

        # ── 11. Invert (peaks up) and normalize to MIT-BIH distribution ──
        # MIT-BIH: baseline ~0.20-0.28, QRS peak ~1.0, trailing end ~0.0
        # We align the extracted signal to this range so the scaler works correctly.
        raw = raw.max() - raw                              # invert: peaks go up
        baseline = float(np.percentile(raw, 10))          # isoelectric line
        peak     = float(np.percentile(raw, 99))          # QRS peak
        span     = peak - baseline + 1e-8
        signal   = (raw - baseline) / span                 # 0 at baseline, 1 at peak
        signal   = np.clip(signal, 0.0, 1.0)              # clamp sub-baseline noise

        results, ensemble_probs = run_predict(signal)

        # Return original image as base64 so frontend can display it exactly
        import base64
        img_b64 = base64.b64encode(contents).decode('utf-8')
        ext = (file.filename or 'img.jpg').rsplit('.', 1)[-1].lower()
        mime = 'image/png' if ext == 'png' else 'image/jpeg'

        return {
            'success': True,
            'signal': signal.tolist(),
            'predictions': results,
            'ensemble_probs': ensemble_probs,
            'source_image': f'data:{mime};base64,{img_b64}'
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/perturbation")
async def perturbation_map(payload: dict):
    """
    Perturbation Sensitivity Map.
    Slides a window across the signal, zeros it out, re-runs ensemble,
    and records the drop in confidence for the predicted class.
    Returns a 187-length sensitivity array (0-1 normalised).
    """
    try:
        values = np.array(payload['values'], dtype=float)
        pred_class = int(payload['pred_class'])          # class index to track
        window = int(payload.get('window', 10))          # mask window size

        if len(values) != 187:
            raise ValueError(f"Need 187 values, got {len(values)}")

        # Baseline confidence for pred_class
        base_results, base_probs = run_predict(values)
        base_conf = base_probs[pred_class]

        sensitivity = np.zeros(187)

        for start in range(0, 187, window):
            end = min(start + window, 187)
            masked = values.copy()
            masked[start:end] = 0.0
            _, masked_probs = run_predict(masked)
            drop = base_conf - masked_probs[pred_class]
            sensitivity[start:end] = max(drop, 0.0)

        # Normalise to 0-1
        s_max = sensitivity.max()
        if s_max > 0:
            sensitivity = sensitivity / s_max

        return {
            'success': True,
            'sensitivity': [round(float(v), 4) for v in sensitivity],
            'base_conf': round(float(base_conf), 4),
            'pred_class': pred_class,
            'window': window,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/clinical-info")
def clinical_info():
    return CLINICAL_INFO


if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

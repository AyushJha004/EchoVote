import sys, os
# Ensure UTF-8 output on Windows so emoji in print() don't crash
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import asyncio
import io
import os
import joblib
import json
import warnings
from starlette.concurrency import run_in_threadpool
warnings.filterwarnings('ignore')

app = FastAPI(title="ECG Classifier API")

# ── Auth router (SQLite user store) ──────────────────────────────────────────
from auth import router as auth_router
app.include_router(auth_router)

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

EXPECTED_MODELS = ['1D-CNN', 'BiLSTM', 'CNN-LSTM', 'Random Forest', 'XGBoost', 'KNN', 'SVM', 'Logistic Regression']

# Arrhythmia screening: flag when P(abnormal) = 1 - P(Normal) of the ensemble reaches this value.
# Chosen on MIT-BIH test beats (all 8 live models): ~96.7% sensitivity / ~95.6% specificity per beat.
ARRHYTHMIA_THRESHOLD = 0.4

models = {}
scaler = None
prediction_lock = asyncio.Lock()

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

    if len(models) < len(EXPECTED_MODELS):
        missing = [n for n in EXPECTED_MODELS if n not in models]
        print(f"⚠️  Models missing: {', '.join(missing)} — predictions are served only by the loaded models")

def compute_ensemble_probs(results):
    """Average per-class probabilities across all valid models."""
    valid = [r for r in results.values() if r.get('probs') and r['prediction'] != 'Error']
    if not valid:
        raise RuntimeError("No model produced a valid prediction")
    avg = np.mean([r['probs'] for r in valid], axis=0)
    return [round(float(p), 4) for p in avg]


def arrhythmia_assessment(ensemble_probs):
    """Binary arrhythmia screen derived from the ensemble: any non-Normal beat class counts."""
    p_abnormal = round(float(1.0 - ensemble_probs[0]), 4)
    return {
        'detected': p_abnormal >= ARRHYTHMIA_THRESHOLD,
        'p_abnormal': p_abnormal,
        'threshold': ARRHYTHMIA_THRESHOLD,
    }


def require_models():
    if not models:
        raise HTTPException(status_code=503, detail="Prediction models are not loaded. Check the backend logs.")


DL_MODELS = {'1D-CNN', 'BiLSTM', 'CNN-LSTM'}


def _run_predict(signal):
    global models, scaler

    signal = np.nan_to_num(signal.astype(float), nan=0.0)

    if scaler is not None:
        signal_scaled = scaler.transform(signal.reshape(1, -1))
    else:
        signal_scaled = signal.reshape(1, -1)

    # The DL models were trained on the scaler-normalised (z-score) beat, like the classical models.
    sig_dl = signal_scaled.reshape(1, 187, 1)

    results = {}
    for name, model in models.items():
        try:
            if name in DL_MODELS:
                probs = model.predict(sig_dl, verbose=0)[0]
                pred_class = int(np.argmax(probs))
                confidence = float(probs[pred_class])
            else:
                probs_all  = model.predict_proba(signal_scaled)[0]
                pred_class = (
                    int(np.argmax(probs_all))
                    if name == 'KNN'
                    else int(model.predict(signal_scaled)[0])
                )
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


def _run_predict_batch(signals):
    global models, scaler

    signals = np.nan_to_num(np.asarray(signals, dtype=float), nan=0.0)
    signal_scaled = (
        scaler.transform(signals)
        if scaler is not None
        else signals
    )
    signals_dl = np.asarray(signal_scaled).reshape(-1, 187, 1)
    results = [{} for _ in signals]

    for name, model in models.items():
        try:
            if name in DL_MODELS:
                probs_batch = model.predict(signals_dl, verbose=0)
                pred_classes = np.argmax(probs_batch, axis=1)
            else:
                probs_batch = model.predict_proba(signal_scaled)
                pred_classes = (
                    np.argmax(probs_batch, axis=1)
                    if name == 'KNN'
                    else model.predict(signal_scaled).astype(int)
                )

            for index, (pred_class, probs) in enumerate(zip(pred_classes, probs_batch)):
                pred_class = int(pred_class)
                confidence = float(probs[pred_class])
                results[index][name] = {
                    'prediction': LABEL_MAP[pred_class].strip(),
                    'confidence': round(confidence, 4),
                    'probs': [round(float(p), 4) for p in probs],
                    'class_idx': pred_class,
                    'type': 'DL' if name in DL_MODELS else 'ML'
                }
        except Exception as e:
            for result in results:
                result[name] = {
                    'prediction': 'Error',
                    'confidence': 0.0,
                    'probs': [0] * 5,
                    'error': str(e),
                    'type': 'DL' if name in DL_MODELS else 'ML'
                }

    return [(result, compute_ensemble_probs(result)) for result in results]


async def run_predict_batch(signals):
    async with prediction_lock:
        return await run_in_threadpool(_run_predict_batch, signals)


async def run_predict(signal):
    async with prediction_lock:
        return await run_in_threadpool(_run_predict, signal)


@app.on_event("startup")
def startup():
    load_models()


@app.get("/api/health")
async def health():
    return {
        'status': 'ok' if len(models) == len(EXPECTED_MODELS) else 'degraded',
        'live': len(models) > 0,
        'models_loaded': len(models),
        'models_expected': len(EXPECTED_MODELS),
        'model_names': list(models.keys()),
        'arrhythmia_threshold': ARRHYTHMIA_THRESHOLD,
    }


@app.post("/api/predict/csv")
async def predict_csv(file: UploadFile = File(...)):
    require_models()
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
        results, ensemble_probs = await run_predict(data)
        return {'success': True, 'signal': data.tolist(), 'predictions': results, 'ensemble_probs': ensemble_probs,
                'arrhythmia': arrhythmia_assessment(ensemble_probs)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/predict/manual")
async def predict_manual(payload: dict):
    require_models()
    try:
        values = np.array(payload['values'], dtype=float)
        if len(values) != 187:
            raise ValueError(f"Need 187 values, got {len(values)}")
        results, ensemble_probs = await run_predict(values)
        return {'success': True, 'signal': values.tolist(), 'predictions': results, 'ensemble_probs': ensemble_probs,
                'arrhythmia': arrhythmia_assessment(ensemble_probs)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



def _otsu(values):
    hist = np.bincount(values.astype(np.uint8).ravel(), minlength=256).astype(float)
    total = hist.sum()
    if total == 0:
        return 127
    omega = np.cumsum(hist) / total
    mu = np.cumsum(hist * np.arange(256)) / total
    denom = omega * (1 - omega)
    denom[denom == 0] = np.nan
    sigma = (mu[-1] * omega - mu) ** 2 / denom
    return int(np.nanargmax(sigma))


def _trace_mask(gray):
    """Pixels of the ECG trace: the darkest ink, not the lighter or coloured grid."""
    t1 = _otsu(gray)
    dark = gray < t1
    if dark.sum() < 50:
        return dark
    t2 = _otsu(gray[dark])
    hi = dark & (gray >= t2)
    lo = dark & (gray < t2)
    if lo.sum() > 50 and hi.sum() > 50 and gray[hi].mean() - gray[lo].mean() > 45:
        return lo
    return dark


def extract_trace(gray, max_w=2000, max_h=600):
    """Recover a 1-D ECG trace (peaks up, 0-1) from a photo or scan of a strip. Returns None on failure."""
    import cv2
    h, w = gray.shape
    g = gray[int(h * 0.04):int(h * 0.96), int(w * 0.01):int(w * 0.99)]
    h, w = g.shape
    scale = min(1.0, max_w / w, max_h / h)
    if scale < 1.0:
        g = cv2.resize(g, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(g, (3, 3), 0)
    mask = _trace_mask(g).astype(np.uint8)

    # remove long vertical rules (frames, major grid lines)
    hh, ww = mask.shape
    vert = cv2.morphologyEx(mask, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(25, int(hh * 0.8)))))
    mask = mask & (1 - cv2.dilate(vert, np.ones((1, 3), np.uint8)))

    # keep only components about as wide as the trace itself
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n_labels <= 1:
        return None
    widths = stats[1:, cv2.CC_STAT_WIDTH]
    keep = np.zeros_like(mask)
    for i in range(1, n_labels):
        if stats[i, cv2.CC_STAT_WIDTH] >= 0.25 * widths.max():
            keep[labels == i] = 1
    mask = keep

    cols = np.where(mask.any(axis=0))[0]
    if len(cols) < 0.3 * ww:
        return None
    x0, x1 = int(cols.min()), int(cols.max()) + 1
    mask = mask[:, x0:x1]
    hh, ww = mask.shape

    rows = np.arange(hh)
    raw = np.full(ww, np.nan)
    prev = None
    for x in range(ww):
        r = rows[mask[:, x] > 0]
        if len(r) == 0:
            continue
        lo_r, hi_r = r.min(), r.max()
        if prev is None or hi_r - lo_r <= 2:
            v = r.mean()
        else:
            # vertical stroke (QRS): take the tip farthest from where the trace just was
            v = lo_r if abs(lo_r - prev) >= abs(hi_r - prev) else hi_r
        raw[x] = v
        prev = v
    idx = np.arange(ww)
    ok = ~np.isnan(raw)
    raw = np.interp(idx, idx[ok], raw[ok])
    padded = np.pad(raw, 1, mode='edge')
    raw = np.convolve(padded, np.ones(3) / 3, mode='valid')
    sig = raw.max() - raw
    base = np.percentile(sig, 20)
    return np.clip((sig - base) / (sig.max() - base + 1e-8), 0.0, 1.0)


# Typical non-padded beat length in the MIT-BIH training format (median over the test set).
BEAT_LEN_MEDIAN = 106


def segment_beats(trace):
    """Cut an extracted ECG trace into single beats in the MIT-BIH layout.

    The dataset's beats run from one R peak to the next, are min-max scaled to 0-1 and
    zero-padded to 187 samples. Returns (beats, peaks); beats is empty when fewer than
    two R peaks can be found (the caller then falls back to treating the image as one beat).
    """
    from scipy.signal import find_peaks

    n = len(trace)
    peaks, _ = find_peaks(trace, height=0.4, prominence=0.3, distance=max(5, n // 80))
    if len(peaks) < 2:
        return [], list(peaks)

    rr = np.diff(peaks)
    med = float(np.median(rr))
    beats = []
    for i in range(len(peaks) - 1):
        if not (0.45 * med <= rr[i] <= 1.8 * med):
            continue
        seg = trace[peaks[i]:peaks[i + 1]]
        length = int(min(187, max(30, round(BEAT_LEN_MEDIAN * rr[i] / med))))
        seg = np.interp(np.linspace(0, len(seg) - 1, length), np.arange(len(seg)), seg)
        span = seg.max() - seg.min()
        if span < 1e-6:
            continue
        seg = (seg - seg.min()) / span
        beats.append(np.pad(seg, (0, 187 - length)))
    return beats, [int(x) for x in peaks]


def summarise_beats(beat_results):
    """Aggregate per-beat ensemble outputs into one strip-level screen."""
    p_abn = [1.0 - ens[0] for _, ens in beat_results]
    flagged = [pa >= ARRHYTHMIA_THRESHOLD for pa in p_abn]
    total = len(beat_results)
    n_flagged = int(sum(flagged))
    # A fifth of the beats flagged, or any single strongly abnormal beat (e.g. an isolated PVC).
    detected = n_flagged >= max(1, int(np.ceil(0.2 * total))) or any(pa >= 0.7 for pa in p_abn)
    if detected:
        rep = int(np.argmax(p_abn))
    else:
        rep = int(np.argsort(p_abn)[len(p_abn) // 2])
    return rep, p_abn, flagged, detected


@app.post("/api/predict/image")
async def predict_image(file: UploadFile = File(...)):
    require_models()
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

        # ── 2. Recover the trace (handles coloured / dark grids, frames, spikes) ──
        trace = extract_trace(img)
        if trace is None or float(trace.max() - trace.min()) < 0.2:
            raise ValueError("Could not detect an ECG waveform in this image. Please upload a clear photo of an ECG strip with a visible trace.")
        work_w = len(trace)

        # ── 12. Split into single beats (R peak to R peak) and analyse each ──
        beats, peaks = segment_beats(trace)
        if beats:
            beat_results = await run_predict_batch(beats)
            rep, p_abn, flagged, detected = summarise_beats(beat_results)
            _rr = np.diff(peaks)
            rr_cv_for_flag = len(_rr) >= 4 and float(np.std(_rr) / np.mean(_rr)) > 0.15
            results, ensemble_probs = beat_results[rep]
            signal = beats[rep]
            arrhythmia = {
                'detected': detected,
                'p_abnormal': round(float(p_abn[rep]), 4),
                'threshold': ARRHYTHMIA_THRESHOLD,
                'beats_total': len(beats),
                'beats_flagged': int(sum(flagged)),
                'irregular_rhythm': bool(rr_cv_for_flag),
            }
            beat_info = [
                {'index': i, 'p_abnormal': round(float(pa), 4), 'flagged': bool(fl),
                 'class_idx': int(np.argmax(beat_results[i][1]))}
                for i, (pa, fl) in enumerate(zip(p_abn, flagged))
            ]
            rr_px = np.diff(peaks)
            rr_cv = float(np.std(rr_px) / np.mean(rr_px)) if len(rr_px) >= 4 else None
            segmentation = {
                'rhythm': {
                    'rr_cv': None if rr_cv is None else round(rr_cv, 3),
                    'irregular': bool(rr_cv is not None and rr_cv > 0.15),
                },
                'beats': beat_info,
                'representative': rep,
                'trace': [round(float(v), 4) for v in trace[::max(1, len(trace) // 800)]],
                'peaks': [int(x // max(1, len(trace) // 800)) for x in peaks],
            }
        else:
            # Could not find individual beats: treat the whole image as one beat (previous behaviour).
            signal = np.interp(np.linspace(0, work_w - 1, 187), np.arange(work_w), trace)
            results, ensemble_probs = await run_predict(signal)
            arrhythmia = arrhythmia_assessment(ensemble_probs)
            arrhythmia.update({'beats_total': 1, 'beats_flagged': int(arrhythmia['detected'])})
            segmentation = None

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
            'arrhythmia': arrhythmia,
            'segmentation': segmentation,
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
    require_models()
    try:
        values = np.array(payload['values'], dtype=float)
        pred_class = int(payload['pred_class'])          # class index to track
        window = int(payload.get('window', 10))          # mask window size

        if len(values) != 187:
            raise ValueError(f"Need 187 values, got {len(values)}")

        async with prediction_lock:
            return await run_in_threadpool(compute_perturbation, values, pred_class, window)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def compute_perturbation(values, pred_class, window):
    signals = [values]
    windows = []
    for start in range(0, 187, window):
        end = min(start + window, 187)
        masked = values.copy()
        masked[start:end] = 0.0
        signals.append(masked)
        windows.append((start, end))

    predictions = _run_predict_batch(signals)
    _, base_probs = predictions[0]
    base_conf = base_probs[pred_class]
    sensitivity = np.zeros(187)

    for (start, end), (_, masked_probs) in zip(windows, predictions[1:]):
        drop = base_conf - masked_probs[pred_class]
        sensitivity[start:end] = max(drop, 0.0)

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


@app.get("/api/clinical-info")
def clinical_info():
    return CLINICAL_INFO


if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

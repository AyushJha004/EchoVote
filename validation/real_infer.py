"""Stage 2: build beats from the recovered traces (current app method and an oracle-scale variant),
build digital reference beats from the raw signal, and run the 8-model ensemble on all of them."""
import sys, pickle
import numpy as np
from scipy.signal import find_peaks
sys.path.insert(0, "/app")
import main

items = pickle.load(open("/out/real_items.pkl", "rb"))
main.load_models()
assert len(main.models) == 8, list(main.models)

def norm_pad(seg, length):
    seg = np.interp(np.linspace(0, len(seg) - 1, length), np.arange(len(seg)), seg)
    span = seg.max() - seg.min()
    if span < 1e-6:
        return None
    return np.pad((seg - seg.min()) / span, (0, 187 - length))

def peaks_of(tr):
    n = len(tr)
    p, _ = find_peaks(tr, height=0.3, prominence=0.3, distance=max(5, n // 40))
    if len(p) >= 3:
        ref = np.median(np.sort(tr[p])[len(p) // 2:])
        p = p[tr[p] >= 0.6 * ref]
    return p

def segment(tr, mode):
    n = len(tr); p = peaks_of(tr)
    beats, starts = [], []
    if len(p) < 2:
        return beats, starts, p
    rr = np.diff(p); med = float(np.median(rr))
    for i in range(len(p) - 1):
        if not (0.45 * med <= rr[i] <= 1.8 * med):
            continue
        seg = tr[p[i]:p[i + 1]]
        if mode == "current":
            length = int(min(187, max(30, round(main.BEAT_LEN_MEDIAN * rr[i] / med))))
        else:  # oracle: the true time scale is known (10 s across the trace), dataset is 125 Hz
            length = int(min(187, max(30, round(rr[i] / (n / 10.0) * 125))))
        b = norm_pad(seg, length)
        if b is not None:
            beats.append(b); starts.append(i)
    return beats, starts, p

def digital(item):
    sig, t = item["signal"], item["t"]
    idx = np.round(t * 360).astype(int)
    out, which = [], []
    for k in range(len(idx) - 1):
        seg = sig[idx[k]:idx[k + 1]]
        length = int(min(187, max(30, round(len(seg) / 360 * 125))))
        if len(seg) < 4:
            continue
        b = norm_pad(seg, length)
        if b is not None:
            out.append(b); which.append(k)
    return out, which

def ens_batch(beats):
    if not beats:
        return np.zeros((0, 5))
    out = []
    for i in range(0, len(beats), 256):
        out += [e for _, e in main._run_predict_batch(np.array(beats[i:i + 256]))]
    return np.array(out)

res = []
for n, it in enumerate(items):
    r = dict(rec=it["rec"], start=it["start"], variant=it["variant"], t=it["t"], cls=it["cls"], rot=it["rot"],
             L=len(it["trace"]))
    p = peaks_of(it["trace"]); r["peaks"] = p
    for mode in ("current", "oracle"):
        beats, starts, _ = segment(it["trace"], mode)
        r[mode] = dict(starts=starts, ens=ens_batch(beats))
    res.append(r)
    if n % 40 == 0:
        print("done", n, "of", len(items), flush=True)
pickle.dump(res, open("/out/real_results.pkl", "wb"))
print("saved")

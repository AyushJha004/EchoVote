import pickle, sys, itertools
import numpy as np
from scipy.signal import find_peaks

items = pickle.load(open("real_items.pkl", "rb"))
recs = sorted({i["rec"] for i in items})
dev = set(recs[0::2])
TOL = 0.08

def detect(tr, h=0.4, prom=0.3, dist_div=80, amp_ratio=0.0, rr_ratio=0.0):
    n = len(tr)
    p, props = find_peaks(tr, height=h, prominence=prom, distance=max(5, n // dist_div))
    if len(p) >= 3 and amp_ratio > 0:
        ref = np.median(np.sort(tr[p])[len(p) // 2:])          # typical R height (upper half)
        p = p[tr[p] >= amp_ratio * ref]
    if len(p) >= 4 and rr_ratio > 0:
        # second pass: enforce a refractory period relative to the typical interval
        rr = np.diff(p); med = np.median(rr)
        p2, _ = find_peaks(tr, height=h, prominence=prom, distance=max(5, int(rr_ratio * med)))
        if amp_ratio > 0 and len(p2) >= 3:
            ref = np.median(np.sort(tr[p2])[len(p2) // 2:]); p2 = p2[tr[p2] >= amp_ratio * ref]
        p = p2
    return p

def evaluate(rows, **kw):
    tp = fn = fp = 0
    for it in rows:
        tr = it["trace"]; L = len(tr)
        pk = detect(tr, **kw)
        tpx = it["t"] / 10.0 * L
        tol = TOL / 10.0 * L
        hit = set()
        for p in pk:
            j = int(np.argmin(np.abs(tpx - p)))
            if abs(tpx[j] - p) <= tol: hit.add(j)
            elif 0.3 < p / L * 10 < 9.7: fp += 1
        inner = [j for j in range(len(tpx)) if 0.3 <= it["t"][j] <= 9.7]
        tp += sum(j in hit for j in inner); fn += sum(j not in hit for j in inner)
    r = tp / max(tp + fn, 1); p = tp / max(tp + fp, 1)
    return r, p, 2 * r * p / max(r + p, 1e-9)

dev_rows = [i for i in items if i["rec"] in dev and i["variant"] in ("clean", "noisy_jpeg")]
test_rows = [i for i in items if i["rec"] not in dev and i["variant"] in ("clean", "noisy_jpeg")]
grid = []
for h, prom, dd, ar, rr in itertools.product((0.3, 0.4), (0.2, 0.3, 0.4), (80, 40), (0.0, 0.4, 0.5, 0.6), (0.0, 0.5, 0.65)):
    grid.append(dict(h=h, prom=prom, dist_div=dd, amp_ratio=ar, rr_ratio=rr))
scored = sorted(((evaluate(dev_rows, **g), g) for g in grid), key=lambda x: -x[0][2])
base = dict(h=0.4, prom=0.3, dist_div=80, amp_ratio=0.0, rr_ratio=0.0)
print("CURRENT  dev R/P/F1", [f"{100*x:.1f}" for x in evaluate(dev_rows, **base)], " test", [f"{100*x:.1f}" for x in evaluate(test_rows, **base)])
for (s, g) in scored[:6]:
    print("dev", [f"{100*x:.1f}" for x in s], g, " -> test", [f"{100*x:.1f}" for x in evaluate(test_rows, **g)])

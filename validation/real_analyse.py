import pickle, sys, itertools
import numpy as np

res = pickle.load(open(sys.argv[1] if len(sys.argv) > 1 else "real_results.pkl", "rb"))
recs = sorted({r["rec"] for r in res})
dev_recs = set(recs[0::2]); test_recs = set(recs[1::2])
TOL_S = 0.08

def split(r): return "dev" if r["rec"] in dev_recs else "test"

def match_truth(r, pk, L):
    """index of nearest annotated beat for each peak (or -1)"""
    tp = r["t"] / 10.0 * L
    out = []
    for p in pk:
        j = int(np.argmin(np.abs(tp - p)))
        out.append(j if abs(tp[j] - p) <= TOL_S / 10.0 * L else -1)
    return out

def strip_truth_abn(r):
    return bool(np.any(r["cls"][:-1] != 0))

def summarise(p_abn, th=0.4, frac=0.2, override=0.7):
    if len(p_abn) == 0: return None
    fl = np.array(p_abn) >= th
    det = fl.sum() >= max(1, int(np.ceil(frac * len(p_abn))))
    if override is not None and np.any(np.array(p_abn) >= override): det = True
    return bool(det)

def pct(x): return "n/a" if x != x else f"{100*x:5.1f}%"

def peak_stats(rows):
    tp = fn = fp = 0
    for r in rows:
        pk = r["peaks"]; L = r["L"]; m = match_truth(r, pk, L)
        hit = set(j for j in m if j >= 0)
        edge = (r["t"] < 0.3) | (r["t"] > 9.7)
        inner = [j for j in range(len(r["t"])) if not edge[j]]
        tp += sum(j in hit for j in inner); fn += sum(j not in hit for j in inner)
        fp += sum(1 for j, p in zip(m, pk) if j < 0 and 0.3 < p / L * 10 < 9.7)
    return tp / max(tp + fn, 1), tp / max(tp + fp, 1)

def beat_rows(rows, mode):
    """(true_class, ens) for every segmented beat that lines up with an annotation"""
    out = []
    for r in rows:
        if mode == "digital":
            d = r.get("digital");
            if d is None: continue
            for w, e in zip(d["which"], d["ens"]):
                out.append((int(r["cls"][w]), e))
            continue
        pk = r["peaks"]; m = match_truth(r, pk, r["L"])
        for s, e in zip(r[mode]["starts"], r[mode]["ens"]):
            if m[s] >= 0 and m[s] < len(r["cls"]) - 1:
                out.append((int(r["cls"][m[s]]), e))
    return out

def beat_stats(br, th=0.4):
    if not br: return None
    y = np.array([b[0] for b in br]); E = np.array([b[1] for b in br])
    acc = float((E.argmax(1) == y).mean())
    abn = y != 0; fl = (1 - E[:, 0]) >= th
    sens = float(fl[abn].mean()) if abn.any() else float("nan")
    spec = float((~fl[~abn]).mean()) if (~abn).any() else float("nan")
    return len(y), acc, sens, spec, int(abn.sum())

def strip_stats(rows, mode, **kw):
    tp = fn = fp = tn = 0; skipped = 0
    for r in rows:
        if mode == "digital":
            d = r.get("digital")
            if d is None: continue
            p_abn = [1 - e[0] for e in d["ens"]]
        else:
            p_abn = [1 - e[0] for e in r[mode]["ens"]]
        det = summarise(p_abn, **kw)
        if det is None: skipped += 1; continue
        t = strip_truth_abn(r)
        if t and det: tp += 1
        elif t: fn += 1
        elif det: fp += 1
        else: tn += 1
    return tp, fn, fp, tn, skipped

def report(title, rows_of):
    print(f"\n===== {title} =====")
    for name in ("dev", "test"):
        rows = rows_of(name)
        print(f"[{name}] strips={len(rows)}  truth-abnormal={sum(strip_truth_abn(r) for r in rows)}")

variants = ("clean", "noisy_jpeg", "blue_rot")
for part in ("dev", "test"):
    print(f"\n######## {part.upper()} records ({len(dev_recs if part=='dev' else test_recs)}) ########")
    for v in variants:
        rows = [r for r in res if split(r) == part and r["variant"] == v]
        rec, prec = peak_stats(rows)
        print(f"\n-- {v}: {len(rows)} strips | R-peak recall {pct(rec)} precision {pct(prec)}")
        for mode in ("current", "oracle"):
            b = beat_stats(beat_rows(rows, mode))
            tp, fn, fp, tn, sk = strip_stats(rows, mode)
            print(f"   {mode:8s} beats={b[0]:5d} 5-class acc {pct(b[1])} | beat screen sens {pct(b[2])} spec {pct(b[3])}"
                  f" | STRIP screen sens {pct(tp/max(tp+fn,1))} spec {pct(tn/max(tn+fp,1))} (tp{tp} fn{fn} fp{fp} tn{tn}, no-beats {sk})")
    rows = [r for r in res if split(r) == part and r["variant"] == "clean"]
    if any("digital" in r for r in rows):
        b = beat_stats(beat_rows(rows, "digital"))
        tp, fn, fp, tn, sk = strip_stats(rows, "digital")
        print(f"-- DIGITAL reference: beats={b[0]} acc {pct(b[1])} | beat sens {pct(b[2])} spec {pct(b[3])} | "
              f"STRIP sens {pct(tp/max(tp+fn,1))} spec {pct(tn/max(tn+fp,1))}")

# ---- rule tuning on DEV, confirm on TEST (photo path, all variants pooled) ----
print("\n\n######## strip rule search (mode=current) ########")
grid = list(itertools.product((0.4, 0.5, 0.6), (0.2, 0.3, 0.4, 0.5), (None, 0.7, 0.8, 0.9)))
def score(rows, mode, th, fr, ov):
    tp, fn, fp, tn, _ = strip_stats(rows, mode, th=th, frac=fr, override=ov)
    sens, spec = tp / max(tp + fn, 1), tn / max(tn + fp, 1)
    return sens, spec, (sens + spec) / 2
for mode in ("current", "oracle"):
    dev_rows = [r for r in res if split(r) == "dev"]; test_rows = [r for r in res if split(r) == "test"]
    ranked = sorted(grid, key=lambda g: -score(dev_rows, mode, *g)[2])[:5]
    base = (0.4, 0.2, 0.7)
    print(f"\nmode={mode}: current rule {base}: dev bal-acc {pct(score(dev_rows, mode, *base)[2])}, "
          f"test sens/spec/bal {[pct(x) for x in score(test_rows, mode, *base)]}")
    for g in ranked:
        print(f"   th={g[0]} frac={g[1]} override={g[2]}: dev {[pct(x) for x in score(dev_rows, mode, *g)]} | "
              f"TEST {[pct(x) for x in score(test_rows, mode, *g)]}")

import sys, json, time
import numpy as np
sys.path.insert(0, "/app")
import main

CAP = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
df = np.loadtxt("/data/mitbih_test.csv", delimiter=",", dtype=np.float32)
X, y = df[:, :187], df[:, 187].astype(int)
rng = np.random.default_rng(0)
idx = np.concatenate([
    rng.permutation(np.where(y == c)[0])[:CAP] for c in range(5)
])
X, y = X[idx], y[idx]
print("samples", len(y), "per class", np.bincount(y), flush=True)

main.load_models()
names = list(main.models.keys())
probs = {n: [] for n in names}
ens = []
t0 = time.time()
for i in range(0, len(X), 250):
    out = main._run_predict_batch(X[i:i + 250])
    for res, e in out:
        ens.append(e)
        for n in names:
            probs[n].append(res[n]["probs"])
    print("done", i + 250, round(time.time() - t0), "s", flush=True)

ens = np.array(ens)
probs = {n: np.array(v) for n, v in probs.items()}
probs["ENSEMBLE"] = ens
TH = main.ARRHYTHMIA_THRESHOLD
abn = y != 0
report = {}
for n, p in probs.items():
    pred = p.argmax(1)
    cm = np.zeros((5, 5), int)
    for a, b in zip(y, pred):
        cm[a, b] += 1
    recall = [cm[c, c] / max(cm[c].sum(), 1) for c in range(5)]
    prec = [cm[c, c] / max(cm[:, c].sum(), 1) for c in range(5)]
    f1 = [2 * r * q / (r + q) if r + q else 0 for r, q in zip(recall, prec)]
    flag = (1 - p[:, 0]) >= TH
    flag50 = (1 - p[:, 0]) >= 0.5
    report[n] = {
        "acc_balanced_sample": float((pred == y).mean()),
        "macro_recall": float(np.mean(recall)),
        "macro_f1": float(np.mean(f1)),
        "per_class_recall": [round(float(r), 3) for r in recall],
        "confusion": cm.tolist(),
        "screen_sens@0.4": float(flag[abn].mean()),
        "screen_spec@0.4": float((~flag[~abn]).mean()),
        "screen_sens@0.5": float(flag50[abn].mean()),
        "screen_spec@0.5": float((~flag50[~abn]).mean()),
        "argmax_abn_sens": float((pred[abn] != 0).mean()),
        "argmax_abn_spec": float((pred[~abn] == 0).mean()),
    }
# threshold sweep on ensemble
sweep = {}
for th in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]:
    f = (1 - ens[:, 0]) >= th
    sweep[th] = [round(float(f[abn].mean()), 3), round(float((~f[~abn]).mean()), 3)]
report["_threshold_sweep_sens_spec"] = sweep
json.dump(report, open("/out/model_validation.json", "w"), indent=1)
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "confusion"} for k, v in report.items() if not k.startswith("_")}, indent=1))
print("sweep", sweep)

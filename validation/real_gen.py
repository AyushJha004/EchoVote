"""Stage 1: cut real, annotated MIT-BIH strips, render them as ECG images at standard paper scale
(25 mm/s, 10 mm/mV), degrade them, and recover the trace with the app's own photo code."""
import sys, os, pickle
import numpy as np, cv2, wfdb
sys.path.insert(0, "/app")
import main

RAW, OUT = "/raw", "/out"
STRIPS_PER_REC = int(sys.argv[1]) if len(sys.argv) > 1 else 6
SKIP = {"102", "104", "107", "217"}                    # paced records
AAMI = {**{s: 0 for s in "NLRej"}, **{s: 1 for s in "AaJS"},
        **{s: 2 for s in "VE"}, "F": 3, **{s: 4 for s in "/fQ"}}
FS, SEC = 360, 10
PX_PER_MM, PX_PER_S, PX_PER_MV = 4, 100, 40            # 25 mm/s * 4 px/mm ; 10 mm/mV * 4 px/mm
W_SIG, MARGIN, H = SEC * PX_PER_S, 40, 300
rng = np.random.default_rng(11)

def render(sig, variant):
    W = W_SIG + 2 * MARGIN
    if variant == "blue_rot":
        paper, minor, major, ink = (250, 245, 235), (235, 215, 185), (200, 160, 100), (30, 30, 30)
    else:
        paper, minor, major, ink = (235, 240, 255), (200, 200, 245), (140, 140, 230), (20, 20, 20)
    img = np.full((H, W, 3), paper, np.uint8)
    for x in range(0, W, PX_PER_MM): cv2.line(img, (x, 0), (x, H), minor, 1)
    for y in range(0, H, PX_PER_MM): cv2.line(img, (0, y), (W, y), minor, 1)
    for x in range(0, W, 5 * PX_PER_MM): cv2.line(img, (x, 0), (x, H), major, 1)
    for y in range(0, H, 5 * PX_PER_MM): cv2.line(img, (0, y), (W, y), major, 1)
    xs = MARGIN + np.arange(len(sig)) * (W_SIG / len(sig))
    ys = np.clip(H / 2 - (sig - np.median(sig)) * PX_PER_MV, 4, H - 4)
    cv2.polylines(img, [np.stack([xs, ys], 1).astype(np.int32)], False, ink, 2, cv2.LINE_AA)
    q = 90
    if variant == "noisy_jpeg":
        img = cv2.GaussianBlur(img, (3, 3), 0)
        img = np.clip(img.astype(np.float32) + rng.normal(0, 9, img.shape), 0, 255).astype(np.uint8)
        q = 35
    if variant == "blue_rot":
        m = cv2.getRotationMatrix2D((W / 2, H / 2), 2.5, 1.0)
        img = cv2.warpAffine(img, m, (W, H), borderValue=paper)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
    return cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)

recs = sorted({f[:-4] for f in os.listdir(RAW) if f.endswith(".hea")} - SKIP)
items = []
for rec in recs:
    r = wfdb.rdrecord(f"{RAW}/{rec}", channels=[0])
    sig = r.p_signal[:, 0].astype(np.float32)
    ann = wfdb.rdann(f"{RAW}/{rec}", "atr")
    keep = [(s, AAMI[c]) for s, c in zip(ann.sample, ann.symbol) if c in AAMI]
    bs = np.array([k[0] for k in keep]); bc = np.array([k[1] for k in keep])
    starts = rng.integers(0, len(sig) - SEC * FS, STRIPS_PER_REC * 3)
    made = 0
    for st in starts:
        if made >= STRIPS_PER_REC: break
        m = (bs >= st) & (bs < st + SEC * FS)
        if m.sum() < 4: continue
        seg = sig[st:st + SEC * FS]
        t_true = (bs[m] - st) / FS
        for variant in ("clean", "noisy_jpeg", "blue_rot"):
            img = render(seg, variant)
            img2, rot = main.deskew(img)
            tr = main.extract_trace(img2)
            items.append(dict(rec=rec, start=int(st), variant=variant, t=t_true, cls=bc[m],
                              trace=None if tr is None else tr.astype(np.float32), rot=rot,
                              signal=seg))
        made += 1
    print(rec, "strips", made, flush=True)
pickle.dump(items, open(f"{OUT}/real_items.pkl", "wb"))
print("images", len(items), "failed extraction", sum(i["trace"] is None for i in items))

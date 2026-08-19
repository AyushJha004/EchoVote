import warnings; warnings.filterwarnings('ignore')
import joblib, numpy as np

scaler = joblib.load('/app/models/ecg_scaler.pkl')
rf     = joblib.load('/app/models/ecg_rf.pkl')
xgb    = joblib.load('/app/models/ecg_xgb.pkl')
lr     = joblib.load('/app/models/ecg_lr.pkl')

print("=== Scaler stats ===")
print("mean  range:", round(float(scaler.mean_.min()),4), "to", round(float(scaler.mean_.max()),4))
print("scale range:", round(float(scaler.scale_.min()),4), "to", round(float(scaler.scale_.max()),4))

# MIT-BIH signals are 0-1 normalised, 187 samples = one heartbeat
# Class distribution in MIT-BIH: N=82%, S=3%, V=6%, F=0.7%, Q=8%
# The models are heavily biased toward Normal due to class imbalance

# Test 1: flat zero signal
s0 = np.zeros(187)
s0_sc = scaler.transform(s0.reshape(1,-1))
print("\n=== Zero signal ===")
print("RF:", rf.predict(s0_sc)[0], [round(p,3) for p in rf.predict_proba(s0_sc)[0]])
print("XGB:", xgb.predict(s0_sc)[0], [round(p,3) for p in xgb.predict_proba(s0_sc)[0]])

# Test 2: typical Normal beat (smooth QRS around sample 60)
s_n = np.zeros(187)
for i,v in enumerate([0,0.05,0.1,0.3,0.8,1.5,2.0,1.5,0.8,0.3,0.1,0.05,0,0,0,0]):
    if 55+i < 187: s_n[55+i] = v
s_n_sc = scaler.transform(s_n.reshape(1,-1))
print("\n=== Normal-like QRS ===")
print("RF:", rf.predict(s_n_sc)[0], [round(p,3) for p in rf.predict_proba(s_n_sc)[0]])

# Test 3: wide QRS (ventricular-like)
s_v = np.zeros(187)
for i,v in enumerate([0,0.1,0.3,0.6,1.0,1.4,1.8,2.0,1.8,1.4,1.0,0.6,0.3,0.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]):
    if 50+i < 187: s_v[50+i] = v
s_v_sc = scaler.transform(s_v.reshape(1,-1))
print("\n=== Wide QRS (ventricular-like) ===")
print("RF:", rf.predict(s_v_sc)[0], [round(p,3) for p in rf.predict_proba(s_v_sc)[0]])
print("XGB:", xgb.predict(s_v_sc)[0], [round(p,3) for p in xgb.predict_proba(s_v_sc)[0]])
print("LR:", lr.predict(s_v_sc)[0], [round(p,3) for p in lr.predict_proba(s_v_sc)[0]])

# Test 4: check what the training mean looks like
print("\n=== Training mean signal (first 10 features) ===")
print([round(float(v),4) for v in scaler.mean_[:10]])
print("Max mean value:", round(float(scaler.mean_.max()),4))

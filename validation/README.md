# Validation scripts

Scripts used for the validation in `HOW_IT_WORKS.md` (section 9). They are run inside a container built from the
backend image so they use the app's own code (`main.py`).

* `validate_models.py` - 8-model ensemble on a stratified sample of `mitbih_test.csv` (Kaggle ECG Heartbeat dataset).
* `real_gen.py`, `real_infer.py`, `real_analyse.py` - photo path on real annotated MIT-BIH strips (needs the raw
  records from PhysioNet `mitdb`, `pip install wfdb`): render strips as images, run the app's deskew / trace
  extraction / segmentation / ensemble, compare with the annotations.
* `peak_search.py` - grid search for the R-peak detector parameters (dev records, confirmed on held-out records).

Example (PowerShell, from the repo root; `D:\mitdb` holds the downloaded records, `D:\out` receives results):

```powershell
docker run --rm -v ${PWD}\backend\main.py:/app/main.py -v D:\mitdb:/raw:ro -v ${PWD}\validation:/scr -v D:\out:/out -w /app ecg-app-backend:latest sh -c "pip install wfdb && python /scr/real_gen.py 6"
```

`real_infer.py` also needs `-v ${PWD}\models:/app/models` and takes a while (about 20 minutes with KNN); stop the
running backend first so there is enough memory. Then run `python real_analyse.py real_results.pkl` locally.

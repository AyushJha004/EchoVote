FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --timeout=300 \
    tensorflow-cpu==2.16.2 \
    pandas \
    scikit-learn==1.6.1 \
    xgboost \
    joblib \
    opencv-python-headless \
    imbalanced-learn \
    fastapi \
    uvicorn \
    python-multipart

COPY backend/main.py .
COPY models/ /app/models/

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

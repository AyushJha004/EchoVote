#!/bin/bash
set -e

echo ""
echo "🫀  CardioAI — ECG Arrhythmia Classifier"
echo "=========================================="
echo ""

# ── Backend setup ──
echo "📦 Setting up Python backend..."
cd backend

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip -q
pip install -r requirements.txt -q

echo "✅ Backend dependencies installed"
cd ..

# ── Frontend setup ──
echo ""
echo "⚛️  Setting up React frontend..."
cd frontend
npm install --silent
echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "=========================================="
echo "✅  Setup complete!"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Copy your Colab model files to ./models/"
echo "   ecg_1d_cnn.h5, ecg_rf.pkl, ecg_xgb.pkl"
echo "   ecg_knn.pkl, ecg_svm.pkl, ecg_lr.pkl, ecg_scaler.pkl"
echo ""
echo "2. Start backend (Terminal 1):"
echo "   cd backend && source venv/bin/activate && python main.py"
echo ""
echo "3. Start frontend (Terminal 2):"
echo "   cd frontend && npm start"
echo ""
echo "4. Open: http://localhost:3000"
echo ""
echo "Note: App runs in DEMO MODE if no models found."
echo "=========================================="

#!/bin/bash
echo "🫀 Starting CardioAI Backend..."
cd "$(dirname "$0")/backend"
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
echo "Installing dependencies..."
pip install -q -r requirements.txt
echo "✅ Backend starting on http://localhost:8000"
python main.py

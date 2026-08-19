@echo off
echo Starting CardioAI Backend...
cd /d "%~dp0backend"
if not exist venv (
  echo Creating virtual environment...
  python -m venv venv
)
call venv\Scripts\activate
pip install -q -r requirements.txt
echo Backend starting on http://localhost:8000
python main.py

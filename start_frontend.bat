@echo off
echo Starting CardioAI Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing npm packages...
  npm install
)
set REACT_APP_API_BASE=http://localhost:8000
npm start

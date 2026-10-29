#!/bin/bash
echo "🌐 Starting EchoVote Frontend..."
cd "$(dirname "$0")/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing npm packages..."
  npm install
fi
echo "✅ Frontend starting on http://localhost:3000"
REACT_APP_API_BASE=http://localhost:8000 npm start

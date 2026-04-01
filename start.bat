@echo off
echo Starting Rekordbox Bounce...

:: Start backend in a new window
start "Rekordbox Bounce - Backend" cmd /k "cd /d "%~dp0" && .venv\Scripts\activate && uvicorn backend.main:app --reload --port 8000"

:: Give backend a moment to start
timeout /t 2 /nobreak >nul

:: Start frontend
cd /d "%~dp0frontend"
npm run dev

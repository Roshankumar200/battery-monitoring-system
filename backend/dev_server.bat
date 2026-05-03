@echo off
setlocal enableextensions

REM This script runs from the backend directory.
cd /d "%~dp0"

echo === Backend: preparing virtual environment ===
IF NOT EXIST .venv (
  echo Creating venv...
  py -m venv .venv 2>nul || python -m venv .venv
)

IF EXIST .venv\Scripts\python.exe (
  set "PY=.venv\Scripts\python.exe"
  set "PIP=.venv\Scripts\pip.exe"
) ELSE (
  set "PY=python"
  set "PIP=pip"
)

echo Upgrading pip and installing requirements...
"%PY%" -m pip install --upgrade pip
"%PIP%" install -r requirements.txt

echo Running migrations...
"%PY%" manage.py migrate

echo Starting Django on http://localhost:8000
"%PY%" manage.py runserver 0.0.0.0:8000

endlocal

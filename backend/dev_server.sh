#!/usr/bin/env bash
set -e

# Run from the backend directory
cd "$(dirname "$0")"

echo "=== Backend: preparing virtual environment ==="

if [ ! -d ".venv" ]; then
  echo "Creating venv..."
  python3 -m venv .venv 2>/dev/null || python -m venv .venv
fi

if [ -f ".venv/bin/python" ]; then
  PY=".venv/bin/python"
  PIP=".venv/bin/pip"
else
  PY="python3"
  PIP="pip3"
fi

echo "Upgrading pip and installing requirements..."
"$PY" -m pip install --upgrade pip
"$PIP" install -r requirements.txt

echo "Running migrations..."
"$PY" manage.py migrate

echo "Starting Django on http://localhost:8000"
"$PY" manage.py runserver 0.0.0.0:8000

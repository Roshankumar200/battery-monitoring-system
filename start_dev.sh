#!/usr/bin/env bash
set -e

# Repo root (folder of this script)
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=============================================="
echo " BMS Dev Launcher"
echo " - Backend: http://localhost:8000 (includes MQTT consumer)"
echo " - Frontend: http://localhost:3000 (auto-switches if busy)"
echo "=============================================="

# Start Django backend in the background
bash "$ROOT/backend/dev_server.sh" &
BACKEND_PID=$!

# Start Next.js frontend in the background
bash "$ROOT/frontend_dev.sh" &
FRONTEND_PID=$!

echo "Launched backend (PID $BACKEND_PID) and frontend (PID $FRONTEND_PID)."
echo "Press Ctrl+C to stop both."

# Trap Ctrl+C to kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

wait

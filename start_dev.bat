@echo off
setlocal enableextensions

REM Repo root (folder of this script)
set "ROOT=%~dp0"
pushd "%ROOT%"

echo ==============================================
echo  BMS Dev Launcher
echo  - Backend: http://localhost:8000 (includes MQTT consumer)
echo  - Frontend: http://localhost:3000 (auto-switches if busy)
echo ==============================================

REM Start Django backend in a new terminal window (delegated to a helper script to avoid quoting issues)
start "Django Backend" cmd /k "%ROOT%backend\dev_server.bat"

REM Start Next.js frontend in a new terminal window (delegated helper script)
start "Next.js Frontend" cmd /k "%ROOT%frontend_dev.bat"

echo Launched backend (with MQTT) and frontend in separate windows.
echo You can close this window.

endlocal

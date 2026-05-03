@echo off
setlocal enableextensions

REM This script runs from the repo root.
cd /d "%~dp0"

echo === Frontend: installing deps (if needed) ===
npm run dev
endlocal

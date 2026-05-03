#!/usr/bin/env bash
set -e

# Run from the repo root
cd "$(dirname "$0")"

echo "=== Frontend: installing deps (if needed) ==="

# Use pnpm if available, otherwise npm
if command -v pnpm &>/dev/null; then
  pnpm install
  pnpm dev
elif command -v npm &>/dev/null; then
  npm install
  npm run dev
else
  echo "ERROR: Neither pnpm nor npm found. Install Node.js first."
  exit 1
fi

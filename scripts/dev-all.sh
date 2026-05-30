#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi

if ! .venv/bin/python -c "import uvicorn" >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python .venv/bin/python -e '.[dev]'
  else
    .venv/bin/python -m pip install -e '.[dev]'
  fi
fi

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" >/dev/null 2>&1 || true
  wait "$backend_pid" "$frontend_pid" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

wait -n "$backend_pid" "$frontend_pid"

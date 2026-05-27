# qBittorrent Review Queue

Local FastAPI + Vite React app for reviewing completed qBittorrent torrents. The app connects to your local qBittorrent WebUI/API, shows completed torrents, previews video candidates, moves marked files into a session folder on Keep, and deletes rejected torrents only after explicit confirmation.

## Requirements

- Node.js with npm
- Python 3.12 or compatible Python 3
- qBittorrent with WebUI enabled
- WSL path access to the downloads/session folders when running from WSL

## First-Time Setup

Install frontend dependencies:

```bash
npm install
```

Create and install backend dev dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

If `python3 -m venv .venv` fails on Debian/Ubuntu, install the matching `python3-venv` package first.

Create local settings:

```bash
cp .env.example .env
```

Set these in `.env` or in the app Settings panel:

- `QBT_BASE_URL`, usually `http://localhost:8080`
- `QBT_USERNAME`
- `QBT_PASSWORD`
- `WINDOWS_DOWNLOAD_ROOT`
- `WSL_DOWNLOAD_ROOT`
- `SESSION_FOLDER`
- `SESSION_FOLDER_LIMIT`

Do not commit real `.env` or `config.local.json` values.

## Run Both Services

Use this for normal development:

```bash
npm run dev
```

This starts:

- backend: `http://127.0.0.1:8000`
- frontend: `http://127.0.0.1:5500`

Open the app at:

```text
http://127.0.0.1:5500/
```

The frontend proxies `/api` and `/media` to the backend.

## Run Backend Only

```bash
npm run dev:backend
```

Equivalent command:

```bash
.venv/bin/python -m uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

Check backend health:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"ok":true}
```

Check public settings:

```bash
curl http://127.0.0.1:8000/api/settings
```

Check queue API:

```bash
curl http://127.0.0.1:8000/api/queue
```

If qBittorrent is unreachable, `/api/queue` should still return the app shell data with a connection attention item instead of crashing.

Check whether the backend port is listening:

```bash
ss -ltnp 'sport = :8000'
```

Or:

```bash
lsof -iTCP:8000 -sTCP:LISTEN
```

## Run Frontend Only

Start the backend first in another terminal, then run:

```bash
npm run dev:frontend
```

Equivalent command:

```bash
npm --workspace frontend run dev
```

Open:

```text
http://127.0.0.1:5500/
```

Check whether the frontend port is listening:

```bash
ss -ltnp 'sport = :5500'
```

Or:

```bash
lsof -iTCP:5500 -sTCP:LISTEN
```

If port `5500` is already in use, stop the old Vite process or run backend-only and use the already-running frontend.

## Stop Dev Services

If you started both services with `npm run dev`, press `Ctrl+C` in that terminal. The script forwards the stop signal to both the FastAPI backend and Vite frontend.

If you started services separately, stop each one with `Ctrl+C` in its own terminal:

- backend terminal running `npm run dev:backend`
- frontend terminal running `npm run dev:frontend`

Check whether either port is still listening:

```bash
ss -ltnp 'sport = :8000'
ss -ltnp 'sport = :5500'
```

If a process is still running, find it:

```bash
lsof -iTCP:8000 -sTCP:LISTEN
lsof -iTCP:5500 -sTCP:LISTEN
```

Then stop the process by PID:

```bash
kill <pid>
```

Use `kill -9 <pid>` only when normal `kill <pid>` does not stop it.

## Local Production Build

Build the frontend:

```bash
npm run build
```

Serve the built frontend from FastAPI:

```bash
npm run dev:backend
```

Open:

```text
http://127.0.0.1:8000/
```

## qBittorrent WebUI Notes

Enable qBittorrent WebUI before running the app. The backend talks to qBittorrent endpoints under `/api/v2`.

When running from WSL, `http://localhost:8080` may fail if qBittorrent listens only on Windows. The backend attempts a `host.docker.internal` fallback for localhost connection-refused cases while preserving qBittorrent host checks.

If the app shows `qBittorrent connection blocked` or `/api/queue` returns `auth_failed`:

- confirm `QBT_BASE_URL`
- confirm username/password
- make sure qBittorrent WebUI is enabled
- check qBittorrent has not banned the WSL client after repeated failed logins
- consider allowing the WSL subnet in qBittorrent WebUI settings if needed

## Verification Commands

Frontend tests:

```bash
npm run test
```

Frontend typecheck:

```bash
npm run typecheck
```

Frontend production build:

```bash
npm run build
```

Backend tests:

```bash
.venv/bin/python -m pytest -s -q
```

## Safety Notes

- Keep moves marked candidate files into the session folder.
- Keep does not delete the torrent or call qBittorrent delete-with-files.
- Delete/Reject calls qBittorrent with `deleteFiles=true` only after explicit confirmation.
- Keep is blocked when the session folder would exceed its video capacity.
- Real credentials stay local in `.env` or `config.local.json`.

# Development Notes

This repo runs a local FastAPI backend with a Vite React frontend for the qBittorrent review queue.

## Local Setup

1. Install Node dependencies:

```bash
npm install
```

2. Install Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e '.[dev]'
```

If venv creation fails on Debian/Ubuntu, install the matching `python3-venv` package first.

3. Create local settings:

```bash
cp .env.example .env
```

Set these values in `.env` or through the app settings panel:

- `QBT_BASE_URL`, normally `http://localhost:8080`
- `QBT_USERNAME`
- `QBT_PASSWORD`
- `WINDOWS_DOWNLOAD_ROOT`
- `WSL_DOWNLOAD_ROOT`
- `SESSION_FOLDER`
- `SESSION_FOLDER_LIMIT`

Do not commit real `.env` or `config.local.json` values. API responses return `passwordConfigured`, never the password.

## Development Run

Run the backend:

```bash
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Run the frontend:

```bash
npm run dev
```

Open `http://localhost:5500/`. Vite proxies `/api` and `/media` to FastAPI on port `8000`.

## Local Production Run

Build the frontend:

```bash
npm run build
```

Serve the built UI through FastAPI:

```bash
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/`.

## Verification

Run frontend checks:

```bash
npm run typecheck
npm test
npm run build
```

Run backend checks:

```bash
python3 -m pytest backend/tests -q -s
```

Browser smoke verification should cover desktop and narrow viewports at `http://localhost:5500/` during development or `http://localhost:8000/` after a production build. Check console errors and confirm the review shell, queue rail, media stage, candidate table, Keep/Reject controls, settings panel, and disconnected attention state render without mock regions.

## qBittorrent Notes

qBittorrent WebUI must be enabled. The app talks to WebUI API endpoints under `/api/v2`.

When running from WSL, `http://localhost:8080` can fail if qBittorrent listens on Windows only. The backend attempts a `host.docker.internal` fallback for localhost connection-refused cases while preserving qBittorrent host checks. qBittorrent sees that fallback as a remote WSL client, so `Bypass authentication for clients on localhost` does not apply. Use valid qBittorrent credentials, or deliberately enable qBittorrent's subnet whitelist for the active WSL subnet.

If `/api/queue` returns an `auth_failed` attention item, set a valid qBittorrent password in the settings panel or in `.env` / `config.local.json`.

qBittorrent bans remote clients after repeated failed WebUI logins. If the backend reports `IP banned or credentials invalid`, verify from a Windows-side local client first, then clear the ban by waiting for qBittorrent's configured ban duration, restarting qBittorrent, or whitelisting the WSL subnet in qBittorrent WebUI settings.

## Safety Rules

- Reject requires explicit confirmation before qBittorrent delete with `deleteFiles=true`.
- Keep requires confirmation, then moves marked candidate files and returns the expected folder count. It must not call qBittorrent delete with files, and it must not block or report a failed Keep solely because `/mnt/c` visibility lags after `shutil.move` returns successfully.
- The UI preserves the Keep response folder count as a floor until backend refresh catches up; stale `/mnt/c` counts must not lower the visible in-use counter.
- Delete is the explicit confirmed action that removes torrent leftovers with `deleteFiles=true`.
- Keep is blocked when the session folder would exceed capacity.
- Media/open routes accept torrent hash plus qBittorrent file index only. Browser requests never provide raw local paths.

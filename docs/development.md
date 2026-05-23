# Development Notes

This repo is being set up for a local FastAPI backend plus Vite React frontend.

## Commands

- Frontend dev server: `npm run dev`
- Frontend unit tests: `npm test`
- Frontend typecheck: `npm run typecheck`
- Frontend production build: `npm run build`
- Frontend dependency audit: `npm audit`
- Backend tests: `pytest` once backend package files exist.
- Browser smoke screenshot: `npm exec -- playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:5173 /tmp/qbrq-review-ui.png`

Normal local production run should use one FastAPI server that serves the built Vite React assets. Two-server mode is for development only, with Vite proxying API and media requests to FastAPI.

Do not add `.exe` or installer packaging in v1. Run from repo scripts until the review workflow stabilizes.

## Local Environment

Use `.env` for bootstrap defaults:

- `QBT_BASE_URL`
- `QBT_USERNAME`
- `QBT_PASSWORD`
- `QBT_COMPLETED_FILTER`
- `WINDOWS_DOWNLOAD_ROOT`
- `WSL_DOWNLOAD_ROOT`
- `SESSION_FOLDER`
- `SESSION_FOLDER_LIMIT`

Do not commit real `.env` values.

Settings and credentials changed through the app should be written to `config.local.json`, not back into `.env`. Do not commit real `config.local.json` values. API responses must not return password values; return password presence only.

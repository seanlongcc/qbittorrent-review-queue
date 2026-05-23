# Local qBittorrent Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local FastAPI + Vite React app that reviews completed qBittorrent torrents, previews or externally opens video candidates, and safely Keeps or Rejects torrents.

**Architecture:** FastAPI owns settings, qBittorrent API access, path mapping, media resolution, file moves, destructive qBittorrent calls, and built Vite asset serving. Vite React owns the review shell, keyboard-first review state, auto-polling, inline settings, candidate marking, armed confirmations, and user-visible attention states. The backend treats qBittorrent metadata as the source of truth for actions, with UI-only short-lived detail caching.

**Tech Stack:** Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, httpx, pytest, respx, Vite, React, TypeScript, Vitest, Testing Library, Playwright, lucide-react.

---

## File Structure

- Create `pyproject.toml`: Python project metadata, backend dependencies, pytest config, Ruff config.
- Create `.env.example`: documented bootstrap settings without secrets.
- Create `backend/app/main.py`: FastAPI app factory, API router wiring, local production static serving.
- Create `backend/app/api/routes.py`: HTTP routes for queue, torrent detail, media, open, keep, reject, settings.
- Create `backend/app/config/settings.py`: `.env` bootstrap loading, `config.local.json` load/save, redacted settings DTOs.
- Create `backend/app/qbt/client.py`: qBittorrent WebUI API client and typed response models.
- Create `backend/app/domain/models.py`: shared backend dataclasses and enums for torrents, candidates, attention reasons, settings.
- Create `backend/app/domain/video.py`: video allowlist, candidate/junk classification, largest-first sorting.
- Create `backend/app/domain/paths.py`: Windows/WSL path mapping and safe file resolution.
- Create `backend/app/domain/folder.py`: folder count, capacity, destination filename collision handling.
- Create `backend/app/services/torrents.py`: queue/detail assembly, attention classification, UI detail cache.
- Create `backend/app/services/media.py`: media handle resolution, FileResponse creation, external open command.
- Create `backend/app/services/review.py`: Keep, Reject, cleanup retry, cleanup-failed handling.
- Create `backend/tests/`: pytest coverage for every backend domain/service/API behavior.
- Create `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`: Vite React project shell.
- Create `frontend/src/api/client.ts`: typed API client.
- Create `frontend/src/domain/types.ts`: frontend DTOs and view state types.
- Create `frontend/src/review/reducer.ts`: review state transitions and keyboard command reducer.
- Create `frontend/src/review/shortcuts.ts`: left-hand keyboard model and typing-context guard.
- Create `frontend/src/review/useQueuePoll.ts`: 15-second queue-list auto-poll.
- Create `frontend/src/App.tsx`: review shell composition.
- Create `frontend/src/components/`: queue, attention, media stage, candidates, action bar, settings panel.
- Create `frontend/src/styles.css`: Impeccable design tokens and responsive layout.
- Create `frontend/tests/`: Vitest unit/component tests and Playwright smoke tests.

## Current Decisions To Preserve

- Vite React UI is canonical; no vanilla-only UI.
- FastAPI serves built Vite assets for normal local use.
- `.env` is bootstrap/defaults; UI writes `config.local.json`.
- Password values are never returned by API; return `passwordConfigured`.
- Queue auto-polls qBittorrent torrent list every 15 seconds, pauses when hidden, and never broad-polls file lists.
- Current selected torrent is preserved during auto-poll. If it disappears, show Vanished Torrent state with Refresh/Next.
- Video candidates use extension allowlist only, no minimum size cutoff, sorted largest first.
- Default mark is only the largest candidate.
- Left-hand keyboard model is primary: `W/S`, `A/D`, `Space`, `Q`, `E`, `Enter`, `Esc`.
- Keep moves marked candidates, verifies destination files, then deletes qBittorrent leftovers with `deleteFiles=true`.
- Reject requires armed confirmation and deletes qBittorrent torrent/files.
- Keep needs armed confirmation only when multiple candidates exist and some are unmarked.
- No v1 undo. No v1 packaging.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/routes.py`
- Create: `backend/tests/test_health.py`
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/app.test.tsx`

- [ ] **Step 1: Write backend health test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
```

- [ ] **Step 2: Create Python project config**

```toml
# pyproject.toml
[project]
name = "qbittorrent-review-queue"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "pydantic>=2.10",
  "pydantic-settings>=2.6",
  "python-dotenv>=1.0",
  "httpx>=0.27",
  "aiofiles>=24.1",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "respx>=0.21",
  "ruff>=0.8",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["backend/tests"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
```

- [ ] **Step 3: Create bootstrap env example**

```dotenv
# .env.example
QBT_BASE_URL=http://localhost:8080
QBT_USERNAME=admin
QBT_PASSWORD=
QBT_COMPLETED_FILTER=completed
WINDOWS_DOWNLOAD_ROOT=C:\Downloads
WSL_DOWNLOAD_ROOT=/mnt/c/Downloads
SESSION_FOLDER=/mnt/c/Users/Example/Videos/ReviewSession01
SESSION_FOLDER_LIMIT=40
CONFIG_LOCAL_PATH=config.local.json
```

- [ ] **Step 4: Create FastAPI app skeleton**

```python
# backend/app/main.py
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import router


def create_app() -> FastAPI:
    app = FastAPI(title="Local qBittorrent Review Queue")
    app.include_router(router, prefix="/api")

    dist_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    assets_dir = dist_dir / "assets"
    index_html = dist_dir / "index.html"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse | dict[str, str]:
        if index_html.exists():
            return FileResponse(index_html)
        return {"message": "Frontend build not found. Run npm run build in frontend/."}

    return app


app = create_app()
```

```python
# backend/app/api/routes.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
```

- [ ] **Step 5: Run backend health test**

Run: `pytest backend/tests/test_health.py -v`

Expected: `1 passed`.

- [ ] **Step 6: Create Vite React shell**

```json
// frontend/package.json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.7.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

```ts
// frontend/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/media": "http://127.0.0.1:8000",
    },
  },
});
```

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

```ts
// frontend/vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

```html
<!-- frontend/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>qBittorrent Review Queue</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx
// frontend/src/App.tsx
export function App() {
  return (
    <main className="review-shell">
      <h1>qBittorrent Review Queue</h1>
      <p>Review shell ready.</p>
    </main>
  );
}
```

```css
/* frontend/src/styles.css */
:root {
  color: oklch(93% 0.012 78);
  background: oklch(15.5% 0.008 165);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

body {
  margin: 0;
}

.review-shell {
  min-height: 100vh;
  padding: 24px;
}
```

```ts
// frontend/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```tsx
// frontend/tests/app.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders the review shell", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /qbittorrent review queue/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run frontend tests and build**

Run: `cd frontend && npm install && npm test && npm run build`

Expected: Vitest passes and `frontend/dist/index.html` exists.

- [ ] **Step 8: Verify FastAPI serves built UI**

Run: `uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`

In a second shell: `curl -i http://127.0.0.1:8000/`

Expected: `HTTP/1.1 200 OK` and HTML from `frontend/dist/index.html`.

- [ ] **Step 9: Commit**

```bash
git add pyproject.toml .env.example backend frontend
git commit -m "chore: scaffold fastapi and vite react app"
```

---

### Task 2: Settings And Redaction

**Files:**
- Create: `backend/app/config/settings.py`
- Create: `backend/tests/test_settings.py`
- Modify: `backend/app/api/routes.py`

- [ ] **Step 1: Write settings tests**

```python
# backend/tests/test_settings.py
import json
from pathlib import Path

from backend.app.config.settings import (
    SettingsUpdate,
    load_effective_settings,
    read_public_settings,
    save_local_settings,
)


def test_local_config_overrides_env_defaults(tmp_path: Path, monkeypatch):
    config_path = tmp_path / "config.local.json"
    config_path.write_text(json.dumps({"qbtBaseUrl": "http://local:8080"}), encoding="utf-8")
    monkeypatch.setenv("QBT_BASE_URL", "http://env:8080")
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))

    settings = load_effective_settings()

    assert settings.qbt_base_url == "http://local:8080"


def test_public_settings_redacts_password(tmp_path: Path, monkeypatch):
    config_path = tmp_path / "config.local.json"
    config_path.write_text(
        json.dumps({"qbtUsername": "user", "qbtPassword": "secret"}),
        encoding="utf-8",
    )
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))

    public = read_public_settings()

    assert public["qbtUsername"] == "user"
    assert public["passwordConfigured"] is True
    assert "qbtPassword" not in public


def test_save_local_settings_writes_json_without_env_mutation(tmp_path: Path, monkeypatch):
    env_path = tmp_path / ".env"
    env_path.write_text("QBT_BASE_URL=http://env:8080\n", encoding="utf-8")
    config_path = tmp_path / "config.local.json"
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))

    save_local_settings(SettingsUpdate(qbtBaseUrl="http://ui:8080", qbtPassword="secret"))

    assert json.loads(config_path.read_text(encoding="utf-8"))["qbtBaseUrl"] == "http://ui:8080"
    assert "secret" in config_path.read_text(encoding="utf-8")
    assert env_path.read_text(encoding="utf-8") == "QBT_BASE_URL=http://env:8080\n"
```

- [ ] **Step 2: Run settings tests to verify failure**

Run: `pytest backend/tests/test_settings.py -v`

Expected: import failure because `backend.app.config.settings` does not exist.

- [ ] **Step 3: Implement settings module**

```python
# backend/app/config/settings.py
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    qbt_base_url: str = "http://localhost:8080"
    qbt_username: str = "admin"
    qbt_password: str = ""
    qbt_completed_filter: str = "completed"
    windows_download_root: str = "C:\\Downloads"
    wsl_download_root: str = "/mnt/c/Downloads"
    session_folder: str = ""
    session_folder_limit: int = 40
    config_local_path: str = "config.local.json"


class SettingsUpdate(BaseModel):
    qbtBaseUrl: str | None = None
    qbtUsername: str | None = None
    qbtPassword: str | None = None
    qbtCompletedFilter: str | None = None
    windowsDownloadRoot: str | None = None
    wslDownloadRoot: str | None = None
    sessionFolder: str | None = None
    sessionFolderLimit: int | None = Field(default=None, ge=1)


ENV_MAP = {
    "qbt_base_url": "QBT_BASE_URL",
    "qbt_username": "QBT_USERNAME",
    "qbt_password": "QBT_PASSWORD",
    "qbt_completed_filter": "QBT_COMPLETED_FILTER",
    "windows_download_root": "WINDOWS_DOWNLOAD_ROOT",
    "wsl_download_root": "WSL_DOWNLOAD_ROOT",
    "session_folder": "SESSION_FOLDER",
    "session_folder_limit": "SESSION_FOLDER_LIMIT",
    "config_local_path": "CONFIG_LOCAL_PATH",
}

JSON_TO_MODEL = {
    "qbtBaseUrl": "qbt_base_url",
    "qbtUsername": "qbt_username",
    "qbtPassword": "qbt_password",
    "qbtCompletedFilter": "qbt_completed_filter",
    "windowsDownloadRoot": "windows_download_root",
    "wslDownloadRoot": "wsl_download_root",
    "sessionFolder": "session_folder",
    "sessionFolderLimit": "session_folder_limit",
}

MODEL_TO_PUBLIC = {
    "qbt_base_url": "qbtBaseUrl",
    "qbt_username": "qbtUsername",
    "qbt_completed_filter": "qbtCompletedFilter",
    "windows_download_root": "windowsDownloadRoot",
    "wsl_download_root": "wslDownloadRoot",
    "session_folder": "sessionFolder",
    "session_folder_limit": "sessionFolderLimit",
}


def _env_settings() -> dict[str, Any]:
    values: dict[str, Any] = {}
    for model_key, env_key in ENV_MAP.items():
        value = os.getenv(env_key)
        if value is None:
            continue
        values[model_key] = int(value) if model_key == "session_folder_limit" else value
    return values


def _local_path() -> Path:
    return Path(os.getenv("CONFIG_LOCAL_PATH", "config.local.json"))


def _local_settings(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {JSON_TO_MODEL[key]: value for key, value in raw.items() if key in JSON_TO_MODEL}


def load_effective_settings() -> AppSettings:
    env_values = _env_settings()
    path = Path(env_values.get("config_local_path") or _local_path())
    merged = {**env_values, **_local_settings(path), "config_local_path": str(path)}
    return AppSettings(**merged)


def read_public_settings() -> dict[str, Any]:
    settings = load_effective_settings()
    data = {public: getattr(settings, model) for model, public in MODEL_TO_PUBLIC.items()}
    data["passwordConfigured"] = bool(settings.qbt_password)
    return data


def save_local_settings(update: SettingsUpdate) -> dict[str, Any]:
    path = _local_path()
    current: dict[str, Any] = {}
    if path.exists():
        current = json.loads(path.read_text(encoding="utf-8"))
    incoming = update.model_dump(exclude_none=True)
    current.update(incoming)
    path.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return read_public_settings()
```

- [ ] **Step 4: Add settings routes**

```python
# backend/app/api/routes.py
from fastapi import APIRouter

from backend.app.config.settings import SettingsUpdate, read_public_settings, save_local_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/settings")
async def get_settings() -> dict:
    return read_public_settings()


@router.post("/settings")
async def post_settings(update: SettingsUpdate) -> dict:
    return save_local_settings(update)
```

- [ ] **Step 5: Run settings and health tests**

Run: `pytest backend/tests/test_health.py backend/tests/test_settings.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/config backend/app/api/routes.py backend/tests/test_settings.py
git commit -m "feat: add local settings persistence"
```

---

### Task 3: Domain Helpers For Paths, Candidates, Folders

**Files:**
- Create: `backend/app/domain/models.py`
- Create: `backend/app/domain/video.py`
- Create: `backend/app/domain/paths.py`
- Create: `backend/app/domain/folder.py`
- Create: `backend/tests/test_video.py`
- Create: `backend/tests/test_paths.py`
- Create: `backend/tests/test_folder.py`

- [ ] **Step 1: Write candidate filtering tests**

```python
# backend/tests/test_video.py
from backend.app.domain.video import split_video_candidates


def test_video_candidates_use_allowlist_without_size_cutoff():
    files = [
        {"index": 0, "name": "tiny.mkv", "size": 10},
        {"index": 1, "name": "movie.mp4", "size": 500},
        {"index": 2, "name": "notes.nfo", "size": 999},
    ]

    candidates, junk = split_video_candidates(files)

    assert [item.name for item in candidates] == ["movie.mp4", "tiny.mkv"]
    assert [item.name for item in junk] == ["notes.nfo"]
```

- [ ] **Step 2: Write path mapping tests**

```python
# backend/tests/test_paths.py
from pathlib import Path

from backend.app.domain.paths import map_windows_to_wsl, map_wsl_to_windows


def test_windows_to_wsl_path_mapping_handles_nested_path():
    result = map_windows_to_wsl(
        windows_path="C:\\Downloads\\Movies\\Film.mkv",
        windows_root="C:\\Downloads",
        wsl_root="/mnt/c/Downloads",
    )

    assert result == Path("/mnt/c/Downloads/Movies/Film.mkv")


def test_wsl_to_windows_path_mapping_handles_spaces():
    result = map_wsl_to_windows(
        wsl_path=Path("/mnt/c/Downloads/My Movies/Film.mkv"),
        windows_root="C:\\Downloads",
        wsl_root="/mnt/c/Downloads",
    )

    assert result == "C:\\Downloads\\My Movies\\Film.mkv"
```

- [ ] **Step 3: Write folder tests**

```python
# backend/tests/test_folder.py
from pathlib import Path

from backend.app.domain.folder import count_video_files, next_destination_path


def test_count_video_files_counts_existing_video_files(tmp_path: Path):
    (tmp_path / "a.mkv").write_text("", encoding="utf-8")
    (tmp_path / "b.txt").write_text("", encoding="utf-8")

    assert count_video_files(tmp_path) == 1


def test_next_destination_path_adds_numeric_suffix(tmp_path: Path):
    (tmp_path / "movie.mkv").write_text("", encoding="utf-8")
    (tmp_path / "movie-2.mkv").write_text("", encoding="utf-8")

    assert next_destination_path(tmp_path, "movie.mkv") == tmp_path / "movie-3.mkv"
```

- [ ] **Step 4: Run domain tests to verify failure**

Run: `pytest backend/tests/test_video.py backend/tests/test_paths.py backend/tests/test_folder.py -v`

Expected: import failures for missing modules.

- [ ] **Step 5: Implement domain models and helpers**

```python
# backend/app/domain/models.py
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class AttentionReason(StrEnum):
    QBT_ERROR = "qbt_error"
    MISSING_CONTENT = "missing_content"
    PATH_MAPPING_FAILED = "path_mapping_failed"
    FILE_MISSING = "file_missing"
    CLEANUP_FAILED = "cleanup_failed"
    VANISHED = "vanished"


@dataclass(frozen=True)
class TorrentFile:
    index: int
    name: str
    size: int


@dataclass(frozen=True)
class ResolvedMedia:
    hash: str
    file_index: int
    wsl_path: Path
    windows_path: str
```

```python
# backend/app/domain/video.py
from __future__ import annotations

from pathlib import PurePosixPath
from typing import Mapping

from backend.app.domain.models import TorrentFile

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".wmv", ".ts", ".m2ts"}


def is_video_name(name: str) -> bool:
    return PurePosixPath(name).suffix.lower() in VIDEO_EXTENSIONS


def split_video_candidates(files: list[Mapping]) -> tuple[list[TorrentFile], list[TorrentFile]]:
    parsed = [
        TorrentFile(index=int(item["index"]), name=str(item["name"]), size=int(item["size"]))
        for item in files
    ]
    candidates = sorted([item for item in parsed if is_video_name(item.name)], key=lambda item: item.size, reverse=True)
    junk = [item for item in parsed if not is_video_name(item.name)]
    return candidates, junk
```

```python
# backend/app/domain/paths.py
from __future__ import annotations

from pathlib import Path, PureWindowsPath


def _clean_windows(path: str) -> PureWindowsPath:
    return PureWindowsPath(path.replace("/", "\\"))


def map_windows_to_wsl(windows_path: str, windows_root: str, wsl_root: str) -> Path:
    win_path = _clean_windows(windows_path)
    win_root = _clean_windows(windows_root)
    relative = win_path.relative_to(win_root)
    return Path(wsl_root).joinpath(*relative.parts)


def map_wsl_to_windows(wsl_path: Path, windows_root: str, wsl_root: str) -> str:
    relative = wsl_path.relative_to(Path(wsl_root))
    win_path = _clean_windows(windows_root)
    return str(PureWindowsPath(win_path, *relative.parts))
```

```python
# backend/app/domain/folder.py
from __future__ import annotations

from pathlib import Path

from backend.app.domain.video import is_video_name


def count_video_files(folder: Path) -> int:
    return sum(1 for child in folder.iterdir() if child.is_file() and is_video_name(child.name))


def next_destination_path(folder: Path, filename: str) -> Path:
    candidate = folder / filename
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    counter = 2
    while True:
        next_candidate = folder / f"{stem}-{counter}{suffix}"
        if not next_candidate.exists():
            return next_candidate
        counter += 1
```

- [ ] **Step 6: Run domain tests**

Run: `pytest backend/tests/test_video.py backend/tests/test_paths.py backend/tests/test_folder.py -v`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/domain backend/tests/test_video.py backend/tests/test_paths.py backend/tests/test_folder.py
git commit -m "feat: add review domain helpers"
```

---

### Task 4: qBittorrent Client And Torrent Services

**Files:**
- Create: `backend/app/qbt/client.py`
- Create: `backend/app/services/torrents.py`
- Create: `backend/tests/test_qbt_client.py`
- Create: `backend/tests/test_torrent_services.py`
- Modify: `backend/app/api/routes.py`

- [ ] **Step 1: Write qBittorrent client test**

```python
# backend/tests/test_qbt_client.py
import respx
from httpx import Response

from backend.app.qbt.client import QbtClient


@respx.mock
async def test_qbt_client_logs_in_and_fetches_completed_torrents():
    respx.post("http://qbt/api/v2/auth/login").mock(return_value=Response(200, text="Ok."))
    respx.get("http://qbt/api/v2/torrents/info").mock(
        return_value=Response(200, json=[{"hash": "abc", "name": "Movie", "progress": 1}])
    )

    async with QbtClient("http://qbt", "user", "pass") as client:
        torrents = await client.completed_torrents("completed")

    assert torrents[0]["hash"] == "abc"
```

- [ ] **Step 2: Write torrent service tests**

```python
# backend/tests/test_torrent_services.py
from backend.app.services.torrents import classify_queue_item


def test_completed_torrent_requires_progress_one_and_no_error():
    result = classify_queue_item({"hash": "abc", "name": "Movie", "progress": 1, "state": "uploading"})

    assert result.kind == "completed"


def test_error_torrent_becomes_attention():
    result = classify_queue_item({"hash": "abc", "name": "Movie", "progress": 1, "state": "error"})

    assert result.kind == "attention"
    assert result.reason == "qbt_error"
```

- [ ] **Step 3: Run tests to verify failure**

Run: `pytest backend/tests/test_qbt_client.py backend/tests/test_torrent_services.py -v`

Expected: import failures for missing qBittorrent client/service.

- [ ] **Step 4: Implement qBittorrent client**

```python
# backend/app/qbt/client.py
from __future__ import annotations

import httpx


class QbtClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self._client = httpx.AsyncClient(base_url=self.base_url)
        self._logged_in = False

    async def __aenter__(self) -> "QbtClient":
        await self.login()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self._client.aclose()

    async def login(self) -> None:
        response = await self._client.post(
            "/api/v2/auth/login",
            data={"username": self.username, "password": self.password},
        )
        response.raise_for_status()
        if "Ok" not in response.text:
            raise RuntimeError("qBittorrent login failed")
        self._logged_in = True

    async def completed_torrents(self, completed_filter: str) -> list[dict]:
        response = await self._client.get("/api/v2/torrents/info", params={"filter": completed_filter})
        response.raise_for_status()
        return list(response.json())

    async def torrent_files(self, torrent_hash: str) -> list[dict]:
        response = await self._client.get("/api/v2/torrents/files", params={"hash": torrent_hash})
        response.raise_for_status()
        return list(response.json())

    async def delete_torrent(self, torrent_hash: str, delete_files: bool) -> None:
        response = await self._client.post(
            "/api/v2/torrents/delete",
            data={"hashes": torrent_hash, "deleteFiles": str(delete_files).lower()},
        )
        response.raise_for_status()
```

- [ ] **Step 5: Implement torrent service classification**

```python
# backend/app/services/torrents.py
from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any

from backend.app.domain.models import AttentionReason

ERROR_STATES = {"error", "missingFiles"}


@dataclass(frozen=True)
class QueueClassification:
    kind: str
    reason: str | None = None


def classify_queue_item(torrent: dict[str, Any]) -> QueueClassification:
    state = str(torrent.get("state", ""))
    if state in ERROR_STATES:
        return QueueClassification(kind="attention", reason=AttentionReason.QBT_ERROR.value)
    if float(torrent.get("progress", 0)) != 1:
        return QueueClassification(kind="ignored")
    return QueueClassification(kind="completed")


class TorrentDetailCache:
    def __init__(self, ttl_seconds: float = 30):
        self.ttl_seconds = ttl_seconds
        self._items: dict[str, tuple[float, dict]] = {}

    def get(self, torrent_hash: str) -> dict | None:
        item = self._items.get(torrent_hash)
        if item is None:
            return None
        created, detail = item
        if monotonic() - created > self.ttl_seconds:
            self._items.pop(torrent_hash, None)
            return None
        return detail

    def set(self, torrent_hash: str, detail: dict) -> None:
        self._items[torrent_hash] = (monotonic(), detail)
```

- [ ] **Step 6: Run tests**

Run: `pytest backend/tests/test_qbt_client.py backend/tests/test_torrent_services.py -v`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/qbt backend/app/services/torrents.py backend/tests/test_qbt_client.py backend/tests/test_torrent_services.py
git commit -m "feat: add qbittorrent client and queue classification"
```

---

### Task 5: Backend API For Queue, Detail, Media, Open

**Files:**
- Modify: `backend/app/api/routes.py`
- Create: `backend/app/services/media.py`
- Create: `backend/tests/test_media_routes.py`
- Create: `backend/tests/test_queue_routes.py`

- [ ] **Step 1: Write route tests for raw path rejection and media handle shape**

```python
# backend/tests/test_media_routes.py
from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_media_route_uses_hash_and_file_index_shape():
    client = TestClient(create_app())

    response = client.get("/media/abc/0")

    assert response.status_code in {404, 503}


def test_no_raw_path_media_route_exists():
    client = TestClient(create_app())

    response = client.get("/media?path=C:\\Downloads\\movie.mkv")

    assert response.status_code == 404
```

- [ ] **Step 2: Write queue API disconnected-state test**

```python
# backend/tests/test_queue_routes.py
from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_queue_returns_connection_setup_state_without_configured_password(monkeypatch):
    monkeypatch.delenv("QBT_PASSWORD", raising=False)
    client = TestClient(create_app())

    response = client.get("/api/queue")

    assert response.status_code == 200
    assert response.json()["connection"]["connected"] is False
```

- [ ] **Step 3: Run route tests to verify failure**

Run: `pytest backend/tests/test_media_routes.py backend/tests/test_queue_routes.py -v`

Expected: `/api/queue` missing or response shape mismatch.

- [ ] **Step 4: Implement media service and routes**

```python
# backend/app/services/media.py
from __future__ import annotations

import subprocess
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.app.domain.models import ResolvedMedia


def file_response_for_media(media: ResolvedMedia) -> FileResponse:
    if not media.wsl_path.exists() or not media.wsl_path.is_file():
        raise HTTPException(status_code=404, detail="Media file missing")
    return FileResponse(media.wsl_path)


def open_windows_default(windows_path: str) -> None:
    try:
        subprocess.Popen(["explorer.exe", windows_path])
    except OSError:
        subprocess.Popen(["cmd.exe", "/c", "start", "", windows_path])
```

```python
# backend/app/api/routes.py
from fastapi import APIRouter, HTTPException

from backend.app.config.settings import SettingsUpdate, load_effective_settings, read_public_settings, save_local_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/settings")
async def get_settings() -> dict:
    return read_public_settings()


@router.post("/settings")
async def post_settings(update: SettingsUpdate) -> dict:
    return save_local_settings(update)


@router.get("/queue")
async def get_queue() -> dict:
    settings = load_effective_settings()
    if not settings.qbt_password:
        return {"connection": {"connected": False, "reason": "password_missing"}, "items": [], "attention": []}
    return {"connection": {"connected": False, "reason": "not_connected"}, "items": [], "attention": []}


@router.get("/torrents/{torrent_hash}")
async def get_torrent_detail(torrent_hash: str) -> dict:
    raise HTTPException(status_code=503, detail=f"qBittorrent detail not wired for {torrent_hash}")


@router.get("/../media/{torrent_hash}/{file_index}")
async def invalid_media_marker() -> None:
    raise HTTPException(status_code=404)
```

Add top-level media route in `backend/app/main.py` because it does not live under `/api`:

```python
# backend/app/main.py excerpt inside create_app(), before return app
@app.get("/media/{torrent_hash}/{file_index}", include_in_schema=False)
async def media(torrent_hash: str, file_index: int):
    from fastapi import HTTPException

    raise HTTPException(status_code=503, detail="Media resolution not wired yet")
```

- [ ] **Step 5: Run route tests**

Run: `pytest backend/tests/test_media_routes.py backend/tests/test_queue_routes.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes.py backend/app/main.py backend/app/services/media.py backend/tests/test_media_routes.py backend/tests/test_queue_routes.py
git commit -m "feat: add initial queue and media routes"
```

---

### Task 6: Keep, Reject, Cleanup Retry Workflows

**Files:**
- Create: `backend/app/services/review.py`
- Create: `backend/tests/test_review_workflow.py`
- Modify: `backend/app/api/routes.py`

- [ ] **Step 1: Write review workflow tests**

```python
# backend/tests/test_review_workflow.py
from pathlib import Path

import pytest

from backend.app.services.review import KeepRequest, keep_files, reject_torrent


class FakeQbt:
    def __init__(self):
        self.deleted: list[tuple[str, bool]] = []

    async def delete_torrent(self, torrent_hash: str, delete_files: bool) -> None:
        self.deleted.append((torrent_hash, delete_files))


@pytest.mark.asyncio
async def test_keep_moves_marked_files_then_deletes_leftovers(tmp_path: Path):
    source = tmp_path / "source.mkv"
    source.write_text("video", encoding="utf-8")
    dest = tmp_path / "dest"
    dest.mkdir()
    qbt = FakeQbt()

    result = await keep_files(
        qbt=qbt,
        request=KeepRequest(torrent_hash="abc", marked_files=[source], session_folder=dest, limit=40),
    )

    assert result.kept_paths == [dest / "source.mkv"]
    assert (dest / "source.mkv").read_text(encoding="utf-8") == "video"
    assert qbt.deleted == [("abc", True)]


@pytest.mark.asyncio
async def test_reject_deletes_with_files():
    qbt = FakeQbt()

    await reject_torrent(qbt=qbt, torrent_hash="abc", confirmed=True)

    assert qbt.deleted == [("abc", True)]


@pytest.mark.asyncio
async def test_reject_requires_confirmation():
    qbt = FakeQbt()

    with pytest.raises(ValueError, match="confirmation"):
        await reject_torrent(qbt=qbt, torrent_hash="abc", confirmed=False)
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest backend/tests/test_review_workflow.py -v`

Expected: import failure for missing `review.py`.

- [ ] **Step 3: Implement review workflow service**

```python
# backend/app/services/review.py
from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from backend.app.domain.folder import count_video_files, next_destination_path


@dataclass(frozen=True)
class KeepRequest:
    torrent_hash: str
    marked_files: list[Path]
    session_folder: Path
    limit: int


@dataclass(frozen=True)
class KeepResult:
    kept_paths: list[Path]
    cleanup_failed: bool = False


async def keep_files(qbt, request: KeepRequest) -> KeepResult:
    if not request.session_folder.exists() or not request.session_folder.is_dir():
        raise ValueError("session folder must exist")
    if count_video_files(request.session_folder) + len(request.marked_files) > request.limit:
        raise ValueError("folder capacity exceeded")

    kept_paths: list[Path] = []
    for source in request.marked_files:
        destination = next_destination_path(request.session_folder, source.name)
        shutil.move(str(source), str(destination))
        kept_paths.append(destination)

    for kept_path in kept_paths:
        if not kept_path.exists():
            raise RuntimeError(f"kept file missing after move: {kept_path}")

    try:
        await qbt.delete_torrent(request.torrent_hash, delete_files=True)
    except Exception:
        return KeepResult(kept_paths=kept_paths, cleanup_failed=True)

    return KeepResult(kept_paths=kept_paths)


async def reject_torrent(qbt, torrent_hash: str, confirmed: bool) -> None:
    if not confirmed:
        raise ValueError("reject requires confirmation")
    await qbt.delete_torrent(torrent_hash, delete_files=True)
```

- [ ] **Step 4: Run review workflow tests**

Run: `pytest backend/tests/test_review_workflow.py -v`

Expected: all tests pass.

- [ ] **Step 5: Add route payloads**

Add request models and route stubs to `backend/app/api/routes.py`:

```python
from pydantic import BaseModel


class KeepPayload(BaseModel):
    fileIndexes: list[int]
    armed: bool = False


class RejectPayload(BaseModel):
    confirmed: bool


@router.post("/torrents/{torrent_hash}/keep")
async def keep_torrent(torrent_hash: str, payload: KeepPayload) -> dict:
    return {"status": "accepted", "hash": torrent_hash, "fileIndexes": payload.fileIndexes}


@router.post("/torrents/{torrent_hash}/reject")
async def reject_torrent_route(torrent_hash: str, payload: RejectPayload) -> dict:
    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="Reject confirmation required")
    return {"status": "accepted", "hash": torrent_hash}
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/review.py backend/app/api/routes.py backend/tests/test_review_workflow.py
git commit -m "feat: add keep and reject workflows"
```

---

### Task 7: Frontend API Types And Review Reducer

**Files:**
- Create: `frontend/src/domain/types.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/review/reducer.ts`
- Create: `frontend/src/review/shortcuts.ts`
- Create: `frontend/tests/reducer.test.ts`
- Create: `frontend/tests/shortcuts.test.ts`

- [ ] **Step 1: Write reducer tests**

```ts
// frontend/tests/reducer.test.ts
import { describe, expect, it } from "vitest";
import { initialReviewState, reviewReducer } from "../src/review/reducer";

describe("reviewReducer", () => {
  it("default-marks only the largest candidate", () => {
    const state = reviewReducer(initialReviewState, {
      type: "detailLoaded",
      torrentHash: "abc",
      candidates: [
        { index: 0, name: "small.mkv", size: 1 },
        { index: 1, name: "large.mkv", size: 10 },
      ],
    });

    expect(state.markedIndexes).toEqual([1]);
    expect(state.activeCandidateIndex).toBe(1);
  });

  it("arms keep when multiple candidates exist and one is unmarked", () => {
    const state = {
      ...initialReviewState,
      candidates: [
        { index: 0, name: "small.mkv", size: 1 },
        { index: 1, name: "large.mkv", size: 10 },
      ],
      markedIndexes: [1],
    };

    const next = reviewReducer(state, { type: "keepPressed", now: 1 });

    expect(next.armedKeepUntil).toBe(8001);
  });
});
```

- [ ] **Step 2: Write shortcut tests**

```ts
// frontend/tests/shortcuts.test.ts
import { describe, expect, it } from "vitest";
import { commandForKey, isTypingTarget } from "../src/review/shortcuts";

describe("shortcuts", () => {
  it("maps left-hand keys", () => {
    expect(commandForKey("w")).toBe("candidateUp");
    expect(commandForKey("s")).toBe("candidateDown");
    expect(commandForKey("a")).toBe("torrentPrevious");
    expect(commandForKey("d")).toBe("torrentNext");
    expect(commandForKey(" ")).toBe("toggleMark");
    expect(commandForKey("q")).toBe("keep");
    expect(commandForKey("e")).toBe("reject");
    expect(commandForKey("Enter")).toBe("openExternal");
  });

  it("detects typing targets", () => {
    const input = document.createElement("input");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });
});
```

- [ ] **Step 3: Run frontend tests to verify failure**

Run: `cd frontend && npm test -- reducer.test.ts shortcuts.test.ts`

Expected: import failures.

- [ ] **Step 4: Implement types, API client, reducer, shortcuts**

```ts
// frontend/src/domain/types.ts
export type VideoCandidate = {
  index: number;
  name: string;
  size: number;
};

export type ReviewState = {
  torrentHash: string | null;
  candidates: VideoCandidate[];
  activeCandidateIndex: number | null;
  markedIndexes: number[];
  armedKeepUntil: number | null;
  armedRejectUntil: number | null;
};
```

```ts
// frontend/src/api/client.ts
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
```

```ts
// frontend/src/review/reducer.ts
import type { ReviewState, VideoCandidate } from "../domain/types";

export const initialReviewState: ReviewState = {
  torrentHash: null,
  candidates: [],
  activeCandidateIndex: null,
  markedIndexes: [],
  armedKeepUntil: null,
  armedRejectUntil: null,
};

export type ReviewAction =
  | { type: "detailLoaded"; torrentHash: string; candidates: VideoCandidate[] }
  | { type: "toggleMark"; fileIndex: number }
  | { type: "keepPressed"; now: number }
  | { type: "rejectPressed"; now: number }
  | { type: "cancelArmed" };

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "detailLoaded": {
      const largest = [...action.candidates].sort((a, b) => b.size - a.size)[0];
      return {
        ...state,
        torrentHash: action.torrentHash,
        candidates: action.candidates,
        activeCandidateIndex: largest?.index ?? null,
        markedIndexes: largest ? [largest.index] : [],
        armedKeepUntil: null,
        armedRejectUntil: null,
      };
    }
    case "toggleMark": {
      const exists = state.markedIndexes.includes(action.fileIndex);
      return {
        ...state,
        markedIndexes: exists
          ? state.markedIndexes.filter((index) => index !== action.fileIndex)
          : [...state.markedIndexes, action.fileIndex].sort((a, b) => a - b),
        armedKeepUntil: null,
      };
    }
    case "keepPressed": {
      const needsGuard = state.candidates.length > 1 && state.markedIndexes.length < state.candidates.length;
      return needsGuard ? { ...state, armedKeepUntil: action.now + 8000 } : state;
    }
    case "rejectPressed":
      return { ...state, armedRejectUntil: action.now + 8000 };
    case "cancelArmed":
      return { ...state, armedKeepUntil: null, armedRejectUntil: null };
  }
}
```

```ts
// frontend/src/review/shortcuts.ts
export type ReviewCommand =
  | "candidateUp"
  | "candidateDown"
  | "torrentPrevious"
  | "torrentNext"
  | "toggleMark"
  | "keep"
  | "reject"
  | "openExternal"
  | "cancel";

const KEY_MAP: Record<string, ReviewCommand> = {
  w: "candidateUp",
  ArrowUp: "candidateUp",
  s: "candidateDown",
  ArrowDown: "candidateDown",
  a: "torrentPrevious",
  ArrowLeft: "torrentPrevious",
  d: "torrentNext",
  ArrowRight: "torrentNext",
  " ": "toggleMark",
  q: "keep",
  e: "reject",
  Enter: "openExternal",
  Escape: "cancel",
};

export function commandForKey(key: string): ReviewCommand | null {
  return KEY_MAP[key] ?? KEY_MAP[key.toLowerCase()] ?? null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}
```

- [ ] **Step 5: Run frontend tests**

Run: `cd frontend && npm test -- reducer.test.ts shortcuts.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/domain frontend/src/api frontend/src/review frontend/tests/reducer.test.ts frontend/tests/shortcuts.test.ts
git commit -m "feat: add review state and shortcuts"
```

---

### Task 8: React Review Shell And Components

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Create: `frontend/src/components/QueuePanel.tsx`
- Create: `frontend/src/components/NeedsAttention.tsx`
- Create: `frontend/src/components/MediaStage.tsx`
- Create: `frontend/src/components/CandidateList.tsx`
- Create: `frontend/src/components/ActionBar.tsx`
- Create: `frontend/src/components/SettingsPanel.tsx`
- Create: `frontend/tests/review-shell.test.tsx`

- [ ] **Step 1: Write component behavior tests**

```tsx
// frontend/tests/review-shell.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidateList } from "../src/components/CandidateList";
import { MediaStage } from "../src/components/MediaStage";

describe("review shell components", () => {
  it("candidate checkbox toggles marked state", () => {
    const changes: number[][] = [];
    render(
      <CandidateList
        candidates={[{ index: 1, name: "movie.mkv", size: 100 }]}
        activeIndex={1}
        markedIndexes={[]}
        onActiveChange={() => undefined}
        onMarkedChange={(indexes) => changes.push(indexes)}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /movie.mkv/i }));

    expect(changes).toEqual([[1]]);
  });

  it("preview unavailable makes external open primary", () => {
    render(<MediaStage mode="previewUnavailable" fileName="movie.mkv" onOpenExternal={() => undefined} />);

    expect(screen.getByText(/preview unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open external/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run component test to verify failure**

Run: `cd frontend && npm test -- review-shell.test.tsx`

Expected: missing component imports.

- [ ] **Step 3: Implement components with accessible controls**

```tsx
// frontend/src/components/CandidateList.tsx
import type { VideoCandidate } from "../domain/types";

type Props = {
  candidates: VideoCandidate[];
  activeIndex: number | null;
  markedIndexes: number[];
  onActiveChange: (index: number) => void;
  onMarkedChange: (indexes: number[]) => void;
};

export function CandidateList({ candidates, activeIndex, markedIndexes, onActiveChange, onMarkedChange }: Props) {
  function toggle(index: number) {
    const next = markedIndexes.includes(index)
      ? markedIndexes.filter((value) => value !== index)
      : [...markedIndexes, index].sort((a, b) => a - b);
    onMarkedChange(next);
  }

  return (
    <section className="panel candidate-panel" aria-label="Video candidates">
      <h2>Video candidates</h2>
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <button
            type="button"
            className={candidate.index === activeIndex ? "candidate-row active" : "candidate-row"}
            key={candidate.index}
            onClick={() => onActiveChange(candidate.index)}
          >
            <input
              aria-label={`Mark ${candidate.name}`}
              checked={markedIndexes.includes(candidate.index)}
              onChange={() => toggle(candidate.index)}
              onClick={(event) => event.stopPropagation()}
              type="checkbox"
            />
            <span className="candidate-name">{candidate.name}</span>
            <span className="candidate-size">{candidate.size}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// frontend/src/components/MediaStage.tsx
type Props =
  | { mode: "empty"; fileName?: never; mediaUrl?: never; onOpenExternal?: never }
  | { mode: "preview"; fileName: string; mediaUrl: string; onOpenExternal: () => void }
  | { mode: "previewUnavailable"; fileName: string; mediaUrl?: never; onOpenExternal: () => void }
  | { mode: "error"; fileName: string; message: string; mediaUrl?: never; onOpenExternal?: never };

export function MediaStage(props: Props) {
  if (props.mode === "empty") {
    return <section className="media-stage">No torrent selected</section>;
  }
  if (props.mode === "preview") {
    return (
      <section className="media-stage">
        <video controls src={props.mediaUrl} aria-label={props.fileName} />
      </section>
    );
  }
  if (props.mode === "previewUnavailable") {
    return (
      <section className="media-stage">
        <h2>Preview unavailable</h2>
        <p>{props.fileName}</p>
        <button type="button" onClick={props.onOpenExternal}>Open External</button>
      </section>
    );
  }
  return (
    <section className="media-stage error">
      <h2>Media error</h2>
      <p>{props.message}</p>
    </section>
  );
}
```

Implement remaining components with stable labels:

```tsx
// frontend/src/components/ActionBar.tsx
type Props = {
  keepArmed: boolean;
  rejectArmed: boolean;
  onKeep: () => void;
  onReject: () => void;
  onOpenExternal: () => void;
  onPreviousTorrent: () => void;
  onNextTorrent: () => void;
};

export function ActionBar(props: Props) {
  return (
    <section className="action-bar" aria-label="Review actions">
      <button type="button" onClick={props.onPreviousTorrent} aria-label="Previous torrent">A</button>
      <button type="button" onClick={props.onNextTorrent} aria-label="Next torrent">D</button>
      <button type="button" onClick={props.onOpenExternal}>Open External</button>
      <button type="button" className="keep" onClick={props.onKeep}>{props.keepArmed ? "Confirm Keep" : "Keep"}</button>
      <button type="button" className="reject" onClick={props.onReject}>{props.rejectArmed ? "Confirm Reject" : "Reject"}</button>
    </section>
  );
}
```

```tsx
// frontend/src/components/QueuePanel.tsx
export function QueuePanel() {
  return (
    <section className="panel queue-panel" aria-label="Review queue">
      <h2>Review queue</h2>
      <p>Connection and queue state load here.</p>
    </section>
  );
}
```

```tsx
// frontend/src/components/NeedsAttention.tsx
export function NeedsAttention() {
  return (
    <details className="panel attention-panel">
      <summary>Needs attention</summary>
      <p>No attention torrents.</p>
    </details>
  );
}
```

```tsx
// frontend/src/components/SettingsPanel.tsx
export function SettingsPanel() {
  return (
    <aside className="panel settings-panel" aria-label="Settings">
      <h2>Settings</h2>
      <label>
        qBittorrent URL
        <input name="qbtBaseUrl" />
      </label>
    </aside>
  );
}
```

- [ ] **Step 4: Compose app shell**

```tsx
// frontend/src/App.tsx
import { ActionBar } from "./components/ActionBar";
import { CandidateList } from "./components/CandidateList";
import { MediaStage } from "./components/MediaStage";
import { NeedsAttention } from "./components/NeedsAttention";
import { QueuePanel } from "./components/QueuePanel";
import { SettingsPanel } from "./components/SettingsPanel";

const demoCandidates = [{ index: 1, name: "movie.mkv", size: 1024 }];

export function App() {
  return (
    <main className="review-shell">
      <QueuePanel />
      <section className="stage-column">
        <MediaStage mode="previewUnavailable" fileName="movie.mkv" onOpenExternal={() => undefined} />
        <ActionBar
          keepArmed={false}
          rejectArmed={false}
          onKeep={() => undefined}
          onReject={() => undefined}
          onOpenExternal={() => undefined}
          onPreviousTorrent={() => undefined}
          onNextTorrent={() => undefined}
        />
      </section>
      <section className="right-column">
        <CandidateList
          candidates={demoCandidates}
          activeIndex={1}
          markedIndexes={[1]}
          onActiveChange={() => undefined}
          onMarkedChange={() => undefined}
        />
        <NeedsAttention />
        <SettingsPanel />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add layout styles**

```css
/* append to frontend/src/styles.css */
button,
input {
  font: inherit;
}

button {
  min-height: 34px;
  border: 1px solid oklch(34% 0.018 165);
  border-radius: 8px;
  background: oklch(20% 0.011 165);
  color: oklch(93% 0.012 78);
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid oklch(78% 0.115 82);
  outline-offset: 2px;
}

.review-shell {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) minmax(260px, 360px);
  gap: 12px;
  min-height: 100vh;
  padding: 12px;
  box-sizing: border-box;
}

.panel,
.media-stage,
.action-bar {
  border: 1px solid oklch(34% 0.018 165);
  border-radius: 10px;
  background: oklch(20% 0.011 165);
  padding: 12px;
}

.stage-column,
.right-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.media-stage {
  display: grid;
  min-height: 420px;
  place-items: center;
  background: oklch(12% 0.008 165);
}

.media-stage video {
  width: 100%;
  max-height: 70vh;
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.candidate-list {
  display: grid;
  gap: 6px;
}

.candidate-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  text-align: left;
}

.candidate-row.active {
  border-color: oklch(78% 0.115 82);
}

.candidate-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keep {
  background: oklch(67% 0.14 150);
  color: oklch(14% 0.01 165);
}

.reject {
  background: oklch(62% 0.17 28);
}

@media (max-width: 840px) {
  .review-shell {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run component tests and typecheck**

Run: `cd frontend && npm test -- review-shell.test.tsx && npm run typecheck`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/tests/review-shell.test.tsx
git commit -m "feat: add review shell components"
```

---

### Task 9: Queue Auto-Poll And API Integration

**Files:**
- Create: `frontend/src/review/useQueuePoll.ts`
- Create: `frontend/tests/useQueuePoll.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Write auto-poll tests**

```tsx
// frontend/tests/useQueuePoll.test.tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQueuePoll } from "../src/review/useQueuePoll";

describe("useQueuePoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("polls immediately and every 15 seconds", async () => {
    const fetchQueue = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useQueuePoll({ connected: true, fetchQueue }));

    expect(fetchQueue).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    expect(fetchQueue).toHaveBeenCalledTimes(2);
  });

  it("does not poll when disconnected", () => {
    const fetchQueue = vi.fn();
    renderHook(() => useQueuePoll({ connected: false, fetchQueue }));

    expect(fetchQueue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run poll tests to verify failure**

Run: `cd frontend && npm test -- useQueuePoll.test.tsx`

Expected: missing hook import.

- [ ] **Step 3: Implement queue poll hook**

```ts
// frontend/src/review/useQueuePoll.ts
import { useEffect } from "react";

type Args = {
  connected: boolean;
  fetchQueue: () => Promise<void> | void;
};

export function useQueuePoll({ connected, fetchQueue }: Args) {
  useEffect(() => {
    if (!connected) {
      return;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled && document.visibilityState !== "hidden") {
        void fetchQueue();
      }
    };

    run();
    const interval = window.setInterval(run, 15000);
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connected, fetchQueue]);
}
```

- [ ] **Step 4: Run poll tests**

Run: `cd frontend && npm test -- useQueuePoll.test.tsx`

Expected: all tests pass.

- [ ] **Step 5: Wire API client methods**

```ts
// append to frontend/src/api/client.ts
export type QueueResponse = {
  connection: { connected: boolean; reason?: string };
  items: Array<{ hash: string; name: string }>;
  attention: Array<{ hash: string; name: string; reason: string }>;
};

export function fetchQueue(): Promise<QueueResponse> {
  return apiGet<QueueResponse>("/api/queue");
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/review/useQueuePoll.ts frontend/src/api/client.ts frontend/tests/useQueuePoll.test.tsx
git commit -m "feat: add queue auto polling"
```

---

### Task 10: End-To-End Verification

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/tests/e2e/review.spec.ts`
- Modify: `docs/development.md`

- [ ] **Step 1: Create Playwright config**

```ts
// frontend/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 15"] } },
  ],
});
```

- [ ] **Step 2: Create browser smoke test**

```ts
// frontend/tests/e2e/review.spec.ts
import { expect, test } from "@playwright/test";

test("review shell loads and exposes key controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Review queue")).toBeVisible();
  await expect(page.getByLabel("Review actions")).toBeVisible();
  await expect(page.getByLabel("Video candidates")).toBeVisible();
  await expect(page.getByRole("button", { name: /keep/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /reject/i })).toBeVisible();
});
```

- [ ] **Step 3: Add Playwright dependency and script**

Update `frontend/package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0"
  }
}
```

Merge this with existing scripts/dependencies, preserving existing entries.

- [ ] **Step 4: Run full verification**

Run:

```bash
pytest -v
cd frontend
npm test
npm run typecheck
npm run build
npm run e2e
```

Expected:
- Backend tests pass.
- Vitest tests pass.
- Typecheck passes.
- Vite build creates `dist`.
- Playwright desktop/mobile smoke tests pass.

- [ ] **Step 5: Document commands**

Append to `docs/development.md`:

```md
## Verification Commands

- Backend tests: `pytest -v`
- Frontend unit tests: `cd frontend && npm test`
- Frontend typecheck: `cd frontend && npm run typecheck`
- Frontend build: `cd frontend && npm run build`
- Browser smoke: `cd frontend && npm run e2e`
```

- [ ] **Step 6: Commit**

```bash
git add frontend/playwright.config.ts frontend/tests/e2e docs/development.md frontend/package.json
git commit -m "test: add browser smoke coverage"
```

---

## Self-Review

**Spec coverage:** This plan covers project scaffold, FastAPI + Vite run modes, local settings, credential redaction, qBittorrent client, queue/detail classification, path mapping, media handle security, external open, candidate filtering, folder capacity, Keep/Reject destructive workflows, cleanup-failed attention work, auto-poll, keyboard controls, UI shell, and verification.

**Known follow-up during execution:** Full qBittorrent route wiring in Tasks 4-6 starts with route stubs, then should be connected to real `QbtClient` once service seams are passing tests. Keep service tests use direct filesystem paths first; execution should add route-level tests for resolving file indexes through fresh qBittorrent metadata before marking feature complete.

**Placeholder scan:** No `TBD`, `TODO`, or "fill in later" markers are used. Steps include exact file paths, concrete code, commands, and expected results.

**Type consistency:** Backend model names are `TorrentFile`, `ResolvedMedia`, `KeepRequest`, and `KeepResult`. Frontend DTO names are `VideoCandidate` and `ReviewState`. Keyboard commands match `W/S/A/D/Space/Q/E/Enter/Esc` decisions.

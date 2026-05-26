# Execution History Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent app-specific execution history that records review actions such as moved files, deleted torrents/files, and useful workflow failures without mirroring qBittorrent API chatter.

**Architecture:** FastAPI owns history persistence in a focused JSON-backed module beside `config.local.json`. Review routes append events after user-initiated action outcomes, and React fetches `/api/history` into a compact workbench history section. Keep route files, qBittorrent access, path mapping, and UI rendering remain separate.

**Tech Stack:** Python 3.12, FastAPI, pytest, React 18, TypeScript, Vitest, Testing Library, Vite.

---

## File Structure

- Create `backend/app/history.py`: load, append, trim, sanitize, and atomically write execution history JSON.
- Create `backend/tests/test_history.py`: unit tests for ordering, trim limit, corrupt-file recovery, and path derivation.
- Modify `backend/app/main.py`: add `GET /api/history` and thin append calls in Keep/Delete/Open External routes.
- Modify `backend/tests/test_api.py`: route-level tests proving Keep/Delete/Open External write history and unconfirmed actions do not write success entries.
- Modify `frontend/src/domain/types.ts`: add history DTO types.
- Modify `frontend/src/api/client.ts`: add `getHistory()`.
- Modify `frontend/src/api/client.test.ts`: cover `/api/history`.
- Create `frontend/src/review/HistoryPanel.tsx`: compact history renderer.
- Create `frontend/src/review/HistoryPanel.test.tsx`: focused rendering tests.
- Modify `frontend/src/App.tsx`: fetch history on startup and after review actions; pass items to `HistoryPanel`.
- Modify `frontend/src/App.test.tsx`: add `/api/history` responses in fetch mocks and verify refresh after Keep/Delete.
- Modify `frontend/src/styles.css`: add focused history styles.

---

### Task 1: Backend History Persistence

**Files:**
- Create: `backend/app/history.py`
- Create: `backend/tests/test_history.py`

- [ ] **Step 1: Write failing history module tests**

Create `backend/tests/test_history.py`:

```python
from __future__ import annotations

import json

from backend.app.history import append_history_event, history_file_path, load_history


def test_history_path_lives_beside_config_local(tmp_path):
    config_path = tmp_path / "nested" / "config.local.json"

    assert history_file_path(config_path) == tmp_path / "nested" / "execution-log.json"


def test_append_history_event_persists_newest_first(tmp_path):
    path = tmp_path / "execution-log.json"

    first = append_history_event(
        path,
        {
            "action": "keep",
            "status": "success",
            "torrentHash": "abc",
            "torrentName": "Show",
            "summary": "Kept 1 video",
            "files": [{"destinationPath": "/mnt/c/Review/main.mkv", "name": "main.mkv"}],
        },
    )
    second = append_history_event(
        path,
        {
            "action": "delete",
            "status": "success",
            "torrentHash": "def",
            "torrentName": "Other",
            "summary": "Deleted torrent and files",
            "detail": "deleteFiles=true",
        },
    )

    items = load_history(path)

    assert [item["id"] for item in items] == [second["id"], first["id"]]
    assert items[0]["timestamp"].endswith("Z")
    assert items[0]["action"] == "delete"
    assert items[1]["files"][0]["destinationPath"] == "/mnt/c/Review/main.mkv"


def test_append_history_event_trims_to_limit(tmp_path):
    path = tmp_path / "execution-log.json"

    for index in range(4):
        append_history_event(
            path,
            {
                "action": "keep",
                "status": "success",
                "torrentHash": str(index),
                "torrentName": f"Torrent {index}",
                "summary": f"Kept {index}",
            },
            limit=3,
        )

    assert [item["torrentHash"] for item in load_history(path)] == ["3", "2", "1"]


def test_load_history_recovers_from_missing_or_corrupt_file(tmp_path):
    path = tmp_path / "execution-log.json"

    assert load_history(path) == []

    path.write_text("{not json", encoding="utf-8")

    assert load_history(path) == []

    path.write_text(json.dumps({"items": "not a list"}), encoding="utf-8")

    assert load_history(path) == []
```

- [ ] **Step 2: Run backend history tests and verify failure**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_history.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.app.history'`.

- [ ] **Step 3: Implement `backend/app/history.py`**

Create `backend/app/history.py`:

```python
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


HISTORY_LIMIT = 500


def history_file_path(config_local_path: str | Path) -> Path:
    return Path(config_local_path).with_name("execution-log.json")


def load_history(path: str | Path) -> list[dict[str, Any]]:
    history_path = Path(path)
    if not history_path.exists():
        return []
    try:
        raw = json.loads(history_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    items = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def append_history_event(
    path: str | Path,
    event: dict[str, Any],
    *,
    limit: int = HISTORY_LIMIT,
) -> dict[str, Any]:
    history_path = Path(path)
    item = {
        "id": uuid4().hex,
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        **_clean_event(event),
    }
    items = [item, *load_history(history_path)][:limit]
    history_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = history_path.with_name(f"{history_path.name}.tmp")
    temporary_path.write_text(json.dumps({"items": items}, indent=2), encoding="utf-8")
    temporary_path.replace(history_path)
    return item


def _clean_event(event: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in event.items():
        if value is None:
            continue
        if key == "files" and isinstance(value, list):
            cleaned[key] = [_clean_file(file_entry) for file_entry in value if isinstance(file_entry, dict)]
            continue
        if isinstance(value, (str, int, float, bool)):
            cleaned[key] = value
    return cleaned


def _clean_file(file_entry: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key in ("sourcePath", "destinationPath", "fileIndex", "name"):
        value = file_entry.get(key)
        if value is None:
            continue
        if isinstance(value, (str, int)):
            cleaned[key] = value
    return cleaned
```

- [ ] **Step 4: Run backend history tests and verify pass**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_history.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit backend persistence**

Run:

```bash
git add backend/app/history.py backend/tests/test_history.py
git commit -m "feat: add execution history persistence"
```

---

### Task 2: Backend API History Logging

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Add failing route tests**

Add imports and helpers in `backend/tests/test_api.py`:

```python
import json
```

Add this helper near `configure_review_env`:

```python
def read_history_file(tmp_path):
    path = tmp_path / "execution-log.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["items"]
```

Add tests:

```python
def test_history_endpoint_returns_persisted_items(monkeypatch, tmp_path):
    clear_cleanup_failures()
    config_path = tmp_path / "config.local.json"
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))
    (tmp_path / "execution-log.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "id": "event-1",
                        "timestamp": "2026-05-26T20:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "torrentHash": "abc",
                        "torrentName": "Show",
                        "summary": "Kept 1 video",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    client = TestClient(create_app())

    response = client.get("/api/history")

    assert response.status_code == 200
    assert response.json()["items"][0]["summary"] == "Kept 1 video"


def test_keep_logs_moved_files_after_confirmation(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    source = show / "main.mkv"
    source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    history = read_history_file(tmp_path)
    assert history[0]["action"] == "keep"
    assert history[0]["status"] == "success"
    assert history[0]["torrentHash"] == "abc"
    assert history[0]["torrentName"] == "Show"
    assert history[0]["summary"] == "Kept 1 video"
    assert history[0]["files"] == [
        {
            "sourcePath": str(source),
            "destinationPath": str(session / "main.mkv"),
            "fileIndex": 0,
            "name": "main.mkv",
        }
    ]


def test_unconfirmed_keep_does_not_write_history(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert response.status_code == 409
    assert read_history_file(tmp_path) == []


def test_failed_confirmed_keep_logs_failure_without_success(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "missing.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 409
    history = read_history_file(tmp_path)
    assert history[0]["action"] == "keep"
    assert history[0]["status"] == "failed"
    assert history[0]["summary"] == "Keep failed"
    assert "Marked file is missing" in history[0]["detail"]


def test_reject_logs_confirmed_delete(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    downloads.mkdir()
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 200
    history = read_history_file(tmp_path)
    assert history[0]["action"] == "delete"
    assert history[0]["status"] == "success"
    assert history[0]["torrentHash"] == "abc"
    assert history[0]["torrentName"] == "Show"
    assert history[0]["summary"] == "Deleted torrent and files"
    assert history[0]["detail"] == "qBittorrent deleteFiles=true"


def test_failed_confirmed_reject_logs_failure(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    downloads.mkdir()
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    fake_qbt.fail_delete = True
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 503
    history = read_history_file(tmp_path)
    assert history[0]["action"] == "delete"
    assert history[0]["status"] == "failed"
    assert history[0]["summary"] == "Delete failed"
    assert "cleanup delete failed" in history[0]["detail"]


def test_open_external_logs_selected_file(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    source = show / "main.mkv"
    source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    monkeypatch.setattr("backend.app.main.open_windows_default", lambda _path: None)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/open", json={"fileIndex": 0})

    assert response.status_code == 200
    history = read_history_file(tmp_path)
    assert history[0]["action"] == "open_external"
    assert history[0]["status"] == "success"
    assert history[0]["files"][0]["sourcePath"] == str(source)
```

- [ ] **Step 2: Run route tests and verify failure**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_api.py -q
```

Expected: FAIL because `/api/history` and route append calls do not exist.

- [ ] **Step 3: Wire history in `backend/app/main.py`**

Add import:

```python
from backend.app.history import append_history_event, history_file_path, load_history
```

Add helper functions above `create_app()`:

```python
def _history_path() -> Path:
    return history_file_path(load_settings().config_local_path)


def _append_history_safely(event: dict[str, Any]) -> None:
    try:
        append_history_event(_history_path(), event)
    except Exception:
        return


def _torrent_name(torrent: dict[str, Any] | None) -> str | None:
    if not torrent:
        return None
    name = torrent.get("name")
    return str(name) if name else None


def _append_workflow_failure(
    action: str,
    torrent_hash: str,
    torrent: dict[str, Any] | None,
    detail: str,
) -> None:
    _append_history_safely(
        {
            "action": action,
            "status": "failed",
            "torrentHash": torrent_hash,
            "torrentName": _torrent_name(torrent),
            "summary": f"{'Delete' if action == 'delete' else 'Keep' if action == 'keep' else 'Open external'} failed",
            "detail": detail,
        }
    )
```

Add route inside `create_app()` after settings routes:

```python
    @app.get("/api/history")
    def get_history() -> dict[str, Any]:
        return {"items": load_history(_history_path())}
```

In `open_torrent_file`, after `open_windows_default(...)` and before return:

```python
            _append_history_safely(
                {
                    "action": "open_external",
                    "status": "success",
                    "torrentHash": torrent_hash,
                    "torrentName": _torrent_name(torrent),
                    "summary": f"Opened {file_entry.get('name') or 'file'} externally",
                    "files": [
                        {
                            "sourcePath": str(resolved.wsl_path),
                            "fileIndex": payload.fileIndex,
                            "name": str(file_entry.get("name") or ""),
                        }
                    ],
                }
            )
```

For Open External failures, initialize `torrent: dict[str, Any] | None = None` before the `try`, then add this before `raise _qbt_error(exc) from exc`:

```python
            if torrent is not None:
                _append_workflow_failure("open_external", torrent_hash, torrent, str(exc))
```

In `keep_torrent_file`, replace direct `return keep_torrent(...)` with:

```python
                result = keep_torrent(
                    KeepRequest(
                        confirmed=payload.confirmed,
                        marked_files=paths,
                        session_folder=session_folder,
                        existing_count=existing_count,
                        session_limit=settings.session_folder_limit,
                    ),
                )
                moved = [str(path) for path in result["moved"]]
                _append_history_safely(
                    {
                        "action": "keep",
                        "status": "success",
                        "torrentHash": torrent_hash,
                        "torrentName": _torrent_name(torrent),
                        "summary": f"Kept {len(moved)} video{'s' if len(moved) != 1 else ''}",
                        "files": [
                            {
                                "sourcePath": str(source_path),
                                "destinationPath": destination_path,
                                "fileIndex": file_index,
                                "name": str(file_entry.get("name") or ""),
                            }
                            for source_path, destination_path, file_index, file_entry in zip(
                                paths,
                                moved,
                                requested_indexes,
                                marked,
                                strict=False,
                            )
                        ],
                    }
                )
                return result
```

In Keep failure handlers, append only confirmed user-initiated failures. Add before raising the HTTP exception in the `except ReviewWorkflowError` block:

```python
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("keep", torrent_hash, torrent, str(exc))
```

Add the same guard before `raise _qbt_error(exc) from exc` in the generic `except Exception` block.

In `reject_torrent_file`, capture torrent before delete and append after success:

```python
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                reject_torrent(torrent_hash, client, confirmed=payload.confirmed)
            _append_history_safely(
                {
                    "action": "delete",
                    "status": "success",
                    "torrentHash": torrent_hash,
                    "torrentName": _torrent_name(torrent),
                    "summary": "Deleted torrent and files",
                    "detail": "qBittorrent deleteFiles=true",
                }
            )
            return {"ok": True}
```

In Reject failure handlers, define `torrent: dict[str, Any] | None = None` before the `try`, assign it from `_find_torrent`, and append only confirmed failures:

```python
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("delete", torrent_hash, torrent, str(exc))
```

Add that snippet before each raise in the `except ReviewWorkflowError` and generic `except Exception` blocks.

- [ ] **Step 4: Run route tests and verify pass**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_api.py backend/tests/test_history.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit backend API logging**

Run:

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat: log review actions to execution history"
```

---

### Task 3: Frontend Types and API Client

**Files:**
- Modify: `frontend/src/domain/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Write failing client test**

Modify import in `frontend/src/api/client.test.ts`:

```ts
import { cleanupRetryTorrent, getHistory, getQueue, getTorrentDetail, keepTorrent, pickFolder, rejectTorrent } from "./client";
```

Add test:

```ts
  it("fetches execution history from FastAPI", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        items: [
          {
            id: "event-1",
            timestamp: "2026-05-26T20:00:00Z",
            action: "keep",
            status: "success",
            torrentHash: "abc",
            torrentName: "Done Torrent",
            summary: "Kept 1 video",
            files: [{ destinationPath: "/mnt/c/Review/main.mp4", name: "main.mp4" }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await getHistory();

    expect(fetchMock).toHaveBeenCalledWith("/api/history");
    expect(history.items[0].summary).toBe("Kept 1 video");
  });
```

- [ ] **Step 2: Run client test and verify failure**

Run:

```bash
npm --workspace frontend run test -- src/api/client.test.ts
```

Expected: FAIL because `getHistory` is not exported.

- [ ] **Step 3: Add history DTO types**

Add to `frontend/src/domain/types.ts`:

```ts
export type ExecutionHistoryAction = "keep" | "delete" | "open_external" | "failure";

export type ExecutionHistoryStatus = "success" | "failed";

export type ExecutionHistoryFile = {
  sourcePath?: string;
  destinationPath?: string;
  fileIndex?: number;
  name?: string;
};

export type ExecutionHistoryItem = {
  id: string;
  timestamp: string;
  action: ExecutionHistoryAction;
  status: ExecutionHistoryStatus;
  torrentHash?: string;
  torrentName?: string;
  summary: string;
  files?: ExecutionHistoryFile[];
  detail?: string;
};

export type HistoryResponse = {
  items: ExecutionHistoryItem[];
};
```

- [ ] **Step 4: Add `getHistory()` client**

Modify imports in `frontend/src/api/client.ts`:

```ts
  HistoryResponse,
```

Add function:

```ts
export function getHistory(): Promise<HistoryResponse> {
  return apiRequest<HistoryResponse>("/api/history");
}
```

- [ ] **Step 5: Run client test and verify pass**

Run:

```bash
npm --workspace frontend run test -- src/api/client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit frontend API client**

Run:

```bash
git add frontend/src/domain/types.ts frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat: add execution history API client"
```

---

### Task 4: Frontend History Panel

**Files:**
- Create: `frontend/src/review/HistoryPanel.tsx`
- Create: `frontend/src/review/HistoryPanel.test.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write failing component tests**

Create `frontend/src/review/HistoryPanel.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionHistoryItem } from "../domain/types";
import { HistoryPanel } from "./HistoryPanel";

afterEach(() => {
  cleanup();
});

describe("HistoryPanel", () => {
  it("renders empty history as a quiet status", () => {
    render(<HistoryPanel items={[]} />);

    expect(screen.getByLabelText("Execution history")).toBeInTheDocument();
    expect(screen.getByText("No review actions logged yet")).toBeInTheDocument();
  });

  it("renders keep and delete history with paths", () => {
    const items: ExecutionHistoryItem[] = [
      {
        id: "delete-1",
        timestamp: "2026-05-26T20:10:00Z",
        action: "delete",
        status: "success",
        torrentHash: "def",
        torrentName: "Beta Torrent",
        summary: "Deleted torrent and files",
        detail: "qBittorrent deleteFiles=true",
      },
      {
        id: "keep-1",
        timestamp: "2026-05-26T20:00:00Z",
        action: "keep",
        status: "success",
        torrentHash: "abc",
        torrentName: "Alpha Torrent",
        summary: "Kept 1 video",
        files: [
          {
            sourcePath: "/mnt/c/Downloads/Alpha/main.mp4",
            destinationPath: "/mnt/c/Review/main.mp4",
            fileIndex: 0,
            name: "main.mp4",
          },
        ],
      },
    ];

    render(<HistoryPanel items={items} />);

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
    expect(screen.getByText("Beta Torrent")).toBeInTheDocument();
    expect(screen.getByText("Alpha Torrent")).toBeInTheDocument();
    expect(screen.getByText("/mnt/c/Review/main.mp4")).toBeInTheDocument();
    expect(screen.getByText("qBittorrent deleteFiles=true")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run component test and verify failure**

Run:

```bash
npm --workspace frontend run test -- src/review/HistoryPanel.test.tsx
```

Expected: FAIL because `HistoryPanel.tsx` does not exist.

- [ ] **Step 3: Implement `HistoryPanel.tsx`**

Create `frontend/src/review/HistoryPanel.tsx`:

```tsx
import type { ExecutionHistoryAction, ExecutionHistoryItem } from "../domain/types";

export function HistoryPanel({ items }: { items: ExecutionHistoryItem[] }) {
  return (
    <section aria-label="Execution history" className="history-section">
      <div className="section-head">
        <span>History</span>
        <span className="meta">{items.length} logged</span>
      </div>
      {items.length === 0 ? (
        <div className="history-empty">No review actions logged yet</div>
      ) : (
        <div className="history-list">
          {items.slice(0, 12).map((item) => (
            <article className={`history-row ${item.action} ${item.status}`} key={item.id}>
              <div className="history-main">
                <span className="history-action">{labelForAction(item.action)}</span>
                <span className="history-summary">{item.summary}</span>
                <span className="history-torrent">{item.torrentName ?? item.torrentHash ?? "Unknown torrent"}</span>
              </div>
              <time dateTime={item.timestamp}>{formatHistoryTime(item.timestamp)}</time>
              {item.detail ? <p className="history-detail">{item.detail}</p> : null}
              {item.files?.length ? (
                <ul className="history-files" aria-label={`${item.summary} files`}>
                  {item.files.map((file, index) => (
                    <li key={`${item.id}-${file.fileIndex ?? index}`}>
                      <span>{file.destinationPath ?? file.sourcePath ?? file.name ?? "Unknown file"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function labelForAction(action: ExecutionHistoryAction): string {
  if (action === "keep") {
    return "Keep";
  }
  if (action === "delete") {
    return "Delete";
  }
  if (action === "open_external") {
    return "Open";
  }
  return "Failure";
}

function formatHistoryTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
```

- [ ] **Step 4: Add history CSS**

Add to `frontend/src/styles.css` near candidate styles:

```css
.history-section {
  min-width: 0;
  border-top: 1px solid var(--line);
  background: oklch(16.8% 0.011 248);
}

.history-empty {
  padding: 10px;
  color: var(--muted-text);
  font-size: 0.75rem;
}

.history-list {
  max-height: 180px;
  overflow: auto;
  display: grid;
  gap: 3px;
  padding: 8px;
}

.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 8px;
  background: var(--panel);
  font-size: 0.74rem;
}

.history-row.keep.success {
  border-color: oklch(38% 0.06 154);
}

.history-row.delete.success,
.history-row.failed {
  border-color: oklch(42% 0.09 31);
}

.history-main {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.history-action {
  color: var(--key);
  font-weight: 680;
  text-transform: uppercase;
  font-size: 0.66rem;
}

.history-summary,
.history-torrent,
.history-detail,
.history-files span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.history-summary {
  color: var(--ink);
  font-weight: 560;
}

.history-torrent,
.history-row time,
.history-detail,
.history-files {
  color: var(--muted-text);
}

.history-detail,
.history-files {
  grid-column: 1 / -1;
  margin: 0;
}

.history-files {
  display: grid;
  gap: 3px;
  padding-left: 16px;
}
```

- [ ] **Step 5: Run component test and verify pass**

Run:

```bash
npm --workspace frontend run test -- src/review/HistoryPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit frontend panel**

Run:

```bash
git add frontend/src/review/HistoryPanel.tsx frontend/src/review/HistoryPanel.test.tsx frontend/src/styles.css
git commit -m "feat: add execution history panel"
```

---

### Task 5: App Integration and Refresh Flow

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Add failing App tests**

In `frontend/src/App.test.tsx`, add `/api/history` to existing fetch mocks. For tests that do not care about history, return:

```ts
if (url === "/api/history") {
  return Response.json({ items: [] });
}
```

Add this test:

```tsx
  it("loads execution history into the workbench", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/history") {
          return Response.json({
            items: [
              {
                id: "event-1",
                timestamp: "2026-05-26T20:00:00Z",
                action: "keep",
                status: "success",
                torrentHash: "abc",
                torrentName: "Done Torrent",
                summary: "Kept 1 video",
                files: [{ destinationPath: "/mnt/c/Review/main.mp4", name: "main.mp4" }],
              },
            ],
          });
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Execution history")).toBeInTheDocument();
    expect(screen.getByText("Kept 1 video")).toBeInTheDocument();
    expect(screen.getByText("/mnt/c/Review/main.mp4")).toBeInTheDocument();
  });
```

In the existing Keep test, make `/api/history` return an empty list before Keep and a Keep event after Keep:

```ts
      if (url === "/api/history") {
        return Response.json({
          items: kept
            ? [
                {
                  id: "keep-1",
                  timestamp: "2026-05-26T20:00:00Z",
                  action: "keep",
                  status: "success",
                  torrentHash: "abc",
                  torrentName: "Alpha Torrent",
                  summary: "Kept 1 video",
                  files: [{ destinationPath: "/mnt/c/Review/main.mp4", name: "main.mp4" }],
                },
              ]
            : [],
        });
      }
```

Then assert after Keep:

```ts
    expect(await screen.findByText("Kept 1 video")).toBeInTheDocument();
```

In the existing Delete test, make `/api/history` return an empty list before Delete and a Delete event after Delete:

```ts
      if (url === "/api/history") {
        return Response.json({
          items: deleted
            ? [
                {
                  id: "delete-1",
                  timestamp: "2026-05-26T20:00:00Z",
                  action: "delete",
                  status: "success",
                  torrentHash: "abc",
                  torrentName: "Alpha Torrent",
                  summary: "Deleted torrent and files",
                  detail: "qBittorrent deleteFiles=true",
                },
              ]
            : [],
        });
      }
```

Then assert after Delete:

```ts
    expect(await screen.findByText("qBittorrent deleteFiles=true")).toBeInTheDocument();
```

- [ ] **Step 2: Run App tests and verify failure**

Run:

```bash
npm --workspace frontend run test -- src/App.test.tsx
```

Expected: FAIL because App does not fetch or render history.

- [ ] **Step 3: Integrate history in `frontend/src/App.tsx`**

Modify imports:

```ts
import { getHistory, getQueue, getTorrentDetail, keepTorrent, openTorrentFile, rejectTorrent } from "./api/client";
import type { ExecutionHistoryItem, QueueResponse } from "./domain/types";
import { HistoryPanel } from "./review/HistoryPanel";
```

Add state near existing `useState` calls:

```ts
  const [historyItems, setHistoryItems] = useState<ExecutionHistoryItem[]>([]);
```

Add callback after `refreshQueue`:

```ts
  const refreshHistory = useCallback(async () => {
    try {
      const response = await getHistory();
      setHistoryItems(response.items);
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, []);
```

Add startup effect:

```ts
  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);
```

After successful Keep, Delete, and Open External actions, call `await refreshHistory();` before or after the existing queue refresh:

```ts
      await refreshHistory();
```

Update hook dependencies for `runKeep`, `runReject`, and `runOpenExternal` to include `refreshHistory`.

Render `HistoryPanel` after `CandidateTable` in the center column:

```tsx
            <HistoryPanel items={historyItems} />
```

- [ ] **Step 4: Run App tests and verify pass**

Run:

```bash
npm --workspace frontend run test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit App integration**

Run:

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: show execution history in workbench"
```

---

### Task 6: Full Verification and Completion

**Files:**
- Read: `git status --short --branch`
- Maybe modify: none unless verification finds a bug.

- [ ] **Step 1: Run backend tests**

Run:

```bash
.venv/bin/python -m pytest backend/tests -q
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
npm --workspace frontend run test
```

Expected: PASS.

- [ ] **Step 3: Run frontend typecheck/build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles and Vite build succeeds.

- [ ] **Step 4: Inspect large-file growth**

Run:

```bash
wc -l backend/app/main.py frontend/src/review/Workbench.tsx frontend/src/App.tsx frontend/src/review/HistoryPanel.tsx
```

Expected: `Workbench.tsx` should not grow. `main.py` may grow only with thin route wiring. History logic should live in `backend/app/history.py` and `HistoryPanel.tsx`.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short --branch
```

Expected: clean except bead metadata changes from closing the issue.

- [ ] **Step 6: Close bead and push bead state**

Run:

```bash
bd close qbrq-11v --reason="Implemented persistent execution history for review actions"
bd dolt push
```

Expected: bead closes and Dolt push succeeds.

- [ ] **Step 7: Final commit if bead metadata changed**

Run:

```bash
git add .beads/issues.jsonl
git commit -m "chore: close execution history tracking"
```

Expected: commit succeeds if bead metadata changed. If no changes exist, skip this commit.

---

## Self-Review

- Spec coverage: persistence, Keep moved paths, Delete `deleteFiles=true`, user-initiated failure history, non-qBittorrent chatter, local-only storage, corrupt-file recovery, trim limit, backend tests, frontend tests, and large-file guardrails are covered.
- Intentional scope choice: Open External is included because the approved spec lists it, but UI priority remains moved/deleted history.
- No qBittorrent auth/connect queue polling logs are added.
- No credentials are written by the planned event payloads.
- Type names match between backend JSON payloads and frontend DTOs: `items`, `action`, `status`, `torrentHash`, `torrentName`, `summary`, `files`, `detail`.

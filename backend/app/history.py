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
            cleaned[key] = [
                _clean_file(file_entry)
                for file_entry in value
                if isinstance(file_entry, dict)
            ]
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

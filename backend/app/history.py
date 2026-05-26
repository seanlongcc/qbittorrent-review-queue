from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4


HISTORY_LIMIT = 500
HISTORY_EVENT_KEYS = {
    "action",
    "status",
    "torrentHash",
    "torrentName",
    "summary",
    "detail",
    "files",
}
HISTORY_STRING_KEYS = {
    "action",
    "status",
    "torrentHash",
    "torrentName",
    "summary",
    "detail",
}
HISTORY_ACTIONS = {"keep", "delete", "open_external", "failure"}
HISTORY_STATUSES = {"success", "failed"}
SECRET_PATTERN = re.compile(
    r"\b(password|token|authorization|cookie)\s*[:=]\s*.*?"
    r"(?=\s+\b(?:password|token|authorization|cookie)\s*[:=]|$)",
    re.IGNORECASE,
)
_HISTORY_LOCK = Lock()


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
    cleaned_items: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        cleaned_item = _clean_loaded_item(item)
        if cleaned_item is not None:
            cleaned_items.append(cleaned_item)
    return cleaned_items


def append_history_event(
    path: str | Path,
    event: dict[str, Any],
    *,
    limit: int = HISTORY_LIMIT,
) -> dict[str, Any]:
    if limit < 1:
        raise ValueError("History limit must be at least 1")
    history_path = Path(path)
    item = {
        **_clean_event(event),
        "id": uuid4().hex,
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    with _HISTORY_LOCK:
        items = [item, *load_history(history_path)][:limit]
        history_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = history_path.with_name(
            f"{history_path.name}.{uuid4().hex}.tmp"
        )
        try:
            temporary_path.write_text(
                json.dumps({"items": items}, indent=2), encoding="utf-8"
            )
            temporary_path.replace(history_path)
        except OSError:
            temporary_path.unlink(missing_ok=True)
            raise
    return item


def _clean_event(event: dict[str, Any]) -> dict[str, Any]:
    cleaned = _clean_public_fields(event)
    if not all(key in cleaned for key in ("action", "status", "summary")):
        raise ValueError("History event requires action, status, and summary")
    if not _has_valid_action_status(cleaned):
        raise ValueError("History event action/status combination is invalid")
    return cleaned


def _clean_loaded_item(item: dict[str, Any]) -> dict[str, Any] | None:
    item_id = item.get("id")
    timestamp = item.get("timestamp")
    if not isinstance(item_id, str) or not item_id:
        return None
    if not isinstance(timestamp, str) or not _is_valid_utc_timestamp(timestamp):
        return None

    cleaned = _clean_public_fields(item)
    if not all(key in cleaned for key in ("action", "status", "summary")):
        return None
    if not _has_valid_action_status(cleaned):
        return None
    return {
        "id": item_id,
        "timestamp": timestamp,
        **cleaned,
    }


def _clean_public_fields(event: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in event.items():
        if key not in HISTORY_EVENT_KEYS:
            continue
        if value is None:
            continue
        if key == "files" and isinstance(value, list):
            files = [
                _clean_file(file_entry)
                for file_entry in value
                if isinstance(file_entry, dict)
            ]
            files = [file_entry for file_entry in files if file_entry]
            if files:
                cleaned[key] = files
            continue
        if key in HISTORY_STRING_KEYS and isinstance(value, str):
            cleaned[key] = _redact_secret_text(value)
    return cleaned


def _clean_file(file_entry: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key in ("sourcePath", "destinationPath", "name"):
        value = file_entry.get(key)
        if isinstance(value, str):
            cleaned[key] = _redact_secret_text(value)
    file_index = file_entry.get("fileIndex")
    if isinstance(file_index, int) and not isinstance(file_index, bool):
        cleaned["fileIndex"] = file_index
    return cleaned


def _has_valid_action_status(item: dict[str, Any]) -> bool:
    action = item.get("action")
    status = item.get("status")
    if action not in HISTORY_ACTIONS or status not in HISTORY_STATUSES:
        return False
    return action != "failure" or status == "failed"


def _is_valid_utc_timestamp(timestamp: str) -> bool:
    if not timestamp.endswith("Z"):
        return False
    try:
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _redact_secret_text(value: str) -> str:
    return SECRET_PATTERN.sub(
        lambda match: f"{match.group(1).lower()}=[redacted]",
        value,
    )

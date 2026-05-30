from __future__ import annotations

from pathlib import Path
from threading import Lock

from backend.app.video_files import count_video_files


_COUNT_FLOORS: dict[str, int] = {}
_COUNT_LOCK = Lock()


def session_folder_count(path: Path) -> int:
    live_count = count_video_files(path)
    with _COUNT_LOCK:
        floor = _COUNT_FLOORS.get(_session_key(path), 0)
    return max(live_count, floor)


def remember_session_folder_count(path: Path, count: int) -> None:
    key = _session_key(path)
    with _COUNT_LOCK:
        _COUNT_FLOORS[key] = max(_COUNT_FLOORS.get(key, 0), count)


def _session_key(path: Path) -> str:
    return str(path.resolve(strict=False))

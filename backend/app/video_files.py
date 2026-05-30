from __future__ import annotations

from pathlib import Path


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".wmv", ".ts", ".m2ts"}


def is_video_name(name: str) -> bool:
    return Path(name).suffix.lower() in VIDEO_EXTENSIONS


def count_video_files(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for item in path.iterdir() if item.is_file() and is_video_name(item.name))

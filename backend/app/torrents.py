from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.app.config import AppSettings
from backend.app.paths import resolve_file_path


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".wmv", ".ts", ".m2ts"}


def is_video_name(name: str) -> bool:
    return Path(name).suffix.lower() in VIDEO_EXTENSIONS


def _file_index(file_entry: dict[str, Any], fallback: int = 0) -> int:
    return int(file_entry.get("index", fallback))


def split_video_candidates(files: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    candidates: list[dict[str, Any]] = []
    junk: list[dict[str, Any]] = []
    for fallback, file_entry in enumerate(files):
        name = str(file_entry.get("name") or "")
        size = int(file_entry.get("size") or 0)
        item = {"fileIndex": _file_index(file_entry, fallback), "name": Path(name).name, "sizeBytes": size}
        if is_video_name(name):
            candidates.append(
                {
                    **item,
                    "extension": Path(name).suffix.lower().lstrip("."),
                    "relativePath": name,
                    "playable": Path(name).suffix.lower() in {".mp4", ".webm", ".m4v"},
                }
            )
        else:
            junk.append(item)
    candidates.sort(key=lambda candidate: candidate["sizeBytes"], reverse=True)
    return candidates, junk


def queue_item(torrent: dict[str, Any]) -> dict[str, Any]:
    return {
        "hash": torrent["hash"],
        "name": torrent.get("name") or torrent["hash"],
        "status": "completed",
        "progress": torrent.get("progress", 1),
        "totalSizeBytes": int(torrent.get("size") or torrent.get("total_size") or 0),
        "savePath": torrent.get("save_path") or torrent.get("savePath") or "",
        "contentPath": torrent.get("content_path") or torrent.get("contentPath") or "",
    }


def build_torrent_detail(
    torrent: dict[str, Any],
    files: list[dict[str, Any]],
    settings: AppSettings,
) -> dict[str, Any]:
    candidates, junk = split_video_candidates(files)
    by_index = {_file_index(file_entry, fallback): file_entry for fallback, file_entry in enumerate(files)}
    for candidate in candidates:
        resolved = resolve_file_path(torrent, by_index[candidate["fileIndex"]], settings)
        candidate["path"] = str(resolved.wsl_path)
        candidate["windowsPath"] = resolved.windows_path
    return {**queue_item(torrent), "candidates": candidates, "junkFiles": junk}


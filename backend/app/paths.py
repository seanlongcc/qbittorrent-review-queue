from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from backend.app.config import AppSettings


@dataclass(frozen=True)
class ResolvedPath:
    windows_path: str
    wsl_path: Path


def _normalize_windows(value: str) -> str:
    return value.replace("/", "\\").rstrip("\\")


def is_windows_absolute_path(value: str) -> bool:
    return len(value) >= 3 and value[1] == ":" and value[2] in ("\\", "/")


def map_windows_drive_to_wsl(windows_path: str) -> Path:
    candidate = _normalize_windows(windows_path)
    drive = candidate[0].lower()
    relative = candidate[3:]
    mount_root = Path(os.getenv("QBRQ_WSL_MOUNT_ROOT", "/mnt"))
    result = mount_root / drive
    if relative:
        result = result.joinpath(*PureWindowsPath(relative).parts)
    return result


def local_filesystem_path(value: str) -> Path:
    if is_windows_absolute_path(value):
        return map_windows_drive_to_wsl(value)
    return Path(value)


def map_windows_to_wsl(windows_path: str, settings: AppSettings) -> Path:
    root = _normalize_windows(settings.windows_download_root)
    candidate = _normalize_windows(windows_path)
    if candidate.lower() == root.lower():
        relative = ""
    elif candidate.lower().startswith(root.lower() + "\\"):
        relative = candidate[len(root) + 1 :]
    else:
        raise ValueError(f"Windows path is outside configured root: {windows_path}")

    result = Path(settings.wsl_download_root)
    if relative:
        result = result.joinpath(*PureWindowsPath(relative).parts)
    return result


def map_wsl_to_windows(wsl_path: Path, settings: AppSettings) -> str:
    root = Path(settings.wsl_download_root)
    relative = wsl_path.resolve().relative_to(root.resolve())
    return str(PureWindowsPath(settings.windows_download_root, *relative.parts))


def resolve_file_path(torrent: dict[str, Any], file_entry: dict[str, Any], settings: AppSettings) -> ResolvedPath:
    save_path = str(torrent.get("save_path") or torrent.get("savePath") or torrent.get("content_path") or "")
    relative_name = str(file_entry.get("name") or "")
    windows_path = str(PureWindowsPath(save_path, *PureWindowsPath(relative_name).parts))
    return ResolvedPath(windows_path=windows_path, wsl_path=map_windows_to_wsl(windows_path, settings))

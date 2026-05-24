from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from fastapi.responses import FileResponse

from backend.app.config import AppSettings
from backend.app.paths import resolve_file_path


def file_response_for(torrent: dict[str, Any], file_entry: dict[str, Any], settings: AppSettings) -> FileResponse:
    resolved = resolve_file_path(torrent, file_entry, settings)
    if not resolved.wsl_path.exists() or not resolved.wsl_path.is_file():
        raise FileNotFoundError(str(resolved.wsl_path))
    return FileResponse(resolved.wsl_path)


def open_windows_default(windows_path: str) -> None:
    subprocess.Popen(["cmd.exe", "/c", "start", "", windows_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


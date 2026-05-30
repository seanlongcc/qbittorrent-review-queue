from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field

from backend.app.paths import local_filesystem_path
from backend.app.session_count import session_folder_count


class AppSettings(BaseModel):
    qbt_base_url: str = "http://localhost:8080"
    qbt_username: str = "admin"
    qbt_password: str = ""
    windows_download_root: str = "C:\\Downloads"
    wsl_download_root: str = "/mnt/c/Downloads"
    session_folder: str = "/mnt/c/Users/Example/Videos/ReviewSession01"
    session_folder_limit: int = 40
    config_local_path: str = "config.local.json"
    connected: bool = False


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    qbtBaseUrl: str | None = None
    qbtUsername: str | None = None
    qbtPassword: str | None = None
    windowsDownloadRoot: str | None = None
    wslDownloadRoot: str | None = None
    sessionFolder: str | None = None
    sessionFolderLimit: int | None = Field(default=None, ge=1)


ENV_TO_FIELD = {
    "QBT_BASE_URL": "qbt_base_url",
    "QBT_USERNAME": "qbt_username",
    "QBT_PASSWORD": "qbt_password",
    "WINDOWS_DOWNLOAD_ROOT": "windows_download_root",
    "WSL_DOWNLOAD_ROOT": "wsl_download_root",
    "SESSION_FOLDER": "session_folder",
    "SESSION_FOLDER_LIMIT": "session_folder_limit",
    "CONFIG_LOCAL_PATH": "config_local_path",
}

LOCAL_TO_FIELD = {
    "qbtBaseUrl": "qbt_base_url",
    "qbtUsername": "qbt_username",
    "qbtPassword": "qbt_password",
    "windowsDownloadRoot": "windows_download_root",
    "wslDownloadRoot": "wsl_download_root",
    "sessionFolder": "session_folder",
    "sessionFolderLimit": "session_folder_limit",
}

FIELD_TO_PUBLIC = {
    "qbt_base_url": "qbtBaseUrl",
    "qbt_username": "qbtUsername",
    "windows_download_root": "windowsDownloadRoot",
    "wsl_download_root": "wslDownloadRoot",
    "session_folder": "sessionFolder",
    "session_folder_limit": "sessionFolderLimit",
}


def _env_values() -> dict[str, Any]:
    dotenv = dotenv_values(".env")
    values: dict[str, Any] = {}
    for env_key, field in ENV_TO_FIELD.items():
        raw = os.getenv(env_key, dotenv.get(env_key))
        if raw in (None, ""):
            continue
        values[field] = int(raw) if field == "session_folder_limit" else raw
    return values


def _config_path(values: dict[str, Any] | None = None) -> Path:
    source = values or {}
    return Path(str(source.get("config_local_path") or os.getenv("CONFIG_LOCAL_PATH") or "config.local.json"))


def _local_values(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {LOCAL_TO_FIELD[key]: value for key, value in raw.items() if key in LOCAL_TO_FIELD}


def load_settings() -> AppSettings:
    env = _env_values()
    path = _config_path(env)
    merged = {**env, **_local_values(path), "config_local_path": str(path)}
    return AppSettings(**merged)


def public_settings(settings: AppSettings) -> dict[str, Any]:
    data = {
        public_key: getattr(settings, field)
        for field, public_key in FIELD_TO_PUBLIC.items()
    }
    data["folderCount"] = session_folder_count(local_filesystem_path(settings.session_folder))
    data["passwordConfigured"] = bool(settings.qbt_password)
    data["connected"] = settings.connected
    return data


def save_settings(update: SettingsUpdate) -> AppSettings:
    settings = load_settings()
    path = Path(settings.config_local_path)
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    incoming = update.model_dump(exclude_none=True)
    existing.update(incoming)
    path.write_text(json.dumps(existing, indent=2, sort_keys=True), encoding="utf-8")
    return load_settings()

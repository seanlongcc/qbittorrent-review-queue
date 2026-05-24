from __future__ import annotations

import json

from backend.app.config import AppSettings, SettingsUpdate, load_settings, public_settings, save_settings


def test_local_settings_override_env_and_redact_password(tmp_path, monkeypatch):
    config_path = tmp_path / "config.local.json"
    config_path.write_text(
        json.dumps({"qbtBaseUrl": "http://local:8080", "qbtPassword": "local-secret"}),
        encoding="utf-8",
    )
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))
    monkeypatch.setenv("QBT_BASE_URL", "http://env:8080")
    monkeypatch.setenv("QBT_USERNAME", "env-user")
    monkeypatch.setenv("QBT_PASSWORD", "env-secret")

    settings = load_settings()
    response = public_settings(settings)

    assert settings.qbt_base_url == "http://local:8080"
    assert settings.qbt_password == "local-secret"
    assert response["qbtBaseUrl"] == "http://local:8080"
    assert response["passwordConfigured"] is True
    assert "qbtPassword" not in response


def test_save_settings_updates_config_local_without_password_echo(tmp_path, monkeypatch):
    config_path = tmp_path / "config.local.json"
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))

    saved = save_settings(
        SettingsUpdate(
            qbtBaseUrl="http://localhost:8080",
            qbtUsername="admin",
            qbtPassword="secret",
            windowsDownloadRoot="C:\\Downloads",
            wslDownloadRoot="/mnt/c/Downloads",
            sessionFolder="/mnt/c/Review",
            sessionFolderLimit=40,
        )
    )

    raw = json.loads(config_path.read_text(encoding="utf-8"))
    response = public_settings(saved)

    assert raw["qbtPassword"] == "secret"
    assert response["passwordConfigured"] is True
    assert "qbtPassword" not in response


def test_public_settings_counts_windows_session_folder_via_wsl_mount(tmp_path, monkeypatch):
    mount_root = tmp_path / "mnt"
    session = mount_root / "c" / "Users" / "seanl" / "Desktop" / "Review"
    session.mkdir(parents=True)
    (session / "kept.mp4").write_text("video", encoding="utf-8")
    (session / "notes.txt").write_text("notes", encoding="utf-8")
    monkeypatch.setenv("QBRQ_WSL_MOUNT_ROOT", str(mount_root))
    settings = AppSettings(session_folder="C:\\Users\\seanl\\Desktop\\Review")

    response = public_settings(settings)

    assert response["sessionFolder"] == "C:\\Users\\seanl\\Desktop\\Review"
    assert response["folderCount"] == 1


def test_app_settings_defaults_to_qbittorrent_localhost(monkeypatch):
    monkeypatch.delenv("QBT_BASE_URL", raising=False)

    settings = AppSettings()

    assert settings.qbt_base_url == "http://localhost:8080"

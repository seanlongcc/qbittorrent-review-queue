from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.cleanup import clear_cleanup_failures
from backend.app.main import create_app
from backend.app.system_dialog import FolderSelectionCancelled


def test_health_and_public_settings_do_not_expose_password(monkeypatch, tmp_path):
    clear_cleanup_failures()
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(tmp_path / "config.local.json"))
    monkeypatch.setenv("QBT_PASSWORD", "secret")
    client = TestClient(create_app())

    assert client.get("/api/health").json() == {"ok": True}

    response = client.get("/api/settings")

    assert response.status_code == 200
    assert response.json()["passwordConfigured"] is True
    assert "qbtPassword" not in response.json()


def test_pick_folder_endpoint_returns_selected_windows_path(monkeypatch):
    clear_cleanup_failures()
    monkeypatch.setattr(
        "backend.app.main.pick_windows_folder",
        lambda *, title, initial_path: f"{title}|{initial_path}",
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/system/pick-folder",
        json={"title": "Choose output", "initialPath": "C:\\Users\\seanl\\Desktop"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "path": "Choose output|C:\\Users\\seanl\\Desktop",
        "cancelled": False,
    }


def test_pick_folder_endpoint_reports_cancelled_selection(monkeypatch):
    clear_cleanup_failures()

    def cancel_pick(*, title, initial_path):
        raise FolderSelectionCancelled("cancelled")

    monkeypatch.setattr("backend.app.main.pick_windows_folder", cancel_pick)
    client = TestClient(create_app())

    response = client.post("/api/system/pick-folder", json={"title": "Choose output"})

    assert response.status_code == 200
    assert response.json() == {"path": None, "cancelled": True}


def test_keep_all_video_candidates_does_not_require_confirmation_for_junk(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    source = show / "main.mkv"
    source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(
        files=[
            {"index": 0, "name": "main.mkv", "size": 100, "progress": 1},
            {"index": 1, "name": "readme.nfo", "size": 1, "progress": 1},
        ]
    )
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert response.status_code == 200
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == [("abc", True)]


def test_keep_rejects_non_video_file_indexes(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "readme.nfo").write_text("notes", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 1, "name": "readme.nfo", "size": 1, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [1], "confirmed": True})

    assert response.status_code == 400
    assert "not a video candidate" in response.json()["detail"]
    assert fake_qbt.deleted == []


def test_keep_requires_confirmation_for_unmarked_video_candidates(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    (show / "extra.mp4").write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(
        files=[
            {"index": 0, "name": "main.mkv", "size": 100, "progress": 1},
            {"index": 2, "name": "extra.mp4", "size": 50, "progress": 1},
        ]
    )
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert response.status_code == 409
    assert response.json()["detail"] == "Keep requires confirmation"
    assert fake_qbt.deleted == []


def test_keep_uses_windows_session_folder_through_wsl_mount(monkeypatch, tmp_path):
    clear_cleanup_failures()
    mount_root = tmp_path / "mnt"
    downloads = mount_root / "c" / "Downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    session = mount_root / "c" / "Users" / "seanl" / "Desktop" / "Review"
    session.mkdir(parents=True)
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, "C:\\Users\\seanl\\Desktop\\Review", fake_qbt)
    monkeypatch.setenv("QBRQ_WSL_MOUNT_ROOT", str(mount_root))
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert response.status_code == 200
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == [("abc", True)]


def test_keep_cleanup_failure_becomes_attention_and_retry_is_explicit(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    fake_qbt.fail_delete = True
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    keep_response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert keep_response.status_code == 202
    assert keep_response.json()["cleanupFailed"] is True
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == [("abc", True)]

    queue_response = client.get("/api/queue")
    queue_body = queue_response.json()
    assert queue_body["torrents"] == []
    assert queue_body["attentionTorrents"][0]["hash"] == "abc"
    assert queue_body["attentionTorrents"][0]["attentionReason"] == "cleanup_failed"

    unconfirmed_retry = client.post("/api/torrents/abc/cleanup-retry", json={"confirmed": False})
    assert unconfirmed_retry.status_code == 409

    fake_qbt.fail_delete = False
    retry_response = client.post("/api/torrents/abc/cleanup-retry", json={"confirmed": True})
    assert retry_response.status_code == 200
    assert retry_response.json() == {"ok": True}
    assert fake_qbt.deleted == [("abc", True), ("abc", True)]
    assert client.get("/api/queue").json()["attentionTorrents"] == []


class FakeQbt:
    def __init__(self, files):
        self.files = files
        self.deleted: list[tuple[str, bool]] = []
        self.fail_delete = False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def completed_torrents(self):
        return [
            {
                "hash": "abc",
                "name": "Show",
                "progress": 1,
                "size": 100,
                "save_path": "C:\\Downloads\\Show",
                "content_path": "C:\\Downloads\\Show",
            }
        ]

    def torrent_files(self, torrent_hash):
        assert torrent_hash == "abc"
        return self.files

    def delete_torrent(self, torrent_hash, *, delete_files):
        self.deleted.append((torrent_hash, delete_files))
        if self.fail_delete:
            raise RuntimeError("cleanup delete failed")


def configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt):
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(tmp_path / "config.local.json"))
    monkeypatch.setenv("WINDOWS_DOWNLOAD_ROOT", "C:\\Downloads")
    monkeypatch.setenv("WSL_DOWNLOAD_ROOT", str(downloads))
    monkeypatch.setenv("SESSION_FOLDER", str(session))
    monkeypatch.setenv("QBT_PASSWORD", "secret")
    monkeypatch.setattr("backend.app.main._qbt", lambda: fake_qbt)

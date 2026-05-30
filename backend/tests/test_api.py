from __future__ import annotations

import json
import re

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


def test_history_endpoint_returns_persisted_items(monkeypatch, tmp_path):
    clear_cleanup_failures()
    config_path = tmp_path / "config.local.json"
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(config_path))
    (tmp_path / "execution-log.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "id": "0" * 32,
                        "timestamp": "2026-05-26T20:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "torrentHash": "abc",
                        "torrentName": "Show",
                        "summary": "Kept 1 video",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    client = TestClient(create_app())

    response = client.get("/api/history")

    assert response.status_code == 200
    assert response.json()["items"][0]["summary"] == "Kept 1 video"


def test_keep_requires_confirmation_before_moving_files(monkeypatch, tmp_path):
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

    assert response.status_code == 409
    assert response.json()["detail"] == "Keep requires confirmation"
    assert source.exists()
    assert not (session / "main.mkv").exists()
    assert fake_qbt.deleted == []


def test_keep_logs_moved_files_after_confirmation(monkeypatch, tmp_path):
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

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    item = read_history_file(tmp_path)[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "keep"
    assert item["status"] == "success"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Kept 1 video"
    assert item["files"] == [
        {
            "sourcePath": str(source),
            "destinationPath": str(session / "main.mkv"),
            "fileIndex": 0,
            "name": "main.mkv",
        }
    ]


def test_keep_succeeds_when_history_append_fails(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    source = show / "main.mkv"
    source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)

    def fail_append(*_args, **_kwargs):
        raise OSError("history write failed")

    monkeypatch.setattr("backend.app.main.append_history_event", fail_append)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    assert response.json()["folderCount"] == 1
    assert not source.exists()
    assert (session / "main.mkv").exists()


def test_unconfirmed_keep_does_not_write_history(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": False})

    assert response.status_code == 409
    assert read_history_file(tmp_path) == []


def test_failed_confirmed_keep_logs_failure_without_success(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "missing.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 409
    items = read_history_file(tmp_path)
    assert len(items) == 1
    item = items[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "keep"
    assert item["status"] == "failed"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Keep failed"
    assert "Marked file is missing" in item["detail"]


def test_keep_moves_marked_files_after_confirmation_without_deleting_torrent(monkeypatch, tmp_path):
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

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    assert response.json()["folderCount"] == 1
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == []


def test_keep_counts_repeated_moves_when_session_folder_scan_lags(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    first_source = show / "main.mkv"
    second_source = show / "bonus.mp4"
    first_source.write_text("video", encoding="utf-8")
    second_source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    visible_session_files = []
    for index in range(16):
        existing = session / f"existing-{index}.mkv"
        existing.write_text("video", encoding="utf-8")
        visible_session_files.append(existing)
    original_iterdir = type(session).iterdir

    def lagging_session_iterdir(path):
        if path == session:
            return iter(visible_session_files)
        return original_iterdir(path)

    monkeypatch.setattr(type(session), "iterdir", lagging_session_iterdir)
    fake_qbt = FakeQbt(
        files=[
            {"index": 0, "name": "main.mkv", "size": 100, "progress": 1},
            {"index": 2, "name": "bonus.mp4", "size": 50, "progress": 1},
        ]
    )
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    first_response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})
    second_response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [2], "confirmed": True})
    settings_response = client.get("/api/settings")

    assert first_response.status_code == 200
    assert first_response.json()["folderCount"] == 17
    assert second_response.status_code == 200
    assert second_response.json()["folderCount"] == 18
    assert settings_response.json()["folderCount"] == 18
    assert (session / "main.mkv").exists()
    assert (session / "bonus.mp4").exists()


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


def test_keep_leaves_unmarked_video_candidates_after_confirmation(monkeypatch, tmp_path):
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

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    assert (session / "main.mkv").exists()
    assert (show / "extra.mp4").exists()
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

    response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert response.status_code == 200
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == []


def test_keep_does_not_create_cleanup_attention_when_qbt_delete_would_fail(monkeypatch, tmp_path):
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

    keep_response = client.post("/api/torrents/abc/keep", json={"fileIndexes": [0], "confirmed": True})

    assert keep_response.status_code == 200
    assert (session / "main.mkv").exists()
    assert fake_qbt.deleted == []

    queue_response = client.get("/api/queue")
    queue_body = queue_response.json()
    assert queue_body["torrents"][0]["hash"] == "abc"
    assert queue_body["attentionTorrents"] == []


def test_unconfirmed_reject_does_not_delete_or_write_history(monkeypatch, tmp_path):
    clear_cleanup_failures()
    monkeypatch.setenv("CONFIG_LOCAL_PATH", str(tmp_path / "config.local.json"))

    def fail_qbt():
        raise AssertionError("qBittorrent should not be touched before delete confirmation")

    monkeypatch.setattr("backend.app.main._qbt", fail_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": False})

    assert response.status_code == 409
    assert response.json()["detail"] == "Delete requires confirmation"
    assert read_history_file(tmp_path) == []


def test_reject_logs_confirmed_delete(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(
        files=[
            {"index": 0, "name": "main.mkv", "size": 100, "progress": 1},
            {"index": 1, "name": "Extras\\trailer.mp4", "size": 20, "progress": 1},
        ]
    )
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 200
    assert fake_qbt.deleted == [("abc", True)]
    item = read_history_file(tmp_path)[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "delete"
    assert item["status"] == "success"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Deleted torrent and 2 files"
    assert item["detail"] == "qBittorrent deleteFiles=true"
    assert item["files"] == [
        {
            "sourcePath": str(downloads / "Show" / "main.mkv"),
            "fileIndex": 0,
            "name": "main.mkv",
        },
        {
            "sourcePath": str(downloads / "Show" / "Extras" / "trailer.mp4"),
            "fileIndex": 1,
            "name": "Extras\\trailer.mp4",
        },
    ]


def test_reject_still_deletes_when_delete_history_file_lookup_fails(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    fake_qbt.fail_files = True
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 200
    assert fake_qbt.deleted == [("abc", True)]
    item = read_history_file(tmp_path)[0]
    assert item["action"] == "delete"
    assert item["status"] == "success"
    assert item["summary"] == "Deleted torrent"
    assert "files" not in item


def test_reject_skips_malformed_delete_history_files(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[object(), {"index": 1, "name": "main.mkv", "size": 100}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 200
    assert fake_qbt.deleted == [("abc", True)]
    item = read_history_file(tmp_path)[0]
    assert item["summary"] == "Deleted torrent and 1 file"
    assert item["files"] == [
        {
            "sourcePath": str(downloads / "Show" / "main.mkv"),
            "fileIndex": 1,
            "name": "main.mkv",
        }
    ]


def test_failed_confirmed_reject_logs_failure(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    fake_qbt.fail_delete = True
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/reject", json={"confirmed": True})

    assert response.status_code == 503
    item = read_history_file(tmp_path)[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "delete"
    assert item["status"] == "failed"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Delete failed"
    assert "cleanup delete failed" in item["detail"]


def test_open_external_logs_selected_file(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    source = show / "main.mkv"
    source.write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    opened: list[str] = []
    monkeypatch.setattr("backend.app.main.open_windows_default", opened.append)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/open", json={"fileIndex": 0})

    assert response.status_code == 200
    assert opened == ["C:\\Downloads\\Show\\main.mkv"]
    item = read_history_file(tmp_path)[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "open_external"
    assert item["status"] == "success"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Opened main.mkv externally"
    assert item["files"][0]["sourcePath"] == str(source)


def test_open_folder_opens_existing_torrent_folder(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    opened: list[str] = []
    monkeypatch.setattr("backend.app.main.open_windows_default", opened.append)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/open-folder")

    assert response.status_code == 200
    assert opened == ["C:\\Downloads\\Show"]
    assert read_history_file(tmp_path) == []
    assert fake_qbt.deleted == []


def test_open_folder_returns_404_when_torrent_folder_is_missing(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    downloads.mkdir()
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)
    opened: list[str] = []
    monkeypatch.setattr("backend.app.main.open_windows_default", opened.append)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/open-folder")

    assert response.status_code == 404
    assert "Torrent folder not found" in response.json()["detail"]
    assert opened == []


def test_failed_open_external_logs_failure(monkeypatch, tmp_path):
    clear_cleanup_failures()
    downloads = tmp_path / "downloads"
    show = downloads / "Show"
    show.mkdir(parents=True)
    (show / "main.mkv").write_text("video", encoding="utf-8")
    session = tmp_path / "session"
    session.mkdir()
    fake_qbt = FakeQbt(files=[{"index": 0, "name": "main.mkv", "size": 100, "progress": 1}])
    configure_review_env(monkeypatch, tmp_path, downloads, session, fake_qbt)

    def fail_open(windows_path):
        raise RuntimeError(f"open failed: {windows_path}")

    monkeypatch.setattr("backend.app.main.open_windows_default", fail_open)
    client = TestClient(create_app())

    response = client.post("/api/torrents/abc/open", json={"fileIndex": 0})

    assert response.status_code == 503
    item = read_history_file(tmp_path)[0]
    assert_generated_history_id(item)
    assert item["timestamp"]
    assert item["action"] == "open_external"
    assert item["status"] == "failed"
    assert item["torrentHash"] == "abc"
    assert item["torrentName"] == "Show"
    assert item["summary"] == "Open external failed"
    assert "open failed" in item["detail"]
    assert "C:\\Downloads\\Show\\main.mkv" in item["detail"]


class FakeQbt:
    def __init__(self, files):
        self.files = files
        self.deleted: list[tuple[str, bool]] = []
        self.fail_delete = False
        self.fail_files = False

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
        if self.fail_files:
            raise RuntimeError("file list failed")
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


def read_history_file(tmp_path):
    path = tmp_path / "execution-log.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["items"]


def assert_generated_history_id(item):
    assert re.fullmatch(r"[0-9a-f]{32}", item["id"])

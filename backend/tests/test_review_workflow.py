from __future__ import annotations

import time
from pathlib import Path

import pytest

from backend.app.review import KeepRequest, ReviewWorkflowError, keep_torrent, reject_torrent


class RecordingQbt:
    def __init__(self):
        self.deleted: list[tuple[str, bool]] = []

    def delete_torrent(self, torrent_hash: str, *, delete_files: bool) -> None:
        self.deleted.append((torrent_hash, delete_files))


def test_keep_moves_marked_files_without_deleting_torrent_leftovers(tmp_path):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("video", encoding="utf-8")
    destination = tmp_path / "session"
    destination.mkdir()

    result = keep_torrent(
        KeepRequest(
            confirmed=True,
            marked_files=[source],
            session_folder=destination,
            existing_count=0,
            session_limit=40,
        ),
    )

    assert result["moved"] == [str(destination / "main.mkv")]
    assert result["folderCount"] == 1
    assert (destination / "main.mkv").exists()
    assert not source.exists()


def test_keep_requires_confirmation_before_moving(tmp_path):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("video", encoding="utf-8")
    destination = tmp_path / "session"
    destination.mkdir()

    with pytest.raises(ReviewWorkflowError, match="confirmation"):
        keep_torrent(
            KeepRequest(
                confirmed=False,
                marked_files=[source],
                session_folder=destination,
                existing_count=0,
                session_limit=40,
            ),
        )

    assert source.exists()
    assert not (destination / "main.mkv").exists()


def test_keep_verifies_destination_by_folder_scan_when_exact_lookup_lags(tmp_path, monkeypatch):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("video", encoding="utf-8")
    destination_folder = tmp_path / "session"
    destination_folder.mkdir()
    destination = destination_folder / "main.mkv"
    original_exists = Path.exists
    destination_exists_checks = 0

    def delayed_destination_exists(path: Path) -> bool:
        nonlocal destination_exists_checks
        if path == destination:
            destination_exists_checks += 1
            return False
        return original_exists(path)

    monkeypatch.setattr(Path, "exists", delayed_destination_exists)

    result = keep_torrent(
        KeepRequest(
            confirmed=True,
            marked_files=[source],
            session_folder=destination_folder,
            existing_count=0,
            session_limit=40,
        ),
    )

    assert result["moved"] == [str(destination)]
    assert result["folderCount"] == 1
    assert any(item.name == destination.name and item.is_file() for item in destination_folder.iterdir())
    assert destination_exists_checks > 0


def test_keep_uses_folder_scan_for_destination_collisions_when_exact_lookup_lags(tmp_path, monkeypatch):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("new video", encoding="utf-8")
    destination_folder = tmp_path / "session"
    destination_folder.mkdir()
    existing_destination = destination_folder / "main.mkv"
    existing_destination.write_text("old video", encoding="utf-8")
    original_exists = Path.exists

    def lagging_exists(path: Path) -> bool:
        if path == existing_destination:
            return False
        return original_exists(path)

    monkeypatch.setattr(Path, "exists", lagging_exists)

    result = keep_torrent(
        KeepRequest(
            confirmed=True,
            marked_files=[source],
            session_folder=destination_folder,
            existing_count=1,
            session_limit=40,
        ),
    )

    assert result["moved"] == [str(destination_folder / "main-2.mkv")]
    assert result["folderCount"] == 2
    assert existing_destination.read_text(encoding="utf-8") == "old video"
    assert (destination_folder / "main-2.mkv").read_text(encoding="utf-8") == "new video"
    assert not source.exists()


def test_keep_returns_quickly_when_destination_visibility_lags_after_move(tmp_path, monkeypatch):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("video", encoding="utf-8")
    destination = tmp_path / "session"
    destination.mkdir()
    monkeypatch.setattr("backend.app.review._destination_file_present", lambda _destination: False)

    started = time.perf_counter()
    result = keep_torrent(
        KeepRequest(
            confirmed=True,
            marked_files=[source],
            session_folder=destination,
            existing_count=0,
            session_limit=40,
        ),
    )

    assert time.perf_counter() - started < 0.5
    assert result["moved"] == [str(destination / "main.mkv")]
    assert result["folderCount"] == 1
    assert not source.exists()


def test_keep_does_not_delete_torrent_when_move_fails(tmp_path):
    with pytest.raises(ReviewWorkflowError):
        keep_torrent(
            KeepRequest(
                confirmed=True,
                marked_files=[tmp_path / "missing.mkv"],
                session_folder=tmp_path,
                existing_count=0,
                session_limit=40,
            ),
        )


def test_keep_blocks_when_session_capacity_would_be_exceeded(tmp_path):
    source = tmp_path / "main.mkv"
    source.write_text("video", encoding="utf-8")

    with pytest.raises(ReviewWorkflowError, match="capacity"):
        keep_torrent(
            KeepRequest(
                confirmed=True,
                marked_files=[source],
                session_folder=tmp_path,
                existing_count=40,
                session_limit=40,
            ),
        )

    assert source.exists()


def test_reject_requires_confirmation_before_delete_files_true():
    qbt = RecordingQbt()

    with pytest.raises(ReviewWorkflowError, match="confirmation"):
        reject_torrent("abc", qbt, confirmed=False)

    reject_torrent("abc", qbt, confirmed=True)

    assert qbt.deleted == [("abc", True)]

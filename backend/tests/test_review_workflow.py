from __future__ import annotations

from pathlib import Path

import pytest

from backend.app.config import AppSettings
from backend.app.review import KeepRequest, ReviewWorkflowError, keep_torrent, reject_torrent


class RecordingQbt:
    def __init__(self):
        self.deleted: list[tuple[str, bool]] = []

    def delete_torrent(self, torrent_hash: str, *, delete_files: bool) -> None:
        self.deleted.append((torrent_hash, delete_files))


def test_keep_moves_marked_files_then_deletes_torrent_leftovers(tmp_path):
    source = tmp_path / "downloads" / "main.mkv"
    source.parent.mkdir()
    source.write_text("video", encoding="utf-8")
    destination = tmp_path / "session"
    destination.mkdir()
    qbt = RecordingQbt()

    result = keep_torrent(
        KeepRequest(
            torrent_hash="abc",
            marked_files=[source],
            session_folder=destination,
            existing_count=0,
            session_limit=40,
        ),
        qbt,
    )

    assert result["moved"] == [str(destination / "main.mkv")]
    assert (destination / "main.mkv").exists()
    assert not source.exists()
    assert qbt.deleted == [("abc", True)]


def test_keep_does_not_delete_torrent_when_move_fails(tmp_path):
    qbt = RecordingQbt()

    with pytest.raises(ReviewWorkflowError):
        keep_torrent(
            KeepRequest(
                torrent_hash="abc",
                marked_files=[tmp_path / "missing.mkv"],
                session_folder=tmp_path,
                existing_count=0,
                session_limit=40,
            ),
            qbt,
        )

    assert qbt.deleted == []


def test_keep_blocks_when_session_capacity_would_be_exceeded(tmp_path):
    source = tmp_path / "main.mkv"
    source.write_text("video", encoding="utf-8")
    qbt = RecordingQbt()

    with pytest.raises(ReviewWorkflowError, match="capacity"):
        keep_torrent(
            KeepRequest(
                torrent_hash="abc",
                marked_files=[source],
                session_folder=tmp_path,
                existing_count=40,
                session_limit=40,
            ),
            qbt,
        )

    assert source.exists()
    assert qbt.deleted == []


def test_reject_requires_confirmation_before_delete_files_true():
    qbt = RecordingQbt()

    with pytest.raises(ReviewWorkflowError, match="confirmation"):
        reject_torrent("abc", qbt, confirmed=False)

    reject_torrent("abc", qbt, confirmed=True)

    assert qbt.deleted == [("abc", True)]


from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.app.history import append_history_event, history_file_path, load_history


def test_history_path_lives_beside_config_local(tmp_path):
    config_path = tmp_path / "nested" / "config.local.json"

    assert history_file_path(config_path) == tmp_path / "nested" / "execution-log.json"


def test_append_history_event_persists_newest_first(tmp_path):
    path = tmp_path / "execution-log.json"

    first = append_history_event(
        path,
        {
            "action": "keep",
            "status": "success",
            "torrentHash": "abc",
            "torrentName": "Show",
            "summary": "Kept 1 video",
            "files": [{"destinationPath": "/mnt/c/Review/main.mkv", "name": "main.mkv"}],
        },
    )
    second = append_history_event(
        path,
        {
            "action": "delete",
            "status": "success",
            "torrentHash": "def",
            "torrentName": "Other",
            "summary": "Deleted torrent and files",
            "detail": "deleteFiles=true",
        },
    )

    items = load_history(path)

    assert [item["id"] for item in items] == [second["id"], first["id"]]
    assert items[0]["timestamp"].endswith("Z")
    assert items[0]["action"] == "delete"
    assert items[1]["files"][0]["destinationPath"] == "/mnt/c/Review/main.mkv"


def test_append_history_event_trims_to_limit(tmp_path):
    path = tmp_path / "execution-log.json"

    for index in range(4):
        append_history_event(
            path,
            {
                "action": "keep",
                "status": "success",
                "torrentHash": str(index),
                "torrentName": f"Torrent {index}",
                "summary": f"Kept {index}",
            },
            limit=3,
        )

    assert [item["torrentHash"] for item in load_history(path)] == ["3", "2", "1"]


def test_append_history_event_does_not_allow_payload_to_override_metadata(tmp_path):
    path = tmp_path / "execution-log.json"

    item = append_history_event(
        path,
        {
            "id": "caller",
            "timestamp": "bad",
            "action": "keep",
            "status": "success",
            "torrentHash": "abc",
            "torrentName": "Show",
            "summary": "Kept 1 video",
        },
    )

    stored_item = load_history(path)[0]

    assert item["id"] != "caller"
    assert item["timestamp"] != "bad"
    assert item["timestamp"].endswith("Z")
    assert stored_item["id"] == item["id"]
    assert stored_item["timestamp"] == item["timestamp"]


def test_append_history_event_cleans_event_payload(tmp_path):
    path = tmp_path / "execution-log.json"

    append_history_event(
        path,
        {
            "action": "keep",
            "status": "success",
            "torrentHash": "abc",
            "torrentName": "Show",
            "summary": "Kept 1 video",
            "detail": None,
            "password": "secret",
            "token": "secret",
            "authorization": "Bearer secret",
            "cookie": "session=secret",
            "debug": "noisy implementation detail",
            "metadata": {"nested": "value"},
            "tags": ["extra"],
            "files": [
                {
                    "sourcePath": "/mnt/c/Downloads/main.mkv",
                    "destinationPath": "/mnt/c/Review/main.mkv",
                    "fileIndex": 2,
                    "name": "main.mkv",
                    "extra": "drop me",
                },
                "invalid",
                {
                    "sourcePath": 123,
                    "destinationPath": 456,
                    "fileIndex": True,
                    "name": 789,
                },
            ],
        },
    )

    item = load_history(path)[0]

    assert "detail" not in item
    assert "password" not in item
    assert "token" not in item
    assert "authorization" not in item
    assert "cookie" not in item
    assert "debug" not in item
    assert "metadata" not in item
    assert "tags" not in item
    assert item["files"] == [
        {
            "sourcePath": "/mnt/c/Downloads/main.mkv",
            "destinationPath": "/mnt/c/Review/main.mkv",
            "fileIndex": 2,
            "name": "main.mkv",
        }
    ]


def test_history_redacts_secret_looking_text_values(tmp_path):
    path = tmp_path / "execution-log.json"

    appended = append_history_event(
        path,
        {
            "action": "keep",
            "status": "success",
            "torrentHash": "hash password=secret",
            "torrentName": "Show token: abc",
            "summary": "password=secret token: abc",
            "detail": "authorization=Bearer xyz cookie=session=abc",
            "files": [
                {
                    "sourcePath": "/tmp/password=secret/main.mkv",
                    "destinationPath": "/review/token: abc/main.mkv",
                    "name": "cookie=session=abc.mkv",
                }
            ],
        },
    )

    assert appended["torrentHash"] == "hash password=[redacted]"
    assert appended["torrentName"] == "Show token=[redacted]"
    assert appended["summary"] == "password=[redacted] token=[redacted]"
    assert appended["detail"] == "authorization=[redacted] cookie=[redacted]"
    assert appended["files"] == [
        {
            "sourcePath": "/tmp/password=[redacted]",
            "destinationPath": "/review/token=[redacted]",
            "name": "cookie=[redacted]",
        }
    ]
    assert load_history(path)[0] == appended


def test_load_history_sanitizes_persisted_items(tmp_path):
    path = tmp_path / "execution-log.json"
    path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "id": "0123456789abcdef0123456789abcdef",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "torrentHash": "abc",
                        "torrentName": "Show",
                        "summary": "Kept 1 video password=secret",
                        "detail": "Moved file token: abc",
                        "password": "secret",
                        "token": "secret",
                        "debug": "noise",
                        "files": [
                            {
                                "sourcePath": "/mnt/c/Downloads/main.mkv",
                                "destinationPath": "/mnt/c/Review/main.mkv",
                                "fileIndex": 1,
                                "name": "main.mkv",
                                "extra": "drop me",
                            },
                            {
                                "sourcePath": 123,
                                "destinationPath": 456,
                                "fileIndex": True,
                                "name": 789,
                            },
                            "invalid",
                        ],
                    },
                    {
                        "id": "bad-action",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "download",
                        "status": "success",
                        "summary": "Bad action",
                    },
                    {
                        "id": "bad-status",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "done",
                        "summary": "Bad status",
                    },
                    {
                        "id": 123,
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Bad id",
                    },
                    {
                        "id": "",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Empty id",
                    },
                    {
                        "id": "password=secret",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Secret id",
                    },
                    {
                        "id": "0123456789ABCDEF0123456789ABCDEF",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Uppercase id",
                    },
                    {
                        "id": "0123456789abcdef0123456789abcdeg",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Nonhex id",
                    },
                    {
                        "id": "0123456789abcdef0123456789abcde",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Short id",
                    },
                    {
                        "id": "0123456789abcdef0123456789abcdef0",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "keep",
                        "status": "success",
                        "summary": "Long id",
                    },
                    {
                        "id": "bad-timestamp",
                        "timestamp": "bad",
                        "action": "keep",
                        "status": "success",
                        "summary": "Bad timestamp",
                    },
                    {
                        "id": "failure-success",
                        "timestamp": "2026-05-26T12:00:00Z",
                        "action": "failure",
                        "status": "success",
                        "summary": "Contradictory state",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )

    assert load_history(path) == [
        {
            "id": "0123456789abcdef0123456789abcdef",
            "timestamp": "2026-05-26T12:00:00Z",
            "action": "keep",
            "status": "success",
            "torrentHash": "abc",
            "torrentName": "Show",
            "summary": "Kept 1 video password=[redacted]",
            "detail": "Moved file token=[redacted]",
            "files": [
                {
                    "sourcePath": "/mnt/c/Downloads/main.mkv",
                    "destinationPath": "/mnt/c/Review/main.mkv",
                    "fileIndex": 1,
                    "name": "main.mkv",
                }
            ],
        }
    ]


def test_append_history_event_rejects_invalid_action_or_status(tmp_path):
    path = tmp_path / "execution-log.json"

    invalid_events = [
        {
            "action": "download",
            "status": "success",
            "summary": "Bad action",
        },
        {
            "action": "keep",
            "status": "done",
            "summary": "Bad status",
        },
        {
            "action": "failure",
            "status": "success",
            "summary": "Contradictory state",
        },
    ]

    for event in invalid_events:
        with pytest.raises(
            ValueError, match="History event action/status combination is invalid"
        ):
            append_history_event(path, event)
        assert not path.exists()
        assert load_history(path) == []


def test_append_history_event_rejects_invalid_limit(tmp_path):
    path = tmp_path / "execution-log.json"
    event = {
        "action": "keep",
        "status": "success",
        "torrentHash": "abc",
        "torrentName": "Show",
        "summary": "Kept 1 video",
    }

    for limit in (0, -1):
        with pytest.raises(ValueError, match="History limit must be at least 1"):
            append_history_event(path, event, limit=limit)


def test_append_history_event_removes_temporary_file_on_replace_failure(
    tmp_path, monkeypatch
):
    path = tmp_path / "execution-log.json"

    def fail_replace(self, target):
        if isinstance(self, Path) and self.name.startswith("execution-log.json."):
            raise OSError("replace failed")
        return original_replace(self, target)

    original_replace = Path.replace
    monkeypatch.setattr(Path, "replace", fail_replace)

    with pytest.raises(OSError, match="replace failed"):
        append_history_event(
            path,
            {
                "action": "keep",
                "status": "success",
                "summary": "Kept 1 video",
            },
        )

    assert not path.exists()
    assert list(tmp_path.glob("execution-log.json.*.tmp")) == []


def test_load_history_recovers_from_missing_or_corrupt_file(tmp_path):
    path = tmp_path / "execution-log.json"

    assert load_history(path) == []

    path.write_text("{not json", encoding="utf-8")

    assert load_history(path) == []

    path.write_text(json.dumps({"items": "not a list"}), encoding="utf-8")

    assert load_history(path) == []

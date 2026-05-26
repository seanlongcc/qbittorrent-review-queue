from __future__ import annotations

import json

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


def test_load_history_recovers_from_missing_or_corrupt_file(tmp_path):
    path = tmp_path / "execution-log.json"

    assert load_history(path) == []

    path.write_text("{not json", encoding="utf-8")

    assert load_history(path) == []

    path.write_text(json.dumps({"items": "not a list"}), encoding="utf-8")

    assert load_history(path) == []

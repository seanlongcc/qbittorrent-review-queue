from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CleanupFailure:
    torrent_hash: str
    name: str
    detail: str
    moved: list[str]


_cleanup_failures: dict[str, CleanupFailure] = {}


def remember_cleanup_failure(
    torrent_hash: str,
    torrent: dict[str, Any],
    *,
    detail: str,
    moved: list[str],
) -> CleanupFailure:
    failure = CleanupFailure(
        torrent_hash=torrent_hash,
        name=str(torrent.get("name") or torrent_hash),
        detail=detail,
        moved=moved,
    )
    _cleanup_failures[torrent_hash] = failure
    return failure


def forget_cleanup_failure(torrent_hash: str) -> None:
    _cleanup_failures.pop(torrent_hash, None)


def cleanup_failure_hashes() -> set[str]:
    return set(_cleanup_failures)


def cleanup_failure_items() -> list[dict[str, Any]]:
    return [
        {
            "hash": failure.torrent_hash,
            "name": failure.name,
            "status": "attention",
            "progress": 1,
            "totalSizeBytes": 0,
            "savePath": "",
            "candidates": [],
            "junkFiles": [],
            "attentionReason": "cleanup_failed",
            "attentionDetail": failure.detail,
            "movedFiles": failure.moved,
        }
        for failure in _cleanup_failures.values()
    ]


def clear_cleanup_failures() -> None:
    _cleanup_failures.clear()

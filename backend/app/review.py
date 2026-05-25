from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


class ReviewWorkflowError(RuntimeError):
    pass


class CleanupFailedError(ReviewWorkflowError):
    def __init__(self, message: str, *, moved: list[Path]):
        super().__init__(message)
        self.moved = moved


class TorrentDeleter(Protocol):
    def delete_torrent(self, torrent_hash: str, *, delete_files: bool) -> None: ...


@dataclass(frozen=True)
class KeepRequest:
    torrent_hash: str
    marked_files: list[Path]
    session_folder: Path
    existing_count: int
    session_limit: int


def _destination_for(source: Path, session_folder: Path) -> Path:
    destination = session_folder / source.name
    if not destination.exists():
        return destination
    stem = source.stem
    suffix = source.suffix
    counter = 2
    while True:
        candidate = session_folder / f"{stem}-{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def keep_torrent(request: KeepRequest, qbt: TorrentDeleter) -> dict[str, list[str]]:
    if not request.marked_files:
        raise ReviewWorkflowError("No marked files to keep")
    if request.existing_count + len(request.marked_files) > request.session_limit:
        raise ReviewWorkflowError("Session folder capacity would be exceeded")
    if not request.session_folder.exists() or not request.session_folder.is_dir():
        raise ReviewWorkflowError("Session folder does not exist")

    moved: list[Path] = []
    for source in request.marked_files:
        if not source.exists() or not source.is_file():
            raise ReviewWorkflowError(f"Marked file is missing: {source}")
        destination = _destination_for(source, request.session_folder)
        shutil.move(str(source), str(destination))
        if not destination.exists():
            raise ReviewWorkflowError(f"Moved file was not verified: {destination}")
        moved.append(destination)

    try:
        qbt.delete_torrent(request.torrent_hash, delete_files=True)
    except Exception as exc:
        raise CleanupFailedError(str(exc), moved=moved) from exc
    return {"moved": [str(path) for path in moved]}


def reject_torrent(torrent_hash: str, qbt: TorrentDeleter, *, confirmed: bool) -> None:
    if not confirmed:
        raise ReviewWorkflowError("Delete requires confirmation")
    qbt.delete_torrent(torrent_hash, delete_files=True)

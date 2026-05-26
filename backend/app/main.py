from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.app.cleanup import (
    cleanup_failure_hashes,
    cleanup_failure_items,
    forget_cleanup_failure,
)
from backend.app.config import SettingsUpdate, load_settings, public_settings, save_settings
from backend.app.history import append_history_event, history_file_path, load_history
from backend.app.media import file_response_for, open_windows_default
from backend.app.paths import local_filesystem_path, resolve_file_path
from backend.app.qbt.client import QbtClient, QbtError
from backend.app.review import KeepRequest, ReviewWorkflowError, keep_torrent, reject_torrent
from backend.app.system_dialog import FolderPickerUnavailable, FolderSelectionCancelled, pick_windows_folder
from backend.app.torrents import build_torrent_detail, is_video_name, queue_item


class KeepPayload(BaseModel):
    fileIndexes: list[int]
    confirmed: bool = False


class RejectPayload(BaseModel):
    confirmed: bool = False


class CleanupRetryPayload(BaseModel):
    confirmed: bool = False


class OpenPayload(BaseModel):
    fileIndex: int


class FolderPickPayload(BaseModel):
    title: str = "Select folder"
    initialPath: str | None = None


def _qbt() -> QbtClient:
    return QbtClient(load_settings())


def _find_torrent(client: QbtClient, torrent_hash: str) -> dict[str, Any]:
    for torrent in client.completed_torrents():
        if torrent.get("hash") == torrent_hash:
            return torrent
    raise HTTPException(status_code=404, detail="Torrent not found")


def _find_file(files: list[dict[str, Any]], file_index: int) -> dict[str, Any]:
    for fallback, file_entry in enumerate(files):
        if int(file_entry.get("index", fallback)) == file_index:
            return file_entry
    raise HTTPException(status_code=404, detail="Torrent file not found")


def _file_map(files: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {int(file_entry.get("index", fallback)): file_entry for fallback, file_entry in enumerate(files)}


def _unique_indexes(indexes: list[int]) -> list[int]:
    unique: list[int] = []
    seen: set[int] = set()
    for index in indexes:
        if index in seen:
            continue
        seen.add(index)
        unique.append(index)
    return unique


def _qbt_error(exc: Exception) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    if isinstance(exc, QbtError):
        return HTTPException(status_code=503, detail=str(exc))
    return HTTPException(status_code=503, detail=f"qBittorrent API unavailable: {exc}")


def _history_path() -> Path:
    return history_file_path(load_settings().config_local_path)


def _append_history_safely(event: dict[str, Any]) -> None:
    try:
        append_history_event(_history_path(), event)
    except Exception:
        return


def _torrent_name(torrent: dict[str, Any] | None) -> str | None:
    if not torrent:
        return None
    name = torrent.get("name")
    return str(name) if name else None


def _append_workflow_failure(
    action: str,
    torrent_hash: str,
    torrent: dict[str, Any] | None,
    detail: str,
) -> None:
    label = "Delete" if action == "delete" else "Keep" if action == "keep" else "Open external"
    _append_history_safely(
        {
            "action": action,
            "status": "failed",
            "torrentHash": torrent_hash,
            "torrentName": _torrent_name(torrent),
            "summary": f"{label} failed",
            "detail": detail,
        }
    )


def create_app() -> FastAPI:
    app = FastAPI(title="Local qBittorrent Review Queue")

    @app.get("/api/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/settings")
    def get_settings() -> dict[str, Any]:
        return public_settings(load_settings())

    @app.post("/api/settings")
    def post_settings(update: SettingsUpdate) -> dict[str, Any]:
        return public_settings(save_settings(update))

    @app.get("/api/history")
    def get_history() -> dict[str, Any]:
        return {"items": load_history(_history_path())}

    @app.post("/api/system/pick-folder")
    def pick_folder(payload: FolderPickPayload) -> dict[str, Any]:
        try:
            return {
                "path": pick_windows_folder(title=payload.title, initial_path=payload.initialPath),
                "cancelled": False,
            }
        except FolderSelectionCancelled:
            return {"path": None, "cancelled": True}
        except FolderPickerUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/queue")
    def get_queue() -> dict[str, Any]:
        try:
            with _qbt() as client:
                torrents = client.completed_torrents()
            settings = load_settings()
            failed_hashes = cleanup_failure_hashes()
            return {
                "torrents": [
                    queue_item(torrent)
                    for torrent in torrents
                    if str(torrent.get("hash") or "") not in failed_hashes
                ],
                "attentionTorrents": cleanup_failure_items(),
                "settings": public_settings(settings.model_copy(update={"connected": True})),
            }
        except Exception as exc:  # qBittorrent failure should leave shell usable.
            settings = load_settings()
            return {
                "torrents": [],
                "attentionTorrents": cleanup_failure_items()
                + [
                    {
                        "hash": "connection",
                        "name": "qBittorrent connection",
                        "status": "attention",
                        "progress": 1,
                        "totalSizeBytes": 0,
                        "savePath": "",
                        "candidates": [],
                        "junkFiles": [],
                        "attentionReason": "auth_failed",
                        "attentionDetail": str(exc),
                    }
                ],
                "settings": public_settings(settings.model_copy(update={"connected": False})),
            }

    @app.get("/api/torrents/{torrent_hash}")
    def get_torrent(torrent_hash: str) -> dict[str, Any]:
        settings = load_settings()
        try:
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                files = client.torrent_files(torrent_hash)
            return build_torrent_detail(torrent, files, settings)
        except Exception as exc:
            raise _qbt_error(exc) from exc

    @app.get("/media/{torrent_hash}/{file_index}")
    def get_media(torrent_hash: str, file_index: int) -> FileResponse:
        settings = load_settings()
        try:
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                file_entry = _find_file(client.torrent_files(torrent_hash), file_index)
            return file_response_for(torrent, file_entry, settings)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise _qbt_error(exc) from exc

    @app.post("/api/torrents/{torrent_hash}/open")
    def open_torrent_file(torrent_hash: str, payload: OpenPayload) -> dict[str, bool]:
        settings = load_settings()
        torrent: dict[str, Any] | None = None
        try:
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                file_entry = _find_file(client.torrent_files(torrent_hash), payload.fileIndex)
            resolved = resolve_file_path(torrent, file_entry, settings)
            open_windows_default(resolved.windows_path)
            _append_history_safely(
                {
                    "action": "open_external",
                    "status": "success",
                    "torrentHash": torrent_hash,
                    "torrentName": _torrent_name(torrent),
                    "summary": f"Opened {file_entry.get('name') or 'file'} externally",
                    "files": [
                        {
                            "sourcePath": str(resolved.wsl_path),
                            "fileIndex": payload.fileIndex,
                            "name": str(file_entry.get("name") or ""),
                        }
                    ],
                }
            )
            return {"ok": True}
        except Exception as exc:
            if torrent is not None:
                _append_workflow_failure("open_external", torrent_hash, torrent, str(exc))
            raise _qbt_error(exc) from exc

    @app.post("/api/torrents/{torrent_hash}/keep")
    def keep_torrent_file(torrent_hash: str, payload: KeepPayload) -> Any:
        settings = load_settings()
        torrent: dict[str, Any] | None = None
        try:
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                files = client.torrent_files(torrent_hash)
                files_by_index = _file_map(files)
                requested_indexes = _unique_indexes(payload.fileIndexes)
                missing_indexes = [index for index in requested_indexes if index not in files_by_index]
                if missing_indexes:
                    raise HTTPException(status_code=404, detail="Torrent file not found")
                video_indexes = {
                    index
                    for index, file_entry in files_by_index.items()
                    if is_video_name(str(file_entry.get("name") or ""))
                }
                invalid_indexes = [index for index in requested_indexes if index not in video_indexes]
                if invalid_indexes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File index {invalid_indexes[0]} is not a video candidate",
                    )
                marked = [files_by_index[index] for index in requested_indexes]
                paths = [resolve_file_path(torrent, file_entry, settings).wsl_path for file_entry in marked]
                session_folder = local_filesystem_path(settings.session_folder)
                existing_count = _count_existing_videos(session_folder)
                result = keep_torrent(
                    KeepRequest(
                        confirmed=payload.confirmed,
                        marked_files=paths,
                        session_folder=session_folder,
                        existing_count=existing_count,
                        session_limit=settings.session_folder_limit,
                    ),
                )
                moved = [str(path) for path in result["moved"]]
                _append_history_safely(
                    {
                        "action": "keep",
                        "status": "success",
                        "torrentHash": torrent_hash,
                        "torrentName": _torrent_name(torrent),
                        "summary": f"Kept {len(moved)} {'video' if len(moved) == 1 else 'videos'}",
                        "files": [
                            {
                                "sourcePath": str(source),
                                "destinationPath": destination,
                                "fileIndex": file_index,
                                "name": str(file_entry.get("name") or ""),
                            }
                            for source, destination, file_index, file_entry in zip(
                                paths, moved, requested_indexes, marked, strict=False
                            )
                        ],
                    }
                )
                return result
        except ReviewWorkflowError as exc:
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("keep", torrent_hash, torrent, str(exc))
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except Exception as exc:
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("keep", torrent_hash, torrent, str(exc))
            raise _qbt_error(exc) from exc

    @app.post("/api/torrents/{torrent_hash}/cleanup-retry")
    def retry_torrent_cleanup(torrent_hash: str, payload: CleanupRetryPayload) -> dict[str, bool]:
        if not payload.confirmed:
            raise HTTPException(status_code=409, detail="Cleanup retry requires confirmation")
        if torrent_hash not in cleanup_failure_hashes():
            raise HTTPException(status_code=404, detail="Cleanup failure not found")
        try:
            with _qbt() as client:
                client.delete_torrent(torrent_hash, delete_files=True)
            forget_cleanup_failure(torrent_hash)
            return {"ok": True}
        except Exception as exc:
            raise _qbt_error(exc) from exc

    @app.post("/api/torrents/{torrent_hash}/reject")
    def reject_torrent_file(torrent_hash: str, payload: RejectPayload) -> dict[str, bool]:
        torrent: dict[str, Any] | None = None
        try:
            with _qbt() as client:
                torrent = _find_torrent(client, torrent_hash)
                reject_torrent(torrent_hash, client, confirmed=payload.confirmed)
            _append_history_safely(
                {
                    "action": "delete",
                    "status": "success",
                    "torrentHash": torrent_hash,
                    "torrentName": _torrent_name(torrent),
                    "summary": "Deleted torrent",
                    "detail": "qBittorrent deleteFiles=true",
                }
            )
            return {"ok": True}
        except ReviewWorkflowError as exc:
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("delete", torrent_hash, torrent, str(exc))
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except Exception as exc:
            if payload.confirmed and torrent is not None:
                _append_workflow_failure("delete", torrent_hash, torrent, str(exc))
            raise _qbt_error(exc) from exc

    dist_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    assets_dir = dist_dir / "assets"
    index_html = dist_dir / "index.html"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False, response_model=None)
    def index():
        if index_html.exists():
            return FileResponse(index_html)
        return {"message": "Frontend build not found. Run npm run build."}

    return app


def _count_existing_videos(path: Path) -> int:
    from backend.app.torrents import is_video_name

    if not path.exists():
        return 0
    return sum(1 for item in path.iterdir() if item.is_file() and is_video_name(item.name))


app = create_app()

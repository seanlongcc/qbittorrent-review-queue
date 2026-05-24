from __future__ import annotations

from pathlib import Path

from backend.app.config import AppSettings
from backend.app.paths import map_windows_to_wsl, resolve_file_path
from backend.app.torrents import build_torrent_detail, split_video_candidates


def test_windows_download_path_maps_to_wsl_root():
    settings = AppSettings(
        windows_download_root="C:\\Downloads",
        wsl_download_root="/mnt/c/Downloads",
    )

    assert (
        map_windows_to_wsl("C:\\Downloads\\Show Name\\main file.mkv", settings)
        == Path("/mnt/c/Downloads/Show Name/main file.mkv")
    )


def test_video_candidates_filter_by_extension_and_sort_largest_first():
    candidates, junk = split_video_candidates(
        [
            {"index": 0, "name": "small.mp4", "size": 100},
            {"index": 1, "name": "main.mkv", "size": 900},
            {"index": 2, "name": "readme.txt", "size": 1},
        ]
    )

    assert [candidate["name"] for candidate in candidates] == ["main.mkv", "small.mp4"]
    assert junk == [{"fileIndex": 2, "name": "readme.txt", "sizeBytes": 1}]


def test_torrent_detail_resolves_paths_without_raw_browser_paths():
    settings = AppSettings(
        windows_download_root="C:\\Downloads",
        wsl_download_root="/mnt/c/Downloads",
    )
    torrent = {
        "hash": "abc",
        "name": "Show",
        "progress": 1,
        "size": 1000,
        "save_path": "C:\\Downloads\\Show",
        "content_path": "C:\\Downloads\\Show",
    }
    files = [{"index": 7, "name": "Season 1/main.mkv", "size": 1000, "progress": 1}]

    detail = build_torrent_detail(torrent, files, settings)

    assert detail["candidates"][0]["fileIndex"] == 7
    assert detail["candidates"][0]["path"] == "/mnt/c/Downloads/Show/Season 1/main.mkv"
    assert resolve_file_path(torrent, files[0], settings).wsl_path == Path(
        "/mnt/c/Downloads/Show/Season 1/main.mkv"
    )


from __future__ import annotations

import httpx

from backend.app.config import AppSettings
from backend.app.qbt.client import QbtClient


def test_qbt_client_logs_in_lists_files_and_deletes_with_delete_files_true():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/api/v2/auth/login":
            return httpx.Response(200, text="Ok.", headers={"set-cookie": "SID=abc; Path=/"})
        if request.url.path == "/api/v2/torrents/info":
            assert request.url.params["filter"] == "completed"
            return httpx.Response(
                200,
                json=[
                    {
                        "hash": "abc",
                        "name": "Done Torrent",
                        "progress": 1,
                        "size": 1200,
                        "save_path": "C:\\Downloads\\Done Torrent",
                        "content_path": "C:\\Downloads\\Done Torrent",
                    }
                ],
            )
        if request.url.path == "/api/v2/torrents/files":
            assert request.url.params["hash"] == "abc"
            return httpx.Response(
                200,
                json=[
                    {"index": 0, "name": "main.mkv", "size": 1000, "progress": 1},
                    {"index": 1, "name": "notes.txt", "size": 200, "progress": 1},
                ],
            )
        if request.url.path == "/api/v2/torrents/delete":
            body = request.content.decode()
            assert "hashes=abc" in body
            assert "deleteFiles=true" in body
            return httpx.Response(200)
        raise AssertionError(f"unexpected request {request.method} {request.url}")

    client = QbtClient(
        AppSettings(qbt_username="admin", qbt_password="secret"),
        transport=httpx.MockTransport(handler),
    )

    assert client.completed_torrents()[0]["hash"] == "abc"
    assert client.torrent_files("abc")[0]["name"] == "main.mkv"
    client.delete_torrent("abc", delete_files=True)

    assert [request.url.path for request in seen].count("/api/v2/auth/login") == 1


def test_qbt_client_falls_back_to_wsl_host_for_localhost_connection():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.host == "localhost":
            raise httpx.ConnectError("refused", request=request)
        assert request.url.host == "host.docker.internal"
        assert request.headers["Host"] == "localhost:8080"
        assert request.headers["Referer"] == "http://localhost:8080"
        if request.url.path == "/api/v2/auth/login":
            return httpx.Response(200, text="Ok.")
        if request.url.path == "/api/v2/torrents/info":
            return httpx.Response(200, json=[])
        raise AssertionError(f"unexpected request {request.method} {request.url}")

    client = QbtClient(
        AppSettings(qbt_base_url="http://localhost:8080", qbt_username="admin", qbt_password="secret"),
        transport=httpx.MockTransport(handler),
    )

    assert client.completed_torrents() == []
    assert [request.url.host for request in seen] == ["localhost", "host.docker.internal", "host.docker.internal"]

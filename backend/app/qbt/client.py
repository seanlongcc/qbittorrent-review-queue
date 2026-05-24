from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from backend.app.config import AppSettings


class QbtError(RuntimeError):
    pass


class QbtClient:
    def __init__(
        self,
        settings: AppSettings,
        *,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._settings = settings
        self._transport = transport
        self._timeout = timeout
        self._public_base_url = settings.qbt_base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self._public_base_url,
            timeout=timeout,
            transport=transport,
            headers={"Referer": self._public_base_url},
        )
        self._logged_in = False

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> QbtClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _ensure_login(self) -> None:
        if self._logged_in:
            return
        response = self._request(
            "POST",
            "/api/v2/auth/login",
            data={"username": self._settings.qbt_username, "password": self._settings.qbt_password},
        )
        if response.status_code == 403:
            raise QbtError("qBittorrent login rejected: IP banned or credentials invalid")
        response.raise_for_status()
        if not response.text.strip().lower().startswith("ok"):
            raise QbtError("qBittorrent login failed")
        self._logged_in = True

    def completed_torrents(self) -> list[dict[str, Any]]:
        self._ensure_login()
        response = self._request("GET", "/api/v2/torrents/info", params={"filter": "completed"})
        response.raise_for_status()
        return list(response.json())

    def torrent_files(self, torrent_hash: str) -> list[dict[str, Any]]:
        self._ensure_login()
        response = self._request("GET", "/api/v2/torrents/files", params={"hash": torrent_hash})
        response.raise_for_status()
        return list(response.json())

    def delete_torrent(self, torrent_hash: str, *, delete_files: bool) -> None:
        self._ensure_login()
        response = self._request(
            "POST",
            "/api/v2/torrents/delete",
            data={"hashes": torrent_hash, "deleteFiles": "true" if delete_files else "false"},
        )
        response.raise_for_status()

    def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            return self._client.request(method, path, **kwargs)
        except httpx.ConnectError:
            fallback = _wsl_host_fallback(self._public_base_url)
            if fallback is None:
                raise
            self._client.close()
            original = urlsplit(self._public_base_url)
            self._client = httpx.Client(
                base_url=fallback,
                timeout=self._timeout,
                transport=self._transport,
                headers={
                    "Referer": self._public_base_url,
                    "Host": original.netloc,
                },
            )
            return self._client.request(method, path, **kwargs)


def _wsl_host_fallback(base_url: str) -> str | None:
    parsed = urlsplit(base_url)
    if parsed.hostname not in {"localhost", "127.0.0.1"}:
        return None
    port = f":{parsed.port}" if parsed.port else ""
    return urlunsplit((parsed.scheme, f"host.docker.internal{port}", "", "", ""))

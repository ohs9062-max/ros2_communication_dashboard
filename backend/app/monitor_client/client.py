"""HTTP client for the localhost-only ROS2 monitor transport."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import httpx


@dataclass
class MonitorResponse:
    status_code: int
    content: bytes
    content_type: str


class MonitorUnavailable(RuntimeError):
    pass


class MonitorClient:
    def __init__(self, base_url: str, timeout_sec: float = 30.0) -> None:
        self.base_url = base_url.rstrip('/')
        self.timeout_sec = timeout_sec

    def request(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        content_type: str | None = None,
    ) -> MonitorResponse:
        headers = {}
        if content_type:
            headers['Content-Type'] = content_type
        request = Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout_sec) as response:
                return MonitorResponse(
                    response.status,
                    response.read(),
                    response.headers.get('Content-Type', 'application/json'),
                )
        except HTTPError as exc:
            return MonitorResponse(
                exc.code,
                exc.read(),
                exc.headers.get('Content-Type', 'application/json'),
            )
        except (URLError, TimeoutError, OSError) as exc:
            raise MonitorUnavailable(f'ROS2 monitor에 연결할 수 없습니다: {exc}') from exc

    async def request_async(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        content_type: str | None = None,
    ) -> MonitorResponse:
        """FastAPI event loop을 차단하지 않고 Monitor에 요청합니다."""
        headers = {'Content-Type': content_type} if content_type else None
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
                response = await client.request(
                    method,
                    self.base_url + path,
                    content=body,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise MonitorUnavailable(f'ROS2 monitor에 연결할 수 없습니다: {exc}') from exc
        return MonitorResponse(
            response.status_code,
            response.content,
            response.headers.get('Content-Type', 'application/json'),
        )

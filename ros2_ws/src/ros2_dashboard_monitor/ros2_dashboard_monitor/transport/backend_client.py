"""Reserved outbound client for monitor-to-backend event delivery."""

from __future__ import annotations

import json
from urllib.request import Request, urlopen


def post_event(url: str, payload: dict, timeout_sec: float = 2.0) -> None:
    request = Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urlopen(request, timeout=timeout_sec):
        pass

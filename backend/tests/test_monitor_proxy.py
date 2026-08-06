import asyncio
from types import SimpleNamespace

from app.monitor_client.client import MonitorResponse
from app.routers import monitor_proxy


class _Request:
    method = 'POST'
    url = SimpleNamespace(query='timeout=10')
    headers = {'content-type': 'application/json'}

    async def body(self) -> bytes:
        return b'{"value": 1}'


def test_proxy_runs_blocking_monitor_request_off_event_loop(monkeypatch):
    calls = []

    async def request(method, path, *, body, content_type):
        await asyncio.sleep(0.05)
        calls.append((method, path, body, content_type))
        return MonitorResponse(200, b'{"success":true}', 'application/json')

    monkeypatch.setattr(monitor_proxy.monitor_client, 'request_async', request)

    async def exercise():
        task = asyncio.create_task(monitor_proxy.proxy_monitor('interfaces/action-goal', _Request()))
        await asyncio.sleep(0.01)
        assert not task.done()
        return await task

    response = asyncio.run(exercise())
    assert response.status_code == 200
    assert calls == [
        ('POST', '/ros/interfaces/action-goal?timeout=10', b'{"value": 1}', 'application/json'),
    ]

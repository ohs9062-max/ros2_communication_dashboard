import asyncio
import json

import httpx

from app.alerts.local_model import LocalModelManager


def test_status_reports_ollama_unavailable():
    def handler(request):
        raise httpx.ConnectError('offline', request=request)

    status = asyncio.run(_manager(handler).status())

    assert status['ollama_available'] is False
    assert status['model_installed'] is False
    assert status['download_state'] == 'idle'


def test_status_distinguishes_missing_and_installed_model():
    missing = asyncio.run(_manager(
        lambda request: _json_response(request, {'models': [{'name': 'other:latest'}]}),
    ).status())
    installed = asyncio.run(_manager(
        lambda request: _json_response(request, {'models': [{'model': 'configured-gemma'}]}),
    ).status())

    assert missing['ollama_available'] is True
    assert missing['model_installed'] is False
    assert installed['model_installed'] is True


def test_pull_exposes_real_progress_verifies_and_completes_once():
    async def scenario():
        release = asyncio.Event()
        progress_seen = asyncio.Event()
        calls = {'tags': 0, 'pull': 0}

        class ProgressStream(httpx.AsyncByteStream):
            async def __aiter__(self):
                yield json.dumps({
                    'status': 'pulling model layer', 'completed': 63, 'total': 100,
                }).encode() + b'\n'
                progress_seen.set()
                await release.wait()
                yield b'{"status":"success"}\n'

        def handler(request):
            if request.url.path == '/api/tags':
                calls['tags'] += 1
                models = [] if calls['tags'] == 1 else [{'name': 'configured-gemma'}]
                return _json_response(request, {'models': models})
            calls['pull'] += 1
            return httpx.Response(200, request=request, stream=ProgressStream())

        manager = _manager(handler)
        started = await manager.start_download()
        duplicate = await manager.start_download()
        assert started['download_state'] == 'preparing'
        assert duplicate['download_state'] == 'preparing'

        await progress_seen.wait()
        progress = await manager.status()
        assert progress['download_state'] == 'downloading'
        assert progress['completed'] == 63
        assert progress['total'] == 100
        assert progress['progress_percent'] == 63

        release.set()
        await manager.wait_for_download()
        completed = await manager.status()
        assert completed['model_installed'] is True
        assert completed['download_state'] == 'completed'
        assert completed['progress_percent'] == 100
        assert calls['pull'] == 1

    asyncio.run(scenario())


def test_failed_pull_can_be_retried_without_parallel_pull():
    async def scenario():
        calls = {'pull': 0}

        def handler(request):
            if request.url.path == '/api/tags':
                return _json_response(request, {'models': []})
            calls['pull'] += 1
            return httpx.Response(
                200,
                request=request,
                content=b'{"status":"pulling","error":"disk full"}\n',
            )

        manager = _manager(handler)
        await manager.start_download()
        await manager.wait_for_download()
        failed = await manager.status()
        assert failed['download_state'] == 'failed'
        assert failed['error'] == 'disk full'

        retried = await manager.start_download()
        assert retried['download_state'] == 'preparing'
        await manager.wait_for_download()
        assert calls['pull'] == 2

    asyncio.run(scenario())


def _manager(handler):
    transport = httpx.MockTransport(handler)
    return LocalModelManager(
        base_url='http://ollama.test',
        model='configured-gemma',
        client_factory=lambda: httpx.AsyncClient(transport=transport),
    )


def _json_response(request, payload):
    return httpx.Response(200, request=request, json=payload)

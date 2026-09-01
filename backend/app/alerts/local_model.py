"""Ollama model availability and background pull state."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

import httpx


LOGGER = logging.getLogger(__name__)


class LocalModelConfigurationError(RuntimeError):
    """The configured Ollama endpoint or model is missing."""


class LocalModelUnavailableError(RuntimeError):
    """The configured Ollama endpoint cannot prepare the model."""


class LocalModelManager:
    """Own one in-process pull task and expose its real Ollama progress."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self._base_url = base_url.rstrip('/')
        self._model = model.strip()
        self._client_factory = client_factory
        self._start_lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self._state = self._initial_state()

    async def status(self) -> dict[str, Any]:
        task = self._task
        if task is not None and not task.done():
            return dict(self._state)
        try:
            installed = await self._model_installed()
        except (httpx.HTTPError, TimeoutError, ValueError) as exc:
            self._state.update({
                'ollama_available': False,
                'model_installed': False,
                'status': 'Ollama API에 연결할 수 없습니다.',
            })
            if self._state['download_state'] != 'failed':
                self._state['download_state'] = 'idle'
                self._state['error'] = None
            LOGGER.info('Local model status probe failed: %s', type(exc).__name__)
            return dict(self._state)

        self._state['ollama_available'] = True
        self._state['model_installed'] = installed
        if installed:
            self._state.update({
                'download_state': 'completed' if self._state['download_state'] != 'idle' else 'idle',
                'status': '모델을 사용할 수 있습니다.',
                'error': None,
            })
        elif self._state['download_state'] not in {'failed'}:
            self._state.update({
                'download_state': 'idle',
                'status': '모델 다운로드가 필요합니다.',
                'completed': None,
                'total': None,
                'progress_percent': None,
                'error': None,
            })
        return dict(self._state)

    async def start_download(self) -> dict[str, Any]:
        self._validate_configuration()
        async with self._start_lock:
            if self._task is not None and not self._task.done():
                return dict(self._state)
            current = await self.status()
            if not current['ollama_available']:
                raise LocalModelUnavailableError('Ollama API에 연결할 수 없습니다.')
            if current['model_installed']:
                self._state.update({
                    'download_state': 'completed',
                    'status': '모델을 사용할 수 있습니다.',
                })
                return dict(self._state)
            self._state.update({
                'download_state': 'preparing',
                'status': '모델 다운로드를 준비하고 있습니다.',
                'completed': None,
                'total': None,
                'progress_percent': None,
                'error': None,
            })
            self._task = asyncio.create_task(self._pull_model())
            return dict(self._state)

    async def wait_for_download(self) -> None:
        task = self._task
        if task is not None:
            await task

    def _initial_state(self) -> dict[str, Any]:
        return {
            'ollama_available': False,
            'model': self._model,
            'model_installed': False,
            'download_state': 'idle',
            'status': 'Local AI 상태를 확인하지 않았습니다.',
            'completed': None,
            'total': None,
            'progress_percent': None,
            'error': None,
        }

    def _validate_configuration(self) -> None:
        if not self._base_url:
            raise LocalModelConfigurationError('LOCAL_LLM_URL is not configured')
        if not self._model:
            raise LocalModelConfigurationError('LOCAL_LLM_MODEL is not configured')

    def _factory(self) -> httpx.AsyncClient:
        if self._client_factory is not None:
            return self._client_factory()
        timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)
        return httpx.AsyncClient(timeout=timeout)

    async def _model_installed(self) -> bool:
        self._validate_configuration()
        async with asyncio.timeout(5.0):
            async with self._factory() as client:
                response = await client.get(f'{self._base_url}/api/tags')
                response.raise_for_status()
                payload = response.json()
        models = payload.get('models') if isinstance(payload, dict) else None
        if not isinstance(models, list):
            raise ValueError('Ollama tags response is invalid')
        return any(
            isinstance(item, dict)
            and self._model in {str(item.get('name') or ''), str(item.get('model') or '')}
            for item in models
        )

    async def _pull_model(self) -> None:
        try:
            async with self._factory() as client:
                async with client.stream(
                    'POST',
                    f'{self._base_url}/api/pull',
                    json={'model': self._model, 'stream': True},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        event = json.loads(line)
                        if not isinstance(event, dict):
                            continue
                        if event.get('error'):
                            raise LocalModelUnavailableError(str(event['error'])[:500])
                        self._apply_progress(event)

            self._state.update({
                'download_state': 'verifying',
                'status': '다운로드된 모델을 확인하고 있습니다.',
                'error': None,
            })
            if not await self._model_installed():
                raise LocalModelUnavailableError('다운로드 후 모델을 /api/tags에서 찾지 못했습니다.')
            self._state.update({
                'ollama_available': True,
                'model_installed': True,
                'download_state': 'completed',
                'status': '모델 다운로드가 완료되었습니다.',
                'progress_percent': 100,
                'error': None,
            })
        except Exception as exc:  # Background task must always publish a terminal state.
            message = str(exc).strip() or type(exc).__name__
            self._state.update({
                'model_installed': False,
                'download_state': 'failed',
                'status': '모델 다운로드에 실패했습니다.',
                'error': message[:500],
            })
            LOGGER.warning('Local model pull failed: %s', message)
        finally:
            self._task = None

    def _apply_progress(self, event: dict[str, Any]) -> None:
        status = str(event.get('status') or '').strip()
        completed = _non_negative_int(event.get('completed'))
        total = _non_negative_int(event.get('total'))
        progress = None
        state = 'preparing'
        if completed is not None and total is not None and total > 0:
            progress = min(100, round(completed * 100 / total))
            state = 'downloading'
        elif status.lower() in {'success', 'verifying sha256 digest', 'writing manifest'}:
            state = 'verifying'
        self._state.update({
            'ollama_available': True,
            'download_state': state,
            'status': status or self._state['status'],
            'completed': completed,
            'total': total,
            'progress_percent': progress,
            'error': None,
        })


def _non_negative_int(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return None
    return int(value)

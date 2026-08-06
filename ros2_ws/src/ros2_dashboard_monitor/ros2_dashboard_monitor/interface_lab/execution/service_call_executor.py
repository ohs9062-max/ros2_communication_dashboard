"""사용자가 명시한 Service Call의 변환·전송·응답 lifecycle을 실행합니다."""

from __future__ import annotations

import threading
from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.common.value_converter import InterfaceValidationError


def execute_service_call(
    *, service_name: str, service_type: str, request_data: dict[str, Any],
    timeout: float, service_class_loader: Callable[[str], type],
    client_getter: Callable[[str, str, type], Any],
    validation_result_builder: Callable[..., dict[str, Any]],
    record_history: Callable[[dict[str, Any]], None],
    error_class: type[Exception],
    message_builder: Callable[..., Any],
    response_serializer: Callable[[Any], Any],
) -> dict[str, Any]:
    """검증된 name/type에 요청을 한 번 전송하고 response까지 기다립니다."""
    started_at = time()
    sent_to_server = False
    try:
        service_class = service_class_loader(service_type)
        try:
            request = message_builder(service_class.Request, request_data, label='request')
        except InterfaceValidationError as exc:
            result = validation_result_builder(
                service_name=service_name, service_type=service_type,
                request_data=request_data, started_at=started_at,
                timeout_sec=timeout, error=str(exc), details=exc.details,
            )
            record_history(result)
            return result

        client = client_getter(service_name, service_type, service_class)
        if not client.service_is_ready():
            raise error_class('Service server가 준비되지 않았습니다.')
        future = client.call_async(request)
        sent_to_server = True
        event = threading.Event()
        future.add_done_callback(lambda _future: event.set())
        if not event.wait(timeout=timeout):
            raise TimeoutError(f'service call timeout after {timeout:.2f}s')

        response_preview = response_serializer(future.result())
        response_failed = isinstance(response_preview, dict) and response_preview.get('success') is False
        result = {
            'success': not response_failed, 'service_name': service_name,
            'service_type': service_type, 'request': request_data,
            'response': response_preview, 'elapsed_ms': (time() - started_at) * 1000.0,
            'timeout_sec': timeout, 'called_at': started_at,
            'called': True, 'sent_to_server': True,
        }
        if response_failed:
            result['error_type'] = 'response_failed'
            result['error'] = str(response_preview.get('message') or response_preview.get('error') or 'Service response reported success=false')
    except Exception as exc:
        result = {
            'success': False, 'service_name': service_name, 'service_type': service_type,
            'request': request_data, 'response': None,
            'elapsed_ms': (time() - started_at) * 1000.0, 'timeout_sec': timeout,
            'called_at': started_at, 'called': sent_to_server,
            'sent_to_server': sent_to_server,
            'error_type': 'timeout' if isinstance(exc, TimeoutError) else 'service_call_error',
            'error': str(exc),
        }
        record_history(result)
        if isinstance(exc, error_class):
            raise
        raise error_class(str(exc)) from exc

    record_history(result)
    return result

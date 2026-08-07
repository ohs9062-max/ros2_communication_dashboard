"""Storage and read models for Interface Lab Service call history."""

from __future__ import annotations

from time import time
from typing import Any

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import (
    BoundedExecutionHistory,
)


class ServiceCallHistory:
    def __init__(self, lock: Any, max_items: int) -> None:
        self._lock = lock
        self._calls = BoundedExecutionHistory(lock, max_items)
        self._receive_reset_at: float | None = None
        self._receive_reset_by_key: dict[tuple[str | None, str | None], float] = {}

    def clear(self) -> None:
        with self._lock:
            self._receive_reset_at = None
            self._receive_reset_by_key = {}
        self._calls.clear()

    def record(self, item: dict[str, Any]) -> None:
        self._calls.record(item)

    def snapshot(self) -> list[dict[str, Any]]:
        return self._calls.snapshot()

    def response(self) -> dict[str, Any]:
        calls = self.snapshot()
        return {'calls': calls, 'meta': {'count': len(calls)}}

    def receive_response(self) -> dict[str, Any]:
        events = []
        for index, call in enumerate(self.snapshot()):
            if self._is_reset(call):
                continue
            events.append(_receive_event(call, index))
        return {'history': events, 'meta': {'count': len(events)}}

    def reset_receive(
        self,
        *,
        service_name: str | None = None,
        service_type: str | None = None,
    ) -> dict[str, Any]:
        previous = sum(
            1 for item in self.receive_response()['history']
            if not service_name
            or (
                item.get('service_name') == service_name
                and item.get('service_type') == service_type
            )
        )
        if service_name:
            self._receive_reset_by_key[(service_name, service_type)] = time()
        else:
            self._receive_reset_at = time()
        return {'cleared': previous}

    def summary_by_service(self) -> dict[tuple[str, str], dict[str, Any]]:
        summaries: dict[tuple[str, str], dict[str, Any]] = {}
        for call in reversed(self.snapshot()):
            key = (str(call.get('service_name') or ''), str(call.get('service_type') or ''))
            if not key[0] or not key[1]:
                continue
            summary = summaries.setdefault(key, {
                'call_count': 0,
                'success_count': 0,
                'failure_count': 0,
                'history': [],
            })
            summary['call_count'] += 1
            count_key = 'success_count' if call.get('success') is True else 'failure_count'
            summary[count_key] += 1
            call_summary = call_summary_payload(call)
            summary['history'].insert(0, call_summary)
            summary['history'] = summary['history'][:5]
            summary.update(call_summary)
        return summaries

    def _is_reset(self, call: dict[str, Any]) -> bool:
        called_at = call.get('called_at')
        if (
            self._receive_reset_at is not None
            and called_at is not None
            and called_at <= self._receive_reset_at
        ):
            return True
        reset_at = self._receive_reset_by_key.get(
            (call.get('service_name'), call.get('service_type')),
        )
        return reset_at is not None and called_at is not None and called_at <= reset_at


def call_summary_payload(call: dict[str, Any]) -> dict[str, Any]:
    error_type = call.get('error_type')
    status = 'success' if call.get('success') is True else (error_type or 'failed')
    return {
        'status': status,
        'success': call.get('success') is True,
        'called': call.get('called', call.get('sent_to_server', False)),
        'sent_to_server': call.get('sent_to_server', False),
        'last_request_preview': call.get('request'),
        'last_response_preview': call.get('response'),
        'last_call_status': status,
        'last_called_at': call.get('called_at'),
        'last_response_time_ms': call.get('elapsed_ms'),
        'last_error': call.get('error'),
        'error_type': error_type,
        'details': call.get('details', []),
        'execution_source': call.get('execution_source'),
        'requester_node': call.get('requester_node'),
    }


def _receive_event(call: dict[str, Any], index: int) -> dict[str, Any]:
    return {
        'id': f"service-{call.get('called_at', index)}-{index}",
        'direction': 'service_response',
        'service_name': call.get('service_name'),
        'service_type': call.get('service_type'),
        'request': call.get('request'),
        'response': call.get('response'),
        'status': 'success' if call.get('success') else call.get('error_type') or 'failed',
        'success': call.get('success') is True,
        'error_type': call.get('error_type'),
        'error': call.get('error'),
        'sent_to_server': call.get('sent_to_server', False),
        'called_at': call.get('called_at'),
        'received_at': call.get('called_at'),
        'response_time_ms': call.get('elapsed_ms'),
        'execution_source': call.get('execution_source'),
        'requester_node': call.get('requester_node'),
        'raw': call,
    }

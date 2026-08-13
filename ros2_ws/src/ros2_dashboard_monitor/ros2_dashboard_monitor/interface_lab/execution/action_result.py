"""Interface Lab Action Goal 실행 결과 payload를 조립합니다."""

from __future__ import annotations

from time import time
from typing import Any


def build_action_goal_result(
    *,
    success: bool,
    action_name: str,
    action_type: str,
    goal_data: dict[str, Any],
    accepted: bool,
    feedback: list[dict[str, Any]],
    feedback_timestamps: list[float],
    result: dict[str, Any] | None,
    started_at: float,
    timeout_sec: float,
    status: int | None = None,
    error: str | None = None,
    error_type: str | None = None,
    details: list[str] | None = None,
    sent_to_server: bool = False,
    result_received_at: float | None = None,
) -> dict[str, Any]:
    payload = {
        'success': success,
        'action_name': action_name,
        'action_type': action_type,
        'goal': goal_data,
        'accepted': accepted,
        'elapsed_ms': (time() - started_at) * 1000.0,
        'feedback': feedback,
        'feedback_timestamps': feedback_timestamps,
        'result': result,
        'result_received_at': result_received_at,
        'timeout_sec': timeout_sec,
        'sent_at': started_at,
        'sent_to_server': sent_to_server,
    }
    if status is not None:
        payload['status'] = status
    if error is not None:
        payload['error'] = error
    if error_type is not None:
        payload['error_type'] = error_type
    if details is not None:
        payload['details'] = details
    return payload

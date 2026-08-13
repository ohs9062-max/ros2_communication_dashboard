"""Action Goal 실행 요청 검증과 summary helper."""

from __future__ import annotations

from typing import Any, Callable

from rosidl_runtime_py.utilities import get_action

from ros2_dashboard_monitor.interface_lab.common.value_converter import schema_from_message_class
from ros2_dashboard_monitor.ros2_action.models import goal_status_label


DEFAULT_TIMEOUT_SEC = 10.0
MAX_TIMEOUT_SEC = 60.0


class ActionGoalError(ValueError):
    """Interface Lab Action Goal 요청이 유효하지 않을 때 발생합니다."""


def normalized_timeout(timeout_sec: float | None) -> float:
    if timeout_sec is None:
        return DEFAULT_TIMEOUT_SEC
    try:
        timeout = float(timeout_sec)
    except (TypeError, ValueError) as exc:
        raise ActionGoalError('timeout_sec must be a valid number.') from exc
    if timeout <= 0:
        raise ActionGoalError('timeout_sec must be greater than zero.')
    return min(timeout, MAX_TIMEOUT_SEC)


def schema_from_action_class(
    action_type: str,
) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    try:
        action_class = get_action(action_type)
        return (
            schema_from_message_class(action_class.Goal),
            schema_from_message_class(action_class.Result),
            schema_from_message_class(action_class.Feedback),
        )
    except Exception:
        return [], [], []


def goal_summary(goal: dict[str, Any]) -> dict[str, Any]:
    error_type = goal.get('error_type')
    raw_status = goal.get('status')
    status = goal_status_label(raw_status) if isinstance(raw_status, int) else raw_status
    if not status or status == 'unknown':
        status = 'success' if goal.get('success') is True else error_type or 'failed'
    feedback = goal.get('feedback') if isinstance(goal.get('feedback'), list) else []
    return {
        'status': status,
        'success': goal.get('success') is True,
        'accepted': goal.get('accepted') is True,
        'sent_to_server': goal.get('sent_to_server', False),
        'last_goal_preview': goal.get('goal'),
        'last_goal_sent_at': goal.get('sent_at'),
        'last_feedback_preview': feedback[-1] if feedback else None,
        'last_feedback_at': goal.get('sent_at') if feedback else None,
        'last_result_preview': goal.get('result'),
        'last_result_at': goal.get('sent_at') if goal.get('result') is not None else None,
        'last_goal_status': status,
        'execution_time_ms': goal.get('elapsed_ms'),
        'last_error': goal.get('error'),
        'error_type': error_type,
        'details': goal.get('details', []),
        'execution_source': goal.get('execution_source'),
        'requester_node': goal.get('requester_node'),
    }


def interface_lab_node(node_getter: Callable[[], Any]) -> dict[str, Any]:
    node = node_getter()
    try:
        name = str(node.get_fully_qualified_name()) if node is not None else ''
    except Exception:
        name = ''
    return {
        'name': name or '/ros2_dashboard_topic_monitor',
        'display_name': 'Dashboard Interface Lab',
        'is_internal': True,
    }

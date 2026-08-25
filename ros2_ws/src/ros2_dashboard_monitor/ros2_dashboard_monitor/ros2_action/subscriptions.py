"""Action 모니터링의 subscriptions 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from collections import deque
from typing import Any

from ros2_dashboard_monitor.ros2_action.models import (
    GOAL_STATUS_ACCEPTED,
    GOAL_STATUS_CANCELING,
    GOAL_STATUS_EXECUTING,
    RESULT_STATUS_SUCCESS,
    TERMINAL_GOAL_STATUSES,
    default_runtime,
    goal_id_to_hex,
    goal_status_label,
)

from ros2_dashboard_monitor.ros2_action.action_type_loader import (
    STATUS_TOPIC_TYPE,
    action_feedback_topic_type,
    load_feedback_message_class,
    load_status_message_class,
)
from ros2_dashboard_monitor.ros2_action.message_preview import message_to_preview


def build_action_subscription_entry(
    *,
    action_type: str | None,
    action_name: str | None = None,
    status_subscription: Any = None,
    feedback_subscription: Any = None,
    status_supported: bool = False,
    feedback_supported: bool = False,
    history_limit: int = 100,
) -> dict[str, Any]:
    """status·feedback subscription과 관찰 초기값을 하나의 Cache entry로 만듭니다."""
    return {
        'name': action_name,
        'type': action_type,
        'status_subscription': status_subscription,
        'feedback_subscription': feedback_subscription,
        'status_supported': status_supported,
        'feedback_supported': feedback_supported,
        'feedback_reason': None,
        'result_supported': False,
        'result_policy': None,
        'result_reason': None,
        'goals': {},
        'runtime': default_runtime(),
        'history': deque(maxlen=max(1, int(history_limit))),
    }


def action_entry_matches(
    entry: dict[str, Any] | None,
    *,
    action_type: str | None,
) -> bool:
    """기존 subscription entry가 같은 Action 타입과 관찰 설정인지 확인합니다."""
    return entry is not None and entry.get('type') == action_type


def runtime_snapshot(entry: dict[str, Any] | None) -> dict[str, Any]:
    """내부 subscription 객체를 제외한 화면용 Action runtime 값을 복사합니다."""
    if entry is None:
        return default_runtime()

    runtime = default_runtime()
    cached = entry.get('runtime')
    if isinstance(cached, dict):
        runtime.update(cached)
    return runtime


def update_status_runtime(
    entry: dict[str, Any],
    *,
    message: Any,
    received_at: float,
) -> None:
    """Action 모니터링에서 runtime 상태를 갱신하는 함수입니다."""
    status_list = list(getattr(message, 'status_list', []) or [])
    if not status_list:
        return

    latest_goal_id = None
    latest_status = None
    for status_item in status_list:
        goal_info = getattr(status_item, 'goal_info', None)
        goal_id = getattr(goal_info, 'goal_id', None)
        goal_key = goal_id_to_hex(goal_id)
        if goal_key is None:
            continue

        status_label = goal_status_label(getattr(status_item, 'status', None))
        goal = _goal_state(entry, goal_key, goal_id)
        previous_status = goal.get('status')
        _update_goal_status(goal, status_label, received_at)
        if status_label != previous_status:
            _append_history(entry, {
                'event_type': 'status',
                'goal_id': goal_key,
                'accepted': _accepted_from_status(status_label),
                'feedback': [],
                'result': None,
                'status_label': status_label,
                'received_at': received_at,
            })
        latest_goal_id = goal_key
        latest_status = status_label

    if latest_goal_id is None:
        return

    goals = entry.get('goals', {})
    latest_goal = goals.get(latest_goal_id, {})
    entry['runtime']['last_goal_status'] = latest_status
    entry['runtime']['last_goal_id'] = latest_goal_id
    entry['runtime']['last_status_at'] = received_at
    entry['runtime']['elapsed_time_ms'] = latest_goal.get(
        'elapsed_time_ms',
    )
    entry['runtime']['result_status'] = latest_goal.get('result_status')
    entry['runtime']['result_preview'] = latest_goal.get('result_preview')
    entry['runtime']['result_error'] = latest_goal.get('result_error')
    entry['runtime']['observed_goal_count'] = len(goals)


def update_feedback_runtime(
    entry: dict[str, Any],
    *,
    message: Any,
    received_at: float,
) -> None:
    """Action 모니터링에서 runtime 상태를 갱신하는 함수입니다."""
    feedback = getattr(message, 'feedback', message)
    feedback_preview = message_to_preview(feedback)
    goal_key = goal_id_to_hex(getattr(message, 'goal_id', None))
    entry['runtime']['last_feedback_at'] = received_at
    entry['runtime']['feedback_preview'] = feedback_preview
    _append_history(entry, {
        'event_type': 'feedback',
        'goal_id': goal_key,
        'accepted': True if goal_key else None,
        'feedback': [feedback_preview],
        'result': None,
        'status_label': 'feedback',
        'received_at': received_at,
    })


def terminal_goals_ready_for_result(
    entry: dict[str, Any],
) -> list[dict[str, Any]]:
    """종료 상태이며 아직 Result를 요청하지 않은 Goal 목록을 반환합니다."""
    goals = entry.get('goals', {})
    return [
        goal for goal in goals.values()
        if goal.get('status') in TERMINAL_GOAL_STATUSES
        and goal.get('result_requested') is not True
    ]


def mark_goal_result_pending(
    entry: dict[str, Any],
    goal_id: str,
) -> None:
    """해당 Goal의 Result 요청이 진행 중임을 Cache에 표시합니다."""
    goal = entry.get('goals', {}).get(goal_id)
    if goal is None:
        return

    goal['result_requested'] = True
    goal['result_status'] = 'pending'
    goal['result_error'] = None
    _sync_runtime_result(entry, goal)


def update_goal_result(
    entry: dict[str, Any],
    *,
    goal_id: str,
    state: dict[str, Any],
    received_at: float | None = None,
) -> None:
    """Action 모니터링에서 runtime 상태를 갱신하는 함수입니다."""
    goal = entry.get('goals', {}).get(goal_id)
    if goal is None:
        return

    goal.update(state)
    if received_at is not None:
        _append_history(entry, {
            'event_type': 'result',
            'goal_id': goal_id,
            'accepted': True,
            'feedback': [],
            'result': state.get('result_preview'),
            'status_label': goal.get('status') or state.get('result_status'),
            'success': state.get('result_status') == RESULT_STATUS_SUCCESS,
            'error': state.get('result_error'),
            'received_at': received_at,
        })
    _sync_runtime_result(entry, goal)


def action_history_snapshot(
    entry: dict[str, Any] | None,
    *,
    limit: int,
) -> list[dict[str, Any]]:
    if entry is None:
        return []
    history = entry.get('history')
    if history is None:
        return []
    return [dict(item) for item in list(history)[:max(1, int(limit))]]


def _goal_state(
    entry: dict[str, Any],
    goal_id: str,
    goal_id_message: Any,
) -> dict[str, Any]:
    goals = entry.setdefault('goals', {})
    goal = goals.get(goal_id)
    if goal is None:
        goal = {
            'goal_id': goal_id,
            'goal_id_msg': goal_id_message,
            'status': 'unknown',
            'accepted_at': None,
            'executing_at': None,
            'finished_at': None,
            'last_status_at': None,
            'elapsed_time_ms': None,
            'result_requested': False,
            'result_status': None,
            'result_preview': None,
            'result_error': None,
        }
        goals[goal_id] = goal
    return goal


def _update_goal_status(
    goal: dict[str, Any],
    status_label: str,
    received_at: float,
) -> None:
    goal['status'] = status_label
    goal['last_status_at'] = received_at
    if status_label == GOAL_STATUS_ACCEPTED:
        goal.setdefault('accepted_at', received_at)
        if goal['accepted_at'] is None:
            goal['accepted_at'] = received_at
    elif status_label == GOAL_STATUS_EXECUTING:
        goal.setdefault('executing_at', received_at)
        if goal['executing_at'] is None:
            goal['executing_at'] = received_at
    elif status_label in TERMINAL_GOAL_STATUSES:
        if goal.get('finished_at') is None:
            goal['finished_at'] = received_at
            goal['elapsed_time_ms'] = _elapsed_time_ms(goal)


def _elapsed_time_ms(goal: dict[str, Any]) -> float | None:
    finished_at = goal.get('finished_at')
    if finished_at is None:
        return None

    started_at = goal.get('accepted_at') or goal.get('executing_at')
    if started_at is None:
        return None

    return (finished_at - started_at) * 1000.0


def _append_history(entry: dict[str, Any], item: dict[str, Any]) -> None:
    history = entry.get('history')
    if history is None:
        return
    history.appendleft({
        'execution_source': 'monitor_observed',
        'action_name': entry.get('name'),
        'action_type': entry.get('type'),
        'goal': None,
        **item,
    })


def _accepted_from_status(status: str) -> bool | None:
    if status in {
        GOAL_STATUS_ACCEPTED,
        GOAL_STATUS_CANCELING,
        GOAL_STATUS_EXECUTING,
        *TERMINAL_GOAL_STATUSES,
    }:
        return True
    return None


def _sync_runtime_result(
    entry: dict[str, Any],
    goal: dict[str, Any],
) -> None:
    if entry.get('runtime', {}).get('last_goal_id') != goal.get('goal_id'):
        return

    entry['runtime']['result_status'] = goal.get('result_status')
    entry['runtime']['result_preview'] = goal.get('result_preview')
    entry['runtime']['result_error'] = goal.get('result_error')

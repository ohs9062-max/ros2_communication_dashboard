"""Interface Lab Action Goal history의 이벤트 변환과 요약을 담당합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.interface_lab.execution.action_support import (
    goal_summary,
)


def build_receive_history(
    goals: list[dict[str, Any]],
    *,
    reset_at: float | None,
    reset_by_key: dict[tuple[str | None, str | None], float],
) -> dict[str, Any]:
    """초기화 경계 이후 Goal history를 Feedback/Result 수신 이벤트로 펼칩니다."""
    events = []
    for goal_index, goal in enumerate(goals):
        sent_at = goal.get('sent_at')
        if reset_at is not None and sent_at is not None and sent_at <= reset_at:
            continue
        key_reset_at = reset_by_key.get(
            (goal.get('action_name'), goal.get('action_type')),
        )
        if (
            key_reset_at is not None
            and sent_at is not None
            and sent_at <= key_reset_at
        ):
            continue

        summary = goal_summary(goal)
        feedback_items = (
            goal.get('feedback')
            if isinstance(goal.get('feedback'), list)
            else []
        )
        for feedback_index, feedback in enumerate(feedback_items):
            events.append(_receive_event(
                goal,
                event_id=(
                    f"action-feedback-{goal.get('sent_at', goal_index)}-"
                    f'{feedback_index}'
                ),
                direction='action_feedback',
                feedback=feedback,
                result=None,
                status='feedback',
                received_at=_feedback_received_at(goal, feedback_index),
            ))
        events.append(_receive_event(
            goal,
            event_id=(
                f"action-result-{goal.get('sent_at', goal_index)}-"
                f'{goal_index}'
            ),
            direction='action_result',
            feedback=None,
            result=goal.get('result'),
            status=summary['last_goal_status'],
            received_at=_result_received_at(goal),
        ))
    return {'history': events, 'meta': {'count': len(events)}}


def summarize_action_history(
    goals: list[dict[str, Any]],
) -> dict[tuple[str, str], dict[str, Any]]:
    """Action 이름/type별 최근 결과와 누적 성공·실패·취소 건수를 계산합니다."""
    summaries: dict[tuple[str, str], dict[str, Any]] = {}
    for goal in reversed(goals):
        key = (
            str(goal.get('action_name') or ''),
            str(goal.get('action_type') or ''),
        )
        if not key[0] or not key[1]:
            continue
        summary = summaries.setdefault(key, {
            'goal_count': 0,
            'success_count': 0,
            'failure_count': 0,
            'canceled_count': 0,
            'history': [],
        })
        current = goal_summary(goal)
        summary['goal_count'] += 1
        if goal.get('success') is True:
            summary['success_count'] += 1
        else:
            summary['failure_count'] += 1
        if current['last_goal_status'] == 'canceled':
            summary['canceled_count'] += 1
        summary['history'].insert(0, current)
        summary['history'] = summary['history'][:5]
        summary.update(current)
    return summaries


def _receive_event(
    goal: dict[str, Any],
    *,
    event_id: str,
    direction: str,
    feedback: Any,
    result: Any,
    status: str,
    received_at: float | None,
) -> dict[str, Any]:
    return {
        'id': event_id,
        'direction': direction,
        'action_name': goal.get('action_name'),
        'action_type': goal.get('action_type'),
        'goal': goal.get('goal'),
        'feedback': feedback,
        'result': result,
        'status': status,
        'success': goal.get('success') is True,
        'error_type': goal.get('error_type'),
        'error': goal.get('error'),
        'sent_to_server': goal.get('sent_to_server', False),
        'goal_sent_at': goal.get('sent_at'),
        'received_at': received_at,
        'execution_time_ms': goal.get('elapsed_ms'),
        'execution_source': goal.get('execution_source'),
        'requester_node': goal.get('requester_node'),
        'raw': goal,
    }


def _feedback_received_at(goal: dict[str, Any], index: int) -> float | None:
    timestamps = goal.get('feedback_timestamps')
    if isinstance(timestamps, list):
        return timestamps[index] if index < len(timestamps) else None
    return goal.get('sent_at')


def _result_received_at(goal: dict[str, Any]) -> float | None:
    if 'result_received_at' in goal:
        return goal.get('result_received_at')
    return goal.get('sent_at')

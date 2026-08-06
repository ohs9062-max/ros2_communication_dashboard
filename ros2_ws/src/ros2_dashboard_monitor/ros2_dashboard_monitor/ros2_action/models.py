"""Action 모니터링의 models 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any


ACTION_STATUS_ACTIVE = 'active'
ACTION_STATUS_WAITING_SERVER = 'waiting_server'
ACTION_STATUS_INACTIVE = 'inactive'
ACTION_STATUS_UNKNOWN = 'unknown'
ACTION_STATUS_DISCONNECTED = 'disconnected'

GOAL_STATUS_UNKNOWN = 'unknown'
GOAL_STATUS_ACCEPTED = 'accepted'
GOAL_STATUS_EXECUTING = 'executing'
GOAL_STATUS_CANCELING = 'canceling'
GOAL_STATUS_SUCCEEDED = 'succeeded'
GOAL_STATUS_CANCELED = 'canceled'
GOAL_STATUS_ABORTED = 'aborted'

ALERT_LEVEL_WARNING = 'warning'
ALERT_LEVEL_ERROR = 'error'
ALERT_CODE_ACTION_WAITING_SERVER = 'action_waiting_server'
ALERT_CODE_ACTION_GOAL_ABORTED = 'action_goal_aborted'
ALERT_CODE_ACTION_GOAL_CANCELED = 'action_goal_canceled'
ALERT_CODE_ACTION_GOAL_REJECTED = 'action_goal_rejected'
ALERT_CODE_ACTION_GOAL_SEND_FAILED = 'action_goal_send_failed'
ALERT_CODE_ACTION_RESULT_TIMEOUT = 'action_result_timeout'
ALERT_CODE_ACTION_RESULT_UNAVAILABLE = 'action_result_unavailable'

RESULT_POLICY_OBSERVED_GOAL_ONLY = 'observed_goal_only'
RESULT_STATUS_PENDING = 'pending'
RESULT_STATUS_SUCCESS = 'success'
RESULT_STATUS_UNAVAILABLE = 'unavailable'

GOAL_STATUS_LABELS = {
    0: GOAL_STATUS_UNKNOWN,
    1: GOAL_STATUS_ACCEPTED,
    2: GOAL_STATUS_EXECUTING,
    3: GOAL_STATUS_CANCELING,
    4: GOAL_STATUS_SUCCEEDED,
    5: GOAL_STATUS_CANCELED,
    6: GOAL_STATUS_ABORTED,
}

TERMINAL_GOAL_STATUSES = {
    GOAL_STATUS_SUCCEEDED,
    GOAL_STATUS_CANCELED,
    GOAL_STATUS_ABORTED,
}


def is_valid_action_type(action_type: str | None) -> bool:
    """값이 `package/action/Type` 형식의 Action 전체 타입인지 확인합니다."""
    if not action_type:
        return False

    parts = action_type.split('/')
    return len(parts) == 3 and parts[1] == 'action' and all(parts)


def action_status(
    action_type: str | None,
    server_count: int,
    client_count: int,
) -> tuple[str, str]:
    """Server·Client 수와 타입 유효성으로 Action 상태를 결정합니다."""
    if not is_valid_action_type(action_type):
        return ACTION_STATUS_UNKNOWN, 'action type is unknown'

    if server_count > 0:
        return ACTION_STATUS_ACTIVE, 'action server available'

    if client_count > 0:
        return (
            ACTION_STATUS_WAITING_SERVER,
            'action client exists but no server',
        )

    return ACTION_STATUS_INACTIVE, 'no action server and no client'


def goal_status_label(status_code: int | None) -> str:
    """ROS Goal status 숫자를 화면용 상태 이름으로 변환합니다."""
    return GOAL_STATUS_LABELS.get(status_code, GOAL_STATUS_UNKNOWN)


def goal_id_to_hex(goal_id: Any) -> str | None:
    """Goal UUID 바이트를 비교 가능한 16진수 문자열로 변환합니다."""
    uuid = getattr(goal_id, 'uuid', None)
    if uuid is None:
        return None

    return ''.join(f'{int(byte):02x}' for byte in uuid)


def default_runtime() -> dict[str, Any]:
    """아직 Goal을 관찰하지 않은 Action의 초기 runtime 값을 만듭니다."""
    return {
        'last_goal_status': GOAL_STATUS_UNKNOWN,
        'last_goal_id': None,
        'last_status_at': None,
        'last_feedback_at': None,
        'elapsed_time_ms': None,
        'feedback_preview': None,
        'result_status': None,
        'result_preview': None,
        'result_error': None,
        'observed_goal_count': 0,
    }


def action_meta(
    *,
    actions: list[dict[str, Any]],
    last_updated: float,
) -> dict[str, int | float]:
    """Action 목록의 상태·관찰·Server 건수를 요약합니다."""
    return {
        'count': len(actions),
        'active_count': sum(
            1 for action in actions
            if action.get('status') == ACTION_STATUS_ACTIVE
        ),
        'warning_count': sum(
            1 for action in actions
            if action.get('status') == ACTION_STATUS_WAITING_SERVER
        ),
        'error_count': sum(
            1 for action in actions
            if action.get('status') == ACTION_STATUS_DISCONNECTED
        ),
        'server_count': sum(
            int(action.get('server_count') or 0)
            for action in actions
        ),
        'client_count': sum(
            int(action.get('client_count') or 0)
            for action in actions
        ),
        'status_supported_count': sum(
            1 for action in actions
            if action.get('status_supported') is True
        ),
        'feedback_supported_count': sum(
            1 for action in actions
            if action.get('feedback_supported') is True
        ),
        'result_supported_count': sum(
            1 for action in actions
            if action.get('result_supported') is True
        ),
        'observed_goal_count': sum(
            int(action.get('runtime', {}).get('observed_goal_count') or 0)
            for action in actions
        ),
        'last_updated': last_updated,
    }

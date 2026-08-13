"""사용자가 명시한 Action Goal의 전송·feedback·result lifecycle을 실행합니다."""

from __future__ import annotations

import threading
from time import time
from typing import Any, Callable

from rosidl_runtime_py.utilities import get_action

from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    InterfaceValidationError,
    build_ros_message,
    ros_message_to_json,
)
from ros2_dashboard_monitor.interface_lab.execution.action_support import ActionGoalError
from ros2_dashboard_monitor.ros2_action.models import goal_status_label


def execute_action_goal(
    *,
    action_name: str,
    action_type: str,
    goal_data: dict[str, Any],
    timeout: float,
    client_getter: Callable[[str, str, type], Any],
    result_builder: Callable[..., dict[str, Any]],
    record_history: Callable[[dict[str, Any]], None],
    goal_handle_store: Callable[[str, str, Any], None],
    goal_handle_remove: Callable[[str, str], None],
) -> dict[str, Any]:
    """검증된 name/type에 Goal을 보내고 terminal result까지 기다립니다."""
    started_at = time()
    feedback_items: list[dict[str, Any]] = []
    sent_to_server = False
    accepted = False
    phase = 'goal_send'
    try:
        action_class = get_action(action_type)
        try:
            goal = build_ros_message(action_class.Goal, goal_data, label='goal')
        except InterfaceValidationError as exc:
            result = result_builder(
                success=False, action_name=action_name, action_type=action_type,
                goal_data=goal_data, accepted=False, feedback=feedback_items,
                result=None, started_at=started_at, timeout_sec=timeout,
                error=str(exc), error_type='validation_error', details=exc.details,
                sent_to_server=False,
            )
            record_history(result)
            return result

        client = client_getter(action_name, action_type, action_class)
        if not client.server_is_ready():
            raise ActionGoalError('Action server is not available.')

        send_event = threading.Event()
        send_future = client.send_goal_async(
            goal,
            feedback_callback=lambda feedback: feedback_items.append(
                ros_message_to_json(feedback.feedback),
            ),
        )
        sent_to_server = True
        phase = 'goal_accept'
        send_future.add_done_callback(lambda _future: send_event.set())
        if not send_event.wait(timeout=timeout):
            raise TimeoutError(f'action goal accept timeout after {timeout:.2f}s')

        goal_handle = send_future.result()
        accepted = bool(getattr(goal_handle, 'accepted', False))
        if not accepted:
            result = result_builder(
                success=False, action_name=action_name, action_type=action_type,
                goal_data=goal_data, accepted=False, feedback=feedback_items,
                result=None, started_at=started_at, timeout_sec=timeout,
                error='goal rejected', error_type='goal_rejected',
                sent_to_server=sent_to_server,
            )
            record_history(result)
            return result

        goal_handle_store(action_name, action_type, goal_handle)
        result_event = threading.Event()
        phase = 'result'
        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(lambda _future: result_event.set())
        remaining = max(0.0, timeout - (time() - started_at))
        if not result_event.wait(timeout=remaining):
            raise TimeoutError(f'action result timeout after {timeout:.2f}s')

        result_response = result_future.result()
        result_msg = getattr(result_response, 'result', result_response)
        status = getattr(result_response, 'status', None)
        status_label = goal_status_label(status)
        succeeded = status is None or status_label == 'succeeded'
        result = result_builder(
            success=succeeded, action_name=action_name, action_type=action_type,
            goal_data=goal_data, accepted=True, feedback=feedback_items,
            result=ros_message_to_json(result_msg), started_at=started_at,
            timeout_sec=timeout, status=status,
            error=None if succeeded else f'action finished with status {status_label}',
            sent_to_server=sent_to_server,
        )
    except Exception as exc:
        error_type = (
            'result_timeout' if isinstance(exc, TimeoutError) and phase == 'result'
            else 'goal_accept_timeout' if isinstance(exc, TimeoutError)
            else 'result_receive_failed' if phase == 'result'
            else 'goal_send_failed'
        )
        result = result_builder(
            success=False, action_name=action_name, action_type=action_type,
            goal_data=goal_data, accepted=accepted, feedback=feedback_items,
            result=None, started_at=started_at, timeout_sec=timeout,
            error=str(exc), error_type=error_type, sent_to_server=sent_to_server,
        )
        record_history(result)
        if isinstance(exc, ActionGoalError):
            raise
        raise ActionGoalError(str(exc)) from exc
    finally:
        if accepted:
            goal_handle_remove(action_name, action_type)

    record_history(result)
    return result

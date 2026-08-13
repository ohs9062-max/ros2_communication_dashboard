from types import SimpleNamespace

from ros2_dashboard_monitor.interface_lab.execution.action_goal_executor import (
    execute_action_goal,
)
from ros2_dashboard_monitor.interface_lab.execution.action_result import (
    build_action_goal_result,
)


class _CompletedFuture:
    def __init__(self, result):
        self._result = result

    def add_done_callback(self, callback):
        callback(self)

    def result(self):
        return self._result


class _GoalHandle:
    accepted = True

    def get_result_async(self):
        return _CompletedFuture(SimpleNamespace(result={'done': True}, status=4))


class _ActionClient:
    def server_is_ready(self):
        return True

    def send_goal_async(self, _goal, *, feedback_callback):
        feedback_callback(SimpleNamespace(feedback={'progress': 0.5}))
        return _CompletedFuture(_GoalHandle())


def test_execute_action_goal_records_feedback_and_result_receive_times(monkeypatch) -> None:
    timestamps = iter((10.0, 11.0, 12.0, 13.0))
    monkeypatch.setattr(
        'ros2_dashboard_monitor.interface_lab.execution.action_goal_executor.time',
        lambda: next(timestamps),
    )
    monkeypatch.setattr(
        'ros2_dashboard_monitor.interface_lab.execution.action_goal_executor.get_action',
        lambda _action_type: SimpleNamespace(Goal=object),
    )
    monkeypatch.setattr(
        'ros2_dashboard_monitor.interface_lab.execution.action_goal_executor.build_ros_message',
        lambda *_args, **_kwargs: object(),
    )
    monkeypatch.setattr(
        'ros2_dashboard_monitor.interface_lab.execution.action_goal_executor.ros_message_to_json',
        lambda message: message,
    )

    recorded = []
    result = execute_action_goal(
        action_name='/work',
        action_type='demo_interfaces/action/Work',
        goal_data={'count': 1},
        timeout=10.0,
        client_getter=lambda *_args: _ActionClient(),
        result_builder=build_action_goal_result,
        record_history=recorded.append,
        goal_handle_store=lambda *_args: None,
        goal_handle_remove=lambda *_args: None,
    )

    assert result['feedback_timestamps'] == [11.0]
    assert result['result_received_at'] == 13.0
    assert recorded == [result]

#!/usr/bin/env python3

"""옵션 없이 CanControl failure demo Goal을 전송한다."""

from __future__ import annotations

import argparse
import time

import rclpy
from action_msgs.msg import GoalStatus
from rclpy.action import ActionClient
from rclpy.node import Node

from demo_can_control_outcome_server import (
    CANCEL_ACTION_NAME,
    FAILURE_ACTION_NAME,
    CanControl,
)


STATUS_LABELS = {
    GoalStatus.STATUS_UNKNOWN: 'unknown',
    GoalStatus.STATUS_ACCEPTED: 'accepted',
    GoalStatus.STATUS_EXECUTING: 'executing',
    GoalStatus.STATUS_CANCELING: 'canceling',
    GoalStatus.STATUS_SUCCEEDED: 'succeeded',
    GoalStatus.STATUS_CANCELED: 'canceled',
    GoalStatus.STATUS_ABORTED: 'aborted',
}


class DemoCanControlOutcomeClient(Node):
    def __init__(self, action_name: str) -> None:
        super().__init__('demo_can_control_outcome_client')
        self._client = ActionClient(self, CanControl, action_name)
        self.feedback_count = 0

    def run(self, *, cancel_after_sec: float | None) -> int:
        if not self._client.wait_for_server(timeout_sec=5.0):
            self.get_logger().error('Action server not available')
            return 1

        goal = CanControl.Goal()
        goal.node_id = 1
        goal.port = 1
        goal.value = 0
        goal.retries = 3
        goal.timeout_ms = 5000

        send_future = self._client.send_goal_async(
            goal,
            feedback_callback=self._feedback,
        )
        rclpy.spin_until_future_complete(self, send_future)
        goal_handle = send_future.result()
        if goal_handle is None or not goal_handle.accepted:
            self.get_logger().error('Goal rejected')
            return 1
        self.get_logger().info('Goal accepted')

        if cancel_after_sec is not None:
            deadline = time.monotonic() + cancel_after_sec
            while time.monotonic() < deadline:
                rclpy.spin_once(self, timeout_sec=0.1)
            cancel_future = goal_handle.cancel_goal_async()
            rclpy.spin_until_future_complete(self, cancel_future)
            cancel_response = cancel_future.result()
            cancel_count = len(cancel_response.goals_canceling)
            self.get_logger().warning(
                f'Cancel response: goals_canceling={cancel_count}',
            )
            if cancel_count == 0:
                return 1

        result_future = goal_handle.get_result_async()
        rclpy.spin_until_future_complete(self, result_future)
        wrapped_result = result_future.result()
        if wrapped_result is None:
            self.get_logger().error('Result unavailable')
            return 1

        result = wrapped_result.result
        status = STATUS_LABELS.get(wrapped_result.status, str(wrapped_result.status))
        self.get_logger().info(
            f'Result: status={status}, success={result.success}, '
            f'ctrl_code={result.ctrl_code}, '
            f'response_can_id={result.response_can_id}, '
            f'message={result.message}, feedback_count={self.feedback_count}',
        )
        return 0

    def _feedback(self, message) -> None:
        self.feedback_count += 1
        feedback = message.feedback
        self.get_logger().info(
            f'Feedback: stage={feedback.stage}, attempt={feedback.attempt}, '
            f'detail={feedback.detail}',
        )


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        'mode',
        choices=('failure', 'cancel'),
        nargs='?',
        default='failure',
        help=argparse.SUPPRESS,
    )
    parser.add_argument('--cancel-after-sec', type=float, default=0.8)
    return parser.parse_args()


def main(*, mode: str | None = None) -> None:
    args = _arguments()
    if mode is not None:
        args.mode = mode
    rclpy.init()
    action_name = (
        FAILURE_ACTION_NAME if args.mode == 'failure' else CANCEL_ACTION_NAME
    )
    node = DemoCanControlOutcomeClient(action_name)
    try:
        exit_code = node.run(
            cancel_after_sec=(
                None if args.mode == 'failure' else args.cancel_after_sec
            ),
        )
    finally:
        node.destroy_node()
        rclpy.shutdown()
    raise SystemExit(exit_code)


if __name__ == '__main__':
    main()

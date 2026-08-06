#!/usr/bin/env python3

"""CanControl 실패·실행 취소 상태를 Dashboard에서 확인하는 demo server."""

from __future__ import annotations

import time

import rclpy
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node

from ros2_dashboard_demo_nodes.demo_interface_imports import import_demo_interface


CanControl = import_demo_interface(
    'action',
    'CanControl',
    ['rths_interfaces'],
)

FAILURE_ACTION_NAME = '/CanControlFailure'
CANCEL_ACTION_NAME = '/CanControlCancel'


class DemoCanControlOutcomeServer(Node):
    """실패 Action과 취소 가능한 Action을 함께 제공한다."""

    def __init__(self) -> None:
        super().__init__('demo_can_control_outcome_server')
        callback_group = ReentrantCallbackGroup()
        self._failure_server = ActionServer(
            self,
            CanControl,
            FAILURE_ACTION_NAME,
            execute_callback=self._execute_failure,
            goal_callback=self._accept_goal,
            callback_group=callback_group,
        )
        self._cancel_server = ActionServer(
            self,
            CanControl,
            CANCEL_ACTION_NAME,
            execute_callback=self._execute_cancel,
            goal_callback=self._accept_goal,
            cancel_callback=self._accept_cancel,
            callback_group=callback_group,
        )
        self.get_logger().info(
            'CanControl outcome demo started: '
            f'{FAILURE_ACTION_NAME}, {CANCEL_ACTION_NAME}',
        )

    def _accept_goal(self, request: CanControl.Goal) -> GoalResponse:
        self.get_logger().info(
            'Goal accepted: '
            f'node_id={request.node_id}, port={request.port}, '
            f'value={request.value}, retries={request.retries}, '
            f'timeout_ms={request.timeout_ms}',
        )
        return GoalResponse.ACCEPT

    def _accept_cancel(self, _goal_handle) -> CancelResponse:
        self.get_logger().warning('Cancel request accepted')
        return CancelResponse.ACCEPT

    def _execute_failure(self, goal_handle) -> CanControl.Result:
        for attempt in range(1, 4):
            self._publish_feedback(
                goal_handle,
                stage='retrying',
                attempt=attempt,
                detail=f'demo communication failure {attempt}/3',
            )
            time.sleep(0.4)

        goal_handle.abort()
        result = self._result(
            success=False,
            ctrl_code=2,
            message='demo failure: CAN response timeout',
        )
        self.get_logger().error(f'Failure result: {result.message}')
        return result

    def _execute_cancel(self, goal_handle) -> CanControl.Result:
        for attempt in range(1, 31):
            if goal_handle.is_cancel_requested:
                goal_handle.canceled()
                result = self._result(
                    success=False,
                    ctrl_code=1,
                    message='demo canceled by client request',
                )
                self.get_logger().warning(f'Canceled result: {result.message}')
                return result

            self._publish_feedback(
                goal_handle,
                stage='executing',
                attempt=attempt,
                detail=f'waiting for cancel request {attempt}/30',
            )
            time.sleep(0.2)

        goal_handle.succeed()
        result = self._result(
            success=True,
            ctrl_code=0,
            message='demo completed without cancel request',
        )
        self.get_logger().info(f'Success result: {result.message}')
        return result

    @staticmethod
    def _publish_feedback(
        goal_handle,
        *,
        stage: str,
        attempt: int,
        detail: str,
    ) -> None:
        feedback = CanControl.Feedback()
        feedback.stage = stage
        feedback.attempt = attempt
        feedback.detail = detail
        goal_handle.publish_feedback(feedback)

    @staticmethod
    def _result(*, success: bool, ctrl_code: int, message: str):
        result = CanControl.Result()
        result.success = success
        result.ctrl_code = ctrl_code
        result.response_can_id = 0x102
        result.message = message
        return result


def main(args=None) -> None:
    rclpy.init(args=args)
    node = DemoCanControlOutcomeServer()
    executor = MultiThreadedExecutor(num_threads=4)
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        executor.shutdown()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()

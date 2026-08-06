#!/usr/bin/env python3

"""RobotControl 응답 실패·timeout을 Dashboard에서 확인하는 demo server."""

from __future__ import annotations

import time

import rclpy
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node

from ros2_dashboard_demo_nodes.demo_interface_imports import import_demo_interface


RobotControl = import_demo_interface(
    'srv',
    'RobotControl',
    ['rths_interfaces'],
)

FAILURE_SERVICE_NAME = '/RobotControlFailure'
TIMEOUT_SERVICE_NAME = '/RobotControlTimeout'
TIMEOUT_RESPONSE_DELAY_SEC = 5.0


class DemoRobotControlOutcomeServer(Node):
    """success=false 응답과 의도적으로 지연된 응답을 제공한다."""

    def __init__(self) -> None:
        super().__init__('demo_robot_control_outcome_server')
        callback_group = ReentrantCallbackGroup()
        self._failure_service = self.create_service(
            RobotControl,
            FAILURE_SERVICE_NAME,
            self._failure_response,
            callback_group=callback_group,
        )
        self._timeout_service = self.create_service(
            RobotControl,
            TIMEOUT_SERVICE_NAME,
            self._timeout_response,
            callback_group=callback_group,
        )
        self.get_logger().info(
            'RobotControl outcome demo started: '
            f'{FAILURE_SERVICE_NAME}, {TIMEOUT_SERVICE_NAME}',
        )

    def _failure_response(self, request, response):
        self.get_logger().warning(
            f'Failure request received: cmd={request.cmd}',
        )
        response.success = False
        response.result_code = 2
        response.message = 'demo failure: robot controller rejected command'
        return response

    def _timeout_response(self, request, response):
        self.get_logger().warning(
            f'Timeout request received: cmd={request.cmd}; '
            f'delaying {TIMEOUT_RESPONSE_DELAY_SEC:.1f}s',
        )
        time.sleep(TIMEOUT_RESPONSE_DELAY_SEC)
        response.success = True
        response.result_code = 0
        response.message = 'demo delayed response completed'
        self.get_logger().info('Delayed timeout response returned')
        return response


def main(args=None) -> None:
    rclpy.init(args=args)
    node = DemoRobotControlOutcomeServer()
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

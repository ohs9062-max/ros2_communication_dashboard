"""RosMonitor의 rclpy Node, timer와 spin thread 생명주기를 담당합니다."""

from __future__ import annotations

from threading import Thread
from typing import Any, Callable

import rclpy
from rclpy.context import Context
from rclpy.executors import SingleThreadedExecutor
from rclpy.node import Node


MONITOR_NODE_NAME = 'ros2_dashboard_topic_monitor'
SPIN_JOIN_TIMEOUT_SEC = 2.0


def create_monitor_node(
    *,
    poll_interval_sec: float,
    update_callback: Callable[[], None],
    context: Context | None = None,
    domain_id: int | None = None,
) -> Node:
    """rclpy를 초기화하고 Graph 갱신 timer를 가진 Monitor Node를 생성합니다."""
    if context is None and domain_id is None:
        rclpy.init(args=None)
        node = Node(MONITOR_NODE_NAME)
    else:
        runtime_context = context or rclpy.get_default_context()
        rclpy.init(args=None, context=runtime_context, domain_id=domain_id)
        node = Node(MONITOR_NODE_NAME, context=runtime_context)
    node.create_timer(poll_interval_sec, update_callback)
    return node


def start_spin_thread(spin_target: Callable[[], None]) -> Thread:
    """Monitor spin을 daemon thread에서 시작합니다."""
    thread = Thread(target=spin_target, daemon=True)
    thread.start()
    return thread


def shutdown_monitor_node(
    node: Any,
    thread: Thread | None,
    *,
    context: Context | None = None,
) -> None:
    """rclpy shutdown 후 spin 종료를 기다리고 정확한 Monitor Node만 파괴합니다."""
    if context is None:
        if rclpy.ok():
            rclpy.shutdown()
    elif rclpy.ok(context=context):
        rclpy.shutdown(context=context)
    if thread is not None:
        thread.join(timeout=SPIN_JOIN_TIMEOUT_SEC)
    if node is not None:
        node.destroy_node()


def spin_monitor_node(node: Any, *, context: Context | None = None) -> None:
    """정상 shutdown 예외는 삼키고 실행 중 예외만 다시 발생시킵니다."""
    if node is None:
        return
    executor = None
    try:
        if context is None:
            rclpy.spin(node)
            return
        executor = SingleThreadedExecutor(context=context)
        executor.add_node(node)
        executor.spin()
    except rclpy.executors.ExternalShutdownException:
        pass
    except Exception:
        if rclpy.ok(context=context):
            raise
    finally:
        if executor is not None:
            executor.remove_node(node)
            executor.shutdown(timeout_sec=SPIN_JOIN_TIMEOUT_SEC)

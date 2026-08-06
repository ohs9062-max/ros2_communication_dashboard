"""Topic 실행 runtime의 정책 검증과 표시 helper."""

from __future__ import annotations

from typing import Any, Callable


DEFAULT_TOPIC_HISTORY_LIMIT = 500
MAX_TOPIC_HISTORY_LIMIT = 500
MAX_PUBLISH_HISTORY_ITEMS = 100
DEFAULT_CONTINUOUS_PUBLISH_HZ = 10.0
MIN_CONTINUOUS_PUBLISH_HZ = 0.1
MAX_CONTINUOUS_PUBLISH_HZ = 50.0


class InterfaceReceiveError(ValueError):
    """Interface Lab Topic 실행 요청이 유효하지 않을 때 발생합니다."""


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


def normalize_limit(value: int) -> int:
    try:
        limit = int(value)
    except (TypeError, ValueError):
        limit = DEFAULT_TOPIC_HISTORY_LIMIT
    return max(1, min(limit, MAX_TOPIC_HISTORY_LIMIT))


def normalize_publish_hz(value: float) -> float:
    try:
        hz = float(value)
    except (TypeError, ValueError) as exc:
        raise InterfaceReceiveError('hz는 숫자여야 합니다.') from exc
    if hz < MIN_CONTINUOUS_PUBLISH_HZ or hz > MAX_CONTINUOUS_PUBLISH_HZ:
        raise InterfaceReceiveError(
            f'hz는 {MIN_CONTINUOUS_PUBLISH_HZ:g} 이상 {MAX_CONTINUOUS_PUBLISH_HZ:g} 이하여야 합니다.',
        )
    return hz


def default_qos(_topic_type: str) -> int:
    return 10


def qos_info(topic_type: str) -> dict[str, Any]:
    return {
        'depth': 10,
        'profile': 'sensor_data_hint' if topic_type.startswith('sensor_msgs/msg/') else 'default',
        'reliability': 'default',
        'durability': 'default',
    }


def safe_count(callback: Callable[[], int]) -> int:
    try:
        return int(callback())
    except Exception:
        return 0


def is_action_internal_topic(topic_name: str) -> bool:
    return '/_action/' in topic_name or topic_name.endswith('/_action')

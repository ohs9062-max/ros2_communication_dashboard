"""Topic latest/Hz 조회에 필요한 import, QoS, 응답 조립 helper입니다."""

from __future__ import annotations

from importlib import import_module
from time import time
from typing import Any

from rclpy.qos import QoSProfile, qos_profile_sensor_data

from ros2_dashboard_monitor.qos import choose_topic_qos
from ros2_dashboard_monitor.ros2_topic.hz import (
    build_hz_snapshot,
    recent_timestamps,
)
from ros2_dashboard_monitor.ros2_topic.models import SENSOR_PREVIEW_TYPES


def load_message_class(topic_type: str) -> type | None:
    """정규 ROS Message type 문자열에서 생성된 Python class를 불러옵니다."""
    parts = topic_type.split('/')
    if len(parts) != 3 or parts[1] != 'msg':
        return None

    try:
        module = import_module(f'{parts[0]}.msg')
    except ImportError:
        return None
    return getattr(module, parts[2], None)


def select_subscription_qos(
    node: Any,
    topic_name: str,
    topic_type: str,
):
    """상대 Publisher endpoint와 호환되는 Monitor subscription QoS를 선택합니다."""
    default = (
        qos_profile_sensor_data
        if topic_type in SENSOR_PREVIEW_TYPES
        else QoSProfile(depth=10)
    )
    return choose_topic_qos(
        node,
        topic_name,
        local_role='subscription',
        default_profile=default,
    )


def build_topic_hz_response(
    *,
    lock: Any,
    subscriptions: dict[str, dict[str, Any]],
    name: str,
    topic_type: str,
    window_sec: float,
    stale_timeout_sec: float,
) -> dict[str, Any]:
    """최근 수신 timestamp를 정리하고 현재 Hz/age/stale 응답을 만듭니다."""
    now = time()
    with lock:
        entry = subscriptions.get(name, {})
        timestamps = recent_timestamps(
            entry.get('timestamps', []),
            now=now,
            window_sec=window_sec,
        )
        entry['timestamps'] = timestamps
        last_received_at = entry.get('last_received_at')

    snapshot = build_hz_snapshot(
        timestamps=timestamps,
        last_received_at=last_received_at,
        window_sec=window_sec,
        stale_timeout_sec=stale_timeout_sec,
        now=now,
    )
    return hz_response(
        success=True,
        name=name,
        topic_type=topic_type,
        received=snapshot['received'],
        message_count=snapshot['message_count'],
        window_sec=snapshot['window_sec'],
        hz=snapshot['hz'],
        last_received_at=snapshot['last_received_at'],
        age_sec=snapshot['age_sec'],
        is_stale=snapshot['is_stale'],
        status=snapshot['status'],
        message='Topic Hz fetched successfully',
    )


def latest_response(
    *,
    success: bool,
    name: str,
    message: str,
    topic_type: str | None = None,
    received: bool = False,
    last_received_at: float | None = None,
    message_preview: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """기존 latest endpoint 응답 계약을 조립합니다."""
    return {
        'success': success,
        'data': {
            'name': name,
            'type': topic_type,
            'received': received,
            'last_received_at': last_received_at,
            'message_preview': message_preview,
        },
        'message': message,
    }


def hz_response(
    *,
    success: bool,
    name: str,
    message: str,
    topic_type: str | None = None,
    received: bool = False,
    message_count: int = 0,
    window_sec: float = 5.0,
    hz: float = 0.0,
    last_received_at: float | None = None,
    age_sec: float | None = None,
    is_stale: bool = False,
    status: str = 'never_received',
) -> dict[str, Any]:
    """기존 Hz endpoint 응답 계약을 조립합니다."""
    return {
        'success': success,
        'data': {
            'name': name,
            'type': topic_type,
            'received': received,
            'message_count': message_count,
            'window_sec': window_sec,
            'hz': hz,
            'last_received_at': last_received_at,
            'age_sec': age_sec,
            'is_stale': is_stale,
            'status': status,
        },
        'message': message,
    }

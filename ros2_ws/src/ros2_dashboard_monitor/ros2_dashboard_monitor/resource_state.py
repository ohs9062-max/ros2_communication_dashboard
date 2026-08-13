"""ROS2 Graph 리소스의 공통 발견/연결 끊김 상태 helper입니다."""

from __future__ import annotations

from typing import Any, Iterable


RESOURCE_STATUS_DISCONNECTED = 'disconnected'


def mark_graph_present(
    item: dict[str, Any],
    *,
    observed_at: float,
) -> dict[str, Any]:
    """현재 Graph에 존재하는 리소스의 공통 발견 정보를 기록합니다."""
    item['graph_present'] = True
    item['ever_discovered'] = True
    item['last_seen_at'] = observed_at
    item['disconnected_at'] = None
    item['graph_missing_since'] = None
    item['graph_missing_pending'] = False
    return item


def debounce_disconnected_resource(
    cached: dict[str, Any],
    *,
    detected_at: float,
    timeout_sec: float,
    count_fields: Iterable[str] = (),
) -> dict[str, Any]:
    """Graph 누락이 설정 시간을 넘기 전에는 기존 상태를 유지합니다."""
    missing_since = cached.get('graph_missing_since')
    if not isinstance(missing_since, (int, float)):
        missing_since = detected_at

    if detected_at - float(missing_since) >= timeout_sec:
        item = disconnected_resource(
            cached,
            detected_at=detected_at,
            count_fields=count_fields,
        )
        item['graph_missing_since'] = missing_since
        item['graph_missing_pending'] = False
        return item

    item = cached.copy()
    item['graph_present'] = False
    item['graph_missing_since'] = missing_since
    item['graph_missing_pending'] = True
    item['reason'] = 'resource is temporarily missing from ROS2 graph; awaiting confirmation'
    item['last_updated'] = detected_at
    for field in count_fields:
        item[field] = 0
    return item


def disconnected_resource(
    cached: dict[str, Any],
    *,
    detected_at: float,
    count_fields: Iterable[str] = (),
) -> dict[str, Any]:
    """이전에 발견됐지만 현재 Graph에서 사라진 리소스를 조립합니다."""
    item = cached.copy()
    item['status'] = RESOURCE_STATUS_DISCONNECTED
    item['reason'] = (
        'previously discovered resource is no longer visible in ROS2 graph'
    )
    item['graph_present'] = False
    item['ever_discovered'] = True
    item['disconnected_at'] = (
        cached.get('disconnected_at') or detected_at
    )
    item['last_updated'] = detected_at
    for field in count_fields:
        item[field] = 0
    return item

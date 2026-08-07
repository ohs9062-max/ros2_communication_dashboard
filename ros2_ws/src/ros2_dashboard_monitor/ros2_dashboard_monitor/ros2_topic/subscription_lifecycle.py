"""Topic monitor subscription의 생성, 소유 endpoint 판정과 정리를 담당합니다."""

from __future__ import annotations

import logging
from typing import Any, Callable

from ros2_dashboard_monitor.qos import subscription_events
from ros2_dashboard_monitor.ros2_topic.subscriptions import (
    build_subscription_entry,
    cleanup_candidates,
    has_subscription,
    remove_subscription_entry,
)


LOGGER = logging.getLogger(__name__)


def ensure_subscription(
    *,
    node: Any,
    lock: Any,
    subscriptions: dict[str, dict[str, Any]],
    name: str,
    topic_type: str,
    message_class: type,
    callback: Callable[[Any], None],
    qos_resolver: Callable[[str, str], tuple[Any, dict[str, Any]]],
) -> None:
    """동일 type subscription을 재사용하고 type 변경 시 안전하게 교체합니다."""
    if node is None:
        return

    with lock:
        entry = subscriptions.get(name)
        if has_subscription(entry, topic_type=topic_type):
            return

        if entry is not None:
            node.destroy_subscription(entry['subscription'])

        qos_profile, qos = qos_resolver(name, topic_type)
        subscription = node.create_subscription(
            message_class,
            name,
            callback,
            qos_profile,
            event_callbacks=subscription_events(
                qos,
                'topic_qos_incompatible',
            ),
        )
        subscriptions[name] = build_subscription_entry(
            topic_type=topic_type,
            subscription=subscription,
            qos=qos,
        )


def monitor_subscriber_count(
    *,
    node: Any,
    lock: Any,
    subscriptions: dict[str, dict[str, Any]],
    name: str,
    topic_type: str | None,
    action_monitor_subscriber_count: Callable[[str], int],
) -> int:
    """Graph endpoint 기준으로 Monitor가 소유한 subscription 수를 반환합니다."""
    if topic_type is None:
        return 0

    graph_count = owned_subscription_endpoint_count(node, name)
    if graph_count is not None:
        return graph_count

    with lock:
        entry = subscriptions.get(name)

    action_count = action_monitor_subscriber_count(name)
    if has_subscription(entry, topic_type=topic_type):
        return 1 + action_count
    return action_count


def owned_subscription_endpoint_count(
    node: Any,
    topic_name: str,
) -> int | None:
    """현재 Monitor Node가 소유한 Topic subscription endpoint 수를 셉니다."""
    if node is None:
        return None

    endpoint_reader = getattr(node, 'get_subscriptions_info_by_topic', None)
    get_name = getattr(node, 'get_name', None)
    get_namespace = getattr(node, 'get_namespace', None)
    if endpoint_reader is None or get_name is None or get_namespace is None:
        return None

    try:
        own_name = str(get_name())
        own_namespace = str(get_namespace() or '/')
        endpoints = endpoint_reader(topic_name)
    except Exception:
        return None

    return sum(
        1
        for endpoint in endpoints
        if (
            str(getattr(endpoint, 'node_name', '')) == own_name
            and str(getattr(endpoint, 'node_namespace', '') or '/')
            == own_namespace
        )
    )


def cleanup_disappeared_subscriptions(
    *,
    node: Any,
    lock: Any,
    subscriptions: dict[str, dict[str, Any]],
    retained_topic_names: set[str],
    now: float,
    cleanup_after_sec: float,
) -> None:
    """외부 endpoint가 사라진 뒤 유예 시간을 지난 subscription을 제거합니다."""
    if node is None:
        return

    with lock:
        candidates = cleanup_candidates(
            subscriptions,
            retained_topic_names=retained_topic_names,
            now=now,
            cleanup_after_sec=cleanup_after_sec,
        )

    for name, subscription in candidates:
        try:
            node.destroy_subscription(subscription)
        except Exception as exc:  # pragma: no cover
            LOGGER.warning(
                'Failed to destroy subscription for disappeared topic %s: %s',
                name,
                exc,
            )
            continue

        with lock:
            remove_subscription_entry(
                subscriptions,
                name=name,
                subscription=subscription,
            )

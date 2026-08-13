"""Action status/feedback subscription 생성, QoS와 정리를 담당합니다."""

from __future__ import annotations

import logging
from typing import Any, Callable

from rclpy.qos import (
    QoSProfile,
    qos_profile_action_status_default,
)

from ros2_dashboard_monitor.qos import (
    choose_topic_qos,
    observe_topic_qos,
    qos_state,
    subscription_events,
)
from ros2_dashboard_monitor.ros2_action.subscriptions import (
    load_feedback_message_class,
    load_status_message_class,
)


LOGGER = logging.getLogger(__name__)


def action_capabilities(entry: dict[str, Any] | None) -> dict[str, Any]:
    """Subscription entry에서 Action 공개 capability/QoS 상태를 복사합니다."""
    if entry is None:
        return {
            'status_supported': False,
            'feedback_supported': False,
            'feedback_reason': 'action monitor is not running',
            'result_supported': False,
            'result_policy': None,
            'result_reason': 'action monitor is not running',
            'qos': {},
        }
    return {
        'status_supported': bool(entry.get('status_supported')),
        'feedback_supported': bool(entry.get('feedback_supported')),
        'feedback_reason': entry.get('feedback_reason'),
        'result_supported': bool(entry.get('result_supported')),
        'result_policy': entry.get('result_policy'),
        'result_reason': entry.get('result_reason'),
        'qos': entry.get('qos', {}),
    }


def default_action_qos() -> dict[str, Any]:
    """Action 내부 service 3개와 topic 2개의 초기 QoS 상태를 만듭니다."""
    service = qos_state(
        status='unknown',
        source='graph_unavailable',
        local=None,
        reason='Action Service endpoint QoS could not be discovered from the ROS2 graph.',
        qos_visibility='graph_unavailable',
    )
    return {
        'goal': service,
        'result': service.copy(),
        'cancel': service.copy(),
        'feedback': qos_state(
            status='unknown', source='unavailable', local=None,
        ),
        'status': qos_state(
            status='unknown', source='unavailable', local=None,
        ),
    }


def observe_action_qos(
    node: Any,
    name: str,
    service_qos_getter: Callable[[str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Action을 3개 Service와 2개 Topic으로 나눠 Graph 관찰 결과를 반환합니다."""
    qos = default_action_qos()
    if service_qos_getter is not None:
        qos['goal'] = service_qos_getter(f'{name}/_action/send_goal')
        qos['result'] = service_qos_getter(f'{name}/_action/get_result')
        qos['cancel'] = service_qos_getter(f'{name}/_action/cancel_goal')
    qos['feedback'] = observe_topic_qos(node, f'{name}/_action/feedback')
    qos['status'] = observe_topic_qos(node, f'{name}/_action/status')
    return qos


def merge_action_topic_local_qos(
    observed: dict[str, Any],
    applied: dict[str, Any],
) -> dict[str, Any]:
    """실제로 생성된 Feedback/Status subscription QoS만 관찰 결과에 합칩니다."""
    for part in ('feedback', 'status'):
        target = observed.get(part)
        source = applied.get(part)
        if not isinstance(target, dict) or not isinstance(source, dict):
            continue
        if source.get('local_qos') is not None:
            target['local_qos'] = source['local_qos']
            target['qos_auto_applied'] = bool(source.get('qos_auto_applied'))
            target['qos_fallback_policies'] = source.get(
                'qos_fallback_policies', [],
            )
        if source.get('qos_status') == 'incompatible':
            target.update({
                key: source.get(key)
                for key in (
                    'qos_status',
                    'qos_detection_source',
                    'mismatch_policies',
                    'mismatch_reason',
                    'qos_error_type',
                    'compatible_endpoint_count',
                    'remote_endpoint_count',
                )
                if key in source
            })
    return observed


def create_status_subscription(
    *,
    node: Any,
    name: str,
    entry: dict[str, Any],
    enabled: bool,
    callback: Callable[[Any], None],
) -> bool:
    """Action status topic의 상대 endpoint QoS를 적용해 subscription을 생성합니다."""
    if node is None or not enabled:
        return False
    message_class = load_status_message_class()
    if message_class is None:
        return False

    topic_name = f'{name}/_action/status'
    try:
        qos_profile, qos = choose_topic_qos(
            node,
            topic_name,
            local_role='subscription',
            default_profile=qos_profile_action_status_default,
        )
        if qos.get('qos_status') == 'incompatible':
            qos['qos_error_type'] = 'action_status_qos_incompatible'
        subscription = node.create_subscription(
            message_class,
            topic_name,
            callback,
            qos_profile,
            event_callbacks=subscription_events(
                qos, 'action_status_qos_incompatible',
            ),
        )
    except Exception as exc:  # pragma: no cover
        LOGGER.warning(
            'Failed to subscribe action status topic %s: %s', name, exc,
        )
        return False

    entry['status_subscription'] = subscription
    entry.setdefault('qos', default_action_qos())['status'] = qos
    return True


def create_feedback_subscription(
    *,
    node: Any,
    name: str,
    action_type: str | None,
    entry: dict[str, Any],
    enabled: bool,
    callback: Callable[[Any], None],
) -> bool:
    """Action feedback topic의 상대 endpoint QoS를 적용해 subscription을 생성합니다."""
    if node is None:
        return False
    if not enabled:
        entry['feedback_reason'] = 'feedback monitoring disabled'
        return False

    message_class = load_feedback_message_class(action_type)
    if message_class is None:
        entry['feedback_reason'] = 'failed to import feedback message class'
        return False

    topic_name = f'{name}/_action/feedback'
    try:
        qos_profile, qos = choose_topic_qos(
            node,
            topic_name,
            local_role='subscription',
            default_profile=QoSProfile(depth=10),
        )
        if qos.get('qos_status') == 'incompatible':
            qos['qos_error_type'] = 'action_feedback_qos_incompatible'
        subscription = node.create_subscription(
            message_class,
            topic_name,
            callback,
            qos_profile,
            event_callbacks=subscription_events(
                qos, 'action_feedback_qos_incompatible',
            ),
        )
    except Exception as exc:  # pragma: no cover
        LOGGER.warning(
            'Failed to subscribe action feedback topic %s: %s', name, exc,
        )
        return False

    entry['feedback_subscription'] = subscription
    entry.setdefault('qos', default_action_qos())['feedback'] = qos
    entry['feedback_reason'] = None
    return True


def monitor_subscription_count(
    entries: list[tuple[str, dict[str, Any]]],
    topic_name: str,
) -> int:
    """Action status/feedback 관찰용 내부 subscription endpoint 수를 셉니다."""
    count = 0
    for action_name, entry in entries:
        if (
            topic_name == f'{action_name}/_action/status'
            and entry.get('status_subscription') is not None
        ):
            count += 1
        if (
            topic_name == f'{action_name}/_action/feedback'
            and entry.get('feedback_subscription') is not None
        ):
            count += 1
    return count


def destroy_entry_subscriptions(node: Any, entry: dict[str, Any]) -> None:
    """Action entry가 소유한 status/feedback subscription을 정리합니다."""
    if node is None:
        return
    for key in ('status_subscription', 'feedback_subscription'):
        subscription = entry.get(key)
        if subscription is None:
            continue
        try:
            node.destroy_subscription(subscription)
        except Exception as exc:  # pragma: no cover
            LOGGER.warning('Failed to destroy action subscription: %s', exc)

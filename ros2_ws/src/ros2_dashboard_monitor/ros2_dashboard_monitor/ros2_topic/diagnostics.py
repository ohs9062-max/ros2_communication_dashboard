"""기존 Topic Graph·수신·QoS 상태를 사용자용 원인 요약으로 연결합니다."""

from __future__ import annotations

from typing import Any


def reception_diagnosis(
    *,
    topic: dict[str, Any],
    subscription: dict[str, Any] | None,
    subscription_error: str | None,
    observed_at: float,
    stale_timeout_sec: float,
) -> dict[str, Any] | None:
    """미수신 또는 stale일 때만 기존 판정 근거를 조합해 반환합니다."""
    subscription = subscription or {}
    subscription_created = bool(subscription)
    if (
        not subscription_created
        and not subscription_error
        and topic.get('hz_monitoring_status') != 'subscription_failed'
    ):
        return None
    last_received_at = subscription.get('last_received_at')
    if last_received_at is None:
        reception_status = 'never_received'
    elif observed_at - float(last_received_at) > stale_timeout_sec:
        reception_status = 'stale'
    else:
        return None

    publisher_present = int(topic.get('publisher_count') or 0) > 0
    qos = subscription.get('qos') or topic
    qos_status = str(qos.get('qos_status') or 'unknown').lower()
    graph_qos_status = str(qos.get('graph_qos_status') or topic.get('graph_qos_status') or '').lower()
    displayed_qos_status = (
        'incompatible' if graph_qos_status == 'incompatible' else qos_status
    )
    source = str(qos.get('qos_detection_source') or 'unavailable')
    mismatch_policies = list(qos.get('mismatch_policies') or topic.get('mismatch_policies') or [])

    base = {
        'reception_status': reception_status,
        'publisher_present': publisher_present,
        'subscription_created': subscription_created,
        'qos_status': displayed_qos_status,
        'qos_detection_source': source,
        'mismatch_policies': mismatch_policies,
        'local_qos': qos.get('local_qos'),
        'remote_qos': qos.get('remote_qos') or topic.get('publisher_qos') or [],
        'related_alert_ids': [],
    }

    if subscription_error or topic.get('hz_monitoring_status') == 'subscription_failed':
        return base | {
            'cause': 'subscription_failed',
            'certainty': 'confirmed',
            'message': f'Dashboard Subscription 생성에 실패했습니다.{_suffix(subscription_error)}',
        }

    if reception_status == 'stale':
        if publisher_present:
            return base | {
                'cause': 'publisher_data_stopped',
                'certainty': 'candidate',
                'message': 'Publisher는 Graph에 있지만 데이터 수신이 중단되었습니다.',
            }
        return base | {
            'cause': 'publisher_missing',
            'certainty': 'candidate',
            'message': 'Publisher가 Graph에서 보이지 않아 이탈 또는 중단 가능성이 있습니다.',
        }

    if not publisher_present:
        return base | {
            'cause': 'publisher_missing',
            'certainty': 'candidate',
            'message': 'Publisher가 Graph에서 보이지 않아 메시지를 수신할 수 없습니다.',
        }

    if source == 'incompatible_qos_event':
        return base | {
            'cause': 'qos_incompatible',
            'certainty': 'confirmed',
            'message': 'QoS 불일치로 메시지를 수신할 수 없습니다.',
            'related_alert_ids': [
                f'topic:{topic.get("name", "")}:topic_qos_incompatible',
            ],
        }
    if qos_status == 'incompatible' or graph_qos_status == 'incompatible':
        return base | {
            'cause': 'qos_incompatible',
            'certainty': 'candidate',
            'message': (
                'Publisher와 Dashboard Subscription의 QoS가 호환되지 않아 '
                '미수신일 가능성이 높습니다.'
            ),
            'related_alert_ids': [
                f'topic:{topic.get("name", "")}:topic_qos_incompatible',
            ],
        }
    if qos_status == 'compatible':
        return base | {
            'cause': 'non_qos_receive_path',
            'certainty': 'candidate',
            'message': (
                'QoS는 호환됩니다. Publisher 실제 발행 여부 또는 '
                'Subscription callback·타입 상태를 확인하세요.'
            ),
        }
    return base | {
        'cause': 'qos_unconfirmed',
        'certainty': 'unknown',
        'message': 'QoS 상태를 확인할 수 없어 미수신 원인을 판단할 수 없습니다.',
    }


def _suffix(value: str | None) -> str:
    return f' 사유: {value}' if value else ''

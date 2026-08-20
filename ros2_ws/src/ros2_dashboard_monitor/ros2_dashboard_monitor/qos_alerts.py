"""Create and confirm QoS alerts from already-computed resource state."""

from __future__ import annotations

from typing import Any


ACTION_CHANNEL_LABELS = {
    'goal': 'Goal Service',
    'result': 'Result Service',
    'cancel': 'Cancel Service',
    'feedback': 'Feedback Topic',
    'status': 'Status Topic',
}


def build_qos_alert_candidates(
    *,
    topics: list[dict[str, Any]],
    services: list[dict[str, Any]],
    actions: list[dict[str, Any]],
    detected_at: float,
) -> list[dict[str, Any]]:
    """Return only explicit incompatible states for monitored resources."""
    candidates: list[dict[str, Any]] = []
    for topic in topics:
        if not _topic_is_alert_target(topic):
            continue
        state = _incompatible_state(topic)
        if state is not None:
            candidates.append(_alert(
                resource=topic,
                state=state,
                source='topic',
                code='topic_qos_incompatible',
                message=_topic_message(state),
                detected_at=detected_at,
            ))

    for service in services:
        if not _service_is_alert_target(service):
            continue
        state = _incompatible_state(service)
        if state is not None:
            candidates.append(_alert(
                resource=service,
                state=state,
                source='service',
                code='service_qos_incompatible',
                message=_resource_message('Service', state),
                detected_at=detected_at,
            ))

    for action in actions:
        if not _action_is_alert_target(action):
            continue
        qos = action.get('qos') or {}
        for channel, label in ACTION_CHANNEL_LABELS.items():
            state = _incompatible_state(qos.get(channel) or {})
            if state is None:
                continue
            candidates.append(_alert(
                resource=action,
                state=state,
                source='action',
                code='action_qos_incompatible',
                channel=channel,
                message=f'Action {label} QoS is incompatible.{_state_suffix(state)}',
                detected_at=detected_at,
            ))
    return candidates


def confirm_qos_alerts(
    candidates: list[dict[str, Any]],
    *,
    confirmation_state: dict[str, dict[str, Any]],
    required_count: int,
) -> list[dict[str, Any]]:
    """Require incompatible state across distinct graph observations."""
    candidate_ids = {candidate['id'] for candidate in candidates}
    for alert_id in list(confirmation_state):
        if alert_id not in candidate_ids:
            confirmation_state.pop(alert_id, None)

    confirmed = []
    for candidate in candidates:
        alert_id = candidate['id']
        token = candidate.pop('_qos_observation_token', None)
        state = confirmation_state.setdefault(alert_id, {
            'count': 0,
            'last_token': object(),
        })
        if token != state['last_token']:
            state['count'] += 1
            state['last_token'] = token
        if state['count'] >= max(1, required_count):
            confirmed.append(candidate)
    return confirmed


def _incompatible_state(qos: dict[str, Any]) -> dict[str, Any] | None:
    if qos.get('qos_status') == 'incompatible':
        return qos
    if qos.get('graph_qos_status') == 'incompatible':
        return {
            **qos,
            'qos_status': 'incompatible',
            'qos_detection_source': qos.get(
                'graph_qos_detection_source', 'graph_endpoint_info',
            ),
            'mismatch_reason': qos.get('graph_mismatch_reason'),
        }
    return None


def _topic_is_alert_target(topic: dict[str, Any]) -> bool:
    return (
        topic.get('graph_present') is not False
        and topic.get('monitoring_role') != 'command'
        and bool(topic.get('is_primary') or topic.get('primary'))
    )


def _service_is_alert_target(service: dict[str, Any]) -> bool:
    return (
        service.get('graph_present') is not False
        and service.get('hidden_by_default') is not True
        and bool(service.get('is_primary') or service.get('primary'))
    )


def _action_is_alert_target(action: dict[str, Any]) -> bool:
    return (
        action.get('graph_present') is not False
        and bool(action.get('is_primary') or action.get('primary'))
    )


def _alert(
    *,
    resource: dict[str, Any],
    state: dict[str, Any],
    source: str,
    code: str,
    message: str,
    detected_at: float,
    channel: str | None = None,
) -> dict[str, Any]:
    name = str(resource.get('name') or '')
    suffix = f':{channel}' if channel else ''
    alert = {
        'id': f'{source}:{name}:{code}{suffix}',
        'level': _alert_level(state),
        'source': source,
        'name': name,
        'code': code,
        'message': message,
        'status': 'incompatible',
        'last_received_at': None,
        'age_sec': None,
        'detected_at': detected_at,
        'mismatch_policies': list(state.get('mismatch_policies') or []),
        '_qos_observation_token': resource.get('last_updated') or resource.get('updated_at') or detected_at,
    }
    if channel:
        alert['channel'] = channel
    return alert


def _alert_level(state: dict[str, Any]) -> str:
    if state.get('qos_detection_source') == 'incompatible_qos_event':
        return 'error'
    compatible = state.get('compatible_endpoint_count')
    total = state.get('remote_endpoint_count')
    if compatible == 0 and isinstance(total, int) and total > 0:
        return 'error'
    return 'warning'


def _topic_message(state: dict[str, Any]) -> str:
    pairs = state.get('endpoint_pair_count')
    mismatches = state.get('incompatible_endpoint_pair_count')
    pair_text = ''
    if isinstance(pairs, int) and isinstance(mismatches, int):
        pair_text = f' (incompatible endpoint pairs: {mismatches}/{pairs})'
    return f'Some Topic endpoints have incompatible QoS settings.{pair_text}{_state_suffix(state)}'


def _resource_message(label: str, state: dict[str, Any]) -> str:
    return f'{label} QoS incompatibility detected.{_state_suffix(state)}'


def _state_suffix(state: dict[str, Any]) -> str:
    policies = list(state.get('mismatch_policies') or [])
    return f' Policies: {", ".join(policies)}.' if policies else ''

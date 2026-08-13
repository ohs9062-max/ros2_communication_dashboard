"""ROS2 QoS profile 직렬화, 비교와 Topic endpoint 기반 자동 선택."""

from __future__ import annotations

from typing import Any, Iterable, Literal

from rclpy.event_handler import PublisherEventCallbacks, SubscriptionEventCallbacks
from rclpy.qos import QoSCompatibility, QoSProfile, qos_check_compatible


def qos_profile_dict(profile: QoSProfile | None) -> dict[str, Any] | None:
    if profile is None:
        return None
    def policy(name: str) -> str:
        value = getattr(profile, name, None)
        return str(getattr(value, 'name', value)).lower()
    return {
        'history': policy('history'),
        'depth': int(getattr(profile, 'depth', 0)),
        'reliability': policy('reliability'),
        'durability': policy('durability'),
        'deadline_ns': _duration_ns(getattr(profile, 'deadline', None)),
        'lifespan_ns': _duration_ns(getattr(profile, 'lifespan', None)),
        'liveliness': policy('liveliness'),
        'liveliness_lease_duration_ns': _duration_ns(
            getattr(profile, 'liveliness_lease_duration', None),
        ),
    }


def endpoint_qos(node: Any, topic_name: str, endpoint_kind: Literal['publishers', 'subscriptions']) -> list[dict[str, Any]]:
    reader = getattr(node, f'get_{endpoint_kind}_info_by_topic', None)
    if reader is None:
        return []
    try:
        endpoints = reader(topic_name)
    except Exception:
        return []
    own_name = _node_identity(node, 'get_name')
    own_namespace = _node_identity(node, 'get_namespace', fallback='/')
    return [{
        'topic_name': topic_name,
        'node_name': str(getattr(endpoint, 'node_name', '')),
        'node_namespace': str(getattr(endpoint, 'node_namespace', '') or '/'),
        'topic_type': str(getattr(endpoint, 'topic_type', '')),
        'endpoint_kind': endpoint_kind,
        'gid': (gid := _endpoint_gid(getattr(endpoint, 'endpoint_gid', None))),
        'participant_id': _participant_id_from_gid(gid),
        'dashboard_owned': (
            own_name is not None
            and str(getattr(endpoint, 'node_name', '')) == own_name
            and str(getattr(endpoint, 'node_namespace', '') or '/')
            == own_namespace
        ),
        'qos': qos_profile_dict(getattr(endpoint, 'qos_profile', None)),
        '_profile': getattr(endpoint, 'qos_profile', None),
    } for endpoint in endpoints if getattr(endpoint, 'qos_profile', None) is not None]


def observe_topic_qos(node: Any, topic_name: str) -> dict[str, Any]:
    """Graph endpoint만 읽어 Topic 양방향 QoS와 확정 가능한 불일치를 반환합니다."""
    publishers = endpoint_qos(node, topic_name, 'publishers')
    subscriptions = endpoint_qos(node, topic_name, 'subscriptions')
    public_publishers = _public_endpoints(publishers)
    public_subscriptions = _public_endpoints(subscriptions)
    reasons = []
    for publisher in publishers:
        for subscription in subscriptions:
            result, reason = qos_check_compatible(
                publisher['_profile'], subscription['_profile'],
            )
            if result == QoSCompatibility.ERROR and reason:
                reasons.append(reason)

    if reasons:
        status = 'incompatible'
        reason = '; '.join(dict.fromkeys(reasons))
    elif publishers and subscriptions:
        status = 'compatible'
        reason = None
    elif publishers or subscriptions:
        status = 'observed'
        reason = 'QoS was discovered for only one side of the Topic endpoints.'
    else:
        status = 'unknown'
        reason = 'Topic endpoint QoS could not be discovered from the ROS2 graph.'

    return qos_state(
        status=status,
        source='graph_endpoint_info' if status != 'unknown' else 'graph_unavailable',
        local=None,
        remote=[*public_publishers, *public_subscriptions],
        mismatch_policies=_mismatch_policies(reasons),
        reason=reason,
        publisher_qos=public_publishers,
        subscriber_qos=public_subscriptions,
        graph_qos_status=status,
        graph_qos_detection_source=(
            'graph_endpoint_info' if status != 'unknown' else 'graph_unavailable'
        ),
        graph_mismatch_reason=reason if reasons else None,
        endpoint_pair_count=len(publishers) * len(subscriptions),
        incompatible_endpoint_pair_count=len(reasons),
    )


def choose_topic_qos(
    node: Any,
    topic_name: str,
    *,
    local_role: Literal['publisher', 'subscription'],
    default_profile: QoSProfile,
) -> tuple[QoSProfile, dict[str, Any]]:
    remote_kind = 'subscriptions' if local_role == 'publisher' else 'publishers'
    endpoints = [
        endpoint for endpoint in endpoint_qos(node, topic_name, remote_kind)
        if endpoint.get('dashboard_owned') is not True
    ]
    profiles = [item['_profile'] for item in endpoints]
    public_endpoints = _public_endpoints(endpoints)
    if not profiles:
        return clone_qos_profile(default_profile), qos_state(
            status='unknown', source='default_profile', local=default_profile,
            remote=public_endpoints, auto_applied=False,
            reason='Remote Topic endpoint QoS could not be discovered. The default profile is used.',
            qos_fallback_policies=['profile'],
        )

    candidates = _unique_profiles([
        *(normalize_qos_profile(profile, default_profile) for profile in profiles),
        normalize_qos_profile(default_profile, default_profile),
    ])
    ranked: list[tuple[int, int, QoSProfile, list[str]]] = []
    for index, candidate in enumerate(candidates):
        reasons = []
        compatible = 0
        for remote in profiles:
            publisher, subscription = (
                (candidate, remote) if local_role == 'publisher' else (remote, candidate)
            )
            result, reason = qos_check_compatible(publisher, subscription)
            if result == QoSCompatibility.ERROR:
                reasons.append(reason)
            else:
                compatible += 1
        ranked.append((compatible, -index, candidate, reasons))
    compatible_count, _, selected, reasons = max(ranked, key=lambda item: (item[0], item[1]))
    total = len(profiles)
    status = 'compatible' if compatible_count == total else ('partial' if compatible_count else 'incompatible')
    mismatch_policies = _mismatch_policies(reasons)
    fallback_policies = _selected_fallback_policies(
        selected,
        profiles=profiles,
        fallback=default_profile,
    )
    return clone_qos_profile(selected), qos_state(
        status=status,
        source='graph_profile_comparison',
        local=selected,
        remote=public_endpoints,
        mismatch_policies=mismatch_policies,
        reason='; '.join(dict.fromkeys(reason for reason in reasons if reason)) or None,
        auto_applied=True,
        qos_fallback_policies=fallback_policies,
        compatible_endpoint_count=compatible_count,
        remote_endpoint_count=total,
        qos_error_type='topic_qos_incompatible' if status == 'incompatible' else None,
    )


def qos_state(
    *, status: str, source: str, local: QoSProfile | None,
    remote: Any = None, mismatch_policies: Iterable[str] = (),
    reason: str | None = None, auto_applied: bool = False, **extra: Any,
) -> dict[str, Any]:
    return {
        'qos_status': status,
        'qos_detection_source': source,
        'local_qos': qos_profile_dict(local),
        'remote_qos': remote if remote is not None else [],
        'mismatch_policies': list(dict.fromkeys(mismatch_policies)),
        'mismatch_reason': reason,
        'qos_auto_applied': auto_applied,
        **extra,
    }


def incompatible_qos_callback(state: dict[str, Any], error_type: str):
    """DDS/RMW incompatible QoS event를 공통 상태 모델에 반영합니다."""
    def callback(event: Any) -> None:
        policy = str(getattr(event, 'last_policy_kind', 'unknown')).lower()
        state.update({
            'qos_status': 'incompatible',
            'qos_detection_source': 'incompatible_qos_event',
            'mismatch_policies': [policy],
            'mismatch_reason': f'RMW incompatible QoS event (policy={policy})',
            'qos_error_type': error_type,
        })
    return callback


def subscription_events(state: dict[str, Any], error_type: str) -> SubscriptionEventCallbacks:
    return SubscriptionEventCallbacks(
        incompatible_qos=incompatible_qos_callback(state, error_type),
    )


def publisher_events(state: dict[str, Any], error_type: str) -> PublisherEventCallbacks:
    return PublisherEventCallbacks(
        incompatible_qos=incompatible_qos_callback(state, error_type),
    )


def clone_qos_profile(profile: QoSProfile) -> QoSProfile:
    return QoSProfile(
        history=profile.history,
        depth=profile.depth,
        reliability=profile.reliability,
        durability=profile.durability,
        lifespan=profile.lifespan,
        deadline=profile.deadline,
        liveliness=profile.liveliness,
        liveliness_lease_duration=profile.liveliness_lease_duration,
        avoid_ros_namespace_conventions=profile.avoid_ros_namespace_conventions,
    )


def normalize_qos_profile(profile: QoSProfile, fallback: QoSProfile) -> QoSProfile:
    """Graph 조회 전용 UNKNOWN 정책을 endpoint 생성 가능한 값으로 치환합니다."""
    def resolved(name: str):
        value = getattr(profile, name)
        if str(getattr(value, 'name', value)).upper() in {'UNKNOWN', 'SYSTEM_DEFAULT'}:
            return getattr(fallback, name)
        return value
    return QoSProfile(
        history=resolved('history'),
        depth=profile.depth if int(profile.depth) > 0 else fallback.depth,
        reliability=resolved('reliability'),
        durability=resolved('durability'),
        lifespan=profile.lifespan,
        deadline=profile.deadline,
        liveliness=resolved('liveliness'),
        liveliness_lease_duration=profile.liveliness_lease_duration,
        avoid_ros_namespace_conventions=profile.avoid_ros_namespace_conventions,
    )


def _unique_profiles(profiles: Iterable[QoSProfile]) -> list[QoSProfile]:
    unique: list[QoSProfile] = []
    seen = set()
    for profile in profiles:
        key = repr(qos_profile_dict(profile))
        if key not in seen:
            seen.add(key)
            unique.append(profile)
    return unique


def _mismatch_policies(reasons: Iterable[str]) -> list[str]:
    text = ' '.join(reasons).lower()
    policy_terms = {
        'reliability': ('reliability', 'reliable', 'best effort'),
        'durability': ('durability', 'transient local', 'volatile'),
        'deadline': ('deadline',),
        'liveliness': ('liveliness',),
    }
    return [
        policy
        for policy, terms in policy_terms.items()
        if any(term in text for term in terms)
    ]


def _duration_ns(value: Any) -> int | None:
    nanoseconds = getattr(value, 'nanoseconds', None)
    return int(nanoseconds) if nanoseconds is not None else None


def _selected_fallback_policies(
    selected: QoSProfile,
    *,
    profiles: Iterable[QoSProfile],
    fallback: QoSProfile,
) -> list[str]:
    selected_dict = qos_profile_dict(selected)
    for profile in profiles:
        if qos_profile_dict(normalize_qos_profile(profile, fallback)) == selected_dict:
            return _unknown_creation_policies(profile)
    return ['profile']


def _unknown_creation_policies(profile: QoSProfile) -> list[str]:
    policies = []
    for name in ('history', 'reliability', 'durability', 'liveliness'):
        value = getattr(profile, name)
        if str(getattr(value, 'name', value)).upper() in {
            'UNKNOWN', 'SYSTEM_DEFAULT',
        }:
            policies.append(name)
    if int(getattr(profile, 'depth', 0)) <= 0:
        policies.append('depth')
    return policies


def _public_endpoints(endpoints: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {key: value for key, value in item.items() if key != '_profile'}
        for item in endpoints
    ]


def _node_identity(
    node: Any,
    method_name: str,
    *,
    fallback: str | None = None,
) -> str | None:
    reader = getattr(node, method_name, None)
    if reader is None:
        return fallback
    try:
        return str(reader() or fallback)
    except Exception:
        return fallback


def _endpoint_gid(value: Any) -> str | None:
    """rclpy TopicEndpointInfo GID를 안정적인 16진수 문자열로 직렬화합니다."""
    raw = getattr(value, 'data', value)
    if raw is None:
        return None
    try:
        octets = bytes(raw)
    except (TypeError, ValueError):
        return str(raw) or None
    return ''.join(f'{octet:02x}' for octet in octets) or None


def _participant_id_from_gid(gid: str | None) -> str | None:
    """DDS GUID prefix에 해당하는 Topic GID 앞 12 byte를 별도 identity로 제공합니다."""
    return gid[:24] if gid and len(gid) >= 24 else None

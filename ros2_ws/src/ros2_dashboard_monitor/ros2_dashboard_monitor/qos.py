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
    return [{
        'node_name': str(getattr(endpoint, 'node_name', '')),
        'node_namespace': str(getattr(endpoint, 'node_namespace', '') or '/'),
        'topic_type': str(getattr(endpoint, 'topic_type', '')),
        'qos': qos_profile_dict(getattr(endpoint, 'qos_profile', None)),
        '_profile': getattr(endpoint, 'qos_profile', None),
    } for endpoint in endpoints if getattr(endpoint, 'qos_profile', None) is not None]


def choose_topic_qos(
    node: Any,
    topic_name: str,
    *,
    local_role: Literal['publisher', 'subscription'],
    default_profile: QoSProfile,
) -> tuple[QoSProfile, dict[str, Any]]:
    remote_kind = 'subscriptions' if local_role == 'publisher' else 'publishers'
    endpoints = endpoint_qos(node, topic_name, remote_kind)
    profiles = [item['_profile'] for item in endpoints]
    public_endpoints = [{key: value for key, value in item.items() if key != '_profile'} for item in endpoints]
    if not profiles:
        return clone_qos_profile(default_profile), qos_state(
            status='unknown', source='default_profile', local=default_profile,
            remote=public_endpoints, auto_applied=False,
            reason='상대 Topic endpoint QoS를 Graph에서 확인할 수 없어 기본 프로필을 사용합니다.',
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
    return clone_qos_profile(selected), qos_state(
        status=status,
        source='graph_profile_comparison',
        local=selected,
        remote=public_endpoints,
        mismatch_policies=mismatch_policies,
        reason='; '.join(dict.fromkeys(reason for reason in reasons if reason)) or None,
        auto_applied=True,
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
    return [name for name in ('reliability', 'durability', 'deadline', 'liveliness') if name in text]


def _duration_ns(value: Any) -> int | None:
    nanoseconds = getattr(value, 'nanoseconds', None)
    return int(nanoseconds) if nanoseconds is not None else None

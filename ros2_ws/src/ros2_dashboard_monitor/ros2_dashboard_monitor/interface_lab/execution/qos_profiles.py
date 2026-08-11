"""Interface Lab execution-only QoS request validation and profile selection."""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

from rclpy.duration import Duration
from rclpy.qos import (
    DurabilityPolicy,
    HistoryPolicy,
    LivelinessPolicy,
    QoSProfile,
    ReliabilityPolicy,
    qos_profile_services_default,
)

from ros2_dashboard_monitor.qos import choose_topic_qos, observe_topic_qos, qos_profile_dict


_INFINITE_DURATION_NS = 2 ** 63 - 1


class ExecutionQosError(ValueError):
    """Raised when an Interface Lab QoS selection is invalid."""


def qos_mode(selection: dict[str, Any] | None) -> str:
    mode = str((selection or {}).get('mode') or 'auto').strip().lower()
    if mode not in {'auto', 'manual'}:
        raise ExecutionQosError('qos.mode는 auto 또는 manual이어야 합니다.')
    return mode


def manual_qos_profile(
    selection: dict[str, Any] | None,
    *,
    profile_key: str = 'profile',
) -> QoSProfile:
    values = (selection or {}).get(profile_key)
    if not isinstance(values, dict):
        raise ExecutionQosError(f'qos.{profile_key} object가 필요합니다.')
    reliability = _enum_value(
        values.get('reliability'),
        {'reliable': ReliabilityPolicy.RELIABLE, 'best_effort': ReliabilityPolicy.BEST_EFFORT},
        f'qos.{profile_key}.reliability',
    )
    durability = _enum_value(
        values.get('durability'),
        {'volatile': DurabilityPolicy.VOLATILE, 'transient_local': DurabilityPolicy.TRANSIENT_LOCAL},
        f'qos.{profile_key}.durability',
    )
    history = _enum_value(
        values.get('history'),
        {'keep_last': HistoryPolicy.KEEP_LAST, 'keep_all': HistoryPolicy.KEEP_ALL},
        f'qos.{profile_key}.history',
    )
    try:
        depth = int(values.get('depth', 10))
    except (TypeError, ValueError) as exc:
        raise ExecutionQosError(f'qos.{profile_key}.depth는 정수여야 합니다.') from exc
    if history == HistoryPolicy.KEEP_LAST and depth <= 0:
        raise ExecutionQosError(f'qos.{profile_key}.depth는 KEEP_LAST일 때 1 이상이어야 합니다.')
    if depth < 0 or depth > 10000:
        raise ExecutionQosError(f'qos.{profile_key}.depth는 0 이상 10000 이하여야 합니다.')
    deadline = _duration_value(values.get('deadline'), f'qos.{profile_key}.deadline')
    lifespan = _duration_value(values.get('lifespan'), f'qos.{profile_key}.lifespan')
    lease_duration = _duration_value(
        values.get('lease_duration'), f'qos.{profile_key}.lease_duration',
    )
    liveliness = _optional_enum_value(
        values.get('liveliness'),
        {
            'system_default': LivelinessPolicy.SYSTEM_DEFAULT,
            'automatic': LivelinessPolicy.AUTOMATIC,
            'manual_by_topic': LivelinessPolicy.MANUAL_BY_TOPIC,
        },
        f'qos.{profile_key}.liveliness',
        LivelinessPolicy.SYSTEM_DEFAULT,
    )
    return QoSProfile(
        reliability=reliability,
        durability=durability,
        history=history,
        depth=depth if history == HistoryPolicy.KEEP_LAST else 0,
        deadline=deadline,
        lifespan=lifespan,
        liveliness=liveliness,
        liveliness_lease_duration=lease_duration,
    )


def resolve_topic_execution_qos(
    node: Any,
    topic_name: str,
    *,
    local_role: str,
    selection: dict[str, Any] | None,
    profile_key: str = 'profile',
    default_profile: QoSProfile | None = None,
) -> tuple[QoSProfile, dict[str, Any]]:
    mode = qos_mode(selection)
    if mode == 'auto':
        profile, state = choose_topic_qos(
            node,
            topic_name,
            local_role=local_role,
            default_profile=default_profile or QoSProfile(depth=10),
        )
        state = deepcopy(state)
        fallback_policies = list(state.get('qos_fallback_policies') or [])
        fallback_reason = None
        if state.get('qos_detection_source') == 'default_profile':
            fallback_reason = 'Remote QoS 확인 불가 → ROS2 기본 QoS 사용'
        elif fallback_policies:
            labels = ', '.join(policy.upper() for policy in fallback_policies)
            fallback_reason = f'Remote {labels} 확인 불가 → Dashboard 기본값 사용'
        state.update({
            'qos_mode': 'auto',
            'dashboard_qos': qos_profile_dict(profile),
            'fallback_used': fallback_reason is not None,
            'fallback_reason': fallback_reason,
        })
        return profile, state

    profile = manual_qos_profile(selection, profile_key=profile_key)
    remote = observe_topic_qos(node, topic_name)
    state = deepcopy(remote)
    state.update({
        'qos_mode': 'manual',
        'qos_detection_source': 'manual',
        'local_qos': qos_profile_dict(profile),
        'dashboard_qos': qos_profile_dict(profile),
        'fallback_used': False,
        'fallback_reason': None,
    })
    return profile, state


def resolve_service_execution_qos(
    service_name: str,
    *,
    selection: dict[str, Any] | None,
    remote_qos_getter: Callable[[str], dict[str, Any]] | None,
    profile_key: str = 'profile',
) -> tuple[QoSProfile, dict[str, Any]]:
    mode = qos_mode(selection)
    remote = (
        remote_qos_getter(service_name)
        if remote_qos_getter is not None
        else _unavailable_remote_qos()
    )
    if mode == 'manual':
        profile = manual_qos_profile(selection, profile_key=profile_key)
        return profile, _execution_state('manual', remote, profile)

    profile, fallback_reason = _compatible_service_profile(remote)
    return profile, _execution_state(
        'auto',
        remote,
        profile,
        fallback_reason=fallback_reason,
    )


def resolve_split_service_execution_qos(
    service_name: str,
    *,
    selection: dict[str, Any] | None,
    remote_qos_getter: Callable[[str], dict[str, Any]] | None,
) -> tuple[QoSProfile, dict[str, Any]]:
    if not isinstance(selection, dict) or not any(
        isinstance(selection.get(key), dict) for key in ('request', 'response')
    ):
        return resolve_service_execution_qos(
            service_name, selection=selection, remote_qos_getter=remote_qos_getter,
        )
    remote = (
        remote_qos_getter(service_name)
        if remote_qos_getter is not None
        else _unavailable_remote_qos()
    )
    request_selection = selection.get('request') or {'mode': 'auto'}
    response_selection = selection.get('response') or {'mode': 'auto'}
    request_mode = qos_mode(request_selection)
    response_mode = qos_mode(response_selection)
    if request_mode == 'auto' and response_mode == 'auto':
        profile, fallback_reason = _compatible_service_profile(remote)
        states = {
            channel: _execution_state('auto', remote, profile, fallback_reason=fallback_reason)
            for channel in ('request', 'response')
        }
        return profile, _split_service_state(remote, profile, states)

    profiles: dict[str, QoSProfile] = {}
    states: dict[str, dict[str, Any]] = {}
    for channel, channel_selection, mode in (
        ('request', request_selection, request_mode),
        ('response', response_selection, response_mode),
    ):
        if mode == 'manual':
            profile = manual_qos_profile(channel_selection)
            state = _execution_state(mode, remote, profile)
        else:
            profile, fallback_reason = _compatible_service_profile(remote, channel=channel)
            state = _execution_state(mode, remote, profile, fallback_reason=fallback_reason)
        profiles[channel] = profile
        states[channel] = state
    if profile_fingerprint(profiles['request']) != profile_fingerprint(profiles['response']):
        raise ExecutionQosError(
            'ROS2 Service Client는 Request/Response에 하나의 QoSProfile만 지원합니다. '
            '실행 QoS와 수신 QoS를 같은 값으로 맞춰주세요.',
        )
    profile = profiles['request']
    return profile, _split_service_state(remote, profile, states)


def _split_service_state(
    remote: dict[str, Any],
    profile: QoSProfile,
    states: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        'qos_mode': 'split',
        'request': states['request'],
        'response': states['response'],
        'remote_qos': deepcopy(remote),
        'dashboard_qos': qos_profile_dict(profile),
        'local_qos': qos_profile_dict(profile),
        'fallback_used': any(state.get('fallback_used') for state in states.values()),
        'fallback_reason': next(
            (state.get('fallback_reason') for state in states.values() if state.get('fallback_reason')),
            None,
        ),
    }


def action_channel_selection(
    selection: dict[str, Any] | None,
    channel: str,
    group: str,
) -> dict[str, Any] | None:
    if isinstance(selection, dict) and isinstance(selection.get(channel), dict):
        return selection[channel]
    if isinstance(selection, dict) and isinstance(selection.get(group), dict):
        return selection[group]
    if not isinstance(selection, dict):
        return selection
    mode = qos_mode(selection)
    legacy_key = 'service_profile' if group == 'service' else 'topic_profile'
    if mode == 'manual':
        return {'mode': mode, 'profile': selection.get(legacy_key)}
    return {'mode': mode}


def profile_fingerprint(profile: QoSProfile) -> tuple[Any, ...]:
    values = qos_profile_dict(profile) or {}
    return tuple(values.get(key) for key in (
        'reliability', 'durability', 'history', 'depth', 'deadline_ns',
        'lifespan_ns', 'liveliness', 'liveliness_lease_duration_ns',
    ))


def action_profile_fingerprint(profiles: dict[str, QoSProfile]) -> tuple[Any, ...]:
    return tuple(profile_fingerprint(profiles[part]) for part in (
        'goal', 'result', 'cancel', 'feedback', 'status',
    ))


def _compatible_service_profile(
    remote: dict[str, Any], *, channel: str | None = None,
) -> tuple[QoSProfile, str | None]:
    if remote.get('qos_detection_source') != 'fastdds_discovery':
        return _clone_service_default(), 'Remote QoS 확인 불가 → ROS2 기본 QoS 사용'
    request_readers = [
        item.get('qos') or {} for item in remote.get('subscriber_qos', [])
        if item.get('service_channel') == 'request'
    ]
    response_writers = [
        item.get('qos') or {} for item in remote.get('publisher_qos', [])
        if item.get('service_channel') == 'response'
    ]
    use_request = channel in {None, 'request'}
    use_response = channel in {None, 'response'}
    request_qos = request_readers if use_request else []
    response_qos = response_writers if use_response else []
    if not request_qos and not response_qos:
        return _clone_service_default(), 'Remote QoS 확인 불가 → ROS2 기본 QoS 사용'

    default = qos_profile_services_default
    reliability = _select_service_policy(
        default=str(default.reliability.name).lower(),
        alternatives=('reliable', 'best_effort'),
        request_values=[item.get('reliability') for item in request_qos],
        response_values=[item.get('reliability') for item in response_qos],
        rank={'best_effort': 0, 'reliable': 1},
    )
    durability = _select_service_policy(
        default=str(default.durability.name).lower(),
        alternatives=('volatile', 'transient_local'),
        request_values=[item.get('durability') for item in request_qos],
        response_values=[item.get('durability') for item in response_qos],
        rank={'volatile': 0, 'transient_local': 1},
    )
    liveliness = _select_service_policy(
        default=str(default.liveliness.name).lower(),
        alternatives=('automatic', 'manual_by_topic'),
        request_values=[item.get('liveliness') for item in request_qos],
        response_values=[item.get('liveliness') for item in response_qos],
        rank={'automatic': 0, 'manual_by_participant': 1, 'manual_by_topic': 2},
    )
    deadline_ns = _select_service_duration(
        default=default.deadline.nanoseconds,
        request_qos=request_qos,
        response_qos=response_qos,
        field='deadline',
    )
    lease_duration_ns = _select_service_duration(
        default=default.liveliness_lease_duration.nanoseconds,
        request_qos=request_qos,
        response_qos=response_qos,
        field='liveliness_lease_duration',
    )
    if None in (reliability, durability, liveliness, deadline_ns, lease_duration_ns):
        return _clone_service_default(), 'Remote Request/Response QoS를 단일 Client profile로 만족할 수 없어 ROS2 기본 QoS 사용'
    lifespan_ns = _select_writer_duration(
        default=default.lifespan.nanoseconds,
        writers=response_qos,
        field='lifespan',
    )
    return QoSProfile(
        reliability={
            'reliable': ReliabilityPolicy.RELIABLE,
            'best_effort': ReliabilityPolicy.BEST_EFFORT,
        }[reliability],
        durability={
            'volatile': DurabilityPolicy.VOLATILE,
            'transient_local': DurabilityPolicy.TRANSIENT_LOCAL,
        }[durability],
        history=default.history,
        depth=default.depth,
        deadline=Duration(nanoseconds=deadline_ns),
        lifespan=Duration(nanoseconds=lifespan_ns),
        liveliness={
            'system_default': default.liveliness,
            'automatic': LivelinessPolicy.AUTOMATIC,
            'manual_by_topic': LivelinessPolicy.MANUAL_BY_TOPIC,
        }[liveliness],
        liveliness_lease_duration=Duration(nanoseconds=lease_duration_ns),
    ), None


def _select_service_policy(
    *,
    default: str,
    alternatives: tuple[str, ...],
    request_values: list[Any],
    response_values: list[Any],
    rank: dict[str, int],
) -> str | None:
    known_requests = [str(value).lower() for value in request_values if str(value).lower() in rank]
    known_responses = [str(value).lower() for value in response_values if str(value).lower() in rank]
    if not known_requests and not known_responses:
        return default
    lower = max((rank[value] for value in known_requests), default=min(rank.values()))
    upper = min((rank[value] for value in known_responses), default=max(rank.values()))
    candidates = [item for item in alternatives if lower <= rank[item] <= upper]
    if not candidates:
        return None
    if known_requests:
        return min(candidates, key=lambda item: rank[item])
    return max(candidates, key=lambda item: rank[item])


def _select_service_duration(
    *, default: int, request_qos: list[dict[str, Any]],
    response_qos: list[dict[str, Any]], field: str,
) -> int | None:
    requests = [
        value for item in request_qos
        if (value := _discovered_duration_ns(item, field)) is not None
    ]
    responses = [
        value for item in response_qos
        if (value := _discovered_duration_ns(item, field)) is not None
    ]
    if not requests and not responses:
        return default
    lower = max(responses, default=0)
    upper = min(requests, default=_INFINITE_DURATION_NS)
    if lower > upper:
        return None
    return upper if requests else lower


def _select_writer_duration(
    *, default: int, writers: list[dict[str, Any]], field: str,
) -> int:
    values = [
        value for item in writers
        if (value := _discovered_duration_ns(item, field)) is not None
    ]
    return max(values) if values else default


def _discovered_duration_ns(qos: dict[str, Any], field: str) -> int | None:
    status = str(qos.get(f'{field}_status') or '').lower()
    if status == 'infinite':
        return _INFINITE_DURATION_NS
    value = qos.get(f'{field}_ns')
    if status == 'observed' and isinstance(value, int) and value >= 0:
        return value
    return None


def _execution_state(
    mode: str,
    remote: dict[str, Any],
    profile: QoSProfile,
    *,
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    return {
        'qos_mode': mode,
        'remote_qos': deepcopy(remote),
        'dashboard_qos': qos_profile_dict(profile),
        'local_qos': qos_profile_dict(profile),
        'fallback_used': fallback_reason is not None,
        'fallback_reason': fallback_reason,
    }


def _clone_service_default() -> QoSProfile:
    default = qos_profile_services_default
    return QoSProfile(
        reliability=default.reliability,
        durability=default.durability,
        history=default.history,
        depth=default.depth,
        deadline=default.deadline,
        lifespan=default.lifespan,
        liveliness=default.liveliness,
        liveliness_lease_duration=default.liveliness_lease_duration,
    )


def _unavailable_remote_qos() -> dict[str, Any]:
    return {
        'qos_status': 'unknown',
        'qos_detection_source': 'graph_unavailable',
        'publisher_qos': [],
        'subscriber_qos': [],
    }


def _enum_value(value: Any, allowed: dict[str, Any], label: str) -> Any:
    normalized = str(value or '').strip().lower()
    if normalized not in allowed:
        choices = ', '.join(allowed)
        raise ExecutionQosError(f'{label}은 {choices} 중 하나여야 합니다.')
    return allowed[normalized]


def _optional_enum_value(
    value: Any,
    allowed: dict[str, Any],
    label: str,
    default: Any,
) -> Any:
    if value is None or str(value).strip() == '':
        return default
    return _enum_value(value, allowed, label)


def _duration_value(value: Any, label: str) -> Duration:
    if value is None or value == '':
        return Duration()
    if not isinstance(value, dict):
        raise ExecutionQosError(f'{label}은 value와 unit을 가진 object여야 합니다.')
    raw = value.get('value')
    if raw is None or str(raw).strip() == '':
        return Duration()
    unit = str(value.get('unit') or 'ms').strip().lower()
    scales = {
        'ns': Decimal(1),
        'us': Decimal(1_000),
        'ms': Decimal(1_000_000),
        's': Decimal(1_000_000_000),
    }
    if unit not in scales:
        raise ExecutionQosError(f'{label}.unit은 ns, us, ms, s 중 하나여야 합니다.')
    try:
        nanoseconds = Decimal(str(raw)) * scales[unit]
    except (InvalidOperation, ValueError) as exc:
        raise ExecutionQosError(f'{label}.value는 0 이상의 숫자여야 합니다.') from exc
    if not nanoseconds.is_finite() or nanoseconds < 0:
        raise ExecutionQosError(f'{label}.value는 0 이상의 숫자여야 합니다.')
    integral_ns = nanoseconds.to_integral_value()
    if nanoseconds != integral_ns:
        raise ExecutionQosError(f'{label}은 nanosecond 단위로 정확히 변환 가능한 값이어야 합니다.')
    if integral_ns > 2 ** 63 - 1:
        raise ExecutionQosError(f'{label}이 ROS2 Duration 최대값을 초과했습니다.')
    return Duration(nanoseconds=int(integral_ns))

"""On-demand Gemini interpretation of one Dashboard Alert."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable
from urllib.parse import urlencode

import httpx

from app.monitor_client.cache import MonitorCache
from app.monitor_client.client import MonitorClient, MonitorUnavailable


LOGGER = logging.getLogger(__name__)
GEMINI_MODELS = (
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
)
HISTORY_LIMIT = 5
LOCAL_HISTORY_LIMITS = {'topic': 2, 'service': 1, 'action': 2}
SUPPORTED_SOURCES = {'topic', 'monitor_status', 'service', 'action', 'node'}
FALLBACK_HTTP_STATUS = {404, 429, 500, 502, 503, 504}
FALLBACK_PROVIDER_STATUS = {
    'NOT_FOUND',
    'RESOURCE_EXHAUSTED',
    'INTERNAL',
    'UNAVAILABLE',
    'DEADLINE_EXCEEDED',
}
DIAGNOSIS_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'summary': {'type': 'string'},
        'evidence': {'type': 'array', 'items': {'type': 'string'}},
        'likely_causes': {'type': 'array', 'items': {'type': 'string'}},
        'recommended_checks': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['summary', 'evidence', 'likely_causes', 'recommended_checks'],
}
LOCAL_DIAGNOSIS_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'summary': {'type': 'string'},
        'evidence': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 2},
        'likely_causes': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 2},
        'recommended_checks': {
            'type': 'array', 'items': {'type': 'string'}, 'maxItems': 3,
        },
    },
    'required': ['summary', 'evidence', 'likely_causes', 'recommended_checks'],
}
ALTERNATE_PERSPECTIVE_TEMPERATURE = 0.4
ALTERNATE_PERSPECTIVE_INSTRUCTION = """

[이번 요청의 추가 지시]

이 Alert에 대해 이전 분석과 동일한 표현이나 원인만 반복하지 말고,
제공된 Dashboard 사실 범위에서 아직 검토되지 않은 다른 가능한 원인,
다른 판단 관점, 추가로 확인할 지점을 우선 분석하라.

단, 근거가 부족한 원인을 억지로 만들지 말고,
새로운 관점이 실제 데이터로 뒷받침되지 않으면
현재 정보만으로 추가 판단이 어렵다고 명시하라.

다른 원인 수를 채우기 위해 입력에 없는 시스템 동작이나 장애를 추가하지 마라.
입력에서 직접 연결할 새로운 근거가 없는 후보는 likely_causes에 넣지 말고,
단순히 기존 원인의 표현만 바꾸는 것도 새로운 관점으로 취급하지 마라.
단일 Alert 문구만으로 프로세스 종료, 네트워크 장애, 설정 오류를 새 원인으로 확장하지 마라.
추가 후보를 뒷받침할 근거가 없다면 likely_causes는 빈 배열로 반환해도 된다.
"""
LOCAL_SYSTEM_INSTRUCTION = """ROS2 Dashboard Alert 진단 보조자다.
제공된 Dashboard 사실만 사용하고, 확정 사실과 가능한 원인을 구분하라. 정보가 부족하면 확인할 수 없다고 적어라.
현재 Runtime은 Alert 당시 상태가 아니므로 과거를 역추정하지 마라. QoS가 compatible이면 mismatch 원인으로 말하지 마라.
Graph entity 존재는 실제 통신 성공이 아니며, Service/Action transport 결과와 application result는 구분하라.
근거 없이 장비·네트워크·코드 장애를 단정하지 마라. 한국어로 지정 JSON schema만 반환하라."""
LOCAL_KOREAN_OUTPUT_INSTRUCTION = (
    '\n설명 문장은 한국어로 짧게 작성하고 ROS2 이름·type·field·코드만 원문 표기를 유지하라.'
)
# SYSTEM_INSTRUCTION = """당신은 ROS2 Dashboard Alert 진단 보조자다.
# Dashboard가 제공한 사실만 해석하고 새로운 통신 사실을 만들지 마라.
# 현재 Runtime 상태와 Alert 발생 당시 상태는 다를 수 있으며, historical_data에 없는 과거 상태를 추정하지 마라.
# 확정 근거와 일반적인 가능성을 명확히 구분하고, 확정할 수 없는 내용은 가능성으로 표현하라.
# QoS가 compatible이면 QoS mismatch라고 주장하지 말고, Publisher/Server 존재 여부 등 제공 데이터와 모순되는 설명을 하지 마라.
# 정보가 없으면 '현재 정보만으로 확인할 수 없음'이라고 적어라.
# Dashboard는 사실을 판정하고 당신은 의미, 가능한 원인, 확인 순서만 설명한다.
# 응답은 한국어로 작성하고 요청된 JSON schema만 반환하라."""

SYSTEM_INSTRUCTION = """
당신은 ROS2 Dashboard Alert 진단 보조자다.

Dashboard가 제공한 데이터만 근거로 해석하며,
제공되지 않은 ROS2 통신 사실, 장비 상태, 사용자 동작,
비즈니스 로직을 임의로 만들거나 추정하지 마라.

Dashboard는 사실을 판정하고,
당신은 그 사실의 의미, 가능한 원인, 판단 근거,
사용자가 다음으로 확인할 순서만 설명한다.

[근거 사용 원칙]

1. 확정된 사실과 가능한 원인을 명확히 구분하라.

2. 입력 데이터로 직접 확인되는 내용만
   "확인됨", "관찰됨"으로 표현하라.

3. 직접 확인할 수 없는 내용은
   "가능성이 있음", "확인 필요"로 표현하라.

4. 정보가 부족하면
   "현재 정보만으로 확인할 수 없음"이라고 명시하라.

5. 일반적인 ROS2 지식은 원인 후보 설명에 사용할 수 있지만,
   현재 장애의 실제 원인으로 단정하지 마라.


[현재 상태와 과거 Alert]

현재 Runtime 상태와 Alert 발생 당시 상태는 다를 수 있다.

historical_data에 기록되지 않은 과거 상태를
현재 Runtime 상태를 이용해 역으로 추정하지 마라.

현재 상태가 정상이라고 해서
과거 Alert가 잘못된 것이었다고 판단하지 마라.

과거 Alert와 현재 Runtime 상태가 다르면
두 상태를 명확히 구분해서 설명하라.


[ROS2 통신 판단]

QoS가 compatible이면
QoS mismatch를 원인으로 주장하지 마라.

Publisher, Subscriber, Client, Server, Action Server 등의
존재 여부는 Dashboard가 제공한 값을 그대로 따르며,
그 값과 모순되는 설명을 하지 마라.

Graph에 entity가 존재한다는 사실과
실제 메시지 또는 응답이 정상적으로 처리된다는 사실을
동일하게 취급하지 마라.

메시지가 없다는 사실만으로
Node가 종료되었다고 단정하지 마라.


[Service / Action 판단]

ROS2 transport 또는 호출 성공 여부와
Response/Result payload의 application-level 값은 구분하라.

예를 들어 Response를 정상적으로 수신했지만
payload의 success=false인 경우,
이를 ROS2 통신 실패라고 단정하지 마라.

success, result_code, cmd, status 등의 필드 의미는
제공된 프로토콜 정보가 없는 경우 임의로 해석하지 마라.

Action의 Goal 전달, Feedback, Result, Cancel 상태도
각각 별개의 통신 사실로 구분하라.


[진단 결과]

가능한 원인은 제공된 근거와의 연관성이 높은 순서로 제시하라.

각 원인에는 가능하면
어떤 입력 데이터가 그 판단의 근거인지 함께 설명하라.

확인 순서는 사용자가 원인을 좁혀갈 수 있도록
가장 직접적이고 검증 가능한 항목부터 제시하라.

근거 없는 특정 장비 고장,
네트워크 장애,
코드 버그를 단정하지 마라.


[출력]

응답은 한국어로 작성하라.

반드시 요청된 JSON schema만 반환하라.

JSON 바깥의 설명,
Markdown,
코드 블록,
추가 문장을 출력하지 마라.

schema에 정의되지 않은 필드를 임의로 추가하지 마라.
"""


class AlertDiagnosisInputError(ValueError):
    """The selected Alert payload is not usable for diagnosis."""


class GeminiConfigurationError(RuntimeError):
    """Gemini is not configured in the Backend environment."""


class GeminiRequestError(RuntimeError):
    """Gemini rejected or failed all permitted model requests."""

    def __init__(self, message: str, *, authentication: bool = False) -> None:
        super().__init__(message)
        self.authentication = authentication


class LocalLlmConfigurationError(RuntimeError):
    """The local Ollama diagnosis provider is not configured."""


class LocalLlmRequestError(RuntimeError):
    """The local Ollama diagnosis provider did not return a valid result."""


class AlertDiagnosisService:
    def __init__(
        self,
        *,
        monitor_cache: MonitorCache,
        monitor_client: MonitorClient,
        api_key: str,
        api_base_url: str,
        timeout_sec: float,
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
        local_llm_url: str = '',
        local_llm_model: str = '',
        local_llm_timeout_sec: float = 120,
        local_client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self._monitor_cache = monitor_cache
        self._monitor_client = monitor_client
        self._api_key = api_key.strip()
        self._api_base_url = api_base_url.rstrip('/')
        self._timeout_sec = timeout_sec
        self._client_factory = client_factory
        self._local_llm_url = local_llm_url.rstrip('/')
        self._local_llm_model = local_llm_model.strip()
        self._local_llm_timeout_sec = local_llm_timeout_sec
        self._local_client_factory = local_client_factory

    async def diagnose(
        self,
        selected_alert: dict[str, Any],
        *,
        alternate: bool = False,
    ) -> dict[str, Any]:
        alert = _validated_alert(selected_alert)
        context = await self._build_context(alert)
        analysis, model = await self._request_gemini(context, alternate=alternate)
        return {**analysis, 'model': model}

    async def diagnose_local(
        self,
        selected_alert: dict[str, Any],
        *,
        alternate: bool = False,
    ) -> dict[str, Any]:
        alert = _validated_alert(selected_alert)
        context = await self._build_local_context(alert)
        analysis, model = await self._request_local_llm(context, alternate=alternate)
        return {**analysis, 'model': model}

    async def _build_context(self, alert: dict[str, Any]) -> dict[str, Any]:
        cache = self._monitor_cache.snapshot()
        runtime_data = cache.get('data') if isinstance(cache.get('data'), dict) else {}
        source = alert['source']
        resource = _find_resource(runtime_data, alert)
        interface_type = _interface_type(resource)
        history = await self._load_history(
            source=source,
            name=alert['name'],
            interface_type=interface_type,
            domain_id=alert.get('domain_id'),
        )
        return {
            'alert_record': {
                'id': alert['id'],
                'code': alert['code'],
                'severity': alert['level'],
                'message': alert['message'],
                'detected_at': alert.get('detected_at'),
                'resolved_at': alert.get('resolved_at'),
                'state': alert['alert_state'],
            },
            'resource': {
                'kind': source,
                'domain_id': alert.get('domain_id'),
                'name': alert['name'],
                'interface_type': interface_type,
            },
            'current_runtime_state': {
                'observed_at': cache.get('updated_at'),
                'monitor_connected': cache.get('connected') is True,
                'note': '현재 Monitor 상태이며 Alert 발생 당시 snapshot이 아닙니다.',
                'data': _runtime_summary(source, resource),
            },
            'historical_data': {
                'source': '기존 Monitor history API',
                'limit': HISTORY_LIMIT,
                'items': history,
                'note': '실제 history에 존재하는 최근 데이터만 포함합니다.',
            },
        }

    async def _build_local_context(self, alert: dict[str, Any]) -> dict[str, Any]:
        """Build a compact context solely for the CPU-bound local model."""
        cache = self._monitor_cache.snapshot()
        runtime_data = cache.get('data') if isinstance(cache.get('data'), dict) else {}
        source = alert['source']
        resource = _find_resource(runtime_data, alert)
        interface_type = _interface_type(resource)
        history = await self._load_history(
            source=source,
            name=alert['name'],
            interface_type=interface_type,
            domain_id=alert.get('domain_id'),
            limit=LOCAL_HISTORY_LIMITS.get(source, 0),
        )
        return {
            'alert': {
                'source': source,
                'code': alert['code'],
                'severity': alert['level'],
                'message': alert['message'],
                'state': alert['alert_state'],
                'detected_at': alert.get('detected_at'),
            },
            'resource': {
                'name': alert['name'],
                'interface_type': interface_type,
                'domain_id': alert.get('domain_id'),
            },
            'current_runtime': {
                'observed_at': cache.get('updated_at'),
                'monitor_connected': cache.get('connected') is True,
                'note': '현재 Runtime은 Alert 발생 당시 snapshot이 아닙니다.',
                'data': _local_runtime_summary(source, alert, resource),
            },
            'history': _local_history_summary(source, history),
        }

    async def _load_history(
        self,
        *,
        source: str,
        name: str,
        interface_type: str | None,
        domain_id: int | None,
        limit: int = HISTORY_LIMIT,
    ) -> list[Any]:
        path = _history_path(
            source=source,
            name=name,
            interface_type=interface_type,
            domain_id=domain_id,
            limit=limit,
        )
        if path is None:
            return []
        try:
            response = await self._monitor_client.request_async('GET', path)
        except MonitorUnavailable:
            return []
        if not 200 <= response.status_code < 300:
            return []
        try:
            payload = json.loads(response.content)
        except (TypeError, ValueError):
            return []
        data = payload.get('data') if isinstance(payload, dict) else None
        if isinstance(data, dict):
            data = data.get('history', [])
        return _bounded_value(data if isinstance(data, list) else [], limit=limit)

    async def _request_gemini(
        self,
        context: dict[str, Any],
        *,
        alternate: bool = False,
    ) -> tuple[dict[str, Any], str]:
        if not self._api_key:
            raise GeminiConfigurationError('GEMINI_API_KEY is not configured')
        if not self._api_base_url:
            raise GeminiConfigurationError('GEMINI_API_BASE_URL is not configured')

        factory = self._client_factory or (
            lambda: httpx.AsyncClient(timeout=self._timeout_sec)
        )
        payload = _gemini_payload(context, alternate=alternate)
        last_error: Exception | None = None
        async with factory() as client:
            for index, model in enumerate(GEMINI_MODELS):
                try:
                    response = await client.post(
                        f'{self._api_base_url}/models/{model}:generateContent',
                        headers={
                            'Content-Type': 'application/json',
                            'x-goog-api-key': self._api_key,
                        },
                        json=payload,
                    )
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    last_error = exc
                    if index < len(GEMINI_MODELS) - 1:
                        continue
                    break

                if response.is_success:
                    try:
                        analysis = _parse_gemini_response(response.json())
                    except (TypeError, ValueError, KeyError) as exc:
                        last_error = exc
                        if index < len(GEMINI_MODELS) - 1:
                            continue
                        break
                    LOGGER.info('Gemini Alert diagnosis completed with model %s', model)
                    return analysis, model

                provider_status, provider_reason = _provider_error(response)
                last_error = GeminiRequestError(
                    f'Gemini HTTP {response.status_code} ({provider_status or "UNKNOWN"})',
                    authentication=(
                        response.status_code in {401, 403}
                        or provider_status in {'UNAUTHENTICATED', 'PERMISSION_DENIED'}
                        or provider_reason == 'API_KEY_INVALID'
                    ),
                )
                if not _fallback_allowed(response.status_code, provider_status):
                    raise last_error
                if index == len(GEMINI_MODELS) - 1:
                    break

        if isinstance(last_error, GeminiRequestError):
            raise last_error
        raise GeminiRequestError('Gemini models did not return a valid diagnosis') from last_error

    async def _request_local_llm(
        self,
        context: dict[str, Any],
        *,
        alternate: bool = False,
    ) -> tuple[dict[str, Any], str]:
        if not self._local_llm_url:
            raise LocalLlmConfigurationError('LOCAL_LLM_URL is not configured')
        if not self._local_llm_model:
            raise LocalLlmConfigurationError('LOCAL_LLM_MODEL is not configured')

        factory = self._local_client_factory or (
            lambda: httpx.AsyncClient(timeout=self._local_llm_timeout_sec)
        )
        try:
            async with factory() as client:
                response = await client.post(
                    f'{self._local_llm_url}/api/chat',
                    json=_local_llm_payload(
                        context,
                        self._local_llm_model,
                        alternate=alternate,
                    ),
                )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise LocalLlmRequestError('Local LLM transport failed') from exc

        if not response.is_success:
            raise LocalLlmRequestError(f'Local LLM HTTP {response.status_code}')
        try:
            payload = response.json()
            message = payload.get('message') if isinstance(payload, dict) else None
            content = message.get('content') if isinstance(message, dict) else None
            analysis = _parse_structured_diagnosis(content, schema=LOCAL_DIAGNOSIS_SCHEMA)
            if not _local_explanations_are_korean(analysis):
                raise ValueError('Local LLM explanations are not Korean')
            model = str(payload.get('model') or '').strip()
            if not model:
                raise ValueError('Local LLM response model is missing')
        except (TypeError, ValueError, KeyError) as exc:
            raise LocalLlmRequestError('Local LLM returned an invalid diagnosis') from exc
        LOGGER.info('Local Alert diagnosis completed with model %s', model)
        performance = {
            key: payload.get(key)
            for key in (
                'prompt_eval_count', 'eval_count', 'prompt_eval_duration',
                'eval_duration', 'total_duration',
            )
            if payload.get(key) is not None
        }
        if performance:
            LOGGER.info('Local Alert diagnosis performance model=%s %s', model, performance)
        return analysis, model


def _validated_alert(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AlertDiagnosisInputError('Alert payload must be an object')
    source = str(value.get('source') or '').strip()
    if source not in SUPPORTED_SOURCES:
        raise AlertDiagnosisInputError('Unsupported Alert source')
    required = {}
    for key, limit in (
        ('id', 1024), ('name', 512), ('code', 128),
        ('level', 32), ('message', 4000),
    ):
        text = str(value.get(key) or '').strip()
        if not text or len(text) > limit:
            raise AlertDiagnosisInputError(f'Invalid Alert {key}')
        required[key] = text
    domain_id = value.get('domain_id')
    if domain_id is not None:
        if not isinstance(domain_id, int) or isinstance(domain_id, bool) or not 0 <= domain_id <= 232:
            raise AlertDiagnosisInputError('Invalid Alert domain_id')
    resolved_at = _number_or_none(value.get('resolved_at'))
    state = str(value.get('alert_state') or '').strip().lower()
    if state not in {'active', 'resolved'}:
        state = 'resolved' if resolved_at is not None or value.get('active') is False else 'active'
    monitor_status = {
        key: value[key]
        for key in ('device_name', 'node_name', 'status', 'values')
        if key in value
    }
    return {
        **required,
        'source': source,
        'domain_id': domain_id,
        'resource_key': str(value.get('resource_key') or ''),
        'detected_at': _number_or_none(
            value.get('first_detected_at', value.get('detected_at')),
        ),
        'resolved_at': resolved_at,
        'alert_state': state,
        'channel': str(value.get('channel') or '').strip()[:128],
        'monitor_status': monitor_status,
    }


def _find_resource(runtime_data: dict[str, Any], alert: dict[str, Any]) -> dict[str, Any] | None:
    collection_key = {
        'topic': 'topics',
        'service': 'services',
        'action': 'actions',
        'node': 'nodes',
    }.get(alert['source'])
    if collection_key is None:
        return None
    envelope = runtime_data.get(collection_key)
    items = envelope.get(collection_key, []) if isinstance(envelope, dict) else []
    resource_key = alert.get('resource_key')
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        item_key = item.get('resource_key')
        item_name = item.get('full_name') if collection_key == 'nodes' else item.get('name')
        same_domain = alert.get('domain_id') is None or item.get('domain_id') == alert.get('domain_id')
        if resource_key and item_key == resource_key:
            return item
        if same_domain and item_name == alert['name']:
            return item
    return None


def _interface_type(resource: dict[str, Any] | None) -> str | None:
    if not resource:
        return None
    value = resource.get('type')
    if value:
        return str(value)
    types = resource.get('types')
    return str(types[0]) if isinstance(types, list) and types else None


def _runtime_summary(source: str, resource: dict[str, Any] | None) -> dict[str, Any] | None:
    if not resource:
        return None
    fields = {
        'topic': (
            'status', 'effective_status', 'graph_present', 'publisher_count',
            'subscriber_count', 'publisher_node_count', 'subscriber_node_count',
            'hz', 'age_sec', 'stale', 'last_message_preview', 'last_received_at',
            'message_count', 'qos_status', 'qos_detection_source',
            'graph_qos_status', 'mismatch_reason',
        ),
        'service': (
            'status', 'graph_present', 'callable', 'server_count', 'client_count',
            'server_node_count', 'client_node_count', 'call_status',
            'last_call_summary', 'dashboard_communication', 'qos_status',
            'qos_detection_source', 'mismatch_reason',
        ),
        'action': (
            'status', 'graph_present', 'callable', 'server_count', 'client_count',
            'server_node_count', 'client_node_count', 'last_goal_summary',
            'runtime', 'qos',
        ),
        'node': (
            'status', 'graph_present', 'last_seen_at', 'topic_publishers',
            'topic_subscribers', 'service_servers', 'service_clients',
            'action_servers', 'action_clients',
        ),
    }.get(source, ())
    return _bounded_value({key: resource.get(key) for key in fields if key in resource})


def _local_runtime_summary(
    source: str,
    alert: dict[str, Any],
    resource: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if source == 'monitor_status':
        return _local_monitor_status(alert.get('monitor_status'))
    if not resource:
        return None
    if source == 'topic':
        result = _selected_fields(resource, (
            'status', 'effective_status', 'graph_present', 'publisher_count',
            'subscriber_count', 'hz', 'age_sec', 'stale', 'last_received_at',
            'qos_status', 'qos_detection_source', 'mismatch_reason',
        ))
        diagnosis = resource.get('reception_diagnosis')
        if isinstance(diagnosis, dict):
            result['reception_diagnosis'] = _selected_fields(diagnosis, (
                'reception_status', 'publisher_present', 'subscription_created',
                'qos_status', 'qos_detection_source', 'mismatch_policies',
                'cause', 'certainty', 'message',
            ))
        return result
    if source == 'service':
        result = _selected_fields(resource, (
            'status', 'graph_present', 'callable', 'server_count', 'client_count',
            'call_status', 'qos_status', 'qos_detection_source', 'mismatch_reason',
        ))
        summary = _local_service_summary(resource.get('last_call_summary'))
        if summary:
            result['last_call'] = summary
        return result
    if source == 'action':
        result = _selected_fields(resource, (
            'status', 'graph_present', 'callable', 'server_count', 'client_count',
        ))
        lifecycle = _local_action_summary(
            resource.get('last_goal_summary'), resource.get('runtime'),
        )
        if lifecycle:
            result['lifecycle'] = lifecycle
        if alert['code'] == 'action_qos_incompatible':
            channel = alert.get('channel')
            if channel:
                result['qos_channel'] = channel
                qos = resource.get('qos')
                channel_qos = qos.get(channel) if isinstance(qos, dict) else None
                if isinstance(channel_qos, dict):
                    result['qos'] = _selected_fields(channel_qos, (
                        'qos_status', 'status', 'qos_detection_source',
                        'graph_qos_status', 'mismatch_reason', 'mismatch_policies',
                        'compatible_endpoint_count', 'remote_endpoint_count',
                        'incompatible_endpoint_count', 'confirmation_count',
                    ))
        return result
    if source == 'node':
        return _selected_fields(resource, (
            'status', 'graph_present', 'last_seen_at', 'publisher_count',
            'subscriber_count', 'server_count', 'client_count',
            'action_server_count', 'action_client_count',
        ))
    return None


def _selected_fields(value: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    return {field: _local_value(value[field]) for field in fields if field in value}


def _local_service_summary(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    result = _selected_fields(value, (
        'sent_to_server', 'last_call_status', 'status', 'last_called_at',
        'last_response_time_ms', 'timeout_sec', 'elapsed_ms', 'error_type',
        'last_error', 'execution_source',
    ))
    response = value.get('last_response_preview')
    if isinstance(response, dict):
        application = _selected_fields(response, ('success', 'message', 'error'))
        if application:
            result['application_result'] = application
    return result or None


def _local_action_summary(summary: Any, runtime: Any) -> dict[str, Any] | None:
    result: dict[str, Any] = {}
    if isinstance(summary, dict):
        result.update(_selected_fields(summary, (
            'status', 'last_goal_status', 'sent_to_server', 'accepted',
            'last_goal_sent_at', 'last_feedback_at', 'last_result_at',
            'execution_time_ms', 'error_type', 'last_error', 'execution_source',
        )))
    if isinstance(runtime, dict):
        for field in (
            'last_goal_status', 'last_goal_sent_at', 'last_status_at',
            'last_result_at', 'result_status', 'result_error', 'execution_time_ms',
        ):
            if field in runtime and field not in result:
                result[field] = _local_value(runtime[field])
    return result or None


def _local_monitor_status(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    result = _selected_fields(value, ('device_name', 'node_name', 'status'))
    values = value.get('values')
    if isinstance(values, dict):
        result['values'] = {
            str(key)[:80]: _local_value(item)
            for key, item in list(values.items())[:5]
        }
    elif isinstance(values, list):
        result['values'] = [_local_value(item) for item in values[:5]]
    return result or None


def _local_history_summary(source: str, history: list[Any]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for item in history:
        if not isinstance(item, dict):
            continue
        if source == 'topic':
            summary = _selected_fields(item, ('received_at', 'last_received_at', 'status'))
        elif source == 'service':
            summary = _local_service_summary(item) or _selected_fields(item, (
                'sent_to_server', 'call_status', 'status', 'called_at',
                'last_called_at', 'elapsed_ms', 'timeout_sec', 'error_type', 'error',
            ))
            response = item.get('response')
            if isinstance(response, dict):
                application = _selected_fields(response, ('success', 'message', 'error'))
                if application:
                    summary['application_result'] = application
        elif source == 'action':
            summary = _local_action_summary(item, item) or _selected_fields(item, (
                'event_type', 'status_label', 'status', 'sent_to_server', 'accepted',
                'received_at', 'execution_time_ms', 'error_type', 'error',
            ))
            for field in ('event_type', 'status_label', 'received_at'):
                if field in item and field not in summary:
                    summary[field] = _local_value(item[field])
        else:
            continue
        if summary:
            summaries.append(summary)
    return summaries


def _local_value(value: Any) -> Any:
    if isinstance(value, str):
        return value[:240]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return _bounded_value(value, limit=2)


def _history_path(
    *,
    source: str,
    name: str,
    interface_type: str | None,
    domain_id: int | None,
    limit: int = HISTORY_LIMIT,
) -> str | None:
    base = {
        'topic': '/ros/topics/history',
        'service': '/ros/services/history',
        'action': '/ros/actions/history',
    }.get(source)
    if base is None:
        return None
    query: dict[str, Any] = {'name': name, 'limit': limit}
    if domain_id is not None:
        query['domain_id'] = domain_id
    if interface_type and source == 'service':
        query['service_type'] = interface_type
    if interface_type and source == 'action':
        query['action_type'] = interface_type
    return f'{base}?{urlencode(query)}'


def _gemini_payload(
    context: dict[str, Any],
    *,
    alternate: bool = False,
) -> dict[str, Any]:
    return {
        'systemInstruction': {'parts': [{'text': SYSTEM_INSTRUCTION}]},
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': _diagnosis_prompt(context, alternate=alternate),
            }],
        }],
        'generationConfig': {
            'temperature': ALTERNATE_PERSPECTIVE_TEMPERATURE if alternate else 0.2,
            'maxOutputTokens': 2048,
            'responseMimeType': 'application/json',
            'responseJsonSchema': DIAGNOSIS_SCHEMA,
        },
    }


def _local_llm_payload(
    context: dict[str, Any],
    model: str,
    *,
    alternate: bool = False,
) -> dict[str, Any]:
    return {
        'model': model,
        'stream': False,
        'format': LOCAL_DIAGNOSIS_SCHEMA,
        'messages': [
            {'role': 'system', 'content': LOCAL_SYSTEM_INSTRUCTION},
            {
                'role': 'user',
                'content': (
                    _local_diagnosis_prompt(context, alternate=alternate)
                    + LOCAL_KOREAN_OUTPUT_INSTRUCTION
                ),
            },
        ],
        'options': {
            'temperature': ALTERNATE_PERSPECTIVE_TEMPERATURE if alternate else 0.2,
            'num_predict': 512,
        },
    }


def _diagnosis_prompt(context: dict[str, Any], *, alternate: bool = False) -> str:
    prompt = '다음 Dashboard context를 진단 형식으로 해석하세요.\n' + json.dumps(
        context,
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return prompt + ALTERNATE_PERSPECTIVE_INSTRUCTION if alternate else prompt


def _local_diagnosis_prompt(context: dict[str, Any], *, alternate: bool = False) -> str:
    prompt = '다음 축약 Dashboard 사실을 JSON 진단으로 반환하세요.\n' + json.dumps(
        context,
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return prompt + ALTERNATE_PERSPECTIVE_INSTRUCTION if alternate else prompt


def _parse_gemini_response(payload: Any) -> dict[str, Any]:
    candidates = payload.get('candidates') if isinstance(payload, dict) else None
    if not isinstance(candidates, list) or not candidates:
        raise ValueError('Gemini response has no candidate')
    content = candidates[0].get('content') if isinstance(candidates[0], dict) else None
    parts = content.get('parts') if isinstance(content, dict) else None
    texts = [part.get('text') for part in parts or [] if isinstance(part, dict) and part.get('text')]
    if not texts:
        raise ValueError('Gemini response has no text')
    return _parse_structured_diagnosis(''.join(texts))


def _parse_structured_diagnosis(
    content: Any,
    *,
    schema: dict[str, Any] = DIAGNOSIS_SCHEMA,
) -> dict[str, Any]:
    if not isinstance(content, str) or not content.strip():
        raise ValueError('Diagnosis response has no content')
    result = json.loads(content)
    if not isinstance(result, dict) or set(result) != set(schema['required']):
        raise ValueError('Diagnosis fields are invalid')
    summary = result.get('summary')
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError('Diagnosis summary is invalid')
    normalized = {'summary': summary.strip()}
    for key in ('evidence', 'likely_causes', 'recommended_checks'):
        items = result.get(key)
        if not isinstance(items, list) or any(not isinstance(item, str) for item in items):
            raise ValueError(f'Diagnosis {key} is invalid')
        limit = schema['properties'][key].get('maxItems', 10)
        normalized[key] = [item.strip() for item in items[:limit] if item.strip()]
    return normalized


def _local_explanations_are_korean(analysis: dict[str, Any]) -> bool:
    explanatory_values = [analysis['summary']]
    explanatory_values.extend(analysis['evidence'])
    explanatory_values.extend(analysis['likely_causes'])
    explanatory_values.extend(analysis['recommended_checks'])
    return all(any('\uac00' <= character <= '\ud7a3' for character in value)
               for value in explanatory_values)


def _provider_error(response: httpx.Response) -> tuple[str | None, str | None]:
    try:
        error = response.json().get('error', {})
    except (TypeError, ValueError):
        return None, None
    status = error.get('status') if isinstance(error, dict) else None
    details = error.get('details') if isinstance(error, dict) else None
    reason = None
    for detail in details if isinstance(details, list) else []:
        if isinstance(detail, dict) and detail.get('reason'):
            reason = str(detail['reason']).upper()
            break
    return str(status).upper() if status else None, reason


def _fallback_allowed(status_code: int, provider_status: str | None) -> bool:
    return status_code in FALLBACK_HTTP_STATUS or provider_status in FALLBACK_PROVIDER_STATUS


def _bounded_value(value: Any, *, depth: int = 0, limit: int = HISTORY_LIMIT) -> Any:
    if depth >= 6:
        return None
    if isinstance(value, dict):
        return {
            str(key)[:128]: _bounded_value(item, depth=depth + 1, limit=limit)
            for key, item in list(value.items())[:40]
        }
    if isinstance(value, list):
        return [_bounded_value(item, depth=depth + 1, limit=limit) for item in value[:limit]]
    if isinstance(value, str):
        return value[:2000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:2000]


def _number_or_none(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    return float(value) if isinstance(value, (int, float)) else None

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
    ) -> None:
        self._monitor_cache = monitor_cache
        self._monitor_client = monitor_client
        self._api_key = api_key.strip()
        self._api_base_url = api_base_url.rstrip('/')
        self._timeout_sec = timeout_sec
        self._client_factory = client_factory

    async def diagnose(self, selected_alert: dict[str, Any]) -> dict[str, Any]:
        alert = _validated_alert(selected_alert)
        context = await self._build_context(alert)
        analysis, model = await self._request_gemini(context)
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

    async def _load_history(
        self,
        *,
        source: str,
        name: str,
        interface_type: str | None,
        domain_id: int | None,
    ) -> list[Any]:
        path = _history_path(
            source=source,
            name=name,
            interface_type=interface_type,
            domain_id=domain_id,
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
        return _bounded_value(data if isinstance(data, list) else [])

    async def _request_gemini(
        self,
        context: dict[str, Any],
    ) -> tuple[dict[str, Any], str]:
        if not self._api_key:
            raise GeminiConfigurationError('GEMINI_API_KEY is not configured')
        if not self._api_base_url:
            raise GeminiConfigurationError('GEMINI_API_BASE_URL is not configured')

        factory = self._client_factory or (
            lambda: httpx.AsyncClient(timeout=self._timeout_sec)
        )
        payload = _gemini_payload(context)
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


def _history_path(
    *,
    source: str,
    name: str,
    interface_type: str | None,
    domain_id: int | None,
) -> str | None:
    base = {
        'topic': '/ros/topics/history',
        'service': '/ros/services/history',
        'action': '/ros/actions/history',
    }.get(source)
    if base is None:
        return None
    query: dict[str, Any] = {'name': name, 'limit': HISTORY_LIMIT}
    if domain_id is not None:
        query['domain_id'] = domain_id
    if interface_type and source == 'service':
        query['service_type'] = interface_type
    if interface_type and source == 'action':
        query['action_type'] = interface_type
    return f'{base}?{urlencode(query)}'


def _gemini_payload(context: dict[str, Any]) -> dict[str, Any]:
    return {
        'systemInstruction': {'parts': [{'text': SYSTEM_INSTRUCTION}]},
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': '다음 Dashboard context를 진단 형식으로 해석하세요.\n'
                + json.dumps(context, ensure_ascii=False, separators=(',', ':')),
            }],
        }],
        'generationConfig': {
            'temperature': 0.2,
            'maxOutputTokens': 2048,
            'responseMimeType': 'application/json',
            'responseJsonSchema': DIAGNOSIS_SCHEMA,
        },
    }


def _parse_gemini_response(payload: Any) -> dict[str, Any]:
    candidates = payload.get('candidates') if isinstance(payload, dict) else None
    if not isinstance(candidates, list) or not candidates:
        raise ValueError('Gemini response has no candidate')
    content = candidates[0].get('content') if isinstance(candidates[0], dict) else None
    parts = content.get('parts') if isinstance(content, dict) else None
    texts = [part.get('text') for part in parts or [] if isinstance(part, dict) and part.get('text')]
    if not texts:
        raise ValueError('Gemini response has no text')
    result = json.loads(''.join(texts))
    if not isinstance(result, dict) or set(result) != set(DIAGNOSIS_SCHEMA['required']):
        raise ValueError('Gemini diagnosis fields are invalid')
    summary = result.get('summary')
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError('Gemini diagnosis summary is invalid')
    normalized = {'summary': summary.strip()}
    for key in ('evidence', 'likely_causes', 'recommended_checks'):
        items = result.get(key)
        if not isinstance(items, list) or any(not isinstance(item, str) for item in items):
            raise ValueError(f'Gemini diagnosis {key} is invalid')
        normalized[key] = [item.strip() for item in items[:10] if item.strip()]
    return normalized


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


def _bounded_value(value: Any, *, depth: int = 0) -> Any:
    if depth >= 6:
        return None
    if isinstance(value, dict):
        return {
            str(key)[:128]: _bounded_value(item, depth=depth + 1)
            for key, item in list(value.items())[:40]
        }
    if isinstance(value, list):
        return [_bounded_value(item, depth=depth + 1) for item in value[:HISTORY_LIMIT]]
    if isinstance(value, str):
        return value[:2000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:2000]


def _number_or_none(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    return float(value) if isinstance(value, (int, float)) else None

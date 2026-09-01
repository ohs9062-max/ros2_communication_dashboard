import asyncio
import json
from dataclasses import dataclass

import httpx
import pytest
from fastapi import HTTPException

from app.alerts.ai_diagnosis import (
    ALTERNATE_PERSPECTIVE_INSTRUCTION,
    ALTERNATE_PERSPECTIVE_TEMPERATURE,
    AlertDiagnosisService,
    GEMINI_MODELS,
    GeminiConfigurationError,
    GeminiRequestError,
    LOCAL_DIAGNOSIS_SCHEMA,
    LOCAL_KOREAN_OUTPUT_INSTRUCTION,
    LOCAL_SYSTEM_INSTRUCTION,
    LocalLlmConfigurationError,
    LocalLlmRequestError,
    _validated_alert,
)
from app.monitor_client.cache import MonitorCache
from app.monitor_client.client import MonitorResponse
from app.routers import alerts as alert_router


ANALYSIS = {
    'summary': '요약',
    'evidence': ['근거'],
    'likely_causes': ['원인 후보'],
    'recommended_checks': ['확인 순서'],
}


def test_model_priority_uses_verified_cost_order():
    assert GEMINI_MODELS == (
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
    )


@dataclass
class FakeMonitorClient:
    payload: dict | None = None
    calls: int = 0

    async def request_async(self, method, path):
        self.calls += 1
        assert method == 'GET'
        return MonitorResponse(
            status_code=200,
            content=json.dumps(self.payload or {'success': True, 'data': []}).encode(),
            content_type='application/json',
        )


def test_primary_success_does_not_call_fallback_models():
    requests = []

    def handler(request):
        requests.append(request)
        return _success_response(request)

    result = asyncio.run(_service(handler).diagnose(_alert('node')))

    assert result['model'] == GEMINI_MODELS[0]
    assert result['summary'] == '요약'
    assert len(requests) == 1
    assert GEMINI_MODELS[0] in str(requests[0].url)
    assert requests[0].headers['x-goog-api-key'] == 'secret'


def test_rate_limit_and_unavailable_errors_fallback_sequentially():
    models = []

    def handler(request):
        models.append(request.url.path.split('/models/', 1)[1].split(':', 1)[0])
        if len(models) == 1:
            return _error_response(request, 429, 'RESOURCE_EXHAUSTED')
        if len(models) == 2:
            return _error_response(request, 503, 'UNAVAILABLE')
        return _success_response(request)

    result = asyncio.run(_service(handler).diagnose(_alert('node')))

    assert models == list(GEMINI_MODELS)
    assert result['model'] == GEMINI_MODELS[2]


def test_first_fallback_success_stops_before_final_model():
    models = []

    def handler(request):
        models.append(request.url.path.split('/models/', 1)[1].split(':', 1)[0])
        if len(models) == 1:
            return _error_response(request, 429, 'RESOURCE_EXHAUSTED')
        return _success_response(request)

    result = asyncio.run(_service(handler).diagnose(_alert('node')))

    assert models == list(GEMINI_MODELS[:2])
    assert result['model'] == GEMINI_MODELS[1]


def test_authentication_error_never_falls_back():
    requests = []

    def handler(request):
        requests.append(request)
        return _error_response(request, 403, 'PERMISSION_DENIED')

    with pytest.raises(GeminiRequestError) as exc_info:
        asyncio.run(_service(handler).diagnose(_alert('node')))

    assert exc_info.value.authentication is True
    assert len(requests) == 1


def test_invalid_api_key_reason_never_falls_back():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(
            400,
            request=request,
            json={
                'error': {
                    'code': 400,
                    'status': 'INVALID_ARGUMENT',
                    'details': [{'reason': 'API_KEY_INVALID'}],
                },
            },
        )

    with pytest.raises(GeminiRequestError) as exc_info:
        asyncio.run(_service(handler).diagnose(_alert('node')))

    assert exc_info.value.authentication is True
    assert len(requests) == 1


def test_all_fallback_models_failing_returns_one_error():
    requests = []

    def handler(request):
        requests.append(request)
        return _error_response(request, 503, 'UNAVAILABLE')

    with pytest.raises(GeminiRequestError):
        asyncio.run(_service(handler).diagnose(_alert('node')))

    assert len(requests) == 3


def test_missing_api_key_stops_before_creating_http_client():
    client_created = False

    def factory():
        nonlocal client_created
        client_created = True
        raise AssertionError('HTTP client must not be created')

    service = AlertDiagnosisService(
        monitor_cache=MonitorCache(),
        monitor_client=FakeMonitorClient(),
        api_key='',
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
        client_factory=factory,
    )

    with pytest.raises(GeminiConfigurationError):
        asyncio.run(service.diagnose(_alert('node')))

    assert client_created is False


def test_invalid_structured_response_falls_back_and_is_validated():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(
                200,
                request=request,
                json={'candidates': [{'content': {'parts': [{'text': '{"summary":"missing"}'}]}}]},
            )
        return _success_response(request)

    result = asyncio.run(_service(handler).diagnose(_alert('node')))

    assert calls == 2
    assert result['model'] == GEMINI_MODELS[1]


def test_cloud_alternate_perspective_is_one_request_with_scoped_prompt_and_temperature():
    requests = []

    def handler(request):
        requests.append(request)
        body = json.loads(request.content)
        prompt = body['contents'][0]['parts'][0]['text']
        assert ALTERNATE_PERSPECTIVE_INSTRUCTION.strip() in prompt
        assert LOCAL_KOREAN_OUTPUT_INSTRUCTION.strip() not in prompt
        assert body['generationConfig']['temperature'] == ALTERNATE_PERSPECTIVE_TEMPERATURE
        return _success_response(request, alternate=True)

    result = asyncio.run(_service(handler).diagnose(_alert('node'), alternate=True))

    assert len(requests) == 1
    assert result == {**ANALYSIS, 'model': GEMINI_MODELS[0]}


def test_local_diagnosis_uses_one_ollama_structured_output_request():
    requests = []

    def handler(request):
        requests.append(request)
        body = json.loads(request.content)
        assert request.url.path == '/api/chat'
        assert body['model'] == 'configured-gemma'
        assert body['stream'] is False
        assert body['format']['required'] == list(ANALYSIS)
        assert body['format'] == LOCAL_DIAGNOSIS_SCHEMA
        assert body['messages'][0]['role'] == 'system'
        assert body['messages'][0]['content'] == LOCAL_SYSTEM_INSTRUCTION
        prompt = body['messages'][1]['content']
        assert prompt.endswith(LOCAL_KOREAN_OUTPUT_INSTRUCTION)
        assert ALTERNATE_PERSPECTIVE_INSTRUCTION.strip() not in prompt
        assert body['options']['num_predict'] == 512
        return httpx.Response(
            200,
            request=request,
            json={
                'model': 'configured-gemma',
                'message': {'role': 'assistant', 'content': json.dumps(ANALYSIS)},
            },
        )

    result = asyncio.run(_local_service(handler).diagnose_local(_alert('node')))

    assert len(requests) == 1
    assert result == {**ANALYSIS, 'model': 'configured-gemma'}


def test_local_alternate_perspective_is_one_request_with_scoped_prompt_and_temperature():
    requests = []

    def handler(request):
        requests.append(request)
        body = json.loads(request.content)
        prompt = body['messages'][1]['content']
        assert ALTERNATE_PERSPECTIVE_INSTRUCTION.strip() in prompt
        assert prompt.endswith(LOCAL_KOREAN_OUTPUT_INSTRUCTION)
        assert prompt.index(ALTERNATE_PERSPECTIVE_INSTRUCTION.strip()) < prompt.index(
            LOCAL_KOREAN_OUTPUT_INSTRUCTION.strip(),
        )
        assert body['options']['temperature'] == ALTERNATE_PERSPECTIVE_TEMPERATURE
        return httpx.Response(
            200,
            request=request,
            json={
                'model': 'configured-gemma',
                'message': {'content': json.dumps(ANALYSIS)},
            },
        )

    result = asyncio.run(
        _local_service(handler).diagnose_local(_alert('node'), alternate=True),
    )

    assert len(requests) == 1
    assert result == {**ANALYSIS, 'model': 'configured-gemma'}


def test_local_diagnosis_does_not_require_gemini_api_key():
    def handler(request):
        return httpx.Response(
            200,
            request=request,
            json={
                'model': 'configured-gemma',
                'message': {'content': json.dumps(ANALYSIS)},
            },
        )

    service = _local_service(handler, api_key='')

    result = asyncio.run(service.diagnose_local(_alert('node')))

    assert result['model'] == 'configured-gemma'


def test_local_diagnosis_rejects_english_explanations():
    english_analysis = {
        'summary': 'The action failed because the service was unavailable.',
        'evidence': ['status_label: failed'],
        'likely_causes': ['The remote service may be unavailable.'],
        'recommended_checks': ['Check the remote service status.'],
    }

    def handler(request):
        return httpx.Response(
            200,
            request=request,
            json={
                'model': 'configured-gemma',
                'message': {'content': json.dumps(english_analysis)},
            },
        )

    with pytest.raises(LocalLlmRequestError):
        asyncio.run(_local_service(handler).diagnose_local(_alert('node')))


def test_local_diagnosis_never_falls_back_on_model_error():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(404, request=request, json={'error': 'model not found'})

    with pytest.raises(LocalLlmRequestError):
        asyncio.run(_local_service(handler).diagnose_local(_alert('node')))

    assert len(requests) == 1


def test_local_transport_failure_is_isolated():
    def handler(request):
        raise httpx.ConnectError('Ollama is offline', request=request)

    with pytest.raises(LocalLlmRequestError):
        asyncio.run(_local_service(handler).diagnose_local(_alert('node')))


def test_missing_local_configuration_stops_before_http_request():
    service = AlertDiagnosisService(
        monitor_cache=MonitorCache(),
        monitor_client=FakeMonitorClient(),
        api_key='secret',
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
    )

    with pytest.raises(LocalLlmConfigurationError):
        asyncio.run(service.diagnose_local(_alert('node')))


def test_local_topic_context_removes_preview_and_limits_history():
    resource = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'types': ['demo/msg/Value'], 'status': 'stale', 'graph_present': True,
        'publisher_count': 1, 'subscriber_count': 2, 'hz': 0.0, 'age_sec': 9.0,
        'stale': True, 'last_received_at': 10.0,
        'last_message_preview': {'large': 'x' * 1000},
        'qos_status': 'compatible', 'qos_detection_source': 'graph',
        'reception_diagnosis': {
            'reception_status': 'stale', 'publisher_present': True,
            'subscription_created': True, 'cause': 'no_receive', 'certainty': 'observed',
        },
    }
    cache = MonitorCache()
    cache.update({'topics': {'topics': [resource]}})
    monitor = FakeMonitorClient({'data': [
        {'received_at': index, 'payload': {'raw': 'x' * 1000}} for index in range(4)
    ]})
    service = _local_context_service(cache, monitor)

    context = asyncio.run(service._build_local_context(_alert('topic', code='topic_stale')))

    data = context['current_runtime']['data']
    assert 'last_message_preview' not in data
    assert data['reception_diagnosis']['reception_status'] == 'stale'
    assert len(context['history']) == 2
    assert all('payload' not in item for item in context['history'])
    assert monitor.calls == 1


def test_local_service_context_keeps_transport_and_application_result_only():
    resource = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'type': 'demo/srv/Read', 'graph_present': True, 'callable': True,
        'server_count': 1, 'client_count': 1, 'call_status': 'response_received',
        'last_call_summary': {
            'sent_to_server': True, 'last_call_status': 'response_received',
            'last_called_at': 10, 'last_response_time_ms': 11,
            'last_request_preview': {'secret': 'drop'},
            'last_response_preview': {'success': False, 'message': '거부', 'extra': 'drop'},
        },
    }
    cache = MonitorCache()
    cache.update({'services': {'services': [resource]}})
    monitor = FakeMonitorClient({'data': {'history': [
        {'sent_to_server': True, 'status': 'response_received', 'request': {'drop': 1},
         'response': {'success': False, 'message': '거부', 'extra': 1}, 'elapsed_ms': 11},
        {'sent_to_server': True},
    ]}})
    context = asyncio.run(_local_context_service(cache, monitor)._build_local_context(
        _alert('service', code='service_call_failed'),
    ))

    call = context['current_runtime']['data']['last_call']
    assert call['sent_to_server'] is True
    assert call['application_result'] == {'success': False, 'message': '거부'}
    assert 'last_request_preview' not in call
    assert len(context['history']) == 1
    assert 'request' not in context['history'][0]


def test_local_action_qos_context_preserves_only_alert_channel_and_lifecycle():
    resource = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'type': 'demo/action/Run', 'graph_present': True, 'callable': True,
        'server_count': 1, 'client_count': 1,
        'last_goal_summary': {
            'accepted': True, 'sent_to_server': True, 'last_goal_status': 'aborted',
            'last_goal_preview': {'drop': 1}, 'last_result_preview': {'drop': 1},
        },
        'runtime': {'result_status': 'aborted', 'last_feedback_preview': {'drop': 1}},
        'qos': {
            'feedback': {'qos_status': 'incompatible', 'mismatch_reason': 'reliability'},
            'status': {'qos_status': 'compatible', 'remote_qos': [{'drop': 1}]},
        },
    }
    cache = MonitorCache()
    cache.update({'actions': {'actions': [resource]}})
    monitor = FakeMonitorClient({'data': {'history': [
        {'event_type': 'result', 'accepted': True, 'result': {'drop': 1}, 'received_at': 4},
        {'event_type': 'feedback', 'feedback': [{'drop': 1}], 'received_at': 3},
        {'event_type': 'goal', 'goal': {'drop': 1}, 'received_at': 2},
    ]}})
    context = asyncio.run(_local_context_service(cache, monitor)._build_local_context(
        _alert('action', code='action_qos_incompatible', channel='feedback'),
    ))

    data = context['current_runtime']['data']
    assert data['qos_channel'] == 'feedback'
    assert data['qos']['qos_status'] == 'incompatible'
    assert 'last_goal_preview' not in data['lifecycle']
    assert len(context['history']) == 2
    assert all('result' not in item and 'feedback' not in item for item in context['history'])


def test_local_monitor_status_and_node_context_are_compact():
    monitor_context = asyncio.run(_local_context_service(MonitorCache(), FakeMonitorClient())._build_local_context(
        _validated_alert(_alert(
            'monitor_status', device_name='robot', node_name='/monitor', status='error',
            values={f'key_{index}': index for index in range(8)},
        )),
    ))
    assert monitor_context['current_runtime']['data']['device_name'] == 'robot'
    assert len(monitor_context['current_runtime']['data']['values']) == 5

    node = {
        'full_name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'status': 'disconnected', 'graph_present': False, 'last_seen_at': 4,
        'topic_publishers': [{'name': '/large'}], 'service_clients': [{'name': '/large'}],
    }
    cache = MonitorCache()
    cache.update({'nodes': {'nodes': [node]}})
    node_context = asyncio.run(_local_context_service(cache, FakeMonitorClient())._build_local_context(
        _alert('node', code='node_stale'),
    ))
    assert node_context['current_runtime']['data']['status'] == 'disconnected'
    assert 'topic_publishers' not in node_context['current_runtime']['data']
    assert 'service_clients' not in node_context['current_runtime']['data']


def test_local_schema_limits_returned_array_lengths():
    long_analysis = {
        'summary': '짧은 요약',
        'evidence': ['근거 하나', '근거 둘', '근거 셋'],
        'likely_causes': ['원인 하나', '원인 둘', '원인 셋'],
        'recommended_checks': ['확인 하나', '확인 둘', '확인 셋', '확인 넷'],
    }

    def handler(request):
        return httpx.Response(200, request=request, json={
            'model': 'configured-gemma', 'message': {'content': json.dumps(long_analysis)},
            'prompt_eval_count': 100, 'eval_count': 20,
        })

    result = asyncio.run(_local_service(handler).diagnose_local(_alert('node')))
    assert [len(result[key]) for key in ('evidence', 'likely_causes', 'recommended_checks')] == [2, 2, 3]


@pytest.mark.parametrize(
    ('source', 'collection', 'resource'),
    [
        ('topic', 'topics', {
            'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'types': ['demo/msg/Value'], 'publisher_count': 1,
            'subscriber_count': 2, 'last_message_preview': {'data': 7},
            'last_received_at': 10.0, 'qos_status': 'compatible',
        }),
        ('service', 'services', {
            'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'type': 'demo/srv/Read', 'server_count': 1, 'client_count': 0,
            'last_call_summary': None, 'qos_status': 'unknown',
        }),
        ('action', 'actions', {
            'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'type': 'demo/action/Run', 'server_count': 1, 'client_count': 1,
            'last_goal_summary': {'status': 'succeeded'}, 'qos': None,
        }),
        ('node', 'nodes', {
            'full_name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'status': 'active', 'graph_present': True,
            'topic_publishers': [{'name': f'/topic_{index}'} for index in range(8)],
        }),
    ],
)
def test_context_uses_exact_resource_and_bounds_history(source, collection, resource):
    cache = MonitorCache()
    cache.update({collection: {collection: [resource], 'meta': {}}})
    monitor = FakeMonitorClient({
        'success': True,
        'data': [{'event': index, 'payload': None} for index in range(9)],
    })
    service = AlertDiagnosisService(
        monitor_cache=cache,
        monitor_client=monitor,
        api_key='secret',
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
    )

    context = asyncio.run(service._build_context(_alert(source)))

    assert context['resource']['domain_id'] == 99
    assert context['resource']['name'] == '/demo'
    assert context['current_runtime_state']['note'].startswith('현재 Monitor 상태')
    assert len(context['historical_data']['items']) <= 5
    assert monitor.calls == (0 if source == 'node' else 1)
    if source == 'topic':
        assert context['current_runtime_state']['data']['qos_status'] == 'compatible'
    if source == 'node':
        assert len(context['current_runtime_state']['data']['topic_publishers']) == 5


def test_router_returns_safe_error_without_provider_details(monkeypatch):
    class FailingDiagnosis:
        async def diagnose(self, _alert):
            raise GeminiRequestError('raw provider secret error')

    monkeypatch.setattr(alert_router, 'alert_ai_diagnosis', FailingDiagnosis())

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(alert_router.diagnose_alert(
            alert_router.AlertDiagnosisRequest(alert=_alert('topic')),
        ))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == 'AI 분석 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'
    assert 'raw provider' not in exc_info.value.detail


def test_local_router_returns_safe_error_without_provider_details(monkeypatch):
    class FailingDiagnosis:
        async def diagnose_local(self, _alert):
            raise LocalLlmRequestError('raw local provider details')

    monkeypatch.setattr(alert_router, 'alert_ai_diagnosis', FailingDiagnosis())

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(alert_router.diagnose_alert_locally(
            alert_router.AlertDiagnosisRequest(alert=_alert('topic')),
        ))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == (
        '로컬 AI 분석 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'
    )
    assert 'raw local provider' not in exc_info.value.detail


def test_router_passes_alternate_flag_to_selected_provider(monkeypatch):
    calls = []

    class RecordingDiagnosis:
        async def diagnose(self, _alert, *, alternate=False):
            calls.append(('cloud', alternate))
            return {**ANALYSIS, 'model': 'cloud-model'}

        async def diagnose_local(self, _alert, *, alternate=False):
            calls.append(('local', alternate))
            return {**ANALYSIS, 'model': 'local-model'}

    monkeypatch.setattr(alert_router, 'alert_ai_diagnosis', RecordingDiagnosis())
    request = alert_router.AlertDiagnosisRequest(alert=_alert('node'), alternate=True)

    asyncio.run(alert_router.diagnose_alert(request))
    asyncio.run(alert_router.diagnose_alert_locally(request))

    assert calls == [('cloud', True), ('local', True)]


def _service(handler):
    cache = MonitorCache()
    cache.update({'nodes': {'nodes': []}})
    transport = httpx.MockTransport(handler)
    return AlertDiagnosisService(
        monitor_cache=cache,
        monitor_client=FakeMonitorClient(),
        api_key='secret',
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
        client_factory=lambda: httpx.AsyncClient(transport=transport, timeout=1),
    )


def _local_service(handler, *, api_key='secret'):
    cache = MonitorCache()
    cache.update({'nodes': {'nodes': []}})
    transport = httpx.MockTransport(handler)
    return AlertDiagnosisService(
        monitor_cache=cache,
        monitor_client=FakeMonitorClient(),
        api_key=api_key,
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
        local_llm_url='http://ollama.test',
        local_llm_model='configured-gemma',
        local_llm_timeout_sec=1,
        local_client_factory=lambda: httpx.AsyncClient(transport=transport, timeout=1),
    )


def _local_context_service(cache, monitor):
    return AlertDiagnosisService(
        monitor_cache=cache,
        monitor_client=monitor,
        api_key='secret',
        api_base_url='https://example.test/v1beta',
        timeout_sec=1,
        local_llm_url='http://ollama.test',
        local_llm_model='configured-gemma',
        local_llm_timeout_sec=1,
    )


def _alert(source, **extra):
    alert = {
        'id': f'domain:99:{source}:/demo:test',
        'source': source,
        'name': '/demo',
        'resource_key': '99:/demo',
        'domain_id': 99,
        'code': f'{source}_test',
        'level': 'warning',
        'message': 'test alert',
        'first_detected_at': 1.0,
        'resolved_at': None,
        'alert_state': 'active',
    }
    alert.update(extra)
    return alert


def _success_response(request, *, alternate=False):
    body = json.loads(request.content)
    assert LOCAL_KOREAN_OUTPUT_INSTRUCTION.strip() not in (
        body['contents'][0]['parts'][0]['text']
    )
    assert body['generationConfig']['responseMimeType'] == 'application/json'
    assert body['generationConfig']['responseJsonSchema']['required'] == list(ANALYSIS)
    assert body['generationConfig']['temperature'] == (
        ALTERNATE_PERSPECTIVE_TEMPERATURE if alternate else 0.2
    )
    if not alternate:
        assert ALTERNATE_PERSPECTIVE_INSTRUCTION.strip() not in (
            body['contents'][0]['parts'][0]['text']
        )
    return httpx.Response(
        200,
        request=request,
        json={
            'candidates': [{
                'content': {'parts': [{'text': json.dumps(ANALYSIS, ensure_ascii=False)}]},
            }],
        },
    )


def _error_response(request, status_code, provider_status):
    return httpx.Response(
        status_code,
        request=request,
        json={
            'error': {
                'code': status_code,
                'status': provider_status,
                'message': 'provider details must stay server-side',
            },
        },
    )

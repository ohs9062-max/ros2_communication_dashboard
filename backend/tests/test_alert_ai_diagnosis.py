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
    DIAGNOSIS_SCHEMA,
    GEMINI_MODELS,
    GeminiConfigurationError,
    GeminiRequestError,
    LOCAL_KOREAN_OUTPUT_INSTRUCTION,
    SYSTEM_INSTRUCTION,
    LocalLlmConfigurationError,
    LocalLlmRequestError,
    _validated_alert,
    _gemini_payload,
    _local_llm_payload,
)
from app.alerts import ai_diagnosis
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


def test_cloud_payload_keeps_llm_complete_context_and_contract():
    context = {
        'current_runtime_state': {
            'data': {'last_message_preview': {'raw': 'cloud keeps its existing context'}},
        },
        'historical_data': {'limit': 5, 'items': [{'payload': {'raw': 'history'}}]},
    }

    payload = _gemini_payload(context)

    assert payload['systemInstruction']['parts'][0]['text'] == SYSTEM_INSTRUCTION
    assert payload['generationConfig']['responseJsonSchema'] == DIAGNOSIS_SCHEMA
    assert payload['generationConfig']['maxOutputTokens'] == 2048
    prompt = payload['contents'][0]['parts'][0]['text']
    assert 'last_message_preview' in prompt
    assert 'cloud keeps its existing context' in prompt
    assert '축약 Dashboard 사실' not in prompt


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
        assert body['format'] == DIAGNOSIS_SCHEMA
        assert body['messages'][0]['role'] == 'system'
        assert body['messages'][0]['content'] == SYSTEM_INSTRUCTION
        prompt = body['messages'][1]['content']
        assert prompt.endswith(LOCAL_KOREAN_OUTPUT_INSTRUCTION)
        assert ALTERNATE_PERSPECTIVE_INSTRUCTION.strip() not in prompt
        assert body['options']['num_predict'] == 2048
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


def test_local_context_log_reports_shape_without_raw_payload(monkeypatch):
    def handler(request):
        return httpx.Response(200, request=request, json={
            'model': 'configured-gemma', 'message': {'content': json.dumps(ANALYSIS)},
        })

    messages = []
    monkeypatch.setattr(
        ai_diagnosis.LOGGER,
        'info',
        lambda message, *args: messages.append(message % args),
    )
    asyncio.run(_local_service(handler).diagnose_local(_alert('node')))

    context_messages = [message for message in messages if 'Local Alert diagnosis context' in message]
    assert len(context_messages) == 1
    assert 'source=node' in context_messages[0]
    assert 'history_count=0' in context_messages[0]
    assert 'test alert' not in context_messages[0]


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
        assert body['options']['num_predict'] == 2048
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


def test_local_alternate_accepts_technical_english_evidence():
    alternate_analysis = {
        'summary': '현재 Dashboard 상태와 Alert 발생 시점은 구분해야 합니다.',
        'evidence': ['sent_to_server=true, last_call_status=timeout'],
        'likely_causes': ['호출은 전송됐지만 timeout 상태여서 응답 경로 확인이 필요합니다.'],
        'recommended_checks': ['Service server의 실제 응답 시각을 확인해 timeout과 비교합니다.'],
    }
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, request=request, json={
            'model': 'configured-gemma',
            'message': {'content': json.dumps(alternate_analysis)},
        })

    result = asyncio.run(
        _local_service(handler).diagnose_local(_alert('service'), alternate=True),
    )

    assert result == {**alternate_analysis, 'model': 'configured-gemma'}
    assert len(requests) == 1


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


def test_local_topic_context_restores_llm_complete_preview_and_history():
    resource = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'types': ['demo/msg/Value'], 'status': 'stale', 'graph_present': True,
        'publisher_count': 1, 'subscriber_count': 2, 'hz': 0.0, 'age_sec': 9.0,
        'stale': True, 'last_received_at': 10.0,
        'last_message_preview': {'large': 'x' * 1000},
        'qos_status': 'incompatible', 'qos_detection_source': 'graph',
        'mismatch_reason': 'reliability mismatch',
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

    context = asyncio.run(service._build_context(_alert('topic', code='topic_stale')))

    data = context['current_runtime_state']['data']
    assert data['last_message_preview'] == {'large': 'x' * 1000}
    assert data['qos_status'] == 'incompatible'
    assert data['mismatch_reason'] == 'reliability mismatch'
    assert len(context['historical_data']['items']) == 4
    assert all('payload' in item for item in context['historical_data']['items'])
    assert context['historical_data']['limit'] == 5
    assert monitor.calls == 1


def test_local_service_context_restores_full_summary_and_history():
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
    context = asyncio.run(_local_context_service(cache, monitor)._build_context(
        _alert('service', code='service_call_failed'),
    ))

    call = context['current_runtime_state']['data']['last_call_summary']
    assert call['sent_to_server'] is True
    assert call['last_request_preview'] == {'secret': 'drop'}
    assert call['last_response_preview']['extra'] == 'drop'
    assert len(context['historical_data']['items']) == 2
    assert context['historical_data']['items'][0]['request'] == {'drop': 1}


def test_local_service_disconnected_context_keeps_observed_graph_facts():
    resource = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'type': 'demo/srv/Read', 'status': 'disconnected', 'graph_present': False,
        'callable': False, 'server_count': 0, 'client_count': 0,
    }
    cache = MonitorCache()
    cache.update({'services': {'services': [resource]}})

    context = asyncio.run(_local_context_service(cache, FakeMonitorClient())._build_context(
        _alert('service', code='service_disconnected'),
    ))

    assert context['current_runtime_state']['data'] == {
        'status': 'disconnected', 'graph_present': False, 'callable': False,
        'server_count': 0, 'client_count': 0,
    }


def test_local_action_context_restores_runtime_all_qos_channels_and_history():
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
            'feedback': {
                'qos_status': 'incompatible', 'mismatch_reason': 'reliability',
                'mismatch_policies': ['reliability'],
                'local_qos': {
                    'reliability': 'reliable', 'durability': 'volatile',
                    'history': 'keep_last', 'depth': 10,
                    'deadline_ns': 9223372036854775807,
                },
                'remote_qos': [{
                    'node_name': 'remote_feedback', 'node_namespace': '/robot',
                    'endpoint_kind': 'publishers',
                    'qos': {'reliability': 'best_effort', 'durability': 'volatile',
                            'history': 'keep_last', 'depth': 5},
                }],
                'qos_fallback_policies': ['depth'],
            },
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
    context = asyncio.run(_local_context_service(cache, monitor)._build_context(
        _alert('action', code='action_qos_incompatible', channel='feedback'),
    ))

    data = context['current_runtime_state']['data']
    assert data['last_goal_summary']['last_goal_preview'] == {'drop': 1}
    assert data['runtime']['last_feedback_preview'] == {'drop': 1}
    assert set(data['qos']) == {'feedback', 'status'}
    assert data['qos']['feedback']['local_qos']['deadline_ns'] == 9223372036854775807
    assert data['qos']['status']['remote_qos'] == [{'drop': 1}]
    assert len(context['historical_data']['items']) == 3
    assert context['historical_data']['items'][0]['result'] == {'drop': 1}


@pytest.mark.parametrize(
    ('source', 'collection', 'code', 'resource'),
    [
        ('topic', 'topics', 'topic_qos_incompatible', {
            'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'types': ['demo/msg/Value'], 'qos_status': 'incompatible',
            'qos_detection_source': 'graph_profile_comparison',
            'mismatch_reason': 'reliability mismatch',
            'mismatch_policies': ['reliability'],
            'local_qos': {'reliability': 'reliable', 'depth': 10},
            'remote_qos': [{
                'node_name': 'publisher', 'node_namespace': '/robot',
                'endpoint_kind': 'publishers',
                'qos': {'reliability': 'best_effort', 'depth': 5},
                'unrelated': {'large': 'must not pass'},
            }],
            'publisher_qos': [{'node_name': 'extra', 'qos': {'depth': 99}}],
        }),
        ('service', 'services', 'service_qos_incompatible', {
            'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
            'type': 'demo/srv/Read', 'qos_status': 'incompatible',
            'qos_detection_source': 'fastdds_discovery',
            'mismatch_policies': ['durability'],
            'mismatch_reason': 'response writer mismatch',
            'local_qos': {'durability': 'volatile', 'depth': 10},
            'remote_qos': [{
                'node_name': 'server', 'service_channel': 'response',
                'endpoint_kind': 'writer',
                'qos': {'durability': 'transient_local', 'depth': 1},
            }],
            'last_call_summary': {'last_request_preview': {'must': 'drop'}},
        }),
    ],
)
def test_llm_complete_context_uses_original_runtime_qos_field_selection(
    source, collection, code, resource,
):
    cache = MonitorCache()
    cache.update({collection: {collection: [resource]}})

    context = asyncio.run(_local_context_service(
        cache, FakeMonitorClient(),
    )._build_context(_alert(source, code=code)))

    data = context['current_runtime_state']['data']
    assert data['qos_status'] == 'incompatible'
    assert data['mismatch_reason']
    assert 'local_profile' not in data
    assert 'remote_endpoints' not in data
    serialized = json.dumps(context, ensure_ascii=False)
    assert 'must not pass' not in serialized or source == 'service'
    if source == 'service':
        assert 'last_request_preview' in serialized


def test_local_topic_missing_and_action_failure_keep_decisive_values():
    topic = {
        'name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'types': ['demo/msg/Value'], 'status': 'missing', 'graph_present': True,
        'publisher_count': 1, 'subscriber_count': 1, 'hz': 0.0, 'age_sec': None,
        'stale': False, 'last_received_at': None,
        'reception_diagnosis': {
            'reception_status': 'missing', 'publisher_present': True,
            'subscription_created': True, 'cause': 'no_message', 'certainty': 'observed',
        },
    }
    action = {
        'name': '/run', 'resource_key': '99:/run', 'domain_id': 99,
        'type': 'demo/action/Run', 'graph_present': True, 'server_count': 1,
        'client_count': 1, 'last_goal_summary': {
            'sent_to_server': True, 'accepted': True, 'last_goal_status': 'aborted',
            'execution_time_ms': 42, 'error_type': 'result_error', 'last_error': 'aborted',
        },
    }
    cache = MonitorCache()
    cache.update({
        'topics': {'topics': [topic]},
        'actions': {'actions': [action]},
    })
    service = _local_context_service(cache, FakeMonitorClient())

    missing = asyncio.run(service._build_context(
        _alert('topic', code='topic_message_missing'),
    ))['current_runtime_state']['data']
    failed = asyncio.run(service._build_context(
        _alert('action', name='/run', resource_key='99:/run', code='action_goal_aborted'),
    ))['current_runtime_state']['data']

    assert missing['publisher_count'] == 1
    assert 'reception_diagnosis' not in missing
    assert failed['last_goal_summary'] == {
        'last_goal_status': 'aborted', 'sent_to_server': True, 'accepted': True,
        'execution_time_ms': 42, 'error_type': 'result_error', 'last_error': 'aborted',
    }


def test_llm_complete_monitor_status_and_node_context_match_llm_commit():
    monitor_context = asyncio.run(_local_context_service(MonitorCache(), FakeMonitorClient())._build_context(
        _validated_alert(_alert(
            'monitor_status', device_name='robot', node_name='/monitor', status='error',
            values={f'key_{index}': index for index in range(8)},
        )),
    ))
    assert monitor_context['current_runtime_state']['data'] is None

    node = {
        'full_name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'status': 'disconnected', 'graph_present': False, 'last_seen_at': 4,
        'topic_publishers': [{'name': '/large'}], 'service_clients': [{'name': '/large'}],
    }
    cache = MonitorCache()
    cache.update({'nodes': {'nodes': [node]}})
    node_context = asyncio.run(_local_context_service(cache, FakeMonitorClient())._build_context(
        _alert('node', code='node_stale'),
    ))
    assert node_context['current_runtime_state']['data']['status'] == 'disconnected'
    assert node_context['current_runtime_state']['data']['topic_publishers'] == [{'name': '/large'}]
    assert node_context['current_runtime_state']['data']['service_clients'] == [{'name': '/large'}]


def test_node_stale_final_local_payload_restores_llm_complete_relationships():
    node = {
        'full_name': '/demo', 'resource_key': '99:/demo', 'domain_id': 99,
        'status': 'disconnected', 'graph_present': False, 'last_seen_at': 1,
        'topic_publishers': [{'name': '/topic_should_not_appear'}],
        'topic_subscribers': [{'name': '/subscriber_should_not_appear'}],
        'service_servers': [{'name': '/ScheduleCrud'}],
        'service_clients': [{'name': '/describe_parameters'}],
        'action_servers': [{'name': '/action_should_not_appear'}],
        'action_clients': [{'name': '/action_client_should_not_appear'}],
    }
    cache = MonitorCache()
    cache.update({'nodes': {'nodes': [node]}})
    service = _local_context_service(cache, FakeMonitorClient())
    context = asyncio.run(service._build_context(
        _validated_alert(_alert('node', code='node_stale')),
    ))
    prompt = _local_llm_payload(context, 'configured-gemma')['messages'][1]['content']

    assert context['resource'] == {
        'kind': 'node', 'name': '/demo', 'domain_id': 99, 'interface_type': None,
    }
    assert context['historical_data']['items'] == []
    for expected in (
        'topic_publishers', 'topic_subscribers', 'service_servers', 'service_clients',
        'action_servers', 'action_clients', '/ScheduleCrud', '/describe_parameters',
        '/topic_should_not_appear', '/subscriber_should_not_appear',
    ):
        assert expected in prompt


def test_local_schema_restores_llm_output_capacity():
    long_analysis = {
        'summary': '짧은 요약',
        'evidence': [f'근거 {index}' for index in range(6)],
        'likely_causes': [f'원인 {index}' for index in range(5)],
        'recommended_checks': [f'확인 {index}' for index in range(7)],
    }

    def handler(request):
        return httpx.Response(200, request=request, json={
            'model': 'configured-gemma', 'message': {'content': json.dumps(long_analysis)},
            'prompt_eval_count': 100, 'eval_count': 20,
        })

    result = asyncio.run(_local_service(handler).diagnose_local(_alert('node')))
    assert [len(result[key]) for key in ('evidence', 'likely_causes', 'recommended_checks')] == [6, 5, 7]


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


def test_router_exposes_local_model_status_and_starts_download(monkeypatch):
    calls = []

    class RecordingManager:
        async def status(self):
            calls.append('status')
            return {
                'ollama_available': True,
                'model': 'configured-gemma',
                'model_installed': False,
                'download_state': 'idle',
            }

        async def start_download(self):
            calls.append('start')
            return {
                'ollama_available': True,
                'model': 'configured-gemma',
                'model_installed': False,
                'download_state': 'preparing',
            }

    monkeypatch.setattr(alert_router, 'local_model_manager', RecordingManager())

    status = asyncio.run(alert_router.local_ai_model_status())
    started = asyncio.run(alert_router.start_local_ai_model_download())

    assert status['data']['model'] == 'configured-gemma'
    assert started['data']['download_state'] == 'preparing'
    assert calls == ['status', 'start']


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

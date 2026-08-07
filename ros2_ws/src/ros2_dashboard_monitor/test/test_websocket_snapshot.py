"""Browser WebSocket 경량 monitor snapshot 계약 회귀 테스트입니다."""

from ros2_dashboard_monitor.snapshot_summary import assemble_websocket_snapshot


def test_websocket_snapshot_keeps_compact_public_contract() -> None:
    payload = assemble_websocket_snapshot(
        timestamp=12.5,
        topic_snapshot={
            'topics': [{
                'name': '/demo',
                'status': 'active',
                'deep_monitoring': True,
                'last_message_preview': {'data': 'hello'},
                'last_received_at': 11.0,
            }],
        },
        service_snapshot={
            'services': [{'callable': True, 'last_call_summary': {'status': 'success'}}],
            'meta': {'count': 1, 'active_count': 1},
        },
        action_snapshot={
            'actions': [{
                'callable': True,
                'last_goal_summary': {'status': 'success'},
                'runtime': {'last_goal_status': 'executing'},
            }],
            'meta': {'count': 1, 'active_count': 1, 'observed_goal_count': 1},
        },
        node_snapshot={
            'nodes': [{'status': 'active'}],
            'meta': {'count': 1, 'active_count': 1},
        },
        alerts={'data': [{'id': 'topic:/demo:stale'}]},
    )

    assert payload['type'] == 'monitor_snapshot'
    assert payload['timestamp'] == 12.5
    assert set(payload['data']) == {
        'topics', 'services', 'actions', 'nodes', 'alerts',
    }
    assert payload['data']['topics']['latest']['/demo'] == {
        'message_preview': {'data': 'hello'},
        'last_received_at': 11.0,
    }
    assert payload['data']['services']['callable_count'] == 1
    assert payload['data']['actions']['executing_count'] == 1
    assert payload['data']['nodes']['count'] == 1
    assert payload['data']['alerts'] == [{'id': 'topic:/demo:stale'}]

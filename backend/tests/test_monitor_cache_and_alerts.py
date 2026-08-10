from app.alerts.service import AlertHistoryService
from app.monitor_client.cache import MonitorCache
from app.monitor_client.client import MonitorResponse, MonitorUnavailable
from app.monitor_client.event_consumer import MonitorEventConsumer
from app.routers.monitor_websocket import build_monitor_websocket_payload
from threading import Event


def test_monitor_cache_preserves_last_snapshot_on_error() -> None:
    cache = MonitorCache()
    cache.update({'topics': {'count': 1}})
    cache.mark_error('offline')
    state = cache.snapshot()
    assert state['connected'] is False
    assert state['data']['topics']['count'] == 1


def test_websocket_payload_keeps_snapshot_and_exposes_connection_state() -> None:
    cache = MonitorCache()
    cache.update({'websocket': {'type': 'monitor_snapshot', 'data': {'topics': []}}})

    connected = build_monitor_websocket_payload(cache.snapshot())
    assert connected['connected'] is True
    assert connected['reason'] is None
    assert connected['data'] == {'topics': []}

    cache.mark_error('offline')
    disconnected = build_monitor_websocket_payload(cache.snapshot())
    assert disconnected['connected'] is False
    assert disconnected['reason'] == 'offline'
    assert disconnected['data'] == {'topics': []}


def test_alert_history_is_owned_by_backend() -> None:
    service = AlertHistoryService()
    service.consume({'data': [{'id': 'topic:/demo', 'level': 'warning'}], 'meta': {'count': 1}})
    assert service.snapshot()['meta']['count'] == 1
    service.consume({'data': [], 'meta': {'count': 0}})
    snapshot = service.snapshot()
    assert snapshot['data'] == []
    assert snapshot['history'][0]['alert_state'] == 'resolved'


def test_monitor_consumer_retries_connected_callback_until_it_succeeds() -> None:
    class Client:
        def request(self, *_args, **_kwargs):
            return MonitorResponse(
                200,
                b'{"data":{"topics":{"count":0},"alerts":{"data":[]}}}',
                'application/json',
            )

    completed = Event()
    attempts = []

    def synchronize() -> None:
        attempts.append(len(attempts) + 1)
        if len(attempts) == 1:
            raise MonitorUnavailable('monitor is not ready for priority sync')
        completed.set()

    cache = MonitorCache()
    consumer = MonitorEventConsumer(
        Client(),
        cache,
        0.01,
        on_connected=synchronize,
    )
    consumer.start()
    try:
        assert completed.wait(1.0)
    finally:
        consumer.stop()

    assert attempts == [1, 2]
    assert cache.snapshot()['connected'] is True

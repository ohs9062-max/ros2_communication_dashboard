from app.alerts.service import AlertHistoryService
from app.monitor_client.cache import MonitorCache


def test_monitor_cache_preserves_last_snapshot_on_error() -> None:
    cache = MonitorCache()
    cache.update({'topics': {'count': 1}})
    cache.mark_error('offline')
    state = cache.snapshot()
    assert state['connected'] is False
    assert state['data']['topics']['count'] == 1


def test_alert_history_is_owned_by_backend() -> None:
    service = AlertHistoryService()
    service.consume({'data': [{'id': 'topic:/demo', 'level': 'warning'}], 'meta': {'count': 1}})
    assert service.snapshot()['meta']['count'] == 1
    service.consume({'data': [], 'meta': {'count': 0}})
    snapshot = service.snapshot()
    assert snapshot['data'] == []
    assert snapshot['history'][0]['alert_state'] == 'resolved'

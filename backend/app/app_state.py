"""Singleton assembly for the pure web backend."""

import json

from app.alerts.service import AlertHistoryService
from app.monitor_client.cache import MonitorCache
from app.monitor_client.client import MonitorClient, MonitorUnavailable
from app.monitor_client.event_consumer import MonitorEventConsumer
from app.settings import settings
from app.user_preferences.service import UserPreferencesStore
from app.websocket_manager import WebSocketManager


monitor_client = MonitorClient(settings.monitor_base_url, settings.monitor_timeout_sec)
monitor_cache = MonitorCache()
alert_history = AlertHistoryService()
monitor_consumer = MonitorEventConsumer(
    monitor_client,
    monitor_cache,
    settings.monitor_poll_interval_sec,
    on_snapshot=lambda data: alert_history.consume(data.get('alerts', {})),
    on_connected=lambda: sync_user_preferences(),
)
user_preferences = UserPreferencesStore(settings.user_preferences_path)
websocket_manager = WebSocketManager()


def sync_user_preferences() -> None:
    payload = json.dumps(user_preferences.snapshot()).encode('utf-8')
    response = monitor_client.request(
        'PUT',
        '/transport/priority',
        body=payload,
        content_type='application/json',
    )
    if not 200 <= response.status_code < 300:
        raise MonitorUnavailable(
            f'사용자 우선순위 동기화 실패: monitor HTTP {response.status_code}',
        )

"""Singleton assembly for the pure web backend."""

import json

from app.alerts.ai_diagnosis import AlertDiagnosisService
from app.alerts.local_model import LocalModelManager
from app.alerts.service import AlertHistoryService
from app.database.alert_repository import MariaDbAlertRepository
from app.database.connection import MariaDbConnectionFactory
from app.monitor_client.cache import MonitorCache
from app.monitor_client.client import MonitorClient, MonitorUnavailable
from app.monitor_client.event_consumer import MonitorEventConsumer
from app.settings import settings
from app.user_preferences.service import UserPreferencesStore
from app.websocket_manager import WebSocketManager


monitor_client = MonitorClient(settings.monitor_base_url, settings.monitor_timeout_sec)
monitor_cache = MonitorCache()
alert_ai_diagnosis = AlertDiagnosisService(
    monitor_cache=monitor_cache,
    monitor_client=monitor_client,
    api_key=settings.gemini_api_key,
    api_base_url=settings.gemini_api_base_url,
    timeout_sec=settings.gemini_timeout_sec,
    local_llm_url=settings.local_llm_url,
    local_llm_model=settings.local_llm_model,
    local_llm_timeout_sec=settings.local_llm_timeout_sec,
)
local_model_manager = LocalModelManager(
    base_url=settings.local_llm_url,
    model=settings.local_llm_model,
)
alert_repository = None
if settings.alert_db_enabled:
    alert_repository = MariaDbAlertRepository(MariaDbConnectionFactory(
        host=settings.mariadb_host,
        port=settings.mariadb_port,
        database=settings.mariadb_database,
        user=settings.mariadb_user,
        password=settings.mariadb_password,
        connect_timeout_sec=settings.mariadb_connect_timeout_sec,
        unix_socket=settings.mariadb_unix_socket,
    ))
alert_history = AlertHistoryService(
    alert_repository,
    database_retry_interval_sec=settings.mariadb_retry_interval_sec,
)
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
            f'User priority synchronization failed: Monitor HTTP {response.status_code}',
        )

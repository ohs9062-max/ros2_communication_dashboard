"""Environment-backed settings for the web backend only."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if load_dotenv:
    load_dotenv(BACKEND_ROOT / '.env')


def _backend_path(env_name: str, default: Path) -> Path:
    configured = Path(os.getenv(env_name, str(default))).expanduser()
    return (configured if configured.is_absolute() else BACKEND_ROOT / configured).resolve()


def _env_bool(env_name: str, default: bool) -> bool:
    value = os.getenv(env_name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


@dataclass(frozen=True)
class Settings:
    monitor_base_url: str = os.getenv('MONITOR_BASE_URL', 'http://127.0.0.1:8765').rstrip('/')
    monitor_timeout_sec: float = float(os.getenv('MONITOR_TIMEOUT_SEC', '30'))
    monitor_poll_interval_sec: float = float(os.getenv('MONITOR_POLL_INTERVAL_SEC', '1'))
    cors_origins: tuple[str, ...] = tuple(
        value.strip() for value in os.getenv(
            'CORS_ORIGINS',
            'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174',
        ).split(',') if value.strip()
    )
    user_preferences_path: Path = _backend_path(
        'USER_PREFERENCES_PATH',
        BACKEND_ROOT / 'config' / 'user_preferences.yaml',
    )
    alert_db_enabled: bool = _env_bool('ALERT_DB_ENABLED', True)
    mariadb_host: str = os.getenv('MARIADB_HOST', '127.0.0.1')
    mariadb_port: int = int(os.getenv('MARIADB_PORT', '3306'))
    mariadb_unix_socket: str | None = os.getenv('MARIADB_UNIX_SOCKET') or None
    mariadb_database: str = os.getenv('MARIADB_DATABASE', 'ros2_dashboard')
    mariadb_user: str = os.getenv('MARIADB_USER', 'ros2_dashboard')
    mariadb_password: str = field(
        default_factory=lambda: os.getenv('MARIADB_PASSWORD', ''),
        repr=False,
    )
    mariadb_connect_timeout_sec: float = float(
        os.getenv('MARIADB_CONNECT_TIMEOUT_SEC', '2'),
    )
    mariadb_retry_interval_sec: float = float(
        os.getenv('MARIADB_RETRY_INTERVAL_SEC', '5'),
    )
    gemini_api_key: str = field(
        default_factory=lambda: os.getenv('GEMINI_API_KEY', ''),
        repr=False,
    )
    gemini_api_base_url: str = os.getenv('GEMINI_API_BASE_URL', '').rstrip('/')
    gemini_timeout_sec: float = float(os.getenv('GEMINI_TIMEOUT_SEC', '30'))


settings = Settings()

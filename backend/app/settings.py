"""Environment-backed settings for the web backend only."""

from __future__ import annotations

import os
from dataclasses import dataclass
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


settings = Settings()

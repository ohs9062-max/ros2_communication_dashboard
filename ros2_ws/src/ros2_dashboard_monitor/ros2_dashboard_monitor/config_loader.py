"""Load Monitor configuration files and process environment settings."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from ros2_dashboard_monitor.interface_lab.paths import (
    monitor_config_dir,
    persistent_monitor_config_dir,
    ros_workspace_root,
)
from ros2_dashboard_monitor.monitor_config import (
    DEFAULT_SUPPORTED_TOPIC_TYPES,
    DEFAULT_TOPIC_EXCLUDES,
    MonitorConfig,
    ServiceActiveCheckConfig,
    ServiceActiveCheckTarget,
    build_monitor_config as _monitor_config,
    mapping as _mapping,
)

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


LOGGER = logging.getLogger(__name__)

DEFAULT_CORS_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]


@dataclass(frozen=True)
class BackendConfig:
    cors_origins: tuple[str, ...]
    monitor: MonitorConfig


def load_backend_config() -> BackendConfig:
    """환경변수와 monitor.yaml을 읽어 Backend 전체 설정을 만듭니다."""
    workspace_root = ros_workspace_root()
    _load_env(workspace_root)

    monitor_config_path = _monitor_config_path(workspace_root)
    monitor_data = _load_monitor_yaml(monitor_config_path)
    registered_message_types = _registered_message_types(workspace_root)

    return BackendConfig(
        cors_origins=_cors_origins(),
        monitor=_monitor_config(
            monitor_data,
            registered_message_types=registered_message_types,
        ),
    )


def _load_env(backend_root: Path) -> None:
    env_candidates = [
        backend_root / '.env',
        backend_root / 'src' / 'ros2_dashboard_monitor' / '.env',
    ]

    for env_path in env_candidates:
        if env_path.is_file():
            load_dotenv(env_path)
            return

    load_dotenv()


def _monitor_config_path(backend_root: Path) -> Path:
    configured = os.getenv('MONITOR_CONFIG_PATH')
    if not configured:
        return monitor_config_dir() / 'monitor.yaml'
    config_path = configured
    path = Path(config_path)

    if path.is_absolute():
        return path

    return backend_root / path


def _load_monitor_yaml(config_path: Path) -> dict[str, Any]:
    if not config_path.is_file():
        LOGGER.warning(
            'Monitor config file not found: %s. Using safe defaults.',
            config_path,
        )
        return {}

    if yaml is None:
        LOGGER.warning('PyYAML is not available. Using safe defaults.')
        return {}

    try:
        with config_path.open('r', encoding='utf-8') as config_file:
            data = yaml.safe_load(config_file)
    except yaml.YAMLError as exc:
        LOGGER.warning(
            'Failed to parse monitor config %s: %s. Using safe defaults.',
            config_path,
            exc,
        )
        return {}
    except OSError as exc:
        LOGGER.warning(
            'Failed to read monitor config %s: %s. Using safe defaults.',
            config_path,
            exc,
        )
        return {}

    if isinstance(data, dict):
        return data

    LOGGER.warning(
        'Monitor config %s is not a mapping. Using safe defaults.',
        config_path,
    )
    return {}


def _registered_message_types(backend_root: Path) -> tuple[str, ...]:
    registry_paths = (
        _backend_config_path(
            backend_root,
            env_name='INTERFACE_REGISTRY_PATH',
            default='config/interface_registry.yaml',
        ),
        _backend_config_path(
            backend_root,
            env_name='INTERFACE_PACKAGES_REGISTRY_PATH',
            default='config/interface_packages.yaml',
        ),
    )
    message_types: list[str] = []
    for path in registry_paths:
        data = _load_monitor_yaml(path)
        registry_messages = _mapping(data.get('interface_registry')).get('messages')
        if isinstance(registry_messages, list):
            for item in registry_messages:
                entry = _mapping(item)
                build = _mapping(entry.get('build'))
                full_type = entry.get('full_type')
                if build.get('import_available') is True and isinstance(full_type, str):
                    message_types.append(full_type)

        packages = data.get('packages')
        if not isinstance(packages, list):
            continue
        for package_item in packages:
            package = _mapping(package_item)
            messages = _mapping(package.get('interfaces')).get('msg')
            if not isinstance(messages, list):
                continue
            for item in messages:
                entry = _mapping(item)
                full_type = entry.get('type')
                if entry.get('import_available') is True and isinstance(full_type, str):
                    message_types.append(full_type)

    return tuple(dict.fromkeys(message_types))


def _backend_config_path(
    backend_root: Path,
    *,
    env_name: str,
    default: str,
) -> Path:
    configured = os.getenv(env_name)
    if not configured:
        return persistent_monitor_config_dir() / Path(default).name
    path = Path(configured)
    return path if path.is_absolute() else backend_root / path


def _cors_origins() -> tuple[str, ...]:
    value = os.getenv('CORS_ORIGINS')
    if value is None:
        return tuple(DEFAULT_CORS_ORIGINS)

    origins = tuple(
        origin.strip()
        for origin in value.split(',')
        if origin.strip()
    )
    return origins or tuple(DEFAULT_CORS_ORIGINS)

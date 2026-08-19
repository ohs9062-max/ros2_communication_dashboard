"""단일 Interface Registry와 generated package의 배포 경로를 결정합니다."""

from __future__ import annotations

import os
from pathlib import Path

from ros2_dashboard_monitor.interface_lab.paths import (
    persistent_monitor_config_dir,
    portable_workspace_path,
    ros_workspace_root,
)


def default_registry_path() -> Path:
    workspace_root = ros_workspace_root()
    configured_value = os.getenv('INTERFACE_REGISTRY_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_registry.yaml'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else workspace_root / configured


def default_interface_package() -> tuple[str, Path]:
    workspace_root = ros_workspace_root()
    package_name = os.getenv('INTERFACE_PACKAGE_NAME', 'uploaded_interfaces').strip()
    configured = Path(os.getenv('INTERFACE_PACKAGE_PATH', 'src/uploaded_interfaces/generated_interfaces'))
    package_path = configured if configured.is_absolute() else workspace_root / configured
    return package_name, package_path.resolve()


def display_path(path: Path) -> str:
    return portable_workspace_path(path)

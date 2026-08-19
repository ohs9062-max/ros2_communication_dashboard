"""Interface Lab의 paths 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import os
from pathlib import Path


def ros_workspace_root() -> Path:
    """실행 위치와 무관하게 ROS2 workspace 루트를 반환합니다."""
    configured = os.getenv('ROS2_DASHBOARD_WS_ROOT')
    if configured:
        return Path(configured).expanduser().resolve()

    source_path = Path(__file__).resolve()
    for parent in source_path.parents:
        if parent.name == 'ros2_ws':
            return parent
    for parent in source_path.parents:
        if parent.name == 'install':
            return parent.parent
    raise RuntimeError(
        'The ROS2 workspace root could not be found. Set ROS2_DASHBOARD_WS_ROOT.',
    )


def monitor_package_root() -> Path:
    """설치 share 또는 source package root를 반환합니다."""
    try:
        from ament_index_python.packages import get_package_share_directory

        return Path(get_package_share_directory('ros2_dashboard_monitor')).resolve()
    except (ImportError, LookupError):
        return Path(__file__).resolve().parents[2]


def monitor_config_dir() -> Path:
    """설치된 Monitor의 읽기 전용 기본 설정 경로를 반환합니다."""
    return monitor_package_root() / 'config'


def persistent_monitor_config_dir() -> Path:
    """빌드해도 덮어쓰지 않는 Interface Lab 상태 저장 경로를 반환합니다."""
    configured = os.getenv('ROS2_DASHBOARD_MONITOR_CONFIG_DIR')
    if configured:
        path = Path(configured).expanduser()
        return path.resolve() if path.is_absolute() else (ros_workspace_root() / path).resolve()

    source_config = (
        ros_workspace_root()
        / 'src'
        / 'ros2_dashboard_monitor'
        / 'config'
    )
    if source_config.parent.is_dir():
        return source_config

    # Binary-only installations have no source workspace. Environment override is
    # recommended there; this fallback preserves read compatibility.
    return monitor_config_dir()


def portable_workspace_path(
    path: Path,
    *,
    workspace_root: Path | None = None,
) -> str:
    """프로젝트 내부 경로는 checkout 위치와 무관한 상대경로로 직렬화합니다."""
    workspace = (workspace_root or ros_workspace_root()).resolve()
    resolved = path.expanduser().resolve()
    try:
        return resolved.relative_to(workspace.parent).as_posix()
    except ValueError:
        return str(resolved)


def resolve_stored_workspace_path(
    value: str | Path,
    *,
    workspace_root: Path | None = None,
) -> Path:
    """저장된 상대경로와 이전 checkout의 절대경로를 현재 workspace로 복원합니다."""
    workspace = (workspace_root or ros_workspace_root()).resolve()
    stored = Path(value).expanduser()
    if not stored.is_absolute():
        if stored.parts and stored.parts[0] == workspace.name:
            return (workspace.parent / stored).resolve()
        return (workspace / stored).resolve()

    try:
        stored.relative_to(workspace)
        return stored.resolve()
    except ValueError:
        pass

    matching_indexes = [
        index for index, part in enumerate(stored.parts)
        if part == workspace.name
    ]
    if matching_indexes:
        suffix = stored.parts[matching_indexes[-1] + 1:]
        return workspace.joinpath(*suffix).resolve()
    return stored.resolve()


def generated_interface_package_root() -> Path:
    return ros_workspace_root() / 'src' / 'uploaded_interfaces' / 'generated_interfaces'

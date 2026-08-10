"""Interface Apply 영속 상태와 상태 전이를 관리합니다."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.apply.status_storage import (
    read_log_tail,
    read_status,
    write_status,
)
from ros2_dashboard_monitor.interface_lab.paths import (
    persistent_monitor_config_dir,
    ros_workspace_root,
)


def ros_workspace_path() -> Path:
    """colcon build를 실행할 ROS workspace 경로를 반환합니다."""
    return ros_workspace_root()


def default_apply_status_path() -> Path:
    """Interface Apply 상태 YAML 경로를 반환합니다."""
    workspace = ros_workspace_path()
    configured_value = os.getenv('INTERFACE_APPLY_STATUS_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_apply_status.yaml'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else workspace / configured


def default_apply_log_path() -> Path:
    """마지막 Interface Apply log 경로를 반환합니다."""
    workspace = ros_workspace_path()
    configured_value = os.getenv('INTERFACE_APPLY_LOG_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_apply_last.log'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else workspace / configured


def apply_status(*, running: bool) -> dict[str, Any]:
    """저장된 Apply 상태에 현재 lock과 log tail을 결합합니다."""
    status = read_apply_status()
    status['running'] = running
    status['log_tail'] = read_log_tail(
        Path(status.get('log_path') or default_apply_log_path()),
    )
    return status


def mark_interface_change_pending(message: str) -> dict[str, Any]:
    """Interface 변경 뒤 rebuild가 필요하다는 상태를 저장합니다."""
    status = read_apply_status()
    status.update({
        'running': False,
        'status': 'rebuild_required',
        'build_status': 'rebuild_required',
        'real_apply_success': False,
        'build_required': True,
        'change_message': message,
        'changed_at': datetime.now(timezone.utc).isoformat(),
        'reload_scheduled': False,
        'restart_scheduled': False,
    })
    write_status(default_apply_status_path(), status)
    return status


def record_import_check_status(result: dict[str, Any]) -> dict[str, Any]:
    """Import 확인 결과를 마지막 Apply 상태에 병합해 저장합니다."""
    status = read_apply_status()
    status['real_apply_success'] = bool(result.get('real_apply_success'))
    if status.get('build_status') == 'success':
        status['status'] = 'success' if result.get('real_apply_success') else 'import_failed'
        status['reload_scheduled'] = False
        status['restart_scheduled'] = False
        status['error'] = None if result.get('real_apply_success') else (
            '빌드는 성공했지만 현재 backend 프로세스에서 import 확인에 실패했습니다.'
        )
    status['summary'] = result.get('summary')
    status['not_applied'] = result.get('not_applied', [])
    status['install_python_paths'] = result.get('install_python_paths', [])
    status['install_python_paths_added'] = result.get('install_python_paths_added', [])
    status['import_check'] = result
    write_status(default_apply_status_path(), status)
    status['log_tail'] = read_log_tail(
        Path(status.get('log_path') or default_apply_log_path()),
    )
    return status


def read_apply_status() -> dict[str, Any]:
    """저장된 Apply 상태를 읽고 없으면 idle 상태를 반환합니다."""
    return read_status(default_apply_status_path(), default_factory=empty_status)


def empty_status() -> dict[str, Any]:
    """아직 Apply가 실행되지 않은 초기 상태를 반환합니다."""
    workspace = ros_workspace_path()
    log_path = default_apply_log_path()
    return {
        'running': False,
        'status': 'idle',
        'build_status': 'idle',
        'real_apply_success': False,
        'started_at': None,
        'finished_at': None,
        'returncode': None,
        'workspace_path': str(workspace),
        'log_path': str(log_path),
        'reload_scheduled': False,
        'restart_scheduled': False,
        'reload_trigger_path': None,
        'error': None,
        'summary': None,
        'not_applied': [],
        'install_python_paths': [],
        'install_python_paths_added': [],
        'import_check': None,
    }

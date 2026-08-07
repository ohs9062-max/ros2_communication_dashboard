"""Interface Lab의 runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.paths import (
    persistent_monitor_config_dir,
    ros_workspace_root,
)
from ros2_dashboard_monitor.interface_lab.management.registry import (
    mark_registry_build_applied,
    registry_apply_summary,
    refresh_registry_imports,
)
from ros2_dashboard_monitor.interface_lab.management.packages import (
    mark_packages_build_applied,
    package_apply_summary,
    packages_snapshot,
    refresh_package_imports,
)
from ros2_dashboard_monitor.interface_lab.apply.errors import (
    InterfaceApplyError,
    InterfaceApplyInProgress,
)
from ros2_dashboard_monitor.interface_lab.apply.status_storage import (
    read_log_tail as _read_log_tail,
    read_status,
    write_status as _write_status,
    write_text as _write_text,
)
from ros2_dashboard_monitor.interface_lab.apply.workspace_packages import (
    cleanup_build_artifacts as cleanup_uploaded_package_build_artifacts,
    duplicate_packages as duplicate_workspace_packages,
    uploaded_package_names,
)
from ros2_dashboard_monitor.interface_lab.apply.install_paths import (
    find_site_packages,
    refresh_python_paths,
)
from ros2_dashboard_monitor.interface_lab.apply.summary import combine as combine_apply_summaries
from ros2_dashboard_monitor.interface_lab.apply.build_executor import (
    COLCON_COMMAND,
    format_build_log,
    format_error_log,
    format_skipped_log,
    run_colcon,
)
from ros2_dashboard_monitor.interface_lab.apply import result_builder


_APPLY_LOCK = threading.Lock()


def ros_workspace_path() -> Path:
    """colcon build를 실행할 Backend ROS workspace 경로를 반환합니다."""
    return ros_workspace_root()


def default_apply_status_path() -> Path:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    backend_root = ros_workspace_path()
    configured_value = os.getenv('INTERFACE_APPLY_STATUS_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_apply_status.yaml'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else backend_root / configured


def default_apply_log_path() -> Path:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    backend_root = ros_workspace_path()
    configured_value = os.getenv('INTERFACE_APPLY_LOG_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_apply_last.log'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else backend_root / configured


def apply_status() -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    status = _read_status()
    status['running'] = _APPLY_LOCK.locked()
    status['log_tail'] = _read_log_tail(Path(status.get('log_path') or default_apply_log_path()))
    return status


def mark_interface_change_pending(message: str) -> dict[str, Any]:
    """Interface 변경 뒤 build가 필요하다는 상태와 변경 사유를 저장합니다."""
    status = _read_status()
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
    _write_status(default_apply_status_path(), status)
    return status


def run_interface_apply() -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    if not _APPLY_LOCK.acquire(blocking=False):
        raise InterfaceApplyInProgress('이미 적용하기 빌드가 실행 중입니다.')

    started_at = datetime.now(timezone.utc).isoformat()
    workspace = ros_workspace_path()
    log_path = default_apply_log_path()
    status_path = default_apply_status_path()
    _write_status(status_path, result_builder.running(
        started_at=started_at,
        workspace=workspace,
        log_path=log_path,
    ))

    command = COLCON_COMMAND
    try:
        preflight = combined_apply_summary(require_import_available=False)
        blocking_not_applied = [
            item for item in preflight['not_applied']
            if 'import_available false' not in item['reason']
        ]
        if blocking_not_applied or preflight['total'] == 0:
            finished_at = datetime.now(timezone.utc).isoformat()
            message = (
                '등록된 interface 또는 interface package가 없습니다.'
                if preflight['total'] == 0
                else '일부 interface가 파일 생성 또는 CMake 등록되지 않았습니다.'
            )
            _write_text(log_path, format_skipped_log(
                started_at=started_at,
                finished_at=finished_at,
                workspace=workspace,
                reason=message,
            ))
            status = result_builder.preflight_skipped(
                started_at=started_at,
                finished_at=finished_at,
                workspace=workspace,
                log_path=log_path,
                message=message,
                summary=preflight,
            )
            _write_status(status_path, status)
            status['log_tail'] = _read_log_tail(log_path)
            return status

        uploaded_package_names = uploaded_interface_package_names()
        duplicates = duplicate_workspace_packages(workspace, uploaded_package_names)
        if duplicates:
            finished_at = datetime.now(timezone.utc).isoformat()
            message = '중복 ROS2 package가 감지되어 build를 중단했습니다.'
            duplicate_lines = [
                f'{name}: {", ".join(paths)}'
                for name, paths in sorted(duplicates.items())
            ]
            _write_text(log_path, format_skipped_log(
                started_at=started_at,
                finished_at=finished_at,
                workspace=workspace,
                reason=message,
                duplicate_lines=duplicate_lines,
            ))
            status = result_builder.duplicate_packages(
                started_at=started_at,
                finished_at=finished_at,
                workspace=workspace,
                log_path=log_path,
                message=message,
                duplicate_lines=duplicate_lines,
                duplicates=duplicates,
                package_names=uploaded_package_names,
                summary=preflight,
            )
            _write_status(status_path, status)
            status['log_tail'] = _read_log_tail(log_path)
            return status

        cleanup_result = cleanup_uploaded_package_build_artifacts(
            workspace,
            uploaded_package_names,
        )
        completed = run_colcon(workspace, command=command, runner=subprocess.run)
        finished_at = datetime.now(timezone.utc).isoformat()
        output = format_build_log(
            command=command,
            completed=completed,
            started_at=started_at,
            finished_at=finished_at,
            workspace=workspace,
            cleanup=cleanup_result,
        )
        _write_text(log_path, output)
        build_success = completed.returncode == 0
        import_check: dict[str, Any] | None = None
        path_refresh = {
            'site_packages': [],
            'added': [],
        }
        if build_success:
            mark_registry_build_applied()
            mark_packages_build_applied()
            path_refresh = refresh_install_python_paths(workspace)
            import_check = run_import_check_and_update_registry(workspace)
            summary = import_check['summary']
        else:
            summary = combined_apply_summary(require_import_available=False)
        status = result_builder.completed(
            started_at=started_at,
            finished_at=finished_at,
            workspace=workspace,
            log_path=log_path,
            returncode=completed.returncode,
            summary=summary,
            path_refresh=path_refresh,
            import_check=import_check,
            cleanup=cleanup_result,
        )
        _write_status(status_path, status)
        status['log_tail'] = _read_log_tail(log_path)
        return status
    except OSError as exc:
        finished_at = datetime.now(timezone.utc).isoformat()
        _write_text(log_path, format_error_log(
            command=command,
            error=exc,
            started_at=started_at,
            finished_at=finished_at,
            workspace=workspace,
        ))
        status = result_builder.failed_exception(
            started_at=started_at,
            finished_at=finished_at,
            workspace=workspace,
            log_path=log_path,
            error=exc,
            summary=combined_apply_summary(require_import_available=False),
        )
        _write_status(status_path, status)
        status['log_tail'] = _read_log_tail(log_path)
        return status
    finally:
        _APPLY_LOCK.release()


def restart_monitor_after_delay(delay_sec: float = 0.75) -> None:
    """Apply 응답 전송 뒤 동일 PID로 Monitor Python 프로세스를 교체합니다."""
    time.sleep(delay_sec)
    os.execv(sys.executable, [sys.executable, *sys.argv])


def uploaded_interface_package_names() -> list[str]:
    """현재 업로드 저장소에 등록된 package 이름을 반환합니다."""
    try:
        registry = packages_snapshot()
    except Exception:
        return []
    return uploaded_package_names(registry)


def _empty_status() -> dict[str, Any]:
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


def run_import_check_and_update_registry(workspace_path: Path | None = None) -> dict[str, Any]:
    """Interface Lab에서 runtime 상태를 갱신하는 함수입니다."""
    workspace = workspace_path or ros_workspace_path()
    path_refresh = refresh_install_python_paths(workspace)
    registry = refresh_registry_imports()
    package_registry = refresh_package_imports()
    summary = combined_apply_summary(
        registry_summary=registry.get('apply_summary'),
        package_summary=package_registry.get('apply_summary'),
        require_import_available=True,
    )
    return {
        'real_apply_success': bool(summary['real_apply_success']),
        'status': summary['status'],
        'summary': summary,
        'not_applied': summary['not_applied'],
        'install_python_paths': path_refresh['site_packages'],
        'install_python_paths_added': path_refresh['added'],
    }


def combined_apply_summary(
    *,
    registry_summary: dict[str, Any] | None = None,
    package_summary: dict[str, Any] | None = None,
    require_import_available: bool = False,
) -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    single = registry_summary or registry_apply_summary(
        require_import_available=require_import_available,
    )
    packages = package_summary or package_apply_summary(
        require_import_available=require_import_available,
    )
    return combine_apply_summaries(
        single,
        packages,
        require_import_available=require_import_available,
    )


def record_import_check_status(result: dict[str, Any]) -> dict[str, Any]:
    """Interface Lab에서 생성된 interface 타입 import 가능 여부를 확인하는 함수입니다."""
    status = _read_status()
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
    _write_status(default_apply_status_path(), status)
    status['log_tail'] = _read_log_tail(Path(status.get('log_path') or default_apply_log_path()))
    return status


def refresh_install_python_paths(workspace_path: Path | None = None) -> dict[str, list[str]]:
    """install의 Python site-packages를 찾아 현재 sys.path에 반영합니다."""
    return refresh_python_paths(workspace_path or ros_workspace_path())


def find_install_site_packages(workspace_path: Path | None = None) -> list[Path]:
    """workspace install 아래의 Python site-packages 경로를 찾습니다."""
    return find_site_packages(workspace_path or ros_workspace_path())


def _read_status() -> dict[str, Any]:
    return read_status(default_apply_status_path(), default_factory=_empty_status)

"""Interface Lab의 runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any

from ros2_dashboard_monitor.interface_lab.apply.errors import (
    InterfaceApplyError,
    InterfaceApplyInProgress,
)
from ros2_dashboard_monitor.interface_lab.apply.status_storage import (
    read_log_tail as _read_log_tail,
    write_status as _write_status,
    write_text as _write_text,
)
from ros2_dashboard_monitor.interface_lab.apply.state import (
    apply_status as _apply_status,
    default_apply_log_path,
    default_apply_status_path,
    empty_status as _empty_status,
    mark_interface_change_pending,
    read_apply_status as _read_status,
    record_import_check_status,
    ros_workspace_path,
)
from ros2_dashboard_monitor.interface_lab.apply.workspace_packages import (
    cleanup_build_artifacts as cleanup_uploaded_package_build_artifacts,
    duplicate_packages as duplicate_workspace_packages,
)
from ros2_dashboard_monitor.interface_lab.apply.import_check import (
    combined_apply_summary,
    find_install_site_packages,
    mark_build_applied,
    refresh_install_python_paths,
    run_import_check_and_update_registry,
    uploaded_interface_package_names,
)
from ros2_dashboard_monitor.interface_lab.apply.build_executor import (
    COLCON_COMMAND,
    format_build_log,
    format_error_log,
    format_skipped_log,
    run_colcon,
)
from ros2_dashboard_monitor.interface_lab.apply import result_builder


_APPLY_LOCK = threading.Lock()


def apply_status() -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    return _apply_status(running=_APPLY_LOCK.locked())


def run_interface_apply() -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    if not _APPLY_LOCK.acquire(blocking=False):
        raise InterfaceApplyInProgress('An interface apply build is already running.')

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
                'No interface or interface package is registered.'
                if preflight['total'] == 0
                else 'One or more interfaces were not written to disk or registered in CMake.'
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
            message = 'The build was stopped because duplicate ROS2 packages were detected.'
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
            mark_build_applied()
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

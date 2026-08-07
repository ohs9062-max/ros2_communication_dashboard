"""Interface Apply 단계별 공개 상태 payload 조립."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def running(*, started_at: str, workspace: Path, log_path: Path) -> dict[str, Any]:
    return _base(started_at=started_at, workspace=workspace, log_path=log_path) | {
        'running': True,
        'status': 'running',
        'build_status': 'running',
    }


def preflight_skipped(
    *,
    started_at: str,
    finished_at: str,
    workspace: Path,
    log_path: Path,
    message: str,
    summary: dict[str, Any],
) -> dict[str, Any]:
    return _base(started_at=started_at, workspace=workspace, log_path=log_path) | {
        'status': 'partial',
        'build_status': 'skipped',
        'finished_at': finished_at,
        'error': message,
        'summary': summary,
        'not_applied': summary['not_applied'],
    }


def duplicate_packages(
    *,
    started_at: str,
    finished_at: str,
    workspace: Path,
    log_path: Path,
    message: str,
    duplicate_lines: list[str],
    duplicates: dict[str, list[str]],
    package_names: list[str],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return _base(started_at=started_at, workspace=workspace, log_path=log_path) | {
        'status': 'failed',
        'build_status': 'skipped',
        'finished_at': finished_at,
        'error': f'{message} {"; ".join(duplicate_lines)}',
        'summary': summary,
        'not_applied': summary['not_applied'],
        'cleanup': {
            'package_names': package_names,
            'removed': [],
            'duplicates': duplicates,
        },
    }


def completed(
    *,
    started_at: str,
    finished_at: str,
    workspace: Path,
    log_path: Path,
    returncode: int,
    summary: dict[str, Any],
    path_refresh: dict[str, list[str]],
    import_check: dict[str, Any] | None,
    cleanup: dict[str, Any],
) -> dict[str, Any]:
    build_success = returncode == 0
    real_apply_success = build_success and bool(summary['real_apply_success'])
    status_name = 'success' if real_apply_success else 'partial'
    if not build_success:
        status_name = 'failed'
    elif not path_refresh['site_packages'] or not real_apply_success:
        status_name = 'import_failed'
    return _base(started_at=started_at, workspace=workspace, log_path=log_path) | {
        'status': status_name,
        'build_status': 'success' if build_success else 'failed',
        'real_apply_success': real_apply_success,
        'finished_at': finished_at,
        'returncode': returncode,
        'reload_scheduled': real_apply_success,
        'restart_scheduled': real_apply_success,
        'error': None if real_apply_success else (
            'colcon build failed' if not build_success
            else '빌드는 성공했지만 현재 backend 프로세스에서 import 확인에 실패했습니다.'
        ),
        'summary': summary,
        'not_applied': summary['not_applied'],
        'install_python_paths': path_refresh['site_packages'],
        'install_python_paths_added': path_refresh['added'],
        'import_check': import_check,
        'cleanup': cleanup,
    }


def failed_exception(
    *,
    started_at: str,
    finished_at: str,
    workspace: Path,
    log_path: Path,
    error: OSError,
    summary: dict[str, Any],
) -> dict[str, Any]:
    return _base(started_at=started_at, workspace=workspace, log_path=log_path) | {
        'status': 'failed',
        'build_status': 'failed',
        'finished_at': finished_at,
        'error': str(error),
        'summary': summary,
        'not_applied': summary['not_applied'],
    }


def _base(*, started_at: str, workspace: Path, log_path: Path) -> dict[str, Any]:
    return {
        'running': False,
        'status': 'idle',
        'build_status': 'idle',
        'real_apply_success': False,
        'started_at': started_at,
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

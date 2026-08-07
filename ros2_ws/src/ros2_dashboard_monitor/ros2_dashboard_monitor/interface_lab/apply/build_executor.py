"""Interface Apply의 colcon subprocess 실행과 build log 조립."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Callable


COLCON_COMMAND = 'source /opt/ros/jazzy/setup.bash && colcon build --symlink-install'


def run_colcon(
    workspace: Path,
    *,
    command: str = COLCON_COMMAND,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> subprocess.CompletedProcess[str]:
    return runner(
        ['/bin/bash', '-lc', command],
        cwd=workspace,
        capture_output=True,
        check=False,
        text=True,
    )


def format_build_log(
    *,
    command: str,
    completed: subprocess.CompletedProcess[str],
    started_at: str,
    finished_at: str,
    workspace: Path,
    cleanup: dict[str, Any] | None = None,
) -> str:
    cleanup = cleanup or {'package_names': [], 'removed': [], 'duplicates': {}}
    return '\n'.join([
        f'started_at: {started_at}',
        f'finished_at: {finished_at}',
        f'workspace: {workspace}',
        f'command: {command}',
        f'returncode: {completed.returncode}',
        '',
        '[pre_build_cleanup]',
        f'package_names: {", ".join(cleanup.get("package_names", []))}',
        f'removed: {", ".join(cleanup.get("removed", []))}',
        '',
        '[stdout]',
        completed.stdout or '',
        '',
        '[stderr]',
        completed.stderr or '',
    ])


def format_skipped_log(
    *,
    started_at: str,
    finished_at: str,
    workspace: Path,
    reason: str,
    duplicate_lines: list[str] | None = None,
) -> str:
    lines = [
        f'started_at: {started_at}',
        f'finished_at: {finished_at}',
        f'workspace: {workspace}',
        'command: skipped',
        f'reason: {reason}',
        '',
    ]
    if duplicate_lines:
        lines.extend(['[duplicates]', *duplicate_lines, ''])
    return '\n'.join(lines)


def format_error_log(
    *,
    command: str,
    error: OSError,
    started_at: str,
    finished_at: str,
    workspace: Path,
) -> str:
    return '\n'.join([
        f'started_at: {started_at}',
        f'finished_at: {finished_at}',
        f'workspace: {workspace}',
        f'command: {command}',
        f'error: {error}',
        '',
    ])

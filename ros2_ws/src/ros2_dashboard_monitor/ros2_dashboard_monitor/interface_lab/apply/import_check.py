"""Interface Apply의 install 경로 반영과 import 상태 확인을 조정합니다."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.apply.install_paths import (
    find_site_packages,
    refresh_python_paths,
)
from ros2_dashboard_monitor.interface_lab.apply.state import ros_workspace_path
from ros2_dashboard_monitor.interface_lab.apply.summary import (
    combine as combine_apply_summaries,
)
from ros2_dashboard_monitor.interface_lab.apply.workspace_packages import (
    uploaded_package_names,
)
from ros2_dashboard_monitor.interface_lab.management.packages import (
    mark_packages_build_applied,
    package_apply_summary,
    packages_snapshot,
    refresh_package_imports,
)
from ros2_dashboard_monitor.interface_lab.management.registry import (
    mark_registry_build_applied,
    refresh_registry_imports,
    registry_apply_summary,
)


def mark_build_applied() -> None:
    """단일 Interface와 업로드 package의 build 완료 상태를 갱신합니다."""
    mark_registry_build_applied()
    mark_packages_build_applied()


def uploaded_interface_package_names() -> list[str]:
    """현재 업로드 저장소에 등록된 package 이름을 반환합니다."""
    try:
        registry = packages_snapshot()
    except Exception:
        return []
    return uploaded_package_names(registry)


def run_import_check_and_update_registry(
    workspace_path: Path | None = None,
) -> dict[str, Any]:
    """Install 경로를 반영하고 Registry의 실제 import 상태를 갱신합니다."""
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
    """단일 Interface와 package Apply 상태를 하나의 summary로 병합합니다."""
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


def refresh_install_python_paths(
    workspace_path: Path | None = None,
) -> dict[str, list[str]]:
    """Install의 Python site-packages를 현재 sys.path에 반영합니다."""
    return refresh_python_paths(workspace_path or ros_workspace_path())


def find_install_site_packages(
    workspace_path: Path | None = None,
) -> list[Path]:
    """Workspace install 아래 Python site-packages 경로를 반환합니다."""
    return find_site_packages(workspace_path or ros_workspace_path())

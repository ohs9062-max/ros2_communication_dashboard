"""Generated interface 파일과 Registry 항목 삭제 순서를 관리합니다."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.management.errors import (
    InterfaceUploadError,
)


def delete_generated_interface(
    *,
    removed: dict[str, Any],
    kind: str,
    file_name: str,
    package_root: Path,
    regenerate_package: Callable[[Path], dict[str, Any]],
    remove_registry_entry: Callable[..., None],
    registry_path: Path,
    display_path: Callable[[Path], str],
) -> dict[str, Any]:
    """Generated 파일을 삭제하고 metadata와 정확한 Registry 항목을 갱신합니다."""
    package_name = str(
        removed.get('build', {}).get('interface_package')
        or str(removed.get('full_type', '')).split('/', 1)[0]
    )
    if package_name != 'uploaded_interfaces':
        raise InterfaceUploadError(
            '이 삭제 경로는 uploaded_interfaces 단일 파일만 지원합니다.',
        )

    target = package_root / kind / file_name
    deleted_file = target.is_file()
    if deleted_file:
        target.unlink()
    package_state = regenerate_package(package_root)
    remove_registry_entry(
        kind=kind,
        file_name=file_name,
        source=removed.get('source'),
        full_type=removed.get('full_type'),
        registry_path=registry_path,
    )
    return {
        'deleted_file': deleted_file,
        'file_deleted': deleted_file,
        'file_path': display_path(target),
        'full_type': removed.get('full_type'),
        'removed': removed,
        **package_state,
        'rebuild_required': True,
        'build_required': True,
        'message': 'interface 파일과 registry 항목을 삭제하고 package metadata를 재생성했습니다.',
    }

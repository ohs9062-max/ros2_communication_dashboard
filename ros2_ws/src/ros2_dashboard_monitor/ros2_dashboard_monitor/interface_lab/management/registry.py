"""Interface Lab의 registry 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.paths import ros_workspace_root
from ros2_dashboard_monitor.interface_lab.management.errors import InterfaceUploadError
from ros2_dashboard_monitor.interface_lab.management.interface_upload import (
    ALLOWED_KINDS,
    MAX_INTERFACE_FILE_SIZE,
    TYPE_NAME_PATTERN,
    prepare_interface_upload,
    safe_file_name as _safe_file_name,
)
from ros2_dashboard_monitor.interface_lab.management.interface_parser import (
    parse_interface,
)
from ros2_dashboard_monitor.interface_lab.management.import_checker import check_import as _check_import
from ros2_dashboard_monitor.interface_lab.management.interface_package_installer import (
    atomic_write as _atomic_write,
    dependency_candidates as _dependency_candidates,
    failed_build_info,
    install_interface,
)
from ros2_dashboard_monitor.interface_lab.management.registry_storage import (
    REGISTRY_LOCK as _REGISTRY_LOCK,
    load_registry as _load_registry,
    write_registry as _write_registry,
)
from ros2_dashboard_monitor.interface_lab.management.registry_apply_status import (
    apply_summary as build_registry_apply_summary,
    mark_build_applied,
    missing_registry_summary,
    refresh_import_status,
)
from ros2_dashboard_monitor.interface_lab.management.multipart_upload import extract_multipart_file
from ros2_dashboard_monitor.interface_lab.management.registry_paths import (
    default_interface_package,
    default_registry_path,
    display_path as _display_path,
)


KIND_COLLECTIONS = {
    'msg': 'messages',
    'srv': 'services',
    'action': 'actions',
}
def register_interface(
    file_name: str,
    content: bytes,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 interface 등록 정보를 저장하는 함수입니다."""
    entry = prepare_interface_upload(file_name, content)
    safe_name = entry['file_name']
    kind = entry['file_kind']
    type_name = entry['type_name']
    raw_text = entry['raw_text']

    path = registry_path or default_registry_path()
    with _REGISTRY_LOCK:
        registry = _load_registry(path)
        collection = registry['interface_registry'][KIND_COLLECTIONS[kind]]
        previous = next(
            (item for item in collection if item.get('file_name') == safe_name),
            None,
        )
        entry['status'] = 'updated' if previous else 'created'
        try:
            entry['build'] = _install_interface(safe_name, kind, type_name, raw_text)
        except InterfaceUploadError as exc:
            entry['build'] = _failed_build_info(raw_text, str(exc))
        package_name = str(entry['build'].get('interface_package') or '')
        entry['source'] = 'single_upload'
        entry['full_type'] = f'{package_name}/{kind}/{type_name}' if package_name else None
        collection[:] = [
            item for item in collection
            if item.get('file_name') != safe_name
        ]
        collection.append(entry)
        _write_registry(path, registry)
        if not path.is_file():
            raise InterfaceUploadError(f'타입 registry 파일이 생성되지 않았습니다: {path}')
        entry['registry_path'] = _display_path(path)
    return entry


def _install_interface(
    safe_name: str, kind: str, type_name: str, raw_text: str,
) -> dict[str, Any]:
    return install_interface(
        safe_name, kind, type_name, raw_text,
        package=default_interface_package(),
        check_import=_check_import,
        display_path=_display_path,
    )


def _failed_build_info(raw_text: str, error: str) -> dict[str, Any]:
    package_name, _ = default_interface_package()
    return failed_build_info(raw_text, error, package_name=package_name)


def registry_snapshot(registry_path: Path | None = None) -> dict[str, Any]:
    """Registry YAML을 읽어 화면에 사용할 Interface 목록을 반환합니다."""
    path = registry_path or default_registry_path()
    with _REGISTRY_LOCK:
        return _load_registry(path)


def delete_registry_entry(
    *,
    kind: str,
    file_name: str,
    source: str | None = None,
    full_type: str | None = None,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    if kind not in ALLOWED_KINDS:
        raise InterfaceUploadError('kind는 msg, srv, action 중 하나여야 합니다.')
    path = registry_path or default_registry_path()
    with _REGISTRY_LOCK:
        registry = _load_registry(path)
        collection = registry['interface_registry'][KIND_COLLECTIONS[kind]]
        removed = None
        kept = []
        for item in collection:
            matches = (
                item.get('file_name') == file_name
                and (source is None or item.get('source') == source)
                and (full_type is None or item.get('full_type') == full_type)
            )
            if removed is None and matches:
                removed = item
                continue
            kept.append(item)
        if removed is None:
            raise InterfaceUploadError('삭제할 registry 항목을 찾을 수 없습니다.')
        collection[:] = kept
        _write_registry(path, registry)
    return {
        'removed': removed,
        'registry_path': _display_path(path),
        'file_deleted': False,
        'message': 'registry 항목만 삭제했습니다. 생성된 interface 파일은 삭제하지 않았습니다.',
    }


def mark_registry_build_applied(
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """build가 끝난 Registry 항목의 build_required 표시를 해제합니다."""
    path = registry_path or default_registry_path()
    applied_at = datetime.now(timezone.utc)
    with _REGISTRY_LOCK:
        registry = _load_registry(path)
        mark_build_applied(registry, applied_at=applied_at)
        _write_registry(path, registry)
        return registry


def refresh_registry_imports(
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 생성된 interface 타입 import 가능 여부를 확인하는 함수입니다."""
    path = registry_path or default_registry_path()
    checked_at = datetime.now(timezone.utc)
    with _REGISTRY_LOCK:
        registry = _load_registry(path)
        refresh_import_status(
            registry,
            allowed_kinds=ALLOWED_KINDS,
            checked_at=checked_at,
            check_import=_check_import,
        )
        summary = _registry_apply_summary(
            registry,
            registry_path=path,
            require_import_available=True,
            update_registry=True,
        )
        _write_registry(path, registry)
        registry['apply_summary'] = summary
        return registry


def registry_apply_summary(
    registry_path: Path | None = None,
    *,
    require_import_available: bool = False,
) -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    path = registry_path or default_registry_path()
    with _REGISTRY_LOCK:
        if not path.is_file():
            return _missing_registry_summary(path)
        registry = _load_registry(path)
        summary = _registry_apply_summary(
            registry,
            registry_path=path,
            require_import_available=require_import_available,
            update_registry=True,
        )
        _write_registry(path, registry)
        return summary


def _registry_apply_summary(
    registry: dict[str, Any],
    *,
    registry_path: Path,
    require_import_available: bool,
    update_registry: bool,
) -> dict[str, Any]:
    return build_registry_apply_summary(
        registry,
        registry_path=registry_path,
        require_import_available=require_import_available,
        update_registry=update_registry,
        default_package=default_interface_package(),
        workspace_root=ros_workspace_root(),
        allowed_kinds=ALLOWED_KINDS,
        check_import=_check_import,
        display_path=_display_path,
    )


def _missing_registry_summary(path: Path) -> dict[str, Any]:
    return missing_registry_summary(
        path,
        default_package=default_interface_package(),
        display_path=_display_path,
    )

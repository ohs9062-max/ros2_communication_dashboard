"""Interface Lab의 packages 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import importlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.paths import persistent_monitor_config_dir, ros_workspace_root
from ros2_dashboard_monitor.interface_lab.management.registry import (
    _dependency_candidates,
    _display_path,
    parse_interface,
)
from ros2_dashboard_monitor.interface_lab.management.errors import InterfacePackageError
from ros2_dashboard_monitor.interface_lab.management.package_archive import (
    MAX_PACKAGE_FILES,
    MAX_PACKAGE_FILE_SIZE,
    MAX_PACKAGE_ZIP_SIZE,
    extract_multipart_package_files,
    find_package_root as _find_package_root,
    safe_extract_zip as _safe_extract_zip,
    safe_package_relative_path as _safe_package_relative_path,
    validate_folder_upload,
    validate_zip_upload,
)
from ros2_dashboard_monitor.interface_lab.management.package_registry_storage import (
    load_packages_registry as _load_packages_registry,
    write_packages_registry as _write_packages_registry,
)
from ros2_dashboard_monitor.interface_lab.management.package_apply_status import (
    apply_summary as build_package_apply_summary,
    iter_package_interface_lists as _iter_package_interface_lists,
    mark_build_applied,
    refresh_import_status,
)
from ros2_dashboard_monitor.interface_lab.management.package_inspector import (
    PACKAGE_NAME_PATTERN,
)
from ros2_dashboard_monitor.interface_lab.management.package_installer import (
    install_package_root,
)
from ros2_dashboard_monitor.interface_lab.management.package_interfaces import (
    registered_actions,
    registered_messages,
    registered_services,
)

def default_packages_registry_path() -> Path:
    """Interface package Registry YAML의 기본 경로를 반환합니다."""
    backend_root = ros_workspace_root()
    configured_value = os.getenv('INTERFACE_PACKAGES_REGISTRY_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_packages.yaml'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else backend_root / configured


def default_uploaded_packages_root() -> Path:
    """업로드한 ROS Interface package를 보관할 기본 폴더를 반환합니다."""
    backend_root = ros_workspace_root()
    configured = Path(
        os.getenv(
            'INTERFACE_UPLOADED_PACKAGES_PATH',
            'src/uploaded_interfaces/packages',
        ),
    )
    return configured if configured.is_absolute() else backend_root / configured


def upload_interface_package(
    file_name: str,
    content: bytes,
    *,
    replace: bool = False,
) -> dict[str, Any]:
    """zip package를 안전하게 풀고 구조를 검증해 package 저장소에 등록합니다."""
    safe_name = validate_zip_upload(file_name, content)

    uploaded_root = default_uploaded_packages_root()
    uploaded_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='interface_package_') as temp_name:
        temp_root = Path(temp_name)
        zip_path = temp_root / safe_name
        zip_path.write_bytes(content)
        extract_root = temp_root / 'extract'
        extract_root.mkdir()
        _safe_extract_zip(zip_path, extract_root)
        package_root = _find_package_root(extract_root)
        return _store_package_root(package_root, replace=replace)


def upload_interface_package_folder(
    files: list[tuple[str, bytes]],
    *,
    replace: bool = False,
) -> dict[str, Any]:
    """폴더로 받은 파일을 임시 package로 조립하고 검증해 등록합니다."""
    validate_folder_upload(files)

    with tempfile.TemporaryDirectory(prefix='interface_package_folder_') as temp_name:
        extract_root = Path(temp_name) / 'extract'
        extract_root.mkdir()
        for relative_path, content in files:
            relative = _safe_package_relative_path(relative_path, len(content))
            target = extract_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        package_root = _find_package_root(extract_root)
        return _store_package_root(package_root, replace=replace)


def _store_package_root(package_root: Path, *, replace: bool) -> dict[str, Any]:
    return install_package_root(
        package_root,
        uploaded_root=default_uploaded_packages_root(),
        replace=replace,
        parse_interface=parse_interface,
        dependency_candidates=_dependency_candidates,
        display_path=_display_path,
        upsert_entry=upsert_package_entry,
        registry_path=default_packages_registry_path(),
    )


def packages_snapshot() -> dict[str, Any]:
    """Package Registry를 읽어 등록된 package 목록을 반환합니다."""
    return _load_packages_registry(default_packages_registry_path())


def delete_interface_package(package_name: str) -> dict[str, Any]:
    """Interface Lab에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
        raise InterfacePackageError('The package name is invalid.')
    destination = default_uploaded_packages_root() / package_name
    if destination.exists():
        shutil.rmtree(destination)
    registry = _load_packages_registry(default_packages_registry_path())
    registry['packages'] = [
        item for item in registry['packages']
        if item.get('name') != package_name
    ]
    _write_packages_registry(default_packages_registry_path(), registry)
    return {
        'name': package_name,
        'deleted': True,
        'rebuild_required': True,
        'registry': registry,
    }


def upsert_package_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """같은 package 이름의 Registry 항목을 추가하거나 최신 값으로 교체합니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    registry['packages'] = [
        item for item in registry['packages']
        if item.get('name') != entry.get('name')
    ]
    registry['packages'].append(entry)
    registry['packages'].sort(key=lambda item: str(item.get('name') or ''))
    _write_packages_registry(path, registry)
    return registry


def mark_packages_build_applied() -> dict[str, Any]:
    """build가 끝난 package 항목의 build_required 표시를 해제합니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    mark_build_applied(registry, built_at=datetime.now(timezone.utc))
    _write_packages_registry(path, registry)
    return registry


def refresh_package_imports() -> dict[str, Any]:
    """Interface Lab에서 생성된 interface 타입 import 가능 여부를 확인하는 함수입니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    refresh_import_status(
        registry,
        checked_at=datetime.now(timezone.utc),
        check_import=_check_import,
    )
    summary = package_apply_summary(registry=registry, require_import_available=True)
    registry['apply_summary'] = summary
    _write_packages_registry(path, registry)
    return registry


def package_apply_summary(
    *,
    registry: dict[str, Any] | None = None,
    require_import_available: bool = False,
) -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    registry = registry or _load_packages_registry(default_packages_registry_path())
    return build_package_apply_summary(
        registry,
        require_import_available=require_import_available,
        registry_path=default_packages_registry_path(),
        uploaded_packages_path=default_uploaded_packages_root(),
        display_path=_display_path,
    )


def registered_package_services() -> list[dict[str, Any]]:
    """업로드 package에서 import 가능한 Service 타입만 반환합니다."""
    return registered_services(packages_snapshot())


def registered_package_messages() -> list[dict[str, Any]]:
    """Interface Lab에서 interface 등록 정보를 저장하는 함수입니다."""
    return registered_messages(packages_snapshot())


def registered_package_actions() -> list[dict[str, Any]]:
    """업로드 package에서 import 가능한 Action 타입만 반환합니다."""
    return registered_actions(packages_snapshot())


def _check_import(package_name: str, kind: str, type_name: str) -> tuple[bool, str | None]:
    try:
        importlib.invalidate_caches()
        module = importlib.import_module(f'{package_name}.{kind}')
        getattr(module, type_name)
        return True, None
    except (ImportError, AttributeError) as exc:
        return False, str(exc)

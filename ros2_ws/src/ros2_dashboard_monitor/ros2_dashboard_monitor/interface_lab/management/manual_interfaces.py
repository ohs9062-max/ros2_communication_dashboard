"""Interface Lab의 manual_interfaces 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.management.registry import (
    ALLOWED_KINDS,
    TYPE_NAME_PATTERN,
    InterfaceUploadError,
    _atomic_write,
    _check_import,
    _dependency_candidates,
    _display_path,
    default_registry_path,
)
from ros2_dashboard_monitor.interface_lab.paths import generated_interface_package_root
from ros2_dashboard_monitor.interface_lab.management.generated_package import (
    ensure_package_directories,
    regenerate_cmake,
    regenerate_package,
    regenerate_package_xml,
    scan_interface_files,
)
from ros2_dashboard_monitor.interface_lab.management.manual_registry import (
    find_entry,
    remove_exact_entry,
    upsert_entry,
)
from ros2_dashboard_monitor.interface_lab.management.manual_entries import (
    manual_definition_entry,
    manual_type_entry,
)
from ros2_dashboard_monitor.interface_lab.management.manual_delete import (
    delete_generated_interface,
)
from ros2_dashboard_monitor.interface_lab.management.manual_validation import (
    parse_full_type as _parse_full_type,
    validate_manual_definition,
)


def register_manual_type(
    *,
    full_type: str,
    allowlisted: bool = True,
    description: str = '',
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 interface 등록 정보를 저장하는 함수입니다."""
    package_name, kind, type_name = _parse_full_type(full_type)
    import_available, import_error = _check_import(package_name, kind, type_name)
    entry = manual_type_entry(
        full_type=full_type,
        package_name=package_name,
        kind=kind,
        type_name=type_name,
        allowlisted=allowlisted,
        description=description,
        import_available=import_available,
        import_error=import_error,
    )
    _upsert_registry_entry(entry, registry_path)
    return entry


def write_manual_definition(
    *,
    package: str,
    kind: str,
    type_name: str,
    definition: str,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """사용자가 입력한 msg·srv·action 정의를 파일과 Registry에 저장합니다."""
    validated = validate_manual_definition(
        package=package,
        kind=kind,
        type_name=type_name,
        definition=definition,
    )
    package_name = validated['package']
    kind = validated['kind']
    type_name = validated['type_name']
    raw_text = validated['raw_text']
    parsed = validated['parsed']

    package_root = generated_interface_package_root()
    _ensure_uploaded_interfaces_package(package_root, package_name)
    file_name = f'{type_name}.{kind}'
    destination = package_root / kind / file_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(destination, raw_text)
    package_state = regenerate_uploaded_interfaces_package(package_root)
    dependencies = package_state['dependencies']

    import_available, import_error = _check_import(package_name, kind, type_name)
    entry = manual_definition_entry(
        package_name=package_name,
        kind=kind,
        type_name=type_name,
        raw_text=raw_text,
        parsed=parsed,
        package_root=package_root,
        destination=destination,
        dependencies=dependencies,
        import_available=import_available,
        import_error=import_error,
        display_path=_display_path,
    )
    _upsert_registry_entry(entry, registry_path)
    return entry


def update_manual_definition(
    *,
    kind: str,
    type_name: str,
    definition: str,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 runtime 상태를 갱신하는 함수입니다."""
    return write_manual_definition(
        package='uploaded_interfaces',
        kind=kind,
        type_name=type_name,
        definition=definition,
        registry_path=registry_path,
    )


def delete_manual_definition(
    *,
    kind: str,
    type_name: str,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """Interface Lab에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    if kind not in ALLOWED_KINDS:
        raise InterfaceUploadError('kind는 msg, srv, action 중 하나여야 합니다.')
    if not TYPE_NAME_PATTERN.fullmatch(type_name):
        raise InterfaceUploadError('type_name은 대문자로 시작하는 PascalCase여야 합니다.')
    package_name = 'uploaded_interfaces'
    package_root = generated_interface_package_root()
    return delete_uploaded_interface(
        kind=kind,
        file_name=f'{type_name}.{kind}',
        full_type=f'{package_name}/{kind}/{type_name}',
        source='manual_definition',
        registry_path=registry_path,
    )


def rebuild_uploaded_interfaces_cmake() -> dict[str, Any]:
    """남아 있는 단일 Interface 파일 기준으로 package metadata를 재생성합니다."""
    package_name = 'uploaded_interfaces'
    package_root = generated_interface_package_root()
    package_state = regenerate_uploaded_interfaces_package(package_root)
    return {
        'package': package_name,
        'package_path': _display_path(package_root),
        **package_state,
        'rebuild_required': True,
    }


def delete_uploaded_interface(
    *,
    kind: str,
    file_name: str,
    source: str | None = None,
    full_type: str | None = None,
    registry_path: Path | None = None,
) -> dict[str, Any]:
    """업로드 Interface 파일과 정확히 일치하는 Registry 항목을 함께 삭제합니다."""
    if kind not in ALLOWED_KINDS:
        raise InterfaceUploadError('kind는 msg, srv, action 중 하나여야 합니다.')
    expected_suffix = f'.{kind}'
    if Path(file_name).name != file_name or not file_name.endswith(expected_suffix):
        raise InterfaceUploadError(f'file_name은 안전한 {expected_suffix} 파일명이어야 합니다.')

    path = registry_path or default_registry_path()
    removed = find_entry(
        path,
        kind=kind,
        file_name=file_name,
        source=source,
        full_type=full_type,
    )
    if removed is None:
        raise InterfaceUploadError('삭제할 registry 항목을 찾을 수 없습니다.')
    return delete_generated_interface(
        removed=removed,
        kind=kind,
        file_name=file_name,
        package_root=generated_interface_package_root(),
        regenerate_package=regenerate_uploaded_interfaces_package,
        remove_registry_entry=remove_uploaded_interface_registry_entry,
        registry_path=path,
        display_path=_display_path,
    )


def remove_uploaded_interface_registry_entry(
    *,
    kind: str,
    file_name: str,
    source: str | None,
    full_type: str | None,
    registry_path: Path | None = None,
) -> None:
    """종류·전체 타입·파일 이름이 일치하는 Registry 항목만 제거합니다."""
    path = registry_path or default_registry_path()
    remove_exact_entry(
        path,
        kind=kind,
        file_name=file_name,
        source=source,
        full_type=full_type,
    )


def _upsert_registry_entry(entry: dict[str, Any], registry_path: Path | None) -> None:
    path = registry_path or default_registry_path()
    upsert_entry(path, entry)


def _ensure_uploaded_interfaces_package(package_root: Path, package_name: str) -> None:
    ensure_package_directories(package_root)


def scan_uploaded_interface_files(package_root: Path | None = None) -> list[str]:
    """uploaded_interfaces 아래에 실제로 남아 있는 Interface 파일을 스캔합니다."""
    return scan_interface_files(package_root or generated_interface_package_root())


def regenerate_uploaded_interfaces_package(package_root: Path | None = None) -> dict[str, Any]:
    """현재 파일 목록으로 CMakeLists.txt와 package.xml을 함께 재생성합니다."""
    root = package_root or generated_interface_package_root()
    return regenerate_package(
        root,
        atomic_write=_atomic_write,
        dependency_candidates=_dependency_candidates,
    )


def regenerate_uploaded_interfaces_cmake(
    package_root: Path,
    interface_paths: list[str],
    dependencies: list[str],
) -> None:
    """현재 Interface 파일과 의존성으로 CMakeLists.txt 전체를 다시 씁니다."""
    regenerate_cmake(
        package_root,
        interface_paths,
        dependencies,
        atomic_write=_atomic_write,
    )


def regenerate_uploaded_interfaces_package_xml(
    package_root: Path,
    has_interfaces: bool,
    dependencies: list[str],
) -> None:
    """현재 Interface 유무와 의존성으로 package.xml 전체를 다시 씁니다."""
    regenerate_package_xml(
        package_root,
        has_interfaces,
        dependencies,
        atomic_write=_atomic_write,
    )


def _existing_interface_paths(package_root: Path) -> list[str]:
    return scan_uploaded_interface_files(package_root)


def _dependencies_from_existing_files(package_root: Path, package_name: str) -> list[str]:
    from ros2_dashboard_monitor.interface_lab.management.generated_package import (
        dependencies_from_files,
    )
    return dependencies_from_files(
        package_root,
        package_name,
        dependency_candidates=_dependency_candidates,
    )

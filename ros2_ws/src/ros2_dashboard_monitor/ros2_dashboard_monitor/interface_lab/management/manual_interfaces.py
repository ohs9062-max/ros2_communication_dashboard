"""Interface Lab의 manual_interfaces 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from datetime import datetime, timezone
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
    entry = {
        'file_name': f'{type_name}.{kind}',
        'file_kind': kind,
        'type_name': type_name,
        'full_type': full_type,
        'source': 'manual_type',
        'allowlisted': bool(allowlisted),
        'description': description,
        'uploaded_at': datetime.now(timezone.utc).isoformat(),
        'raw_text': '',
        'parsed': {},
        'build': {
            'interface_package': package_name,
            'file_saved': False,
            'cmake_registered': False,
            'package_xml_checked': False,
            'rebuild_required': False,
            'import_available': import_available,
            'import_error': import_error,
            'manual_registration': True,
            'error': None,
        },
    }
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
    entry = {
        'file_name': file_name,
        'file_kind': kind,
        'type_name': type_name,
        'full_type': f'{package_name}/{kind}/{type_name}',
        'source': 'manual_definition',
        'allowlisted': True,
        'uploaded_at': datetime.now(timezone.utc).isoformat(),
        'raw_text': raw_text,
        'parsed': parsed,
        'build': {
            'interface_package': package_name,
            'interface_package_path': _display_path(package_root),
            'absolute_interface_package_path': str(package_root),
            'saved_path': _display_path(destination),
            'absolute_saved_path': str(destination),
            'file_saved': True,
            'cmake_registered': True,
            'package_xml_checked': True,
            'dependency_candidates': dependencies,
            'rebuild_required': True,
            'import_available': import_available,
            'import_error': import_error,
            'error': None,
        },
    }
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
    package_name = str(
        removed.get('build', {}).get('interface_package')
        or str(removed.get('full_type', '')).split('/', 1)[0]
    )
    if package_name != 'uploaded_interfaces':
        raise InterfaceUploadError('이 삭제 경로는 uploaded_interfaces 단일 파일만 지원합니다.')

    package_root = generated_interface_package_root()
    target = package_root / kind / file_name
    deleted_file = target.is_file()
    if deleted_file:
        target.unlink()
    package_state = regenerate_uploaded_interfaces_package(package_root)
    remove_uploaded_interface_registry_entry(
        kind=kind,
        file_name=file_name,
        source=removed.get('source'),
        full_type=removed.get('full_type'),
        registry_path=path,
    )
    return {
        'deleted_file': deleted_file,
        'file_deleted': deleted_file,
        'file_path': _display_path(target),
        'full_type': removed.get('full_type'),
        'removed': removed,
        **package_state,
        'rebuild_required': True,
        'build_required': True,
        'message': 'interface 파일과 registry 항목을 삭제하고 package metadata를 재생성했습니다.',
    }


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

"""수동 Interface 등록용 Registry entry 모델을 생성합니다."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def manual_type_entry(
    *,
    full_type: str,
    package_name: str,
    kind: str,
    type_name: str,
    allowlisted: bool,
    description: str,
    import_available: bool,
    import_error: str | None,
) -> dict[str, Any]:
    """파일을 생성하지 않는 기존 ROS type 등록 entry를 반환합니다."""
    return {
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


def manual_definition_entry(
    *,
    package_name: str,
    kind: str,
    type_name: str,
    raw_text: str,
    parsed: Any,
    package_root: Path,
    destination: Path,
    dependencies: list[str],
    import_available: bool,
    import_error: str | None,
    display_path,
) -> dict[str, Any]:
    """생성 package에 저장한 수동 definition의 Registry entry를 반환합니다."""
    return {
        'file_name': f'{type_name}.{kind}',
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
            'interface_package_path': display_path(package_root),
            'absolute_interface_package_path': str(package_root),
            'saved_path': display_path(destination),
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

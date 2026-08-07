"""단일 Interface Registry와 업로드 package 적용 상태 병합."""

from __future__ import annotations

from typing import Any


def combine(
    single: dict[str, Any],
    packages: dict[str, Any],
    *,
    require_import_available: bool,
) -> dict[str, Any]:
    single_not_applied = list(single.get('not_applied', []))
    if single.get('total', 0) == 0 and packages.get('total', 0) > 0:
        single_not_applied = [
            item for item in single_not_applied
            if 'interface_registry.yaml 파일이 없습니다' not in str(item.get('reason', ''))
        ]
    not_applied = [*single_not_applied, *list(packages.get('not_applied', []))]
    total = int(single.get('total') or 0) + int(packages.get('total') or 0)
    import_pending = [
        *list(single.get('import_pending', [])),
        *list(packages.get('import_pending', [])),
    ]
    real_apply_success = total > 0 and not not_applied
    ready_for_build = total > 0 and not any(
        item for item in not_applied
        if 'import_available false' not in str(item.get('reason', ''))
    )
    return {
        'status': 'success' if real_apply_success else ('empty' if total == 0 else 'partial'),
        'real_apply_success': real_apply_success,
        'ready_for_build': ready_for_build,
        'registry_exists': bool(single.get('registry_exists') or packages.get('registry_exists')),
        'single_registry': single,
        'package_registry': packages,
        'total': total,
        'applied_count': total - len(not_applied),
        'not_applied': not_applied,
        'import_pending': import_pending,
        'requires_import_available': require_import_available,
    }

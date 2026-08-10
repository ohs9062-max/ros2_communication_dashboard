"""업로드 package Registry를 Interface Lab 실행 후보로 변환합니다."""

from __future__ import annotations

from typing import Any


def registered_services(registry: dict[str, Any]) -> list[dict[str, Any]]:
    """Registry의 Service 정의를 실행 후보 payload로 변환합니다."""
    return _registered_request_response_interfaces(
        registry,
        kind='srv',
        type_key='service_type',
        request_key='request',
        response_key='response',
    )


def registered_messages(registry: dict[str, Any]) -> list[dict[str, Any]]:
    """Registry의 Message 정의를 실행 후보 payload로 변환합니다."""
    entries = []
    for package in registry.get('packages', []):
        for item in package.get('interfaces', {}).get('msg', []):
            parsed = item.get('parsed')
            entries.append({
                **_common_entry(package, item),
                'message_type': item.get('type'),
                'message_schema': parsed if isinstance(parsed, list) else [],
            })
    return entries


def registered_actions(registry: dict[str, Any]) -> list[dict[str, Any]]:
    """Registry의 Action 정의를 실행 후보 payload로 변환합니다."""
    entries = []
    for package in registry.get('packages', []):
        for item in package.get('interfaces', {}).get('action', []):
            parsed = item.get('parsed') if isinstance(item.get('parsed'), dict) else {}
            entries.append({
                **_common_entry(package, item),
                'action_type': item.get('type'),
                'goal_schema': parsed.get('goal', []),
                'result_schema': parsed.get('result', []),
                'feedback_schema': parsed.get('feedback', []),
            })
    return entries


def _registered_request_response_interfaces(
    registry: dict[str, Any],
    *,
    kind: str,
    type_key: str,
    request_key: str,
    response_key: str,
) -> list[dict[str, Any]]:
    entries = []
    for package in registry.get('packages', []):
        for item in package.get('interfaces', {}).get(kind, []):
            parsed = item.get('parsed') if isinstance(item.get('parsed'), dict) else {}
            entries.append({
                **_common_entry(package, item),
                type_key: item.get('type'),
                'request_schema': parsed.get(request_key, []),
                'response_schema': parsed.get(response_key, []),
            })
    return entries


def _common_entry(
    package: dict[str, Any],
    item: dict[str, Any],
) -> dict[str, Any]:
    return {
        'source': 'uploaded_package',
        'package_name': package.get('name'),
        'file_name': item.get('file_name'),
        'type_name': item.get('type_name'),
        'saved_path': item.get('saved_path'),
        'import_available': item.get('import_available') is True,
        'import_error': item.get('import_error') or package.get('import_error'),
    }

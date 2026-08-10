"""Service active check의 generated request/response 변환을 담당합니다."""

from __future__ import annotations

from typing import Any

from rosidl_runtime_py.utilities import get_service

from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    build_ros_message,
    ros_message_to_json,
)


def load_service_class(service_type: str) -> type:
    return get_service(service_type)


def build_request(service_class: type, request_data: dict[str, Any]) -> Any:
    return build_ros_message(service_class.Request, request_data, label='request')


def response_to_preview(response: Any) -> dict[str, Any]:
    return ros_message_to_json(response)


def response_success(response_preview: dict[str, Any], success_field: str | None) -> bool:
    if success_field is None:
        return True
    value = _lookup_field(response_preview, success_field)
    return value if isinstance(value, bool) else bool(value)


def _lookup_field(data: dict[str, Any], field_path: str) -> Any:
    current: Any = data
    for part in field_path.split('.'):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(f'success_field not found: {field_path}')
        current = current[part]
    return current

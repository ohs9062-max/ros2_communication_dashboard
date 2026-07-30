"""Service 모니터링의 filters 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from ros2_dashboard_backend.service.models import (
    SERVICE_CATEGORY_ACTION_INTERNAL,
    SERVICE_CATEGORY_PARAMETER,
    SERVICE_CATEGORY_ROS_INTERNAL,
    SERVICE_CATEGORY_UNKNOWN,
    SERVICE_CATEGORY_USER,
    is_valid_service_type,
    service_hidden_by_default,
)


PARAMETER_SERVICE_SUFFIXES = (
    '/describe_parameters',
    '/get_parameter_types',
    '/get_parameters',
    '/list_parameters',
    '/set_parameters',
    '/set_parameters_atomically',
)

INTERNAL_SERVICE_SUFFIXES = (
    '/get_type_description',
)


def is_parameter_service(name: str) -> bool:
    """ROS2 Parameter 기본 Service 이름인지 확인합니다."""
    return any(name.endswith(suffix) for suffix in PARAMETER_SERVICE_SUFFIXES)


def is_internal_service(name: str) -> bool:
    """Dashboard 기본 목록에서 숨길 ROS 내부 Service 이름인지 확인합니다."""
    return any(name.endswith(suffix) for suffix in INTERNAL_SERVICE_SUFFIXES)


def is_action_internal_service(name: str) -> bool:
    """Action 구현에 자동 생성되는 goal·result·cancel Service인지 확인합니다."""
    return '/_action/' in name


def service_category(name: str, service_type: str | None) -> str:
    """Service 이름과 타입으로 user·parameter·action_internal 분류를 정합니다."""
    if is_parameter_service(name):
        return SERVICE_CATEGORY_PARAMETER

    if is_action_internal_service(name):
        return SERVICE_CATEGORY_ACTION_INTERNAL

    if is_internal_service(name):
        return SERVICE_CATEGORY_ROS_INTERNAL

    if not is_valid_service_type(service_type):
        return SERVICE_CATEGORY_UNKNOWN

    return SERVICE_CATEGORY_USER


def is_hidden_by_default(category: str) -> bool:
    """Service 모니터링에서 조건 만족 여부를 판단하는 함수입니다."""
    return service_hidden_by_default(category)


def is_service_included(
    name: str,
    *,
    include_names: tuple[str, ...] = (),
    exclude_names: tuple[str, ...] = (),
    exclude_prefixes: tuple[str, ...] = (),
) -> bool:
    """Service 이름에 include·exclude·prefix 설정을 적용합니다."""
    if name in exclude_names:
        return False

    if any(name.startswith(prefix) for prefix in exclude_prefixes if prefix):
        return False

    return not include_names or name in include_names


def is_supported_type(service_type: str | None) -> bool:
    """Service 모니터링에서 조건 만족 여부를 판단하는 함수입니다."""
    if service_type is None:
        return False

    return False

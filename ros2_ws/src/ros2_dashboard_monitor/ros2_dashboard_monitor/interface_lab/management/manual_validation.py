"""사용자 직접 등록 ROS Interface type과 definition 검증."""

from __future__ import annotations

import re
from typing import Any

from ros2_dashboard_monitor.interface_lab.management.errors import InterfaceUploadError
from ros2_dashboard_monitor.interface_lab.management.interface_parser import parse_interface


ALLOWED_KINDS = {'msg', 'srv', 'action'}
TYPE_NAME_PATTERN = re.compile(r'^[A-Z][A-Za-z0-9]*$')
PACKAGE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]*$')
FULL_TYPE_PATTERN = re.compile(
    r'^([A-Za-z][A-Za-z0-9_]*)/(msg|srv|action)/([A-Z][A-Za-z0-9]*)$',
)
FIELD_NAME_PATTERN = re.compile(r'^[a-z][A-Za-z0-9_]*$')
CONSTANT_NAME_PATTERN = re.compile(r'^[A-Za-z][A-Za-z0-9_]*$')
CUSTOM_TYPE_PATTERN = re.compile(
    r'^[A-Za-z][A-Za-z0-9_]*/(?:(?:msg|srv|action)/)?[A-Z][A-Za-z0-9_]*$',
)
PRIMITIVE_TYPES = {
    'bool', 'byte', 'char', 'float32', 'float64', 'int8', 'uint8', 'int16',
    'uint16', 'int32', 'uint32', 'int64', 'uint64', 'string', 'wstring',
}


def validate_manual_definition(
    *,
    package: str,
    kind: str,
    type_name: str,
    definition: str,
) -> dict[str, Any]:
    package_name = package.strip() or 'uploaded_interfaces'
    if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
        raise InterfaceUploadError(
            'validation_error: package must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.',
        )
    if package_name != 'uploaded_interfaces':
        raise InterfaceUploadError('validation_error: manual definitions are supported only in the uploaded_interfaces package.')
    if kind not in ALLOWED_KINDS:
        raise InterfaceUploadError('validation_error: kind must be one of: msg, srv, action.')
    if not TYPE_NAME_PATTERN.fullmatch(type_name):
        raise InterfaceUploadError('validation_error: type_name must be PascalCase and start with an uppercase letter.')
    raw_text = definition.strip() + '\n'
    if not raw_text.strip():
        raise InterfaceUploadError('validation_error: definition is required.')
    separator_count = sum(
        1 for line in raw_text.splitlines()
        if line.split('#', 1)[0].strip() == '---'
    )
    expected_separators = {'msg': 0, 'srv': 1, 'action': 2}[kind]
    if separator_count != expected_separators:
        raise InterfaceUploadError(
            f'validation_error: {kind} requires exactly {expected_separators} --- separator(s).',
        )
    parsed = parse_interface(raw_text, kind)
    validate_parsed_fields(parsed, kind)
    return {
        'valid': True,
        'package': package_name,
        'kind': kind,
        'type_name': type_name,
        'raw_text': raw_text,
        'parsed': parsed,
    }


def parse_full_type(full_type: str) -> tuple[str, str, str]:
    match = FULL_TYPE_PATTERN.fullmatch(full_type.strip())
    if not match:
        raise InterfaceUploadError('full_type must use the format <package>/<msg|srv|action>/<TypeName>.')
    return match.group(1), match.group(2), match.group(3)


def validate_parsed_fields(parsed: dict[str, Any], kind: str) -> None:
    sections = (
        ['fields'] if kind == 'msg'
        else ['request', 'response'] if kind == 'srv'
        else ['goal', 'result', 'feedback']
    )
    for section in sections:
        names: set[str] = set()
        for field in parsed.get(section, []):
            raw_line = field.get('raw_line', '')
            name = field.get('name')
            field_type = field.get('type')
            if not name or not field_type:
                raise InterfaceUploadError(
                    f'validation_error: "{raw_line}" must use the "type name" format.',
                )
            if not valid_interface_type(str(field_type)):
                raise InterfaceUploadError(f'validation_error: unknown type "{field_type}"')
            name_pattern = CONSTANT_NAME_PATTERN if field.get('is_constant') else FIELD_NAME_PATTERN
            if not name_pattern.fullmatch(str(name)):
                raise InterfaceUploadError(f'validation_error: field name "{name}" is invalid.')
            if name in names:
                raise InterfaceUploadError(f'validation_error: duplicate field name "{name}"')
            names.add(str(name))


def valid_interface_type(field_type: str) -> bool:
    base = strip_array_suffix(field_type)
    if '<=' in base:
        base = base.split('<=', 1)[0]
    return base in PRIMITIVE_TYPES or CUSTOM_TYPE_PATTERN.fullmatch(base) is not None


def strip_array_suffix(field_type: str) -> str:
    value = field_type.strip()
    while value.endswith(']') and '[' in value:
        value = value[:value.rfind('[')]
    return value

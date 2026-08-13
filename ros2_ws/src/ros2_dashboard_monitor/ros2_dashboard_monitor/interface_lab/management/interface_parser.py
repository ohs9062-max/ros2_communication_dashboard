"""ROS msg, srv, action 정의를 파일 저장과 무관하게 파싱합니다."""

from __future__ import annotations

from typing import Any

from .errors import InterfaceUploadError


def parse_interface(raw_text: str, kind: str) -> dict[str, Any]:
    """msg·srv·action 원문을 section과 필드 schema로 해석합니다."""
    sections = _split_sections(raw_text)
    expected = {'msg': 1, 'srv': 2, 'action': 3}[kind]
    if len(sections) != expected:
        labels = {'msg': 'fields', 'srv': 'request/response', 'action': 'goal/result/feedback'}
        raise InterfaceUploadError(f'The {labels[kind]} section format for {kind} is invalid.')
    parsed_sections = [_parse_fields(lines) for lines in sections]
    if kind == 'msg':
        return {'fields': parsed_sections[0]}
    if kind == 'srv':
        return {'request': parsed_sections[0], 'response': parsed_sections[1]}
    return {'goal': parsed_sections[0], 'result': parsed_sections[1], 'feedback': parsed_sections[2]}


def _split_sections(raw_text: str) -> list[list[str]]:
    sections: list[list[str]] = [[]]
    for source_line in raw_text.splitlines():
        line = source_line.split('#', 1)[0].strip()
        if not line:
            continue
        if line == '---':
            sections.append([])
        else:
            sections[-1].append(line)
    return sections


def _parse_fields(lines: list[str]) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = []
    for line in lines:
        parts = line.split(None, 1)
        if len(parts) != 2:
            fields.append({'raw_line': line})
            continue
        field_type, declaration = parts
        item: dict[str, Any] = {'type': field_type, 'raw_line': line}
        if '=' in declaration:
            name, value = declaration.split('=', 1)
            item.update(name=name.strip(), value=value.strip(), is_constant=True)
        else:
            declaration_parts = declaration.split(None, 1)
            item['name'] = declaration_parts[0]
            if len(declaration_parts) > 1:
                item['default'] = declaration_parts[1]
        fields.append(item)
    return fields

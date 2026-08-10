"""단일 ROS Interface 업로드 입력을 검증하고 Registry entry로 준비합니다."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path, PurePath
from typing import Any

from ros2_dashboard_monitor.interface_lab.management.errors import (
    InterfaceUploadError,
)
from ros2_dashboard_monitor.interface_lab.management.interface_parser import (
    parse_interface,
)


ALLOWED_KINDS = {'msg', 'srv', 'action'}
MAX_INTERFACE_FILE_SIZE = 256 * 1024
TYPE_NAME_PATTERN = re.compile(r'^[A-Z][A-Za-z0-9]*$')


def prepare_interface_upload(file_name: str, content: bytes) -> dict[str, Any]:
    """파일 입력을 검증하고 parsing 결과를 포함한 기본 Registry entry를 반환합니다."""
    safe_name = safe_file_name(file_name)
    kind = Path(safe_name).suffix.lower().removeprefix('.')
    if kind not in ALLOWED_KINDS:
        raise InterfaceUploadError('.msg, .srv, .action 파일만 업로드할 수 있습니다.')
    if not content:
        raise InterfaceUploadError('빈 파일은 업로드할 수 없습니다.')
    if len(content) > MAX_INTERFACE_FILE_SIZE:
        raise InterfaceUploadError(
            f'파일 크기는 {MAX_INTERFACE_FILE_SIZE // 1024}KB 이하여야 합니다.',
        )
    try:
        raw_text = content.decode('utf-8')
    except UnicodeDecodeError as exc:
        raise InterfaceUploadError('파일은 UTF-8 텍스트여야 합니다.') from exc

    type_name = Path(safe_name).stem
    if not TYPE_NAME_PATTERN.fullmatch(type_name):
        raise InterfaceUploadError(
            '타입 이름은 대문자로 시작하고 영문자와 숫자만 포함해야 합니다.',
        )

    entry: dict[str, Any] = {
        'file_name': safe_name,
        'file_kind': kind,
        'type_name': type_name,
        'uploaded_at': datetime.now(timezone.utc).isoformat(),
        'raw_text': raw_text,
    }
    try:
        entry['parsed'] = parse_interface(raw_text, kind)
    except InterfaceUploadError as exc:
        entry['parsed'] = {}
        entry['parsed_error'] = str(exc)
    return entry


def safe_file_name(file_name: str) -> str:
    """경로 요소와 NUL을 제거한 안전한 단일 파일명을 반환합니다."""
    normalized = file_name.replace('\\', '/')
    safe_name = PurePath(normalized).name.strip()
    if not safe_name or safe_name in {'.', '..'} or '\x00' in safe_name:
        raise InterfaceUploadError('파일명이 올바르지 않습니다.')
    return safe_name

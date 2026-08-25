"""사용자가 지정한 주요 리소스를 별도 YAML 파일에 영구 저장합니다."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any

import yaml


PRIORITY_KINDS = ('topics', 'services', 'actions', 'nodes')
DOMAIN_ID_MIN = 0
DOMAIN_ID_MAX = 232


class UserPreferencesError(ValueError):
    """사용자 설정 읽기·쓰기 오류입니다."""


class UserPreferencesStore:
    """사용자 주요 리소스 목록을 thread-safe하게 관리합니다."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = Lock()
        self._priority, self._domain_ids = self._load_or_create()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                'priority': {
                    kind: list(self._priority[kind])
                    for kind in PRIORITY_KINDS
                },
                'domain_ids': list(self._domain_ids),
            }

    def contains(self, kind: str, name: str) -> bool:
        normalized_kind = _priority_kind(kind)
        with self._lock:
            return name in self._priority[normalized_kind]

    def domain_ids(self) -> list[int]:
        with self._lock:
            return list(self._domain_ids)

    def set_domain_ids(self, values: list[int]) -> dict[str, Any]:
        domain_ids = _domain_ids(values)
        with self._lock:
            changed = domain_ids != self._domain_ids
            if changed:
                self._domain_ids = domain_ids
                self._write_locked()
            return {'domain_ids': list(self._domain_ids), 'changed': changed}

    def set_priority(self, kind: str, name: str, enabled: bool) -> dict[str, Any]:
        normalized_kind = _priority_kind(kind)
        normalized_name = _resource_name(name)
        with self._lock:
            values = self._priority[normalized_kind]
            changed = False
            if enabled and normalized_name not in values:
                values.append(normalized_name)
                values.sort()
                changed = True
            elif not enabled and normalized_name in values:
                values.remove(normalized_name)
                changed = True
            if changed:
                self._write_locked()
            return {
                'kind': normalized_kind,
                'name': normalized_name,
                'user_primary': enabled,
                'changed': changed,
            }

    def _load_or_create(self) -> tuple[dict[str, list[str]], list[int]]:
        if not self._path.is_file():
            priority = _empty_priority()
            domain_ids: list[int] = []
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._write(priority, domain_ids)
            return priority, domain_ids
        try:
            data = yaml.safe_load(self._path.read_text(encoding='utf-8')) or {}
        except (OSError, UnicodeError, yaml.YAMLError) as exc:
            raise UserPreferencesError(
                f'User priority settings could not be read: {exc}',
            ) from exc
        root = data.get('priority') if isinstance(data, dict) else None
        root = root if isinstance(root, dict) else {}
        priority = {
            kind: sorted(set(
                value for value in root.get(kind, [])
                if isinstance(value, str) and value.strip()
            ))
            for kind in PRIORITY_KINDS
        }
        domains = data.get('domains') if isinstance(data, dict) else None
        domain_values = domains.get('ids') if isinstance(domains, dict) else []
        return priority, _domain_ids(domain_values, ignore_invalid=True)

    def _write_locked(self) -> None:
        self._write(self._priority, self._domain_ids)

    def _write(self, priority: dict[str, list[str]], domain_ids: list[int]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporary_name: str | None = None
        try:
            with tempfile.NamedTemporaryFile(
                'w',
                dir=self._path.parent,
                delete=False,
                encoding='utf-8',
            ) as temporary:
                temporary_name = temporary.name
                yaml.safe_dump(
                    {'priority': priority, 'domains': {'ids': domain_ids}},
                    temporary,
                    allow_unicode=True,
                    sort_keys=False,
                )
            os.replace(temporary_name, self._path)
        except OSError as exc:
            if temporary_name:
                Path(temporary_name).unlink(missing_ok=True)
            raise UserPreferencesError(
                f'User priority settings could not be saved: {exc}',
            ) from exc


def _empty_priority() -> dict[str, list[str]]:
    return {kind: [] for kind in PRIORITY_KINDS}


def _priority_kind(kind: str) -> str:
    if kind not in PRIORITY_KINDS:
        raise UserPreferencesError(f'Unsupported resource kind: {kind}')
    return kind


def _resource_name(name: str) -> str:
    value = str(name or '').strip()
    if not value or '\x00' in value:
        raise UserPreferencesError('The resource name is invalid.')
    return value


def _domain_ids(values: Any, *, ignore_invalid: bool = False) -> list[int]:
    if not isinstance(values, list):
        if ignore_invalid:
            return []
        raise UserPreferencesError('Domain IDs must be a list.')
    valid: list[int] = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, int):
            if ignore_invalid:
                continue
            raise UserPreferencesError('ROS Domain ID must be an integer from 0 to 232.')
        if not DOMAIN_ID_MIN <= value <= DOMAIN_ID_MAX:
            if ignore_invalid:
                continue
            raise UserPreferencesError('ROS Domain ID must be an integer from 0 to 232.')
        valid.append(value)
    return sorted(set(valid))

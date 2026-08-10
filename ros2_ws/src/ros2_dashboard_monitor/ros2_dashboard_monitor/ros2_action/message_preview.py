"""ROS Action feedback/result Message를 깊이 제한 JSON-safe preview로 변환합니다."""

from __future__ import annotations

from typing import Any


def message_to_preview(message: Any, *, max_depth: int = 3) -> Any:
    return _to_json_safe(message, depth=0, max_depth=max_depth)


def _to_json_safe(value: Any, *, depth: int, max_depth: int) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if depth >= max_depth:
        return str(value)
    if isinstance(value, (list, tuple)):
        return [
            _to_json_safe(item, depth=depth + 1, max_depth=max_depth)
            for item in value[:10]
        ]
    slots = getattr(value, '__slots__', None)
    if slots:
        return {
            _public_slot_name(slot): _to_json_safe(
                getattr(value, slot),
                depth=depth + 1,
                max_depth=max_depth,
            )
            for slot in slots
            if hasattr(value, slot)
        }
    return str(value)


def _public_slot_name(slot: str) -> str:
    return slot[1:] if slot.startswith('_') else slot

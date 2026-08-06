"""Stable JSON envelope definitions shared by the monitor transport."""

from __future__ import annotations

from typing import Any, TypedDict


class TransportEnvelope(TypedDict, total=False):
    success: bool
    data: Any
    message: str
    error: str

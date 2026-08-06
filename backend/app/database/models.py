"""Persistence-neutral records used by future database repositories."""

from dataclasses import dataclass
from typing import Any


@dataclass
class StoredAlert:
    alert_id: str
    payload: dict[str, Any]
    acknowledged: bool = False

"""Backend alert persistence models."""

from dataclasses import dataclass
from typing import Any


@dataclass
class AlertRecord:
    alert_id: str
    payload: dict[str, Any]

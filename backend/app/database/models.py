"""Records returned by Alert persistence repositories."""

from dataclasses import dataclass
from typing import Any


@dataclass
class StoredAlert:
    alert_key: str
    source: str
    name: str
    code: str
    level: str
    message: str
    detected_at: float
    resolved_at: float | None

    def as_api_dict(self) -> dict[str, Any]:
        resolved = self.resolved_at is not None
        payload = {
            'id': self.alert_key,
            'alert_key': self.alert_key,
            'source': self.source,
            'name': self.name,
            'code': self.code,
            'level': self.level,
            'message': self.message,
            'detected_at': self.detected_at,
            'first_detected_at': self.detected_at,
            'resolved_at': self.resolved_at,
            'active': not resolved,
            'alert_state': 'resolved' if resolved else 'active',
        }
        prefix, separator, remainder = self.alert_key.partition(':')
        domain_text, domain_separator, _ = remainder.partition(':')
        if prefix == 'domain' and separator and domain_separator and domain_text.isdigit():
            domain_id = int(domain_text)
            payload['domain_id'] = domain_id
            payload['resource_key'] = f'{domain_id}:{self.name}'
        return payload


@dataclass(frozen=True)
class AlertPage:
    items: list[StoredAlert]
    page: int
    page_size: int
    total: int

    @property
    def total_pages(self) -> int:
        return max(1, (self.total + self.page_size - 1) // self.page_size)

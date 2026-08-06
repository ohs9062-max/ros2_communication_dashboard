"""Database boundary reserved for MariaDB-backed repositories."""

from __future__ import annotations

from typing import Protocol


class ConnectionFactory(Protocol):
    def connect(self): ...

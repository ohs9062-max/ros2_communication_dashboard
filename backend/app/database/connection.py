"""MariaDB connection boundary for Backend-owned persistence."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import pymysql


class ConnectionFactory(Protocol):
    def connect(self) -> Any: ...


@dataclass(frozen=True)
class MariaDbConnectionFactory:
    host: str
    port: int
    database: str
    user: str
    password: str = field(repr=False)
    connect_timeout_sec: float = 2.0
    unix_socket: str | None = None

    def connect(self) -> pymysql.Connection:
        options: dict[str, Any] = {}
        if self.unix_socket:
            options['unix_socket'] = self.unix_socket
        else:
            options['host'] = self.host
            options['port'] = self.port
        return pymysql.connect(
            user=self.user,
            password=self.password,
            database=self.database,
            charset='utf8mb4',
            autocommit=False,
            connect_timeout=max(1, int(self.connect_timeout_sec)),
            cursorclass=pymysql.cursors.DictCursor,
            **options,
        )

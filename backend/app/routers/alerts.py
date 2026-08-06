"""Alert routes are implemented in monitoring.py to preserve route ordering."""

from app.alerts.service import AlertHistoryService

__all__ = ['AlertHistoryService']

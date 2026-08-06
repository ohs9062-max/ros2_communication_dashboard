"""사용자 주요 리소스 설정 API입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.app_state import sync_user_preferences, user_preferences
from app.monitor_client.client import MonitorUnavailable
from app.user_preferences.repository import UserPreferencesError


router = APIRouter(prefix='/ros/preferences/priority')


class PriorityRequest(BaseModel):
    name: str


@router.get('')
def get_priority_preferences() -> dict[str, Any]:
    return {
        'success': True,
        'data': user_preferences.snapshot(),
    }


@router.put('/{kind}')
def add_priority(kind: str, body: PriorityRequest) -> dict[str, Any]:
    return _set_priority(kind, body.name, True)


@router.delete('/{kind}')
def remove_priority(kind: str, body: PriorityRequest) -> dict[str, Any]:
    return _set_priority(kind, body.name, False)


def _set_priority(kind: str, name: str, enabled: bool) -> dict[str, Any]:
    try:
        result = user_preferences.set_priority(kind, name, enabled)
    except UserPreferencesError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        sync_user_preferences()
    except MonitorUnavailable:
        # Preference persistence succeeded; polling startup will resync later.
        pass
    return {
        'success': True,
        'data': result,
        'preferences': user_preferences.snapshot(),
    }

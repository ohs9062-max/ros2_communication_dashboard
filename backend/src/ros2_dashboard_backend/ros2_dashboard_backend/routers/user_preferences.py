"""사용자 주요 리소스 설정 API입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ros2_dashboard_backend.app_state import user_preferences
from ros2_dashboard_backend.user_preferences import UserPreferencesError


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
    return {
        'success': True,
        'data': result,
        'preferences': user_preferences.snapshot(),
    }

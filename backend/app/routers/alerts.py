"""Backend-owned Alert history and acknowledgement routes."""

from typing import Any

from fastapi import APIRouter, Query

from app.app_state import alert_history


router = APIRouter()


@router.get('/ros/alerts')
def alerts(
    history_name: str = Query(default='', max_length=512),
    history_page: int = Query(default=1, ge=1),
) -> dict[str, Any]:
    return alert_history.snapshot(
        history_name=history_name.strip(),
        history_page=history_page,
    )


@router.get('/ros/alerts/history')
def alert_history_page(
    name: str = Query(default='', max_length=512),
    page: int = Query(default=1, ge=1),
) -> dict[str, Any]:
    return alert_history.resolved_snapshot(name=name.strip(), page=page)


@router.post('/ros/alerts/history/reset')
def reset_alert_history() -> dict[str, Any]:
    return {
        'success': True,
        'data': alert_history.reset_history(),
        'message': '이전 Alert 이력을 삭제했습니다.',
    }


@router.post('/ros/alerts/current/reset')
def dismiss_current_alerts() -> dict[str, Any]:
    return {
        'success': True,
        'data': alert_history.dismiss_current(),
        'message': '현재 Alert를 확인 처리했습니다.',
    }

"""Backend-owned Alert history and acknowledgement routes."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.alerts.ai_diagnosis import (
    AlertDiagnosisInputError,
    GeminiConfigurationError,
    GeminiRequestError,
)
from app.app_state import alert_ai_diagnosis, alert_history


router = APIRouter()


class AlertDiagnosisRequest(BaseModel):
    alert: dict[str, Any]


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


@router.post('/ros/alerts/ai-diagnosis')
async def diagnose_alert(request: AlertDiagnosisRequest) -> dict[str, Any]:
    try:
        diagnosis = await alert_ai_diagnosis.diagnose(request.alert)
    except AlertDiagnosisInputError as exc:
        raise HTTPException(status_code=422, detail='선택한 Alert 정보가 올바르지 않습니다.') from exc
    except GeminiConfigurationError as exc:
        raise HTTPException(status_code=503, detail='AI 분석 설정을 확인해주세요.') from exc
    except GeminiRequestError as exc:
        detail = (
            'AI 분석 인증 또는 권한 설정을 확인해주세요.'
            if exc.authentication
            else 'AI 분석 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'
        )
        raise HTTPException(status_code=502, detail=detail) from exc
    return {
        'success': True,
        'data': diagnosis,
        'message': 'Alert AI 분석이 완료되었습니다.',
    }

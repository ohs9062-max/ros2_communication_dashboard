"""Interface Lab Topic Receive HTTP endpoint를 제공합니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ros2_dashboard_monitor.interface_lab.execution.topic_runtime import (
    InterfaceReceiveError,
)
from ros2_dashboard_monitor.transport.state import ros_monitor


router = APIRouter()


@router.post('/ros/interfaces/receive/topics/start')
async def start_receive_topic(request: Request) -> dict[str, Any]:
    """사용자가 선택한 Topic의 수신 subscription을 시작합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='JSON 요청 본문이 필요합니다.') from exc
    try:
        state = ros_monitor.start_receive_topic(
            topic_name=str(payload.get('topic_name') or ''),
            topic_type=str(payload.get('topic_type') or payload.get('full_type') or ''),
            history_limit=int(payload.get('history_limit') or 100),
        )
    except (InterfaceReceiveError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {'success': True, 'data': state, 'message': 'Topic 수신을 시작했습니다.'}


@router.post('/ros/interfaces/receive/topics/stop')
async def stop_receive_topic(request: Request) -> dict[str, Any]:
    """사용자가 시작한 Topic 수신 subscription을 중지합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='JSON 요청 본문이 필요합니다.') from exc
    state = ros_monitor.stop_receive_topic(
        topic_name=str(payload.get('topic_name') or ''),
        topic_type=payload.get('topic_type') or payload.get('full_type'),
    )
    return {'success': True, 'data': state, 'message': 'Topic 수신을 중지했습니다.'}


@router.get('/ros/interfaces/receive/topics')
def get_receive_topics() -> dict[str, Any]:
    """현재 Interface Lab에서 수신 중인 Topic 목록을 반환합니다."""
    snapshot = ros_monitor.receive_topics()
    return {'success': True, 'data': snapshot['topics'], 'meta': snapshot['meta']}


@router.get('/ros/interfaces/receive/topics/history')
def get_receive_topic_history(
    topic_name: str | None = Query(default=None),
    topic_type: str | None = Query(default=None),
    full_type: str | None = Query(default=None),
    limit: int | None = Query(default=500),
) -> dict[str, Any]:
    """조건에 맞는 Topic 수신 메시지 이력을 반환합니다."""
    snapshot = ros_monitor.receive_topic_history(
        topic_name=topic_name,
        topic_type=topic_type or full_type,
        limit=limit,
    )
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/receive/topics/history/reset')
async def reset_receive_topic_history(request: Request) -> dict[str, Any]:
    """선택한 Topic의 수신 메시지 이력을 초기화합니다."""
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    topic_name = payload.get('topic_name')
    topic_type = payload.get('topic_type') or payload.get('full_type')
    snapshot = ros_monitor.reset_receive_topic_history(
        topic_name=str(topic_name) if topic_name else None,
        topic_type=str(topic_type) if topic_type else None,
    )
    snapshot['topics'] = ros_monitor.receive_topics()['topics']
    return {
        'success': True,
        'data': snapshot,
        'message': 'Topic 수신 이력을 초기화했습니다.',
    }

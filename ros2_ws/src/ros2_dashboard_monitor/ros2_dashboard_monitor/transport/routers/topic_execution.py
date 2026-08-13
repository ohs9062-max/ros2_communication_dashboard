"""FastAPI Router의 topic_execution 관련 기능을 담당하는 모듈입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ros2_dashboard_monitor.transport.state import ros_monitor
from ros2_dashboard_monitor.interface_lab.execution.topic_runtime import InterfaceReceiveError
from ros2_dashboard_monitor.transport.routers.topic_receive import (
    router as topic_receive_router,
)


router = APIRouter()
router.include_router(topic_receive_router)


@router.get('/ros/interfaces/callable-messages')
def get_callable_messages() -> dict[str, Any]:
    """Interface Lab에서 사용할 수 있는 Message 타입을 반환합니다."""
    snapshot = ros_monitor.callable_messages()
    return {
        'success': True,
        'data': snapshot['messages'],
        'meta': snapshot['meta'],
        'message': 'Topic 작업에 사용할 수 있는 등록 Message 목록을 조회했습니다.',
    }


@router.get('/ros/interfaces/message-schema')
def get_message_schema(full_type: str = Query(...)) -> dict[str, Any]:
    """FastAPI Router에서 interface schema를 반환하는 함수입니다."""
    try:
        snapshot = ros_monitor.message_schema(message_type=full_type)
    except InterfaceReceiveError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'data': snapshot,
        'message': 'Message schema를 조회했습니다.',
    }


@router.post('/ros/interfaces/topic-publish')
async def publish_registered_topic(request: Request) -> dict[str, Any]:
    """FastAPI Router에서 Topic 메시지를 발행하는 함수입니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='A JSON request body is required.') from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail='The JSON request body must be an object.')

    topic_name = payload.get('topic_name')
    topic_type = payload.get('topic_type') or payload.get('full_type')
    message_data = payload.get('message')
    if not isinstance(topic_name, str) or not topic_name:
        raise HTTPException(status_code=400, detail='topic_name is required.')
    if not isinstance(topic_type, str) or not topic_type:
        raise HTTPException(status_code=400, detail='topic_type or full_type is required.')
    if not isinstance(message_data, dict):
        raise HTTPException(status_code=400, detail='message must be an object.')

    try:
        result = ros_monitor.publish_topic(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=message_data,
            qos_selection=payload.get('qos'),
        )
    except InterfaceReceiveError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        **result,
        'message': (
            'The payload does not match the Message type. Nothing was published.'
            if result.get('error_type') == 'validation_error'
            else (
                'An internal Action Topic cannot be used for regular Message publishing.'
                if result.get('error_type') == 'action_internal_topic'
                else (
                    'The Topic name already exists with a different Message type. Nothing was published.'
                    if result.get('error_type') == 'topic_type_conflict'
                    else 'Topic Publish가 완료되었습니다.'
                )
            )
        ),
    }


@router.get('/ros/interfaces/topic-publish/history')
def get_topic_publish_history(limit: int | None = Query(default=100)) -> dict[str, Any]:
    """최근 Topic Publish 실행 이력을 반환합니다."""
    snapshot = ros_monitor.topic_publish_history(limit=limit)
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/topic-publish/continuous/start')
async def start_continuous_topic_publish(request: Request) -> dict[str, Any]:
    """사용자가 요청한 Topic 주기 발행을 시작합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='A JSON request body is required.') from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail='The JSON request body must be an object.')
    topic_name = payload.get('topic_name')
    topic_type = payload.get('topic_type') or payload.get('full_type')
    message_data = payload.get('message')
    if not isinstance(topic_name, str) or not topic_name:
        raise HTTPException(status_code=400, detail='topic_name is required.')
    if not isinstance(topic_type, str) or not topic_type:
        raise HTTPException(status_code=400, detail='topic_type or full_type is required.')
    if not isinstance(message_data, dict):
        raise HTTPException(status_code=400, detail='message must be an object.')
    try:
        state = ros_monitor.start_continuous_topic_publish(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=message_data,
            hz=payload.get('hz', 10.0),
            qos_selection=payload.get('qos'),
        )
    except InterfaceReceiveError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        **state,
        'success': state.get('active') is True,
        'data': state,
        'message': 'Topic 지속 발행을 시작했습니다.' if state.get('active') else 'Continuous Topic publishing failed to start.',
    }


@router.post('/ros/interfaces/topic-publish/continuous/stop')
async def stop_continuous_topic_publish(request: Request) -> dict[str, Any]:
    """사용자가 시작한 Topic 주기 발행을 중지합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='A JSON request body is required.') from exc
    topic_name = payload.get('topic_name') if isinstance(payload, dict) else None
    topic_type = (payload.get('topic_type') or payload.get('full_type')) if isinstance(payload, dict) else None
    if not isinstance(topic_name, str) or not topic_name:
        raise HTTPException(status_code=400, detail='topic_name is required.')
    if not isinstance(topic_type, str) or not topic_type:
        raise HTTPException(status_code=400, detail='topic_type or full_type is required.')
    state = ros_monitor.stop_continuous_topic_publish(
        topic_name=topic_name,
        topic_type=topic_type,
    )
    return {**state, 'success': True, 'data': state, 'message': 'Topic 지속 발행을 중지했습니다.'}


@router.get('/ros/interfaces/topic-publish/continuous')
def get_continuous_topic_publishes() -> dict[str, Any]:
    """Interface Lab의 Topic 주기 발행 상태를 반환합니다."""
    snapshot = ros_monitor.continuous_topic_publishes()
    return {'success': True, 'data': snapshot['publishes'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/topic-publish/history/reset')
async def reset_topic_publish_history(request: Request) -> dict[str, Any]:
    """선택한 Topic의 Publish 이력을 초기화합니다."""
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    snapshot = ros_monitor.reset_topic_publish_history(
        topic_name=payload.get('topic_name'),
        topic_type=payload.get('topic_type') or payload.get('full_type'),
    )
    return {'success': True, 'data': snapshot, 'message': 'Topic Publish 이력을 초기화했습니다.'}

"""FastAPI Router의 action_execution 관련 기능을 담당하는 모듈입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import ActionGoalError
from ros2_dashboard_monitor.transport.state import ros_monitor


router = APIRouter()


@router.get('/ros/interfaces/callable-actions')
def get_callable_actions() -> dict[str, Any]:
    """Registry와 Graph가 일치하는 실행 가능 Action 목록을 반환합니다."""
    snapshot = ros_monitor.callable_actions()
    return {
        'success': True,
        'data': snapshot['actions'],
        'meta': snapshot['meta'],
        'message': '실행 가능한 등록 Action 목록을 조회했습니다.',
    }


@router.post('/ros/interfaces/action-goal')
async def send_registered_action_goal(request: Request) -> dict[str, Any]:
    """요청 JSON을 검증한 뒤 사용자가 선택한 Action에 Goal을 보냅니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='A JSON request body is required.') from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail='The JSON request body must be an object.')

    action_name = payload.get('action_name')
    action_type = payload.get('action_type')
    full_type = payload.get('full_type')
    goal_data = payload.get('goal')
    if not isinstance(action_name, str) or not action_name:
        raise HTTPException(status_code=400, detail='action_name is required.')
    if full_type is not None and (not isinstance(full_type, str) or not full_type):
        raise HTTPException(status_code=400, detail='full_type must be a non-empty string.')
    if action_type is not None and (not isinstance(action_type, str) or not action_type):
        raise HTTPException(status_code=400, detail='action_type must be a non-empty string.')
    if full_type and action_type and full_type != action_type:
        raise HTTPException(status_code=400, detail='action_type and full_type must match.')
    selected_type = full_type or action_type
    if not selected_type:
        raise HTTPException(status_code=400, detail='full_type or action_type is required.')
    if not isinstance(goal_data, dict):
        raise HTTPException(status_code=400, detail='goal must be an object.')

    try:
        result = await run_in_threadpool(
            ros_monitor.send_action_goal,
            action_name=action_name,
            action_type=selected_type,
            goal_data=goal_data,
            timeout_sec=payload.get('timeout_sec'),
            qos_selection=payload.get('qos'),
            domain_id=payload.get('domain_id'),
        )
    except ActionGoalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        **result,
        'message': (
            'The goal payload does not match the Action type. No goal was sent to the server.'
            if result.get('error_type') == 'validation_error'
            else 'Action Goal 실행이 완료되었습니다.'
        ),
    }


@router.get('/ros/interfaces/action-goal/history')
def get_action_goal_history() -> dict[str, Any]:
    """Interface Lab의 Action Goal 실행 이력을 반환합니다."""
    snapshot = ros_monitor.action_goal_history()
    return {
        'success': True,
        'data': snapshot['goals'],
        'meta': snapshot['meta'],
        'message': 'Action Goal history를 조회했습니다.',
    }


@router.post('/ros/interfaces/action-goal/history/reset')
async def reset_action_goal_history(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    snapshot = ros_monitor.reset_action_goal_history(action_name=payload.get('action_name'), action_type=payload.get('action_type'))
    return {'success': True, 'data': snapshot, 'message': 'Action Goal 전체 이력을 초기화했습니다.'}


@router.post('/ros/interfaces/action-goal/cancel')
async def cancel_registered_action_goal(request: Request) -> dict[str, Any]:
    body = await request.json()
    try:
        result = await run_in_threadpool(
            ros_monitor.cancel_action_goal,
            action_name=str(body.get('action_name') or ''),
            action_type=str(body.get('action_type') or ''),
            timeout_sec=body.get('timeout_sec'),
        )
    except ActionGoalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {'success': result['success'], 'data': result}


@router.get('/ros/interfaces/receive/actions/history')
def get_receive_action_history() -> dict[str, Any]:
    """Action Goal에서 받은 feedback과 result 이력을 반환합니다."""
    snapshot = ros_monitor.receive_action_history()
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/receive/actions/history/reset')
async def reset_receive_action_history(request: Request) -> dict[str, Any]:
    """선택한 Action의 feedback·result 이력을 초기화합니다."""
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    snapshot = ros_monitor.reset_receive_action_history(
        action_name=payload.get('action_name'),
        action_type=payload.get('action_type'),
    )
    return {'success': True, 'data': snapshot, 'message': 'Action 수신 이력을 초기화했습니다.'}

"""FastAPI Router의 service_execution 관련 기능을 담당하는 모듈입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from ros2_dashboard_monitor.transport.state import ros_monitor
from ros2_dashboard_monitor.interface_lab.execution.service_call_runtime import ServiceCallError
from ros2_dashboard_monitor.interface_lab.server.service_server_runtime import ServiceServerError


router = APIRouter()


def _object_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail='The JSON request body must be an object.')
    return payload


@router.get('/ros/interfaces/callable-services')
def get_callable_services() -> dict[str, Any]:
    """Registry와 Graph가 일치하는 호출 가능 Service 목록을 반환합니다."""
    snapshot = ros_monitor.callable_services()
    return {
        'success': True,
        'data': snapshot['services'],
        'meta': snapshot['meta'],
        'message': '호출 가능한 등록 Service 목록을 조회했습니다.',
    }


@router.post('/ros/interfaces/service-call')
async def call_registered_service(request: Request) -> dict[str, Any]:
    """요청 JSON을 검증한 뒤 사용자가 선택한 Service를 한 번 호출합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='A JSON request body is required.') from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail='The JSON request body must be an object.')

    service_name = payload.get('service_name')
    service_type = payload.get('service_type')
    request_data = payload.get('request')
    if not isinstance(service_name, str) or not service_name:
        raise HTTPException(status_code=400, detail='service_name is required.')
    if not isinstance(service_type, str) or not service_type:
        raise HTTPException(status_code=400, detail='service_type is required.')
    if not isinstance(request_data, dict):
        raise HTTPException(status_code=400, detail='request must be an object.')

    try:
        result = await run_in_threadpool(
            ros_monitor.call_service,
            service_name=service_name,
            service_type=service_type,
            request_data=request_data,
            timeout_sec=payload.get('timeout_sec'),
            qos_selection=payload.get('qos'),
            domain_id=payload.get('domain_id'),
        )
    except (ServiceCallError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        **result,
        'message': (
            'The request payload does not match the Service type. No request was sent to the server.'
            if result.get('error_type') == 'validation_error'
            else 'Service call이 완료되었습니다.'
        ),
    }


@router.get('/ros/interfaces/service-call/history')
def get_service_call_history() -> dict[str, Any]:
    """Interface Lab의 Service Call 실행 이력을 반환합니다."""
    snapshot = ros_monitor.service_call_history()
    return {
        'success': True,
        'data': snapshot['calls'],
        'meta': snapshot['meta'],
        'message': 'Service call history를 조회했습니다.',
    }


@router.post('/ros/interfaces/service-call/history/reset')
async def reset_service_call_history(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    snapshot = ros_monitor.reset_service_call_history(service_name=payload.get('service_name'), service_type=payload.get('service_type'), domain_id=payload.get('domain_id'))
    return {'success': True, 'data': snapshot, 'message': 'Service Call 전체 이력을 초기화했습니다.'}


@router.get('/ros/interfaces/receive/services/history')
def get_receive_service_history() -> dict[str, Any]:
    """Service Call에서 받은 응답 이력을 반환합니다."""
    snapshot = ros_monitor.receive_service_history()
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/receive/services/history/reset')
async def reset_receive_service_history(request: Request) -> dict[str, Any]:
    """선택한 Service의 응답 이력을 초기화합니다."""
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    snapshot = ros_monitor.reset_receive_service_history(
        service_name=payload.get('service_name'),
        service_type=payload.get('service_type'),
        domain_id=payload.get('domain_id'),
    )
    return {'success': True, 'data': snapshot, 'message': 'Service 수신 이력을 초기화했습니다.'}


@router.get('/ros/interfaces/service-servers/types')
def get_service_server_types() -> dict[str, Any]:
    snapshot = ros_monitor.service_server_types()
    return {'success': True, 'data': snapshot['services'], 'meta': snapshot['meta']}


@router.get('/ros/interfaces/service-servers')
def get_service_servers() -> dict[str, Any]:
    snapshot = ros_monitor.service_server_status()
    return {'success': True, 'data': snapshot['servers'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/service-servers/start')
async def start_service_server(request: Request) -> dict[str, Any]:
    try:
        payload = _object_payload(await request.json())
        result = await run_in_threadpool(
            ros_monitor.start_service_server,
            service_name=payload.get('service_name'),
            service_type=payload.get('service_type'),
            response_data=payload.get('response'),
            domain_id=payload.get('domain_id'),
        )
    except (ValueError, ServiceServerError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.post('/ros/interfaces/service-servers/stop')
async def stop_service_server(request: Request) -> dict[str, Any]:
    try:
        payload = _object_payload(await request.json())
        result = await run_in_threadpool(
            ros_monitor.stop_service_server,
            service_name=payload.get('service_name'),
            service_type=payload.get('service_type'),
            domain_id=payload.get('domain_id'),
        )
    except (ValueError, ServiceServerError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.get('/ros/interfaces/service-servers/history')
def get_service_server_history() -> dict[str, Any]:
    snapshot = ros_monitor.service_server_history()
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.post('/ros/interfaces/service-servers/history/reset')
async def reset_service_server_history(request: Request) -> dict[str, Any]:
    try:
        payload = _object_payload(await request.json())
        result = await run_in_threadpool(
            ros_monitor.reset_service_server_history,
            service_name=payload.get('service_name'),
            service_type=payload.get('service_type'),
            domain_id=payload.get('domain_id'),
        )
    except (ValueError, ServiceServerError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {'success': True, 'data': result}

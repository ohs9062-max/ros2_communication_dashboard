"""FastAPI Router의 monitoring 관련 기능을 담당하는 모듈입니다."""

import asyncio
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ros2_dashboard_monitor.transport.state import ros_monitor, websocket_manager


WEBSOCKET_INTERVAL_SEC = 1.0

router = APIRouter()


@router.get('/ros/topics')
def get_ros_topics() -> dict[str, Any]:
    """현재 Topic 목록과 갱신 시각을 반환합니다."""
    snapshot = ros_monitor.snapshot()
    return {
        'success': True,
        'data': snapshot['topics'],
        'meta': {
            'count': snapshot['count'],
            'last_updated': snapshot['last_updated'],
        },
        'message': 'ROS2 topics fetched successfully',
    }


@router.get('/ros/topics/latest')
def get_latest_ros_topic(name: str = Query(...), domain_id: int | None = Query(None)) -> dict[str, Any]:
    """요청한 Topic의 최신 수신 메시지를 반환합니다."""
    return ros_monitor.latest_message(name, domain_id=domain_id)


@router.get('/ros/topics/hz')
def get_ros_topic_hz(name: str = Query(...), domain_id: int | None = Query(None)) -> dict[str, Any]:
    """요청한 Topic의 최근 수신 Hz를 반환합니다."""
    return ros_monitor.topic_hz(name, domain_id=domain_id)


@router.get('/ros/topics/history')
def get_ros_topic_history(
    name: str = Query(...),
    limit: int = Query(100, ge=1, le=500), domain_id: int | None = Query(None),
) -> dict[str, Any]:
    """실제 Monitor Subscription이 수신한 최근 Topic preview를 반환합니다."""
    return ros_monitor.topic_history(name, limit=limit, domain_id=domain_id)


@router.get('/ros/topics/image-preview')
def get_ros_topic_image_preview(name: str = Query(...), domain_id: int | None = Query(None)) -> dict[str, Any]:
    """선택한 Camera Topic live preview의 최신 frame을 반환합니다."""
    return ros_monitor.image_preview(name, domain_id=domain_id)


@router.delete('/ros/topics/image-preview')
def stop_ros_topic_image_preview(name: str = Query(...), domain_id: int | None = Query(None)) -> dict[str, Any]:
    """상세 화면을 닫은 Camera Topic의 encode demand를 즉시 해제합니다."""
    return ros_monitor.stop_image_preview(name, domain_id=domain_id)


@router.get('/ros/services')
def get_ros_services(
    include_hidden: bool = Query(False),
) -> dict[str, Any]:
    """현재 Service 목록을 반환하며 필요하면 내부 Service도 포함합니다."""
    snapshot = ros_monitor.service_snapshot(
        include_hidden=include_hidden,
    )
    return {
        'success': True,
        'data': {
            'services': snapshot['services'],
            'meta': snapshot['meta'],
        },
    }


@router.get('/ros/services/history')
def get_ros_service_history(
    name: str = Query(...),
    service_type: str | None = Query(None),
    limit: int = Query(30, ge=1, le=30), domain_id: int | None = Query(None),
) -> dict[str, Any]:
    """한 Service의 실제 Interface Lab Call 이력만 반환합니다."""
    snapshot = ros_monitor.service_history(
        service_name=name,
        service_type=service_type,
        limit=limit, domain_id=domain_id,
    )
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.get('/ros/actions')
def get_ros_actions() -> dict[str, Any]:
    """현재 Action 목록과 관찰 상태를 반환합니다."""
    snapshot = ros_monitor.action_snapshot()
    return {
        'success': True,
        'data': {
            'actions': snapshot['actions'],
            'meta': snapshot['meta'],
        },
    }


@router.get('/ros/actions/history')
def get_ros_action_history(
    name: str = Query(...),
    action_type: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500), domain_id: int | None = Query(None),
) -> dict[str, Any]:
    """한 Action의 Interface Lab 실행과 실제 관찰 event 이력을 반환합니다."""
    snapshot = ros_monitor.action_history(
        action_name=name,
        action_type=action_type,
        limit=limit, domain_id=domain_id,
    )
    return {'success': True, 'data': snapshot['history'], 'meta': snapshot['meta']}


@router.get('/ros/nodes')
def get_ros_nodes() -> dict[str, Any]:
    """현재 Node 목록과 통신 관계 수를 반환합니다."""
    snapshot = ros_monitor.node_snapshot()
    return {
        'success': True,
        'data': {
            'nodes': snapshot['nodes'],
            'meta': snapshot['meta'],
        },
    }


@router.get('/ros/alerts')
def get_ros_alerts() -> dict[str, Any]:
    """현재 active Alert와 최근 해결 이력을 반환합니다."""
    return ros_monitor.alerts()


@router.post('/ros/alerts/history/reset')
def reset_ros_alert_history() -> dict[str, Any]:
    """해결된 이전 Alert history를 메모리에서 삭제합니다."""
    result = ros_monitor.reset_alert_history()
    return {
        'success': True,
        'data': result,
        'message': '이전 Alert 이력을 삭제했습니다.',
    }


@router.post('/ros/alerts/current/reset')
def reset_current_ros_alerts() -> dict[str, Any]:
    """현재 Alert를 확인 처리해 동일 발생 건을 숨깁니다."""
    result = ros_monitor.reset_current_alerts()
    return {
        'success': True,
        'data': result,
        'message': '현재 Alert를 확인 처리했습니다.',
    }


@router.websocket('/ws/monitor')
async def monitor_websocket(websocket: WebSocket) -> None:
    """연결된 브라우저에 1초마다 경량 모니터 snapshot을 전송합니다."""
    await websocket_manager.connect(websocket)
    try:
        while True:
            sent = await websocket_manager.send_json(
                websocket,
                ros_monitor.websocket_snapshot(),
            )
            if not sent:
                break

            await asyncio.sleep(WEBSOCKET_INTERVAL_SEC)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    finally:
        websocket_manager.disconnect(websocket)

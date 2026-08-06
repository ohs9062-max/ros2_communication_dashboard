"""Cached monitoring REST endpoints and browser WebSocket."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.app_state import alert_history, monitor_cache, monitor_client, websocket_manager
from app.monitor_client.client import MonitorUnavailable
from fastapi import HTTPException


router = APIRouter()


def _cached(key: str) -> Any:
    state = monitor_cache.snapshot()
    return state['data'].get(key)


@router.get('/ros/topics')
def topics() -> dict[str, Any]:
    snapshot = _cached('topics') or {'topics': [], 'count': 0, 'last_updated': None}
    return {
        'success': True,
        'data': snapshot.get('topics', []),
        'meta': {'count': snapshot.get('count', 0), 'last_updated': snapshot.get('last_updated')},
        'message': 'ROS2 topics fetched successfully',
    }


@router.get('/ros/services')
def services(include_hidden: bool = Query(False)) -> dict[str, Any] | None:
    if include_hidden:
        try:
            response = monitor_client.request('GET', '/ros/services?include_hidden=true')
        except MonitorUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return json.loads(response.content)
    snapshot = _cached('services') or {'services': [], 'meta': {}}
    return {'success': True, 'data': {'services': snapshot['services'], 'meta': snapshot['meta']}}


@router.get('/ros/actions')
def actions() -> dict[str, Any]:
    snapshot = _cached('actions') or {'actions': [], 'meta': {}}
    return {'success': True, 'data': {'actions': snapshot['actions'], 'meta': snapshot['meta']}}


@router.get('/ros/nodes')
def nodes() -> dict[str, Any]:
    snapshot = _cached('nodes') or {'nodes': [], 'meta': {}}
    return {'success': True, 'data': {'nodes': snapshot['nodes'], 'meta': snapshot['meta']}}


@router.get('/ros/alerts')
def alerts() -> dict[str, Any]:
    return alert_history.snapshot()


@router.post('/ros/alerts/history/reset')
def reset_alert_history() -> dict[str, Any]:
    return {'success': True, 'data': alert_history.reset_history(), 'message': '이전 Alert 이력을 삭제했습니다.'}


@router.post('/ros/alerts/current/reset')
def dismiss_current_alerts() -> dict[str, Any]:
    return {'success': True, 'data': alert_history.dismiss_current(), 'message': '현재 Alert를 확인 처리했습니다.'}


@router.websocket('/ws/monitor')
async def monitor_websocket(websocket: WebSocket) -> None:
    await websocket_manager.connect(websocket)
    try:
        while True:
            payload = _cached('websocket') or {
                'type': 'monitor_snapshot',
                'connected': False,
                'reason': monitor_cache.snapshot()['error'],
            }
            if not await websocket_manager.send_json(websocket, payload):
                break
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(websocket)

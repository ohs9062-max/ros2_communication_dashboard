"""Browser WebSocket stream backed by the Backend monitor cache."""

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.app_state import monitor_cache, websocket_manager


router = APIRouter()


def build_monitor_websocket_payload(cache: dict[str, Any]) -> dict[str, Any]:
    payload = dict(cache['data'].get('websocket') or {'type': 'monitor_snapshot'})
    payload['connected'] = cache['connected']
    payload['reason'] = cache['error']
    return payload


@router.websocket('/ws/monitor')
async def monitor_websocket(websocket: WebSocket) -> None:
    await websocket_manager.connect(websocket)
    try:
        while True:
            cache = monitor_cache.snapshot()
            payload = build_monitor_websocket_payload(cache)
            if not await websocket_manager.send_json(websocket, payload):
                break
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(websocket)

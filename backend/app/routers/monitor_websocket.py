"""Browser WebSocket stream backed by the Backend monitor cache."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.app_state import monitor_cache, websocket_manager


router = APIRouter()


@router.websocket('/ws/monitor')
async def monitor_websocket(websocket: WebSocket) -> None:
    await websocket_manager.connect(websocket)
    try:
        while True:
            cache = monitor_cache.snapshot()
            payload = cache['data'].get('websocket') or {
                'type': 'monitor_snapshot',
                'connected': False,
                'reason': cache['error'],
            }
            if not await websocket_manager.send_json(websocket, payload):
                break
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(websocket)
